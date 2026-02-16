import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../utils/canonical.js';

// ── Zod schemas matching irsb-solver EvidenceManifestV0 ─────────────────

export const ArtifactEntrySchema = z.object({
  path: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  contentType: z.string(),
});

export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string()),
});

export const ExecutionSummarySchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED', 'REFUSED']),
  error: z.string().optional(),
});

export const SolverMetadataSchema = z.object({
  service: z.literal('irsb-solver'),
  serviceVersion: z.string(),
  gitCommit: z.string().optional(),
});

export const SolverReceiptV0Schema = z.object({
  manifestVersion: z.literal('0.1.0'),
  intentId: z.string(),
  runId: z.string(),
  jobType: z.string(),
  createdAt: z.string().datetime(),
  artifacts: z.array(ArtifactEntrySchema),
  policyDecision: PolicyDecisionSchema,
  executionSummary: ExecutionSummarySchema,
  solver: SolverMetadataSchema,
});

export type SolverReceiptV0 = z.infer<typeof SolverReceiptV0Schema>;

// ── Normalized receipt ──────────────────────────────────────────────────

export interface DeliveredArtifact {
  path: string;
  sha256: string;
  bytes: number;
  contentType: string;
}

export interface NormalizedReceipt {
  receiptId: string;
  receiptVersion: string;
  intentId: string;
  runId: string;
  jobType: string;
  status: 'SUCCESS' | 'FAILED' | 'REFUSED';
  manifestPath: string;
  manifestSha256: string;
  delivered: DeliveredArtifact[];
}

/**
 * Normalize an irsb-solver evidence manifest into a flat watchtower receipt.
 *
 * @param manifest - Validated manifest object
 * @param manifestSha256 - SHA-256 of the raw manifest file bytes (computed by caller)
 */
export function normalizeReceipt(
  manifest: SolverReceiptV0,
  manifestSha256: string,
): NormalizedReceipt {
  const delivered: DeliveredArtifact[] = [...manifest.artifacts]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((a) => ({
      path: a.path,
      sha256: a.sha256,
      bytes: a.bytes,
      contentType: a.contentType,
    }));

  const receiptId = sha256Hex(
    canonicalJson({
      intentId: manifest.intentId,
      runId: manifest.runId,
      jobType: manifest.jobType,
      manifestSha256,
    }),
  );

  return {
    receiptId,
    receiptVersion: manifest.manifestVersion,
    intentId: manifest.intentId,
    runId: manifest.runId,
    jobType: manifest.jobType,
    status: manifest.executionSummary.status,
    manifestPath: 'evidence/manifest.json',
    manifestSha256,
    delivered,
  };
}
