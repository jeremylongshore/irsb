import { describe, it, expect, beforeEach } from 'vitest';
import type { ChainProvider, BlockInfo, ParsedEvent } from '../src/provider.js';

/**
 * Mock chain provider for testing
 */
class MockChainProvider implements ChainProvider {
  private mockBlockNumber = 1000000n;
  private mockChainId = 11155111;

  async getChainId(): Promise<number> {
    return this.mockChainId;
  }

  async getBlockNumber(): Promise<bigint> {
    return this.mockBlockNumber;
  }

  async getBlock(blockNumber: bigint): Promise<BlockInfo | null> {
    if (blockNumber > this.mockBlockNumber) {
      return null;
    }
    return {
      number: blockNumber,
      timestamp: BigInt(Date.now()) / 1000n,
      hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
    };
  }

  async getLatestBlock(): Promise<BlockInfo> {
    return {
      number: this.mockBlockNumber,
      timestamp: BigInt(Date.now()) / 1000n,
      hash: `0x${this.mockBlockNumber.toString(16).padStart(64, '0')}`,
    };
  }

  async getEvents(): Promise<ParsedEvent[]> {
    return [
      {
        name: 'ReceiptPosted',
        blockNumber: this.mockBlockNumber - 10n,
        txHash: '0x1234',
        logIndex: 0,
        address: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
        args: {
          receiptId: '0xabc123',
          solverId: '0xdef456',
        },
        raw: {} as never,
      },
    ];
  }

  async readContract(): Promise<unknown> {
    return 'mock-result';
  }

  async isConnected(): Promise<boolean> {
    return true;
  }

  // Test helpers
  setBlockNumber(n: bigint): void {
    this.mockBlockNumber = n;
  }

  setChainId(id: number): void {
    this.mockChainId = id;
  }
}

describe('MockChainProvider', () => {
  let provider: MockChainProvider;

  beforeEach(() => {
    provider = new MockChainProvider();
  });

  it('returns chain ID', async () => {
    expect(await provider.getChainId()).toBe(11155111);
  });

  it('returns block number', async () => {
    expect(await provider.getBlockNumber()).toBe(1000000n);
  });

  it('returns block info', async () => {
    const block = await provider.getBlock(999999n);
    expect(block).not.toBeNull();
    expect(block?.number).toBe(999999n);
  });

  it('returns null for future blocks', async () => {
    const block = await provider.getBlock(2000000n);
    expect(block).toBeNull();
  });

  it('returns latest block', async () => {
    const block = await provider.getLatestBlock();
    expect(block.number).toBe(1000000n);
  });

  it('returns mock events', async () => {
    const events = await provider.getEvents({} as never, {
      fromBlock: 0n,
      toBlock: 1000000n,
    });
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('ReceiptPosted');
  });

  it('reports connected', async () => {
    expect(await provider.isConnected()).toBe(true);
  });
});

describe('ChainProvider interface', () => {
  it('defines all required methods', () => {
    const provider = new MockChainProvider();

    // Type check - these should all exist
    expect(typeof provider.getChainId).toBe('function');
    expect(typeof provider.getBlockNumber).toBe('function');
    expect(typeof provider.getBlock).toBe('function');
    expect(typeof provider.getLatestBlock).toBe('function');
    expect(typeof provider.getEvents).toBe('function');
    expect(typeof provider.readContract).toBe('function');
    expect(typeof provider.isConnected).toBe('function');
  });
});
