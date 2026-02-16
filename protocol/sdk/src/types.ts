/**
 * IRSB Protocol Types
 * Matches Solidity contracts in src/libraries/Types.sol
 */

// ============ Enums ============

export enum SolverStatus {
  Inactive = 0,
  Active = 1,
  Jailed = 2,
  Banned = 3,
}

export enum ReceiptStatus {
  None = 0,
  Posted = 1,
  Challenged = 2,
  Finalized = 3,
  Slashed = 4,
}

export enum DisputeReason {
  None = 0x00,
  Timeout = 0x01,
  MinOutViolation = 0x02,
  WrongToken = 0x03,
  WrongChain = 0x04,
  WrongRecipient = 0x05,
  ReceiptForgery = 0x06,
  InvalidSignature = 0x07,
}

export enum DisputeStatus {
  None = 0,
  Open = 1,
  EvidenceSubmitted = 2,
  Escalated = 3,
  Resolved = 4,
}

export enum DisputeResolution {
  None = 0,
  SolverWins = 1,
  ChallengerWins = 2,
  Split = 3,
  Timeout = 4,
}

// ============ Structs ============

export interface SolverInfo {
  bondAmount: bigint;
  lockedAmount: bigint;
  reputation: bigint;
  registrationTime: bigint;
  lastActiveTime: bigint;
  totalIntents: bigint;
  successfulIntents: bigint;
  jailCount: number;
  status: SolverStatus;
  pendingWithdrawal: bigint;
  withdrawalRequestTime: bigint;
}

export interface IntentReceipt {
  solver: string;
  intentHash: string;
  constraintsHash: string;
  outcomeHash: string;
  evidenceHash: string;
  postedAt: bigint;
  deadline: bigint;
  solverSig: string;
  status: ReceiptStatus;
}

export interface Challenge {
  challenger: string;
  reason: DisputeReason;
  bond: bigint;
  timestamp: bigint;
}

export interface Dispute {
  intentHash: string;
  challenger: string;
  solver: string;
  reason: DisputeReason;
  solverEvidence: string;
  challengerEvidence: string;
  createdAt: bigint;
  evidenceDeadline: bigint;
  status: DisputeStatus;
  resolution: DisputeResolution;
}

// ============ Input Types ============

export interface PostReceiptParams {
  intentHash: string;
  constraintsHash: string;
  outcomeHash: string;
  evidenceHash: string;
  deadline: bigint;
  solverSig: string;
}

export interface ChallengeParams {
  intentHash: string;
  reason: DisputeReason;
}

// ============ Config ============

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  nativeToken: string;
  solverRegistry: string;
  intentReceiptHub: string;
  disputeModule: string;
  erc8004Adapter?: string;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    nativeToken: 'ETH',
    solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
    intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
    disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
  },
  amoy: {
    chainId: 80002,
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    nativeToken: 'POL',
    // Placeholder addresses - update after deployment
    solverRegistry: '0x0000000000000000000000000000000000000000',
    intentReceiptHub: '0x0000000000000000000000000000000000000000',
    disputeModule: '0x0000000000000000000000000000000000000000',
    erc8004Adapter: '0x0000000000000000000000000000000000000000',
  },
  // mainnet: { ... } // Add after mainnet deployment
};

// Chain ID to network name mapping
export const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  11155111: 'sepolia',
  80002: 'amoy',
  // 1: 'mainnet',
  // 137: 'polygon',
};

// Get chain config by chain ID
export function getChainConfig(chainId: number): ChainConfig | undefined {
  const networkName = CHAIN_ID_TO_NETWORK[chainId];
  return networkName ? CHAIN_CONFIGS[networkName] : undefined;
}

// Supported chain IDs
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_ID_TO_NETWORK).map(Number);

// ============ Constants ============

export const CONSTANTS = {
  MINIMUM_BOND: BigInt('100000000000000000'), // 0.1 ETH
  WITHDRAWAL_COOLDOWN: BigInt(7 * 24 * 60 * 60), // 7 days
  MAX_JAILS: 3,
  CHALLENGE_WINDOW: BigInt(60 * 60), // 1 hour
  CHALLENGER_BOND_BPS: 1000, // 10%
  EVIDENCE_WINDOW: BigInt(24 * 60 * 60), // 24 hours
  ARBITRATION_TIMEOUT: BigInt(7 * 24 * 60 * 60), // 7 days
  // Bond thresholds for wallet API
  BOND_THRESHOLD_MEDIUM: BigInt('500000000000000000'), // 0.5 ETH
  BOND_THRESHOLD_HIGH: BigInt('1000000000000000000'), // 1.0 ETH
} as const;

// ============ Across Adapter Types ============

export interface AcrossDeposit {
  originChainId: bigint;
  destinationChainId: bigint;
  originToken: string;
  destinationToken: string;
  inputAmount: bigint;
  outputAmount: bigint;
  depositor: string;
  recipient: string;
  fillDeadline: bigint;
  depositId: string;
  exclusivityDeadline: bigint;
  exclusiveRelayer: string;
  message: string;
}

export interface AcrossFillData {
  fillChainId: bigint;
  tokenFilled: string;
  amountFilled: bigint;
  recipientFilled: string;
  fillTxHash: string;
  filledAt: bigint;
}

export interface AcrossReceipt {
  receiptId: string;
  depositId: string;
  intentHash: string;
  solverId: string;
  postedAt: bigint;
  expiry: bigint;
}
