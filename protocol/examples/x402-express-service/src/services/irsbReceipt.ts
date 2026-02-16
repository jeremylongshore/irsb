/**
 * IRSB Receipt Service
 *
 * Generates and posts IRSB ReceiptV2 from x402 payment artifacts.
 */

import { Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import {
  createPayload,
  buildReceiptV2WithConfig,
  signAsService,
  validateReceiptV2,
  computePayloadCommitment,
  PrivacyLevel,
  type X402ReceiptPayload,
  type IntentReceiptV2,
} from 'irsb-x402';
import { PaymentProof } from './paymentVerifier.js';

export interface GenerateReceiptOptions {
  /** Payment proof from x402 header */
  paymentProof: PaymentProof;
  /** Request path */
  endpoint: string;
  /** Result data (will be hashed) */
  resultData: unknown;
  /** Price in wei */
  priceWei: string;
  /** Payment asset */
  asset: string;
}

export interface ReceiptGenerationResult {
  /** The signed receipt */
  receipt: IntentReceiptV2;
  /** The full payload (for off-chain storage) */
  payload: X402ReceiptPayload;
  /** Metadata commitment (stored on-chain) */
  metadataCommitment: string;
  /** Request ID for tracking */
  requestId: string;
}

/**
 * Generate an IRSB ReceiptV2 for a completed x402 request.
 *
 * @param options - Receipt generation options
 * @returns Signed receipt with payload
 */
export async function generateReceipt(
  options: GenerateReceiptOptions
): Promise<ReceiptGenerationResult> {
  const { paymentProof, endpoint, resultData, priceWei, asset } = options;

  // Get configuration from environment
  const chainId = parseInt(process.env.CHAIN_ID || '11155111', 10);
  const hubAddress = process.env.IRSB_HUB_ADDRESS || '';
  const solverPrivateKey = process.env.SERVICE_PRIVATE_KEY || '';
  const solverId = process.env.SERVICE_SOLVER_ID || '';
  const serviceDomain = process.env.SERVICE_DOMAIN || 'api.example.com';

  if (!solverPrivateKey || !solverId || !hubAddress) {
    throw new Error(
      'Missing required environment variables: SERVICE_PRIVATE_KEY, SERVICE_SOLVER_ID, IRSB_HUB_ADDRESS'
    );
  }

  // Generate request ID
  const requestId = uuidv4();

  // Compute result digest (hash of response data)
  const resultDigest = keccak256(toUtf8Bytes(JSON.stringify(resultData)));

  // Create x402 payload
  const payload = createPayload({
    service: {
      serviceId: solverId,
      endpoint: `POST ${endpoint}`,
      domain: serviceDomain,
    },
    payment: {
      paymentRef: paymentProof.paymentRef,
      asset: asset,
      amount: priceWei,
      chainId: chainId,
    },
    request: {
      requestId: requestId,
    },
    response: {
      // In production, you would upload result to IPFS and use the CID
      resultPointer: `data:${resultDigest}`,
      resultDigest: resultDigest,
    },
  });

  // Build ReceiptV2
  const result = buildReceiptV2WithConfig(
    {
      payload,
      ciphertextPointer: payload.response.resultPointer,
      solverId,
      privacyLevel: PrivacyLevel.SemiPublic,
    },
    chainId,
    hubAddress
  );

  // Validate receipt
  if (!validateReceiptV2(result.receiptV2)) {
    throw new Error('Generated receipt failed validation');
  }

  // Sign as service
  const solverSig = await signAsService(
    result.receiptV2,
    solverPrivateKey,
    chainId,
    hubAddress
  );

  const signedReceipt: IntentReceiptV2 = {
    ...result.receiptV2,
    solverSig,
  };

  // Compute metadata commitment
  const metadataCommitment = computePayloadCommitment(payload);

  console.log(`[IRSB Receipt] Generated receipt for request ${requestId}:`, {
    intentHash: signedReceipt.intentHash.slice(0, 18) + '...',
    metadataCommitment: metadataCommitment.slice(0, 18) + '...',
    solverId: solverId.slice(0, 18) + '...',
  });

  return {
    receipt: signedReceipt,
    payload,
    metadataCommitment,
    requestId,
  };
}

/**
 * Format receipt for API response.
 *
 * Returns a subset of fields safe for client consumption.
 */
export function formatReceiptForResponse(result: ReceiptGenerationResult) {
  return {
    requestId: result.requestId,
    receipt: {
      intentHash: result.receipt.intentHash,
      constraintsHash: result.receipt.constraintsHash,
      routeHash: result.receipt.routeHash,
      outcomeHash: result.receipt.outcomeHash,
      evidenceHash: result.receipt.evidenceHash,
      metadataCommitment: result.receipt.metadataCommitment,
      ciphertextPointer: result.receipt.ciphertextPointer,
      privacyLevel: result.receipt.privacyLevel,
      escrowId: result.receipt.escrowId,
      createdAt: result.receipt.createdAt.toString(),
      expiry: result.receipt.expiry.toString(),
      solverId: result.receipt.solverId,
      solverSig: result.receipt.solverSig,
    },
    // Include signing payload for client attestation (EIP-712 format)
    signingPayload: {
      domain: {
        name: 'IRSB IntentReceiptHub',
        version: '2',
        chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
        verifyingContract: process.env.IRSB_HUB_ADDRESS,
      },
      types: {
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
      },
      message: {
        intentHash: result.receipt.intentHash,
        constraintsHash: result.receipt.constraintsHash,
        routeHash: result.receipt.routeHash,
        outcomeHash: result.receipt.outcomeHash,
        evidenceHash: result.receipt.evidenceHash,
        metadataCommitment: result.receipt.metadataCommitment,
        ciphertextPointer: result.receipt.ciphertextPointer,
        privacyLevel: result.receipt.privacyLevel,
        escrowId: result.receipt.escrowId,
        createdAt: result.receipt.createdAt.toString(),
        expiry: result.receipt.expiry.toString(),
        solverId: result.receipt.solverId,
      },
    },
  };
}
