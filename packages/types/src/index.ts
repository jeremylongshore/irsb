/**
 * @irsb/types — Shared TypeScript types for the IRSB ecosystem
 *
 * Contains contract addresses, common type definitions, and
 * protocol constants shared across solver, watchtower, and gateway.
 */

import type { Address, Hex } from 'viem';

// ============ Contract Addresses ============

/**
 * IRSB contract addresses by chain ID
 */
export const CONTRACTS = {
  /** Sepolia testnet (chain ID 11155111) */
  11155111: {
    SolverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745' as Address,
    IntentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c' as Address,
    DisputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D' as Address,
    WalletDelegate: '0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB' as Address,
    X402Facilitator: '0x0CDf48B293cdee132918cFb3a976aA6da59f4E6F' as Address,
    SpendLimitEnforcer: '0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D' as Address,
    TimeWindowEnforcer: '0x51DF412e99E9066B1B3Cab81a1756239659207B4' as Address,
    AllowedTargetsEnforcer: '0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b' as Address,
    AllowedMethodsEnforcer: '0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf' as Address,
    NonceEnforcer: '0x02962c406A7a29adF26F40657b111B90c236DbF1' as Address,
    ERC8004IdentityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as Address,
  },
} as const;

// ============ Protocol Constants ============

/** Minimum bond required for solver registration (in wei) */
export const MINIMUM_BOND = 100_000_000_000_000_000n; // 0.1 ETH

/** Challenge window duration (seconds) */
export const CHALLENGE_WINDOW = 3600; // 1 hour

/** Withdrawal cooldown duration (seconds) */
export const WITHDRAWAL_COOLDOWN = 604_800; // 7 days

/** Maximum jails before permanent ban */
export const MAX_JAILS = 3;

/** IRSB ERC-8004 Agent ID */
export const ERC8004_AGENT_ID = 967n;

// ============ Common Types ============

/** Ethereum hex string (0x-prefixed) */
export type { Hex, Address };

/** Intent receipt status */
export type ReceiptStatus = 'pending' | 'challenged' | 'finalized' | 'disputed';

/** Dispute state machine */
export type DisputeState = 'open' | 'escalated' | 'resolved';

/** Dispute resolution outcome */
export type DisputeOutcome = 'upheld' | 'rejected' | 'partial';

/** Solver status */
export type SolverStatus = 'active' | 'jailed' | 'banned' | 'withdrawn';

/** Signing action types (only these are ever signed) */
export type IrsbActionType = 'SUBMIT_RECEIPT' | 'OPEN_DISPUTE' | 'SUBMIT_EVIDENCE';

/** Evidence bundle manifest */
export interface EvidenceManifest {
  version: string;
  intentId: string;
  createdAt: string;
  files: Array<{
    path: string;
    hash: Hex;
    size: number;
  }>;
  manifestHash: Hex;
}
