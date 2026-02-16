// Centralized configuration for external URLs
// These can be overridden via environment variables

// Network configurations
export interface NetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  nativeToken: string;
  explorer: string;
  rpcUrl: string;
  contracts: {
    solverRegistry: string;
    intentReceiptHub: string;
    disputeModule: string;
    erc8004Adapter?: string;
  };
  subgraphUrl?: string;
  isTestnet: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    shortName: 'SEP',
    nativeToken: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://rpc.sepolia.org',
    contracts: {
      solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
      intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
      disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
    },
    subgraphUrl: 'https://api.studio.thegraph.com/query/YOUR_ID/irsb-sepolia/version/latest',
    isTestnet: true,
  },
  amoy: {
    chainId: 80002,
    name: 'Polygon Amoy',
    shortName: 'AMOY',
    nativeToken: 'POL',
    explorer: 'https://amoy.polygonscan.com',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    contracts: {
      // Placeholder addresses - update after deployment
      solverRegistry: '0x0000000000000000000000000000000000000000',
      intentReceiptHub: '0x0000000000000000000000000000000000000000',
      disputeModule: '0x0000000000000000000000000000000000000000',
      erc8004Adapter: '0x0000000000000000000000000000000000000000',
    },
    subgraphUrl: undefined, // Not deployed yet
    isTestnet: true,
  },
};

// Default network (can be overridden via environment)
export const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_DEFAULT_NETWORK || 'sepolia';

// Get current network config
export function getNetworkConfig(network?: string): NetworkConfig {
  const networkKey = network || DEFAULT_NETWORK;
  return NETWORKS[networkKey] || NETWORKS[DEFAULT_NETWORK];
}

// Legacy config export for backwards compatibility
export const config = {
  // CTA redirect destinations
  bookCallUrl: process.env.NEXT_PUBLIC_BOOK_CALL_URL ||
    'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2AyAXFHec9JKIVgHd_NObZfGHOiYBTqjvVb3ky3ygRWpz8lF--p0UaYZPi4SwEbo0NHWhauJvS',

  requestDocsUrl: process.env.NEXT_PUBLIC_REQUEST_DOCS_URL ||
    'https://intentsolutions.io/contact?subject=IRSB%20Protocol&interest=Protocol%20Pilot',

  // Contact info
  email: 'jeremy@intentsolutions.io',
  company: 'Intent Solutions',
  companyUrl: 'https://intentsolutions.io',

  // Contract addresses (default network - Sepolia)
  contracts: NETWORKS[DEFAULT_NETWORK].contracts,

  // Network
  network: DEFAULT_NETWORK,
  etherscanBase: NETWORKS[DEFAULT_NETWORK].explorer,
}

export function getExplorerUrl(network: string, address: string): string {
  const networkConfig = getNetworkConfig(network);
  return `${networkConfig.explorer}/address/${address}`;
}

export function getEtherscanUrl(address: string): string {
  return getExplorerUrl(DEFAULT_NETWORK, address);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Chain ID to network key mapping
export const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  11155111: 'sepolia',
  80002: 'amoy',
};

// Get network key by chain ID
export function getNetworkByChainId(chainId: number): string | undefined {
  return CHAIN_ID_TO_NETWORK[chainId];
}

// Supported networks list
export const SUPPORTED_NETWORKS = Object.keys(NETWORKS);
