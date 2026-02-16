import { describe, it, expect } from 'vitest';
import {
  AgentSchema,
  SignalSchema,
  SnapshotSchema,
  RiskReportSchema,
  AlertSchema,
  EvidenceLinkSchema,
} from '../src/schemas/index.js';

describe('AgentSchema', () => {
  it('should parse a valid agent', () => {
    const valid = { agentId: 'agent-001', status: 'ACTIVE', labels: ['solver'] };
    const result = AgentSchema.parse(valid);
    expect(result.agentId).toBe('agent-001');
    expect(result.status).toBe('ACTIVE');
  });

  it('should parse agent with only required fields', () => {
    const minimal = { agentId: 'agent-002' };
    const result = AgentSchema.parse(minimal);
    expect(result.agentId).toBe('agent-002');
    expect(result.status).toBeUndefined();
  });

  it('should reject empty agentId', () => {
    expect(() => AgentSchema.parse({ agentId: '' })).toThrow();
  });

  it('should reject invalid status', () => {
    expect(() => AgentSchema.parse({ agentId: 'a', status: 'INVALID' })).toThrow();
  });
});

describe('SignalSchema', () => {
  it('should parse a valid signal', () => {
    const valid = {
      signalId: 'sig-001',
      severity: 'HIGH',
      weight: 0.8,
      observedAt: 1700000000,
      evidence: [{ type: 'tx', ref: '0xabc' }],
    };
    const result = SignalSchema.parse(valid);
    expect(result.severity).toBe('HIGH');
    expect(result.weight).toBe(0.8);
  });

  it('should reject weight > 1', () => {
    expect(() =>
      SignalSchema.parse({
        signalId: 's1',
        severity: 'LOW',
        weight: 1.5,
        observedAt: 1700000000,
        evidence: [],
      }),
    ).toThrow();
  });

  it('should reject weight < 0', () => {
    expect(() =>
      SignalSchema.parse({
        signalId: 's1',
        severity: 'LOW',
        weight: -0.1,
        observedAt: 1700000000,
        evidence: [],
      }),
    ).toThrow();
  });

  it('should reject invalid severity', () => {
    expect(() =>
      SignalSchema.parse({
        signalId: 's1',
        severity: 'EXTREME',
        weight: 0.5,
        observedAt: 1700000000,
        evidence: [],
      }),
    ).toThrow();
  });

  it('should accept optional details', () => {
    const valid = {
      signalId: 'sig-002',
      severity: 'MEDIUM',
      weight: 0.5,
      observedAt: 1700000000,
      evidence: [],
      details: { foo: 'bar', nested: { x: 1 } },
    };
    const result = SignalSchema.parse(valid);
    expect(result.details).toEqual({ foo: 'bar', nested: { x: 1 } });
  });
});

describe('SnapshotSchema', () => {
  it('should parse a valid snapshot', () => {
    const valid = {
      snapshotId: 'snap-001',
      agentId: 'agent-001',
      observedAt: 1700000000,
      signals: [
        {
          signalId: 'sig-001',
          severity: 'LOW',
          weight: 0.5,
          observedAt: 1700000000,
          evidence: [],
        },
      ],
    };
    const result = SnapshotSchema.parse(valid);
    expect(result.signals).toHaveLength(1);
  });

  it('should reject missing agentId', () => {
    expect(() =>
      SnapshotSchema.parse({
        snapshotId: 'snap-001',
        observedAt: 1700000000,
        signals: [],
      }),
    ).toThrow();
  });
});

describe('RiskReportSchema', () => {
  it('should parse a valid risk report', () => {
    const valid = {
      reportVersion: '0.1.0',
      reportId: 'abc123',
      agentId: 'agent-001',
      generatedAt: 1700000000,
      overallRisk: 75,
      confidence: 'MEDIUM',
      reasons: ['HIGH signal: sig-001'],
      evidenceLinks: [{ type: 'tx', ref: '0xabc' }],
      signals: [{ signalId: 'sig-001', severity: 'HIGH' }],
    };
    const result = RiskReportSchema.parse(valid);
    expect(result.overallRisk).toBe(75);
  });

  it('should reject overallRisk > 100', () => {
    expect(() =>
      RiskReportSchema.parse({
        reportVersion: '0.1.0',
        reportId: 'abc123',
        agentId: 'agent-001',
        generatedAt: 1700000000,
        overallRisk: 150,
        confidence: 'HIGH',
        reasons: [],
        evidenceLinks: [],
        signals: [],
      }),
    ).toThrow();
  });

  it('should reject overallRisk < 0', () => {
    expect(() =>
      RiskReportSchema.parse({
        reportVersion: '0.1.0',
        reportId: 'abc123',
        agentId: 'agent-001',
        generatedAt: 1700000000,
        overallRisk: -5,
        confidence: 'HIGH',
        reasons: [],
        evidenceLinks: [],
        signals: [],
      }),
    ).toThrow();
  });

  it('should reject wrong reportVersion', () => {
    expect(() =>
      RiskReportSchema.parse({
        reportVersion: '0.2.0',
        reportId: 'abc123',
        agentId: 'agent-001',
        generatedAt: 1700000000,
        overallRisk: 50,
        confidence: 'LOW',
        reasons: [],
        evidenceLinks: [],
        signals: [],
      }),
    ).toThrow();
  });
});

describe('AlertSchema', () => {
  it('should parse a valid alert', () => {
    const valid = {
      alertId: 'alert-001',
      agentId: 'agent-001',
      type: 'CRITICAL_SIGNAL_DETECTED',
      severity: 'CRITICAL',
      description: 'Critical signal found',
      evidenceLinks: [{ type: 'tx', ref: '0xdef' }],
      createdAt: 1700000000,
      isActive: true,
    };
    const result = AlertSchema.parse(valid);
    expect(result.isActive).toBe(true);
  });

  it('should reject missing type', () => {
    expect(() =>
      AlertSchema.parse({
        alertId: 'alert-001',
        agentId: 'agent-001',
        severity: 'HIGH',
        description: 'test',
        evidenceLinks: [],
        createdAt: 1700000000,
        isActive: false,
      }),
    ).toThrow();
  });
});

describe('EvidenceLinkSchema', () => {
  it('should parse valid evidence', () => {
    const result = EvidenceLinkSchema.parse({ type: 'tx', ref: '0x123' });
    expect(result.type).toBe('tx');
  });
});
