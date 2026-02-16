/**
 * Atomic artifact writer.
 *
 * Writes artifacts using temp-file-then-rename for atomicity.
 */

import {
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { ArtifactInfo } from "../execution/jobRunner.js";

/**
 * Ensures the parent directory exists.
 */
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generates a unique temporary filename in the same directory.
 */
function tempPath(filePath: string): string {
  const dir = dirname(filePath);
  const suffix = randomBytes(8).toString("hex");
  return join(dir, `.tmp-${suffix}`);
}

/**
 * Writes content to a file atomically.
 *
 * Process:
 * 1. Write to temp file
 * 2. Rename temp to target (atomic on POSIX)
 *
 * @returns Size in bytes
 */
export function writeArtifact(filePath: string, content: string): number {
  ensureDir(filePath);

  const temp = tempPath(filePath);
  writeFileSync(temp, content, "utf8");
  renameSync(temp, filePath);

  return statSync(filePath).size;
}

/**
 * Writes multiple artifacts atomically.
 *
 * All artifacts are written to temp files first, then renamed.
 * This provides all-or-nothing semantics for the batch.
 *
 * @returns Array of artifact info
 */
export function writeArtifacts(
  artifacts: { path: string; content: string }[]
): ArtifactInfo[] {
  const tempFiles: { temp: string; target: string }[] = [];
  const results: ArtifactInfo[] = [];

  try {
    // Phase 1: Write all to temp files
    for (const { path, content } of artifacts) {
      ensureDir(path);
      const temp = tempPath(path);
      writeFileSync(temp, content, "utf8");
      tempFiles.push({ temp, target: path });
    }

    // Phase 2: Rename all (atomic per file)
    for (const { temp, target } of tempFiles) {
      renameSync(temp, target);
      const size = statSync(target).size;
      // Store relative filename only (use path.basename for cross-platform support)
      const filename = basename(target);
      results.push({ path: filename, bytes: size });
    }

    return results;
  } catch (error) {
    // Cleanup any temp files on failure
    for (const { temp } of tempFiles) {
      try {
        if (existsSync(temp)) {
          unlinkSync(temp);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}
