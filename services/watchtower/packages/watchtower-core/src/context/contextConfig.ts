import { z } from 'zod';

export const ContextConfigSchema = z.object({
  /** Chain ID to query */
  chainId: z.number().int().positive(),

  /** Max blocks to scan per sync run (default 50 000) */
  maxBlocks: z.number().int().positive().default(50_000),

  /** Min transactions before counterparty concentration fires (default 10) */
  minTxForConcentration: z.number().int().positive().default(10),

  /** Top-1 counterparty share threshold (default 0.8 = 80%) */
  concentrationThreshold: z.number().min(0).max(1).default(0.8),

  /** Burst detection: multiplier over rolling baseline (default 3.0x) */
  burstMultiplier: z.number().positive().default(3.0),

  /** Burst detection: min tx count in current window to be considered a burst */
  burstMinTx: z.number().int().positive().default(10),

  /** Dormancy: min seconds of inactivity before burst is flagged (default 30 days) */
  dormancyThresholdSeconds: z.number().int().positive().default(30 * 86400),

  /** Enable payment adjacency signals (default false — off) */
  enablePaymentAdjacency: z.boolean().default(false),

  /** Stablecoin/token contract addresses to watch (user-configured, empty default) */
  paymentTokenAddresses: z.array(z.string()).default([]),

  /** Micropayment spam: min transfers to qualify (default 20) */
  micropaymentMinTransfers: z.number().int().positive().default(20),

  /** Micropayment spam: max unique peers (default 3) */
  micropaymentMaxPeers: z.number().int().positive().default(3),

  /** Micropayment spam: max value per transfer in wei (default 1e15 = 0.001 ETH-equivalent) */
  micropaymentMaxValueWei: z.bigint().positive().default(BigInt(1e15)),

  /** Optional allowlist file path (addresses tagged as known-good, e.g. CEX, BRIDGE) */
  allowlistPath: z.string().optional(),

  /** Optional denylist file path (addresses tagged as known-bad, e.g. MIXER) */
  denylistPath: z.string().optional(),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;
