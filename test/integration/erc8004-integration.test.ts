/**
 * ERC-8004 Integration Tests
 *
 * Tests with mocked viem clients to simulate contract interactions
 * without requiring real RPC connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Address, type Hash } from 'viem';

// Mock viem before importing adapter
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => mockPublicClient),
    createWalletClient: vi.fn(() => mockWalletClient),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890' as Address,
  })),
}));

// Mock clients
const mockPublicClient = {
  readContract: vi.fn(),
};

const mockWalletClient = {
  writeContract: vi.fn(),
};

// Import after mocking
import {
  ERC8004Adapter,
  type ValidationSignal,
  type ReputationSummary,
  type AgentCard,
} from '../../src/erc8004/adapter.js';

// ============ Test Fixtures ============

const TEST_AGENT_ID = '42';
const TEST_RECEIPT_ID = '0x' + 'a'.repeat(64);
const TEST_EVIDENCE_HASH = '0x' + 'b'.repeat(64) as Hash;
const TEST_WALLET = '0x' + '1'.repeat(40) as Address;
const TEST_TX_HASH = '0x' + 'f'.repeat(64) as Hash;

const createEnabledAdapter = () =>
  new ERC8004Adapter({
    enabled: true,
    network: 'sepolia',
    rpcUrl: 'https://test-rpc.com',
    privateKey: '0x' + 'a'.repeat(64),
    providerName: 'IRSB Protocol Test',
    cacheTimeMs: 60000,
  });

// ============ Agent Resolution Tests ============

describe('Agent Resolution with Mocked RPC', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createEnabledAdapter();
  });

  describe('resolveAgent', () => {
    it('resolves agent with all fields', async () => {
      // Mock contract calls
      mockPublicClient.readContract
        .mockResolvedValueOnce('ipfs://QmTest123') // tokenURI
        .mockResolvedValueOnce(TEST_WALLET) // getAgentWallet
        .mockResolvedValueOnce(TEST_WALLET); // ownerOf

      // Mock fetch for registration file
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'Test Solver',
          description: 'A test IRSB solver',
          services: [
            { name: 'A2A', endpoint: 'https://solver.test/a2a' },
            { name: 'IRSB', endpoint: 'https://solver.test/irsb' },
          ],
        }),
      });

      const result = await adapter.resolveAgent(TEST_AGENT_ID);

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe(TEST_AGENT_ID);
      expect(result!.name).toBe('Test Solver');
      expect(result!.description).toBe('A test IRSB solver');
      expect(result!.capabilities).toContain('A2A');
      expect(result!.capabilities).toContain('IRSB');
      expect(result!.agentWallet).toBe(TEST_WALLET);
      expect(result!.owner).toBe(TEST_WALLET);
    });

    it('handles missing registration file gracefully', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce('https://missing.com/agent.json')
        .mockResolvedValueOnce(TEST_WALLET)
        .mockResolvedValueOnce(TEST_WALLET);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await adapter.resolveAgent(TEST_AGENT_ID);

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe(TEST_AGENT_ID);
      expect(result!.name).toContain('Agent'); // Fallback name
      expect(result!.capabilities).toEqual([]); // No capabilities from file
    });

    it('handles contract read failure', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('Contract not found'));

      const result = await adapter.resolveAgent(TEST_AGENT_ID);

      expect(result).toBeNull();
    });
  });

  describe('verifyAgentOwnership', () => {
    it('returns true when wallet is owner', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce('ipfs://test')
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000')
        .mockResolvedValueOnce(TEST_WALLET); // ownerOf returns TEST_WALLET

      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await adapter.verifyAgentOwnership(TEST_AGENT_ID, TEST_WALLET);

      expect(result).toBe(true);
    });

    it('returns true when wallet is agentWallet', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce('ipfs://test')
        .mockResolvedValueOnce(TEST_WALLET) // getAgentWallet returns TEST_WALLET
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000');

      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await adapter.verifyAgentOwnership(TEST_AGENT_ID, TEST_WALLET);

      expect(result).toBe(true);
    });

    it('returns false when wallet is neither owner nor agentWallet', async () => {
      const otherWallet = '0x' + '2'.repeat(40) as Address;

      mockPublicClient.readContract
        .mockResolvedValueOnce('ipfs://test')
        .mockResolvedValueOnce(otherWallet)
        .mockResolvedValueOnce(otherWallet);

      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await adapter.verifyAgentOwnership(TEST_AGENT_ID, TEST_WALLET);

      expect(result).toBe(false);
    });

    it('is case-insensitive for addresses', async () => {
      const mixedCaseWallet = '0x' + '1'.repeat(40).toUpperCase();

      mockPublicClient.readContract
        .mockResolvedValueOnce('ipfs://test')
        .mockResolvedValueOnce(TEST_WALLET.toLowerCase())
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000');

      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await adapter.verifyAgentOwnership(TEST_AGENT_ID, mixedCaseWallet);

      expect(result).toBe(true);
    });
  });
});

// ============ Reputation Query Tests ============

describe('Reputation Queries with Mocked RPC', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createEnabledAdapter();
  });

  describe('getReputation', () => {
    it('returns reputation summary', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100), // totalFeedback
        BigInt(8500), // averageValue (85.00 with 2 decimals)
        BigInt(90), // positiveCount
        BigInt(10), // negativeCount
      ]);

      const result = await adapter.getReputation(TEST_AGENT_ID);

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe(TEST_AGENT_ID);
      expect(result!.totalFeedback).toBe(100);
      expect(result!.averageScore).toBe(85);
      expect(result!.positiveCount).toBe(90);
      expect(result!.negativeCount).toBe(10);
    });

    it('uses cached result within cache period', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(8500),
        BigInt(90),
        BigInt(10),
      ]);

      // First call
      await adapter.getReputation(TEST_AGENT_ID);

      // Second call - should use cache
      await adapter.getReputation(TEST_AGENT_ID);

      // Contract should only be called once
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(1);
    });

    it('handles contract failure gracefully', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('RPC error'));

      const result = await adapter.getReputation(TEST_AGENT_ID);

      expect(result).toBeNull();
    });
  });

  describe('calculateBondForAgent', () => {
    it('returns low bond for high reputation (90+)', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(9500), // 95 score
        BigInt(95),
        BigInt(5),
      ]);

      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(0.5);
      expect(result.effectiveBond).toBe(BigInt('50000000000000000')); // 0.05 ETH
      expect(result.reasoning).toContain('Excellent');
    });

    it('returns reduced bond for good reputation (70-89)', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(7500), // 75 score
        BigInt(80),
        BigInt(20),
      ]);

      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(0.75);
      expect(result.effectiveBond).toBe(BigInt('75000000000000000')); // 0.075 ETH
      expect(result.reasoning).toContain('Good');
    });

    it('returns standard bond for moderate reputation (50-69)', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(5500), // 55 score
        BigInt(60),
        BigInt(40),
      ]);

      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(1.0);
      expect(result.effectiveBond).toBe(BigInt('100000000000000000')); // 0.1 ETH
      expect(result.reasoning).toContain('Standard');
    });

    it('returns elevated bond for low reputation (30-49)', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(4000), // 40 score
        BigInt(50),
        BigInt(50),
      ]);

      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(1.5);
      expect(result.effectiveBond).toBe(BigInt('150000000000000000')); // 0.15 ETH
      expect(result.reasoning).toContain('Elevated');
    });

    it('returns maximum bond for poor reputation (0-29)', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(2000), // 20 score
        BigInt(30),
        BigInt(70),
      ]);

      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(2.0);
      expect(result.effectiveBond).toBe(BigInt('200000000000000000')); // 0.2 ETH
      expect(result.reasoning).toContain('Maximum');
    });

    it('returns standard bond when no history', async () => {
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(0), // No feedback
        BigInt(0),
        BigInt(0),
        BigInt(0),
      ]);

      const result = await adapter.calculateBondForAgent(TEST_AGENT_ID);

      expect(result.modifier).toBe(1.0);
      expect(result.effectiveBond).toBe(BigInt('100000000000000000'));
      expect(result.reasoning).toContain('no ERC-8004 history');
    });
  });
});

// ============ Signal Publishing Tests ============

describe('Signal Publishing with Mocked RPC', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createEnabledAdapter();
  });

  describe('publishValidation', () => {
    it('publishes RECEIPT_FINALIZED signal', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      const signal: ValidationSignal = {
        agentId: TEST_AGENT_ID,
        signalType: 'RECEIPT_FINALIZED',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = await adapter.publishValidation(signal);

      expect(result).toBe(TEST_TX_HASH);
      expect(mockWalletClient.writeContract).toHaveBeenCalledTimes(1);

      // Verify the call arguments
      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.functionName).toBe('giveFeedback');
      expect(call.args[0]).toBe(BigInt(TEST_AGENT_ID)); // tokenId
      expect(call.args[1]).toBe(BigInt(10000)); // value (100 * 100)
      expect(call.args[2]).toBe(2); // decimals
      expect(call.args[3]).toBe('irsb'); // tag1
      expect(call.args[4]).toBe('success'); // tag2
    });

    it('publishes DISPUTE_LOST signal with negative value', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      const signal: ValidationSignal = {
        agentId: TEST_AGENT_ID,
        signalType: 'DISPUTE_LOST',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = await adapter.publishValidation(signal);

      expect(result).toBe(TEST_TX_HASH);

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[1]).toBe(BigInt(-5000)); // value (-50 * 100)
      expect(call.args[4]).toBe('dispute-lost'); // tag2
    });

    it('publishes SOLVER_SLASHED signal', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      const signal: ValidationSignal = {
        agentId: TEST_AGENT_ID,
        signalType: 'SOLVER_SLASHED',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = await adapter.publishValidation(signal);

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[1]).toBe(BigInt(-8000)); // value (-80 * 100)
      expect(call.args[4]).toBe('slashed'); // tag2
    });

    it('invalidates cache after publishing', async () => {
      // Setup cache
      mockPublicClient.readContract.mockResolvedValue([
        BigInt(100),
        BigInt(8500),
        BigInt(90),
        BigInt(10),
      ]);
      await adapter.getReputation(TEST_AGENT_ID);

      // Publish signal
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);
      await adapter.publishValidation({
        agentId: TEST_AGENT_ID,
        signalType: 'RECEIPT_FINALIZED',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      });

      // Query again - should make new RPC call (cache invalidated)
      await adapter.getReputation(TEST_AGENT_ID);

      // Should have 2 RPC calls for reputation
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2);
    });

    it('handles transaction failure gracefully', async () => {
      mockWalletClient.writeContract.mockRejectedValue(new Error('Transaction failed'));

      const signal: ValidationSignal = {
        agentId: TEST_AGENT_ID,
        signalType: 'RECEIPT_FINALIZED',
        receiptId: TEST_RECEIPT_ID,
        timestamp: Date.now(),
        evidenceHash: TEST_EVIDENCE_HASH,
      };

      const result = await adapter.publishValidation(signal);

      expect(result).toBeNull();
    });
  });

  describe('updateReputation', () => {
    it('maps positive delta to RECEIPT_FINALIZED', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      await adapter.updateReputation({
        agentId: TEST_AGENT_ID,
        delta: 100,
        reason: 'Success',
        evidenceHash: TEST_EVIDENCE_HASH,
      });

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[4]).toBe('success'); // Should be RECEIPT_FINALIZED tag
    });

    it('maps small positive delta to DISPUTE_WON', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      await adapter.updateReputation({
        agentId: TEST_AGENT_ID,
        delta: 25, // >= 0 but < 50
        reason: 'Dispute resolved in favor',
        evidenceHash: TEST_EVIDENCE_HASH,
      });

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[4]).toBe('dispute-won');
    });

    it('maps negative delta to DISPUTE_LOST', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      await adapter.updateReputation({
        agentId: TEST_AGENT_ID,
        delta: -30,
        reason: 'Dispute lost',
        evidenceHash: TEST_EVIDENCE_HASH,
      });

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[4]).toBe('dispute-lost');
    });

    it('maps large negative delta to SOLVER_SLASHED', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      await adapter.updateReputation({
        agentId: TEST_AGENT_ID,
        delta: -80,
        reason: 'Major slashing event',
        evidenceHash: TEST_EVIDENCE_HASH,
      });

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[4]).toBe('slashed');
    });

    it('maps extreme negative delta to SOLVER_JAILED', async () => {
      mockWalletClient.writeContract.mockResolvedValue(TEST_TX_HASH);

      await adapter.updateReputation({
        agentId: TEST_AGENT_ID,
        delta: -100,
        reason: 'Solver jailed for severe violation',
        evidenceHash: TEST_EVIDENCE_HASH,
      });

      const call = mockWalletClient.writeContract.mock.calls[0][0];
      expect(call.args[4]).toBe('jailed');
    });
  });
});

// ============ Adapter Without Wallet Tests ============

describe('Adapter Without Wallet Client', () => {
  let adapter: ERC8004Adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Enabled but no private key = no wallet client
    adapter = new ERC8004Adapter({
      enabled: true,
      network: 'sepolia',
      rpcUrl: 'https://test-rpc.com',
      // No privateKey
      providerName: 'IRSB Protocol Test',
      cacheTimeMs: 60000,
    });
  });

  it('can still query data (public client works)', async () => {
    mockPublicClient.readContract.mockResolvedValue([
      BigInt(100),
      BigInt(8500),
      BigInt(90),
      BigInt(10),
    ]);

    const result = await adapter.getReputation(TEST_AGENT_ID);

    expect(result).not.toBeNull();
    expect(result!.averageScore).toBe(85);
  });

  it('returns null when trying to publish (no wallet)', async () => {
    const signal: ValidationSignal = {
      agentId: TEST_AGENT_ID,
      signalType: 'RECEIPT_FINALIZED',
      receiptId: TEST_RECEIPT_ID,
      timestamp: Date.now(),
      evidenceHash: TEST_EVIDENCE_HASH,
    };

    const result = await adapter.publishValidation(signal);

    expect(result).toBeNull();
    expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
  });
});
