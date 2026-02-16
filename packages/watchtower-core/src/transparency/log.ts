import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TransparencyLeaf } from './leaf.js';
import { verifyLeaf } from './leaf.js';

/**
 * Get the log file path for a given date.
 */
export function logFilePath(logDir: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return join(logDir, `leaves-${yyyy}-${mm}-${dd}.ndjson`);
}

/**
 * Append a leaf to the transparency log (NDJSON).
 * Append-only: never rewrites existing lines.
 */
export function appendLeaf(logDir: string, leaf: TransparencyLeaf): string {
  mkdirSync(logDir, { recursive: true });
  const filePath = logFilePath(logDir, new Date(leaf.writtenAt * 1000));
  const line = JSON.stringify(leaf) + '\n';
  appendFileSync(filePath, line, 'utf-8');
  return filePath;
}

export interface VerifyLogResult {
  filePath: string;
  totalLeaves: number;
  validLeaves: number;
  invalidLeaves: number;
  errors: Array<{ line: number; leafId: string; error: string }>;
}

/**
 * Verify all leaves in a log file.
 * Checks each leaf's leafId integrity and signature validity.
 */
export function verifyLogFile(filePath: string, publicKey: string): VerifyLogResult {
  const result: VerifyLogResult = {
    filePath,
    totalLeaves: 0,
    validLeaves: 0,
    invalidLeaves: 0,
    errors: [],
  };

  if (!existsSync(filePath)) {
    return result;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    result.totalLeaves++;
    let leaf: TransparencyLeaf;
    try {
      leaf = JSON.parse(lines[i]!) as TransparencyLeaf;
    } catch {
      result.invalidLeaves++;
      result.errors.push({ line: i + 1, leafId: 'PARSE_ERROR', error: 'invalid JSON' });
      continue;
    }

    const verification = verifyLeaf(leaf, publicKey);
    if (verification.valid) {
      result.validLeaves++;
    } else {
      result.invalidLeaves++;
      result.errors.push({
        line: i + 1,
        leafId: leaf.leafId ?? 'unknown',
        error: verification.error ?? 'unknown error',
      });
    }
  }

  return result;
}

/**
 * Read all leaves from a log file.
 */
export function readLogFile(filePath: string): TransparencyLeaf[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as TransparencyLeaf);
}
