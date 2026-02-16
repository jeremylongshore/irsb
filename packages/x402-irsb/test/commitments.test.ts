/**
 * Commitment Generation Tests
 *
 * Tests for canonical serialization and deterministic hashing.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  computePayloadCommitment,
  computeRequestFingerprint,
  computeTermsHash,
  computeIntentHash,
  computeRouteHash,
  computeEvidenceHash,
  isValidCID,
  formatCiphertextPointer,
  verifyCommitment,
  generateNonce,
  createPayload,
  X402_PAYLOAD_VERSION,
} from '../src/schema.js';
import type { X402ReceiptPayload, X402Payment, X402Service } from '../src/types.js';

describe('Canonical Serialization', () => {
  it('should produce deterministic JSON with sorted keys', () => {
    const payload1 = {
      b: 2,
      a: 1,
      c: { z: 3, y: 2, x: 1 },
    };

    const payload2 = {
      a: 1,
      c: { x: 1, y: 2, z: 3 },
      b: 2,
    };

    // Same data, different key order should produce same canonical form
    const canonical1 = canonicalize(payload1 as unknown as X402ReceiptPayload);
    const canonical2 = canonicalize(payload2 as unknown as X402ReceiptPayload);

    expect(canonical1).toBe(canonical2);
  });

  it('should handle nested objects', () => {
    const payload = {
      outer: {
        inner: {
          deep: { z: 1, a: 2 },
        },
      },
    };

    const canonical = canonicalize(payload as unknown as X402ReceiptPayload);
    expect(canonical).toContain('"a":2');
    expect(canonical).toContain('"z":1');
    // 'a' should come before 'z' in sorted order
    expect(canonical.indexOf('"a"')).toBeLessThan(canonical.indexOf('"z"'));
  });

  it('should handle arrays in objects', () => {
    const payload = {
      items: [{ b: 2, a: 1 }, { d: 4, c: 3 }],
    };

    const canonical = canonicalize(payload as unknown as X402ReceiptPayload);
    // Array elements should have sorted keys
    expect(canonical).toContain('"a":1,"b":2');
    expect(canonical).toContain('"c":3,"d":4');
  });
});

describe('Payload Commitment', () => {
  const samplePayload: X402ReceiptPayload = {
    version: X402_PAYLOAD_VERSION,
    service: {
      serviceId: 'test-service',
      endpoint: 'POST /api/generate',
      domain: 'api.example.com',
    },
    payment: {
      paymentRef: '0x1234567890abcdef',
      asset: 'ETH',
      amount: '1000000000000000',
      chainId: 11155111,
    },
    request: {
      requestId: 'req-123',
      requestFingerprint: '0xabcdef',
    },
    response: {
      resultPointer: 'QmTest123',
      resultDigest: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    timing: {
      issuedAt: 1700000000,
      expiry: 1700003600,
      nonce: '0x1234',
    },
  };

  it('should produce same commitment for same payload', () => {
    const commitment1 = computePayloadCommitment(samplePayload);
    const commitment2 = computePayloadCommitment(samplePayload);

    expect(commitment1).toBe(commitment2);
  });

  it('should produce different commitment for different payload', () => {
    const modifiedPayload = {
      ...samplePayload,
      timing: { ...samplePayload.timing, nonce: '0x5678' },
    };

    const commitment1 = computePayloadCommitment(samplePayload);
    const commitment2 = computePayloadCommitment(modifiedPayload);

    expect(commitment1).not.toBe(commitment2);
  });

  it('should produce bytes32 hash (66 char hex string)', () => {
    const commitment = computePayloadCommitment(samplePayload);

    expect(commitment).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should verify commitment correctly', () => {
    const commitment = computePayloadCommitment(samplePayload);

    expect(verifyCommitment(commitment, samplePayload)).toBe(true);
    expect(verifyCommitment('0x' + '00'.repeat(32), samplePayload)).toBe(false);
  });
});

describe('Hash Functions', () => {
  const sampleService: X402Service = {
    serviceId: 'test-service',
    endpoint: 'POST /api/generate',
    domain: 'api.example.com',
  };

  const samplePayment: X402Payment = {
    paymentRef: '0x1234567890abcdef',
    asset: 'ETH',
    amount: '1000000000000000',
    chainId: 11155111,
  };

  it('should compute intent hash from service and request', () => {
    const hash = computeIntentHash(sampleService, 'req-123');

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should compute different intent hash for different requestId', () => {
    const hash1 = computeIntentHash(sampleService, 'req-123');
    const hash2 = computeIntentHash(sampleService, 'req-456');

    expect(hash1).not.toBe(hash2);
  });

  it('should compute terms hash from payment', () => {
    const hash = computeTermsHash(samplePayment, 1700003600);

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should compute different terms hash for different expiry', () => {
    const hash1 = computeTermsHash(samplePayment, 1700003600);
    const hash2 = computeTermsHash(samplePayment, 1700007200);

    expect(hash1).not.toBe(hash2);
  });

  it('should compute route hash from service', () => {
    const hash = computeRouteHash(sampleService);

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should compute evidence hash from payment reference', () => {
    const hash = computeEvidenceHash('0x1234567890abcdef');

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should compute request fingerprint', () => {
    const hash = computeRequestFingerprint('POST', '/api/generate', 'request body content', 1700000000);

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe('CID Validation', () => {
  it('should validate CIDv0 format', () => {
    // Valid CIDv0 starts with Qm and is 46 chars
    const validCIDv0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    expect(isValidCID(validCIDv0)).toBe(true);
  });

  it('should validate CIDv1 format', () => {
    // Valid CIDv1 starts with b
    const validCIDv1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    expect(isValidCID(validCIDv1)).toBe(true);
  });

  it('should reject invalid CID', () => {
    expect(isValidCID('')).toBe(false);
    expect(isValidCID('not-a-cid')).toBe(false);
    expect(isValidCID('Qm' + 'x'.repeat(100))).toBe(false); // Too long
  });

  it('should format CID with ipfs:// prefix', () => {
    const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    expect(formatCiphertextPointer(cid)).toBe(`ipfs://${cid}`);
  });

  it('should pass through non-CID pointers', () => {
    const arweaveUrl = 'arweave://abc123';
    expect(formatCiphertextPointer(arweaveUrl)).toBe(arweaveUrl);

    const httpsUrl = 'https://example.com/data';
    expect(formatCiphertextPointer(httpsUrl)).toBe(httpsUrl);
  });
});

describe('Nonce Generation', () => {
  it('should generate unique nonces', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();

    expect(nonce1).not.toBe(nonce2);
  });

  it('should generate hex-encoded nonces', () => {
    const nonce = generateNonce();

    expect(nonce).toMatch(/^0x[a-f0-9]{32}$/);
  });
});

describe('Payload Creation', () => {
  it('should create payload with defaults', () => {
    const payload = createPayload({
      service: {
        serviceId: 'test',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x123',
        asset: 'ETH',
        amount: '1000',
        chainId: 1,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + '00'.repeat(32),
      },
    });

    expect(payload.version).toBe(X402_PAYLOAD_VERSION);
    expect(payload.timing.issuedAt).toBeGreaterThan(0);
    expect(payload.timing.expiry).toBeGreaterThan(payload.timing.issuedAt);
    expect(payload.timing.nonce).toMatch(/^0x[a-f0-9]+$/);
    expect(payload.request.requestFingerprint).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should allow custom timing', () => {
    const customTiming = {
      issuedAt: 1700000000,
      expiry: 1700100000,
      nonce: '0xcustom',
    };

    const payload = createPayload({
      service: {
        serviceId: 'test',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x123',
        asset: 'ETH',
        amount: '1000',
        chainId: 1,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + '00'.repeat(32),
      },
      timing: customTiming,
    });

    expect(payload.timing.issuedAt).toBe(customTiming.issuedAt);
    expect(payload.timing.expiry).toBe(customTiming.expiry);
    expect(payload.timing.nonce).toBe(customTiming.nonce);
  });
});
