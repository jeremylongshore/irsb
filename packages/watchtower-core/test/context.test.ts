import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type Database from 'better-sqlite3';
import type { TransactionInfo, TokenTransferInfo, ContextDataSource } from '../src/context/contextTypes.js';
import type { AddressTagMap } from '../src/context/classifyFunding.js';
import { classifyFunding, parseTagFile } from '../src/context/classifyFunding.js';
import { deriveContextSignals } from '../src/context/deriveContextSignals.js';
import { ContextConfigSchema } from '../src/context/contextConfig.js';
import { getContextCursor, setContextCursor } from '../src/context/contextStore.js';
import { syncAndScoreContext } from '../src/context/ingestContext.js';
import { initDbWithInlineMigrations } from '../src/storage/db.js';

// ── Fixture helpers ────────────────────────────────────────────────────

function makeTx(overrides: Partial<TransactionInfo> & { from: string }): TransactionInfo {
  return {
    hash: '0x' + 'a'.repeat(64),
    blockNumber: 100n,
    from: overrides.from,
    to: overrides.to ?? '0xAgentAddress',
    value: overrides.value ?? 1000000000000000000n, // 1 ETH
    timestamp: overrides.timestamp ?? 1700000000,
    fromIsContract: overrides.fromIsContract ?? false,
    ...overrides,
  };
}

const AGENT_ADDRESS = '0xAgentAddress';
const AGENT_ID = 'erc8004:11155111:0xRegistry:42';

function defaultConfig() {
  return ContextConfigSchema.parse({ chainId: 11155111 });
}

// ── classifyFunding ────────────────────────────────────────────────────

describe('classifyFunding', () => {
  it('returns UNKNOWN when no inbound transactions', () => {
    const result = classifyFunding(AGENT_ADDRESS, []);
    expect(result.kind).toBe('UNKNOWN');
  });

  it('classifies first inbound from EOA', () => {
    const txs = [
      makeTx({ from: '0xFunderEOA', to: AGENT_ADDRESS, fromIsContract: false, blockNumber: 10n }),
    ];
    const result = classifyFunding(AGENT_ADDRESS, txs);
    expect(result.kind).toBe('EOA');
    expect(result.ref).toBe('0xfundereoa');
  });

  it('classifies first inbound from contract', () => {
    const txs = [
      makeTx({ from: '0xContractSender', to: AGENT_ADDRESS, fromIsContract: true, blockNumber: 5n }),
      makeTx({ from: '0xLaterEOA', to: AGENT_ADDRESS, fromIsContract: false, blockNumber: 20n }),
    ];
    const result = classifyFunding(AGENT_ADDRESS, txs);
    expect(result.kind).toBe('CONTRACT');
    expect(result.ref).toBe('0xcontractsender');
  });

  it('picks earliest block for classification', () => {
    const txs = [
      makeTx({ from: '0xLater', to: AGENT_ADDRESS, fromIsContract: true, blockNumber: 100n }),
      makeTx({ from: '0xEarliest', to: AGENT_ADDRESS, fromIsContract: false, blockNumber: 1n }),
    ];
    const result = classifyFunding(AGENT_ADDRESS, txs);
    expect(result.kind).toBe('EOA');
    expect(result.ref).toBe('0xearliest');
  });

  it('ignores outbound transactions', () => {
    const txs = [
      makeTx({ from: AGENT_ADDRESS, to: '0xSomeone', fromIsContract: false, blockNumber: 1n }),
    ];
    const result = classifyFunding(AGENT_ADDRESS, txs);
    expect(result.kind).toBe('UNKNOWN');
  });

  it('uses denylist tag over contract classification', () => {
    const txs = [
      makeTx({ from: '0xMixerAddr', to: AGENT_ADDRESS, fromIsContract: true, blockNumber: 1n }),
    ];
    const denylist: AddressTagMap = { '0xmixeraddr': 'MIXER' };
    const result = classifyFunding(AGENT_ADDRESS, txs, undefined, denylist);
    expect(result.kind).toBe('MIXER');
  });

  it('uses allowlist tag', () => {
    const txs = [
      makeTx({ from: '0xCoinbaseAddr', to: AGENT_ADDRESS, fromIsContract: true, blockNumber: 1n }),
    ];
    const allowlist: AddressTagMap = { '0xcoinbaseaddr': 'CEX' };
    const result = classifyFunding(AGENT_ADDRESS, txs, allowlist);
    expect(result.kind).toBe('CEX');
  });

  it('denylist takes priority over allowlist', () => {
    const txs = [
      makeTx({ from: '0xAddr', to: AGENT_ADDRESS, fromIsContract: false, blockNumber: 1n }),
    ];
    const allowlist: AddressTagMap = { '0xaddr': 'CEX' };
    const denylist: AddressTagMap = { '0xaddr': 'MIXER' };
    const result = classifyFunding(AGENT_ADDRESS, txs, allowlist, denylist);
    expect(result.kind).toBe('MIXER');
  });
});

// ── parseTagFile ───────────────────────────────────────────────────────

describe('parseTagFile', () => {
  it('parses address-only lines with default tag', () => {
    const content = '0xAddr1\n0xAddr2\n';
    const map = parseTagFile(content, 'CEX');
    expect(map['0xaddr1']).toBe('CEX');
    expect(map['0xaddr2']).toBe('CEX');
  });

  it('parses address,tag lines', () => {
    const content = '0xAddr1,BRIDGE\n0xAddr2,MIXER\n';
    const map = parseTagFile(content, 'CEX');
    expect(map['0xaddr1']).toBe('BRIDGE');
    expect(map['0xaddr2']).toBe('MIXER');
  });

  it('skips comments and blank lines', () => {
    const content = '# comment\n\n0xAddr1\n  \n# another comment\n0xAddr2,BRIDGE\n';
    const map = parseTagFile(content, 'CEX');
    expect(Object.keys(map)).toHaveLength(2);
  });
});

// ── deriveContextSignals ───────────────────────────────────────────────

describe('deriveContextSignals', () => {
  const config = defaultConfig();
  const observedAt = 1700000000;

  it('emits CX_FUNDED_BY_CONTRACT for contract-funded agent', () => {
    const txs = [
      makeTx({ from: '0xContract', to: AGENT_ADDRESS, fromIsContract: true, blockNumber: 1n }),
    ];
    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 0 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_FUNDED_BY_CONTRACT')).toBe(true);
    const sig = signals.find((s) => s.signalId === 'CX_FUNDED_BY_CONTRACT')!;
    expect(sig.severity).toBe('LOW');
    expect(sig.weight).toBe(0.2);
  });

  it('emits CX_FUNDED_BY_UNKNOWN when no inbound tx', () => {
    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: [], priorWindowTxCount: 0 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_FUNDED_BY_UNKNOWN')).toBe(true);
  });

  it('does NOT emit funding signal for normal EOA funding', () => {
    const txs = [
      makeTx({ from: '0xNormalEOA', to: AGENT_ADDRESS, fromIsContract: false, blockNumber: 1n }),
    ];
    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 0 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_FUNDED_BY_CONTRACT')).toBe(false);
    expect(signals.some((s) => s.signalId === 'CX_FUNDED_BY_UNKNOWN')).toBe(false);
  });

  it('emits CX_COUNTERPARTY_CONCENTRATION_HIGH when top counterparty > 80%', () => {
    // 12 txs, 10 with same counterparty = 83%
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 10; i++) {
      txs.push(makeTx({ from: AGENT_ADDRESS, to: '0xMainPeer', blockNumber: BigInt(i + 1), value: 0n }));
    }
    txs.push(makeTx({ from: AGENT_ADDRESS, to: '0xOther1', blockNumber: 11n, value: 0n }));
    txs.push(makeTx({ from: AGENT_ADDRESS, to: '0xOther2', blockNumber: 12n, value: 0n }));

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 5 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_COUNTERPARTY_CONCENTRATION_HIGH')).toBe(true);
    const sig = signals.find((s) => s.signalId === 'CX_COUNTERPARTY_CONCENTRATION_HIGH')!;
    expect(sig.severity).toBe('MEDIUM');
    expect(sig.weight).toBe(0.4);
  });

  it('does NOT emit concentration when below threshold', () => {
    // 10 txs, each with different counterparty = 10% each
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 10; i++) {
      txs.push(makeTx({ from: AGENT_ADDRESS, to: `0xPeer${i}`, blockNumber: BigInt(i + 1), value: 0n }));
    }

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 5 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_COUNTERPARTY_CONCENTRATION_HIGH')).toBe(false);
  });

  it('does NOT emit concentration when tx count below minimum', () => {
    // Only 5 txs (minimum is 10)
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 5; i++) {
      txs.push(makeTx({ from: AGENT_ADDRESS, to: '0xSamePeer', blockNumber: BigInt(i + 1), value: 0n }));
    }

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 2 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_COUNTERPARTY_CONCENTRATION_HIGH')).toBe(false);
  });

  it('emits CX_TX_BURST when current >> prior', () => {
    // Current: 15 txs, prior: 3 txs, multiplier 3x → 15 > 3*3 = 9 → burst
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 15; i++) {
      txs.push(makeTx({ from: AGENT_ADDRESS, to: `0xPeer${i}`, blockNumber: BigInt(i + 1), value: 0n }));
    }

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 3 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_TX_BURST')).toBe(true);
  });

  it('does NOT emit CX_TX_BURST when ratio is below multiplier', () => {
    // Current: 10 txs, prior: 5 txs, multiplier 3x → 10 < 5*3 = 15 → no burst
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 10; i++) {
      txs.push(makeTx({ from: AGENT_ADDRESS, to: `0xPeer${i}`, blockNumber: BigInt(i + 1), value: 0n }));
    }

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 5 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_TX_BURST')).toBe(false);
  });

  it('emits CX_DORMANT_THEN_BURST when prior is 0 and current has burst', () => {
    const txs: TransactionInfo[] = [];
    const baseTimestamp = 1700000000;
    for (let i = 0; i < 15; i++) {
      txs.push(makeTx({
        from: AGENT_ADDRESS,
        to: `0xPeer${i}`,
        blockNumber: BigInt(i + 1),
        value: 0n,
        timestamp: baseTimestamp + i * 60, // all within 15 minutes
      }));
    }

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 0 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_DORMANT_THEN_BURST')).toBe(true);
    const sig = signals.find((s) => s.signalId === 'CX_DORMANT_THEN_BURST')!;
    expect(sig.severity).toBe('MEDIUM');
    expect(sig.weight).toBe(0.4);
  });

  it('does NOT emit CX_DORMANT_THEN_BURST when prior has activity', () => {
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 15; i++) {
      txs.push(makeTx({
        from: AGENT_ADDRESS,
        to: `0xPeer${i}`,
        blockNumber: BigInt(i + 1),
        value: 0n,
        timestamp: 1700000000 + i * 60,
      }));
    }

    const signals = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 5 },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_DORMANT_THEN_BURST')).toBe(false);
  });

  it('does NOT emit CX_MICROPAYMENT_SPAM when payment adjacency is disabled', () => {
    const config = ContextConfigSchema.parse({ chainId: 11155111, enablePaymentAdjacency: false });
    const transfers: TokenTransferInfo[] = [];
    for (let i = 0; i < 25; i++) {
      transfers.push({
        tokenAddress: '0xUSDC',
        from: AGENT_ADDRESS.toLowerCase(),
        to: '0xpeer1',
        value: 100n,
        blockNumber: BigInt(i),
        txHash: `0x${i.toString(16).padStart(64, '0')}`,
      });
    }

    const signals = deriveContextSignals(
      {
        agentId: AGENT_ID,
        agentAddress: AGENT_ADDRESS,
        transactions: [],
        priorWindowTxCount: 0,
        tokenTransfers: transfers,
      },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_MICROPAYMENT_SPAM')).toBe(false);
  });

  it('emits CX_MICROPAYMENT_SPAM when enabled and conditions met', () => {
    const config = ContextConfigSchema.parse({
      chainId: 11155111,
      enablePaymentAdjacency: true,
      micropaymentMaxValueWei: BigInt(1e15),
    });
    const transfers: TokenTransferInfo[] = [];
    for (let i = 0; i < 25; i++) {
      transfers.push({
        tokenAddress: '0xUSDC',
        from: AGENT_ADDRESS.toLowerCase(),
        to: '0xpeer1',
        value: 100n, // well under threshold
        blockNumber: BigInt(i),
        txHash: `0x${i.toString(16).padStart(64, '0')}`,
      });
    }

    const signals = deriveContextSignals(
      {
        agentId: AGENT_ID,
        agentAddress: AGENT_ADDRESS,
        transactions: [],
        priorWindowTxCount: 0,
        tokenTransfers: transfers,
      },
      config,
      observedAt,
    );
    expect(signals.some((s) => s.signalId === 'CX_MICROPAYMENT_SPAM')).toBe(true);
    const sig = signals.find((s) => s.signalId === 'CX_MICROPAYMENT_SPAM')!;
    expect(sig.severity).toBe('MEDIUM');
    expect(sig.weight).toBe(0.4);
  });

  it('signals are deterministically ordered', () => {
    // Set up scenario that triggers multiple signals
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 15; i++) {
      txs.push(makeTx({
        from: AGENT_ADDRESS,
        to: '0xMainPeer',
        blockNumber: BigInt(i + 1),
        value: 0n,
        timestamp: 1700000000 + i * 60,
        fromIsContract: false,
      }));
    }

    const signals1 = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 0 },
      config,
      observedAt,
    );
    const signals2 = deriveContextSignals(
      { agentId: AGENT_ID, agentAddress: AGENT_ADDRESS, transactions: txs, priorWindowTxCount: 0 },
      config,
      observedAt,
    );

    expect(signals1.map((s) => s.signalId)).toEqual(signals2.map((s) => s.signalId));
  });
});

// ── contextStore ───────────────────────────────────────────────────────

describe('contextStore', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wt-ctx-'));
    db = initDbWithInlineMigrations(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 0n for unknown cursor', () => {
    const cursor = getContextCursor(db, 'agent-x', 1);
    expect(cursor).toBe(0n);
  });

  it('sets and reads cursor', () => {
    setContextCursor(db, 'agent-x', 1, 12345n);
    const cursor = getContextCursor(db, 'agent-x', 1);
    expect(cursor).toBe(12345n);
  });

  it('updates cursor on conflict', () => {
    setContextCursor(db, 'agent-x', 1, 100n);
    setContextCursor(db, 'agent-x', 1, 200n);
    const cursor = getContextCursor(db, 'agent-x', 1);
    expect(cursor).toBe(200n);
  });

  it('tracks separate cursors per agent and chain', () => {
    setContextCursor(db, 'agent-a', 1, 100n);
    setContextCursor(db, 'agent-a', 137, 500n);
    setContextCursor(db, 'agent-b', 1, 300n);

    expect(getContextCursor(db, 'agent-a', 1)).toBe(100n);
    expect(getContextCursor(db, 'agent-a', 137)).toBe(500n);
    expect(getContextCursor(db, 'agent-b', 1)).toBe(300n);
  });
});

// ── Full pipeline (syncAndScoreContext) ────────────────────────────────

describe('syncAndScoreContext', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wt-ctx-pipe-'));
    db = initDbWithInlineMigrations(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('syncs with mock data source and produces signals + report', async () => {
    // Mock source that returns some transactions
    const txs: TransactionInfo[] = [];
    for (let i = 0; i < 15; i++) {
      txs.push(makeTx({
        from: '0xAgentAddr',
        to: '0xMainPeer',
        blockNumber: BigInt(100 + i),
        value: 0n,
        timestamp: 1700000000 + i * 60,
      }));
    }

    const source: ContextDataSource = {
      async getBlockNumber() { return 1000n; },
      async getTransactions() { return txs; },
    };

    const config = ContextConfigSchema.parse({ chainId: 11155111, maxBlocks: 500 });

    const result = await syncAndScoreContext(db, source, config, {
      agentId: AGENT_ID,
      agentAddress: '0xAgentAddr',
      fromBlock: 500n,
      toBlock: 999n,
    });

    expect(result.skipped).toBe(false);
    expect(result.txCount).toBe(15);
    expect(result.signalCount).toBeGreaterThan(0);
    expect(result.reportId).toBeTruthy();
    expect(result.overallRisk).toBeGreaterThanOrEqual(0);
  });

  it('skips when fromBlock > toBlock', async () => {
    const source: ContextDataSource = {
      async getBlockNumber() { return 100n; },
      async getTransactions() { return []; },
    };

    const config = ContextConfigSchema.parse({ chainId: 11155111 });

    const result = await syncAndScoreContext(db, source, config, {
      agentId: AGENT_ID,
      agentAddress: '0xAgentAddr',
      fromBlock: 200n,
      toBlock: 100n,
    });

    expect(result.skipped).toBe(true);
    expect(result.txCount).toBe(0);
  });

  it('advances cursor after successful sync', async () => {
    const source: ContextDataSource = {
      async getBlockNumber() { return 1000n; },
      async getTransactions() { return []; },
    };

    const config = ContextConfigSchema.parse({ chainId: 11155111, maxBlocks: 500 });

    await syncAndScoreContext(db, source, config, {
      agentId: AGENT_ID,
      agentAddress: '0xAgentAddr',
      fromBlock: 500n,
      toBlock: 999n,
    });

    const cursor = getContextCursor(db, AGENT_ID, 11155111);
    expect(cursor).toBe(999n);
  });

  it('produces signals that flow through W1 scoring', async () => {
    // Contract-funded agent with concentration → should produce signals + non-zero risk
    const txs: TransactionInfo[] = [
      makeTx({
        from: '0xContractFunder',
        to: '0xAgentAddr',
        fromIsContract: true,
        blockNumber: 100n,
        value: 1000000000000000000n,
      }),
    ];
    // Add concentrated outbound
    for (let i = 0; i < 12; i++) {
      txs.push(makeTx({
        from: '0xAgentAddr',
        to: '0xMainPeer',
        blockNumber: BigInt(101 + i),
        value: 0n,
        timestamp: 1700000000 + i * 60,
      }));
    }

    const source: ContextDataSource = {
      async getBlockNumber() { return 1000n; },
      async getTransactions() { return txs; },
    };

    const config = ContextConfigSchema.parse({ chainId: 11155111 });

    const result = await syncAndScoreContext(db, source, config, {
      agentId: AGENT_ID,
      agentAddress: '0xAgentAddr',
      fromBlock: 50n,
      toBlock: 200n,
    });

    // Should have at least CX_FUNDED_BY_CONTRACT + CX_COUNTERPARTY_CONCENTRATION_HIGH
    expect(result.signalCount).toBeGreaterThanOrEqual(2);
    expect(result.overallRisk).toBeGreaterThan(0);
  });
});

// ── Migration 003 ──────────────────────────────────────────────────────

describe('migration 003_context', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wt-mig-'));
    db = initDbWithInlineMigrations(join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates context_cursor table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='context_cursor'",
    ).all() as { name: string }[];
    expect(tables).toHaveLength(1);
  });

  it('records 003_context.sql in _migrations', () => {
    const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('003_context.sql');
    expect(names).toHaveLength(3);
  });
});
