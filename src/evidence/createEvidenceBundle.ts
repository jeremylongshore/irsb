/**
 * Evidence bundle creation.
 *
 * Creates evidence manifests from completed job runs.
 */

import { join } from "node:path";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalJson } from "../utils/canonicalJson.js";
import { getMimeType } from "../utils/mime.js";
import {
  ensureDir,
  atomicWrite,
  listFilesRecursive,
  getFileSize,
  safeJoin,
} from "../storage/fsSafe.js";
import {
  MANIFEST_VERSION,
  EvidenceManifestV0Schema,
  type EvidenceManifestV0,
  type ArtifactEntry,
  type PolicyDecision,
  type ExecutionSummary,
} from "./manifest.js";
import { computeManifestHash } from "./manifestHash.js";

/**
 * Service version from package.json.
 */
const SERVICE_VERSION = "0.1.0";

/**
 * Parameters for creating an evidence bundle.
 */
export interface CreateEvidenceBundleParams {
  runDir: string;
  intentId: string;
  runId: string;
  jobType: string;
  policyDecision: PolicyDecision;
  executionSummary: ExecutionSummary;
  gitCommit?: string;
}

/**
 * Result of evidence bundle creation.
 */
export interface EvidenceBundleResult {
  manifest: EvidenceManifestV0;
  manifestPath: string;
  manifestSha256: string;
}

/**
 * Computes SHA-256 hash of a file using streams for memory efficiency.
 */
async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

/**
 * Scans artifacts directory and builds artifact entries.
 */
async function scanArtifacts(runDir: string): Promise<ArtifactEntry[]> {
  const artifactsDir = join(runDir, "artifacts");

  if (!existsSync(artifactsDir)) {
    return [];
  }

  const files = listFilesRecursive(artifactsDir);
  const entries: ArtifactEntry[] = [];

  for (const file of files) {
    // Skip temp files
    if (file.startsWith(".tmp-")) {
      continue;
    }

    const fullPath = safeJoin(artifactsDir, file);
    if (fullPath === null) {
      continue;
    }

    // Path relative to run directory
    const relativePath = `artifacts/${file}`;

    entries.push({
      path: relativePath,
      sha256: await hashFile(fullPath),
      bytes: getFileSize(fullPath),
      contentType: getMimeType(file),
    });
  }

  // Sort by path for determinism
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Creates an evidence bundle for a completed run.
 */
export async function createEvidenceBundle(
  params: CreateEvidenceBundleParams
): Promise<EvidenceBundleResult> {
  const {
    runDir,
    intentId,
    runId,
    jobType,
    policyDecision,
    executionSummary,
    gitCommit,
  } = params;

  // Scan artifacts
  const artifacts = await scanArtifacts(runDir);

  // Build manifest
  const manifest: EvidenceManifestV0 = {
    manifestVersion: MANIFEST_VERSION,
    intentId,
    runId,
    jobType,
    createdAt: new Date().toISOString(),
    artifacts,
    policyDecision,
    executionSummary,
    solver: {
      service: "irsb-solver",
      serviceVersion: SERVICE_VERSION,
      gitCommit,
    },
  };

  // Compute hash (excludes createdAt)
  const manifestSha256 = computeManifestHash(manifest);

  // Write manifest atomically
  const evidenceDir = join(runDir, "evidence");
  ensureDir(evidenceDir);

  const manifestPath = join(evidenceDir, "manifest.json");
  atomicWrite(manifestPath, canonicalJson(manifest) + "\n");

  // Write hash file
  const hashPath = join(evidenceDir, "manifest.sha256");
  atomicWrite(hashPath, manifestSha256 + "\n");

  return {
    manifest,
    manifestPath,
    manifestSha256,
  };
}

/**
 * Reads an existing manifest from disk with schema validation.
 */
export function readManifest(manifestPath: string): EvidenceManifestV0 {
  const content = readFileSync(manifestPath, "utf8");
  return EvidenceManifestV0Schema.parse(JSON.parse(content));
}
