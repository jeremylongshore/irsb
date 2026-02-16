/**
 * IRSB Protocol SDK
 *
 * SDK for interacting with the IRSB (Intent Receipts & Solver Bonds) Protocol.
 *
 * @packageDocumentation
 */

// Main client
export { IRSBClient, type IRSBClientConfig } from './client';

// V1 Types
export {
  // Enums
  SolverStatus,
  ReceiptStatus,
  DisputeReason,
  DisputeStatus,
  DisputeResolution,
  // Structs
  type SolverInfo,
  type IntentReceipt,
  type Challenge,
  type Dispute,
  // Input types
  type PostReceiptParams,
  type ChallengeParams,
  // Config
  type ChainConfig,
  CHAIN_CONFIGS,
  CHAIN_ID_TO_NETWORK,
  SUPPORTED_CHAIN_IDS,
  getChainConfig,
  CONSTANTS,
} from './types';

// V2 Types and Helpers
export {
  // Enums
  PrivacyLevel,
  ReceiptV2Status,
  OptimisticDisputeStatus,
  EscrowStatus,
  // Structs
  type IntentReceiptV2,
  type OptimisticDispute,
  type Escrow,
  // Input types
  type PostReceiptV2Params,
  type BuildReceiptV2Params,
  type ReceiptV2TypedData,
  type EIP712Domain,
  // Constants
  V2_CONSTANTS,
  // Receipt building
  RECEIPT_V2_TYPES,
  buildReceiptV2,
  getEIP712Domain,
  getReceiptV2TypedData,
  signReceiptV2,
  buildAndSignReceiptV2,
  computeReceiptV2Id,
  verifyReceiptV2Signature,
  createTestReceiptV2,
} from './v2';

// Privacy Module
export {
  // Types
  type MetadataPayload,
  type CommitmentResult,
  type PointerValidation,
  type EvidenceBundle,
  type PrivacyConfig,
  type AccessControlCondition,
  type EncryptedPayload,
  // Commitment functions
  METADATA_SCHEMA_VERSION,
  generateNonce,
  canonicalize,
  generateMetadataCommitment,
  verifyCommitment,
  validatePointer,
  formatCiphertextPointer,
  combineHashes,
  computeRequestFingerprint,
  computeTermsHash,
  // Lit Protocol helpers
  type LitConfig,
  createBalanceCondition,
  createTokenBalanceCondition,
  createNFTOwnershipCondition,
  createAddressCondition,
  createReceiptAccessConditions,
  createPrivacyConfig,
  isLitAvailable,
} from './privacy';

// ABIs (for advanced usage)
export {
  SOLVER_REGISTRY_ABI,
  INTENT_RECEIPT_HUB_ABI,
  DISPUTE_MODULE_ABI,
  RECEIPT_V2_EXTENSION_ABI,
  OPTIMISTIC_DISPUTE_MODULE_ABI,
  ESCROW_VAULT_ABI,
} from './contracts/abis';

// Wallet API
export {
  WalletApi,
  createWalletApi,
  SUBGRAPH_URLS,
  type RiskScore,
  type Receipt,
  type RecentReceiptsResponse,
  type BondStatus,
} from './api/walletApi';

// Verification
export {
  verifyReceipt,
  formatVerifyResult,
  type VerifyResult,
  type VerifyOptions,
} from './verify';

// Delegation Types (EIP-7702 / ERC-7710)
export {
  // Core types
  type Caveat,
  type Delegation,
  type SettlementParams,
  type ExecutionParams,
  type StoredDelegation,
  // Enums
  DelegationStatus,
  // Config types
  type SpendLimitConfig,
  type TimeWindowConfig,
  type AllowedTargetsConfig,
  type AllowedMethodsConfig,
  type NonceConfig,
  // EIP-712
  DELEGATION_EIP712_TYPES,
  DELEGATION_EIP712_DOMAIN,
  // Contract addresses type
  type DelegationContracts,
} from './delegation/types';
