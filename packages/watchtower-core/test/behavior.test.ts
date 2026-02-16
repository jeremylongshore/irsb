import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type Database from 'better-sqlite3';
import { SolverReceiptV0Schema, normalizeReceipt } from '../src/integrations/index.js';
import { verifyEvidence } from '../src/behavior/verifyEvidence.js';
import { deriveBehaviorSignals } from '../src/behavior/deriveBehaviorSignals.js';
import { ingestReceipt } from '../src/behavior/ingestReceipt.js';
import { initDbWithInlineMigrations } from '../src/storage/db.js';
import { getLatestRiskReport } from '../src/storage/reportStore.js';
import { getLatestSnapshots } from '../src/storage/snapshotStore.js';
import { listAlerts } from '../src/storage/alertStore.js';
import { getAgent } from '../src/storage/agentStore.js';
import { sha256Hex } from '../src/utils/canonical.js';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'solver');

function loadAndNormalize(fixtureName: string) {
  const manifestPath = join(FIXTURES, fixtureName, 'evidence', 'manifest.json');
  const raw = readFileSync(manifestPath);
  const manifestSha256 = sha256Hex(raw);
  const parsed = JSON.parse(raw.toString('utf-8'));
  const manifest = SolverReceiptV0Schema.parse(parsed);
  return { receipt: normalizeReceipt(manifest, manifestSha256), runDir: join(FIXTURES, fixtureName) };
}

// ── verifyEvidence ──────────────────────────────────────────────────────

describe('verifyEvidence', () => {
  it('should pass for good-run fixture', () => {
    const { receipt, runDir } = loadAndNormalize('good-run');
    const result = verifyEvidence(receipt, runDir);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.evidenceLinks.length).toBeGreaterThan(0);
  });

  it('should detect tampered artifact hash', () => {
    const { receipt, runDir } = loadAndNormalize('tampered-artifact');
    const result = verifyEvidence(receipt, runDir);
    expect(result.ok).toBe(false);
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain('ARTIFACT_HASH_MISMATCH');
  });

  it('should detect tampered artifact size', () => {
    const { receipt, runDir } = loadAndNormalize('tampered-artifact');
    const result = verifyEvidence(receipt, runDir);
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain('ARTIFACT_SIZE_MISMATCH');
  });

  it('should detect missing artifact', () => {
    const { receipt, runDir } = loadAndNormalize('missing-artifact');
    const result = verifyEvidence(receipt, runDir);
    expect(result.ok).toBe(false);
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain('ARTIFACT_NOT_FOUND');
  });

  it('should detect invalid manifest schema', () => {
    const manifestPath = join(FIXTURES, 'bad-manifest', 'evidence', 'manifest.json');
    const raw = readFileSync(manifestPath);
    const manifestSha256 = sha256Hex(raw);

    // Create a receipt manually since the schema won't parse
    const receipt = {
      receiptId: 'fake-id',
      receiptVersion: '0.1.0',
      intentId: 'intent-004',
      runId: 'unknown',
      jobType: 'unknown',
      status: 'SUCCESS' as const,
      manifestPath: 'evidence/manifest.json',
      manifestSha256,
      delivered: [],
    };

    const result = verifyEvidence(receipt, join(FIXTURES, 'bad-manifest'));
    expect(result.ok).toBe(false);
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain('MANIFEST_SCHEMA_INVALID');
  });

  it('should detect manifest hash mismatch', () => {
    const { receipt, runDir } = loadAndNormalize('good-run');
    // Tamper the expected hash
    const tampered = { ...receipt, manifestSha256: 'a'.repeat(64) };
    const result = verifyEvidence(tampered, runDir);
    expect(result.ok).toBe(false);
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain('MANIFEST_HASH_MISMATCH');
  });

  it('should detect manifest not found', () => {
    const receipt = {
      receiptId: 'fake-id',
      receiptVersion: '0.1.0',
      intentId: 'i',
      runId: 'r',
      jobType: 'j',
      status: 'SUCCESS' as const,
      manifestPath: 'evidence/manifest.json',
      manifestSha256: 'a'.repeat(64),
      delivered: [],
    };
    const result = verifyEvidence(receipt, '/tmp/nonexistent-run-dir-xyz');
    expect(result.ok).toBe(false);
    expect(result.failures[0]!.code).toBe('MANIFEST_NOT_FOUND');
  });

  it('should detect unsafe path traversal in artifact', () => {
    const { receipt, runDir } = loadAndNormalize('good-run');
    // Inject path traversal in delivered
    const tampered = {
      ...receipt,
      delivered: [
        {
          path: '../../../etc/passwd',
          sha256: 'a'.repeat(64),
          bytes: 100,
          contentType: 'text/plain',
        },
      ],
    };
    const result = verifyEvidence(tampered, runDir);
    expect(result.ok).toBe(false);
    const codes = result.failures.map((f) => f.code);
    // Will have DELIVERED_MISMATCH (because we changed delivered) and UNSAFE_PATH
    expect(codes).toContain('UNSAFE_PATH');
  });

  it('should sort failures deterministically', () => {
    const { receipt, runDir } = loadAndNormalize('good-run');
    const tampered = {
      ...receipt,
      delivered: [
        { path: '../bad', sha256: 'a'.repeat(64), bytes: 1, contentType: 'text/plain' },
        { path: '../also-bad', sha256: 'b'.repeat(64), bytes: 1, contentType: 'text/plain' },
      ],
    };
    const result = verifyEvidence(tampered, runDir);
    // Failures should be sorted by code then path
    for (let i = 1; i < result.failures.length; i++) {
      const prev = result.failures[i - 1]!;
      const curr = result.failures[i]!;
      const codeCompare = prev.code.localeCompare(curr.code);
      if (codeCompare === 0) {
        expect((prev.path ?? '').localeCompare(curr.path ?? '')).toBeLessThanOrEqual(0);
      } else {
        expect(codeCompare).toBeLessThan(0);
      }
    }
  });
});

// ── deriveBehaviorSignals ───────────────────────────────────────────────

describe('deriveBehaviorSignals', () => {
  it('should produce BE_VERIFIED_OK for successful verification', () => {
    const { receipt, runDir } = loadAndNormalize('good-run');
    const result = verifyEvidence(receipt, runDir);
    const signals = deriveBehaviorSignals(result, receipt, 1700000000);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.signalId).toBe('BE_VERIFIED_OK');
    expect(signals[0]!.severity).toBe('LOW');
    expect(signals[0]!.weight).toBe(0.1);
  });

  it('should produce CRITICAL signals for tampered artifact', () => {
    const { receipt, runDir } = loadAndNormalize('tampered-artifact');
    const result = verifyEvidence(receipt, runDir);
    const signals = deriveBehaviorSignals(result, receipt, 1700000000);
    const signalIds = signals.map((s) => s.signalId);
    expect(signalIds).toContain('BE_ARTIFACT_HASH_MISMATCH');
    const crit = signals.find((s) => s.signalId === 'BE_ARTIFACT_HASH_MISMATCH');
    expect(crit!.severity).toBe('CRITICAL');
    expect(crit!.weight).toBe(1.0);
  });

  it('should produce CRITICAL signal for missing artifact', () => {
    const { receipt, runDir } = loadAndNormalize('missing-artifact');
    const result = verifyEvidence(receipt, runDir);
    const signals = deriveBehaviorSignals(result, receipt, 1700000000);
    const signalIds = signals.map((s) => s.signalId);
    expect(signalIds).toContain('BE_ARTIFACT_MISSING');
  });

  it('should use observedAt from parameter', () => {
    const { receipt, runDir } = loadAndNormalize('good-run');
    const result = verifyEvidence(receipt, runDir);
    const signals = deriveBehaviorSignals(result, receipt, 1700099999);
    expect(signals[0]!.observedAt).toBe(1700099999);
  });

  it('should collapse multiple failures of same type into one signal', () => {
    const { receipt } = loadAndNormalize('good-run');
    // Craft a verification result with multiple ARTIFACT_NOT_FOUND
    const fakeResult = {
      ok: false,
      failures: [
        { code: 'ARTIFACT_NOT_FOUND' as const, message: 'missing a.txt', path: 'a.txt' },
        { code: 'ARTIFACT_NOT_FOUND' as const, message: 'missing b.txt', path: 'b.txt' },
      ],
      evidenceLinks: [],
    };
    const signals = deriveBehaviorSignals(fakeResult, receipt, 1700000000);
    const missingSignals = signals.filter((s) => s.signalId === 'BE_ARTIFACT_MISSING');
    expect(missingSignals).toHaveLength(1);
    // Should have both paths in evidence
    expect(missingSignals[0]!.evidence.length).toBeGreaterThanOrEqual(2);
  });
});

// ── ingestReceipt (full pipeline) ───────────────────────────────────────

describe('ingestReceipt', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wt-behavior-'));
    db = initDbWithInlineMigrations(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should ingest good-run and produce low risk', () => {
    const manifestPath = join(FIXTURES, 'good-run', 'evidence', 'manifest.json');
    const result = ingestReceipt(db, 'test-solver', manifestPath);

    expect(result.receiptId).toMatch(/^[a-f0-9]{64}$/);
    expect(result.snapshotId).toMatch(/^[a-f0-9]{64}$/);
    expect(result.reportId).toMatch(/^[a-f0-9]{64}$/);
    expect(result.ok).toBe(true);
    expect(result.overallRisk).toBeLessThan(50);
    expect(result.alertCount).toBe(0);
  });

  it('should ingest tampered-artifact and produce CRITICAL risk', () => {
    const manifestPath = join(FIXTURES, 'tampered-artifact', 'evidence', 'manifest.json');
    const result = ingestReceipt(db, 'test-solver', manifestPath);

    expect(result.ok).toBe(false);
    expect(result.overallRisk).toBe(100);
    expect(result.alertCount).toBeGreaterThan(0);
  });

  it('should store snapshot, report, and alerts in DB', () => {
    const manifestPath = join(FIXTURES, 'tampered-artifact', 'evidence', 'manifest.json');
    const result = ingestReceipt(db, 'test-solver', manifestPath);

    // Agent was created
    const agent = getAgent(db, 'test-solver');
    expect(agent).toBeDefined();

    // Snapshot was stored
    const snapshots = getLatestSnapshots(db, 'test-solver');
    expect(snapshots.length).toBeGreaterThanOrEqual(1);

    // Report was stored
    const report = getLatestRiskReport(db, 'test-solver');
    expect(report).toBeDefined();
    expect(report!.reportId).toBe(result.reportId);

    // Alerts were stored
    const alerts = listAlerts(db, { agentId: 'test-solver', activeOnly: true });
    expect(alerts.length).toBe(result.alertCount);
  });

  it('should handle bad-manifest gracefully', () => {
    const manifestPath = join(FIXTURES, 'bad-manifest', 'evidence', 'manifest.json');
    const result = ingestReceipt(db, 'test-solver', manifestPath);

    expect(result.ok).toBe(false);
    // Should still produce a report
    expect(result.reportId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should infer runDir from receipt path', () => {
    const manifestPath = join(FIXTURES, 'good-run', 'evidence', 'manifest.json');
    // Don't pass runDir — should be inferred
    const result = ingestReceipt(db, 'test-solver', manifestPath);
    expect(result.ok).toBe(true);
  });

  it('should accept explicit runDir', () => {
    const manifestPath = join(FIXTURES, 'good-run', 'evidence', 'manifest.json');
    const runDir = join(FIXTURES, 'good-run');
    const result = ingestReceipt(db, 'test-solver', manifestPath, runDir);
    expect(result.ok).toBe(true);
  });

  it('should produce idempotent snapshotId for same data', () => {
    const manifestPath = join(FIXTURES, 'good-run', 'evidence', 'manifest.json');
    const result1 = ingestReceipt(db, 'test-solver', manifestPath);
    const result2 = ingestReceipt(db, 'test-solver', manifestPath);
    // snapshotId should be the same since signals are the same
    expect(result1.snapshotId).toBe(result2.snapshotId);
  });
});
