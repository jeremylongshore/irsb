import { describe, it, expect } from 'vitest';
import { scoreAgent } from '../src/scoring/scoreAgent.js';
import { canonicalJson, sha256Hex } from '../src/utils/canonical.js';
import { sortSignals, sortEvidence } from '../src/utils/sort.js';
import type { Agent, Snapshot, Signal } from '../src/schemas/index.js';

const agent: Agent = { agentId: 'agent-det-001' };

function makeSignal(overrides: Partial<Signal> & { signalId: string; severity: Signal['severity'] }): Signal {
  return {
    weight: 0.8,
    observedAt: 1700000000,
    evidence: [{ type: 'tx', ref: '0xabc' }],
    ...overrides,
  };
}

const snapshots: Snapshot[] = [
  {
    snapshotId: 'snap-a',
    agentId: 'agent-det-001',
    observedAt: 1700000000,
    signals: [
      makeSignal({ signalId: 'sig-001', severity: 'HIGH' }),
      makeSignal({ signalId: 'sig-002', severity: 'MEDIUM', weight: 0.5 }),
    ],
  },
  {
    snapshotId: 'snap-b',
    agentId: 'agent-det-001',
    observedAt: 1700001000,
    signals: [
      makeSignal({ signalId: 'sig-003', severity: 'LOW', weight: 0.3 }),
    ],
  },
];

describe('Scoring Determinism', () => {
  it('should produce same reportId for identical input', () => {
    const ts = 1700002000;
    const result1 = scoreAgent(agent, snapshots, ts);
    const result2 = scoreAgent(agent, snapshots, ts);
    expect(result1.report.reportId).toBe(result2.report.reportId);
  });

  it('should produce same reportId regardless of generatedAt', () => {
    const result1 = scoreAgent(agent, snapshots, 1700002000);
    const result2 = scoreAgent(agent, snapshots, 9999999999);
    expect(result1.report.reportId).toBe(result2.report.reportId);
  });

  it('should produce same alertId for same CRITICAL conditions', () => {
    const critAgent: Agent = { agentId: 'agent-crit-001' };
    const critSnapshots: Snapshot[] = [
      {
        snapshotId: 'snap-crit',
        agentId: 'agent-crit-001',
        observedAt: 1700000000,
        signals: [makeSignal({ signalId: 'sig-crit', severity: 'CRITICAL' })],
      },
    ];

    const result1 = scoreAgent(critAgent, critSnapshots, 1700002000);
    const result2 = scoreAgent(critAgent, critSnapshots, 9999999999);

    expect(result1.newAlerts).toHaveLength(1);
    expect(result2.newAlerts).toHaveLength(1);
    expect(result1.newAlerts[0]!.alertId).toBe(result2.newAlerts[0]!.alertId);
  });

  it('should set overallRisk to 100 when CRITICAL signal present', () => {
    const critSnapshots: Snapshot[] = [
      {
        snapshotId: 'snap-crit-2',
        agentId: 'agent-det-001',
        observedAt: 1700000000,
        signals: [makeSignal({ signalId: 'sig-crit', severity: 'CRITICAL', weight: 0.1 })],
      },
    ];

    const { report } = scoreAgent(agent, critSnapshots, 1700000000);
    expect(report.overallRisk).toBe(100);
  });
});

describe('canonicalJson', () => {
  it('should produce stable output regardless of key insertion order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('should handle nested objects', () => {
    const a = { outer: { z: 1, a: 2 }, x: 'hello' };
    const b = { x: 'hello', outer: { a: 2, z: 1 } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('should handle arrays', () => {
    const val = { arr: [3, 1, 2] };
    // Arrays should preserve order (not sort)
    expect(canonicalJson(val)).toBe('{"arr":[3,1,2]}');
  });

  it('should produce compact JSON with no spaces', () => {
    const val = { a: 1, b: 'hello' };
    const result = canonicalJson(val);
    expect(result).not.toContain(' ');
  });

  it('should handle null and undefined', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBeUndefined();
  });
});

describe('sha256Hex', () => {
  it('should produce consistent hashes', () => {
    const hash1 = sha256Hex('hello world');
    const hash2 = sha256Hex('hello world');
    expect(hash1).toBe(hash2);
  });

  it('should produce 64-char hex string', () => {
    const hash = sha256Hex('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

describe('sortSignals', () => {
  it('should sort by severity desc then signalId asc', () => {
    const signals = [
      { signalId: 'b', severity: 'LOW' as const },
      { signalId: 'a', severity: 'CRITICAL' as const },
      { signalId: 'c', severity: 'HIGH' as const },
      { signalId: 'a', severity: 'HIGH' as const },
    ];
    const sorted = sortSignals(signals);
    expect(sorted.map((s) => s.signalId)).toEqual(['a', 'a', 'c', 'b']);
    expect(sorted.map((s) => s.severity)).toEqual(['CRITICAL', 'HIGH', 'HIGH', 'LOW']);
  });
});

describe('sortEvidence', () => {
  it('should sort by type asc then ref asc', () => {
    const evidence = [
      { type: 'tx', ref: '0xdef' },
      { type: 'log', ref: 'z-log' },
      { type: 'log', ref: 'a-log' },
      { type: 'tx', ref: '0xabc' },
    ];
    const sorted = sortEvidence(evidence);
    expect(sorted).toEqual([
      { type: 'log', ref: 'a-log' },
      { type: 'log', ref: 'z-log' },
      { type: 'tx', ref: '0xabc' },
      { type: 'tx', ref: '0xdef' },
    ]);
  });
});

describe('Snapshot ID determinism', () => {
  it('should produce same snapshotId for same content', () => {
    const payload = {
      agentId: 'agent-001',
      observedAt: 1700000000,
      signals: [makeSignal({ signalId: 'sig-001', severity: 'HIGH' })],
    };
    const id1 = sha256Hex(canonicalJson(payload));
    const id2 = sha256Hex(canonicalJson(payload));
    expect(id1).toBe(id2);
  });
});
