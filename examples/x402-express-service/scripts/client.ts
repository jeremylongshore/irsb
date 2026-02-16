#!/usr/bin/env npx ts-node
/**
 * x402 Client Script
 *
 * Minimal client demonstrating x402 payment flow:
 * 1. Request service → get 402 with payment terms
 * 2. Pay on-chain
 * 3. Retry request with payment proof
 * 4. Receive result + IRSB receipt
 *
 * Usage:
 *   npx ts-node scripts/client.ts [--mock]
 *
 * Environment:
 *   SERVICE_URL       - Service endpoint (default: http://localhost:3000)
 *   CLIENT_PRIVATE_KEY - Wallet private key for payments
 *   RPC_URL           - Sepolia RPC endpoint
 */

import { Wallet, JsonRpcProvider, parseEther, keccak256, toUtf8Bytes } from 'ethers';

// Configuration
const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';
const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org';
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY || '';
const USE_MOCK = process.argv.includes('--mock');

interface PaymentTerms {
  asset: string;
  amount: string;
  chainId: number;
  recipient: string;
}

interface PaymentProof {
  paymentRef: string;
  payer: string;
  timestamp: number;
}

interface ServiceResponse {
  success: boolean;
  result: unknown;
  requestId: string;
  receipt: {
    intentHash: string;
    solverSig: string;
    [key: string]: unknown;
  };
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              x402 Client - IRSB Integration               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Request service without payment
  console.log('Step 1: Request service (expect 402)...');
  const initialResponse = await fetch(`${SERVICE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Hello, world!' }),
  });

  if (initialResponse.status !== 402) {
    throw new Error(`Expected 402, got ${initialResponse.status}`);
  }

  const paymentRequired = await initialResponse.json();
  const terms: PaymentTerms = paymentRequired.payment;

  console.log('  ✓ Received 402 Payment Required');
  console.log(`    Asset: ${terms.asset}`);
  console.log(`    Amount: ${terms.amount} wei`);
  console.log(`    Chain: ${terms.chainId}`);
  console.log(`    Recipient: ${terms.recipient}`);
  console.log('');

  // Step 2: Make payment
  console.log('Step 2: Make payment...');
  let paymentProof: PaymentProof;

  if (USE_MOCK) {
    // Generate mock payment proof for testing
    console.log('  (Using mock payment for testing)');
    paymentProof = {
      paymentRef: '0x' + 'a'.repeat(64),
      payer: '0x' + 'b'.repeat(40),
      timestamp: Math.floor(Date.now() / 1000),
    };
    console.log('  ✓ Mock payment proof generated');
  } else {
    // Real on-chain payment
    if (!CLIENT_PRIVATE_KEY) {
      throw new Error('CLIENT_PRIVATE_KEY required for real payments');
    }

    const provider = new JsonRpcProvider(RPC_URL);
    const wallet = new Wallet(CLIENT_PRIVATE_KEY, provider);

    console.log(`  Payer: ${wallet.address}`);
    console.log(`  Sending ${terms.amount} wei to ${terms.recipient}...`);

    const tx = await wallet.sendTransaction({
      to: terms.recipient,
      value: BigInt(terms.amount),
    });

    console.log(`  Tx Hash: ${tx.hash}`);
    console.log('  Waiting for confirmation...');

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction failed');
    }

    console.log(`  ✓ Confirmed in block ${receipt.blockNumber}`);

    paymentProof = {
      paymentRef: tx.hash,
      payer: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }
  console.log('');

  // Step 3: Retry with payment proof
  console.log('Step 3: Retry request with payment proof...');
  const paidResponse = await fetch(`${SERVICE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Proof': JSON.stringify(paymentProof),
    },
    body: JSON.stringify({ prompt: 'Generate something amazing!' }),
  });

  if (!paidResponse.ok) {
    const error = await paidResponse.json();
    throw new Error(`Request failed: ${error.message || paidResponse.status}`);
  }

  const response: ServiceResponse = await paidResponse.json();
  console.log('  ✓ Request successful');
  console.log('');

  // Step 4: Display receipt
  console.log('Step 4: IRSB Receipt received');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Request ID:    ${response.requestId}`);
  console.log(`  Intent Hash:   ${response.receipt.intentHash}`);
  console.log(`  Solver Sig:    ${response.receipt.solverSig.slice(0, 20)}...`);
  console.log('');
  console.log('  Result:', JSON.stringify(response.result, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Summary
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      Summary                              ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Payment Ref:  ${paymentProof.paymentRef.slice(0, 42)}...`);
  console.log(`║  Request ID:   ${response.requestId}`);
  console.log(`║  Intent Hash:  ${response.receipt.intentHash.slice(0, 42)}...`);
  console.log('║                                                           ║');
  console.log('║  Next steps:                                              ║');
  console.log('║  1. Sign receipt with your wallet (EIP-712)               ║');
  console.log('║  2. Post to IntentReceiptHub.postReceiptV2()              ║');
  console.log('║  3. Receipt is now on-chain and verifiable                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Return for programmatic use
  return {
    paymentProof,
    requestId: response.requestId,
    receipt: response.receipt,
    result: response.result,
  };
}

// Run
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
