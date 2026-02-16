/**
 * Cryptographic hash utilities for deterministic ID computation.
 */

import { createHash } from "node:crypto";

/**
 * Computes SHA-256 hash of a string and returns hex-encoded result.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Computes SHA-256 hash with a prefix for namespacing.
 * Format: sha256(prefix + ":" + data)
 */
export function sha256WithPrefix(prefix: string, data: string): string {
  return sha256(`${prefix}:${data}`);
}
