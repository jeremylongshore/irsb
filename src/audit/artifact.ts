/**
 * Audit Artifact Creation
 *
 * Creates deterministic audit artifacts for signing decisions.
 */

import { randomUUID } from 'crypto';
import type { AuditArtifact, PolicyCheck, PolicyDecision } from '../types/audit-artifact.js';
import type { SigningRequest } from '../types/signing-request.js';
import { hashCanonical, hashProperties } from './hasher.js';

/**
 * Options for creating an audit artifact
 */
export interface CreateAuditArtifactOptions {
  request: SigningRequest;
  policyVersion: string;
  checks: PolicyCheck[];
  decision: PolicyDecision;
  signature?: string;
  txHash?: string;
}

/**
 * Create a complete audit artifact from a signing decision
 */
export function createAuditArtifact(options: CreateAuditArtifactOptions): AuditArtifact {
  const { request, policyVersion, checks, decision, signature, txHash } = options;

  const auditId = randomUUID();
  const timestamp = Date.now();

  // Compute signing request hash
  const signingRequestHash = hashCanonical(request);

  // Compute policy decision hash
  const policyDecisionHash = hashCanonical({
    policyVersion,
    checks: checks.map((c) => ({ name: c.name, passed: c.passed })),
    decision,
  });

  // Compute signature hash if present
  const signatureHash = signature ? hashCanonical({ signature }) : undefined;

  // Collect deny reasons
  const denyReasons =
    decision === 'DENY'
      ? checks.filter((c) => !c.passed).map((c) => c.reason ?? `${c.name} failed`)
      : undefined;

  return {
    auditId,
    signingRequestHash,
    policyVersion,
    policyDecisionHash,
    decision,
    checks,
    denyReasons,
    signatureHash,
    txHash,
    timestamp,
    agentId: request.agentId,
    requestId: request.requestId,
  };
}

/**
 * Compute the hash of an audit artifact for evidence bundles
 */
export function hashArtifact(artifact: AuditArtifact): string {
  return hashProperties(artifact, [
    'auditId',
    'signingRequestHash',
    'policyDecisionHash',
    'decision',
    'signatureHash',
    'txHash',
    'timestamp',
  ]);
}

/**
 * Verify an audit artifact's internal consistency
 */
export function verifyArtifact(artifact: AuditArtifact, originalRequest?: SigningRequest): boolean {
  // Verify signing request hash if we have the original
  if (originalRequest) {
    const expectedHash = hashCanonical(originalRequest);
    if (artifact.signingRequestHash !== expectedHash) {
      return false;
    }
  }

  // Verify policy decision hash
  const expectedPolicyHash = hashCanonical({
    policyVersion: artifact.policyVersion,
    checks: artifact.checks.map((c) => ({ name: c.name, passed: c.passed })),
    decision: artifact.decision,
  });

  if (artifact.policyDecisionHash !== expectedPolicyHash) {
    return false;
  }

  // Verify decision consistency
  if (artifact.decision === 'DENY' && artifact.signatureHash) {
    return false; // Should not have signature if denied
  }

  if (artifact.decision === 'ALLOW' && !artifact.signatureHash) {
    return false; // Should have signature if allowed
  }

  return true;
}
