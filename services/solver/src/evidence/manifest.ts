/**
 * Evidence manifest schema and types.
 *
 * Defines the structure of evidence bundles produced by job execution.
 */

import { z } from "zod";

/**
 * Manifest version for schema tracking.
 */
export const MANIFEST_VERSION = "0.1.0";

/**
 * Artifact entry in the manifest.
 */
export const ArtifactEntrySchema = z.object({
  /** Path relative to run directory */
  path: z.string(),
  /** SHA-256 hash of file contents (hex) */
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** File size in bytes */
  bytes: z.number().int().nonnegative(),
  /** MIME content type */
  contentType: z.string(),
});

export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

/**
 * Policy decision record.
 */
export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string()),
});

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

/**
 * Execution summary.
 */
export const ExecutionSummarySchema = z.object({
  status: z.enum(["SUCCESS", "FAILED", "REFUSED"]),
  error: z.string().optional(),
});

export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>;

/**
 * Solver metadata.
 */
export const SolverMetadataSchema = z.object({
  service: z.literal("irsb-solver"),
  serviceVersion: z.string(),
  gitCommit: z.string().optional(),
});

export type SolverMetadata = z.infer<typeof SolverMetadataSchema>;

/**
 * Evidence manifest v0.1.0 schema.
 */
export const EvidenceManifestV0Schema = z.object({
  manifestVersion: z.literal(MANIFEST_VERSION),
  intentId: z.string(),
  runId: z.string(),
  jobType: z.string(),
  /** ISO timestamp - excluded from hash computation */
  createdAt: z.string().datetime({ message: "Invalid ISO timestamp" }),
  /** Artifacts sorted by path */
  artifacts: z.array(ArtifactEntrySchema),
  policyDecision: PolicyDecisionSchema,
  executionSummary: ExecutionSummarySchema,
  solver: SolverMetadataSchema,
});

export type EvidenceManifestV0 = z.infer<typeof EvidenceManifestV0Schema>;

/**
 * Manifest without createdAt for hash computation.
 */
export type ManifestForHashing = Omit<EvidenceManifestV0, "createdAt">;

/**
 * Validates a manifest object.
 */
export function validateManifest(
  manifest: unknown
): z.SafeParseReturnType<unknown, EvidenceManifestV0> {
  return EvidenceManifestV0Schema.safeParse(manifest);
}
