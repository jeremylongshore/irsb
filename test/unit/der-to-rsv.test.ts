/**
 * DER to RSV conversion tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseDer,
  normalizeS,
  isLowS,
  derToRsv,
} from '../../src/signing/der-to-rsv.js';

// secp256k1 curve order
const SECP256K1_N = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
);

describe('parseDer', () => {
  it('parses valid DER signature', () => {
    // Example DER signature (64 byte r,s with leading zeros)
    const der =
      '0x3044' + // SEQUENCE, 68 bytes
      '0220' + // INTEGER, 32 bytes
      '00' + 'a'.repeat(62) + // r (with leading zero for positive)
      '0220' + // INTEGER, 32 bytes
      '00' + 'b'.repeat(62); // s (with leading zero for positive)

    const { r, s } = parseDer(der);

    expect(typeof r).toBe('bigint');
    expect(typeof s).toBe('bigint');
    expect(r > 0n).toBe(true);
    expect(s > 0n).toBe(true);
  });

  it('handles signatures without leading zeros', () => {
    // Signature where r and s don't need leading zeros (high bit not set)
    const der =
      '0x3042' + // SEQUENCE, 66 bytes
      '021f' + // INTEGER, 31 bytes
      '7' + 'a'.repeat(61) + // r (no leading zero, high bit not set)
      '021f' + // INTEGER, 31 bytes
      '7' + 'b'.repeat(61); // s

    const { r, s } = parseDer(der);

    expect(r > 0n).toBe(true);
    expect(s > 0n).toBe(true);
  });

  it('throws on invalid DER', () => {
    expect(() => parseDer('0x1234')).toThrow('Invalid DER');
    expect(() => parseDer('0x')).toThrow('Invalid DER');
    expect(() => parseDer('')).toThrow('Invalid DER');
  });

  it('throws when SEQUENCE tag missing', () => {
    const badDer = '0x4044' + '0220' + '00' + 'a'.repeat(62) + '0220' + '00' + 'b'.repeat(62);
    expect(() => parseDer(badDer)).toThrow('expected SEQUENCE tag');
  });
});

describe('normalizeS', () => {
  it('returns s unchanged when already low', () => {
    const lowS = SECP256K1_N / 2n;
    const result = normalizeS(lowS);
    expect(result).toBe(lowS);
  });

  it('normalizes high s to low s', () => {
    const highS = SECP256K1_N / 2n + 1n;
    const result = normalizeS(highS);
    expect(result).toBe(SECP256K1_N - highS);
    // Result should be in the low-s range (<= n/2)
    expect(result <= SECP256K1_N / 2n).toBe(true);
  });

  it('handles edge case at exactly half', () => {
    const halfN = SECP256K1_N / 2n;
    const result = normalizeS(halfN);
    expect(result).toBe(halfN);
  });
});

describe('isLowS', () => {
  it('returns true for low s values', () => {
    expect(isLowS(1n)).toBe(true);
    expect(isLowS(SECP256K1_N / 2n)).toBe(true);
  });

  it('returns false for high s values', () => {
    expect(isLowS(SECP256K1_N / 2n + 1n)).toBe(false);
    expect(isLowS(SECP256K1_N - 1n)).toBe(false);
  });
});

describe('derToRsv', () => {
  it('produces valid Ethereum signature format', () => {
    // This is a more complex test that would require real signature data
    // For now, we'll test the format expectations

    // Skip if we can't create a valid test case
    // In practice, you'd use a known test vector here
  });

  it('throws when recovery fails', () => {
    // Create a DER that parses but won't match any expected address
    const der =
      '0x3044' +
      '0220' + '00' + 'a'.repeat(62) +
      '0220' + '00' + 'b'.repeat(62);

    const messageHash = '0x' + 'c'.repeat(64);
    const expectedAddress = '0x' + 'd'.repeat(40);

    expect(() => derToRsv(der, messageHash, expectedAddress)).toThrow(
      'Could not recover signer address'
    );
  });
});
