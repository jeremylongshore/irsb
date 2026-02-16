import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SolverReceiptV0Schema, normalizeReceipt } from '../src/integrations/index.js';
import { sha256Hex } from '../src/utils/canonical.js';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'solver');

function loadManifest(fixtureName: string) {
  const path = join(FIXTURES, fixtureName, 'evidence', 'manifest.json');
  const raw = readFileSync(path);
  const manifestSha256 = sha256Hex(raw);
  const parsed = JSON.parse(raw.toString('utf-8'));
  return { raw, manifestSha256, parsed };
}

describe('SolverReceiptV0Schema', () => {
  it('should accept a valid manifest', () => {
    const { parsed } = loadManifest('good-run');
    const result = SolverReceiptV0Schema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('should reject an incomplete manifest', () => {
    const { parsed } = loadManifest('bad-manifest');
    const result = SolverReceiptV0Schema.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it('should reject manifest with invalid artifact hash', () => {
    const result = SolverReceiptV0Schema.safeParse({
      manifestVersion: '0.1.0',
      intentId: 'i',
      runId: 'r',
      jobType: 'j',
      createdAt: '2025-01-15T12:00:00Z',
      artifacts: [{ path: 'a.txt', sha256: 'not-a-hash', bytes: 5, contentType: 'text/plain' }],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: 'SUCCESS' },
      solver: { service: 'irsb-solver', serviceVersion: '1.0.0' },
    });
    expect(result.success).toBe(false);
  });
});

describe('normalizeReceipt', () => {
  it('should produce correct fields from good-run manifest', () => {
    const { parsed, manifestSha256 } = loadManifest('good-run');
    const manifest = SolverReceiptV0Schema.parse(parsed);
    const receipt = normalizeReceipt(manifest, manifestSha256);

    expect(receipt.receiptVersion).toBe('0.1.0');
    expect(receipt.intentId).toBe('intent-001');
    expect(receipt.runId).toBe('run-001');
    expect(receipt.jobType).toBe('diagnostic');
    expect(receipt.status).toBe('SUCCESS');
    expect(receipt.manifestPath).toBe('evidence/manifest.json');
    expect(receipt.manifestSha256).toBe(manifestSha256);
    expect(receipt.delivered).toHaveLength(1);
    expect(receipt.delivered[0]!.path).toBe('artifacts/report.txt');
  });

  it('should produce a deterministic receiptId', () => {
    const { parsed, manifestSha256 } = loadManifest('good-run');
    const manifest = SolverReceiptV0Schema.parse(parsed);

    const receipt1 = normalizeReceipt(manifest, manifestSha256);
    const receipt2 = normalizeReceipt(manifest, manifestSha256);

    expect(receipt1.receiptId).toBe(receipt2.receiptId);
    expect(receipt1.receiptId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce same receiptId regardless of key order in manifest', () => {
    const { manifestSha256 } = loadManifest('good-run');

    // Two objects with same values but different insertion order
    const manifest1 = SolverReceiptV0Schema.parse({
      manifestVersion: '0.1.0',
      intentId: 'intent-001',
      runId: 'run-001',
      jobType: 'diagnostic',
      createdAt: '2025-01-15T12:00:00Z',
      artifacts: [],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: 'SUCCESS' },
      solver: { service: 'irsb-solver', serviceVersion: '1.0.0' },
    });

    const manifest2 = SolverReceiptV0Schema.parse({
      solver: { service: 'irsb-solver', serviceVersion: '1.0.0' },
      executionSummary: { status: 'SUCCESS' },
      policyDecision: { allowed: true, reasons: [] },
      artifacts: [],
      createdAt: '2025-01-15T12:00:00Z',
      jobType: 'diagnostic',
      runId: 'run-001',
      intentId: 'intent-001',
      manifestVersion: '0.1.0',
    });

    const r1 = normalizeReceipt(manifest1, manifestSha256);
    const r2 = normalizeReceipt(manifest2, manifestSha256);

    expect(r1.receiptId).toBe(r2.receiptId);
  });

  it('should sort delivered[] by path', () => {
    const manifest = SolverReceiptV0Schema.parse({
      manifestVersion: '0.1.0',
      intentId: 'i',
      runId: 'r',
      jobType: 'j',
      createdAt: '2025-01-15T12:00:00Z',
      artifacts: [
        { path: 'z.txt', sha256: 'a'.repeat(64), bytes: 1, contentType: 'text/plain' },
        { path: 'a.txt', sha256: 'b'.repeat(64), bytes: 2, contentType: 'text/plain' },
      ],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: 'SUCCESS' },
      solver: { service: 'irsb-solver', serviceVersion: '1.0.0' },
    });

    const receipt = normalizeReceipt(manifest, 'c'.repeat(64));
    expect(receipt.delivered[0]!.path).toBe('a.txt');
    expect(receipt.delivered[1]!.path).toBe('z.txt');
  });
});
