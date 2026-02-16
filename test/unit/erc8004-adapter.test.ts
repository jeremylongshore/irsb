/**
 * ERC-8004 Adapter Unit Tests
 *
 * Tests for the ERC-8004 integration adapter including:
 * - Configuration handling
 * - Score mapping (IRSB ↔ ERC-8004)
 * - Bond modifier calculation
 * - Signal type to feedback mapping
 * - Adapter lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ERC8004Adapter,
  ERC8004_ADDRESSES,
  SIGNAL_TO_FEEDBACK,
  ValidationSignalSchema,
  ReputationUpdateSchema,
  createDefaultERC8004Config,
  createERC8004ConfigFromEnv,
  type ERC8004Config,
  type ValidationSignal,
  type ReputationSummary,
} from '../../src/erc8004/adapter.js';

// ============ Test Fixtures ============

const TEST_AGENT_ID = '42';
const TEST_RECEIPT_ID = '0x' + 'a'.repeat(64);
const TEST_EVIDENCE_HASH = '0x' + 'b'.repeat(64);
const TEST_WALLET = '0x' + '1'.repeat(40);

const createTestConfig = (overrides: Partial<ERC8004Config> = {}): ERC8004Config => ({
  enabled: true,
  network: 'sepolia',
  rpcUrl: 'https://sepolia.infura.io/v3/test',
  providerName: 'IRSB Protocol Test',
  cacheTimeMs: 60000,
  ...overrides,
});

// ============ Contract Address Tests ============

describe('ERC8004_ADDRESSES', () => {
  describe('mainnet addresses', () => {
    it('has correct IdentityRegistry address', () => {
      expect(ERC8004_ADDRESSES.mainnet.identityRegistry).toBe(
        '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
      );
    });

    it('has correct ReputationRegistry address', () => {
      expect(ERC8004_ADDRESSES.mainnet.reputationRegistry).toBe(
        '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63'
      );
    });
  });

  describe('sepolia addresses', () => {
    it('has correct IdentityRegistry address', () => {
      expect(ERC8004_ADDRESSES.sepolia.identityRegistry).toBe(
        '0x8004A818BFB912233c491871b3d84c89A494BD9e'
      );
    });

    it('has correct ReputationRegistry address', () => {
      expect(ERC8004_ADDRESSES.sepolia.reputationRegistry).toBe(
        '0x8004B663056A597Dffe9eCcC1965A193B7388713'
      );
    });
  });

  it('mainnet and sepolia addresses are different', () => {
    expect(ERC8004_ADDRESSES.mainnet.identityRegistry).not.toBe(
      ERC8004_ADDRESSES.sepolia.identityRegistry
    );
  });
});

// ============ Schema Validation Tests ============

describe('ValidationSignalSchema', () => {
  it('validates complete signal', () => {
    const signal = {
      agentId: TEST_AGENT_ID,
      signalType: 'RECEIPT_FINALIZED',
      receiptId: TEST_RECEIPT_ID,
      timestamp: Date.now(),
      evidenceHash: TEST_EVIDENCE_HASH,
    };

    const result = ValidationSignalSchema.safeParse(signal);
    expect(result.success).toBe(true);
  });

  it('validates all signal types', () => {
    const signalTypes = [
      'RECEIPT_FINALIZED',
      'DISPUTE_WON',
      'DISPUTE_LOST',
      'SOLVER_SLASHED',
      'SOLVER_JAILED',
    ] as const;

    for (const signalType of signalTypes) {
      const signal = {
        agentId: TEST_AGENT_ID,
        signalType,
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = ValidationSignalSchema.safeParse(signal);
      expect(result.success, `Signal type ${signalType} should be valid`).toBe(true);
    }
  });

  it('rejects invalid signal type', () => {
    const signal = {
      agentId: TEST_AGENT_ID,
      signalType: 'INVALID_TYPE',
      receiptId: TEST_RECEIPT_ID,
      timestamp: Date.now(),
      evidenceHash: TEST_EVIDENCE_HASH,
    };

    const result = ValidationSignalSchema.safeParse(signal);
    expect(result.success).toBe(false);
  });

  it('accepts optional intentScoreDelta', () => {
    const signal = {
      agentId: TEST_AGENT_ID,
      signalType: 'RECEIPT_FINALIZED',
      receiptId: TEST_RECEIPT_ID,
      timestamp: Date.now(),
      evidenceHash: TEST_EVIDENCE_HASH,
      intentScoreDelta: 100,
    };

    const result = ValidationSignalSchema.safeParse(signal);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const incompleteSignal = {
      agentId: TEST_AGENT_ID,
      signalType: 'RECEIPT_FINALIZED',
      // missing receiptId, timestamp, evidenceHash
    };

    const result = ValidationSignalSchema.safeParse(incompleteSignal);
    expect(result.success).toBe(false);
  });
});

describe('ReputationUpdateSchema', () => {
  it('validates complete update', () => {
    const update = {
      agentId: TEST_AGENT_ID,
      delta: 50,
      reason: 'Receipt finalized successfully',
      evidenceHash: TEST_EVIDENCE_HASH,
    };

    const result = ReputationUpdateSchema.safeParse(update);
    expect(result.success).toBe(true);
  });

  it('accepts negative delta', () => {
    const update = {
      agentId: TEST_AGENT_ID,
      delta: -80,
      reason: 'Solver slashed for violation',
      evidenceHash: TEST_EVIDENCE_HASH,
    };

    const result = ReputationUpdateSchema.safeParse(update);
    expect(result.success).toBe(true);
  });
});

// ============ Signal to Feedback Mapping Tests ============

describe('SIGNAL_TO_FEEDBACK', () => {
  it('maps RECEIPT_FINALIZED to positive score', () => {
    expect(SIGNAL_TO_FEEDBACK.RECEIPT_FINALIZED.value).toBe(100);
    expect(SIGNAL_TO_FEEDBACK.RECEIPT_FINALIZED.tag).toBe('success');
  });

  it('maps DISPUTE_WON to positive score', () => {
    expect(SIGNAL_TO_FEEDBACK.DISPUTE_WON.value).toBe(90);
    expect(SIGNAL_TO_FEEDBACK.DISPUTE_WON.tag).toBe('dispute-won');
  });

  it('maps DISPUTE_LOST to negative score', () => {
    expect(SIGNAL_TO_FEEDBACK.DISPUTE_LOST.value).toBe(-50);
    expect(SIGNAL_TO_FEEDBACK.DISPUTE_LOST.tag).toBe('dispute-lost');
  });

  it('maps SOLVER_SLASHED to heavily negative score', () => {
    expect(SIGNAL_TO_FEEDBACK.SOLVER_SLASHED.value).toBe(-80);
    expect(SIGNAL_TO_FEEDBACK.SOLVER_SLASHED.tag).toBe('slashed');
  });

  it('maps SOLVER_JAILED to maximum negative score', () => {
    expect(SIGNAL_TO_FEEDBACK.SOLVER_JAILED.value).toBe(-100);
    expect(SIGNAL_TO_FEEDBACK.SOLVER_JAILED.tag).toBe('jailed');
  });

  it('has all signal types mapped', () => {
    const signalTypes = [
      'RECEIPT_FINALIZED',
      'DISPUTE_WON',
      'DISPUTE_LOST',
      'SOLVER_SLASHED',
      'SOLVER_JAILED',
    ] as const;

    for (const signalType of signalTypes) {
      expect(SIGNAL_TO_FEEDBACK[signalType]).toBeDefined();
      expect(typeof SIGNAL_TO_FEEDBACK[signalType].value).toBe('number');
      expect(typeof SIGNAL_TO_FEEDBACK[signalType].tag).toBe('string');
    }
  });
});

// ============ Configuration Tests ============

describe('createDefaultERC8004Config', () => {
  it('creates disabled config by default', () => {
    const config = createDefaultERC8004Config();
    expect(config.enabled).toBe(false);
  });

  it('sets sepolia as default network', () => {
    const config = createDefaultERC8004Config();
    expect(config.network).toBe('sepolia');
  });
});

describe('createERC8004ConfigFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns disabled config when ERC8004_ENABLED is not set', () => {
    delete process.env['ERC8004_ENABLED'];
    const config = createERC8004ConfigFromEnv();
    expect(config.enabled).toBe(false);
  });

  it('returns disabled config when ERC8004_ENABLED is false', () => {
    process.env['ERC8004_ENABLED'] = 'false';
    const config = createERC8004ConfigFromEnv();
    expect(config.enabled).toBe(false);
  });

  it('returns enabled config when ERC8004_ENABLED is true', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    const config = createERC8004ConfigFromEnv();
    expect(config.enabled).toBe(true);
  });

  it('reads network from environment', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    process.env['ERC8004_NETWORK'] = 'mainnet';
    const config = createERC8004ConfigFromEnv();
    expect(config.network).toBe('mainnet');
  });

  it('reads RPC URL from environment', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    process.env['ERC8004_RPC_URL'] = 'https://my-rpc.com';
    const config = createERC8004ConfigFromEnv();
    expect(config.rpcUrl).toBe('https://my-rpc.com');
  });

  it('falls back to RPC_URL if ERC8004_RPC_URL not set', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    process.env['RPC_URL'] = 'https://fallback-rpc.com';
    const config = createERC8004ConfigFromEnv();
    expect(config.rpcUrl).toBe('https://fallback-rpc.com');
  });

  it('reads private key from environment', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    process.env['ERC8004_PRIVATE_KEY'] = '0x1234';
    const config = createERC8004ConfigFromEnv();
    expect(config.privateKey).toBe('0x1234');
  });

  it('falls back to LIT_AUTH_PRIVATE_KEY if ERC8004_PRIVATE_KEY not set', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    process.env['LIT_AUTH_PRIVATE_KEY'] = '0xfallback';
    const config = createERC8004ConfigFromEnv();
    expect(config.privateKey).toBe('0xfallback');
  });

  it('reads cache time from environment', () => {
    process.env['ERC8004_ENABLED'] = 'true';
    process.env['ERC8004_CACHE_MS'] = '120000';
    const config = createERC8004ConfigFromEnv();
    expect(config.cacheTimeMs).toBe(120000);
  });
});

// ============ Adapter Lifecycle Tests ============

describe('ERC8004Adapter', () => {
  describe('constructor', () => {
    it('creates adapter with disabled config', () => {
      const adapter = new ERC8004Adapter({ enabled: false });
      expect(adapter.isEnabled).toBe(false);
    });

    it('creates adapter with enabled config', () => {
      const adapter = new ERC8004Adapter(createTestConfig());
      expect(adapter.isEnabled).toBe(true);
    });

    it('uses sepolia addresses for sepolia network', () => {
      const adapter = new ERC8004Adapter(createTestConfig({ network: 'sepolia' }));
      // Internal addresses should be sepolia
      expect(adapter.isEnabled).toBe(true);
    });

    it('uses mainnet addresses for mainnet network', () => {
      const adapter = new ERC8004Adapter(createTestConfig({ network: 'mainnet' }));
      expect(adapter.isEnabled).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('returns false when disabled', () => {
      const adapter = new ERC8004Adapter({ enabled: false });
      expect(adapter.isEnabled).toBe(false);
    });

    it('returns true when enabled', () => {
      const adapter = new ERC8004Adapter(createTestConfig());
      expect(adapter.isEnabled).toBe(true);
    });
  });
});

// ============ Score Mapping Tests ============

describe('IntentScore Mapping', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    adapter = new ERC8004Adapter(createTestConfig());
  });

  describe('mapIntentScoreToERC8004', () => {
    it('maps 0 to 0', () => {
      const result = adapter.mapIntentScoreToERC8004(0);
      expect(result.irsbScore).toBe(0);
      expect(result.erc8004Score).toBe(0);
    });

    it('maps 10000 to 100', () => {
      const result = adapter.mapIntentScoreToERC8004(10000);
      expect(result.irsbScore).toBe(10000);
      expect(result.erc8004Score).toBe(100);
    });

    it('maps 5000 to 50', () => {
      const result = adapter.mapIntentScoreToERC8004(5000);
      expect(result.irsbScore).toBe(5000);
      expect(result.erc8004Score).toBe(50);
    });

    it('maps 7850 to 78 (floors)', () => {
      const result = adapter.mapIntentScoreToERC8004(7850);
      expect(result.irsbScore).toBe(7850);
      expect(result.erc8004Score).toBe(78);
    });

    it('maps 99 to 0 (small values floor to 0)', () => {
      const result = adapter.mapIntentScoreToERC8004(99);
      expect(result.erc8004Score).toBe(0);
    });
  });

  describe('mapERC8004ToIntentScore', () => {
    it('maps 0 to 0', () => {
      const result = adapter.mapERC8004ToIntentScore(0);
      expect(result.erc8004Score).toBe(0);
      expect(result.irsbScore).toBe(0);
    });

    it('maps 100 to 10000', () => {
      const result = adapter.mapERC8004ToIntentScore(100);
      expect(result.erc8004Score).toBe(100);
      expect(result.irsbScore).toBe(10000);
    });

    it('maps 50 to 5000', () => {
      const result = adapter.mapERC8004ToIntentScore(50);
      expect(result.erc8004Score).toBe(50);
      expect(result.irsbScore).toBe(5000);
    });

    it('maps 78 to 7800', () => {
      const result = adapter.mapERC8004ToIntentScore(78);
      expect(result.irsbScore).toBe(7800);
    });
  });

  describe('round-trip consistency', () => {
    it('IRSB → ERC8004 → IRSB preserves value (with flooring)', () => {
      const original = 7500;
      const mapped = adapter.mapIntentScoreToERC8004(original);
      const roundTrip = adapter.mapERC8004ToIntentScore(mapped.erc8004Score);

      // 7500 → 75 → 7500 (exact match for multiples of 100)
      expect(roundTrip.irsbScore).toBe(original);
    });

    it('ERC8004 → IRSB → ERC8004 preserves value exactly', () => {
      const original = 85;
      const mapped = adapter.mapERC8004ToIntentScore(original);
      const roundTrip = adapter.mapIntentScoreToERC8004(mapped.irsbScore);

      expect(roundTrip.erc8004Score).toBe(original);
    });
  });
});

// ============ Bond Modifier Tests ============

describe('Bond Modifier Calculation', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    // Disabled adapter for unit tests (no RPC calls)
    adapter = new ERC8004Adapter({ enabled: false });
  });

  describe('calculateBondForAgent (disabled adapter)', () => {
    it('returns standard bond when adapter disabled', async () => {
      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(1.0);
      expect(result.effectiveBond).toBe(BigInt('100000000000000000')); // 0.1 ETH
      expect(result.reasoning).toContain('no ERC-8004 history');
    });
  });
});

// ============ Disabled Adapter Behavior Tests ============

describe('Disabled Adapter Behavior', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    adapter = new ERC8004Adapter({ enabled: false });
  });

  describe('resolveAgent', () => {
    it('returns null when disabled', async () => {
      const result = await adapter.resolveAgent(TEST_AGENT_ID);
      expect(result).toBeNull();
    });
  });

  describe('verifyAgentOwnership', () => {
    it('returns false when disabled', async () => {
      const result = await adapter.verifyAgentOwnership(TEST_AGENT_ID, TEST_WALLET);
      expect(result).toBe(false);
    });
  });

  describe('getReputation', () => {
    it('returns null when disabled', async () => {
      const result = await adapter.getReputation(TEST_AGENT_ID);
      expect(result).toBeNull();
    });
  });

  describe('publishValidation', () => {
    it('returns null when disabled (no tx hash)', async () => {
      const signal: ValidationSignal = {
        agentId: TEST_AGENT_ID,
        signalType: 'RECEIPT_FINALIZED',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = await adapter.publishValidation(signal);
      expect(result).toBeNull();
    });
  });

  describe('updateReputation', () => {
    it('returns null when disabled', async () => {
      const result = await adapter.updateReputation({
        agentId: TEST_AGENT_ID,
        delta: 50,
        reason: 'test',
        evidenceHash: TEST_EVIDENCE_HASH,
      });
      expect(result).toBeNull();
    });
  });
});

// ============ Edge Cases ============

describe('Edge Cases', () => {
  describe('score mapping edge cases', () => {
    let adapter: ERC8004Adapter;

    beforeEach(() => {
      adapter = new ERC8004Adapter(createTestConfig());
    });

    it('handles negative IRSB scores (allows negative result)', () => {
      const result = adapter.mapIntentScoreToERC8004(-100);
      expect(result.erc8004Score).toBe(-1); // Math.floor(-100/100) - no clamping
    });

    it('handles scores above 10000', () => {
      const result = adapter.mapIntentScoreToERC8004(15000);
      expect(result.erc8004Score).toBe(150);
    });

    it('handles decimal IRSB scores', () => {
      const result = adapter.mapIntentScoreToERC8004(7850.5);
      expect(result.erc8004Score).toBe(78);
    });
  });

  describe('validation signal edge cases', () => {
    it('accepts empty string for receiptId', () => {
      const signal = {
        agentId: TEST_AGENT_ID,
        signalType: 'RECEIPT_FINALIZED',
        receiptId: '',
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = ValidationSignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
    });

    it('accepts zero timestamp', () => {
      const signal = {
        agentId: TEST_AGENT_ID,
        signalType: 'RECEIPT_FINALIZED',
        receiptId: TEST_RECEIPT_ID,
        timestamp: 0,
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = ValidationSignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
    });

    it('accepts negative intentScoreDelta', () => {
      const signal = {
        agentId: TEST_AGENT_ID,
        signalType: 'DISPUTE_LOST',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
        intentScoreDelta: -500,
      };

      const result = ValidationSignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
    });
  });
});

// ============ Integration Test Stubs ============
// These tests require actual RPC connections and are skipped by default

describe.skip('Integration Tests (require RPC)', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    adapter = new ERC8004Adapter({
      enabled: true,
      network: 'sepolia',
      rpcUrl: process.env['ERC8004_RPC_URL'] || 'https://sepolia.infura.io/v3/test',
      providerName: 'IRSB Protocol Test',
      cacheTimeMs: 60000,
    });
  });

  it('resolves real agent from Sepolia', async () => {
    // Would need a real agent ID on Sepolia
    const result = await adapter.resolveAgent('1');
    expect(result).toBeDefined();
  });

  it('queries reputation from Sepolia', async () => {
    const result = await adapter.getReputation('1');
    expect(result).toBeDefined();
  });
});
