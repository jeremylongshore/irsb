/**
 * IRSB Privacy Types
 * Types for commitment generation and privacy-preserving operations
 */

/**
 * Metadata payload structure for commitment generation
 * This is the canonical schema for what gets committed on-chain
 */
export interface MetadataPayload {
  /** Schema version for forward compatibility */
  version: string;
  /** Timestamp when payload was created */
  timestamp: number;
  /** Unique nonce for replay protection */
  nonce: string;
  /** Arbitrary key-value metadata */
  data: Record<string, unknown>;
}

/**
 * Commitment result from generating a metadata commitment
 */
export interface CommitmentResult {
  /** The keccak256 commitment hash (32 bytes, 0x-prefixed) */
  commitment: string;
  /** Canonical JSON representation used for hashing */
  canonicalPayload: string;
  /** Original payload for reference */
  originalPayload: MetadataPayload;
}

/**
 * Pointer validation result
 */
export interface PointerValidation {
  /** Whether the pointer is valid */
  isValid: boolean;
  /** Validation error message if invalid */
  error?: string;
  /** Normalized pointer (trimmed, etc.) */
  normalizedPointer?: string;
}

/**
 * CID (Content Identifier) format for IPFS/Arweave pointers
 */
export type CIDFormat = 'base58btc' | 'base32' | 'raw';

/**
 * Evidence bundle structure
 */
export interface EvidenceBundle {
  /** Hash of the execution transaction */
  txHash?: string;
  /** Block number of execution */
  blockNumber?: number;
  /** Chain ID where execution occurred */
  chainId?: number;
  /** Additional proof data */
  proofs?: string[];
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Privacy configuration for receipt creation
 */
export interface PrivacyConfig {
  /** Whether to encrypt the payload */
  encrypt: boolean;
  /** Access control conditions (for Lit Protocol) */
  accessConditions?: AccessControlCondition[];
  /** Storage provider preference */
  storageProvider?: 'ipfs' | 'arweave' | 'custom';
}

/**
 * Lit Protocol access control condition
 */
export interface AccessControlCondition {
  /** Condition type */
  conditionType: 'evmBasic' | 'evmContract' | 'cosmos' | 'solRpc' | 'unified';
  /** Contract address (for contract conditions) */
  contractAddress?: string;
  /** Chain ID */
  chain: string;
  /** Method to call (for contract conditions) */
  method?: string;
  /** Parameters for the method */
  parameters?: string[];
  /** Return value info */
  returnValueTest?: {
    comparator: string;
    value: string;
  };
  /** Standard contract type */
  standardContractType?: string;
}

/**
 * Encrypted payload result
 */
export interface EncryptedPayload {
  /** Encrypted ciphertext (base64) */
  ciphertext: string;
  /** Hash of the data that was encrypted */
  dataToEncryptHash: string;
  /** Access control conditions used */
  accessControlConditions: AccessControlCondition[];
  /** Encryption metadata */
  encryptionMetadata?: {
    /** Lit network used */
    network: string;
    /** Key type */
    keyType: string;
    /** Timestamp */
    encryptedAt: number;
  };
}

/**
 * Upload result for storage providers
 */
export interface UploadResult {
  /** Content identifier (CID or transaction ID) */
  cid: string;
  /** Full URL to access the content */
  url?: string;
  /** Storage provider used */
  provider: 'ipfs' | 'arweave' | 'custom';
  /** Size of uploaded content in bytes */
  size?: number;
}

/**
 * Full privacy operation result
 */
export interface PrivacyOperationResult {
  /** The commitment hash */
  commitment: string;
  /** Pointer to encrypted/stored content */
  pointer: string;
  /** Whether payload was encrypted */
  encrypted: boolean;
  /** Upload result if content was stored */
  upload?: UploadResult;
  /** Encryption result if payload was encrypted */
  encryption?: EncryptedPayload;
}
