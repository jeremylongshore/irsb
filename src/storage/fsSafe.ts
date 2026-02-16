/**
 * Safe filesystem utilities.
 *
 * Provides path validation and safe file operations.
 */

import { join, resolve, relative, isAbsolute, normalize } from "node:path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";

/**
 * Path safety validation result.
 */
export interface PathValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Validates that a path is safe (no traversal, not absolute).
 */
export function validateRelativePath(path: string): PathValidation {
  if (!path || path.length === 0) {
    return { valid: false, reason: "Path is empty" };
  }

  if (isAbsolute(path)) {
    return { valid: false, reason: "Absolute paths not allowed" };
  }

  // Check for path traversal attempts
  const normalized = normalize(path);
  if (normalized.startsWith("..") || normalized.includes("/..") || normalized.includes("\\..")) {
    return { valid: false, reason: "Path traversal not allowed" };
  }

  // Check for null bytes
  if (path.includes("\0")) {
    return { valid: false, reason: "Null bytes not allowed in path" };
  }

  return { valid: true };
}

/**
 * Safely joins paths and ensures result is within base directory.
 */
export function safeJoin(baseDir: string, ...paths: string[]): string | null {
  const base = resolve(baseDir);
  const joined = join(base, ...paths);
  const resolved = resolve(joined);

  // Ensure the resolved path is within the base directory
  if (!resolved.startsWith(base + "/") && resolved !== base) {
    return null;
  }

  return resolved;
}

/**
 * Gets the relative path from base to target, validating it's within base.
 */
export function safeRelative(baseDir: string, targetPath: string): string | null {
  const base = resolve(baseDir);
  const target = resolve(targetPath);

  if (!target.startsWith(base + "/") && target !== base) {
    return null;
  }

  return relative(base, target);
}

/**
 * Ensures a directory exists, creating it if necessary.
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Writes content to a file atomically using temp-then-rename.
 */
export function atomicWrite(filePath: string, content: string): void {
  const dir = resolve(filePath, "..");
  ensureDir(dir);

  const suffix = randomBytes(8).toString("hex");
  const tempPath = join(dir, `.tmp-${suffix}`);

  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, filePath);
}

/**
 * Lists files in a directory recursively.
 */
export function listFilesRecursive(dirPath: string, baseDir?: string): string[] {
  const base = baseDir ?? dirPath;
  const files: string[] = [];

  if (!existsSync(dirPath)) {
    return files;
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, base));
    } else if (entry.isFile()) {
      const relativePath = safeRelative(base, fullPath);
      if (relativePath !== null) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
}

/**
 * Gets file size in bytes.
 */
export function getFileSize(filePath: string): number {
  return statSync(filePath).size;
}
