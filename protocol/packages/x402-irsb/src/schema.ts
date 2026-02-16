/**
 * x402 Payload Schema and Commitment Generation
 *
 * Canonical serialization and hashing for x402 receipt payloads.
 * Ensures deterministic commitment generation for on-chain verification.
 */

import { keccak256, toUtf8Bytes, solidityPacked } from 'ethers';
import type { X402ReceiptPayload, X402Service, X402Payment, X402Request, X402Timing } from './types.js';
import { X402_PAYLOAD_VERSION } from './types.js';

/**
 * Sort object keys recursively for canonical JSON serialization
 */
function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys) as unknown as T;
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key] as Record<string, unknown>);
  }
  return sorted as T;
}

/**
 * Canonicalize payload for deterministic hashing.
 *
 * Keys are sorted alphabetically at each level to ensure
 * the same payload always produces the same JSON string.
 *
 * @param payload - The x402 receipt payload
 * @returns Canonical JSON string
 */
export function canonicalize(payload: X402ReceiptPayload): string {
  const sorted = sortObjectKeys(payload as unknown as Record<string, unknown>);
  return JSON.stringify(sorted);
}

/**
 * Compute keccak256 commitment over canonical payload.
 *
 * This is the primary commitment stored on-chain in metadataCommitment.
 *
 * @param payload - The x402 receipt payload
 * @returns bytes32 commitment hash
 */
export function computePayloadCommitment(payload: X402ReceiptPayload): string {
  const canonical = canonicalize(payload);
  return keccak256(toUtf8Bytes(canonical));
}

/**
 * Compute request fingerprint from request parameters.
 *
 * Used for deduplication and replay prevention.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path
 * @param body - Request body string (will be hashed)
 * @param timestamp - Request timestamp
 * @returns bytes32 fingerprint
 */
export function computeRequestFingerprint(
  method: string,
  path: string,
  body: string,
  timestamp: number
): string {
  // Hash the body to get a bytes32 value
  const bodyHash = keccak256(toUtf8Bytes(body || ''));
  return keccak256(
    solidityPacked(
      ['string', 'string', 'bytes32', 'uint256'],
      [method, path, bodyHash, timestamp]
    )
  );
}

/**
 * Compute payment terms hash for constraintsHash field.
 *
 * @param payment - Payment details
 * @param expiry - Payment expiry timestamp
 * @returns bytes32 terms hash
 */
export function computeTermsHash(payment: X402Payment, expiry: number): string {
  return keccak256(
    solidityPacked(
      ['string', 'string', 'uint256', 'uint256'],
      [payment.asset, payment.amount, payment.chainId, expiry]
    )
  );
}

/**
 * Compute intent hash from service and request IDs.
 *
 * @param service - Service identification
 * @param requestId - Request UUID
 * @returns bytes32 intent hash
 */
export function computeIntentHash(service: X402Service, requestId: string): string {
  return keccak256(
    solidityPacked(
      ['string', 'string'],
      [service.serviceId, requestId]
    )
  );
}

/**
 * Compute route hash from service endpoint.
 *
 * @param service - Service identification
 * @returns bytes32 route hash
 */
export function computeRouteHash(service: X402Service): string {
  return keccak256(
    solidityPacked(
      ['string', 'string'],
      [service.domain, service.endpoint]
    )
  );
}

/**
 * Compute evidence hash from payment reference.
 *
 * @param paymentRef - Payment transaction reference
 * @returns bytes32 evidence hash
 */
export function computeEvidenceHash(paymentRef: string): string {
  return keccak256(toUtf8Bytes(paymentRef));
}

/**
 * Validate CID format (basic validation for IPFS CIDs).
 *
 * @param cid - CID string to validate
 * @returns true if valid format
 */
export function isValidCID(cid: string): boolean {
  // Basic validation: max 64 chars, alphanumeric + base58 characters
  if (!cid || cid.length > 64) {
    return false;
  }

  // CIDv0 starts with Qm, CIDv1 starts with b
  const cidPattern = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;
  return cidPattern.test(cid);
}

/**
 * Format ciphertext pointer for storage.
 *
 * @param cid - IPFS CID or other pointer
 * @returns Normalized pointer string
 */
export function formatCiphertextPointer(cid: string): string {
  // If it's an IPFS CID, prefix with ipfs://
  if (isValidCID(cid)) {
    return `ipfs://${cid}`;
  }

  // Otherwise return as-is (could be arweave://, https://, etc.)
  return cid;
}

/**
 * Verify a commitment matches the plaintext payload.
 *
 * @param commitment - The stored commitment (bytes32)
 * @param payload - The plaintext payload to verify
 * @returns true if commitment matches
 */
export function verifyCommitment(commitment: string, payload: X402ReceiptPayload): boolean {
  const computed = computePayloadCommitment(payload);
  return computed.toLowerCase() === commitment.toLowerCase();
}

/**
 * Generate a unique nonce for replay prevention.
 *
 * @returns Random nonce string
 */
export function generateNonce(): string {
  // Generate 16 random bytes as hex
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new x402 receipt payload with defaults.
 *
 * @param params - Partial payload parameters
 * @returns Complete X402ReceiptPayload
 */
export function createPayload(params: {
  service: X402Service;
  payment: X402Payment;
  request: Omit<X402Request, 'requestFingerprint'> & { requestFingerprint?: string };
  response: { resultPointer: string; resultDigest: string };
  timing?: Partial<X402Timing>;
}): X402ReceiptPayload {
  const now = Math.floor(Date.now() / 1000);
  const defaultExpiry = now + 3600; // 1 hour default

  return {
    version: X402_PAYLOAD_VERSION,
    service: params.service,
    payment: params.payment,
    request: {
      requestId: params.request.requestId,
      requestFingerprint:
        params.request.requestFingerprint ||
        computeRequestFingerprint('POST', '/', '', now),
    },
    response: params.response,
    timing: {
      issuedAt: params.timing?.issuedAt ?? now,
      expiry: params.timing?.expiry ?? defaultExpiry,
      nonce: params.timing?.nonce ?? generateNonce(),
    },
  };
}

// Re-export version constant
export { X402_PAYLOAD_VERSION };
