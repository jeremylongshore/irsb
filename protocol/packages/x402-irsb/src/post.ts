/**
 * Receipt Posting Helpers
 *
 * Functions for posting signed receipts to the IRSB IntentReceiptHub.
 */

import { JsonRpcProvider, Wallet, Contract, Interface } from 'ethers';
import type { IntentReceiptV2, PostX402ReceiptOptions, X402ToReceiptParams } from './types.js';
import { buildReceiptV2WithConfig } from './receipt.js';
import { signReceiptDual, signAsService } from './signing.js';

/**
 * Minimal IntentReceiptHub ABI for posting receipts
 */
const HUB_ABI = [
  'function postReceiptV2((bytes32 intentHash, bytes32 constraintsHash, bytes32 routeHash, bytes32 outcomeHash, bytes32 evidenceHash, bytes32 metadataCommitment, string ciphertextPointer, uint8 privacyLevel, bytes32 escrowId, uint64 createdAt, uint64 expiry, bytes32 solverId, bytes solverSig, bytes clientSig) receipt) returns (bytes32 receiptId)',
  'function postReceipt((bytes32 intentHash, bytes32 constraintsHash, bytes32 routeHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 createdAt, uint64 expiry, bytes32 solverId, bytes solverSig) receipt) returns (bytes32 receiptId)',
  'function computeReceiptId((bytes32 intentHash, bytes32 constraintsHash, bytes32 routeHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 createdAt, uint64 expiry, bytes32 solverId, bytes solverSig) receipt) view returns (bytes32)',
  'event ReceiptPosted(bytes32 indexed receiptId, bytes32 indexed intentHash, bytes32 indexed solverId, uint64 expiry)',
];

/**
 * Result of posting a receipt
 */
export interface PostReceiptResult {
  /** Transaction hash */
  txHash: string;
  /** Receipt ID returned by the contract */
  receiptId: string;
  /** Block number where receipt was posted */
  blockNumber: number;
  /** Gas used */
  gasUsed: bigint;
}

/**
 * Post a signed ReceiptV2 to the IntentReceiptHub.
 *
 * @param receipt - The signed receipt
 * @param options - Posting options
 * @returns Post result with receipt ID
 */
export async function postReceiptV2(
  receipt: IntentReceiptV2,
  options: PostX402ReceiptOptions
): Promise<PostReceiptResult> {
  const provider = new JsonRpcProvider(options.rpcUrl);
  const wallet = new Wallet(options.solverSigner, provider);
  const hub = new Contract(options.hubAddress, HUB_ABI, wallet);

  // Build the receipt struct for the contract
  const receiptStruct = {
    intentHash: receipt.intentHash,
    constraintsHash: receipt.constraintsHash,
    routeHash: receipt.routeHash,
    outcomeHash: receipt.outcomeHash,
    evidenceHash: receipt.evidenceHash,
    metadataCommitment: receipt.metadataCommitment,
    ciphertextPointer: receipt.ciphertextPointer,
    privacyLevel: receipt.privacyLevel,
    escrowId: receipt.escrowId,
    createdAt: receipt.createdAt,
    expiry: receipt.expiry,
    solverId: receipt.solverId,
    solverSig: receipt.solverSig,
    clientSig: receipt.clientSig,
  };

  // Send transaction
  const tx = await hub.postReceiptV2(receiptStruct, {
    gasLimit: options.gasLimit,
  });

  // Wait for confirmation
  const txReceipt = await tx.wait();

  // Extract receipt ID from event
  const iface = new Interface(HUB_ABI);
  const receiptPostedEvent = txReceipt.logs
    .map((log: { topics: string[]; data: string }) => {
      try {
        return iface.parseLog(log);
      } catch (error) {
        // Log parsing errors for debugging (expected for non-matching logs)
        console.debug('[x402-irsb] Log parsing skipped:', error instanceof Error ? error.message : error);
        return null;
      }
    })
    .find((parsed: { name: string } | null) => parsed?.name === 'ReceiptPosted');

  const receiptId = receiptPostedEvent?.args?.receiptId ?? '';

  return {
    txHash: txReceipt.hash,
    receiptId,
    blockNumber: txReceipt.blockNumber,
    gasUsed: txReceipt.gasUsed,
  };
}

/**
 * Build, sign, and post a receipt from x402 payload in one call.
 *
 * @param params - Receipt build parameters
 * @param options - Posting options
 * @returns Post result with receipt ID
 */
export async function postReceiptV2FromX402(
  params: X402ToReceiptParams,
  options: PostX402ReceiptOptions
): Promise<PostReceiptResult> {
  // Get chain ID from provider
  const provider = new JsonRpcProvider(options.rpcUrl);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  // Build receipt with correct chain config
  const { receiptV2 } = buildReceiptV2WithConfig(params, chainId, options.hubAddress);

  // Sign the receipt
  let signedReceipt: IntentReceiptV2;
  if (options.clientSigner) {
    // Dual attestation mode
    signedReceipt = await signReceiptDual(
      receiptV2,
      options.solverSigner,
      options.clientSigner,
      chainId,
      options.hubAddress
    );
  } else {
    // Solver-only signature (compatible with V1)
    const solverSig = await signAsService(
      receiptV2,
      options.solverSigner,
      chainId,
      options.hubAddress
    );
    signedReceipt = { ...receiptV2, solverSig };
  }

  // Post to hub
  return postReceiptV2(signedReceipt, options);
}

/**
 * Estimate gas for posting a receipt.
 *
 * @param receipt - The receipt to post
 * @param options - Posting options
 * @returns Estimated gas
 */
export async function estimatePostGas(
  receipt: IntentReceiptV2,
  options: Omit<PostX402ReceiptOptions, 'gasLimit'>
): Promise<bigint> {
  const provider = new JsonRpcProvider(options.rpcUrl);
  const wallet = new Wallet(options.solverSigner, provider);
  const hub = new Contract(options.hubAddress, HUB_ABI, wallet);

  const receiptStruct = {
    intentHash: receipt.intentHash,
    constraintsHash: receipt.constraintsHash,
    routeHash: receipt.routeHash,
    outcomeHash: receipt.outcomeHash,
    evidenceHash: receipt.evidenceHash,
    metadataCommitment: receipt.metadataCommitment,
    ciphertextPointer: receipt.ciphertextPointer,
    privacyLevel: receipt.privacyLevel,
    escrowId: receipt.escrowId,
    createdAt: receipt.createdAt,
    expiry: receipt.expiry,
    solverId: receipt.solverId,
    solverSig: receipt.solverSig,
    clientSig: receipt.clientSig,
  };

  return hub.postReceiptV2.estimateGas(receiptStruct);
}

/**
 * Check if a receipt has already been posted.
 *
 * @param receiptId - The receipt ID to check
 * @param rpcUrl - RPC URL
 * @param hubAddress - Hub address
 * @returns true if receipt exists
 */
export async function receiptExists(
  receiptId: string,
  rpcUrl: string,
  hubAddress: string
): Promise<boolean> {
  const provider = new JsonRpcProvider(rpcUrl);
  const hub = new Contract(
    hubAddress,
    ['function getReceipt(bytes32 receiptId) view returns (tuple, uint8)'],
    provider
  );

  try {
    const [, status] = await hub.getReceipt(receiptId);
    // Status 0 means not found (or Pending with no data)
    return status !== 0;
  } catch (error) {
    // Log error for debugging while returning false to indicate receipt not found
    console.error('[x402-irsb] Failed to check receipt existence:', error instanceof Error ? error.message : error);
    return false;
  }
}
