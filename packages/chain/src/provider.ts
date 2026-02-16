import type { Abi, Address, Log } from 'viem';

/**
 * Block information
 */
export interface BlockInfo {
  number: bigint;
  timestamp: bigint;
  hash: string;
}

/**
 * Event filter options
 */
export interface EventFilterOptions {
  /** Contract address to filter events from */
  address?: Address;

  /** Event names to filter (from ABI) */
  eventNames?: string[];

  /** Start block (inclusive) */
  fromBlock: bigint;

  /** End block (inclusive) */
  toBlock: bigint;
}

/**
 * Parsed event with decoded args
 */
export interface ParsedEvent<TArgs = Record<string, unknown>> {
  /** Event name */
  name: string;

  /** Block number */
  blockNumber: bigint;

  /** Transaction hash */
  txHash: string;

  /** Log index */
  logIndex: number;

  /** Contract address that emitted the event */
  address: Address;

  /** Decoded event arguments */
  args: TArgs;

  /** Raw log */
  raw: Log;
}

/**
 * Chain provider interface
 *
 * Abstracts chain interactions for testing and multiple implementations
 */
export interface ChainProvider {
  /**
   * Get the chain ID
   */
  getChainId(): Promise<number>;

  /**
   * Get the current block number
   */
  getBlockNumber(): Promise<bigint>;

  /**
   * Get block information
   */
  getBlock(blockNumber: bigint): Promise<BlockInfo | null>;

  /**
   * Get the latest block
   */
  getLatestBlock(): Promise<BlockInfo>;

  /**
   * Get events from a contract within a block range
   *
   * @param abi - Contract ABI for event decoding
   * @param options - Filter options
   */
  getEvents<TAbi extends Abi>(
    abi: TAbi,
    options: EventFilterOptions
  ): Promise<ParsedEvent[]>;

  /**
   * Read a contract function (view/pure)
   *
   * @param address - Contract address
   * @param abi - Contract ABI
   * @param functionName - Function to call
   * @param args - Function arguments
   */
  readContract<TAbi extends Abi, TFunctionName extends string>(
    address: Address,
    abi: TAbi,
    functionName: TFunctionName,
    args?: readonly unknown[]
  ): Promise<unknown>;

  /**
   * Check if provider is connected
   */
  isConnected(): Promise<boolean>;
}
