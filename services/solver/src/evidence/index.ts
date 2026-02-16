/**
 * Evidence module exports.
 */

export {
  MANIFEST_VERSION,
  EvidenceManifestV0Schema,
  ArtifactEntrySchema,
  PolicyDecisionSchema,
  ExecutionSummarySchema,
  SolverMetadataSchema,
  validateManifest,
  type EvidenceManifestV0,
  type ArtifactEntry,
  type PolicyDecision,
  type ExecutionSummary,
  type SolverMetadata,
  type ManifestForHashing,
} from "./manifest.js";

export {
  computeManifestHash,
  computeContentHash,
  getManifestForHashing,
} from "./manifestHash.js";

export {
  createEvidenceBundle,
  readManifest,
  type CreateEvidenceBundleParams,
  type EvidenceBundleResult,
} from "./createEvidenceBundle.js";

export {
  validateEvidenceBundle,
  validateManifestFile,
  type ValidationError,
  type ValidationResult,
} from "./validateEvidenceBundle.js";
