/**
 * Receipt Building Tests
 *
 * Tests for ReceiptV2 construction from x402 payloads.
 */

import { describe, it, expect } from 'vitest';
import { ZeroHash } from 'ethers';
import {
  buildReceiptV2FromX402,
  buildReceiptV2WithConfig,
  createSigningPayload,
  getEIP712Domain,
  computeReceiptV2Id,
  validateReceiptV2,
} from '../src/receipt.js';
import {
  computePayloadCommitment,
  computeIntentHash,
  computeTermsHash,
  computeRouteHash,
  computeEvidenceHash,
} from '../src/schema.js';
import { PrivacyLevel, X402_PAYLOAD_VERSION } from '../src/types.js';
import type { X402ReceiptPayload, X402ToReceiptParams } from '../src/types.js';

describe('ReceiptV2 Building', () => {
  const samplePayload: X402ReceiptPayload = {
    version: X402_PAYLOAD_VERSION,
    service: {
      serviceId: 'test-service-id',
      endpoint: 'POST /api/generate',
      domain: 'api.example.com',
    },
    payment: {
      paymentRef: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      asset: 'ETH',
      amount: '1000000000000000',
      chainId: 11155111,
    },
    request: {
      requestId: 'req-uuid-12345',
      requestFingerprint: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    response: {
      resultPointer: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      resultDigest: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    },
    timing: {
      issuedAt: 1700000000,
      expiry: 1700003600,
      nonce: '0x1234567890abcdef1234567890abcdef',
    },
  };

  const sampleParams: X402ToReceiptParams = {
    payload: samplePayload,
    ciphertextPointer: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    solverId: '0x' + '11'.repeat(32),
  };

  it('should build receipt with correct field mapping', () => {
    const result = buildReceiptV2FromX402(sampleParams);
    const receipt = result.receiptV2;

    // Verify intent hash
    const expectedIntentHash = computeIntentHash(
      samplePayload.service,
      samplePayload.request.requestId
    );
    expect(receipt.intentHash).toBe(expectedIntentHash);

    // Verify constraints hash
    const expectedConstraintsHash = computeTermsHash(
      samplePayload.payment,
      samplePayload.timing.expiry
    );
    expect(receipt.constraintsHash).toBe(expectedConstraintsHash);

    // Verify route hash
    const expectedRouteHash = computeRouteHash(samplePayload.service);
    expect(receipt.routeHash).toBe(expectedRouteHash);

    // Verify outcome hash (direct from response)
    expect(receipt.outcomeHash).toBe(samplePayload.response.resultDigest);

    // Verify evidence hash
    const expectedEvidenceHash = computeEvidenceHash(samplePayload.payment.paymentRef);
    expect(receipt.evidenceHash).toBe(expectedEvidenceHash);

    // Verify metadata commitment
    const expectedCommitment = computePayloadCommitment(samplePayload);
    expect(receipt.metadataCommitment).toBe(expectedCommitment);
  });

  it('should use default privacy level (SemiPublic)', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.receiptV2.privacyLevel).toBe(PrivacyLevel.SemiPublic);
  });

  it('should allow custom privacy level', () => {
    const params: X402ToReceiptParams = {
      ...sampleParams,
      privacyLevel: PrivacyLevel.Private,
    };

    const result = buildReceiptV2FromX402(params);

    expect(result.receiptV2.privacyLevel).toBe(PrivacyLevel.Private);
  });

  it('should set escrowId to ZeroHash when not provided', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.receiptV2.escrowId).toBe(ZeroHash);
  });

  it('should use provided escrowId', () => {
    const escrowId = '0x' + '22'.repeat(32);
    const params: X402ToReceiptParams = {
      ...sampleParams,
      escrowId,
    };

    const result = buildReceiptV2FromX402(params);

    expect(result.receiptV2.escrowId).toBe(escrowId);
  });

  it('should format ciphertext pointer with ipfs:// prefix', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.receiptV2.ciphertextPointer).toBe(
      `ipfs://${sampleParams.ciphertextPointer}`
    );
  });

  it('should set timing from payload', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.receiptV2.createdAt).toBe(BigInt(samplePayload.timing.issuedAt));
    expect(result.receiptV2.expiry).toBe(BigInt(samplePayload.timing.expiry));
  });

  it('should set solver ID', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.receiptV2.solverId).toBe(sampleParams.solverId);
  });

  it('should initialize signatures as empty', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.receiptV2.solverSig).toBe('0x');
    expect(result.receiptV2.clientSig).toBe('0x');
  });

  it('should include debug information', () => {
    const result = buildReceiptV2FromX402(sampleParams);

    expect(result.debug).toBeDefined();
    expect(result.debug.metadataCommitment).toBe(result.receiptV2.metadataCommitment);
    expect(result.debug.intentHash).toBe(result.receiptV2.intentHash);
    expect(result.debug.constraintsHash).toBe(result.receiptV2.constraintsHash);
  });
});

describe('EIP-712 Domain', () => {
  it('should create correct domain', () => {
    const chainId = 11155111;
    const hubAddress = '0x' + 'aa'.repeat(20);

    const domain = getEIP712Domain(chainId, hubAddress);

    expect(domain.name).toBe('IRSB IntentReceiptHub');
    expect(domain.version).toBe('2');
    expect(domain.chainId).toBe(chainId);
    expect(domain.verifyingContract).toBe(hubAddress);
  });
});

describe('Signing Payload Generation', () => {
  const samplePayload: X402ReceiptPayload = {
    version: X402_PAYLOAD_VERSION,
    service: {
      serviceId: 'test-service',
      endpoint: 'POST /api/generate',
      domain: 'api.example.com',
    },
    payment: {
      paymentRef: '0x1234',
      asset: 'ETH',
      amount: '1000',
      chainId: 11155111,
    },
    request: {
      requestId: 'req-1',
      requestFingerprint: '0xfp',
    },
    response: {
      resultPointer: 'QmTest',
      resultDigest: '0x' + 'dd'.repeat(32),
    },
    timing: {
      issuedAt: 1700000000,
      expiry: 1700003600,
      nonce: '0xnonce',
    },
  };

  it('should generate signing payload with correct types', () => {
    const result = buildReceiptV2FromX402({
      payload: samplePayload,
      ciphertextPointer: 'QmTest',
      solverId: '0x' + '11'.repeat(32),
    });

    const chainId = 11155111;
    const hubAddress = '0x' + 'bb'.repeat(20);
    const signingPayload = createSigningPayload(result.receiptV2, chainId, hubAddress);

    expect(signingPayload.primaryType).toBe('IntentReceiptV2');
    expect(signingPayload.types.IntentReceiptV2).toBeDefined();
    expect(signingPayload.types.IntentReceiptV2.length).toBe(12);

    // Check all fields are in types
    const fieldNames = signingPayload.types.IntentReceiptV2.map((f) => f.name);
    expect(fieldNames).toContain('intentHash');
    expect(fieldNames).toContain('constraintsHash');
    expect(fieldNames).toContain('routeHash');
    expect(fieldNames).toContain('outcomeHash');
    expect(fieldNames).toContain('evidenceHash');
    expect(fieldNames).toContain('metadataCommitment');
    expect(fieldNames).toContain('ciphertextPointer');
    expect(fieldNames).toContain('privacyLevel');
    expect(fieldNames).toContain('escrowId');
    expect(fieldNames).toContain('createdAt');
    expect(fieldNames).toContain('expiry');
    expect(fieldNames).toContain('solverId');
  });

  it('should include correct message values', () => {
    const result = buildReceiptV2FromX402({
      payload: samplePayload,
      ciphertextPointer: 'QmTest',
      solverId: '0x' + '11'.repeat(32),
    });

    const chainId = 11155111;
    const hubAddress = '0x' + 'bb'.repeat(20);
    const signingPayload = createSigningPayload(result.receiptV2, chainId, hubAddress);

    expect(signingPayload.message.intentHash).toBe(result.receiptV2.intentHash);
    expect(signingPayload.message.solverId).toBe(result.receiptV2.solverId);
    expect(signingPayload.message.privacyLevel).toBe(result.receiptV2.privacyLevel);
  });
});

describe('Receipt V2 with Config', () => {
  const samplePayload: X402ReceiptPayload = {
    version: X402_PAYLOAD_VERSION,
    service: {
      serviceId: 'test-service',
      endpoint: 'POST /api',
      domain: 'example.com',
    },
    payment: {
      paymentRef: '0x123',
      asset: 'ETH',
      amount: '1000',
      chainId: 11155111,
    },
    request: {
      requestId: 'req-1',
      requestFingerprint: '0xfp',
    },
    response: {
      resultPointer: 'QmTest',
      resultDigest: '0x' + 'dd'.repeat(32),
    },
    timing: {
      issuedAt: 1700000000,
      expiry: 1700003600,
      nonce: '0xnonce',
    },
  };

  it('should build receipt with correct chain config in signing payloads', () => {
    const chainId = 137; // Polygon
    const hubAddress = '0x' + 'cc'.repeat(20);

    const result = buildReceiptV2WithConfig(
      {
        payload: samplePayload,
        ciphertextPointer: 'QmTest',
        solverId: '0x' + '11'.repeat(32),
      },
      chainId,
      hubAddress
    );

    expect(result.signingPayloads.solver.domain.chainId).toBe(chainId);
    expect(result.signingPayloads.solver.domain.verifyingContract).toBe(hubAddress);
    expect(result.signingPayloads.client.domain.chainId).toBe(chainId);
    expect(result.signingPayloads.client.domain.verifyingContract).toBe(hubAddress);
  });
});

describe('Receipt Validation', () => {
  const validReceipt = {
    intentHash: '0x' + '11'.repeat(32),
    constraintsHash: '0x' + '22'.repeat(32),
    routeHash: '0x' + '33'.repeat(32),
    outcomeHash: '0x' + '44'.repeat(32),
    evidenceHash: '0x' + '55'.repeat(32),
    metadataCommitment: '0x' + '66'.repeat(32),
    ciphertextPointer: 'ipfs://QmTest',
    privacyLevel: PrivacyLevel.SemiPublic,
    escrowId: ZeroHash,
    createdAt: BigInt(1700000000),
    expiry: BigInt(1700003600),
    solverId: '0x' + '77'.repeat(32),
    solverSig: '0x',
    clientSig: '0x',
  };

  it('should validate valid receipt', () => {
    expect(validateReceiptV2(validReceipt)).toBe(true);
  });

  it('should reject receipt with zero intentHash', () => {
    const invalid = { ...validReceipt, intentHash: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with zero constraintsHash', () => {
    const invalid = { ...validReceipt, constraintsHash: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with zero routeHash', () => {
    const invalid = { ...validReceipt, routeHash: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with zero outcomeHash', () => {
    const invalid = { ...validReceipt, outcomeHash: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with zero evidenceHash', () => {
    const invalid = { ...validReceipt, evidenceHash: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with zero metadataCommitment', () => {
    const invalid = { ...validReceipt, metadataCommitment: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with zero solverId', () => {
    const invalid = { ...validReceipt, solverId: ZeroHash };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with invalid timing (expiry <= createdAt)', () => {
    const invalid = { ...validReceipt, expiry: validReceipt.createdAt };
    expect(validateReceiptV2(invalid)).toBe(false);
  });

  it('should reject receipt with empty ciphertextPointer', () => {
    const invalid = { ...validReceipt, ciphertextPointer: '' };
    expect(validateReceiptV2(invalid)).toBe(false);
  });
});

describe('Receipt ID Computation', () => {
  const receipt = {
    intentHash: '0x' + '11'.repeat(32),
    constraintsHash: '0x' + '22'.repeat(32),
    routeHash: '0x' + '33'.repeat(32),
    outcomeHash: '0x' + '44'.repeat(32),
    evidenceHash: '0x' + '55'.repeat(32),
    metadataCommitment: '0x' + '66'.repeat(32),
    ciphertextPointer: 'ipfs://QmTest',
    privacyLevel: PrivacyLevel.SemiPublic,
    escrowId: ZeroHash,
    createdAt: BigInt(1700000000),
    expiry: BigInt(1700003600),
    solverId: '0x' + '77'.repeat(32),
    solverSig: '0x',
    clientSig: '0x',
  };

  it('should compute deterministic receipt ID', () => {
    const id1 = computeReceiptV2Id(receipt);
    const id2 = computeReceiptV2Id(receipt);

    expect(id1).toBe(id2);
  });

  it('should produce bytes32 hash', () => {
    const id = computeReceiptV2Id(receipt);

    expect(id).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should produce different ID for different receipt', () => {
    const modified = { ...receipt, intentHash: '0x' + 'aa'.repeat(32) };

    const id1 = computeReceiptV2Id(receipt);
    const id2 = computeReceiptV2Id(modified);

    expect(id1).not.toBe(id2);
  });
});
