import { lookup as dnsLookup } from 'node:dns/promises';
import { sha256Hex } from '../utils/canonical.js';
import { AgentCardSchema } from './agentCardSchema.js';
import type { CardFetchResult } from './identityTypes.js';

const USER_AGENT = 'irsb-watchtower/0.3.0';

export type DnsLookupFn = (hostname: string) => Promise<{ address: string }>;

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  allowHttp?: boolean;
  maxRedirects?: number;
  /** Override DNS resolver (for testing). Defaults to node:dns/promises lookup. */
  dnsLookup?: DnsLookupFn;
  /** Override global fetch (for testing). */
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Fetch and validate an agent card from a URI with SSRF protections.
 */
export async function fetchAgentCard(
  uri: string,
  options?: FetchOptions,
): Promise<CardFetchResult> {
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const maxBytes = options?.maxBytes ?? 2 * 1024 * 1024;
  const allowHttp = options?.allowHttp ?? false;
  const maxRedirects = options?.maxRedirects ?? 3;
  const resolveDns = options?.dnsLookup ?? dnsLookup;
  const doFetch = options?.fetchFn ?? globalThis.fetch;

  // 1. Validate URL scheme
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return { status: 'SSRF_BLOCKED', error: `Invalid URL: ${uri}` };
  }

  const scheme = url.protocol.toLowerCase();
  if (scheme !== 'https:' && !(allowHttp && scheme === 'http:')) {
    return { status: 'SSRF_BLOCKED', error: `Blocked scheme: ${scheme}` };
  }

  if (['file:', 'data:', 'ftp:'].includes(scheme)) {
    return { status: 'SSRF_BLOCKED', error: `Blocked scheme: ${scheme}` };
  }

  // 2. DNS check for SSRF
  const dnsResult = await checkDns(url.hostname, resolveDns);
  if (!dnsResult.safe) {
    return { status: 'SSRF_BLOCKED', error: dnsResult.reason };
  }

  // 3. Fetch with redirect handling
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url.toString();
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
      const response = await doFetch(currentUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        redirect: 'manual',
      });

      // Handle redirects manually to re-validate each hop
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return { status: 'UNREACHABLE', httpStatus: response.status, error: 'Redirect without Location header' };
        }

        redirectCount++;
        if (redirectCount > maxRedirects) {
          return { status: 'UNREACHABLE', error: `Too many redirects (>${maxRedirects})` };
        }

        // Re-validate redirect target
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, currentUrl);
        } catch {
          return { status: 'SSRF_BLOCKED', error: `Invalid redirect URL: ${location}` };
        }

        const redirectScheme = redirectUrl.protocol.toLowerCase();
        if (redirectScheme !== 'https:' && !(allowHttp && redirectScheme === 'http:')) {
          return { status: 'SSRF_BLOCKED', error: `Redirect to blocked scheme: ${redirectScheme}` };
        }

        const redirectDns = await checkDns(redirectUrl.hostname, resolveDns);
        if (!redirectDns.safe) {
          return { status: 'SSRF_BLOCKED', error: `Redirect to private IP: ${redirectDns.reason}` };
        }

        currentUrl = redirectUrl.toString();
        continue;
      }

      if (!response.ok) {
        return { status: 'UNREACHABLE', httpStatus: response.status, error: `HTTP ${response.status}` };
      }

      // Check Content-Length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        return { status: 'UNREACHABLE', error: `Content-Length ${contentLength} exceeds max ${maxBytes}` };
      }

      // Read body with size limit
      const body = await readBodyWithLimit(response, maxBytes);
      if (body === null) {
        return { status: 'UNREACHABLE', error: `Response body exceeds max ${maxBytes} bytes` };
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return { status: 'INVALID_SCHEMA', httpStatus: response.status, error: 'Response is not valid JSON' };
      }

      // Validate against schema
      const result = AgentCardSchema.safeParse(parsed);
      if (!result.success) {
        return {
          status: 'INVALID_SCHEMA',
          httpStatus: response.status,
          error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        };
      }

      const cardJson = body;
      const cardHash = sha256Hex(cardJson);

      return {
        status: 'OK',
        cardHash,
        cardJson,
        httpStatus: response.status,
      };
    }

    return { status: 'UNREACHABLE', error: `Too many redirects (>${maxRedirects})` };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'TIMEOUT', error: `Timed out after ${timeoutMs}ms` };
    }
    return { status: 'UNREACHABLE', error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
}

const PRIVATE_RANGES = [
  { prefix: '10.', bits: 8 },
  { prefix: '127.', bits: 8 },
  { prefix: '169.254.', bits: 16 },
  { prefix: '172.', bits: 12, check: (ip: string) => {
    const second = parseInt(ip.split('.')[1]!, 10);
    return second >= 16 && second <= 31;
  }},
  { prefix: '192.168.', bits: 16 },
];

function isPrivateIp(ip: string): boolean {
  // IPv6 loopback / link-local / ULA
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }

  for (const range of PRIVATE_RANGES) {
    if (ip.startsWith(range.prefix)) {
      if (range.check) return range.check(ip);
      return true;
    }
  }

  // 0.0.0.0
  if (ip === '0.0.0.0') return true;

  return false;
}

async function checkDns(
  hostname: string,
  lookupFn: DnsLookupFn,
): Promise<{ safe: boolean; reason?: string }> {
  // If hostname is already an IP, check directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: `Private IP: ${hostname}` };
    }
    return { safe: true };
  }

  try {
    const { address } = await lookupFn(hostname);
    if (isPrivateIp(address)) {
      return { safe: false, reason: `${hostname} resolves to private IP: ${address}` };
    }
    return { safe: true };
  } catch (err) {
    return { safe: false, reason: `DNS lookup failed: ${(err as Error).message}` };
  }
}
