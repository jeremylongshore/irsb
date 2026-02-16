/**
 * IRSB Protocol V2 Types
 * TypeScript types matching Solidity contracts in src/libraries/TypesV2.sol
 */

// ============ Enums ============

/**
 * Privacy level for V2 receipts
 */
export enum PrivacyLevel {
  /** Full receipt visible on-chain */
  Public = 0,
  /** Commitment visible, payload gated (Lit Protocol) */
  SemiPublic = 1,
  /** Commitment only, encrypted payload off-chain */
  Private = 2,
}

/**
 * V2 Receipt status (extends V1)
 */
export enum ReceiptV2Status {
  None = 0,
  Pending = 1,
  Disputed = 2,
  Finalized = 3,
  Slashed = 4,
}

/**
 * Optimistic dispute status
 */
export enum OptimisticDisputeStatus {
  None = 0,
  Open = 1,
  Contested = 2,
  ChallengerWins = 3,
  SolverWins = 4,
}

// ============ Structs ============

/**
 * V2 Intent Receipt with dual attestation and privacy commitments
 */
export interface IntentReceiptV2 {
  /** Hash of the original intent/order */
  intentHash: string;
  /** Hash of the ConstraintEnvelope */
  constraintsHash: string;
  /** Hash of execution route */
  routeHash: string;
  /** Hash of OutcomeEnvelope */
  outcomeHash: string;
  /** Hash of evidence bundle (IPFS/Arweave CID) */
  evidenceHash: string;
  /** Receipt creation timestamp */
  createdAt: bigint;
  /** Deadline for settlement proof */
  expiry: bigint;
  /** Registered solver identifier */
  solverId: string;
  /** Client/counterparty address */
  client: string;
  /** Hash of arbitrary metadata (commitment, no plaintext) */
  metadataCommitment: string;
  /** IPFS CID or bytes32 digest pointing to encrypted payload */
  ciphertextPointer: string;
  /** Privacy level for this receipt */
  privacyLevel: PrivacyLevel;
  /** Optional escrow link (bytes32, zero if no escrow) */
  escrowId: string;
  /** Solver's EIP-712 signature */
  solverSig: string;
  /** Client's EIP-712 signature */
  clientSig: string;
}

/**
 * Optimistic dispute record
 */
export interface OptimisticDispute {
  /** Receipt being disputed */
  receiptId: string;
  /** Solver under dispute */
  solverId: string;
  /** Who opened the dispute */
  challenger: string;
  /** Bond posted by challenger */
  challengerBond: bigint;
  /** Bond posted by solver (counter-bond) */
  counterBond: bigint;
  /** Initial evidence hash from challenger */
  evidenceHash: string;
  /** Dispute start time */
  openedAt: bigint;
  /** Deadline for counter-bond */
  counterBondDeadline: bigint;
  /** Deadline for arbitration (if contested) */
  arbitrationDeadline: bigint;
  /** Current dispute status */
  status: OptimisticDisputeStatus;
}

/**
 * Escrow record
 */
export interface Escrow {
  /** Linked receipt ID */
  receiptId: string;
  /** Who deposited funds */
  depositor: string;
  /** Token address (zero address = native ETH) */
  token: string;
  /** Escrow amount */
  amount: bigint;
  /** Creation timestamp */
  createdAt: bigint;
  /** Release deadline */
  deadline: bigint;
  /** Escrow status */
  status: EscrowStatus;
}

export enum EscrowStatus {
  Active = 0,
  Released = 1,
  Refunded = 2,
}

// ============ Input Types ============

/**
 * Parameters for posting a V2 receipt
 */
export interface PostReceiptV2Params {
  intentHash: string;
  constraintsHash: string;
  routeHash: string;
  outcomeHash: string;
  evidenceHash: string;
  expiry: bigint;
  solverId: string;
  client: string;
  metadataCommitment: string;
  ciphertextPointer: string;
  privacyLevel: PrivacyLevel;
  escrowId?: string;
  solverSig: string;
  clientSig: string;
}

/**
 * Parameters for building a V2 receipt (before signing)
 */
export interface BuildReceiptV2Params {
  intentHash: string;
  constraintsHash: string;
  routeHash: string;
  outcomeHash: string;
  evidenceHash: string;
  expiry: bigint;
  solverId: string;
  client: string;
  metadataCommitment: string;
  ciphertextPointer: string;
  privacyLevel?: PrivacyLevel;
  escrowId?: string;
}

/**
 * EIP-712 typed data for V2 receipts
 */
export interface ReceiptV2TypedData {
  domain: EIP712Domain;
  types: Record<string, EIP712TypeField[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface EIP712TypeField {
  name: string;
  type: string;
}

// ============ Constants ============

export const V2_CONSTANTS = {
  /** Counter-bond window duration */
  COUNTER_BOND_WINDOW: BigInt(24 * 60 * 60), // 24 hours
  /** Arbitration timeout duration */
  ARBITRATION_TIMEOUT: BigInt(7 * 24 * 60 * 60), // 7 days
  /** Evidence submission window */
  EVIDENCE_WINDOW: BigInt(48 * 60 * 60), // 48 hours
  /** Counter-bond multiplier (100% of challenger bond) */
  COUNTER_BOND_MULTIPLIER: 100,
  /** Slash distribution: 70% to user */
  SLASH_USER_BPS: 7000,
  /** Slash distribution: 20% to treasury */
  SLASH_TREASURY_BPS: 2000,
  /** Slash distribution: 10% to arbitrator */
  SLASH_ARBITRATOR_BPS: 1000,
  /** Maximum pointer length (64 chars) */
  MAX_POINTER_LENGTH: 64,
  /** EIP-712 type hash name */
  EIP712_NAME: 'IRSB ReceiptV2',
  /** EIP-712 type hash version */
  EIP712_VERSION: '1',
} as const;
