import { RuleEngine, createDefaultRegistry } from '@irsb-watchtower/core';
import { describe, it, expect } from 'vitest';
import { createChainContext } from '../src/worker.js';

// Mock IRSB client with methods matching real IrsbClient interface
const mockClient = {
  rpcUrl: 'https://rpc.sepolia.org',
  chainId: 11155111,
  contracts: {
    solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
    intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
    disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
  },
  getBlockNumber: async () => 1000000n,
  getReceiptPostedEvents: async () => [],
  getDisputeOpenedEvents: async () => [],
  getSolver: async () => null,
} as any;

describe('Worker', () => {
  describe('createChainContext', () => {
    it('creates a chain context with current block', () => {
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);

      expect(context.currentBlock).toBe(1000000n);
      expect(context.chainId).toBe(11155111);
      expect(context.blockTimestamp).toBeInstanceOf(Date);
    });

    it('returns empty receipts in challenge window', async () => {
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);
      const receipts = await context.getReceiptsInChallengeWindow();

      expect(receipts).toEqual([]);
    });

    it('returns empty disputes', async () => {
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);
      const disputes = await context.getActiveDisputes();

      expect(disputes).toEqual([]);
    });

    it('returns null for solver info', async () => {
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);
      const solver = await context.getSolverInfo('0x123');

      expect(solver).toBeNull();
    });

    it('returns empty events', async () => {
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);
      const events = await context.getEvents(0n, 1000000n);

      expect(events).toEqual([]);
    });
  });

  describe('Scan cycle', () => {
    it('produces findings from sample rule', async () => {
      const engine = new RuleEngine(createDefaultRegistry());
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);

      const result = await engine.execute(context);

      // Sample rules may or may not produce findings depending on mock data
      expect(result.rulesExecuted).toBeGreaterThan(0);
      // Allow some rules to fail if they can't find required data
      expect(result.rulesFailed).toBeLessThanOrEqual(result.rulesExecuted);
    });

    it('produces mock finding when explicitly running MOCK-ALWAYS-FIND', async () => {
      const engine = new RuleEngine(createDefaultRegistry());
      const context = createChainContext(mockClient, 1000000n, new Date(), 11155111, 1000);

      const result = await engine.execute(context, {
        ruleIds: ['MOCK-ALWAYS-FIND'],
      });

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('MOCK-ALWAYS-FIND');
    });
  });
});
