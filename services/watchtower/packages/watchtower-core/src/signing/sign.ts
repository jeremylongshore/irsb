import { sign, verify } from 'node:crypto';
import type { WatchtowerKeyPair } from './keys.js';
import { getPrivateKeyObject, getPublicKeyObject } from './keys.js';
import { canonicalJson } from '../utils/canonical.js';

export interface ReportSignature {
  algo: 'ed25519';
  publicKey: string;
  signature: string;
  signedAt: number;
}

/**
 * Sign a risk report hash with the watchtower Ed25519 key.
 * The signed payload is: canonicalJson({agentId, generatedAt, reportVersion, riskReportHash}).
 */
export function signReport(
  report: { agentId: string; generatedAt: number; reportVersion: string; reportId: string },
  kp: WatchtowerKeyPair,
): ReportSignature {
  const riskReportHash = report.reportId;
  const payload = canonicalJson({
    agentId: report.agentId,
    generatedAt: report.generatedAt,
    reportVersion: report.reportVersion,
    riskReportHash,
  });

  const privKey = getPrivateKeyObject(kp);
  const sig = sign(null, Buffer.from(payload, 'utf-8'), privKey);

  return {
    algo: 'ed25519',
    publicKey: kp.publicKey,
    signature: sig.toString('base64'),
    signedAt: Math.floor(Date.now() / 1000),
  };
}

/**
 * Verify a report signature.
 * Returns true if the signature is valid for the given report fields + publicKey.
 */
export function verifyReportSignature(
  report: { agentId: string; generatedAt: number; reportVersion: string; reportId: string },
  sig: ReportSignature,
): boolean {
  const riskReportHash = report.reportId;
  const payload = canonicalJson({
    agentId: report.agentId,
    generatedAt: report.generatedAt,
    reportVersion: report.reportVersion,
    riskReportHash,
  });

  // Reconstruct public key from the signature's publicKey field
  const kp: WatchtowerKeyPair = { publicKey: sig.publicKey, privateKey: '' };
  const pubKey = getPublicKeyObject(kp);

  return verify(null, Buffer.from(payload, 'utf-8'), pubKey, Buffer.from(sig.signature, 'base64'));
}

/**
 * Sign arbitrary data (used for transparency leaves).
 */
export function signData(data: string, kp: WatchtowerKeyPair): string {
  const privKey = getPrivateKeyObject(kp);
  return sign(null, Buffer.from(data, 'utf-8'), privKey).toString('base64');
}

/**
 * Verify arbitrary data signature.
 */
export function verifyData(data: string, signature: string, publicKeyBase64: string): boolean {
  const kp: WatchtowerKeyPair = { publicKey: publicKeyBase64, privateKey: '' };
  const pubKey = getPublicKeyObject(kp);
  return verify(null, Buffer.from(data, 'utf-8'), pubKey, Buffer.from(signature, 'base64'));
}
