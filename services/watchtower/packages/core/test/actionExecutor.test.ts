import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActionExecutor } from '../src/actions/actionExecutor.js';
import { createFinding, Severity, FindingCategory, ActionType, type Finding } from '../src/finding.js';
import { ActionLedger } from '../src/state/actionLedger.js';

const TEST_STATE_DIR = join(process.cwd(), '.test-executor-state');

function createTestFinding(overrides: Partial<Finding> = {}): Finding {
  return createFinding({
    ruleId: 'TEST_RULE',
    title: 'Test Finding',
    description: 'Test description',
    severity: Severity.HIGH,
    category: FindingCategory.RECEIPT,
    blockNumber: 1000000n,
    recommendedAction: ActionType.OPEN_DISPUTE,
    receiptId: '0x' + '1'.repeat(64),
    solverId: '0x' + '2'.repeat(64),
    ...overrides,
  });
}

describe('ActionExecutor', () => {
  let ledger: ActionLedger;
  let executor: ActionExecutor;

  beforeEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });
    ledger = new ActionLedger(TEST_STATE_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  describe('dry run mode', () => {
    beforeEach(() => {
      executor = new ActionExecutor({
        dryRun: true,
        maxActionsPerBatch: 10,
        ledger,
      });
    });

    it('does not execute actions in dry run mode', async () => {
      let handlerCalled = false;
      executor.registerHandler(ActionType.OPEN_DISPUTE, async () => {
        handlerCalled = true;
        return { txHash: '0xtxhash' };
      });

      const findings = [createTestFinding()];
      const results = await executor.executeActions(findings);

      expect(handlerCalled).toBe(false);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].dryRun).toBe(true);
      expect(results[0].txHash).toBeUndefined();
    });

    it('does not record to ledger in dry run mode', async () => {
      executor.registerHandler(ActionType.OPEN_DISPUTE, async () => ({
        txHash: '0xtxhash',
      }));

      const findings = [createTestFinding()];
      await executor.executeActions(findings);

      expect(ledger.size).toBe(0);
    });
  });

  describe('real execution mode', () => {
    beforeEach(() => {
      executor = new ActionExecutor({
        dryRun: false,
        maxActionsPerBatch: 10,
        ledger,
      });
    });

    it('executes action and records to ledger', async () => {
      executor.registerHandler(ActionType.OPEN_DISPUTE, async () => ({
        txHash: '0xsuccesshash',
      }));

      const findings = [createTestFinding()];
      const results = await executor.executeActions(findings);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].dryRun).toBe(false);
      expect(results[0].txHash).toBe('0xsuccesshash');
      expect(ledger.size).toBe(1);
    });

    it('skips finding with NONE action', async () => {
      const findings = [createTestFinding({ recommendedAction: ActionType.NONE })];
      const results = await executor.executeActions(findings);

      expect(results).toHaveLength(0);
    });

    it('skips receipt already in ledger', async () => {
      const receiptId = '0x' + '1'.repeat(64);
      ledger.recordAction({
        receiptId,
        actionType: 'OPEN_DISPUTE',
        txHash: '0xprevious',
        blockNumber: 999999n,
        findingId: 'prev-finding',
      });

      let handlerCalled = false;
      executor.registerHandler(ActionType.OPEN_DISPUTE, async () => {
        handlerCalled = true;
        return { txHash: '0xnew' };
      });

      const findings = [createTestFinding({ receiptId })];
      const results = await executor.executeActions(findings);

      expect(handlerCalled).toBe(false);
      expect(results).toHaveLength(0);
    });

    it('returns error when no handler registered', async () => {
      // No handler registered
      const findings = [createTestFinding()];
      const results = await executor.executeActions(findings);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No handler');
    });

    it('handles handler errors gracefully', async () => {
      executor.registerHandler(ActionType.OPEN_DISPUTE, async () => {
        throw new Error('RPC connection failed');
      });

      const findings = [createTestFinding()];
      const results = await executor.executeActions(findings);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('RPC connection failed');
      expect(ledger.size).toBe(0); // Should not record failed action
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      executor = new ActionExecutor({
        dryRun: false,
        maxActionsPerBatch: 2,
        ledger,
      });
      executor.registerHandler(ActionType.OPEN_DISPUTE, async () => ({
        txHash: '0xhash',
      }));
    });

    it('respects maxActionsPerBatch limit', async () => {
      const findings = [
        createTestFinding({ receiptId: '0x' + '1'.repeat(64) }),
        createTestFinding({ receiptId: '0x' + '2'.repeat(64) }),
        createTestFinding({ receiptId: '0x' + '3'.repeat(64) }),
      ];

      const results = await executor.executeActions(findings);

      // Only 2 should execute, 3rd skipped
      expect(results.filter((r) => r.success)).toHaveLength(2);
      expect(ledger.size).toBe(2);
    });

    it('does not count dry run against rate limit', async () => {
      const dryRunExecutor = new ActionExecutor({
        dryRun: true,
        maxActionsPerBatch: 2,
        ledger,
      });

      const findings = [
        createTestFinding({ receiptId: '0x' + '1'.repeat(64) }),
        createTestFinding({ receiptId: '0x' + '2'.repeat(64) }),
        createTestFinding({ receiptId: '0x' + '3'.repeat(64) }),
      ];

      const results = await dryRunExecutor.executeActions(findings);

      // All should process in dry run mode (rate limit only applies to real execution)
      expect(results).toHaveLength(3);
    });
  });

  describe('logging', () => {
    it('calls logger callback', async () => {
      executor = new ActionExecutor({
        dryRun: true,
        maxActionsPerBatch: 10,
        ledger,
      });

      const logs: Array<{ message: string; level: string }> = [];
      executor.setLogger((message, level) => {
        logs.push({ message, level });
      });

      const findings = [createTestFinding()];
      await executor.executeActions(findings);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.message.includes('DRY RUN'))).toBe(true);
    });
  });
});
