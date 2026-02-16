/**
 * IRSB Privacy Module
 *
 * Provides privacy-preserving primitives for V2 receipts:
 * - Commitment generation and verification
 * - CID/pointer validation
 * - Optional Lit Protocol integration for encryption
 */

// Types
export type {
  MetadataPayload,
  CommitmentResult,
  PointerValidation,
  EvidenceBundle,
  PrivacyConfig,
  AccessControlCondition,
  EncryptedPayload,
  UploadResult,
  PrivacyOperationResult,
  CIDFormat,
} from './types';

// Commitment functions
export {
  METADATA_SCHEMA_VERSION,
  generateNonce,
  canonicalize,
  keccak256,
  generateMetadataCommitment,
  verifyCommitment,
  verifyCommitmentRaw,
  generateEvidenceCommitment,
  validatePointer,
  formatCiphertextPointer,
  combineHashes,
  structHash,
  computeRequestFingerprint,
  computeTermsHash,
} from './commitments';

// Lit Protocol (optional)
export type { LitNetwork, LitConfig, AuthSig } from './litProtocol';
export {
  DEFAULT_LIT_NETWORK,
  createBalanceCondition,
  createTokenBalanceCondition,
  createNFTOwnershipCondition,
  createAddressCondition,
  createReceiptAccessConditions,
  simulateEncryption,
  simulateDecryption,
  isLitAvailable,
  getLitClient,
  generateAuthSig,
  createPrivacyConfig,
  encryptWithLit,
} from './litProtocol';
