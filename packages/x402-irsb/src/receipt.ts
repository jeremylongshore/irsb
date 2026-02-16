/**
 * ReceiptV2 Building from x402 Payloads
 *
 * Transforms x402 payment artifacts into IRSB ReceiptV2 structures
 * with proper field mapping and EIP-712 signing payload generation.
 */

import { ZeroHash, keccak256, solidityPacked } from 'ethers';
import type {
  X402ReceiptPayload,
  X402ToReceiptParams,
  X402ReceiptResult,
  IntentReceiptV2,
  EIP712TypedData,
} from './types.js';
import { PrivacyLevel } from './types.js';
import {
  computePayloadCommitment,
  computeIntentHash,
  computeTermsHash,
  computeRouteHash,
  computeEvidenceHash,
  formatCiphertextPointer,
} from './schema.js';

/**
 * EIP-712 type definitions for ReceiptV2
 */
export const RECEIPT_V2_TYPES = {
  IntentReceiptV2: [
    { name: 'intentHash', type: 'bytes32' },
    { name: 'constraintsHash', type: 'bytes32' },
    { name: 'routeHash', type: 'bytes32' },
    { name: 'outcomeHash', type: 'bytes32' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'metadataCommitment', type: 'bytes32' },
    { name: 'ciphertextPointer', type: 'string' },
    { name: 'privacyLevel', type: 'uint8' },
    { name: 'escrowId', type: 'bytes32' },
    { name: 'createdAt', type: 'uint64' },
    { name: 'expiry', type: 'uint64' },
    { name: 'solverId', type: 'bytes32' },
  ],
};

/**
 * Get EIP-712 domain for receipt signing.
 *
 * @param chainId - Chain ID for the domain
 * @param hubAddress - IntentReceiptHub contract address
 * @returns EIP-712 domain object
 */
export function getEIP712Domain(chainId: number, hubAddress: string) {
  return {
    name: 'IRSB IntentReceiptHub',
    version: '2',
    chainId,
    verifyingContract: hubAddress,
  };
}

/**
 * Build ReceiptV2 from x402 payment artifacts.
 *
 * Maps x402 payload fields to IRSB ReceiptV2 fields:
 * - intentHash: keccak256(serviceId + requestId)
 * - constraintsHash: keccak256(payment terms)
 * - routeHash: keccak256(domain + endpoint)
 * - outcomeHash: response.resultDigest
 * - evidenceHash: keccak256(paymentRef)
 * - metadataCommitment: keccak256(full canonical payload)
 *
 * @param params - Build parameters
 * @returns Receipt result with signing payloads
 */
export function buildReceiptV2FromX402(params: X402ToReceiptParams): X402ReceiptResult {
  const {
    payload,
    ciphertextPointer,
    privacyLevel = PrivacyLevel.SemiPublic,
    escrowId,
    solverId,
  } = params;

  // Compute deterministic hashes from x402 payload
  const intentHash = computeIntentHash(payload.service, payload.request.requestId);
  const constraintsHash = computeTermsHash(payload.payment, payload.timing.expiry);
  const routeHash = computeRouteHash(payload.service);
  const evidenceHash = computeEvidenceHash(payload.payment.paymentRef);
  const metadataCommitment = computePayloadCommitment(payload);

  // Build the receipt
  const receiptV2: IntentReceiptV2 = {
    intentHash,
    constraintsHash,
    routeHash,
    outcomeHash: payload.response.resultDigest,
    evidenceHash,
    metadataCommitment,
    ciphertextPointer: formatCiphertextPointer(ciphertextPointer),
    privacyLevel,
    escrowId: escrowId ?? ZeroHash,
    createdAt: BigInt(payload.timing.issuedAt),
    expiry: BigInt(payload.timing.expiry),
    solverId,
    solverSig: '0x', // To be filled after signing
    clientSig: '0x', // To be filled after signing
  };

  // Generate EIP-712 typed data for signing
  // Note: chainId and hubAddress would come from config in real usage
  const signingPayloads = {
    solver: createSigningPayload(receiptV2, 11155111, ZeroHash), // Placeholder
    client: createSigningPayload(receiptV2, 11155111, ZeroHash), // Placeholder
  };

  return {
    receiptV2,
    signingPayloads,
    debug: {
      metadataCommitment,
      intentHash,
      constraintsHash,
      routeHash,
    },
  };
}

/**
 * Create EIP-712 signing payload for a receipt.
 *
 * @param receipt - The receipt to sign
 * @param chainId - Chain ID
 * @param hubAddress - Hub contract address
 * @returns EIP-712 typed data for signing
 */
export function createSigningPayload(
  receipt: IntentReceiptV2,
  chainId: number,
  hubAddress: string
): EIP712TypedData {
  return {
    domain: getEIP712Domain(chainId, hubAddress),
    types: RECEIPT_V2_TYPES,
    primaryType: 'IntentReceiptV2',
    message: {
      intentHash: receipt.intentHash,
      constraintsHash: receipt.constraintsHash,
      routeHash: receipt.routeHash,
      outcomeHash: receipt.outcomeHash,
      evidenceHash: receipt.evidenceHash,
      metadataCommitment: receipt.metadataCommitment,
      ciphertextPointer: receipt.ciphertextPointer,
      privacyLevel: receipt.privacyLevel,
      escrowId: receipt.escrowId,
      createdAt: receipt.createdAt.toString(),
      expiry: receipt.expiry.toString(),
      solverId: receipt.solverId,
    },
  };
}

/**
 * Compute the receipt ID (deterministic hash of receipt data).
 *
 * @param receipt - The receipt to hash
 * @returns bytes32 receipt ID
 */
export function computeReceiptV2Id(receipt: IntentReceiptV2): string {
  return keccak256(
    solidityPacked(
      [
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
        'string',
        'uint8',
        'bytes32',
        'uint64',
        'uint64',
        'bytes32',
      ],
      [
        receipt.intentHash,
        receipt.constraintsHash,
        receipt.routeHash,
        receipt.outcomeHash,
        receipt.evidenceHash,
        receipt.metadataCommitment,
        receipt.ciphertextPointer,
        receipt.privacyLevel,
        receipt.escrowId,
        receipt.createdAt,
        receipt.expiry,
        receipt.solverId,
      ]
    )
  );
}

/**
 * Build ReceiptV2 with signing payloads configured for a specific chain.
 *
 * @param params - Build parameters
 * @param chainId - Target chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns Receipt result with properly configured signing payloads
 */
export function buildReceiptV2WithConfig(
  params: X402ToReceiptParams,
  chainId: number,
  hubAddress: string
): X402ReceiptResult {
  const result = buildReceiptV2FromX402(params);

  // Update signing payloads with correct config
  result.signingPayloads.solver = createSigningPayload(result.receiptV2, chainId, hubAddress);
  result.signingPayloads.client = createSigningPayload(result.receiptV2, chainId, hubAddress);

  return result;
}

/**
 * Validate that a receipt has all required fields.
 *
 * @param receipt - Receipt to validate
 * @returns true if valid
 */
export function validateReceiptV2(receipt: IntentReceiptV2): boolean {
  // Check required hash fields are not zero
  if (receipt.intentHash === ZeroHash) return false;
  if (receipt.constraintsHash === ZeroHash) return false;
  if (receipt.routeHash === ZeroHash) return false;
  if (receipt.outcomeHash === ZeroHash) return false;
  if (receipt.evidenceHash === ZeroHash) return false;
  if (receipt.metadataCommitment === ZeroHash) return false;
  if (receipt.solverId === ZeroHash) return false;

  // Check timing
  if (receipt.expiry <= receipt.createdAt) return false;

  // Check ciphertext pointer is not empty
  if (!receipt.ciphertextPointer || receipt.ciphertextPointer === '') return false;

  return true;
}
