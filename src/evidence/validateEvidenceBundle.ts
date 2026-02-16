/**
 * Evidence bundle validation.
 *
 * Validates manifest schema, artifact integrity, and path safety.
 */

import { join, sep } from "node:path";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  EvidenceManifestV0Schema,
  type EvidenceManifestV0,
} from "./manifest.js";
import { validateRelativePath, safeJoin, getFileSize } from "../storage/fsSafe.js";

/**
 * Validation error with details.
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  manifest?: EvidenceManifestV0;
}

/**
 * Computes SHA-256 hash of a file using streams for memory efficiency.
 */
async function hashFileStream(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

/**
 * Validates an evidence bundle.
 *
 * Checks:
 * 1. Manifest schema validity
 * 2. Path safety (no traversal, no absolute paths)
 * 3. Artifact existence
 * 4. Artifact hash integrity
 * 5. Artifact size match
 */
export async function validateEvidenceBundle(runDir: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Check manifest exists
  const manifestPath = join(runDir, "evidence", "manifest.json");
  if (!existsSync(manifestPath)) {
    return {
      valid: false,
      errors: [{ code: "MANIFEST_NOT_FOUND", message: "Manifest file not found" }],
    };
  }

  // Parse manifest
  let manifest: unknown;
  try {
    const content = readFileSync(manifestPath, "utf8");
    manifest = JSON.parse(content) as unknown;
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          code: "MANIFEST_PARSE_ERROR",
          message: `Failed to parse manifest: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }

  // Validate schema
  const schemaResult = EvidenceManifestV0Schema.safeParse(manifest);
  if (!schemaResult.success) {
    const zodErrors = schemaResult.error.errors.map((e) => ({
      code: "SCHEMA_VALIDATION_ERROR",
      message: `${e.path.join(".")}: ${e.message}`,
    }));
    return {
      valid: false,
      errors: zodErrors,
    };
  }

  const validManifest = schemaResult.data;

  // Validate each artifact
  for (const artifact of validManifest.artifacts) {
    // Check path safety
    const pathValidation = validateRelativePath(artifact.path);
    if (!pathValidation.valid) {
      errors.push({
        code: "UNSAFE_PATH",
        message: pathValidation.reason ?? "Invalid path",
        path: artifact.path,
      });
      continue;
    }

    // Resolve full path safely
    const fullPath = safeJoin(runDir, artifact.path);
    if (fullPath === null) {
      errors.push({
        code: "PATH_ESCAPE",
        message: "Path escapes run directory",
        path: artifact.path,
      });
      continue;
    }

    // Check file exists
    if (!existsSync(fullPath)) {
      errors.push({
        code: "ARTIFACT_NOT_FOUND",
        message: "Artifact file not found",
        path: artifact.path,
      });
      continue;
    }

    // Check file size
    const actualSize = getFileSize(fullPath);
    if (actualSize !== artifact.bytes) {
      errors.push({
        code: "SIZE_MISMATCH",
        message: `Size mismatch: expected ${String(artifact.bytes)}, got ${String(actualSize)}`,
        path: artifact.path,
      });
    }

    // Check hash using streaming for memory efficiency
    const actualHash = await hashFileStream(fullPath);
    if (actualHash !== artifact.sha256) {
      errors.push({
        code: "HASH_MISMATCH",
        message: `Hash mismatch: expected ${artifact.sha256.substring(0, 16)}..., got ${actualHash.substring(0, 16)}...`,
        path: artifact.path,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: validManifest,
  };
}

/**
 * Validates manifest from a file path.
 */
export async function validateManifestFile(manifestPath: string): Promise<ValidationResult> {
  // Determine run directory from manifest path
  // Expected: runDir/evidence/manifest.json
  const parts = manifestPath.split(sep);
  const evidenceIdx = parts.lastIndexOf("evidence");
  if (evidenceIdx === -1 || evidenceIdx === 0) {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_MANIFEST_PATH",
          message: "Cannot determine run directory from manifest path",
        },
      ],
    };
  }

  const runDir = parts.slice(0, evidenceIdx).join(sep);
  return validateEvidenceBundle(runDir);
}
