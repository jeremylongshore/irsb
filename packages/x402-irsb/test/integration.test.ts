/**
 * Integration Tests
 *
 * End-to-end flow tests for x402 → IRSB integration.
 */

import { describe, it, expect } from 'vitest';
import { Wallet, ZeroHash, ZeroAddress } from 'ethers';
import {
  createPayload,
  computePayloadCommitment,
  verifyCommitment,
} from '../src/schema.js';
import {
  buildReceiptV2FromX402,
  buildReceiptV2WithConfig,
  validateReceiptV2,
} from '../src/receipt.js';
import {
  signAsService,
  signAsClient,
  signReceiptDual,
  verifySolverSignature,
  verifyClientSignature,
  getReceiptTypedDataHash,
} from '../src/signing.js';
import {
  generateEscrowId,
  escrowIdFromPayment,
  calculateEscrowParams,
} from '../src/escrow.js';
import { PrivacyLevel, X402Mode } from '../src/types.js';
import type { X402ReceiptPayload, X402Payment } from '../src/types.js';

describe('Full Micropayment Flow', () => {
  const solverWallet = Wallet.createRandom();
  const clientWallet = Wallet.createRandom();
  const chainId = 11155111;
  const hubAddress = '0x' + 'aa'.repeat(20);

  it('should complete full x402 → ReceiptV2 → sign flow', async () => {
    // Step 1: Create x402 payload (simulating service response)
    const payload = createPayload({
      service: {
        serviceId: 'ai-service-001',
        endpoint: 'POST /api/v1/generate',
        domain: 'api.aiservice.com',
      },
      payment: {
        paymentRef: '0x' + 'tx'.repeat(32),
        asset: 'ETH',
        amount: '1000000000000000', // 0.001 ETH
        chainId: chainId,
      },
      request: {
        requestId: 'req-' + Date.now(),
      },
      response: {
        resultPointer: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        resultDigest: '0x' + 'ab'.repeat(32),
      },
    });

    // Step 2: Compute and verify commitment
    const commitment = computePayloadCommitment(payload);
    expect(verifyCommitment(commitment, payload)).toBe(true);

    // Step 3: Build ReceiptV2
    const solverId = '0x' + solverWallet.address.slice(2).padStart(64, '0');
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

    // Verify receipt is valid
    expect(validateReceiptV2(result.receiptV2)).toBe(true);

    // Step 4: Sign as solver
    const solverSig = await signAsService(
      result.receiptV2,
      solverWallet.privateKey,
      chainId,
      hubAddress
    );

    expect(solverSig).toMatch(/^0x[a-f0-9]+$/);

    // Step 5: Verify solver signature
    const signedReceipt = { ...result.receiptV2, solverSig };
    const isValidSolver = verifySolverSignature(
      signedReceipt,
      solverWallet.address,
      chainId,
      hubAddress
    );

    expect(isValidSolver).toBe(true);

    // Step 6: Sign as client (dual attestation)
    const clientSig = await signAsClient(
      result.receiptV2,
      clientWallet.privateKey,
      chainId,
      hubAddress
    );

    expect(clientSig).toMatch(/^0x[a-f0-9]+$/);

    // Step 7: Verify client signature
    const dualSignedReceipt = { ...signedReceipt, clientSig };
    const isValidClient = verifyClientSignature(
      dualSignedReceipt,
      clientWallet.address,
      chainId,
      hubAddress
    );

    expect(isValidClient).toBe(true);

    // Verify metadata commitment matches payload
    expect(dualSignedReceipt.metadataCommitment).toBe(commitment);
  });

  it('should use signReceiptDual for convenience', async () => {
    const payload = createPayload({
      service: {
        serviceId: 'test-service',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x' + 'aa'.repeat(32),
        asset: 'ETH',
        amount: '1000',
        chainId: chainId,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + 'bb'.repeat(32),
      },
    });

    const solverId = '0x' + solverWallet.address.slice(2).padStart(64, '0');
    const result = buildReceiptV2WithConfig(
      {
        payload,
        ciphertextPointer: 'QmTest',
        solverId,
      },
      chainId,
      hubAddress
    );

    // Sign both in one call
    const signedReceipt = await signReceiptDual(
      result.receiptV2,
      solverWallet.privateKey,
      clientWallet.privateKey,
      chainId,
      hubAddress
    );

    // Both signatures should be present
    expect(signedReceipt.solverSig).not.toBe('0x');
    expect(signedReceipt.clientSig).not.toBe('0x');

    // Both should verify
    expect(
      verifySolverSignature(signedReceipt, solverWallet.address, chainId, hubAddress)
    ).toBe(true);
    expect(
      verifyClientSignature(signedReceipt, clientWallet.address, chainId, hubAddress)
    ).toBe(true);
  });
});

describe('Full Commerce Flow (with Escrow)', () => {
  const chainId = 11155111;

  it('should prepare escrow parameters from x402 payment', () => {
    const payment: X402Payment = {
      paymentRef: '0x' + 'tx'.repeat(32),
      asset: 'ETH',
      amount: '1000000000000000000', // 1 ETH
      chainId: chainId,
    };

    const receiptId = '0x' + 'receipt'.padEnd(64, '0');
    const depositor = '0x' + 'client'.padEnd(40, '0');

    // Generate escrow ID from payment
    const escrowId = escrowIdFromPayment(payment, chainId);
    expect(escrowId).toMatch(/^0x[a-f0-9]{64}$/);

    // Calculate escrow params
    const params = calculateEscrowParams(
      payment,
      receiptId,
      depositor,
      chainId,
      3600 // 1 hour deadline
    );

    expect(params.escrowId).toBe(escrowId);
    expect(params.receiptId).toBe(receiptId);
    expect(params.depositor).toBe(depositor);
    expect(params.token).toBe(ZeroAddress); // ETH = zero address
    expect(params.amount).toBe(BigInt(payment.amount));
    expect(params.deadline).toBeGreaterThan(BigInt(Math.floor(Date.now() / 1000)));
  });

  it('should generate deterministic escrow ID', () => {
    const payment: X402Payment = {
      paymentRef: '0x1234',
      asset: 'ETH',
      amount: '1000',
      chainId: chainId,
    };

    const escrowId1 = escrowIdFromPayment(payment, chainId);
    const escrowId2 = escrowIdFromPayment(payment, chainId);

    expect(escrowId1).toBe(escrowId2);
  });

  it('should generate different escrow ID for different chain', () => {
    const payment: X402Payment = {
      paymentRef: '0x1234',
      asset: 'ETH',
      amount: '1000',
      chainId: 1,
    };

    const escrowIdChain1 = escrowIdFromPayment(payment, 1);
    const escrowIdChain137 = escrowIdFromPayment(payment, 137);

    expect(escrowIdChain1).not.toBe(escrowIdChain137);
  });

  it('should handle ERC20 token in escrow params', () => {
    const tokenAddress = '0x' + 'usdc'.padEnd(40, '0');
    const payment: X402Payment = {
      paymentRef: '0x' + 'tx'.repeat(32),
      asset: tokenAddress, // ERC20 token address
      amount: '1000000', // 1 USDC (6 decimals)
      chainId: chainId,
    };

    const params = calculateEscrowParams(
      payment,
      '0x' + 'receipt'.padEnd(64, '0'),
      '0x' + 'client'.padEnd(40, '0'),
      chainId
    );

    expect(params.token).toBe(tokenAddress);
  });

  it('should create receipt with escrow link', async () => {
    const solverWallet = Wallet.createRandom();
    const hubAddress = '0x' + 'aa'.repeat(20);

    const payment: X402Payment = {
      paymentRef: '0x' + 'tx'.repeat(32),
      asset: 'ETH',
      amount: '1000000000000000000',
      chainId: chainId,
    };

    const escrowId = escrowIdFromPayment(payment, chainId);

    const payload = createPayload({
      service: {
        serviceId: 'commerce-service',
        endpoint: 'POST /api/order',
        domain: 'commerce.example.com',
      },
      payment,
      request: {
        requestId: 'order-123',
      },
      response: {
        resultPointer: 'QmOrderResult',
        resultDigest: '0x' + 'ab'.repeat(32),
      },
    });

    const result = buildReceiptV2WithConfig(
      {
        payload,
        ciphertextPointer: 'QmOrderResult',
        solverId: '0x' + solverWallet.address.slice(2).padStart(64, '0'),
        escrowId, // Link to escrow
        privacyLevel: PrivacyLevel.Private,
      },
      chainId,
      hubAddress
    );

    // Escrow ID should be set
    expect(result.receiptV2.escrowId).toBe(escrowId);

    // Privacy level should be Private
    expect(result.receiptV2.privacyLevel).toBe(PrivacyLevel.Private);

    // Should still be valid
    expect(validateReceiptV2(result.receiptV2)).toBe(true);
  });
});

describe('Privacy Levels', () => {
  const chainId = 11155111;
  const hubAddress = '0x' + 'aa'.repeat(20);

  const createTestPayload = (): X402ReceiptPayload =>
    createPayload({
      service: {
        serviceId: 'test',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x123',
        asset: 'ETH',
        amount: '1000',
        chainId: chainId,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + 'dd'.repeat(32),
      },
    });

  it('should create Public receipt', () => {
    const result = buildReceiptV2WithConfig(
      {
        payload: createTestPayload(),
        ciphertextPointer: 'QmTest',
        solverId: '0x' + '11'.repeat(32),
        privacyLevel: PrivacyLevel.Public,
      },
      chainId,
      hubAddress
    );

    expect(result.receiptV2.privacyLevel).toBe(PrivacyLevel.Public);
  });

  it('should create SemiPublic receipt (default)', () => {
    const result = buildReceiptV2WithConfig(
      {
        payload: createTestPayload(),
        ciphertextPointer: 'QmTest',
        solverId: '0x' + '11'.repeat(32),
      },
      chainId,
      hubAddress
    );

    expect(result.receiptV2.privacyLevel).toBe(PrivacyLevel.SemiPublic);
  });

  it('should create Private receipt', () => {
    const result = buildReceiptV2WithConfig(
      {
        payload: createTestPayload(),
        ciphertextPointer: 'QmTest',
        solverId: '0x' + '11'.repeat(32),
        privacyLevel: PrivacyLevel.Private,
      },
      chainId,
      hubAddress
    );

    expect(result.receiptV2.privacyLevel).toBe(PrivacyLevel.Private);
  });
});

describe('Replay Protection', () => {
  it('should produce different commitments for different nonces', () => {
    const baseParams = {
      service: {
        serviceId: 'test',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x123',
        asset: 'ETH',
        amount: '1000',
        chainId: 1,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + 'dd'.repeat(32),
      },
    };

    // Create two payloads - they will have different nonces due to generateNonce()
    const payload1 = createPayload(baseParams);
    const payload2 = createPayload(baseParams);

    // Nonces should be different
    expect(payload1.timing.nonce).not.toBe(payload2.timing.nonce);

    // Commitments should be different
    const commitment1 = computePayloadCommitment(payload1);
    const commitment2 = computePayloadCommitment(payload2);

    expect(commitment1).not.toBe(commitment2);
  });

  it('should include chainId in typed data domain', async () => {
    const solverWallet = Wallet.createRandom();
    const payload = createPayload({
      service: {
        serviceId: 'test',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x123',
        asset: 'ETH',
        amount: '1000',
        chainId: 1,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + 'dd'.repeat(32),
      },
    });

    const solverId = '0x' + solverWallet.address.slice(2).padStart(64, '0');
    const result = buildReceiptV2FromX402({
      payload,
      ciphertextPointer: 'QmTest',
      solverId,
    });

    // Get typed data hashes for different chains
    const hashChain1 = getReceiptTypedDataHash(
      result.receiptV2,
      1,
      '0x' + 'aa'.repeat(20)
    );
    const hashChain137 = getReceiptTypedDataHash(
      result.receiptV2,
      137,
      '0x' + 'aa'.repeat(20)
    );

    // Should be different due to chainId in domain
    expect(hashChain1).not.toBe(hashChain137);
  });

  it('should include verifying contract in typed data domain', async () => {
    const solverWallet = Wallet.createRandom();
    const payload = createPayload({
      service: {
        serviceId: 'test',
        endpoint: 'POST /api',
        domain: 'example.com',
      },
      payment: {
        paymentRef: '0x123',
        asset: 'ETH',
        amount: '1000',
        chainId: 1,
      },
      request: {
        requestId: 'req-1',
      },
      response: {
        resultPointer: 'QmTest',
        resultDigest: '0x' + 'dd'.repeat(32),
      },
    });

    const solverId = '0x' + solverWallet.address.slice(2).padStart(64, '0');
    const result = buildReceiptV2FromX402({
      payload,
      ciphertextPointer: 'QmTest',
      solverId,
    });

    // Get typed data hashes for different hub addresses
    const hashHub1 = getReceiptTypedDataHash(
      result.receiptV2,
      1,
      '0x' + 'bb'.repeat(20)
    );
    const hashHub2 = getReceiptTypedDataHash(
      result.receiptV2,
      1,
      '0x' + 'cc'.repeat(20)
    );

    // Should be different due to verifyingContract in domain
    expect(hashHub1).not.toBe(hashHub2);
  });
});

describe('Field Mapping Verification', () => {
  it('should map all x402 fields correctly to ReceiptV2', () => {
    const payload = createPayload({
      service: {
        serviceId: 'svc-123',
        endpoint: 'POST /api/v2/inference',
        domain: 'ml.example.com',
      },
      payment: {
        paymentRef: '0x' + 'payment'.padEnd(64, '0'),
        asset: 'ETH',
        amount: '5000000000000000', // 0.005 ETH
        chainId: 11155111,
      },
      request: {
        requestId: 'inference-req-456',
      },
      response: {
        resultPointer: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        resultDigest: '0x' + 'digest'.padEnd(64, '0'),
      },
      timing: {
        issuedAt: 1700000000,
        expiry: 1700086400, // +24h
        nonce: '0xdeadbeef',
      },
    });

    const result = buildReceiptV2FromX402({
      payload,
      ciphertextPointer: payload.response.resultPointer,
      solverId: '0x' + 'solver'.padEnd(64, '0'),
      privacyLevel: PrivacyLevel.SemiPublic,
    });

    const receipt = result.receiptV2;

    // Timing fields
    expect(receipt.createdAt).toBe(BigInt(payload.timing.issuedAt));
    expect(receipt.expiry).toBe(BigInt(payload.timing.expiry));

    // Outcome hash is directly from response
    expect(receipt.outcomeHash).toBe(payload.response.resultDigest);

    // Ciphertext pointer includes ipfs:// prefix for CIDs
    expect(receipt.ciphertextPointer).toContain('ipfs://');

    // Privacy level is set
    expect(receipt.privacyLevel).toBe(PrivacyLevel.SemiPublic);

    // Solver ID is set
    expect(receipt.solverId).toBe('0x' + 'solver'.padEnd(64, '0'));

    // All hash fields are bytes32
    expect(receipt.intentHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.constraintsHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.routeHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.evidenceHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.metadataCommitment).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
