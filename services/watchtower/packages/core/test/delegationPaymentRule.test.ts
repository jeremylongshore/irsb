import { describe, it, expect } from 'vitest';
import { Severity, FindingCategory, ActionType } from '../src/finding.js';
import { createDelegationPaymentRule, type DelegationPaymentRuleConfig } from '../src/rules/delegationPaymentRule.js';
import type { ChainContext, ChainEvent } from '../src/rules/rule.js';

const FACILITATOR = '0x1234567890abcdef1234567890abcdef12345678';

/**
 * Create a mock chain context for testing
 */
function createMockContext(options: {
  currentBlock?: bigint;
  events?: ChainEvent[];
}): ChainContext {
  return {
    currentBlock: options.currentBlock ?? 1000000n,
    blockTimestamp: new Date(),
    chainId: 11155111,
    getReceiptsInChallengeWindow: async () => [],
    getActiveDisputes: async () => [],
    getSolverInfo: async () => null,
    getEvents: async () => options.events ?? [],
  };
}

/**
 * Create a mock DelegatedPaymentSettled event
 */
function createSettlementEvent(overrides: {
  delegationHash?: string;
  amount?: bigint;
  address?: string;
  txHash?: string;
  blockNumber?: bigint;
} = {}): ChainEvent {
  return {
    name: 'DelegatedPaymentSettled',
    blockNumber: overrides.blockNumber ?? 999950n,
    txHash: overrides.txHash ?? '0x' + 'a'.repeat(64),
    args: {
      delegationHash: overrides.delegationHash ?? '0x' + '1'.repeat(64),
      amount: overrides.amount ?? 1000n,
      address: overrides.address ?? FACILITATOR,
    },
  };
}

const defaultConfig: DelegationPaymentRuleConfig = {
  maxAutoApproveAmount: 10000n,
  maxSettlementsPerEpoch: 5,
  facilitatorAddress: FACILITATOR,
};

describe('DelegationPaymentRule', () => {
  describe('metadata', () => {
    it('has correct rule metadata', () => {
      const rule = createDelegationPaymentRule(defaultConfig);

      expect(rule.metadata.id).toBe('DELEGATION_PAYMENT');
      expect(rule.metadata.name).toBe('Delegation Payment Monitor');
      expect(rule.metadata.defaultSeverity).toBe(Severity.MEDIUM);
      expect(rule.metadata.category).toBe(FindingCategory.RECEIPT);
      expect(rule.metadata.enabledByDefault).toBe(true);
      expect(rule.metadata.version).toBe('1.0.0');
    });
  });

  describe('large payment detection', () => {
    it('detects payment above threshold', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const event = createSettlementEvent({ amount: 50000n });
      const context = createMockContext({ events: [event] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe(Severity.HIGH);
      expect(findings[0].category).toBe(FindingCategory.RECEIPT);
      expect(findings[0].recommendedAction).toBe(ActionType.MANUAL_REVIEW);
      expect(findings[0].metadata.amount).toBe('50000');
      expect(findings[0].metadata.threshold).toBe('10000');
      expect(findings[0].metadata.eventType).toBe('DelegatedPaymentSettled');
    });

    it('does not flag payment at threshold', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const event = createSettlementEvent({ amount: 10000n });
      const context = createMockContext({ events: [event] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('does not flag payment below threshold', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const event = createSettlementEvent({ amount: 5000n });
      const context = createMockContext({ events: [event] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('includes txHash from event in finding', async () => {
      const txHash = '0x' + 'b'.repeat(64);
      const rule = createDelegationPaymentRule(defaultConfig);
      const event = createSettlementEvent({ amount: 50000n, txHash });
      const context = createMockContext({ events: [event] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].txHash).toBe(txHash);
    });
  });

  describe('high-frequency settlement detection', () => {
    it('detects settlements exceeding max per epoch', async () => {
      const rule = createDelegationPaymentRule({
        ...defaultConfig,
        maxSettlementsPerEpoch: 2,
      });
      const delegationHash = '0x' + 'f'.repeat(64);
      const events = [
        createSettlementEvent({ delegationHash, amount: 100n }),
        createSettlementEvent({ delegationHash, amount: 200n }),
        createSettlementEvent({ delegationHash, amount: 300n }),
      ];
      const context = createMockContext({ events });

      const findings = await rule.evaluate(context);

      // Should have 1 high-frequency finding (no large payment findings since all below threshold)
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe(Severity.MEDIUM);
      expect(findings[0].recommendedAction).toBe(ActionType.NOTIFY);
      expect(findings[0].metadata.settlementCount).toBe(3);
      expect(findings[0].metadata.totalAmount).toBe('600');
    });

    it('does not flag settlements within limit', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const delegationHash = '0x' + 'f'.repeat(64);
      const events = [
        createSettlementEvent({ delegationHash, amount: 100n }),
        createSettlementEvent({ delegationHash, amount: 200n }),
      ];
      const context = createMockContext({ events });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });
  });

  describe('event filtering', () => {
    it('ignores events with wrong name', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const wrongEvent: ChainEvent = {
        name: 'Transfer',
        blockNumber: 999950n,
        txHash: '0x' + 'a'.repeat(64),
        args: {
          delegationHash: '0x' + '1'.repeat(64),
          amount: 99999n,
          address: FACILITATOR,
        },
      };
      const context = createMockContext({ events: [wrongEvent] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('ignores events from wrong contract address', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const wrongAddressEvent = createSettlementEvent({
        amount: 99999n,
        address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      });
      const context = createMockContext({ events: [wrongAddressEvent] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('skips events without delegationHash', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const noHashEvent: ChainEvent = {
        name: 'DelegatedPaymentSettled',
        blockNumber: 999950n,
        txHash: '0x' + 'a'.repeat(64),
        args: {
          amount: 99999n,
          address: FACILITATOR,
        },
      };
      const context = createMockContext({ events: [noHashEvent] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('handles events without amount gracefully', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const noAmountEvent: ChainEvent = {
        name: 'DelegatedPaymentSettled',
        blockNumber: 999950n,
        txHash: '0x' + 'a'.repeat(64),
        args: {
          delegationHash: '0x' + '1'.repeat(64),
          address: FACILITATOR,
        },
      };
      const context = createMockContext({ events: [noAmountEvent] });

      const findings = await rule.evaluate(context);

      // Amount defaults to 0n, which is below threshold - no findings
      expect(findings).toHaveLength(0);
    });
  });

  describe('configurable block window', () => {
    it('uses default block window of 100', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      let capturedFromBlock: bigint | undefined;
      let capturedToBlock: bigint | undefined;

      const context: ChainContext = {
        currentBlock: 1000000n,
        blockTimestamp: new Date(),
        chainId: 11155111,
        getReceiptsInChallengeWindow: async () => [],
        getActiveDisputes: async () => [],
        getSolverInfo: async () => null,
        getEvents: async (fromBlock, toBlock) => {
          capturedFromBlock = fromBlock;
          capturedToBlock = toBlock;
          return [];
        },
      };

      await rule.evaluate(context);

      expect(capturedFromBlock).toBe(999900n);
      expect(capturedToBlock).toBe(1000000n);
    });

    it('uses custom block window when configured', async () => {
      const rule = createDelegationPaymentRule({
        ...defaultConfig,
        blockWindow: 50,
      });
      let capturedFromBlock: bigint | undefined;

      const context: ChainContext = {
        currentBlock: 1000000n,
        blockTimestamp: new Date(),
        chainId: 11155111,
        getReceiptsInChallengeWindow: async () => [],
        getActiveDisputes: async () => [],
        getSolverInfo: async () => null,
        getEvents: async (fromBlock) => {
          capturedFromBlock = fromBlock;
          return [];
        },
      };

      await rule.evaluate(context);

      expect(capturedFromBlock).toBe(999950n);
    });
  });

  describe('no events', () => {
    it('returns no findings when no events', async () => {
      const rule = createDelegationPaymentRule(defaultConfig);
      const context = createMockContext({ events: [] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });
  });
});
