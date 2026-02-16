import { describe, it, expect, beforeEach } from 'vitest';
import {
  RuleEngine,
  RuleRegistry,
  MockAlwaysFindRule,
  SampleRule,
  type ChainContext,
  Severity,
  FindingCategory,
  ActionType,
  createFinding,
  type Rule,
  type RuleMetadata,
  type Finding,
} from '../src/index.js';

/**
 * Create a mock chain context for testing
 */
function createMockContext(overrides: Partial<ChainContext> = {}): ChainContext {
  return {
    currentBlock: 1000000n,
    blockTimestamp: new Date(),
    chainId: 11155111,
    getReceiptsInChallengeWindow: async () => [],
    getActiveDisputes: async () => [],
    getSolverInfo: async () => null,
    getEvents: async () => [],
    ...overrides,
  };
}

/**
 * Rule that throws an error for testing
 */
class ErrorRule implements Rule {
  metadata: RuleMetadata = {
    id: 'ERROR-RULE',
    name: 'Error Rule',
    description: 'Always throws an error',
    defaultSeverity: Severity.HIGH,
    category: FindingCategory.SYSTEM,
    enabledByDefault: true,
    version: '1.0.0',
  };

  async evaluate(): Promise<Finding[]> {
    throw new Error('Intentional error for testing');
  }
}

/**
 * Rule that times out for testing
 */
class SlowRule implements Rule {
  metadata: RuleMetadata = {
    id: 'SLOW-RULE',
    name: 'Slow Rule',
    description: 'Takes a long time to evaluate',
    defaultSeverity: Severity.LOW,
    category: FindingCategory.SYSTEM,
    enabledByDefault: true,
    version: '1.0.0',
  };

  async evaluate(): Promise<Finding[]> {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return [];
  }
}

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  it('registers and retrieves rules', () => {
    const rule = new MockAlwaysFindRule();
    registry.register(rule);

    expect(registry.has(rule.metadata.id)).toBe(true);
    expect(registry.get(rule.metadata.id)).toBe(rule);
  });

  it('throws on duplicate registration', () => {
    const rule = new MockAlwaysFindRule();
    registry.register(rule);

    expect(() => registry.register(rule)).toThrow('already registered');
  });

  it('returns all rules', () => {
    registry.register(new MockAlwaysFindRule());
    registry.register(new SampleRule());

    expect(registry.getAll()).toHaveLength(2);
  });

  it('returns only enabled rules', () => {
    registry.register(new MockAlwaysFindRule()); // enabledByDefault: false
    registry.register(new SampleRule()); // enabledByDefault: true

    const enabled = registry.getEnabled();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].metadata.id).toBe('SAMPLE-001');
  });
});

describe('RuleEngine', () => {
  let engine: RuleEngine;
  let context: ChainContext;

  beforeEach(() => {
    const registry = new RuleRegistry();
    registry.register(new MockAlwaysFindRule());
    registry.register(new SampleRule());
    engine = new RuleEngine(registry);
    context = createMockContext();
  });

  it('executes all enabled rules by default', async () => {
    const result = await engine.execute(context);

    // Only SampleRule is enabled by default
    expect(result.rulesExecuted).toBe(1);
    expect(result.rulesFailed).toBe(0);
  });

  it('executes specific rules when ruleIds provided', async () => {
    const result = await engine.execute(context, {
      ruleIds: ['MOCK-ALWAYS-FIND'],
    });

    expect(result.rulesExecuted).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe('MOCK-ALWAYS-FIND');
  });

  it('continues on error by default', async () => {
    engine.addRule(new ErrorRule());

    // Set ERROR-RULE to enabled for this test
    const errorRule = engine.getRegistry().get('ERROR-RULE');
    if (errorRule) {
      errorRule.metadata.enabledByDefault = true;
    }

    const result = await engine.execute(context);

    expect(result.rulesFailed).toBe(1);
    expect(result.rulesExecuted).toBeGreaterThan(1);
  });

  it('stops on error when stopOnError=true', async () => {
    const registry = new RuleRegistry();
    registry.register(new ErrorRule());
    registry.register(new MockAlwaysFindRule());

    const errorRule = registry.get('ERROR-RULE');
    const mockRule = registry.get('MOCK-ALWAYS-FIND');
    if (errorRule) errorRule.metadata.enabledByDefault = true;
    if (mockRule) mockRule.metadata.enabledByDefault = true;

    const eng = new RuleEngine(registry);
    const result = await eng.execute(context, { stopOnError: true });

    expect(result.rulesFailed).toBe(1);
    expect(result.rulesExecuted).toBe(1);
  });

  it('handles rule timeout', async () => {
    const registry = new RuleRegistry();
    registry.register(new SlowRule());

    const slowRule = registry.get('SLOW-RULE');
    if (slowRule) slowRule.metadata.enabledByDefault = true;

    const eng = new RuleEngine(registry);
    const result = await eng.execute(context, { ruleTimeoutMs: 100 });

    expect(result.rulesFailed).toBe(1);
    expect(result.ruleResults[0].error?.message).toContain('timed out');
  });

  it('tracks timing metrics', async () => {
    const result = await engine.execute(context, {
      ruleIds: ['MOCK-ALWAYS-FIND'],
    });

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.ruleResults[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Finding creation', () => {
  it('creates a finding with all fields', () => {
    const finding = createFinding({
      ruleId: 'TEST-001',
      title: 'Test finding',
      description: 'A test finding',
      severity: Severity.HIGH,
      category: FindingCategory.RECEIPT,
      blockNumber: 12345n,
      txHash: '0x123',
      solverId: 'solver-1',
      receiptId: 'receipt-1',
      recommendedAction: ActionType.OPEN_DISPUTE,
      metadata: { custom: 'data' },
    });

    expect(finding.ruleId).toBe('TEST-001');
    expect(finding.severity).toBe(Severity.HIGH);
    expect(finding.blockNumber).toBe(12345n);
    expect(finding.metadata.custom).toBe('data');
    expect(finding.actedUpon).toBe(false);
  });

  it('generates unique IDs', () => {
    const f1 = createFinding({
      ruleId: 'TEST',
      title: 'Test',
      description: 'Test',
      severity: Severity.LOW,
      category: FindingCategory.SYSTEM,
      blockNumber: 1n,
    });

    const f2 = createFinding({
      ruleId: 'TEST',
      title: 'Test',
      description: 'Test',
      severity: Severity.LOW,
      category: FindingCategory.SYSTEM,
      blockNumber: 1n,
    });

    expect(f1.id).not.toBe(f2.id);
  });
});
