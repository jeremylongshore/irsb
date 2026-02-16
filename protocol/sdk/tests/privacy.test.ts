/**
 * Privacy Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  generateNonce,
  generateMetadataCommitment,
  verifyCommitment,
  verifyCommitmentRaw,
  validatePointer,
  formatCiphertextPointer,
  combineHashes,
  computeRequestFingerprint,
  computeTermsHash,
  METADATA_SCHEMA_VERSION,
} from '../src/privacy';
import { ethers } from 'ethers';

describe('Privacy Module', () => {
  describe('canonicalize', () => {
    it('should sort keys alphabetically', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const result = canonicalize(obj);
      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });

    it('should handle nested objects', () => {
      const obj = { b: { z: 1, a: 2 }, a: 1 };
      const result = canonicalize(obj);
      expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
    });

    it('should preserve arrays', () => {
      const obj = { arr: [3, 1, 2], name: 'test' };
      const result = canonicalize(obj);
      expect(result).toBe('{"arr":[3,1,2],"name":"test"}');
    });

    it('should be deterministic', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(canonicalize(obj1)).toBe(canonicalize(obj2));
    });
  });

  describe('generateNonce', () => {
    it('should generate 32-byte hex string', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^0x[a-f0-9]{64}$/i);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(100);
    });
  });

  describe('generateMetadataCommitment', () => {
    it('should generate valid commitment', () => {
      const result = generateMetadataCommitment({
        orderId: 'order-123',
        amount: '1000000000000000000',
      });

      expect(result.commitment).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(result.originalPayload.version).toBe(METADATA_SCHEMA_VERSION);
      expect(result.originalPayload.data.orderId).toBe('order-123');
    });

    it('should use provided nonce and timestamp', () => {
      const nonce = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const timestamp = 1700000000;

      const result = generateMetadataCommitment({ test: true }, nonce, timestamp);

      expect(result.originalPayload.nonce).toBe(nonce);
      expect(result.originalPayload.timestamp).toBe(timestamp);
    });

    it('should be deterministic with same inputs', () => {
      const nonce = '0x' + '0'.repeat(64);
      const timestamp = 1700000000;
      const data = { key: 'value' };

      const result1 = generateMetadataCommitment(data, nonce, timestamp);
      const result2 = generateMetadataCommitment(data, nonce, timestamp);

      expect(result1.commitment).toBe(result2.commitment);
      expect(result1.canonicalPayload).toBe(result2.canonicalPayload);
    });

    it('should produce different commitments for different data', () => {
      const nonce = '0x' + '0'.repeat(64);
      const timestamp = 1700000000;

      const result1 = generateMetadataCommitment({ key: 'value1' }, nonce, timestamp);
      const result2 = generateMetadataCommitment({ key: 'value2' }, nonce, timestamp);

      expect(result1.commitment).not.toBe(result2.commitment);
    });
  });

  describe('verifyCommitment', () => {
    it('should verify valid commitment', () => {
      const result = generateMetadataCommitment({ test: 'data' });
      const isValid = verifyCommitment(result.commitment, result.originalPayload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid commitment', () => {
      const result = generateMetadataCommitment({ test: 'data' });
      const fakeCommitment = '0x' + '1'.repeat(64);
      const isValid = verifyCommitment(fakeCommitment, result.originalPayload);
      expect(isValid).toBe(false);
    });

    it('should reject modified payload', () => {
      const result = generateMetadataCommitment({ test: 'data' });
      const modifiedPayload = {
        ...result.originalPayload,
        data: { test: 'modified' },
      };
      const isValid = verifyCommitment(result.commitment, modifiedPayload);
      expect(isValid).toBe(false);
    });
  });

  describe('verifyCommitmentRaw', () => {
    it('should verify using raw canonical JSON', () => {
      const result = generateMetadataCommitment({ test: 'data' });
      const isValid = verifyCommitmentRaw(result.commitment, result.canonicalPayload);
      expect(isValid).toBe(true);
    });
  });

  describe('validatePointer', () => {
    it('should accept valid CID', () => {
      const result = validatePointer('QmYwAPJzv5CZsnAzt8auVZRn');
      expect(result.isValid).toBe(true);
      expect(result.normalizedPointer).toBe('QmYwAPJzv5CZsnAzt8auVZRn');
    });

    it('should accept base32 CID', () => {
      const result = validatePointer('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validatePointer('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject too long pointer', () => {
      const result = validatePointer('a'.repeat(65));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    it('should reject special characters', () => {
      const result = validatePointer('ipfs://QmTest');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('alphanumeric');
    });

    it('should trim whitespace', () => {
      const result = validatePointer('  QmTest123  ');
      expect(result.isValid).toBe(true);
      expect(result.normalizedPointer).toBe('QmTest123');
    });
  });

  describe('formatCiphertextPointer', () => {
    it('should extract CID from ipfs:// URL', () => {
      const result = formatCiphertextPointer('ipfs://QmTest123456789012345678901234');
      expect(result).toBe('QmTest123456789012345678901234');
    });

    it('should extract CID from gateway URL', () => {
      const result = formatCiphertextPointer('https://ipfs.io/ipfs/QmTest123456789012345678');
      expect(result).toBe('QmTest123456789012345678');
    });

    it('should pass through raw CID', () => {
      const result = formatCiphertextPointer('QmTest12345678901234567890');
      expect(result).toBe('QmTest12345678901234567890');
    });

    it('should remove trailing path', () => {
      const result = formatCiphertextPointer('QmTest1234567890123456789012/file.json');
      expect(result).toBe('QmTest1234567890123456789012');
    });

    it('should throw on invalid CID', () => {
      expect(() => formatCiphertextPointer('')).toThrow();
    });
  });

  describe('combineHashes', () => {
    it('should combine multiple hashes', () => {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes('test1'));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('test2'));
      const combined = combineHashes(hash1, hash2);
      expect(combined).toMatch(/^0x[a-f0-9]{64}$/i);
    });

    it('should be deterministic', () => {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes('test1'));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('test2'));
      expect(combineHashes(hash1, hash2)).toBe(combineHashes(hash1, hash2));
    });

    it('should be order-dependent', () => {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes('test1'));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('test2'));
      expect(combineHashes(hash1, hash2)).not.toBe(combineHashes(hash2, hash1));
    });
  });

  describe('computeRequestFingerprint', () => {
    it('should compute fingerprint for request', () => {
      const fingerprint = computeRequestFingerprint('POST', '/api/v1/orders', '');
      expect(fingerprint).toMatch(/^0x[a-f0-9]{64}$/i);
    });

    it('should be case-insensitive for method', () => {
      const fp1 = computeRequestFingerprint('POST', '/api/test', '');
      const fp2 = computeRequestFingerprint('post', '/api/test', '');
      expect(fp1).toBe(fp2);
    });

    it('should be case-sensitive for path', () => {
      const fp1 = computeRequestFingerprint('GET', '/API/Test', '');
      const fp2 = computeRequestFingerprint('GET', '/api/test', '');
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('computeTermsHash', () => {
    it('should compute terms hash', () => {
      const hash = computeTermsHash('ETH', '1000000000000000000', 1, 1700000000);
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/i);
    });

    it('should be deterministic', () => {
      const hash1 = computeTermsHash('USDC', '1000000', 1, 1700000000);
      const hash2 = computeTermsHash('USDC', '1000000', 1, 1700000000);
      expect(hash1).toBe(hash2);
    });

    it('should differ for different amounts', () => {
      const hash1 = computeTermsHash('ETH', '1000000000000000000', 1, 1700000000);
      const hash2 = computeTermsHash('ETH', '2000000000000000000', 1, 1700000000);
      expect(hash1).not.toBe(hash2);
    });
  });
});
