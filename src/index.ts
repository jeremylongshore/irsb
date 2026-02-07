/**
 * IRSB Agent Passkey - Policy-Gated Signing Gateway
 *
 * Identity plane for IRSB Protocol agents (solvers, watchtowers).
 * Non-extractable KMS-backed keys with typed action enforcement.
 *
 * @packageDocumentation
 */

// Types
export type {
  IrsbAction,
  SubmitReceiptAction,
  OpenDisputeAction,
  SubmitEvidenceAction,
  DisputeReason,
} from './types/actions.js';

export type { SigningRequest, SigningResponse, SigningError } from './types/signing-request.js';

export type { AuditArtifact, PolicyDecision } from './types/audit-artifact.js';

// Policy
export { PolicyEngine, type PolicyConfig, type PolicyCheckResult } from './policy/engine.js';

// Signing
export { KmsSigner } from './signing/kms-signer.js';
export { derToRsv, normalizeS } from './signing/der-to-rsv.js';
export { TxBuilder } from './signing/tx-builder.js';

// Sessions
export {
  CapabilityIssuer,
  CapabilityValidator,
  type SessionCapability,
} from './sessions/capability.js';

// Audit
export { createAuditArtifact, hashArtifact } from './audit/artifact.js';
export { canonicalize } from './audit/hasher.js';

// ERC-8004
export { ERC8004Adapter, type ValidationSignal, type ReputationUpdate } from './erc8004/adapter.js';
