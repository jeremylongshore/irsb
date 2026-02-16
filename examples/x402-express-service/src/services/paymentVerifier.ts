/**
 * Payment Verifier
 *
 * Verifies ETH payments on-chain by querying the blockchain.
 * Supports both real verification and mock mode for testing.
 */

import { JsonRpcProvider, formatEther } from 'ethers';

export interface PaymentProof {
  /** Transaction hash or payment reference */
  paymentRef: string;
  /** Payer's address */
  payer: string;
  /** Optional signature for additional verification */
  signature?: string;
  /** Timestamp of payment */
  timestamp?: number;
}

export interface VerificationOptions {
  /** Expected payment amount in wei */
  expectedAmount: string;
  /** Expected asset (ETH for native) */
  expectedAsset: string;
  /** Expected chain ID */
  expectedChainId: number;
  /** Expected recipient address (service wallet) */
  expectedRecipient?: string;
  /** Number of block confirmations required (default: 2) */
  confirmations?: number;
  /** Skip on-chain verification (for testing) */
  skipOnChain?: boolean;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  confirmedAmount?: string;
  confirmedAsset?: string;
  blockNumber?: number;
  confirmations?: number;
}

/**
 * Get the Ethereum provider.
 */
function getProvider(): JsonRpcProvider {
  const rpcUrl = process.env.RPC_URL || 'https://rpc.sepolia.org';
  return new JsonRpcProvider(rpcUrl);
}

/**
 * Verify a payment proof by querying the blockchain.
 *
 * @param proof - The payment proof from the client
 * @param options - Expected payment parameters
 * @returns Verification result
 */
export async function verifyPayment(
  proof: PaymentProof,
  options: VerificationOptions
): Promise<VerificationResult> {
  // Basic validation
  if (!proof.paymentRef) {
    return { valid: false, reason: 'Missing paymentRef' };
  }

  if (!proof.payer) {
    return { valid: false, reason: 'Missing payer address' };
  }

  // Validate paymentRef format (should be a transaction hash)
  const isTxHash = /^0x[a-fA-F0-9]{64}$/.test(proof.paymentRef);
  const isMockProof = proof.paymentRef.startsWith('mock-proof-');

  if (!isTxHash && !isMockProof) {
    return { valid: false, reason: 'Invalid paymentRef format' };
  }

  // Validate payer address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(proof.payer)) {
    return { valid: false, reason: 'Invalid payer address format' };
  }

  // Allow mock proofs for testing
  if (isMockProof || options.skipOnChain) {
    console.log(`[Payment Verifier] Mock/skip mode - accepting payment`);
    return {
      valid: true,
      confirmedAmount: options.expectedAmount,
      confirmedAsset: options.expectedAsset,
    };
  }

  // Real on-chain verification
  console.log(`[Payment Verifier] Verifying on-chain:`, {
    paymentRef: proof.paymentRef,
    payer: proof.payer,
    expected: {
      amount: formatEther(options.expectedAmount),
      asset: options.expectedAsset,
      recipient: options.expectedRecipient,
    },
  });

  try {
    const provider = getProvider();
    const requiredConfirmations = options.confirmations ?? 2;

    // Get transaction
    const tx = await provider.getTransaction(proof.paymentRef);
    if (!tx) {
      return { valid: false, reason: 'Transaction not found on-chain' };
    }

    // Check payer matches
    if (tx.from.toLowerCase() !== proof.payer.toLowerCase()) {
      return {
        valid: false,
        reason: `Payer mismatch. Expected ${proof.payer}, got ${tx.from}`,
      };
    }

    // Only verify native ETH transfers
    if (options.expectedAsset === 'ETH') {
      // Check recipient if specified
      if (options.expectedRecipient) {
        if (tx.to?.toLowerCase() !== options.expectedRecipient.toLowerCase()) {
          return {
            valid: false,
            reason: `Recipient mismatch. Expected ${options.expectedRecipient}, got ${tx.to}`,
          };
        }
      }

      // Check amount
      const expectedWei = BigInt(options.expectedAmount);
      if (tx.value < expectedWei) {
        return {
          valid: false,
          reason: `Insufficient amount. Expected ${formatEther(expectedWei)} ETH, got ${formatEther(tx.value)} ETH`,
        };
      }
    }

    // Wait for confirmations
    console.log(`[Payment Verifier] Waiting for ${requiredConfirmations} confirmation(s)...`);
    const receipt = await tx.wait(requiredConfirmations);

    if (!receipt) {
      return { valid: false, reason: 'Transaction not confirmed' };
    }

    // Get current block for confirmation count
    const currentBlock = await provider.getBlockNumber();
    const confirmationCount = currentBlock - receipt.blockNumber + 1;

    console.log(`[Payment Verifier] Verified!`, {
      blockNumber: receipt.blockNumber,
      confirmations: confirmationCount,
      amount: formatEther(tx.value),
    });

    return {
      valid: true,
      confirmedAmount: tx.value.toString(),
      confirmedAsset: options.expectedAsset,
      blockNumber: receipt.blockNumber,
      confirmations: confirmationCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Payment Verifier] Error:`, message);
    return { valid: false, reason: `Verification failed: ${message}` };
  }
}

/**
 * Verify payment without waiting for confirmations.
 * Useful for quick checks, but less secure.
 *
 * @param proof - The payment proof from the client
 * @param options - Expected payment parameters
 * @returns Verification result
 */
export async function verifyPaymentQuick(
  proof: PaymentProof,
  options: VerificationOptions
): Promise<VerificationResult> {
  return verifyPayment(proof, { ...options, confirmations: 0 });
}

/**
 * Check if a transaction exists and is pending.
 *
 * @param txHash - Transaction hash
 * @returns true if transaction exists (pending or confirmed)
 */
export async function transactionExists(txHash: string): Promise<boolean> {
  try {
    const provider = getProvider();
    const tx = await provider.getTransaction(txHash);
    return tx !== null;
  } catch {
    return false;
  }
}

/**
 * Generate a mock payment proof for testing.
 *
 * @param payer - Payer address
 * @returns Mock payment proof
 */
export function generateMockPaymentProof(payer: string): PaymentProof {
  const mockTxHash =
    '0x' +
    Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return {
    paymentRef: mockTxHash,
    payer,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
