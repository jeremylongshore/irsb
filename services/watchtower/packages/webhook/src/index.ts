import { createHmac, randomBytes } from 'node:crypto';

/**
 * Webhook sink configuration
 */
export interface WebhookConfig {
  /** Target URL to send webhooks to */
  url: string;

  /** HMAC secret for signing payloads */
  secret: string;

  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelayMs?: number;

  /** Maximum age of timestamp for replay protection in seconds (default: 300) */
  maxTimestampAgeSeconds?: number;
}

/**
 * Webhook delivery result
 */
export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
  durationMs: number;
}

/**
 * Webhook payload envelope
 */
export interface WebhookPayload<T = unknown> {
  /** Event type identifier */
  event: string;

  /** Unique delivery ID for deduplication */
  deliveryId: string;

  /** Unix timestamp in seconds */
  timestamp: number;

  /** The actual payload data */
  data: T;
}

/**
 * Generate HMAC-SHA256 signature for a payload
 *
 * Signature format: HMAC-SHA256(timestamp.payload)
 * This binds the timestamp to the payload to prevent replay attacks
 */
export function generateSignature(
  payload: string,
  timestamp: number,
  secret: string
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Verify HMAC signature from X-Watchtower-Signature header
 *
 * Header format: t=<timestamp>,v1=<signature>
 *
 * @param payload - The raw request body string
 * @param header - The X-Watchtower-Signature header value
 * @param secret - The shared HMAC secret
 * @param maxAgeSeconds - Maximum allowed age of timestamp (default: 300)
 * @returns true if signature is valid and timestamp is fresh
 */
export function verifySignature(
  payload: string,
  header: string,
  secret: string,
  maxAgeSeconds: number = 300
): { valid: boolean; error?: string } {
  // Parse header: t=<timestamp>,v1=<signature>
  const parts = header.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return { valid: false, error: 'Invalid signature header format' };
  }

  const timestamp = parseInt(timestampPart.slice(2), 10);
  const signature = signaturePart.slice(3);

  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp in signature header' };
  }

  // Check timestamp freshness (replay protection)
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  if (age > maxAgeSeconds) {
    return { valid: false, error: `Timestamp too old: ${age}s > ${maxAgeSeconds}s` };
  }

  if (age < -60) {
    // Allow 60s clock skew into the future
    return { valid: false, error: 'Timestamp in the future' };
  }

  // Compute expected signature
  const expectedSignature = generateSignature(payload, timestamp, secret);

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a unique delivery ID
 */
export function generateDeliveryId(): string {
  return `wh_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, baseDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * exponentialDelay * 0.1;
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * WebhookSink - sends findings to configured webhook endpoints with HMAC signing
 */
export class WebhookSink {
  private readonly config: Required<WebhookConfig>;

  constructor(config: WebhookConfig) {
    this.config = {
      url: config.url,
      secret: config.secret,
      timeoutMs: config.timeoutMs ?? 10000,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      maxTimestampAgeSeconds: config.maxTimestampAgeSeconds ?? 300,
    };

    if (!this.config.secret || this.config.secret.length < 32) {
      throw new Error('Webhook secret must be at least 32 characters');
    }
  }

  /**
   * Send a webhook with automatic retries and HMAC signing
   */
  async send<T>(event: string, data: T): Promise<WebhookResult> {
    const startTime = Date.now();
    const deliveryId = generateDeliveryId();
    const timestamp = Math.floor(Date.now() / 1000);

    const payload: WebhookPayload<T> = {
      event,
      deliveryId,
      timestamp,
      data,
    };

    const body = JSON.stringify(payload);
    const signature = generateSignature(body, timestamp, this.config.secret);
    const signatureHeader = `t=${timestamp},v1=${signature}`;

    let lastError: string | undefined;
    let lastStatusCode: number | undefined;
    let actualAttempts = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      actualAttempts = attempt + 1;

      if (attempt > 0) {
        const delay = calculateBackoff(attempt - 1, this.config.retryDelayMs);
        await sleep(delay);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Watchtower-Signature': signatureHeader,
            'X-Watchtower-Delivery-Id': deliveryId,
            'X-Watchtower-Event': event,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatusCode = response.status;

        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            attempts: actualAttempts,
            durationMs: Date.now() - startTime,
          };
        }

        // Non-retryable status codes (4xx except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
          break;
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = 'Request timed out';
          } else {
            lastError = error.message;
          }
        } else {
          lastError = String(error);
        }
      }
    }

    return {
      success: false,
      statusCode: lastStatusCode,
      error: lastError,
      attempts: actualAttempts,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Send findings to webhook
   */
  async sendFindings(findings: unknown[]): Promise<WebhookResult> {
    return this.send('findings.detected', { findings, count: findings.length });
  }

  /**
   * Send action result to webhook
   */
  async sendActionResult(result: unknown): Promise<WebhookResult> {
    return this.send('action.executed', result);
  }

  /**
   * Send health/heartbeat to webhook
   */
  async sendHeartbeat(status: { chainId: number; lastBlock: string; uptime: number }): Promise<WebhookResult> {
    return this.send('heartbeat', status);
  }
}

/**
 * Create a webhook sink from configuration
 */
export function createWebhookSink(config: WebhookConfig): WebhookSink {
  return new WebhookSink(config);
}
