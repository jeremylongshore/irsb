/**
 * Decoded ERC-8004 registration event from chain logs.
 */
export interface IdentityRegistrationEvent {
  agentTokenId: string;
  agentUri: string;
  ownerAddress: string;
  eventType: 'Registered' | 'Transfer';
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}

/**
 * Abstraction for polling ERC-8004 IdentityRegistry events.
 * The CLI adapter converts ChainProvider into this interface.
 */
export interface IdentityEventSource {
  getLatestBlockNumber(): Promise<bigint>;
  getRegistrationEvents(
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<IdentityRegistrationEvent[]>;
}

/**
 * Build a deterministic agent ID from chain coordinates.
 * Format: erc8004:<chainId>:<registryAddress>:<tokenId>
 */
export function makeAgentId(
  chainId: number,
  registryAddress: string,
  tokenId: string,
): string {
  return `erc8004:${chainId}:${registryAddress.toLowerCase()}:${tokenId}`;
}

/**
 * Parse an agent ID back into its components. Returns null if format is invalid.
 */
export function parseAgentId(
  agentId: string,
): { chainId: number; registryAddress: string; tokenId: string } | null {
  const parts = agentId.split(':');
  if (parts.length !== 4 || parts[0] !== 'erc8004') return null;
  const chainId = parseInt(parts[1]!, 10);
  if (Number.isNaN(chainId)) return null;
  return {
    chainId,
    registryAddress: parts[2]!,
    tokenId: parts[3]!,
  };
}

export type CardFetchStatus =
  | 'OK'
  | 'UNREACHABLE'
  | 'INVALID_SCHEMA'
  | 'SSRF_BLOCKED'
  | 'TIMEOUT';

/**
 * Result of fetching + validating an agent card from a URI.
 */
export interface CardFetchResult {
  status: CardFetchStatus;
  cardHash?: string;
  cardJson?: string;
  httpStatus?: number;
  error?: string;
}
