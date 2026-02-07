/**
 * IRSB Agent Passkey - Policy-Gated Signing Gateway
 *
 * Identity plane for IRSB Protocol agents (solvers, watchtowers).
 * Threshold signatures via Lit Protocol - no single point of key compromise.
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
export type { Signer, EthSignature } from './signing/signer.js';
export { LitSigner, type LitSignerConfig, type LitNetwork } from './signing/lit-signer.js';
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

// Service
export {
  SigningService,
  createServiceFromEnv,
  type ServiceConfig,
  type SigningOutcome,
} from './server/service.js';
