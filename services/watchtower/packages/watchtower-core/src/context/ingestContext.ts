import type Database from 'better-sqlite3';
import type { ContextConfig } from './contextConfig.js';
import type { ContextDataSource } from './contextTypes.js';
import type { AddressTagMap } from './classifyFunding.js';
import { deriveContextSignals } from './deriveContextSignals.js';
import { getContextCursor, setContextCursor } from './contextStore.js';
import { canonicalJson, sha256Hex } from '../utils/canonical.js';
import { sortSignals } from '../utils/sort.js';
import { upsertAgent, getAgent } from '../storage/agentStore.js';
import { insertSnapshot, getLatestSnapshots } from '../storage/snapshotStore.js';
import { insertRiskReport } from '../storage/reportStore.js';
import { insertAlerts } from '../storage/alertStore.js';
import { scoreAgent } from '../scoring/scoreAgent.js';

export interface ContextSyncOptions {
  /** Ethereum address of the agent to analyze */
  agentAddress: string;
  /** Agent ID (e.g. erc8004:...) — used for storage */
  agentId: string;
  /** Override fromBlock (skip cursor) */
  fromBlock?: bigint;
  /** Override toBlock (skip chain tip lookup) */
  toBlock?: bigint;
  /** Loaded allowlist */
  allowlist?: AddressTagMap;
  /** Loaded denylist */
  denylist?: AddressTagMap;
}

export interface ContextSyncResult {
  agentId: string;
  fromBlock: bigint;
  toBlock: bigint;
  txCount: number;
  signalCount: number;
  overallRisk: number;
  reportId: string;
  alertCount: number;
  skipped: boolean;
}

/**
 * Sync context for an agent address: query transactions, derive signals,
 * store snapshot, score, and produce risk report + alerts.
 */
export async function syncAndScoreContext(
  db: Database.Database,
  source: ContextDataSource,
  config: ContextConfig,
  options: ContextSyncOptions,
): Promise<ContextSyncResult> {
  // Determine block range
  const cursor = getContextCursor(db, options.agentId, config.chainId);
  const chainTip = await source.getBlockNumber();

  const fromBlock = options.fromBlock ?? (cursor === 0n ? (chainTip > BigInt(config.maxBlocks) ? chainTip - BigInt(config.maxBlocks) : 0n) : cursor + 1n);
  const toBlock = options.toBlock ?? chainTip;

  if (fromBlock > toBlock) {
    return {
      agentId: options.agentId,
      fromBlock,
      toBlock,
      txCount: 0,
      signalCount: 0,
      overallRisk: 0,
      reportId: '',
      alertCount: 0,
      skipped: true,
    };
  }

  // Bound the range to maxBlocks
  const effectiveTo = (toBlock - fromBlock > BigInt(config.maxBlocks))
    ? fromBlock + BigInt(config.maxBlocks) - 1n
    : toBlock;

  // Get transactions
  const transactions = await source.getTransactions(
    options.agentAddress,
    fromBlock,
    effectiveTo,
  );

  // Calculate prior window for burst comparison
  // Prior window: same size range immediately before fromBlock
  const priorWindowSize = effectiveTo - fromBlock + 1n;
  const priorFrom = fromBlock > priorWindowSize ? fromBlock - priorWindowSize : 0n;
  const priorTo = fromBlock > 0n ? fromBlock - 1n : 0n;
  let priorWindowTxCount = 0;
  if (priorFrom <= priorTo) {
    const priorTxs = await source.getTransactions(
      options.agentAddress,
      priorFrom,
      priorTo,
    );
    priorWindowTxCount = priorTxs.length;
  }

  // Optional: token transfers for payment adjacency
  let tokenTransfers;
  if (
    config.enablePaymentAdjacency &&
    config.paymentTokenAddresses.length > 0 &&
    source.getTokenTransfers
  ) {
    tokenTransfers = await source.getTokenTransfers(
      options.agentAddress,
      config.paymentTokenAddresses,
      fromBlock,
      effectiveTo,
    );
  }

  const observedAt = Math.floor(Date.now() / 1000);

  // Derive signals
  const signals = sortSignals(
    deriveContextSignals(
      {
        agentId: options.agentId,
        agentAddress: options.agentAddress,
        transactions,
        priorWindowTxCount,
        tokenTransfers,
        allowlist: options.allowlist,
        denylist: options.denylist,
      },
      config,
      observedAt,
    ),
  );

  // Upsert agent
  upsertAgent(db, { agentId: options.agentId });

  // Store watchtower snapshot
  const snapshotId = sha256Hex(canonicalJson({ agentId: options.agentId, signals }));
  insertSnapshot(db, {
    snapshotId,
    agentId: options.agentId,
    observedAt,
    signals,
  });

  // Score agent
  const agent = getAgent(db, options.agentId)!;
  const snapshots = getLatestSnapshots(db, options.agentId);
  const generatedAt = Math.floor(Date.now() / 1000);
  const { report, newAlerts } = scoreAgent(agent, snapshots, generatedAt);

  insertRiskReport(db, report);
  if (newAlerts.length > 0) {
    insertAlerts(db, newAlerts);
  }

  // Update cursor
  setContextCursor(db, options.agentId, config.chainId, effectiveTo);

  return {
    agentId: options.agentId,
    fromBlock,
    toBlock: effectiveTo,
    txCount: transactions.length,
    signalCount: signals.length,
    overallRisk: report.overallRisk,
    reportId: report.reportId,
    alertCount: newAlerts.length,
    skipped: false,
  };
}
