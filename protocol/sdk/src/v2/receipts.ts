/**
 * IRSB V2 Receipt Building and Signing
 *
 * Provides helpers for creating, signing, and posting V2 receipts
 * with dual attestation (solver + client signatures).
 */

import { ethers, Signer } from 'ethers';
import {
  IntentReceiptV2,
  BuildReceiptV2Params,
  ReceiptV2TypedData,
  EIP712Domain,
  PrivacyLevel,
  V2_CONSTANTS,
} from './types';
import { validatePointer } from '../privacy/commitments';

/**
 * EIP-712 type definitions for IntentReceiptV2
 */
export const RECEIPT_V2_TYPES = {
  IntentReceiptV2: [
    { name: 'intentHash', type: 'bytes32' },
    { name: 'constraintsHash', type: 'bytes32' },
    { name: 'routeHash', type: 'bytes32' },
    { name: 'outcomeHash', type: 'bytes32' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'createdAt', type: 'uint64' },
    { name: 'expiry', type: 'uint64' },
    { name: 'solverId', type: 'bytes32' },
    { name: 'client', type: 'address' },
    { name: 'metadataCommitment', type: 'bytes32' },
    { name: 'ciphertextPointer', type: 'string' },
    { name: 'privacyLevel', type: 'uint8' },
    { name: 'escrowId', type: 'bytes32' },
  ],
};

/**
 * Build a V2 receipt struct (unsigned)
 *
 * @param params - Receipt parameters
 * @returns Unsigned IntentReceiptV2
 * @throws If validation fails
 */
export function buildReceiptV2(params: BuildReceiptV2Params): Omit<IntentReceiptV2, 'solverSig' | 'clientSig'> {
  // Validate ciphertext pointer
  const pointerValidation = validatePointer(params.ciphertextPointer);
  if (!pointerValidation.isValid) {
    throw new Error(`Invalid ciphertext pointer: ${pointerValidation.error}`);
  }

  // Validate metadata commitment (must be valid bytes32)
  if (!ethers.isHexString(params.metadataCommitment, 32)) {
    throw new Error('Invalid metadata commitment: must be 32-byte hex string');
  }

  // Validate hash fields
  const hashFields = ['intentHash', 'constraintsHash', 'routeHash', 'outcomeHash', 'evidenceHash', 'solverId'];
  for (const field of hashFields) {
    const value = params[field as keyof BuildReceiptV2Params];
    if (typeof value === 'string' && !ethers.isHexString(value, 32)) {
      throw new Error(`Invalid ${field}: must be 32-byte hex string`);
    }
  }

  // Validate client address
  if (!ethers.isAddress(params.client)) {
    throw new Error('Invalid client address');
  }

  return {
    intentHash: params.intentHash,
    constraintsHash: params.constraintsHash,
    routeHash: params.routeHash,
    outcomeHash: params.outcomeHash,
    evidenceHash: params.evidenceHash,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
    expiry: params.expiry,
    solverId: params.solverId,
    client: params.client,
    metadataCommitment: params.metadataCommitment,
    ciphertextPointer: pointerValidation.normalizedPointer!,
    privacyLevel: params.privacyLevel ?? PrivacyLevel.SemiPublic,
    escrowId: params.escrowId ?? ethers.ZeroHash,
  };
}

/**
 * Get the EIP-712 domain for a receipt extension contract
 *
 * @param chainId - Chain ID
 * @param verifyingContract - ReceiptV2Extension contract address
 * @returns EIP-712 domain
 */
export function getEIP712Domain(chainId: number, verifyingContract: string): EIP712Domain {
  return {
    name: V2_CONSTANTS.EIP712_NAME,
    version: V2_CONSTANTS.EIP712_VERSION,
    chainId,
    verifyingContract,
  };
}

/**
 * Get EIP-712 typed data for signing a V2 receipt
 *
 * @param receipt - The receipt to sign (without signatures)
 * @param domain - EIP-712 domain
 * @returns Full typed data for signing
 */
export function getReceiptV2TypedData(
  receipt: Omit<IntentReceiptV2, 'solverSig' | 'clientSig'>,
  domain: EIP712Domain
): ReceiptV2TypedData {
  return {
    domain,
    types: RECEIPT_V2_TYPES,
    primaryType: 'IntentReceiptV2',
    message: {
      intentHash: receipt.intentHash,
      constraintsHash: receipt.constraintsHash,
      routeHash: receipt.routeHash,
      outcomeHash: receipt.outcomeHash,
      evidenceHash: receipt.evidenceHash,
      createdAt: receipt.createdAt.toString(),
      expiry: receipt.expiry.toString(),
      solverId: receipt.solverId,
      client: receipt.client,
      metadataCommitment: receipt.metadataCommitment,
      ciphertextPointer: receipt.ciphertextPointer,
      privacyLevel: receipt.privacyLevel,
      escrowId: receipt.escrowId,
    },
  };
}

/**
 * Sign a V2 receipt as solver or client
 *
 * @param receipt - The receipt to sign
 * @param signer - Ethers signer
 * @param domain - EIP-712 domain
 * @returns EIP-712 signature
 */
export async function signReceiptV2(
  receipt: Omit<IntentReceiptV2, 'solverSig' | 'clientSig'>,
  signer: Signer,
  domain: EIP712Domain
): Promise<string> {
  const typedData = getReceiptV2TypedData(receipt, domain);

  // Use ethers signTypedData
  const signature = await signer.signTypedData(
    typedData.domain,
    { IntentReceiptV2: typedData.types.IntentReceiptV2 },
    {
      ...typedData.message,
      // Convert BigInt strings back to BigInt for signing
      createdAt: BigInt(typedData.message.createdAt as string),
      expiry: BigInt(typedData.message.expiry as string),
    }
  );

  return signature;
}

/**
 * Build and sign a complete V2 receipt
 *
 * @param params - Receipt parameters
 * @param solverSigner - Solver's signer
 * @param clientSigner - Client's signer
 * @param domain - EIP-712 domain
 * @returns Fully signed IntentReceiptV2
 */
export async function buildAndSignReceiptV2(
  params: BuildReceiptV2Params,
  solverSigner: Signer,
  clientSigner: Signer,
  domain: EIP712Domain
): Promise<IntentReceiptV2> {
  // Build unsigned receipt
  const unsignedReceipt = buildReceiptV2(params);

  // Sign as solver
  const solverSig = await signReceiptV2(unsignedReceipt, solverSigner, domain);

  // Sign as client
  const clientSig = await signReceiptV2(unsignedReceipt, clientSigner, domain);

  return {
    ...unsignedReceipt,
    solverSig,
    clientSig,
  };
}

/**
 * Compute the receipt ID (deterministic from receipt fields)
 *
 * @param receipt - The receipt
 * @returns Receipt ID (bytes32)
 */
export function computeReceiptV2Id(receipt: Omit<IntentReceiptV2, 'solverSig' | 'clientSig'>): string {
  const packed = ethers.solidityPacked(
    ['bytes32', 'bytes32', 'uint64', 'bytes32'],
    [receipt.intentHash, receipt.solverId, receipt.createdAt, receipt.metadataCommitment]
  );
  return ethers.keccak256(packed);
}

/**
 * Compute the struct hash for a V2 receipt (for signature verification)
 *
 * Uses ethers.TypedDataEncoder for maintainable, standards-compliant hashing.
 *
 * @param receipt - The receipt
 * @returns Struct hash
 */
export function computeReceiptV2StructHash(receipt: Omit<IntentReceiptV2, 'solverSig' | 'clientSig'>): string {
  // Use ethers.TypedDataEncoder for proper EIP-712 struct hashing
  // This is more maintainable than manual encoding
  return ethers.TypedDataEncoder.hashStruct('IntentReceiptV2', RECEIPT_V2_TYPES, {
    intentHash: receipt.intentHash,
    constraintsHash: receipt.constraintsHash,
    routeHash: receipt.routeHash,
    outcomeHash: receipt.outcomeHash,
    evidenceHash: receipt.evidenceHash,
    createdAt: receipt.createdAt.toString(),
    expiry: receipt.expiry.toString(),
    solverId: receipt.solverId,
    client: receipt.client,
    metadataCommitment: receipt.metadataCommitment,
    ciphertextPointer: receipt.ciphertextPointer,
    privacyLevel: receipt.privacyLevel,
    escrowId: receipt.escrowId,
  });
}

/**
 * Verify a V2 receipt signature
 *
 * @param receipt - The receipt with signature
 * @param signature - The signature to verify
 * @param expectedSigner - Expected signer address
 * @param domain - EIP-712 domain
 * @returns True if signature is valid
 */
export function verifyReceiptV2Signature(
  receipt: Omit<IntentReceiptV2, 'solverSig' | 'clientSig'>,
  signature: string,
  expectedSigner: string,
  domain: EIP712Domain
): boolean {
  try {
    const typedData = getReceiptV2TypedData(receipt, domain);

    const recoveredAddress = ethers.verifyTypedData(
      typedData.domain,
      { IntentReceiptV2: typedData.types.IntentReceiptV2 },
      {
        ...typedData.message,
        createdAt: BigInt(typedData.message.createdAt as string),
        expiry: BigInt(typedData.message.expiry as string),
      },
      signature
    );

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Create a minimal receipt for testing/development
 *
 * @param overrides - Fields to override
 * @returns Receipt with test data
 */
export function createTestReceiptV2(
  overrides: Partial<BuildReceiptV2Params> = {}
): Omit<IntentReceiptV2, 'solverSig' | 'clientSig'> {
  const defaults: BuildReceiptV2Params = {
    intentHash: ethers.keccak256(ethers.toUtf8Bytes('test-intent')),
    constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('test-constraints')),
    routeHash: ethers.keccak256(ethers.toUtf8Bytes('test-route')),
    outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('test-outcome')),
    evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('test-evidence')),
    expiry: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24h from now
    solverId: ethers.keccak256(ethers.toUtf8Bytes('test-solver')),
    client: ethers.Wallet.createRandom().address,
    metadataCommitment: ethers.keccak256(ethers.toUtf8Bytes('test-metadata')),
    ciphertextPointer: 'QmTestCID123456789012345678901',
    privacyLevel: PrivacyLevel.SemiPublic,
  };

  return buildReceiptV2({ ...defaults, ...overrides });
}
