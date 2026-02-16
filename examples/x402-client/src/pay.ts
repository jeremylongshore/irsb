/**
 * Payment Execution Module
 *
 * Sends ETH payments on Sepolia testnet.
 */

import { JsonRpcProvider, Wallet, parseEther, formatEther } from 'ethers';

export interface PaymentParams {
  /** Recipient wallet address */
  recipient: string;
  /** Amount to send in wei (as string) */
  amountWei: string;
  /** Optional: Number of confirmations to wait for */
  confirmations?: number;
}

export interface PaymentResult {
  /** Transaction hash */
  txHash: string;
  /** Block number where transaction was mined */
  blockNumber: number;
  /** Gas used */
  gasUsed: bigint;
  /** Effective gas price */
  effectiveGasPrice: bigint;
  /** Total cost (value + gas) in wei */
  totalCost: bigint;
}

/**
 * Send ETH payment to a recipient.
 *
 * @param wallet - The wallet to send from
 * @param params - Payment parameters
 * @returns Payment result with transaction details
 */
export async function sendPayment(
  wallet: Wallet,
  params: PaymentParams
): Promise<PaymentResult> {
  const { recipient, amountWei, confirmations = 2 } = params;

  console.log(`[Payment] Sending ${formatEther(amountWei)} ETH to ${recipient}...`);

  // Check balance
  const balance = await wallet.provider!.getBalance(wallet.address);
  const amount = BigInt(amountWei);

  if (balance < amount) {
    throw new Error(
      `Insufficient balance. Have ${formatEther(balance)} ETH, need ${formatEther(amountWei)} ETH`
    );
  }

  // Estimate gas
  const gasEstimate = await wallet.estimateGas({
    to: recipient,
    value: amount,
  });

  const feeData = await wallet.provider!.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0);
  const estimatedGasCost = gasEstimate * maxFeePerGas;

  if (balance < amount + estimatedGasCost) {
    throw new Error(
      `Insufficient balance for gas. Need ~${formatEther(estimatedGasCost)} ETH more for gas`
    );
  }

  console.log(`[Payment] Estimated gas: ${gasEstimate.toString()} units`);

  // Send transaction
  const tx = await wallet.sendTransaction({
    to: recipient,
    value: amount,
    gasLimit: gasEstimate,
  });

  console.log(`[Payment] Transaction sent: ${tx.hash}`);
  console.log(`[Payment] Waiting for ${confirmations} confirmation(s)...`);

  // Wait for confirmations
  const receipt = await tx.wait(confirmations);

  if (!receipt) {
    throw new Error('Transaction failed to confirm');
  }

  console.log(`[Payment] Confirmed in block ${receipt.blockNumber}`);

  // In ethers v6, gasPrice is always available on TransactionReceipt
  const effectiveGasPrice = receipt.gasPrice ?? BigInt(0);
  const gasCost = receipt.gasUsed * effectiveGasPrice;

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice,
    totalCost: amount + gasCost,
  };
}

/**
 * Check wallet balance.
 *
 * @param wallet - The wallet to check
 * @returns Balance in wei
 */
export async function getBalance(wallet: Wallet): Promise<bigint> {
  return wallet.provider!.getBalance(wallet.address);
}

/**
 * Create a wallet from private key and RPC URL.
 *
 * @param privateKey - Private key (with 0x prefix)
 * @param rpcUrl - RPC endpoint URL
 * @returns Connected wallet
 */
export function createWallet(privateKey: string, rpcUrl: string): Wallet {
  const provider = new JsonRpcProvider(rpcUrl);
  return new Wallet(privateKey, provider);
}
