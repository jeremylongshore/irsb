import { canonicalJson, sha256Hex } from '../utils/canonical.js';
import { signData, verifyData } from '../signing/sign.js';
import type { WatchtowerKeyPair } from '../signing/keys.js';

export interface TransparencyLeaf {
  leafVersion: '0.1.0';
  leafId: string;
  writtenAt: number;
  agentId: string;
  riskReportHash: string;
  overallRisk: number;
  receiptId?: string;
  manifestSha256?: string;
  cardHash?: string;
  watchtowerSig: string;
}

export interface LeafInput {
  agentId: string;
  riskReportHash: string;
  overallRisk: number;
  receiptId?: string;
  manifestSha256?: string;
  cardHash?: string;
}

/**
 * Create a transparency leaf with deterministic ID and signature.
 * leafId = sha256(canonicalJson(leaf fields excluding writtenAt and watchtowerSig)).
 */
export function createLeaf(input: LeafInput, kp: WatchtowerKeyPair): TransparencyLeaf {
  const leafPayload = {
    leafVersion: '0.1.0' as const,
    agentId: input.agentId,
    riskReportHash: input.riskReportHash,
    overallRisk: input.overallRisk,
    ...(input.receiptId !== undefined ? { receiptId: input.receiptId } : {}),
    ...(input.manifestSha256 !== undefined ? { manifestSha256: input.manifestSha256 } : {}),
    ...(input.cardHash !== undefined ? { cardHash: input.cardHash } : {}),
  };

  const leafId = sha256Hex(canonicalJson(leafPayload));
  const watchtowerSig = signData(leafId, kp);
  const writtenAt = Math.floor(Date.now() / 1000);

  return {
    leafVersion: '0.1.0',
    leafId,
    writtenAt,
    agentId: input.agentId,
    riskReportHash: input.riskReportHash,
    overallRisk: input.overallRisk,
    ...(input.receiptId !== undefined ? { receiptId: input.receiptId } : {}),
    ...(input.manifestSha256 !== undefined ? { manifestSha256: input.manifestSha256 } : {}),
    ...(input.cardHash !== undefined ? { cardHash: input.cardHash } : {}),
    watchtowerSig,
  };
}

/**
 * Verify a leaf's integrity:
 * 1. Recompute leafId from content (excluding writtenAt + watchtowerSig)
 * 2. Verify watchtowerSig over leafId with the given publicKey
 */
export function verifyLeaf(leaf: TransparencyLeaf, publicKey: string): { valid: boolean; error?: string } {
  // Recompute leafId
  const leafPayload: Record<string, unknown> = {
    leafVersion: leaf.leafVersion,
    agentId: leaf.agentId,
    riskReportHash: leaf.riskReportHash,
    overallRisk: leaf.overallRisk,
  };
  if (leaf.receiptId !== undefined) leafPayload['receiptId'] = leaf.receiptId;
  if (leaf.manifestSha256 !== undefined) leafPayload['manifestSha256'] = leaf.manifestSha256;
  if (leaf.cardHash !== undefined) leafPayload['cardHash'] = leaf.cardHash;

  const expectedLeafId = sha256Hex(canonicalJson(leafPayload));
  if (expectedLeafId !== leaf.leafId) {
    return { valid: false, error: `leafId mismatch: expected ${expectedLeafId}, got ${leaf.leafId}` };
  }

  // Verify signature
  const sigValid = verifyData(leaf.leafId, leaf.watchtowerSig, publicKey);
  if (!sigValid) {
    return { valid: false, error: 'signature verification failed' };
  }

  return { valid: true };
}
