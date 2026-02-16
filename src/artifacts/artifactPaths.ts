/**
 * Artifact path computation.
 *
 * Computes deterministic paths for run artifacts.
 */

import { join } from "node:path";

/**
 * Standard artifact names for SAFE_REPORT.
 */
export const SAFE_REPORT_ARTIFACTS = {
  JSON: "report.json",
  MARKDOWN: "report.md",
} as const;

/**
 * Computes the artifacts directory for a run.
 */
export function getArtifactsDir(dataDir: string, runId: string): string {
  return join(dataDir, "runs", runId, "artifacts");
}

/**
 * Computes the full path for an artifact.
 */
export function getArtifactPath(
  artifactsDir: string,
  filename: string
): string {
  return join(artifactsDir, filename);
}

/**
 * Gets all expected artifact paths for SAFE_REPORT.
 */
export function getSafeReportArtifactPaths(artifactsDir: string): {
  jsonPath: string;
  mdPath: string;
} {
  return {
    jsonPath: getArtifactPath(artifactsDir, SAFE_REPORT_ARTIFACTS.JSON),
    mdPath: getArtifactPath(artifactsDir, SAFE_REPORT_ARTIFACTS.MARKDOWN),
  };
}
