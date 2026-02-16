import {
  createPublicClient,
  http,
  type PublicClient,
  type Abi,
  type Address,
  decodeEventLog,
  type DecodeEventLogReturnType,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type {
  ChainProvider,
  BlockInfo,
  EventFilterOptions,
  ParsedEvent,
} from './provider.js';

/**
 * Configuration for RPC provider
 */
export interface RpcProviderConfig {
  /** RPC URL */
  rpcUrl: string;

  /** Chain ID */
  chainId: number;
}

/**
 * Get viem chain config from chain ID
 */
function getChainConfig(chainId: number) {
  switch (chainId) {
    case 1:
      return mainnet;
    case 11155111:
      return sepolia;
    default:
      // For unknown chains, create a minimal config
      return {
        id: chainId,
        name: `Chain ${chainId}`,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [] } },
      };
  }
}

/**
 * RPC-based chain provider using viem
 */
export class RpcProvider implements ChainProvider {
  private client: PublicClient;
  private chainId: number;

  constructor(config: RpcProviderConfig) {
    this.chainId = config.chainId;
    const chain = getChainConfig(config.chainId);

    this.client = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });
  }

  async getChainId(): Promise<number> {
    return this.chainId;
  }

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async getBlock(blockNumber: bigint): Promise<BlockInfo | null> {
    const block = await this.client.getBlock({ blockNumber });
    if (!block) return null;

    return {
      number: block.number,
      timestamp: block.timestamp,
      hash: block.hash,
    };
  }

  async getLatestBlock(): Promise<BlockInfo> {
    const block = await this.client.getBlock({ blockTag: 'latest' });
    return {
      number: block.number,
      timestamp: block.timestamp,
      hash: block.hash,
    };
  }

  async getEvents<TAbi extends Abi>(
    abi: TAbi,
    options: EventFilterOptions
  ): Promise<ParsedEvent[]> {
    const logs = await this.client.getLogs({
      address: options.address,
      fromBlock: options.fromBlock,
      toBlock: options.toBlock,
    });

    const parsedEvents: ParsedEvent[] = [];

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi,
          data: log.data,
          topics: log.topics,
        }) as DecodeEventLogReturnType;

        // Filter by event name if specified
        if (options.eventNames && !options.eventNames.includes(decoded.eventName)) {
          continue;
        }

        parsedEvents.push({
          name: decoded.eventName,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          address: log.address,
          args: (decoded.args ?? {}) as unknown as Record<string, unknown>,
          raw: log,
        });
      } catch {
        // Skip logs that don't match the ABI
        continue;
      }
    }

    return parsedEvents;
  }

  async readContract<TAbi extends Abi, TFunctionName extends string>(
    address: Address,
    abi: TAbi,
    functionName: TFunctionName,
    args: readonly unknown[] = []
  ): Promise<unknown> {
    return this.client.readContract({
      address,
      abi,
      functionName,
      args,
    } as Parameters<typeof this.client.readContract>[0]);
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.client.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the underlying viem client (for advanced usage)
   */
  getClient(): PublicClient {
    return this.client;
  }
}
