/**
 * x402 Client Example
 *
 * Demonstrates the complete x402 payment → receipt → posting flow:
 *
 * 1. Load configuration from environment
 * 2. Make initial request → receive 402 with payment terms
 * 3. Execute payment on Sepolia (send ETH)
 * 4. Wait for confirmation (2 blocks)
 * 5. Retry request with X-Payment-Proof header
 * 6. Receive result + receipt + signingPayload
 * 7. Sign receipt as client (EIP-712)
 * 8. Post receipt to IntentReceiptHub
 * 9. Output: receiptId, txHash, etherscan links
 *
 * Usage:
 *   pnpm start [prompt]
 *
 * Example:
 *   pnpm start "Generate a creative story"
 */

import 'dotenv/config';
import { formatEther } from 'ethers';
import { SEPOLIA_CONFIG, getTransactionUrl } from '@irsb/x402-integration';

import { createWallet, sendPayment, getBalance } from './pay.js';
import { getPaymentTerms, requestWithProof, type PaymentProof } from './request.js';
import { signAndPostReceipt, formatReceipt } from './post.js';

// Configuration from environment
const config = {
  rpcUrl: process.env.RPC_URL || SEPOLIA_CONFIG.publicRpcUrl!,
  privateKey: process.env.PRIVATE_KEY || '',
  serviceUrl: process.env.SERVICE_URL || 'http://localhost:3000',
  serviceWallet: process.env.SERVICE_WALLET || '',
  hubAddress: process.env.IRSB_HUB_ADDRESS || SEPOLIA_CONFIG.hubAddress,
  chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
};

// Validation
function validateConfig() {
  if (!config.privateKey || config.privateKey === '0x...your-private-key-here...') {
    throw new Error('PRIVATE_KEY not configured. Copy .env.example to .env and set your key.');
  }

  if (!config.serviceWallet) {
    console.warn('[Warn] SERVICE_WALLET not set. Will use recipient from 402 response.');
  }

  console.log('[Config] RPC URL:', config.rpcUrl);
  console.log('[Config] Service URL:', config.serviceUrl);
  console.log('[Config] Chain ID:', config.chainId);
  console.log('[Config] Hub Address:', config.hubAddress);
}

async function main() {
  console.log('='.repeat(60));
  console.log('x402 Client - Payment → Receipt → Post Flow');
  console.log('='.repeat(60));
  console.log();

  // Validate configuration
  validateConfig();

  // Get prompt from command line or use default
  const prompt = process.argv[2] || 'Hello, generate something creative!';
  console.log(`[Prompt] "${prompt}"`);
  console.log();

  // Create wallet
  const wallet = createWallet(config.privateKey, config.rpcUrl);
  console.log(`[Wallet] Address: ${wallet.address}`);

  // Check balance
  const balance = await getBalance(wallet);
  console.log(`[Wallet] Balance: ${formatEther(balance)} ETH`);
  console.log();

  if (balance === BigInt(0)) {
    throw new Error('Wallet has no ETH. Get some Sepolia ETH from a faucet.');
  }

  // Step 1: Get payment terms
  console.log('[Step 1] Getting payment terms...');
  const terms = await getPaymentTerms(config.serviceUrl, '/api/generate', {
    body: { prompt },
  });

  if (!terms) {
    console.log('[Info] No payment required. Exiting.');
    return;
  }

  console.log(`[Terms] Amount: ${formatEther(terms.amount)} ${terms.asset}`);
  console.log(`[Terms] Chain ID: ${terms.chainId}`);
  console.log();

  // Get recipient address
  const recipient = terms.recipient || config.serviceWallet;
  if (!recipient) {
    throw new Error('No recipient address available. Set SERVICE_WALLET in .env');
  }

  // Step 2: Execute payment
  console.log('[Step 2] Executing payment...');
  const paymentResult = await sendPayment(wallet, {
    recipient,
    amountWei: terms.amount,
    confirmations: 2,
  });

  console.log(`[Payment] Transaction: ${paymentResult.txHash}`);
  console.log(`[Payment] Block: ${paymentResult.blockNumber}`);
  console.log(`[Payment] Gas used: ${paymentResult.gasUsed.toString()}`);
  console.log(`[Payment] Total cost: ${formatEther(paymentResult.totalCost)} ETH`);
  console.log();

  // Create payment proof
  const proof: PaymentProof = {
    paymentRef: paymentResult.txHash,
    payer: wallet.address,
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Step 3: Retry with proof
  console.log('[Step 3] Requesting with payment proof...');
  const response = await requestWithProof<{ content: string }>(
    config.serviceUrl,
    '/api/generate',
    proof,
    { body: { prompt } }
  );

  if (!response.success) {
    throw new Error('Request failed after payment');
  }

  console.log(`[Response] Request ID: ${response.requestId}`);
  console.log(`[Response] Result:`, response.result);
  console.log();

  // Display receipt
  if (response.receipt) {
    console.log('[Receipt] Received from service:');
    console.log(formatReceipt(response.receipt));
    console.log();
  }

  // Step 4: Sign and post receipt
  if (response.receipt && response.signingPayload) {
    console.log('[Step 4] Signing and posting receipt...');

    const postResult = await signAndPostReceipt(
      wallet,
      {
        receipt: response.receipt as any,
        signingPayload: response.signingPayload as any,
        chainId: config.chainId,
        hubAddress: config.hubAddress,
      },
      config.rpcUrl
    );

    console.log();
    console.log('='.repeat(60));
    console.log('SUCCESS!');
    console.log('='.repeat(60));
    console.log();
    console.log(`Receipt ID: ${postResult.receiptId}`);
    console.log(`Transaction: ${postResult.txHash}`);
    console.log(`Block: ${postResult.blockNumber}`);
    console.log(`Gas used: ${postResult.gasUsed.toString()}`);
    console.log();
    console.log('Links:');
    console.log(`  Payment Tx: ${getTransactionUrl(paymentResult.txHash, config.chainId)}`);
    console.log(`  Post Tx: ${postResult.links.transaction}`);
    console.log(`  Hub: ${postResult.links.hub}`);
  } else {
    console.log('[Info] No receipt or signing payload in response. Skipping on-chain posting.');
    console.log();
    console.log('='.repeat(60));
    console.log('PAYMENT COMPLETE (without on-chain receipt)');
    console.log('='.repeat(60));
    console.log();
    console.log('Payment Tx:', getTransactionUrl(paymentResult.txHash, config.chainId));
  }
}

// Run
main().catch((error) => {
  console.error();
  console.error('[Error]', error.message);
  process.exit(1);
});
