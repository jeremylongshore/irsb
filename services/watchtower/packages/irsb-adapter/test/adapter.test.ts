import type { IrsbContracts } from '@irsb-watchtower/config';
import { describe, it, expect } from 'vitest';
import { IrsbClient } from '../src/irsbClient.js';
import {
  DisputeReason,
  type OnChainReceipt,
  type Solver,
  type Dispute,
} from '../src/types.js';

// Mock contract addresses (Sepolia)
const mockContracts: IrsbContracts = {
  solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
  intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
  disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
};

describe('IrsbClient', () => {
  it('creates client with config', () => {
    const client = new IrsbClient({
      rpcUrl: 'https://rpc.sepolia.org',
      chainId: 11155111,
      contracts: mockContracts,
    });

    expect(client).toBeDefined();
    expect(client.getContractAddresses()).toEqual(mockContracts);
  });

  it('throws on write operations without wallet', async () => {
    const client = new IrsbClient({
      rpcUrl: 'https://rpc.sepolia.org',
      chainId: 11155111,
      contracts: mockContracts,
    });

    await expect(
      client.openDispute({
        receiptId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        reason: DisputeReason.TIMEOUT,
        evidenceHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        bondAmount: 100000000000000000n, // 0.1 ETH
      })
    ).rejects.toThrow('Wallet client not configured');
  });

  it('exposes public client for advanced queries', () => {
    const client = new IrsbClient({
      rpcUrl: 'https://rpc.sepolia.org',
      chainId: 11155111,
      contracts: mockContracts,
    });

    const publicClient = client.getPublicClient();
    expect(publicClient).toBeDefined();
  });
});

describe('Type definitions', () => {
  it('defines OnChainReceipt correctly', () => {
    const receipt: OnChainReceipt = {
      id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      solverId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'pending',
      blockNumber: 1000000n,
      txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
      challengeDeadline: 1700000000n,
      finalized: false,
      intentHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      createdAt: 1699996400n,
    };

    expect(receipt.status).toBe('pending');
    expect(receipt.finalized).toBe(false);
  });

  it('defines Solver correctly', () => {
    const solver: Solver = {
      id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      owner: '0x1234567890123456789012345678901234567890',
      bondAmount: 100000000000000000n,
      status: 'active',
      reputation: 95,
      jailCount: 0,
      registeredAt: 1699000000n,
    };

    expect(solver.status).toBe('active');
    expect(solver.reputation).toBe(95);
  });

  it('defines Dispute correctly', () => {
    const dispute: Dispute = {
      id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      receiptId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      challenger: '0x1234567890123456789012345678901234567890',
      reason: DisputeReason.TIMEOUT,
      evidenceHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      status: 'open',
      openedAt: 1699996400n,
      deadline: 1700082800n,
      blockNumber: 1000000n,
      challengerBond: 50000000000000000n,
    };

    expect(dispute.status).toBe('open');
    expect(dispute.reason).toBe(DisputeReason.TIMEOUT);
  });

  it('defines DisputeReason enum', () => {
    expect(DisputeReason.TIMEOUT).toBe('TIMEOUT');
    expect(DisputeReason.WRONG_AMOUNT).toBe('WRONG_AMOUNT');
    expect(DisputeReason.WRONG_TOKEN).toBe('WRONG_TOKEN');
    expect(DisputeReason.WRONG_RECIPIENT).toBe('WRONG_RECIPIENT');
    expect(DisputeReason.CONSTRAINT_VIOLATION).toBe('CONSTRAINT_VIOLATION');
    expect(DisputeReason.OTHER).toBe('OTHER');
  });
});
