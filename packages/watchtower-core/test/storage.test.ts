import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type Database from 'better-sqlite3';
import { initDbWithInlineMigrations } from '../src/storage/db.js';
import { upsertAgent, getAgent, listAgents } from '../src/storage/agentStore.js';
import { insertSnapshot, getLatestSnapshots } from '../src/storage/snapshotStore.js';
import { insertRiskReport, getLatestRiskReport } from '../src/storage/reportStore.js';
import { insertAlerts, listAlerts } from '../src/storage/alertStore.js';
import { scoreAgent } from '../src/scoring/scoreAgent.js';
import type { Agent, Snapshot, Signal } from '../src/schemas/index.js';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wt-test-'));
  db = initDbWithInlineMigrations(join(tmpDir, 'test.db'));
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeSignal(overrides: Partial<Signal> & { signalId: string; severity: Signal['severity'] }): Signal {
  return {
    weight: 0.8,
    observedAt: 1700000000,
    evidence: [{ type: 'tx', ref: '0xabc' }],
    ...overrides,
  };
}

describe('initDb', () => {
  it('should create all tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('agents');
    expect(names).toContain('snapshots');
    expect(names).toContain('alerts');
    expect(names).toContain('risk_reports');
    expect(names).toContain('_migrations');
  });

  it('should track applied migrations', () => {
    const migrations = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as Array<{ name: string }>;
    expect(migrations).toHaveLength(3);
    expect(migrations[0]!.name).toBe('001_init.sql');
    expect(migrations[1]!.name).toBe('002_identity.sql');
    expect(migrations[2]!.name).toBe('003_context.sql');
  });
});

describe('agentStore', () => {
  it('should upsert and read back an agent', () => {
    const agent: Agent = {
      agentId: 'test-agent-001',
      status: 'ACTIVE',
      labels: ['solver', 'tier-1'],
    };
    upsertAgent(db, agent);

    const read = getAgent(db, 'test-agent-001');
    expect(read).toBeDefined();
    expect(read!.agentId).toBe('test-agent-001');
    expect(read!.status).toBe('ACTIVE');
    expect(read!.labels).toEqual(['solver', 'tier-1']);
  });

  it('should update an existing agent on conflict', () => {
    upsertAgent(db, { agentId: 'agent-up', status: 'ACTIVE', labels: [] });
    upsertAgent(db, { agentId: 'agent-up', status: 'PROBATION', labels: ['flagged'] });

    const read = getAgent(db, 'agent-up');
    expect(read!.status).toBe('PROBATION');
    expect(read!.labels).toEqual(['flagged']);
  });

  it('should preserve existing status when upserting without status', () => {
    upsertAgent(db, { agentId: 'agent-partial', status: 'BLOCKED', labels: ['flagged'] });
    upsertAgent(db, { agentId: 'agent-partial' });

    const read = getAgent(db, 'agent-partial');
    expect(read!.status).toBe('BLOCKED');
    expect(read!.labels).toEqual(['flagged']);
  });

  it('should list all agents', () => {
    upsertAgent(db, { agentId: 'a-001' });
    upsertAgent(db, { agentId: 'a-002' });
    const agents = listAgents(db);
    expect(agents).toHaveLength(2);
  });
});

describe('snapshotStore', () => {
  it('should insert and retrieve snapshots', () => {
    upsertAgent(db, { agentId: 'agent-001' });
    const snapshot: Snapshot = {
      snapshotId: 'snap-001',
      agentId: 'agent-001',
      observedAt: 1700000000,
      signals: [makeSignal({ signalId: 'sig-1', severity: 'HIGH' })],
    };
    insertSnapshot(db, snapshot);

    const results = getLatestSnapshots(db, 'agent-001');
    expect(results).toHaveLength(1);
    expect(results[0]!.snapshotId).toBe('snap-001');
    expect(results[0]!.signals).toHaveLength(1);
  });

  it('should return snapshots ordered by observedAt desc', () => {
    upsertAgent(db, { agentId: 'agent-001' });
    insertSnapshot(db, {
      snapshotId: 'snap-old',
      agentId: 'agent-001',
      observedAt: 1700000000,
      signals: [],
    });
    insertSnapshot(db, {
      snapshotId: 'snap-new',
      agentId: 'agent-001',
      observedAt: 1700001000,
      signals: [],
    });

    const results = getLatestSnapshots(db, 'agent-001', 10);
    expect(results[0]!.snapshotId).toBe('snap-new');
    expect(results[1]!.snapshotId).toBe('snap-old');
  });

  it('should respect limit', () => {
    upsertAgent(db, { agentId: 'agent-001' });
    for (let i = 0; i < 5; i++) {
      insertSnapshot(db, {
        snapshotId: `snap-${i}`,
        agentId: 'agent-001',
        observedAt: 1700000000 + i,
        signals: [],
      });
    }

    const results = getLatestSnapshots(db, 'agent-001', 3);
    expect(results).toHaveLength(3);
  });
});

describe('reportStore', () => {
  it('should store and retrieve risk reports via scoreAgent', () => {
    const agent: Agent = { agentId: 'agent-score-001' };
    upsertAgent(db, agent);

    const snapshots: Snapshot[] = [
      {
        snapshotId: 'snap-score-1',
        agentId: 'agent-score-001',
        observedAt: 1700000000,
        signals: [
          makeSignal({ signalId: 'sig-1', severity: 'HIGH' }),
          makeSignal({ signalId: 'sig-2', severity: 'MEDIUM', weight: 0.5 }),
        ],
      },
    ];

    for (const snap of snapshots) {
      insertSnapshot(db, snap);
    }

    const { report, newAlerts } = scoreAgent(agent, snapshots, 1700002000);
    insertRiskReport(db, report);
    if (newAlerts.length > 0) {
      insertAlerts(db, newAlerts);
    }

    const retrieved = getLatestRiskReport(db, 'agent-score-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.reportId).toBe(report.reportId);
    expect(retrieved!.overallRisk).toBe(report.overallRisk);
    expect(retrieved!.confidence).toBe(report.confidence);
  });
});

describe('alertStore', () => {
  it('should insert and retrieve alerts', () => {
    upsertAgent(db, { agentId: 'agent-001' });
    insertAlerts(db, [
      {
        alertId: 'alert-001',
        agentId: 'agent-001',
        type: 'CRITICAL_SIGNAL_DETECTED',
        severity: 'CRITICAL',
        description: 'Critical signal found',
        evidenceLinks: [{ type: 'tx', ref: '0xabc' }],
        createdAt: 1700000000,
        isActive: true,
      },
      {
        alertId: 'alert-002',
        agentId: 'agent-001',
        type: 'HIGH_RISK_SCORE',
        severity: 'HIGH',
        description: 'High risk',
        evidenceLinks: [],
        createdAt: 1700001000,
        isActive: false,
      },
    ]);

    const all = listAlerts(db);
    expect(all).toHaveLength(2);
  });

  it('should filter by agentId', () => {
    upsertAgent(db, { agentId: 'agent-001' });
    upsertAgent(db, { agentId: 'agent-002' });
    insertAlerts(db, [
      {
        alertId: 'alert-a1',
        agentId: 'agent-001',
        type: 'TEST',
        severity: 'LOW',
        description: 'test',
        evidenceLinks: [],
        createdAt: 1700000000,
        isActive: true,
      },
      {
        alertId: 'alert-b1',
        agentId: 'agent-002',
        type: 'TEST',
        severity: 'LOW',
        description: 'test',
        evidenceLinks: [],
        createdAt: 1700000000,
        isActive: true,
      },
    ]);

    const filtered = listAlerts(db, { agentId: 'agent-001' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.agentId).toBe('agent-001');
  });

  it('should filter active only', () => {
    upsertAgent(db, { agentId: 'agent-001' });
    insertAlerts(db, [
      {
        alertId: 'alert-active',
        agentId: 'agent-001',
        type: 'TEST',
        severity: 'HIGH',
        description: 'active',
        evidenceLinks: [],
        createdAt: 1700000000,
        isActive: true,
      },
      {
        alertId: 'alert-resolved',
        agentId: 'agent-001',
        type: 'TEST',
        severity: 'HIGH',
        description: 'resolved',
        evidenceLinks: [],
        createdAt: 1700000000,
        isActive: false,
      },
    ]);

    const active = listAlerts(db, { activeOnly: true });
    expect(active).toHaveLength(1);
    expect(active[0]!.alertId).toBe('alert-active');
  });
});

describe('Full pipeline: score → store → read', () => {
  it('should round-trip a complete scoring cycle', () => {
    const agent: Agent = { agentId: 'pipeline-agent' };
    upsertAgent(db, agent);

    const snapshots: Snapshot[] = [
      {
        snapshotId: 'pipeline-snap-1',
        agentId: 'pipeline-agent',
        observedAt: 1700000000,
        signals: [
          makeSignal({ signalId: 'sig-crit', severity: 'CRITICAL' }),
          makeSignal({ signalId: 'sig-high', severity: 'HIGH', weight: 0.5 }),
        ],
      },
      {
        snapshotId: 'pipeline-snap-2',
        agentId: 'pipeline-agent',
        observedAt: 1700001000,
        signals: [
          makeSignal({ signalId: 'sig-med', severity: 'MEDIUM', weight: 0.3 }),
        ],
      },
    ];

    for (const snap of snapshots) {
      insertSnapshot(db, snap);
    }

    const { report, newAlerts } = scoreAgent(agent, snapshots, 1700005000);

    // Critical signal → risk 100
    expect(report.overallRisk).toBe(100);

    // Should have CRITICAL alert
    expect(newAlerts.length).toBeGreaterThanOrEqual(1);
    expect(newAlerts[0]!.severity).toBe('CRITICAL');

    // Store everything
    insertRiskReport(db, report);
    insertAlerts(db, newAlerts);

    // Read back
    const retrievedReport = getLatestRiskReport(db, 'pipeline-agent');
    expect(retrievedReport!.reportId).toBe(report.reportId);

    const retrievedAlerts = listAlerts(db, { agentId: 'pipeline-agent', activeOnly: true });
    expect(retrievedAlerts.length).toBeGreaterThanOrEqual(1);
  });
});
