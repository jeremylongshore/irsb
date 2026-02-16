/**
 * TypeScript mirrors of Solidity delegation types from TypesDelegation.sol
 * Used by SDK consumers, x402-irsb package, solver, and watchtower
 */

// ============ Core Types ============

/** A single caveat constraint on a delegation */
export interface Caveat {
  /** ICaveatEnforcer contract address */
  enforcer: `0x${string}`;
  /** ABI-encoded enforcer-specific parameters */
  terms: `0x${string}`;
}

/** A delegation granting execution rights with caveats */
export interface Delegation {
  /** EOA that delegates execution rights */
  delegator: `0x${string}`;
  /** WalletDelegate contract address */
  delegate: `0x${string}`;
  /** Parent delegation hash (0x0 for root) */
  authority: `0x${string}`;
  /** Ordered list of caveat enforcers */
  caveats: Caveat[];
  /** Unique nonce to prevent replay */
  salt: bigint;
  /** EIP-712 signature from delegator */
  signature: `0x${string}`;
}

/** Parameters for x402 payment settlement */
export interface SettlementParams {
  /** Unique payment identifier (keccak256 of proof) */
  paymentHash: `0x${string}`;
  /** ERC20 token address for payment */
  token: `0x${string}`;
  /** Payment amount in token units */
  amount: bigint;
  /** Recipient of payment */
  seller: `0x${string}`;
  /** Payer (delegator in delegated flow) */
  buyer: `0x${string}`;
  /** IRSB receipt ID to post */
  receiptId: `0x${string}`;
  /** Intent hash for receipt */
  intentHash: `0x${string}`;
  /** x402 payment proof */
  proof: `0x${string}`;
  /** Settlement deadline (0 = no expiry) */
  expiry: bigint;
}

/** Execution parameters for a delegated call */
export interface ExecutionParams {
  /** Contract to call */
  target: `0x${string}`;
  /** Encoded function call */
  callData: `0x${string}`;
  /** ETH value to send */
  value: bigint;
}

/** Stored delegation state (on-chain) */
export interface StoredDelegation {
  /** Who created the delegation */
  delegator: `0x${string}`;
  /** Whether delegation is still valid */
  active: boolean;
  /** When delegation was set up */
  createdAt: bigint;
  /** When revoked (0 if active) */
  revokedAt: bigint;
  /** Hash of caveats array */
  caveatsHash: `0x${string}`;
}

// ============ Enums ============

export enum DelegationStatus {
  None = 0,
  Active = 1,
  Revoked = 2,
}

// ============ Caveat Config Types ============

/** Configuration for SpendLimitEnforcer */
export interface SpendLimitConfig {
  /** Token address (0x0 for native ETH) */
  token: `0x${string}`;
  /** Maximum daily spend in token units */
  dailyCap: bigint;
  /** Maximum per-transaction spend */
  perTxCap: bigint;
}

/** Configuration for TimeWindowEnforcer */
export interface TimeWindowConfig {
  /** Session start (unix timestamp) */
  notBefore: bigint;
  /** Session end (unix timestamp) */
  notAfter: bigint;
}

/** Configuration for AllowedTargetsEnforcer */
export interface AllowedTargetsConfig {
  /** Approved contract addresses */
  targets: `0x${string}`[];
}

/** Configuration for AllowedMethodsEnforcer */
export interface AllowedMethodsConfig {
  /** Approved function selectors */
  selectors: `0x${string}`[];
}

/** Configuration for NonceEnforcer */
export interface NonceConfig {
  /** Starting nonce value */
  startNonce: bigint;
}

// ============ EIP-712 Constants ============

export const DELEGATION_EIP712_TYPES = {
  Delegation: [
    { name: 'delegator', type: 'address' },
    { name: 'delegate', type: 'address' },
    { name: 'authority', type: 'bytes32' },
    { name: 'caveats', type: 'Caveat[]' },
    { name: 'salt', type: 'uint256' },
  ],
  Caveat: [
    { name: 'enforcer', type: 'address' },
    { name: 'terms', type: 'bytes' },
  ],
} as const;

export const DELEGATION_EIP712_DOMAIN = {
  name: 'IRSB WalletDelegate',
  version: '1',
} as const;

// ============ Contract Addresses (Sepolia) ============

export interface DelegationContracts {
  walletDelegate: `0x${string}`;
  x402Facilitator: `0x${string}`;
  spendLimitEnforcer: `0x${string}`;
  timeWindowEnforcer: `0x${string}`;
  allowedTargetsEnforcer: `0x${string}`;
  allowedMethodsEnforcer: `0x${string}`;
  nonceEnforcer: `0x${string}`;
}
