import type { Signal } from '../schemas/index.js';
import type { ContextConfig } from './contextConfig.js';
import type { TransactionInfo, TokenTransferInfo } from './contextTypes.js';
import type { AddressTagMap } from './classifyFunding.js';
import { classifyFunding } from './classifyFunding.js';
import { sortEvidence } from '../utils/sort.js';

export interface ContextSignalInput {
  agentId: string;
  /** Ethereum address being analyzed */
  agentAddress: string;
  /** All transactions in the analysis window */
  transactions: TransactionInfo[];
  /** Previous-window transaction count (for burst comparison) */
  priorWindowTxCount: number;
  /** Token transfers (only populated when payment adjacency is enabled) */
  tokenTransfers?: TokenTransferInfo[];
  /** Loaded allowlist (optional) */
  allowlist?: AddressTagMap;
  /** Loaded denylist (optional) */
  denylist?: AddressTagMap;
}

/**
 * Derive deterministic context signals for an agent.
 *
 * Level 1 signals:
 * - CX_FUNDED_BY_CONTRACT (LOW, 0.2)
 * - CX_FUNDED_BY_UNKNOWN (LOW, 0.1)
 * - CX_COUNTERPARTY_CONCENTRATION_HIGH (MEDIUM, 0.4)
 * - CX_TX_BURST (MEDIUM, 0.3)
 * - CX_DORMANT_THEN_BURST (MEDIUM, 0.4)
 * - CX_MICROPAYMENT_SPAM (MEDIUM, 0.4) — only if enablePaymentAdjacency
 */
export function deriveContextSignals(
  input: ContextSignalInput,
  config: ContextConfig,
  observedAt: number,
): Signal[] {
  const signals: Signal[] = [];
  const baseEvidence = [{ type: 'agentId', ref: input.agentId }];

  // ── Funding source classification ────────────────────────────────────
  const funding = classifyFunding(
    input.agentAddress,
    input.transactions,
    input.allowlist,
    input.denylist,
  );

  if (funding.kind === 'CONTRACT') {
    signals.push({
      signalId: 'CX_FUNDED_BY_CONTRACT',
      severity: 'LOW',
      weight: 0.2,
      observedAt,
      evidence: sortEvidence([
        ...baseEvidence,
        { type: 'fundingSource', ref: funding.ref ?? 'unknown' },
        { type: 'fundingKind', ref: 'CONTRACT' },
      ]),
    });
  } else if (funding.kind === 'UNKNOWN') {
    signals.push({
      signalId: 'CX_FUNDED_BY_UNKNOWN',
      severity: 'LOW',
      weight: 0.1,
      observedAt,
      evidence: sortEvidence([
        ...baseEvidence,
        { type: 'fundingKind', ref: 'UNKNOWN' },
      ]),
    });
  }

  // ── Counterparty concentration ───────────────────────────────────────
  const addr = input.agentAddress.toLowerCase();
  const txs = input.transactions;

  if (txs.length >= config.minTxForConcentration) {
    const counterpartyCount: Record<string, number> = {};
    for (const tx of txs) {
      const peer =
        tx.from.toLowerCase() === addr
          ? tx.to?.toLowerCase()
          : tx.from.toLowerCase();
      if (peer) {
        counterpartyCount[peer] = (counterpartyCount[peer] ?? 0) + 1;
      }
    }

    const entries = Object.entries(counterpartyCount);
    if (entries.length > 0) {
      const total = txs.length;
      const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
      const topShare = top[1] / total;

      if (topShare > config.concentrationThreshold) {
        signals.push({
          signalId: 'CX_COUNTERPARTY_CONCENTRATION_HIGH',
          severity: 'MEDIUM',
          weight: 0.4,
          observedAt,
          evidence: sortEvidence([
            ...baseEvidence,
            { type: 'topCounterparty', ref: top[0] },
            { type: 'topShare', ref: topShare.toFixed(4) },
            { type: 'txCount', ref: String(total) },
            { type: 'uniqueCounterparties', ref: String(entries.length) },
          ]),
        });
      }
    }
  }

  // ── TX burst detection ───────────────────────────────────────────────
  const currentCount = txs.length;

  if (
    currentCount >= config.burstMinTx &&
    input.priorWindowTxCount > 0 &&
    currentCount > input.priorWindowTxCount * config.burstMultiplier
  ) {
    signals.push({
      signalId: 'CX_TX_BURST',
      severity: 'MEDIUM',
      weight: 0.3,
      observedAt,
      evidence: sortEvidence([
        ...baseEvidence,
        { type: 'currentTxCount', ref: String(currentCount) },
        { type: 'priorTxCount', ref: String(input.priorWindowTxCount) },
        { type: 'multiplier', ref: (currentCount / input.priorWindowTxCount).toFixed(2) },
      ]),
    });
  }

  // ── Dormant-then-burst ───────────────────────────────────────────────
  if (currentCount >= config.burstMinTx && txs.length > 0) {
    // Sort by timestamp ascending
    const sorted = [...txs].sort((a, b) => a.timestamp - b.timestamp);
    const latestTx = sorted[sorted.length - 1]!;
    const earliestTx = sorted[0]!;

    // If there was prior inactivity (priorWindowTxCount === 0)
    // AND the current window has a burst
    if (input.priorWindowTxCount === 0) {
      // Check that activity window is compressed (all within a short span)
      const activitySpanSeconds = latestTx.timestamp - earliestTx.timestamp;
      if (activitySpanSeconds < config.dormancyThresholdSeconds) {
        signals.push({
          signalId: 'CX_DORMANT_THEN_BURST',
          severity: 'MEDIUM',
          weight: 0.4,
          observedAt,
          evidence: sortEvidence([
            ...baseEvidence,
            { type: 'txCount', ref: String(currentCount) },
            { type: 'activitySpanSeconds', ref: String(activitySpanSeconds) },
          ]),
        });
      }
    }
  }

  // ── Optional: Micropayment spam ──────────────────────────────────────
  if (
    config.enablePaymentAdjacency &&
    input.tokenTransfers &&
    input.tokenTransfers.length >= config.micropaymentMinTransfers
  ) {
    // Filter to "micro" transfers (value <= threshold)
    const micro = input.tokenTransfers.filter(
      (t) => t.value <= config.micropaymentMaxValueWei,
    );

    if (micro.length >= config.micropaymentMinTransfers) {
      // Count unique peers
      const peers = new Set<string>();
      for (const t of micro) {
        const peer =
          t.from.toLowerCase() === addr ? t.to.toLowerCase() : t.from.toLowerCase();
        peers.add(peer);
      }

      if (peers.size <= config.micropaymentMaxPeers) {
        signals.push({
          signalId: 'CX_MICROPAYMENT_SPAM',
          severity: 'MEDIUM',
          weight: 0.4,
          observedAt,
          evidence: sortEvidence([
            ...baseEvidence,
            { type: 'microTransferCount', ref: String(micro.length) },
            { type: 'uniquePeers', ref: String(peers.size) },
          ]),
        });
      }
    }
  }

  return signals;
}
