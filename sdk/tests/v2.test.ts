/**
 * V2 Receipts Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ethers, Wallet } from 'ethers';
import {
  PrivacyLevel,
  buildReceiptV2,
  getEIP712Domain,
  getReceiptV2TypedData,
  signReceiptV2,
  buildAndSignReceiptV2,
  computeReceiptV2Id,
  verifyReceiptV2Signature,
  createTestReceiptV2,
  V2_CONSTANTS,
  type BuildReceiptV2Params,
  type EIP712Domain,
} from '../src/v2';

describe('V2 Receipts', () => {
  let solverWallet: Wallet;
  let clientWallet: Wallet;
  let domain: EIP712Domain;

  beforeAll(() => {
    // Create test wallets
    solverWallet = Wallet.createRandom();
    clientWallet = Wallet.createRandom();

    // Create test domain
    domain = getEIP712Domain(11155111, '0x1234567890123456789012345678901234567890');
  });

  describe('buildReceiptV2', () => {
    it('should build valid receipt', () => {
      const params: BuildReceiptV2Params = {
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent')),
        constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('constraints')),
        routeHash: ethers.keccak256(ethers.toUtf8Bytes('route')),
        outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('outcome')),
        evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('evidence')),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
        solverId: ethers.keccak256(ethers.toUtf8Bytes('solver')),
        client: clientWallet.address,
        metadataCommitment: ethers.keccak256(ethers.toUtf8Bytes('metadata')),
        ciphertextPointer: 'QmTestCID123456789012345678901',
      };

      const receipt = buildReceiptV2(params);

      expect(receipt.intentHash).toBe(params.intentHash);
      expect(receipt.client).toBe(params.client);
      expect(receipt.privacyLevel).toBe(PrivacyLevel.SemiPublic); // default
      expect(receipt.escrowId).toBe(ethers.ZeroHash); // default
      expect(receipt.createdAt).toBeGreaterThan(0n);
    });

    it('should use provided privacy level', () => {
      const params: BuildReceiptV2Params = {
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent')),
        constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('constraints')),
        routeHash: ethers.keccak256(ethers.toUtf8Bytes('route')),
        outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('outcome')),
        evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('evidence')),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
        solverId: ethers.keccak256(ethers.toUtf8Bytes('solver')),
        client: clientWallet.address,
        metadataCommitment: ethers.keccak256(ethers.toUtf8Bytes('metadata')),
        ciphertextPointer: 'QmTestCID123456789012345678901',
        privacyLevel: PrivacyLevel.Private,
      };

      const receipt = buildReceiptV2(params);
      expect(receipt.privacyLevel).toBe(PrivacyLevel.Private);
    });

    it('should reject invalid ciphertext pointer', () => {
      const params: BuildReceiptV2Params = {
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent')),
        constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('constraints')),
        routeHash: ethers.keccak256(ethers.toUtf8Bytes('route')),
        outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('outcome')),
        evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('evidence')),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
        solverId: ethers.keccak256(ethers.toUtf8Bytes('solver')),
        client: clientWallet.address,
        metadataCommitment: ethers.keccak256(ethers.toUtf8Bytes('metadata')),
        ciphertextPointer: 'ipfs://invalid', // contains ://
      };

      expect(() => buildReceiptV2(params)).toThrow('Invalid ciphertext pointer');
    });

    it('should reject invalid metadata commitment', () => {
      const params: BuildReceiptV2Params = {
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent')),
        constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('constraints')),
        routeHash: ethers.keccak256(ethers.toUtf8Bytes('route')),
        outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('outcome')),
        evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('evidence')),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
        solverId: ethers.keccak256(ethers.toUtf8Bytes('solver')),
        client: clientWallet.address,
        metadataCommitment: '0x1234', // too short
        ciphertextPointer: 'QmTestCID123456789012345678901',
      };

      expect(() => buildReceiptV2(params)).toThrow('Invalid metadata commitment');
    });

    it('should reject invalid client address', () => {
      const params: BuildReceiptV2Params = {
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent')),
        constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('constraints')),
        routeHash: ethers.keccak256(ethers.toUtf8Bytes('route')),
        outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('outcome')),
        evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('evidence')),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
        solverId: ethers.keccak256(ethers.toUtf8Bytes('solver')),
        client: 'invalid-address',
        metadataCommitment: ethers.keccak256(ethers.toUtf8Bytes('metadata')),
        ciphertextPointer: 'QmTestCID123456789012345678901',
      };

      expect(() => buildReceiptV2(params)).toThrow('Invalid client address');
    });
  });

  describe('getEIP712Domain', () => {
    it('should create valid domain', () => {
      const domain = getEIP712Domain(1, '0x1234567890123456789012345678901234567890');

      expect(domain.name).toBe(V2_CONSTANTS.EIP712_NAME);
      expect(domain.version).toBe(V2_CONSTANTS.EIP712_VERSION);
      expect(domain.chainId).toBe(1);
      expect(domain.verifyingContract).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('getReceiptV2TypedData', () => {
    it('should create valid typed data', () => {
      const receipt = createTestReceiptV2();
      const typedData = getReceiptV2TypedData(receipt, domain);

      expect(typedData.primaryType).toBe('IntentReceiptV2');
      expect(typedData.types.IntentReceiptV2).toBeDefined();
      expect(typedData.types.IntentReceiptV2.length).toBe(13);
      expect(typedData.message.intentHash).toBe(receipt.intentHash);
      expect(typedData.message.client).toBe(receipt.client);
    });
  });

  describe('signReceiptV2', () => {
    it('should sign receipt', async () => {
      const receipt = createTestReceiptV2({ client: clientWallet.address });
      const signature = await signReceiptV2(receipt, solverWallet, domain);

      expect(signature).toMatch(/^0x[a-f0-9]{130}$/i);
    });
  });

  describe('buildAndSignReceiptV2', () => {
    it('should build and sign receipt with both parties', async () => {
      const params: BuildReceiptV2Params = {
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent')),
        constraintsHash: ethers.keccak256(ethers.toUtf8Bytes('constraints')),
        routeHash: ethers.keccak256(ethers.toUtf8Bytes('route')),
        outcomeHash: ethers.keccak256(ethers.toUtf8Bytes('outcome')),
        evidenceHash: ethers.keccak256(ethers.toUtf8Bytes('evidence')),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
        solverId: ethers.keccak256(ethers.toUtf8Bytes('solver')),
        client: clientWallet.address,
        metadataCommitment: ethers.keccak256(ethers.toUtf8Bytes('metadata')),
        ciphertextPointer: 'QmTestCID123456789012345678901',
      };

      const receipt = await buildAndSignReceiptV2(params, solverWallet, clientWallet, domain);

      expect(receipt.solverSig).toMatch(/^0x[a-f0-9]{130}$/i);
      expect(receipt.clientSig).toMatch(/^0x[a-f0-9]{130}$/i);
      expect(receipt.solverSig).not.toBe(receipt.clientSig);
    });
  });

  describe('computeReceiptV2Id', () => {
    it('should compute deterministic ID', () => {
      const receipt = createTestReceiptV2();
      const id1 = computeReceiptV2Id(receipt);
      const id2 = computeReceiptV2Id(receipt);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^0x[a-f0-9]{64}$/i);
    });

    it('should produce different IDs for different receipts', () => {
      const receipt1 = createTestReceiptV2();
      const receipt2 = createTestReceiptV2({
        intentHash: ethers.keccak256(ethers.toUtf8Bytes('different')),
      });

      expect(computeReceiptV2Id(receipt1)).not.toBe(computeReceiptV2Id(receipt2));
    });
  });

  describe('verifyReceiptV2Signature', () => {
    it('should verify valid signature', async () => {
      const receipt = createTestReceiptV2({ client: clientWallet.address });
      const signature = await signReceiptV2(receipt, solverWallet, domain);

      const isValid = verifyReceiptV2Signature(receipt, signature, solverWallet.address, domain);
      expect(isValid).toBe(true);
    });

    it('should reject signature from wrong signer', async () => {
      const receipt = createTestReceiptV2({ client: clientWallet.address });
      const signature = await signReceiptV2(receipt, solverWallet, domain);

      const isValid = verifyReceiptV2Signature(receipt, signature, clientWallet.address, domain);
      expect(isValid).toBe(false);
    });

    it('should reject invalid signature', () => {
      const receipt = createTestReceiptV2();
      const invalidSig = '0x' + '00'.repeat(65);

      const isValid = verifyReceiptV2Signature(receipt, invalidSig, solverWallet.address, domain);
      expect(isValid).toBe(false);
    });
  });

  describe('createTestReceiptV2', () => {
    it('should create receipt with default values', () => {
      const receipt = createTestReceiptV2();

      expect(receipt.intentHash).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(receipt.privacyLevel).toBe(PrivacyLevel.SemiPublic);
      expect(receipt.expiry).toBeGreaterThan(BigInt(Math.floor(Date.now() / 1000)));
    });

    it('should allow overrides', () => {
      const customHash = ethers.keccak256(ethers.toUtf8Bytes('custom'));
      const receipt = createTestReceiptV2({
        intentHash: customHash,
        privacyLevel: PrivacyLevel.Public,
      });

      expect(receipt.intentHash).toBe(customHash);
      expect(receipt.privacyLevel).toBe(PrivacyLevel.Public);
    });
  });

  describe('V2_CONSTANTS', () => {
    it('should have expected values', () => {
      expect(V2_CONSTANTS.COUNTER_BOND_WINDOW).toBe(BigInt(24 * 60 * 60));
      expect(V2_CONSTANTS.ARBITRATION_TIMEOUT).toBe(BigInt(7 * 24 * 60 * 60));
      expect(V2_CONSTANTS.EVIDENCE_WINDOW).toBe(BigInt(48 * 60 * 60));
      expect(V2_CONSTANTS.MAX_POINTER_LENGTH).toBe(64);
      expect(V2_CONSTANTS.EIP712_NAME).toBe('IRSB ReceiptV2');
    });
  });
});
