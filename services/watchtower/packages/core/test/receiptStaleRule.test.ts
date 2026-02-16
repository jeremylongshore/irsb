import { describe, it, expect } from 'vitest';
import { Severity, FindingCategory, ActionType } from '../src/finding.js';
import { createReceiptStaleRule, type ReceiptStaleRuleConfig } from '../src/rules/receiptStaleRule.js';
import type { ChainContext, ReceiptInfo, DisputeInfo } from '../src/rules/rule.js';

/**
 * Create a mock chain context for testing
 */
function createMockContext(options: {
  currentBlock?: bigint;
  blockTimestamp?: Date;
  receipts?: ReceiptInfo[];
  disputes?: DisputeInfo[];
}): ChainContext {
  return {
    currentBlock: options.currentBlock ?? 1000000n,
    blockTimestamp: options.blockTimestamp ?? new Date(),
    chainId: 11155111,
    getReceiptsInChallengeWindow: async () => options.receipts ?? [],
    getActiveDisputes: async () => options.disputes ?? [],
    getSolverInfo: async () => null,
    getEvents: async () => [],
  };
}

/**
 * Create a mock receipt for testing
 */
function createMockReceipt(overrides: Partial<ReceiptInfo> = {}): ReceiptInfo {
  const now = Date.now();
  return {
    id: '0x' + '1'.repeat(64),
    intentHash: '0x' + '2'.repeat(64),
    solverId: '0x' + '3'.repeat(64),
    createdAt: new Date(now - 90 * 60 * 1000), // 90 min ago
    expiry: new Date(now + 24 * 60 * 60 * 1000), // 24h from now
    status: 'pending',
    challengeDeadline: new Date(now - 30 * 60 * 1000), // 30 min ago (stale!)
    blockNumber: 999900n,
    txHash: '0x' + '4'.repeat(64),
    ...overrides,
  };
}

const defaultConfig: ReceiptStaleRuleConfig = {
  challengeWindowSeconds: 3600, // 1 hour
  minReceiptAgeSeconds: 60, // 1 minute
  allowlistSolverIds: [],
  allowlistReceiptIds: [],
  blockConfirmations: 6,
};

describe('ReceiptStaleRule', () => {
  describe('metadata', () => {
    it('has correct rule metadata', () => {
      const rule = createReceiptStaleRule(defaultConfig);

      expect(rule.metadata.id).toBe('RECEIPT_STALE');
      expect(rule.metadata.name).toBe('Receipt Stale Detection');
      expect(rule.metadata.defaultSeverity).toBe(Severity.HIGH);
      expect(rule.metadata.category).toBe(FindingCategory.RECEIPT);
      expect(rule.metadata.enabledByDefault).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('returns no findings when no receipts', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const context = createMockContext({ receipts: [] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('detects stale receipt past challenge deadline', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const staleReceipt = createMockReceipt();
      const context = createMockContext({ receipts: [staleReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe(Severity.HIGH);
      expect(findings[0].category).toBe(FindingCategory.RECEIPT);
      expect(findings[0].recommendedAction).toBe(ActionType.OPEN_DISPUTE);
      expect(findings[0].receiptId).toBe(staleReceipt.id);
      expect(findings[0].solverId).toBe(staleReceipt.solverId);
    });

    it('skips receipt not yet past deadline', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const now = Date.now();
      const futureReceipt = createMockReceipt({
        challengeDeadline: new Date(now + 30 * 60 * 1000), // 30 min in future
      });
      const context = createMockContext({ receipts: [futureReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('skips finalized receipt', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const finalizedReceipt = createMockReceipt({ status: 'finalized' });
      const context = createMockContext({ receipts: [finalizedReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('skips already challenged receipt', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const challengedReceipt = createMockReceipt({ status: 'challenged' });
      const context = createMockContext({ receipts: [challengedReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('skips already disputed receipt', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const disputedReceipt = createMockReceipt({ status: 'disputed' });
      const context = createMockContext({ receipts: [disputedReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('skips receipt with existing dispute', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const receipt = createMockReceipt();
      const dispute: DisputeInfo = {
        id: '0x' + '5'.repeat(64),
        receiptId: receipt.id, // Same receipt
        challenger: '0x' + 'a'.repeat(40),
        reason: 'TIMEOUT',
        status: 'open',
        openedAt: new Date(),
        deadline: new Date(Date.now() + 60 * 60 * 1000),
        blockNumber: 1000000n,
      };
      const context = createMockContext({
        receipts: [receipt],
        disputes: [dispute],
      });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('respects minReceiptAgeSeconds', async () => {
      const rule = createReceiptStaleRule({
        ...defaultConfig,
        minReceiptAgeSeconds: 3600, // 1 hour
      });
      const now = Date.now();
      // Receipt only 5 minutes past deadline
      const youngReceipt = createMockReceipt({
        challengeDeadline: new Date(now - 5 * 60 * 1000), // 5 min ago
      });
      const context = createMockContext({ receipts: [youngReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(0);
    });

    it('accepts receipt old enough per minReceiptAgeSeconds', async () => {
      const rule = createReceiptStaleRule({
        ...defaultConfig,
        minReceiptAgeSeconds: 60, // 1 minute
      });
      const now = Date.now();
      // Receipt 30 minutes past deadline (well over 1 min)
      const oldReceipt = createMockReceipt({
        challengeDeadline: new Date(now - 30 * 60 * 1000), // 30 min ago
      });
      const context = createMockContext({ receipts: [oldReceipt] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(1);
    });
  });

  describe('allowlists', () => {
    it('filters by solver ID allowlist', async () => {
      // Allowlist uses exact match - must use full lowercased ID
      const allowedSolverId = '0x' + '1111'.padEnd(64, '0');
      const rule = createReceiptStaleRule({
        ...defaultConfig,
        allowlistSolverIds: [allowedSolverId],
      });
      const receipt1 = createMockReceipt({
        id: '0x' + 'a'.repeat(64),
        solverId: allowedSolverId,
      });
      const receipt2 = createMockReceipt({
        id: '0x' + 'b'.repeat(64),
        solverId: '0x' + '2222'.padEnd(64, '0'),
      });
      const context = createMockContext({ receipts: [receipt1, receipt2] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].receiptId).toBe(receipt1.id);
    });

    it('filters by receipt ID allowlist', async () => {
      // Allowlist uses exact match - must use full lowercased ID
      const allowedReceiptId = '0x' + 'aaaa'.padEnd(64, '0');
      const rule = createReceiptStaleRule({
        ...defaultConfig,
        allowlistReceiptIds: [allowedReceiptId],
      });
      const receipt1 = createMockReceipt({
        id: allowedReceiptId,
      });
      const receipt2 = createMockReceipt({
        id: '0x' + 'bbbb'.padEnd(64, '0'),
      });
      const context = createMockContext({ receipts: [receipt1, receipt2] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].receiptId).toBe(receipt1.id);
    });

    it('passes all when allowlists are empty', async () => {
      const rule = createReceiptStaleRule({
        ...defaultConfig,
        allowlistSolverIds: [],
        allowlistReceiptIds: [],
      });
      const receipt1 = createMockReceipt({ id: '0x' + 'a'.repeat(64) });
      const receipt2 = createMockReceipt({ id: '0x' + 'b'.repeat(64) });
      const context = createMockContext({ receipts: [receipt1, receipt2] });

      const findings = await rule.evaluate(context);

      expect(findings).toHaveLength(2);
    });
  });

  describe('finding details', () => {
    it('includes correct metadata in finding', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const receipt = createMockReceipt();
      const context = createMockContext({ receipts: [receipt] });

      const findings = await rule.evaluate(context);

      expect(findings[0].metadata.challengeDeadline).toBeDefined();
      expect(findings[0].metadata.ageSeconds).toBeGreaterThan(0);
      expect(findings[0].metadata.intentHash).toBe(receipt.intentHash);
      expect(findings[0].metadata.receiptStatus).toBe('pending');
    });

    it('generates human-readable description', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const receipt = createMockReceipt();
      const context = createMockContext({ receipts: [receipt] });

      const findings = await rule.evaluate(context);

      expect(findings[0].description).toContain('Receipt');
      expect(findings[0].description).toContain('solver');
      expect(findings[0].description).toContain('challenge deadline');
      expect(findings[0].description).toContain('opening a dispute');
    });

    it('truncates long IDs in title', async () => {
      const rule = createReceiptStaleRule(defaultConfig);
      const receipt = createMockReceipt({
        id: '0x' + '1'.repeat(64), // 66 chars total
      });
      const context = createMockContext({ receipts: [receipt] });

      const findings = await rule.evaluate(context);

      // Title should have truncated ID
      expect(findings[0].title).toContain('...');
      expect(findings[0].title.length).toBeLessThan(100);
    });
  });
});
