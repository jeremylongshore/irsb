import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActionLedger, BlockCursor } from '../src/state/index.js';

const TEST_STATE_DIR = join(process.cwd(), '.test-state');

describe('ActionLedger', () => {
  let ledger: ActionLedger;

  beforeEach(() => {
    // Clean up test directory
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

  it('should start empty', () => {
    expect(ledger.size).toBe(0);
    expect(ledger.hasActed('0x123')).toBe(false);
  });

  it('should record and retrieve actions', () => {
    ledger.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    expect(ledger.hasActed('0xabc123')).toBe(true);
    expect(ledger.size).toBe(1);

    const entry = ledger.getEntry('0xabc123');
    expect(entry).toBeDefined();
    expect(entry?.actionType).toBe('OPEN_DISPUTE');
    expect(entry?.txHash).toBe('0xtx123');
    expect(entry?.blockNumber).toBe(100n);
  });

  it('should normalize receipt IDs to lowercase', () => {
    ledger.recordAction({
      receiptId: '0xABC123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    expect(ledger.hasActed('0xabc123')).toBe(true);
    expect(ledger.hasActed('0xABC123')).toBe(true);
    expect(ledger.hasActed('0xAbC123')).toBe(true);
  });

  it('should prevent duplicate actions', () => {
    ledger.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    expect(() =>
      ledger.recordAction({
        receiptId: '0xabc123',
        actionType: 'SUBMIT_EVIDENCE',
        txHash: '0xtx456',
        blockNumber: 101n,
        findingId: 'finding-2',
      })
    ).toThrow('Action already recorded');
  });

  it('should persist across instances', () => {
    ledger.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    // Create new instance pointing to same directory
    const ledger2 = new ActionLedger(TEST_STATE_DIR);

    expect(ledger2.hasActed('0xabc123')).toBe(true);
    expect(ledger2.size).toBe(1);
  });

  it('should clear all entries', () => {
    ledger.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    ledger.clear();

    expect(ledger.size).toBe(0);
    expect(ledger.hasActed('0xabc123')).toBe(false);
  });

  it('should return all entries', () => {
    ledger.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    ledger.recordAction({
      receiptId: '0xdef456',
      actionType: 'SUBMIT_EVIDENCE',
      txHash: '0xtx456',
      blockNumber: 101n,
      findingId: 'finding-2',
    });

    const entries = ledger.getAllEntries();
    expect(entries.length).toBe(2);
  });

  it('should create chain-specific ledger file when chainId is provided', () => {
    const chainId = 11155111;
    const chainLedger = new ActionLedger(TEST_STATE_DIR, chainId);

    chainLedger.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    // Chain-specific file should exist
    expect(existsSync(join(TEST_STATE_DIR, `action-ledger-${chainId}.json`))).toBe(true);

    // Global ledger should not see the chain-specific entry
    const globalLedger = new ActionLedger(TEST_STATE_DIR);
    expect(globalLedger.hasActed('0xabc123')).toBe(false);

    // New chain ledger should see its own entry
    const chainLedger2 = new ActionLedger(TEST_STATE_DIR, chainId);
    expect(chainLedger2.hasActed('0xabc123')).toBe(true);
  });

  it('should isolate ledgers between different chains', () => {
    const ledgerChain1 = new ActionLedger(TEST_STATE_DIR, 1);
    const ledgerChain11155111 = new ActionLedger(TEST_STATE_DIR, 11155111);

    ledgerChain1.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx123',
      blockNumber: 100n,
      findingId: 'finding-1',
    });

    // Same receipt ID should not be blocked on different chain
    expect(ledgerChain11155111.hasActed('0xabc123')).toBe(false);

    // Can record same receipt on different chain
    ledgerChain11155111.recordAction({
      receiptId: '0xabc123',
      actionType: 'OPEN_DISPUTE',
      txHash: '0xtx456',
      blockNumber: 200n,
      findingId: 'finding-2',
    });

    expect(ledgerChain1.size).toBe(1);
    expect(ledgerChain11155111.size).toBe(1);
  });
});

describe('BlockCursor', () => {
  let cursor: BlockCursor;
  const chainId = 11155111; // Sepolia

  beforeEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });
    cursor = new BlockCursor(TEST_STATE_DIR, chainId);
  });

  afterEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  it('should start with null last processed block', () => {
    expect(cursor.getLastProcessedBlock()).toBeNull();
    expect(cursor.getState()).toBeNull();
  });

  it('should update and retrieve block number', () => {
    cursor.update(1000n);

    expect(cursor.getLastProcessedBlock()).toBe(1000n);

    const state = cursor.getState();
    expect(state).toBeDefined();
    expect(state?.lastProcessedBlock).toBe(1000n);
    expect(state?.chainId).toBe(chainId);
  });

  it('should prevent backwards movement', () => {
    cursor.update(1000n);

    expect(() => cursor.update(999n)).toThrow('Cannot move cursor backwards');
  });

  it('should allow same block (idempotent update)', () => {
    cursor.update(1000n);
    cursor.update(1000n); // Should not throw

    expect(cursor.getLastProcessedBlock()).toBe(1000n);
  });

  it('should persist across instances', () => {
    cursor.update(1000n);

    const cursor2 = new BlockCursor(TEST_STATE_DIR, chainId);

    expect(cursor2.getLastProcessedBlock()).toBe(1000n);
  });

  it('should reject mismatched chain ID on load', () => {
    cursor.update(1000n);

    // Create cursor with different chain ID
    const cursor2 = new BlockCursor(TEST_STATE_DIR, 1); // mainnet

    // Should start fresh due to chain mismatch
    expect(cursor2.getLastProcessedBlock()).toBeNull();
  });

  describe('getStartBlock', () => {
    it('should calculate start from lookback when no cursor', () => {
      const currentBlock = 10000n;
      const lookback = 1000;
      const confirmations = 6;

      const startBlock = cursor.getStartBlock(currentBlock, lookback, confirmations);

      // 10000 - 1000 = 9000
      expect(startBlock).toBe(9000n);
    });

    it('should resume from cursor when available', () => {
      cursor.update(9500n);

      const currentBlock = 10000n;
      const lookback = 1000;
      const confirmations = 6;

      const startBlock = cursor.getStartBlock(currentBlock, lookback, confirmations);

      // Should resume from cursor + 1 = 9501
      expect(startBlock).toBe(9501n);
    });

    it('should respect confirmation safety', () => {
      cursor.update(9998n);

      const currentBlock = 10000n;
      const lookback = 1000;
      const confirmations = 6;

      const startBlock = cursor.getStartBlock(currentBlock, lookback, confirmations);

      // Cursor + 1 would be 9999, but safe block is 10000 - 6 = 9994
      // Should return safe block
      expect(startBlock).toBe(9994n);
    });

    it('should handle edge case of small block numbers', () => {
      const currentBlock = 100n;
      const lookback = 1000;
      const confirmations = 6;

      const startBlock = cursor.getStartBlock(currentBlock, lookback, confirmations);

      // 100 - 1000 = -900, but should clamp to 1
      expect(startBlock).toBe(1n);
    });
  });

  it('should reset cursor', () => {
    cursor.update(1000n);
    cursor.reset();

    expect(cursor.getLastProcessedBlock()).toBeNull();
  });
});
