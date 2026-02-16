/**
 * Receipt Signing and Posting Module
 *
 * Signs receipts as client and posts to IntentReceiptHub.
 */

import { Wallet, keccak256, toUtf8Bytes } from 'ethers';
import {
  signAsClient,
  postReceiptV2,
  getTransactionUrl,
  getAddressUrl,
  type IntentReceiptV2,
  type PostReceiptResult,
} from '@irsb/x402-integration';

export interface SignAndPostParams {
  /** The receipt from the service (solver-signed) */
  receipt: IntentReceiptV2;
  /** EIP-712 signing payload from the service */
  signingPayload: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    message: Record<string, unknown>;
  };
  /** Chain ID */
  chainId: number;
  /** IntentReceiptHub address */
  hubAddress: string;
}

export interface SignAndPostResult {
  /** Transaction hash */
  txHash: string;
  /** Receipt ID on-chain */
  receiptId: string;
  /** Block number */
  blockNumber: number;
  /** Gas used */
  gasUsed: bigint;
  /** Etherscan links */
  links: {
    transaction?: string;
    hub?: string;
  };
}

/**
 * Sign receipt as client and post to IntentReceiptHub.
 *
 * @param wallet - Client wallet for signing and paying gas
 * @param params - Signing and posting parameters
 * @param rpcUrl - RPC URL for posting
 * @returns Post result with links
 */
export async function signAndPostReceipt(
  wallet: Wallet,
  params: SignAndPostParams,
  rpcUrl: string
): Promise<SignAndPostResult> {
  const { receipt, signingPayload, chainId, hubAddress } = params;

  console.log(`[Post] Signing receipt as client...`);

  // Parse receipt fields that might be strings
  const receiptToSign: IntentReceiptV2 = {
    ...receipt,
    createdAt: typeof receipt.createdAt === 'string' ? BigInt(receipt.createdAt) : receipt.createdAt,
    expiry: typeof receipt.expiry === 'string' ? BigInt(receipt.expiry) : receipt.expiry,
    privacyLevel: typeof receipt.privacyLevel === 'string' ? parseInt(receipt.privacyLevel, 10) : receipt.privacyLevel,
  };

  // Sign as client (dual attestation)
  const clientSig = await signAsClient(
    receiptToSign,
    wallet.privateKey,
    chainId,
    hubAddress
  );

  const signedReceipt: IntentReceiptV2 = {
    ...receiptToSign,
    clientSig,
  };

  console.log(`[Post] Client signature: ${clientSig.slice(0, 20)}...`);
  console.log(`[Post] Posting to IntentReceiptHub...`);

  // Post to hub
  const result = await postReceiptV2(signedReceipt, {
    rpcUrl,
    hubAddress,
    solverSigner: wallet.privateKey, // Using client wallet to pay for gas
  });

  console.log(`[Post] Receipt posted!`);
  console.log(`[Post] Receipt ID: ${result.receiptId}`);
  console.log(`[Post] Transaction: ${result.txHash}`);
  console.log(`[Post] Block: ${result.blockNumber}`);

  return {
    txHash: result.txHash,
    receiptId: result.receiptId,
    blockNumber: result.blockNumber,
    gasUsed: result.gasUsed,
    links: {
      transaction: getTransactionUrl(result.txHash, chainId),
      hub: getAddressUrl(hubAddress, chainId),
    },
  };
}

/**
 * Format receipt for display.
 *
 * @param receipt - The receipt to format
 * @returns Formatted string
 */
export function formatReceipt(receipt: Record<string, unknown>): string {
  const lines = [
    'Receipt Details:',
    `  Intent Hash: ${receipt.intentHash}`,
    `  Constraints Hash: ${receipt.constraintsHash}`,
    `  Route Hash: ${receipt.routeHash}`,
    `  Outcome Hash: ${receipt.outcomeHash}`,
    `  Evidence Hash: ${receipt.evidenceHash}`,
    `  Metadata Commitment: ${receipt.metadataCommitment}`,
    `  Privacy Level: ${receipt.privacyLevel}`,
    `  Created At: ${receipt.createdAt}`,
    `  Expiry: ${receipt.expiry}`,
    `  Solver ID: ${receipt.solverId}`,
  ];

  if (receipt.solverSig) {
    lines.push(`  Solver Signature: ${(receipt.solverSig as string).slice(0, 20)}...`);
  }

  if (receipt.clientSig) {
    lines.push(`  Client Signature: ${(receipt.clientSig as string).slice(0, 20)}...`);
  }

  return lines.join('\n');
}
