/**
 * Minimal transaction info returned by the data source.
 * All heuristics work off this shape — no raw RPC objects leak in.
 */
export interface TransactionInfo {
  hash: string;
  blockNumber: bigint;
  from: string;
  to: string | null;
  value: bigint;
  /** Unix epoch seconds */
  timestamp: number;
  /** true if `from` is a contract (code.length > 0) */
  fromIsContract: boolean;
}

/**
 * ERC-20 transfer info (for optional payment adjacency).
 */
export interface TokenTransferInfo {
  tokenAddress: string;
  from: string;
  to: string;
  /** Raw uint256 value */
  value: bigint;
  blockNumber: bigint;
  txHash: string;
}

export type FundingKind =
  | 'UNKNOWN'
  | 'EOA'
  | 'CONTRACT'
  | 'CEX'
  | 'MIXER'
  | 'BRIDGE';

export interface FundingSource {
  kind: FundingKind;
  /** Address that funded the agent */
  ref?: string;
}

/**
 * Injectable data source for context heuristics.
 * Implementations: real RPC adapter (CLI) or mock (tests).
 */
export interface ContextDataSource {
  /**
   * Get transactions involving the given address within a block range.
   * Bounded by caller (max blocks, max results).
   */
  getTransactions(
    address: string,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<TransactionInfo[]>;

  /**
   * Get the current chain tip block number.
   */
  getBlockNumber(): Promise<bigint>;

  /**
   * Get ERC-20 Transfer events for specific token contracts involving address.
   * Only called when payment adjacency is enabled.
   */
  getTokenTransfers?(
    address: string,
    tokenAddresses: string[],
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<TokenTransferInfo[]>;
}
