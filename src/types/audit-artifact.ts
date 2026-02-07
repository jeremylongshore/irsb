/**
 * Audit Artifact Schema
 *
 * Deterministic audit records for every signing decision.
 * These artifacts are included in evidence bundles and
 * referenced in dispute submissions.
 */

import { z } from 'zod';

/**
 * Policy decision outcome
 */
export const PolicyDecisionSchema = z.enum(['ALLOW', 'DENY']);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

/**
 * Individual policy check result
 */
export const PolicyCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PolicyCheck = z.infer<typeof PolicyCheckSchema>;

/**
 * Complete audit artifact for a signing request
 */
export const AuditArtifactSchema = z.object({
  /**
   * Unique audit ID for log correlation
   */
  auditId: z.string().uuid(),

  /**
   * Hash of the canonicalized signing request
   */
  signingRequestHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),

  /**
   * Policy version used for evaluation
   */
  policyVersion: z.string(),

  /**
   * Hash of the canonicalized policy decision
   */
  policyDecisionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),

  /**
   * Overall decision
   */
  decision: PolicyDecisionSchema,

  /**
   * Individual policy check results
   */
  checks: z.array(PolicyCheckSchema),

  /**
   * Reasons for denial (if decision is DENY)
   */
  denyReasons: z.array(z.string()).optional(),

  /**
   * Hash of the signature (if allowed)
   */
  signatureHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),

  /**
   * Transaction hash (if submitted)
   */
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),

  /**
   * Timestamp (unix ms)
   */
  timestamp: z.number().int().positive(),

  /**
   * Agent ID from the request
   */
  agentId: z.string(),

  /**
   * Request ID for correlation
   */
  requestId: z.string().uuid(),
});

export type AuditArtifact = z.infer<typeof AuditArtifactSchema>;

/**
 * Minimal artifact for storage/transmission
 */
export const AuditArtifactMinimalSchema = z.object({
  auditId: z.string().uuid(),
  signingRequestHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  policyDecisionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  decision: PolicyDecisionSchema,
  signatureHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  timestamp: z.number().int().positive(),
});

export type AuditArtifactMinimal = z.infer<typeof AuditArtifactMinimalSchema>;

/**
 * Parse and validate an audit artifact
 */
export function parseAuditArtifact(value: unknown): AuditArtifact {
  return AuditArtifactSchema.parse(value);
}

/**
 * Extract minimal artifact for evidence bundles
 */
export function toMinimalArtifact(artifact: AuditArtifact): AuditArtifactMinimal {
  return {
    auditId: artifact.auditId,
    signingRequestHash: artifact.signingRequestHash,
    policyDecisionHash: artifact.policyDecisionHash,
    decision: artifact.decision,
    signatureHash: artifact.signatureHash,
    txHash: artifact.txHash,
    timestamp: artifact.timestamp,
  };
}
