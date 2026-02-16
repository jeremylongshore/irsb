/**
 * V2 Receipt with Privacy Commitment Example
 *
 * Demonstrates creating a V2 receipt with:
 * - Metadata commitment (hash of off-chain data)
 * - Ciphertext pointer (CID to encrypted payload)
 * - Dual attestation (solver + client signatures)
 *
 * Run: npx ts-node sdk/examples/v2-receipt-with-commitment/index.ts
 */

import { ethers, Wallet } from 'ethers';
import {
  // Privacy
  generateMetadataCommitment,
  validatePointer,
  createReceiptAccessConditions,
  createPrivacyConfig,
  // V2 Receipts
  PrivacyLevel,
  buildReceiptV2,
  buildAndSignReceiptV2,
  getEIP712Domain,
  computeReceiptV2Id,
  verifyReceiptV2Signature,
  // ABIs
  RECEIPT_V2_EXTENSION_ABI,
} from '../../src';

async function main() {
  console.log('=== IRSB V2 Receipt with Privacy Commitment ===\n');

  // Setup test wallets (in production, use real wallets)
  const solverWallet = Wallet.createRandom();
  const clientWallet = Wallet.createRandom();

  console.log('Solver address:', solverWallet.address);
  console.log('Client address:', clientWallet.address);
  console.log('');

  // ============================================================
  // Step 1: Build the metadata payload
  // ============================================================
  console.log('Step 1: Building metadata payload...');

  const orderMetadata = {
    orderId: 'order-abc123',
    service: 'image-generation',
    params: {
      prompt: 'A beautiful sunset over mountains',
      model: 'dall-e-3',
      size: '1024x1024',
    },
    pricing: {
      amount: ethers.parseEther('0.01').toString(),
      asset: 'ETH',
      chainId: 11155111,
    },
    timestamps: {
      ordered: Date.now(),
      deadline: Date.now() + 3600000, // 1 hour
    },
  };

  console.log('Metadata:', JSON.stringify(orderMetadata, null, 2));
  console.log('');

  // ============================================================
  // Step 2: Generate metadata commitment
  // ============================================================
  console.log('Step 2: Generating metadata commitment...');

  const commitment = generateMetadataCommitment(orderMetadata);

  console.log('Commitment:', commitment.commitment);
  console.log('Schema version:', commitment.originalPayload.version);
  console.log('Nonce:', commitment.originalPayload.nonce);
  console.log('');

  // ============================================================
  // Step 3: Simulate encrypting and uploading to IPFS
  // ============================================================
  console.log('Step 3: Simulating encryption and upload...');

  // In production, you would:
  // 1. Encrypt with Lit Protocol
  // 2. Upload to IPFS
  // 3. Get the CID

  const simulatedCID = 'QmYwAPJzv5CZsnAzt8auVZRn7atJS2Dpw';
  const pointerValidation = validatePointer(simulatedCID);

  if (!pointerValidation.isValid) {
    throw new Error(`Invalid CID: ${pointerValidation.error}`);
  }

  console.log('Ciphertext pointer (CID):', simulatedCID);
  console.log('Pointer valid:', pointerValidation.isValid);
  console.log('');

  // ============================================================
  // Step 4: Create access control conditions
  // ============================================================
  console.log('Step 4: Creating access control conditions...');

  const accessConditions = createReceiptAccessConditions(
    'sepolia',
    solverWallet.address,
    clientWallet.address
  );

  console.log('Access conditions:', JSON.stringify(accessConditions, null, 2));
  console.log('');

  // ============================================================
  // Step 5: Build V2 receipt parameters
  // ============================================================
  console.log('Step 5: Building V2 receipt...');

  const domain = getEIP712Domain(11155111, '0x1234567890123456789012345678901234567890');

  // Generate hashes for intent components
  const intentHash = ethers.keccak256(
    ethers.solidityPacked(['string', 'uint256'], [orderMetadata.orderId, orderMetadata.pricing.amount])
  );

  const constraintsHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(orderMetadata.params))
  );

  const routeHash = ethers.keccak256(
    ethers.toUtf8Bytes(orderMetadata.service)
  );

  const outcomeHash = ethers.keccak256(
    ethers.toUtf8Bytes('image-generated-successfully')
  );

  const evidenceHash = ethers.keccak256(
    ethers.toUtf8Bytes('ipfs://execution-evidence-cid')
  );

  const solverId = ethers.keccak256(
    ethers.toUtf8Bytes(solverWallet.address)
  );

  // ============================================================
  // Step 6: Build and sign the receipt
  // ============================================================
  console.log('Step 6: Signing receipt (dual attestation)...');

  const receipt = await buildAndSignReceiptV2(
    {
      intentHash,
      constraintsHash,
      routeHash,
      outcomeHash,
      evidenceHash,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24h
      solverId,
      client: clientWallet.address,
      metadataCommitment: commitment.commitment,
      ciphertextPointer: simulatedCID,
      privacyLevel: PrivacyLevel.SemiPublic,
    },
    solverWallet,
    clientWallet,
    domain
  );

  console.log('Receipt built and signed!');
  console.log('');

  // ============================================================
  // Step 7: Verify signatures
  // ============================================================
  console.log('Step 7: Verifying signatures...');

  const unsignedReceipt = { ...receipt, solverSig: '', clientSig: '' };

  const solverSigValid = verifyReceiptV2Signature(
    unsignedReceipt,
    receipt.solverSig,
    solverWallet.address,
    domain
  );

  const clientSigValid = verifyReceiptV2Signature(
    unsignedReceipt,
    receipt.clientSig,
    clientWallet.address,
    domain
  );

  console.log('Solver signature valid:', solverSigValid);
  console.log('Client signature valid:', clientSigValid);
  console.log('');

  // ============================================================
  // Step 8: Compute receipt ID
  // ============================================================
  console.log('Step 8: Computing receipt ID...');

  const receiptId = computeReceiptV2Id(receipt);
  console.log('Receipt ID:', receiptId);
  console.log('');

  // ============================================================
  // Final Summary
  // ============================================================
  console.log('=== Receipt Summary ===');
  console.log('');
  console.log('ON-CHAIN (public):');
  console.log('  Receipt ID:', receiptId);
  console.log('  Intent Hash:', receipt.intentHash);
  console.log('  Solver ID:', receipt.solverId);
  console.log('  Client:', receipt.client);
  console.log('  Privacy Level:', PrivacyLevel[receipt.privacyLevel]);
  console.log('  Metadata Commitment:', receipt.metadataCommitment);
  console.log('  Ciphertext Pointer:', receipt.ciphertextPointer);
  console.log('  Expiry:', new Date(Number(receipt.expiry) * 1000).toISOString());
  console.log('');
  console.log('OFF-CHAIN (private, gated by Lit):');
  console.log('  Full order metadata');
  console.log('  Execution details');
  console.log('  Evidence bundle');
  console.log('');
  console.log('SIGNATURES:');
  console.log('  Solver:', receipt.solverSig.slice(0, 20) + '...');
  console.log('  Client:', receipt.clientSig.slice(0, 20) + '...');
  console.log('');

  // ============================================================
  // Example: How to post to contract
  // ============================================================
  console.log('=== Contract Interaction (example) ===');
  console.log('');
  console.log('// Connect to contract');
  console.log(`const extension = new Contract('${domain.verifyingContract}', RECEIPT_V2_EXTENSION_ABI, signer);`);
  console.log('');
  console.log('// Post receipt');
  console.log('const tx = await extension.postReceiptV2({');
  console.log(`  intentHash: '${receipt.intentHash}',`);
  console.log(`  constraintsHash: '${receipt.constraintsHash}',`);
  console.log(`  routeHash: '${receipt.routeHash}',`);
  console.log(`  outcomeHash: '${receipt.outcomeHash}',`);
  console.log(`  evidenceHash: '${receipt.evidenceHash}',`);
  console.log(`  createdAt: ${receipt.createdAt}n,`);
  console.log(`  expiry: ${receipt.expiry}n,`);
  console.log(`  solverId: '${receipt.solverId}',`);
  console.log(`  client: '${receipt.client}',`);
  console.log(`  metadataCommitment: '${receipt.metadataCommitment}',`);
  console.log(`  ciphertextPointer: '${receipt.ciphertextPointer}',`);
  console.log(`  privacyLevel: ${receipt.privacyLevel},`);
  console.log(`  escrowId: '${receipt.escrowId}',`);
  console.log(`  solverSig: '${receipt.solverSig}',`);
  console.log(`  clientSig: '${receipt.clientSig}',`);
  console.log('});');
  console.log('');
  console.log('✓ Example complete!');
}

main().catch(console.error);
