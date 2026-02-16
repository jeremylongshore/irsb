/**
 * IRSB Privacy - Commitment Generation
 *
 * Provides deterministic commitment generation for V2 receipts.
 * Commitments are keccak256 hashes of canonicalized JSON payloads.
 *
 * Key principles:
 * - Deterministic: Same input always produces same commitment
 * - Privacy-preserving: Only commitment goes on-chain, payload stays off-chain
 * - Verifiable: Anyone with the plaintext can verify against commitment
 */

import { ethers } from 'ethers';
import {
  MetadataPayload,
  CommitmentResult,
  PointerValidation,
  EvidenceBundle,
} from './types';
import { V2_CONSTANTS } from '../v2/types';

/**
 * Current schema version for metadata payloads
 */
export const METADATA_SCHEMA_VERSION = '1.0.0';

/**
 * Generate a unique nonce for replay protection
 * @returns A random 32-byte hex string (0x-prefixed)
 */
export function generateNonce(): string {
  const bytes = ethers.randomBytes(32);
  return ethers.hexlify(bytes);
}

/**
 * Canonicalize a JSON object for deterministic hashing
 * Keys are sorted alphabetically at each level (deep sort)
 *
 * @param obj - Object to canonicalize
 * @returns Canonical JSON string
 */
export function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce(
          (sorted, key) => {
            sorted[key] = value[key];
            return sorted;
          },
          {} as Record<string, unknown>
        );
    }
    return value;
  });
}

/**
 * Compute keccak256 hash of a string
 * @param input - String to hash
 * @returns 32-byte hash (0x-prefixed)
 */
export function keccak256(input: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(input));
}

/**
 * Generate a metadata commitment from arbitrary data
 *
 * @param data - Key-value metadata to commit to
 * @param nonce - Optional nonce (generated if not provided)
 * @param timestamp - Optional timestamp (current time if not provided)
 * @returns Commitment result with hash and canonical payload
 *
 * @example
 * ```ts
 * const result = generateMetadataCommitment({
 *   orderId: 'order-123',
 *   amount: '1000000000000000000',
 *   token: '0x...',
 * });
 * console.log(result.commitment); // 0x...
 * ```
 */
export function generateMetadataCommitment(
  data: Record<string, unknown>,
  nonce?: string,
  timestamp?: number
): CommitmentResult {
  const payload: MetadataPayload = {
    version: METADATA_SCHEMA_VERSION,
    timestamp: timestamp ?? Math.floor(Date.now() / 1000),
    nonce: nonce ?? generateNonce(),
    data,
  };

  const canonicalPayload = canonicalize(payload);
  const commitment = keccak256(canonicalPayload);

  return {
    commitment,
    canonicalPayload,
    originalPayload: payload,
  };
}

/**
 * Verify a commitment against plaintext payload
 *
 * @param commitment - The commitment hash to verify
 * @param payload - The plaintext payload
 * @returns True if commitment matches payload
 */
export function verifyCommitment(commitment: string, payload: MetadataPayload): boolean {
  const canonicalPayload = canonicalize(payload);
  const computedCommitment = keccak256(canonicalPayload);
  return commitment.toLowerCase() === computedCommitment.toLowerCase();
}

/**
 * Verify commitment against raw canonical JSON
 *
 * @param commitment - The commitment hash to verify
 * @param canonicalJson - The canonical JSON string
 * @returns True if commitment matches
 */
export function verifyCommitmentRaw(commitment: string, canonicalJson: string): boolean {
  const computedCommitment = keccak256(canonicalJson);
  return commitment.toLowerCase() === computedCommitment.toLowerCase();
}

/**
 * Generate an evidence commitment from evidence bundle
 *
 * @param evidence - Evidence bundle with tx hash, proofs, etc.
 * @returns 32-byte evidence hash
 */
export function generateEvidenceCommitment(evidence: EvidenceBundle): string {
  const canonicalEvidence = canonicalize(evidence);
  return keccak256(canonicalEvidence);
}

/**
 * Validate a ciphertext pointer (CID format)
 *
 * Rules:
 * - Must be non-empty
 * - Max 64 characters
 * - Only alphanumeric characters (base58/base32 safe)
 *
 * @param pointer - The pointer to validate
 * @returns Validation result
 */
export function validatePointer(pointer: string): PointerValidation {
  // Trim whitespace
  const trimmed = pointer.trim();

  // Empty check
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Pointer cannot be empty',
    };
  }

  // Length check
  if (trimmed.length > V2_CONSTANTS.MAX_POINTER_LENGTH) {
    return {
      isValid: false,
      error: `Pointer exceeds maximum length of ${V2_CONSTANTS.MAX_POINTER_LENGTH} characters`,
    };
  }

  // Character check (alphanumeric only for base58/base32 CIDs)
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  if (!alphanumericRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Pointer must contain only alphanumeric characters (a-z, A-Z, 0-9)',
    };
  }

  return {
    isValid: true,
    normalizedPointer: trimmed,
  };
}

/**
 * Format a CID as a valid pointer
 * Extracts the raw CID from various URL formats
 *
 * @param input - CID or URL containing CID
 * @returns Normalized CID pointer
 * @throws If CID cannot be extracted or is invalid
 *
 * @example
 * ```ts
 * formatCiphertextPointer('ipfs://QmTest123'); // 'QmTest123'
 * formatCiphertextPointer('https://ipfs.io/ipfs/QmTest123'); // 'QmTest123'
 * formatCiphertextPointer('QmTest123'); // 'QmTest123'
 * ```
 */
export function formatCiphertextPointer(input: string): string {
  let cid = input.trim();

  // Remove common URL prefixes
  const prefixes = [
    'ipfs://',
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'ar://',
    'https://arweave.net/',
  ];

  for (const prefix of prefixes) {
    if (cid.startsWith(prefix)) {
      cid = cid.slice(prefix.length);
      break;
    }
  }

  // Remove any trailing path or query
  const slashIndex = cid.indexOf('/');
  if (slashIndex !== -1) {
    cid = cid.slice(0, slashIndex);
  }

  const questionIndex = cid.indexOf('?');
  if (questionIndex !== -1) {
    cid = cid.slice(0, questionIndex);
  }

  // Validate the result
  const validation = validatePointer(cid);
  if (!validation.isValid) {
    throw new Error(`Invalid CID format: ${validation.error}`);
  }

  return validation.normalizedPointer!;
}

/**
 * Compute deterministic hash from multiple inputs
 * Useful for creating intent hashes, constraints hashes, etc.
 *
 * @param inputs - Array of hex strings or values to hash
 * @returns Combined keccak256 hash
 */
export function combineHashes(...inputs: string[]): string {
  const packed = ethers.solidityPacked(
    inputs.map(() => 'bytes32'),
    inputs
  );
  return ethers.keccak256(packed);
}

/**
 * Create a hash from structured data using EIP-712 style encoding
 *
 * @param types - Array of Solidity types
 * @param values - Array of values matching the types
 * @returns keccak256 hash of packed values
 */
export function structHash(types: string[], values: unknown[]): string {
  const packed = ethers.solidityPacked(types, values);
  return ethers.keccak256(packed);
}

/**
 * Compute a request fingerprint from request components
 * Used for deterministic request identification
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param bodyHash - Hash of request body (or empty string)
 * @returns Request fingerprint hash
 */
export function computeRequestFingerprint(
  method: string,
  path: string,
  bodyHash: string = ''
): string {
  const data = canonicalize({
    method: method.toUpperCase(),
    path,
    bodyHash,
  });
  return keccak256(data);
}

/**
 * Compute terms hash from payment/constraint terms
 *
 * @param asset - Token address or symbol
 * @param amount - Amount as string (wei)
 * @param chainId - Chain ID
 * @param expiry - Expiry timestamp
 * @returns Terms commitment hash
 */
export function computeTermsHash(
  asset: string,
  amount: string,
  chainId: number,
  expiry: number
): string {
  return structHash(
    ['string', 'string', 'uint256', 'uint256'],
    [asset, amount, chainId, expiry]
  );
}
