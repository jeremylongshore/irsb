/**
 * Manifest hash computation.
 *
 * Computes deterministic hash of evidence manifest.
 * The createdAt field is excluded from hashing to ensure reproducibility.
 */

import { createHash } from "node:crypto";
import { canonicalJson } from "../utils/canonicalJson.js";
import type { EvidenceManifestV0, ManifestForHashing } from "./manifest.js";

/**
 * Extracts the hashable portion of a manifest (excludes createdAt).
 */
export function getManifestForHashing(manifest: EvidenceManifestV0): ManifestForHashing {
  const { createdAt: _createdAt, ...hashable } = manifest;
  return hashable;
}

/**
 * Computes SHA-256 hash of a manifest.
 *
 * The createdAt field is excluded to ensure deterministic hashing.
 * The manifest is serialized using canonical JSON (sorted keys).
 */
export function computeManifestHash(manifest: EvidenceManifestV0): string {
  const hashable = getManifestForHashing(manifest);
  const canonical = canonicalJson(hashable);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Computes SHA-256 hash of arbitrary content.
 */
export function computeContentHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
