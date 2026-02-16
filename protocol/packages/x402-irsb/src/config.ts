/**
 * Network Configuration Helpers
 *
 * Pre-configured contract addresses for supported networks.
 */

/**
 * Network configuration for IRSB contracts
 */
export interface NetworkConfig {
  /** Chain ID */
  chainId: number;
  /** Network name */
  name: string;
  /** IntentReceiptHub contract address */
  hubAddress: string;
  /** SolverRegistry contract address */
  registryAddress: string;
  /** DisputeModule contract address */
  disputeModuleAddress: string;
  /** EscrowVault contract address (if deployed) */
  escrowAddress?: string;
  /** Public RPC URL (for convenience, not for production) */
  publicRpcUrl?: string;
  /** Block explorer URL */
  explorerUrl?: string;
}

/**
 * Sepolia testnet configuration
 */
export const SEPOLIA_CONFIG: NetworkConfig = {
  chainId: 11155111,
  name: 'sepolia',
  hubAddress: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
  registryAddress: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
  disputeModuleAddress: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
  publicRpcUrl: 'https://rpc.sepolia.org',
  explorerUrl: 'https://sepolia.etherscan.io',
};

/**
 * All supported network configurations
 */
const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  [SEPOLIA_CONFIG.chainId]: SEPOLIA_CONFIG,
};

/**
 * Get network configuration by chain ID.
 *
 * @param chainId - The chain ID to look up
 * @returns Network configuration or undefined if not supported
 */
export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORK_CONFIGS[chainId];
}

/**
 * Get network configuration by chain ID, throwing if not found.
 *
 * @param chainId - The chain ID to look up
 * @returns Network configuration
 * @throws Error if chain ID is not supported
 */
export function requireNetworkConfig(chainId: number): NetworkConfig {
  const config = getNetworkConfig(chainId);
  if (!config) {
    const supported = Object.keys(NETWORK_CONFIGS).join(', ');
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${supported}`);
  }
  return config;
}

/**
 * Check if a chain ID is supported.
 *
 * @param chainId - The chain ID to check
 * @returns true if supported
 */
export function isSupportedChain(chainId: number): boolean {
  return chainId in NETWORK_CONFIGS;
}

/**
 * Get list of all supported chain IDs.
 *
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(NETWORK_CONFIGS).map(Number);
}

/**
 * Get Etherscan link for a transaction.
 *
 * @param txHash - Transaction hash
 * @param chainId - Chain ID
 * @returns Etherscan URL or undefined if chain not supported
 */
export function getTransactionUrl(txHash: string, chainId: number): string | undefined {
  const config = getNetworkConfig(chainId);
  if (!config?.explorerUrl) return undefined;
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Get Etherscan link for a contract address.
 *
 * @param address - Contract address
 * @param chainId - Chain ID
 * @returns Etherscan URL or undefined if chain not supported
 */
export function getAddressUrl(address: string, chainId: number): string | undefined {
  const config = getNetworkConfig(chainId);
  if (!config?.explorerUrl) return undefined;
  return `${config.explorerUrl}/address/${address}`;
}

/**
 * Get Etherscan link for the IntentReceiptHub on a given chain.
 *
 * @param chainId - Chain ID
 * @returns Etherscan URL or undefined if chain not supported
 */
export function getHubUrl(chainId: number): string | undefined {
  const config = getNetworkConfig(chainId);
  if (!config?.explorerUrl) return undefined;
  return `${config.explorerUrl}/address/${config.hubAddress}`;
}
