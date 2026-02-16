import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute, normalize } from 'node:path';
import type { NormalizedReceipt } from '../integrations/index.js';
import type { EvidenceLink } from '../schemas/index.js';
import { sha256Hex } from '../utils/canonical.js';
import { SolverReceiptV0Schema } from '../integrations/solverReceiptV0.js';

// ── Types ───────────────────────────────────────────────────────────────

export type FailureCode =
  | 'ARTIFACT_HASH_MISMATCH'
  | 'ARTIFACT_NOT_FOUND'
  | 'ARTIFACT_SIZE_MISMATCH'
  | 'ARTIFACT_TOO_LARGE'
  | 'DELIVERED_MISMATCH'
  | 'MANIFEST_HASH_MISMATCH'
  | 'MANIFEST_NOT_FOUND'
  | 'MANIFEST_PARSE_FAIL'
  | 'MANIFEST_READ_ERROR'
  | 'MANIFEST_SCHEMA_INVALID'
  | 'MANIFEST_TOO_LARGE'
  | 'UNSAFE_PATH';

export interface VerificationFailure {
  code: FailureCode;
  message: string;
  path?: string;
}

export interface VerificationResult {
  ok: boolean;
  failures: VerificationFailure[];
  evidenceLinks: EvidenceLink[];
}

export interface VerifyOptions {
  maxManifestBytes?: number;
  maxArtifactBytes?: number;
}

const DEFAULT_MAX_MANIFEST_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_MAX_ARTIFACT_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Path safety (adapted from irsb-solver fsSafe.ts) ────────────────────

function validateRelativePath(path: string): { valid: boolean; reason?: string } {
  if (!path || path.length === 0) {
    return { valid: false, reason: 'Path is empty' };
  }
  if (isAbsolute(path)) {
    return { valid: false, reason: 'Absolute paths not allowed' };
  }
  const normalized = normalize(path);
  if (normalized.startsWith('..') || normalized.includes('/..') || normalized.includes('\\..')) {
    return { valid: false, reason: 'Path traversal not allowed' };
  }
  if (path.includes('\0')) {
    return { valid: false, reason: 'Null bytes not allowed in path' };
  }
  return { valid: true };
}

function safeJoin(baseDir: string, relativePath: string): string | null {
  const base = resolve(baseDir);
  const joined = resolve(base, relativePath);
  if (!joined.startsWith(base + '/') && joined !== base) {
    return null;
  }
  return joined;
}

// ── Verification ────────────────────────────────────────────────────────

export function verifyEvidence(
  receipt: NormalizedReceipt,
  runDir: string,
  options?: VerifyOptions,
): VerificationResult {
  const maxManifestBytes = options?.maxManifestBytes ?? DEFAULT_MAX_MANIFEST_BYTES;
  const maxArtifactBytes = options?.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;

  const failures: VerificationFailure[] = [];
  const evidenceLinks: EvidenceLink[] = [
    { type: 'receiptId', ref: receipt.receiptId },
    { type: 'manifestSha256', ref: receipt.manifestSha256 },
  ];

  // 1. Validate manifest path safety
  const manifestRelPath = receipt.manifestPath;
  const pathCheck = validateRelativePath(manifestRelPath);
  if (!pathCheck.valid) {
    failures.push({
      code: 'UNSAFE_PATH',
      message: `Manifest path unsafe: ${pathCheck.reason}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  const manifestAbsPath = safeJoin(runDir, manifestRelPath);
  if (!manifestAbsPath) {
    failures.push({
      code: 'UNSAFE_PATH',
      message: 'Manifest path escapes run directory',
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  // 2. Check manifest exists
  if (!existsSync(manifestAbsPath)) {
    failures.push({
      code: 'MANIFEST_NOT_FOUND',
      message: `Manifest not found: ${manifestRelPath}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  // 3. Check manifest size
  let manifestSize: number;
  try {
    manifestSize = statSync(manifestAbsPath).size;
  } catch (err) {
    failures.push({
      code: 'MANIFEST_READ_ERROR',
      message: `Cannot stat manifest: ${(err as Error).message}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  if (manifestSize > maxManifestBytes) {
    failures.push({
      code: 'MANIFEST_TOO_LARGE',
      message: `Manifest ${manifestSize} bytes exceeds limit ${maxManifestBytes}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  // 4. Read manifest bytes and verify hash
  let manifestBytes: Buffer;
  try {
    manifestBytes = readFileSync(manifestAbsPath);
  } catch (err) {
    failures.push({
      code: 'MANIFEST_READ_ERROR',
      message: `Cannot read manifest: ${(err as Error).message}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  const actualManifestHash = sha256Hex(manifestBytes);
  if (actualManifestHash !== receipt.manifestSha256) {
    failures.push({
      code: 'MANIFEST_HASH_MISMATCH',
      message: `Manifest hash mismatch: expected ${receipt.manifestSha256}, got ${actualManifestHash}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  // 5. Parse manifest JSON
  let manifestObj: unknown;
  try {
    manifestObj = JSON.parse(manifestBytes.toString('utf-8'));
  } catch {
    failures.push({
      code: 'MANIFEST_PARSE_FAIL',
      message: 'Manifest is not valid JSON',
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  // 6. Validate manifest schema
  const schemaResult = SolverReceiptV0Schema.safeParse(manifestObj);
  if (!schemaResult.success) {
    failures.push({
      code: 'MANIFEST_SCHEMA_INVALID',
      message: `Manifest schema invalid: ${schemaResult.error.issues.map((i) => i.message).join('; ')}`,
      path: manifestRelPath,
    });
    return buildResult(failures, evidenceLinks);
  }

  // 7. Check delivered[] matches manifest artifacts
  const manifest = schemaResult.data;
  const manifestArtifactsSorted = [...manifest.artifacts]
    .sort((a, b) => a.path.localeCompare(b.path));
  const deliveredSorted = [...receipt.delivered]
    .sort((a, b) => a.path.localeCompare(b.path));

  const manifestPaths = manifestArtifactsSorted.map((a) => a.path).join(',');
  const deliveredPaths = deliveredSorted.map((a) => a.path).join(',');

  if (manifestPaths !== deliveredPaths) {
    failures.push({
      code: 'DELIVERED_MISMATCH',
      message: 'Receipt delivered[] does not match manifest artifacts',
    });
  }

  // 8. Verify each artifact
  for (const artifact of receipt.delivered) {
    const artPathCheck = validateRelativePath(artifact.path);
    if (!artPathCheck.valid) {
      failures.push({
        code: 'UNSAFE_PATH',
        message: `Artifact path unsafe: ${artPathCheck.reason}`,
        path: artifact.path,
      });
      continue;
    }

    const artAbsPath = safeJoin(runDir, artifact.path);
    if (!artAbsPath) {
      failures.push({
        code: 'UNSAFE_PATH',
        message: 'Artifact path escapes run directory',
        path: artifact.path,
      });
      continue;
    }

    if (!existsSync(artAbsPath)) {
      failures.push({
        code: 'ARTIFACT_NOT_FOUND',
        message: `Artifact not found: ${artifact.path}`,
        path: artifact.path,
      });
      continue;
    }

    let artSize: number;
    try {
      artSize = statSync(artAbsPath).size;
    } catch {
      failures.push({
        code: 'ARTIFACT_NOT_FOUND',
        message: `Cannot stat artifact: ${artifact.path}`,
        path: artifact.path,
      });
      continue;
    }

    if (artSize > maxArtifactBytes) {
      failures.push({
        code: 'ARTIFACT_TOO_LARGE',
        message: `Artifact ${artSize} bytes exceeds limit ${maxArtifactBytes}`,
        path: artifact.path,
      });
      continue;
    }

    if (artSize !== artifact.bytes) {
      failures.push({
        code: 'ARTIFACT_SIZE_MISMATCH',
        message: `Artifact size mismatch for ${artifact.path}: expected ${artifact.bytes}, got ${artSize}`,
        path: artifact.path,
      });
    }

    let artBytes: Buffer;
    try {
      artBytes = readFileSync(artAbsPath);
    } catch {
      failures.push({
        code: 'ARTIFACT_NOT_FOUND',
        message: `Cannot read artifact: ${artifact.path}`,
        path: artifact.path,
      });
      continue;
    }

    const actualArtHash = sha256Hex(artBytes);
    if (actualArtHash !== artifact.sha256) {
      failures.push({
        code: 'ARTIFACT_HASH_MISMATCH',
        message: `Artifact hash mismatch for ${artifact.path}: expected ${artifact.sha256}, got ${actualArtHash}`,
        path: artifact.path,
      });
    }

    evidenceLinks.push({ type: 'artifactSha256', ref: artifact.sha256 });
  }

  return buildResult(failures, evidenceLinks);
}

function buildResult(
  failures: VerificationFailure[],
  evidenceLinks: EvidenceLink[],
): VerificationResult {
  // Sort failures deterministically by (code, path)
  const sorted = [...failures].sort((a, b) => {
    const codeDiff = a.code.localeCompare(b.code);
    if (codeDiff !== 0) return codeDiff;
    return (a.path ?? '').localeCompare(b.path ?? '');
  });

  return {
    ok: sorted.length === 0,
    failures: sorted,
    evidenceLinks,
  };
}
