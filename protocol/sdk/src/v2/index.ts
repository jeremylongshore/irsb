/**
 * IRSB V2 Module
 *
 * Provides V2 receipt types and helpers:
 * - Dual attestation (solver + client signatures)
 * - Privacy commitments
 * - Escrow integration
 * - EIP-712 typed data signing
 */

// Types
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
  type EIP712TypeField,
  // Constants
  V2_CONSTANTS,
} from './types';

// Receipt building and signing
export {
  RECEIPT_V2_TYPES,
  buildReceiptV2,
  getEIP712Domain,
  getReceiptV2TypedData,
  signReceiptV2,
  buildAndSignReceiptV2,
  computeReceiptV2Id,
  computeReceiptV2StructHash,
  verifyReceiptV2Signature,
  createTestReceiptV2,
} from './receipts';
