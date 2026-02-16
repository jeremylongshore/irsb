/**
 * Append-only JSONL writer with atomic write behavior.
 *
 * Uses write-to-temp-then-rename pattern for atomic appends.
 * Includes file locking for safe concurrent access.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { lockSync, unlockSync } from "proper-lockfile";

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
  return join(dir, `.tmp-${suffix}.jsonl`);
}

/**
 * Appends a record to a JSONL file atomically with file locking.
 *
 * Process:
 * 1. Acquire exclusive lock on the file (or directory for new files)
 * 2. Read existing content (if file exists)
 * 3. Write existing + new record to temp file
 * 4. Rename temp file to target (atomic on POSIX)
 * 5. Release lock
 *
 * This ensures:
 * - Partial writes don't corrupt the file
 * - Concurrent appends don't lose data
 */
export function appendJsonl(filePath: string, record: unknown): void {
  ensureDir(filePath);

  const line = JSON.stringify(record) + "\n";
  const dir = dirname(filePath);

  // For new files, we need to lock the directory since the file doesn't exist yet
  // For existing files, we lock the file itself
  const lockTarget = existsSync(filePath) ? filePath : dir;

  try {
    // Acquire exclusive lock
    lockSync(lockTarget, { retries: { retries: 5, minTimeout: 100 } });

    try {
      if (existsSync(filePath)) {
        // Append atomically: read, write temp, rename
        const existing = readFileSync(filePath, "utf8");
        const temp = tempPath(filePath);
        writeFileSync(temp, existing + line, "utf8");
        renameSync(temp, filePath);
      } else {
        // First record: just write
        writeFileSync(filePath, line, "utf8");
      }
    } finally {
      // Always release lock
      unlockSync(lockTarget);
    }
  } catch (error) {
    // If lock acquisition fails after retries, throw with context
    if (error instanceof Error && error.message.includes("lock")) {
      throw new Error(`Failed to acquire lock for ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Non-atomic append for high-frequency writes.
 * Use when atomicity is not critical and concurrent access is not expected.
 * WARNING: Not safe for concurrent access - use appendJsonl for that.
 */
export function appendJsonlFast(filePath: string, record: unknown): void {
  ensureDir(filePath);
  const line = JSON.stringify(record) + "\n";
  appendFileSync(filePath, line, "utf8");
}

/**
 * Reads all records from a JSONL file.
 * Returns empty array if file doesn't exist.
 */
export function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as T);
}
