/**
 * EIP-712 Signing Helpers for ReceiptV2
 *
 * Provides functions for signing receipts as either solver or client.
 */

import { Wallet, TypedDataEncoder, keccak256, getBytes, recoverAddress } from 'ethers';
import type { IntentReceiptV2, EIP712TypedData } from './types.js';
import { getEIP712Domain, createSigningPayload } from './receipt.js';

/**
 * Sign a receipt as the solver (service provider).
 *
 * @param receipt - The receipt to sign
 * @param privateKey - Solver's private key
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns Signature bytes
 */
export async function signAsService(
  receipt: IntentReceiptV2,
  privateKey: string,
  chainId: number,
  hubAddress: string
): Promise<string> {
  const wallet = new Wallet(privateKey);
  const typedData = createSigningPayload(receipt, chainId, hubAddress);

  const signature = await wallet.signTypedData(
    typedData.domain,
    { IntentReceiptV2: typedData.types.IntentReceiptV2 },
    typedData.message
  );

  return signature;
}

/**
 * Sign a receipt as the client (payer).
 *
 * @param receipt - The receipt to sign
 * @param privateKey - Client's private key
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns Signature bytes
 */
export async function signAsClient(
  receipt: IntentReceiptV2,
  privateKey: string,
  chainId: number,
  hubAddress: string
): Promise<string> {
  // Client signature uses the same typed data structure
  return signAsService(receipt, privateKey, chainId, hubAddress);
}

/**
 * Sign a receipt with both solver and client signatures.
 *
 * @param receipt - The receipt to sign (will be mutated)
 * @param solverPrivateKey - Solver's private key
 * @param clientPrivateKey - Client's private key
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns The signed receipt
 */
export async function signReceiptDual(
  receipt: IntentReceiptV2,
  solverPrivateKey: string,
  clientPrivateKey: string,
  chainId: number,
  hubAddress: string
): Promise<IntentReceiptV2> {
  const [solverSig, clientSig] = await Promise.all([
    signAsService(receipt, solverPrivateKey, chainId, hubAddress),
    signAsClient(receipt, clientPrivateKey, chainId, hubAddress),
  ]);

  return {
    ...receipt,
    solverSig,
    clientSig,
  };
}

/**
 * Recover the signer address from a receipt signature.
 *
 * @param receipt - The signed receipt
 * @param signature - The signature to verify
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns The signer's address
 */
export function recoverSigner(
  receipt: IntentReceiptV2,
  signature: string,
  chainId: number,
  hubAddress: string
): string {
  const typedData = createSigningPayload(receipt, chainId, hubAddress);

  const domain = typedData.domain;
  const types = { IntentReceiptV2: typedData.types.IntentReceiptV2 };
  const message = typedData.message;

  // Compute the typed data hash
  const hash = TypedDataEncoder.hash(domain, types, message);

  // Recover the address from signature
  return recoverAddress(hash, signature);
}

/**
 * Verify a solver signature on a receipt.
 *
 * @param receipt - The signed receipt
 * @param expectedSolver - Expected solver address
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns true if signature is valid and from expected solver
 */
export function verifySolverSignature(
  receipt: IntentReceiptV2,
  expectedSolver: string,
  chainId: number,
  hubAddress: string
): boolean {
  if (!receipt.solverSig || receipt.solverSig === '0x') {
    return false;
  }

  try {
    const recovered = recoverSigner(receipt, receipt.solverSig, chainId, hubAddress);
    return recovered.toLowerCase() === expectedSolver.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Verify a client signature on a receipt.
 *
 * @param receipt - The signed receipt
 * @param expectedClient - Expected client address
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns true if signature is valid and from expected client
 */
export function verifyClientSignature(
  receipt: IntentReceiptV2,
  expectedClient: string,
  chainId: number,
  hubAddress: string
): boolean {
  if (!receipt.clientSig || receipt.clientSig === '0x') {
    return false;
  }

  try {
    const recovered = recoverSigner(receipt, receipt.clientSig, chainId, hubAddress);
    return recovered.toLowerCase() === expectedClient.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Get the typed data hash for a receipt (for manual verification).
 *
 * @param receipt - The receipt
 * @param chainId - Chain ID
 * @param hubAddress - IntentReceiptHub address
 * @returns The EIP-712 typed data hash
 */
export function getReceiptTypedDataHash(
  receipt: IntentReceiptV2,
  chainId: number,
  hubAddress: string
): string {
  const typedData = createSigningPayload(receipt, chainId, hubAddress);

  return TypedDataEncoder.hash(
    typedData.domain,
    { IntentReceiptV2: typedData.types.IntentReceiptV2 },
    typedData.message
  );
}

/**
 * Create a personal_sign compatible message hash (for V1 compatibility).
 *
 * This is used when the hub expects personal_sign instead of EIP-712.
 *
 * @param receipt - The receipt
 * @returns Message hash for personal_sign
 */
export function getPersonalSignHash(receipt: IntentReceiptV2): string {
  return keccak256(
    new TextEncoder().encode(
      JSON.stringify({
        intentHash: receipt.intentHash,
        constraintsHash: receipt.constraintsHash,
        routeHash: receipt.routeHash,
        outcomeHash: receipt.outcomeHash,
        evidenceHash: receipt.evidenceHash,
        createdAt: receipt.createdAt.toString(),
        expiry: receipt.expiry.toString(),
        solverId: receipt.solverId,
      })
    )
  );
}
