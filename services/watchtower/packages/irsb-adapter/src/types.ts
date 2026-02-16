import type { Address, Hex } from 'viem';

/**
 * Receipt status from the IRSB protocol
 */
export type ReceiptStatus = 'pending' | 'challenged' | 'finalized' | 'disputed';

/**
 * Dispute status from the IRSB protocol
 */
export type DisputeStatus = 'open' | 'countered' | 'resolved' | 'escalated';

/**
 * Solver status from the IRSB protocol
 */
export type SolverStatus = 'active' | 'jailed' | 'banned' | 'inactive';

/**
 * Privacy level for V2 receipts
 */
export type PrivacyLevel = 'PUBLIC' | 'SEMI_PUBLIC' | 'PRIVATE';

/**
 * Intent Receipt (V1)
 */
export interface IntentReceipt {
  /** Receipt ID (keccak256 hash) */
  id: Hex;

  /** Hash of the original intent */
  intentHash: Hex;

  /** Hash of execution constraints */
  constraintsHash: Hex;

  /** Hash of execution route */
  routeHash: Hex;

  /** Hash of execution outcome */
  outcomeHash: Hex;

  /** Hash of evidence (IPFS CID, etc) */
  evidenceHash: Hex;

  /** When the receipt was created (Unix timestamp) */
  createdAt: bigint;

  /** When the receipt expires (Unix timestamp) */
  expiry: bigint;

  /** ID of the solver that executed the intent */
  solverId: Hex;

  /** Solver's signature */
  solverSig: Hex;
}

/**
 * Intent Receipt V2 (dual attestation, privacy)
 */
export interface IntentReceiptV2 extends IntentReceipt {
  /** Hash of metadata (not stored on-chain) */
  metadataCommitment: Hex;

  /** Pointer to encrypted/off-chain data */
  ciphertextPointer: string;

  /** Privacy level */
  privacyLevel: PrivacyLevel;

  /** Optional escrow ID */
  escrowId?: Hex;

  /** Client/payer attestation signature */
  clientSig: Hex;
}

/**
 * On-chain receipt data
 */
export interface OnChainReceipt {
  /** Receipt ID */
  id: Hex;

  /** Solver ID */
  solverId: Hex;

  /** Receipt status */
  status: ReceiptStatus;

  /** Block number when posted */
  blockNumber: bigint;

  /** Transaction hash when posted */
  txHash: Hex;

  /** Challenge deadline (Unix timestamp) */
  challengeDeadline: bigint;

  /** Whether finalized */
  finalized: boolean;

  /** Intent hash */
  intentHash: Hex;

  /** Created timestamp */
  createdAt: bigint;
}

/**
 * Solver information from registry
 */
export interface Solver {
  /** Solver ID (bytes32) */
  id: Hex;

  /** Owner address */
  owner: Address;

  /** Staked bond amount (wei) */
  bondAmount: bigint;

  /** Solver status */
  status: SolverStatus;

  /** Reputation score (0-100) */
  reputation: number;

  /** Number of times jailed */
  jailCount: number;

  /** Registration block */
  registeredAt: bigint;

  /** Metadata URI */
  metadataUri?: string;
}

/**
 * Dispute information
 */
export interface Dispute {
  /** Dispute ID */
  id: Hex;

  /** Receipt being disputed */
  receiptId: Hex;

  /** Challenger address */
  challenger: Address;

  /** Dispute reason/type */
  reason: string;

  /** Evidence hash */
  evidenceHash: Hex;

  /** Dispute status */
  status: DisputeStatus;

  /** When dispute was opened */
  openedAt: bigint;

  /** Resolution deadline */
  deadline: bigint;

  /** Block number when opened */
  blockNumber: bigint;

  /** Bond posted by challenger */
  challengerBond: bigint;

  /** Counter-bond posted by solver (if any) */
  counterBond?: bigint;
}

/**
 * Dispute reason types
 */
export enum DisputeReason {
  /** Receipt expired without execution */
  TIMEOUT = 'TIMEOUT',

  /** Wrong amount delivered */
  WRONG_AMOUNT = 'WRONG_AMOUNT',

  /** Wrong token delivered */
  WRONG_TOKEN = 'WRONG_TOKEN',

  /** Wrong recipient */
  WRONG_RECIPIENT = 'WRONG_RECIPIENT',

  /** Constraint violation */
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  /** Other/custom reason */
  OTHER = 'OTHER',
}

/**
 * Open dispute parameters
 */
export interface OpenDisputeParams {
  /** Receipt ID to dispute */
  receiptId: Hex;

  /** Reason for dispute */
  reason: DisputeReason;

  /** Evidence hash (IPFS CID, etc) */
  evidenceHash: Hex;

  /** Bond amount to post (must meet minimum) */
  bondAmount: bigint;
}

/**
 * Submit evidence parameters
 */
export interface SubmitEvidenceParams {
  /** Dispute ID */
  disputeId: Hex;

  /** Evidence hash */
  evidenceHash: Hex;

  /** Optional description */
  description?: string;
}

/**
 * ReceiptPosted event data
 */
export interface ReceiptPostedEvent {
  /** Receipt ID */
  receiptId: Hex;

  /** Solver ID */
  solverId: Hex;

  /** Intent hash */
  intentHash: Hex;

  /** Challenge deadline (Unix timestamp) */
  challengeDeadline: bigint;

  /** Block number where event was emitted */
  blockNumber: bigint;

  /** Transaction hash */
  txHash: Hex;

  /** Log index within the transaction */
  logIndex: number;
}

/**
 * ReceiptFinalized event data
 */
export interface ReceiptFinalizedEvent {
  /** Receipt ID */
  receiptId: Hex;

  /** Solver ID */
  solverId: Hex;

  /** Block number where event was emitted */
  blockNumber: bigint;

  /** Transaction hash */
  txHash: Hex;

  /** Log index within the transaction */
  logIndex: number;
}

/**
 * DisputeOpened event data
 */
export interface DisputeOpenedEvent {
  /** Dispute ID */
  disputeId: Hex;

  /** Receipt ID */
  receiptId: Hex;

  /** Challenger address */
  challenger: Address;

  /** Dispute reason */
  reason: string;

  /** Bond amount */
  bond: bigint;

  /** Block number where event was emitted */
  blockNumber: bigint;

  /** Transaction hash */
  txHash: Hex;

  /** Log index within the transaction */
  logIndex: number;
}
