import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  signReport,
  verifyReportSignature,
  signData,
  verifyData,
} from '../src/signing/index.js';

describe('signing', () => {
  const kp = generateKeyPair();

  describe('generateKeyPair', () => {
    it('should produce base64 public and private keys', () => {
      expect(kp.publicKey).toBeTruthy();
      expect(kp.privateKey).toBeTruthy();
      // SPKI DER for Ed25519 is 44 bytes → 60 chars base64
      expect(Buffer.from(kp.publicKey, 'base64').length).toBe(44);
    });

    it('should produce unique keypairs', () => {
      const kp2 = generateKeyPair();
      expect(kp2.publicKey).not.toBe(kp.publicKey);
    });
  });

  describe('signData / verifyData', () => {
    it('should sign and verify arbitrary data', () => {
      const data = 'hello watchtower';
      const sig = signData(data, kp);
      expect(sig).toBeTruthy();
      expect(verifyData(data, sig, kp.publicKey)).toBe(true);
    });

    it('should reject tampered data', () => {
      const sig = signData('original', kp);
      expect(verifyData('tampered', sig, kp.publicKey)).toBe(false);
    });

    it('should reject wrong public key', () => {
      const sig = signData('data', kp);
      const otherKp = generateKeyPair();
      expect(verifyData('data', sig, otherKp.publicKey)).toBe(false);
    });
  });

  describe('signReport / verifyReportSignature', () => {
    const report = {
      agentId: 'agent-1',
      generatedAt: 1700000000,
      reportVersion: '0.1.0',
      reportId: 'abc123hash',
    };

    it('should sign and verify a report', () => {
      const sig = signReport(report, kp);
      expect(sig.algo).toBe('ed25519');
      expect(sig.publicKey).toBe(kp.publicKey);
      expect(sig.signature).toBeTruthy();
      expect(sig.signedAt).toBeGreaterThan(0);

      expect(verifyReportSignature(report, sig)).toBe(true);
    });

    it('should reject tampered report', () => {
      const sig = signReport(report, kp);
      const tampered = { ...report, overallRisk: 99, reportId: 'tampered' };
      expect(verifyReportSignature(tampered, sig)).toBe(false);
    });

    it('should reject wrong signer', () => {
      const sig = signReport(report, kp);
      const otherKp = generateKeyPair();
      const fakeSig = { ...sig, publicKey: otherKp.publicKey };
      expect(verifyReportSignature(report, fakeSig)).toBe(false);
    });
  });
});
