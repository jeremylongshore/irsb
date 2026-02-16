import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import type { Signal } from '../schemas/index.js';
import { SolverReceiptV0Schema, normalizeReceipt } from '../integrations/index.js';
import { verifyEvidence } from './verifyEvidence.js';
import { deriveBehaviorSignals } from './deriveBehaviorSignals.js';
import { canonicalJson, sha256Hex } from '../utils/canonical.js';
import { sortSignals } from '../utils/sort.js';
import { upsertAgent } from '../storage/agentStore.js';
import { insertSnapshot } from '../storage/snapshotStore.js';
import { insertRiskReport } from '../storage/reportStore.js';
import { insertAlerts } from '../storage/alertStore.js';
import { getLatestSnapshots } from '../storage/snapshotStore.js';
import { getAgent } from '../storage/agentStore.js';
import { scoreAgent } from '../scoring/scoreAgent.js';

export interface IngestResult {
  receiptId: string;
  snapshotId: string;
  reportId: string;
  ok: boolean;
  overallRisk: number;
  alertCount: number;
}

/**
 * Full ingest pipeline: read manifest → normalize → verify → derive signals → store.
 */
export function ingestReceipt(
  db: Database.Database,
  agentId: string,
  receiptPath: string,
  runDir?: string,
): IngestResult {
  const observedAt = Math.floor(Date.now() / 1000);

  // 1. Read raw manifest bytes
  const absReceiptPath = resolve(receiptPath);
  const rawBytes = readFileSync(absReceiptPath);
  const manifestSha256 = sha256Hex(rawBytes);

  // 2. Parse and validate manifest
  let signals: Signal[];
  let receiptId: string;
  let ok: boolean;

  const parsed = safeParseManifest(rawBytes);
  if (!parsed.success) {
    // Schema-invalid manifest — produce BE_RECEIPT_SCHEMA_INVALID signal
    receiptId = sha256Hex(
      canonicalJson({
        intentId: 'unknown',
        runId: 'unknown',
        jobType: 'unknown',
        manifestSha256,
      }),
    );
    ok = false;
    signals = [
      {
        signalId: 'BE_RECEIPT_SCHEMA_INVALID',
        severity: 'HIGH',
        weight: 0.8,
        observedAt,
        evidence: [
          { type: 'manifestSha256', ref: manifestSha256 },
          { type: 'parseError', ref: parsed.error },
        ],
      },
    ];
  } else {
    // 3. Normalize receipt
    const receipt = normalizeReceipt(parsed.data, manifestSha256);
    receiptId = receipt.receiptId;

    // 4. Infer runDir if not provided
    const effectiveRunDir =
      runDir ?? inferRunDir(absReceiptPath);

    // 5. Verify evidence
    const result = verifyEvidence(receipt, effectiveRunDir);
    ok = result.ok;

    // 6. Derive signals
    signals = deriveBehaviorSignals(result, receipt, observedAt);
  }

  // 7. Sort signals deterministically
  signals = sortSignals(signals);

  // 8. Compute deterministic snapshot ID (exclude observedAt for idempotency)
  const snapshotId = sha256Hex(
    canonicalJson({ agentId, signals }),
  );

  // 9. Upsert agent
  upsertAgent(db, { agentId });

  // 10. Insert snapshot
  insertSnapshot(db, {
    snapshotId,
    agentId,
    observedAt,
    signals,
  });

  // 11. Score agent with all recent snapshots
  const agent = getAgent(db, agentId)!;
  const snapshots = getLatestSnapshots(db, agentId);
  const generatedAt = Math.floor(Date.now() / 1000);
  const { report, newAlerts } = scoreAgent(agent, snapshots, generatedAt);

  // 12. Store report and alerts
  insertRiskReport(db, report);
  if (newAlerts.length > 0) {
    insertAlerts(db, newAlerts);
  }

  return {
    receiptId,
    snapshotId,
    reportId: report.reportId,
    ok,
    overallRisk: report.overallRisk,
    alertCount: newAlerts.length,
  };
}

function safeParseManifest(
  rawBytes: Buffer,
): { success: true; data: import('../integrations/index.js').SolverReceiptV0 } | { success: false; error: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(rawBytes.toString('utf-8'));
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }

  const result = SolverReceiptV0Schema.safeParse(obj);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join('; '),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Infer runDir by stripping `evidence/manifest.json` from the receipt path.
 */
function inferRunDir(absReceiptPath: string): string {
  const dir = dirname(absReceiptPath);
  const parent = dirname(dir);
  // If the receipt is at <runDir>/evidence/manifest.json, parent = <runDir>
  if (dir.endsWith('/evidence') || dir.endsWith('\\evidence')) {
    return parent;
  }
  // Fallback: use the directory containing the manifest
  return dir;
}
