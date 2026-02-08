/**
 * ERC-8004 Adapter
 *
 * Integration with ERC-8004 Agent Registry for identity and reputation.
 *
 * IRSB = Accountability layer (computes IntentScore)
 * ERC-8004 = Registry layer (stores raw signals, no aggregation)
 *
 * Key Insight (ADR-001):
 * - ERC-8004 stores individual validation signals (0-100 per event)
 * - IRSB computes aggregate IntentScore (0-10000 basis points)
 * - These are COMPLEMENTARY, not competing
 *
 * We:
 * 1. PUBLISH validation signals to ERC-8004 when IRSB events occur
 * 2. CONSUME ERC-8004 reputation for cross-protocol trust (bond modifiers)
 */

import { z } from 'zod';
import pino from 'pino';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Address, type Hash } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const logger = pino({ name: 'erc8004-adapter' });

// ============ ERC-8004 Contract Addresses ============
// From: https://github.com/erc-8004/erc-8004-contracts

export const ERC8004_ADDRESSES = {
  // Mainnet (Ethereum, Base, Polygon, Arbitrum, etc.)
  mainnet: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address,
  },
  // Sepolia testnets
  sepolia: {
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as Address,
    reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as Address,
  },
} as const;

// ============ ABI Definitions ============

const IDENTITY_REGISTRY_ABI = [
  {
    name: 'tokenURI',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    name: 'getAgentWallet',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'getMetadata',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    name: 'ownerOf',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

const REPUTATION_REGISTRY_ABI = [
  {
    name: 'giveFeedback',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getSummary',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'totalFeedback', type: 'uint256' },
      { name: 'averageValue', type: 'int256' },
      { name: 'positiveCount', type: 'uint256' },
      { name: 'negativeCount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

// ============ Types ============

/**
 * Agent Card from ERC-8004 registry
 */
export interface AgentCard {
  agentId: string;
  name: string;
  description: string;
  owner: string;
  agentWallet: string;
  agentURI: string;
  capabilities: string[];
  registeredAt: number;
  metadata: Record<string, unknown>;
}

/**
 * Reputation summary from ERC-8004
 */
export interface ReputationSummary {
  agentId: string;
  totalFeedback: number;
  averageScore: number; // -100 to 100 (normalized from int128)
  positiveCount: number;
  negativeCount: number;
  lastQueried: number;
}

/**
 * IRSB IntentScore mapped for ERC-8004
 * IRSB uses 0-10000 basis points, ERC-8004 uses 0-100
 */
export interface IntentScoreMapping {
  irsbScore: number; // 0-10000 basis points
  erc8004Score: number; // 0-100 (irsbScore / 100)
}

/**
 * Validation signal to publish to ERC-8004
 */
export const ValidationSignalSchema = z.object({
  agentId: z.string(),
  signalType: z.enum([
    'RECEIPT_FINALIZED',
    'DISPUTE_WON',
    'DISPUTE_LOST',
    'SOLVER_SLASHED',
    'SOLVER_JAILED',
  ]),
  receiptId: z.string(),
  timestamp: z.number(),
  evidenceHash: z.string(),
  intentScoreDelta: z.number().optional(), // How this affects IntentScore
});

export type ValidationSignal = z.infer<typeof ValidationSignalSchema>;

/**
 * Signal type to ERC-8004 feedback value mapping
 * Positive = good for reputation, negative = bad
 */
export const SIGNAL_TO_FEEDBACK: Record<ValidationSignal['signalType'], { value: number; tag: string }> = {
  RECEIPT_FINALIZED: { value: 100, tag: 'success' },
  DISPUTE_WON: { value: 90, tag: 'dispute-won' },
  DISPUTE_LOST: { value: -50, tag: 'dispute-lost' },
  SOLVER_SLASHED: { value: -80, tag: 'slashed' },
  SOLVER_JAILED: { value: -100, tag: 'jailed' },
};

/**
 * Reputation update for bond calculation
 */
export const ReputationUpdateSchema = z.object({
  agentId: z.string(),
  delta: z.number(), // +1 for success, -X for slash
  reason: z.string(),
  evidenceHash: z.string(),
});

export type ReputationUpdate = z.infer<typeof ReputationUpdateSchema>;

/**
 * Bond modifier based on ERC-8004 reputation
 * Used for reputation-weighted bond requirements
 */
export interface BondModifier {
  agentId: string;
  erc8004Score: number; // Average score from ERC-8004
  modifier: number; // Multiplier (0.5 = 50% of standard bond)
  effectiveBond: bigint; // Actual bond in wei
  reasoning: string;
}

// ============ Configuration ============

export interface ERC8004Config {
  enabled: boolean;
  network: 'mainnet' | 'sepolia';
  rpcUrl: string;
  privateKey?: string; // For publishing signals (optional)
  providerName: string; // IRSB identifier in feedback
  cacheTimeMs: number; // How long to cache reputation queries
}

const DEFAULT_CONFIG: ERC8004Config = {
  enabled: false,
  network: 'sepolia',
  rpcUrl: '',
  providerName: 'IRSB Protocol',
  cacheTimeMs: 60_000, // 1 minute cache
};

// ============ Bond Calculation Constants ============

const STANDARD_BOND = BigInt('100000000000000000'); // 0.1 ETH in wei

/**
 * Map ERC-8004 average score to bond modifier
 * Higher reputation = lower bond requirement
 */
function calculateBondModifier(avgScore: number): { modifier: number; reasoning: string } {
  if (avgScore >= 90) {
    return { modifier: 0.5, reasoning: 'Excellent cross-protocol reputation (90-100)' };
  } else if (avgScore >= 70) {
    return { modifier: 0.75, reasoning: 'Good cross-protocol reputation (70-89)' };
  } else if (avgScore >= 50) {
    return { modifier: 1.0, reasoning: 'Standard bond - moderate reputation (50-69)' };
  } else if (avgScore >= 30) {
    return { modifier: 1.5, reasoning: 'Elevated bond - low reputation (30-49)' };
  } else if (avgScore > 0) {
    return { modifier: 2.0, reasoning: 'Maximum bond - poor reputation (1-29)' };
  } else {
    return { modifier: 1.0, reasoning: 'Standard bond - no ERC-8004 history' };
  }
}

// ============ Main Adapter Class ============

export class ERC8004Adapter {
  private readonly config: ERC8004Config;
  private readonly publicClient: PublicClient | null;
  private readonly walletClient: WalletClient | null;
  private readonly addresses: typeof ERC8004_ADDRESSES.mainnet;
  private readonly reputationCache: Map<string, { data: ReputationSummary; expiresAt: number }>;

  constructor(config: Partial<ERC8004Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reputationCache = new Map();

    // Select addresses based on network
    this.addresses = this.config.network === 'mainnet'
      ? ERC8004_ADDRESSES.mainnet
      : ERC8004_ADDRESSES.sepolia;

    // Initialize clients if enabled and RPC URL provided
    if (this.config.enabled && this.config.rpcUrl) {
      const chain = this.config.network === 'mainnet' ? mainnet : sepolia;

      this.publicClient = createPublicClient({
        chain,
        transport: http(this.config.rpcUrl),
      });

      // Wallet client for writing (publishing signals)
      if (this.config.privateKey) {
        const account = privateKeyToAccount(this.config.privateKey as `0x${string}`);
        this.walletClient = createWalletClient({
          account,
          chain,
          transport: http(this.config.rpcUrl),
        });
      } else {
        this.walletClient = null;
      }
    } else {
      this.publicClient = null;
      this.walletClient = null;
    }

    logger.info({
      enabled: this.config.enabled,
      network: this.config.network,
      hasPublicClient: !!this.publicClient,
      hasWalletClient: !!this.walletClient,
    }, 'ERC-8004 adapter initialized');
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  // ============ Identity Resolution ============

  /**
   * Resolve an agent identity from ERC-8004 Identity Registry
   */
  async resolveAgent(agentId: string): Promise<AgentCard | null> {
    if (!this.config.enabled || !this.publicClient) {
      logger.debug({ agentId }, 'ERC-8004 disabled, skipping agent resolution');
      return null;
    }

    try {
      const tokenId = BigInt(agentId);

      // Get agent URI (tokenURI)
      const agentURI = await this.publicClient.readContract({
        address: this.addresses.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'tokenURI',
        args: [tokenId],
      });

      // Get agent wallet
      const agentWallet = await this.publicClient.readContract({
        address: this.addresses.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getAgentWallet',
        args: [tokenId],
      });

      // Get owner (NFT holder)
      const owner = await this.publicClient.readContract({
        address: this.addresses.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      });

      // Fetch registration file from URI
      let metadata: Record<string, unknown> = {};
      let name = `Agent ${agentId}`;
      let description = '';
      let capabilities: string[] = [];

      if (agentURI && typeof agentURI === 'string') {
        try {
          const response = await fetch(agentURI);
          if (response.ok) {
            const data = await response.json() as Record<string, unknown>;
            name = (data['name'] as string) || name;
            description = (data['description'] as string) || '';
            const services = data['services'] as Array<{ name: string }> | undefined;
            capabilities = services?.map((s) => s.name) || [];
            metadata = data;
          }
        } catch (fetchError) {
          logger.warn({ agentId, agentURI, error: fetchError }, 'Failed to fetch agent registration file');
        }
      }

      logger.info({ agentId, owner, agentWallet }, 'Resolved agent from ERC-8004');

      return {
        agentId,
        name,
        description,
        owner: owner as string,
        agentWallet: agentWallet as string,
        agentURI: agentURI as string,
        capabilities,
        registeredAt: Date.now(), // Would need to query events for actual timestamp
        metadata,
      };
    } catch (error) {
      logger.error({ agentId, error }, 'Failed to resolve agent from ERC-8004');
      return null;
    }
  }

  /**
   * Verify that a wallet address controls an ERC-8004 agent
   */
  async verifyAgentOwnership(agentId: string, walletAddress: string): Promise<boolean> {
    const agent = await this.resolveAgent(agentId);
    if (!agent) return false;

    // Check both owner (NFT holder) and agentWallet
    const normalizedWallet = walletAddress.toLowerCase();
    return (
      agent.owner.toLowerCase() === normalizedWallet ||
      agent.agentWallet.toLowerCase() === normalizedWallet
    );
  }

  // ============ Reputation Queries ============

  /**
   * Get an agent's reputation summary from ERC-8004
   */
  async getReputation(agentId: string): Promise<ReputationSummary | null> {
    if (!this.config.enabled || !this.publicClient) {
      return null;
    }

    // Check cache
    const cached = this.reputationCache.get(agentId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const tokenId = BigInt(agentId);

      // Query reputation summary with IRSB tag filter
      const [totalFeedback, averageValue, positiveCount, negativeCount] = await this.publicClient.readContract({
        address: this.addresses.reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getSummary',
        args: [tokenId, [], 'irsb', ''], // Filter by IRSB tag
      }) as [bigint, bigint, bigint, bigint];

      // Normalize average value (int128 with decimals) to 0-100 scale
      // WARNING: We assume ERC-8004 feedback uses 2 decimal places (valueDecimals=2).
      // This is consistent with our publishValidation() but other providers may differ.
      // If cross-protocol reputation seems off, check decimal precision at the source.
      const avgScore = Number(averageValue) / 100;

      const summary: ReputationSummary = {
        agentId,
        totalFeedback: Number(totalFeedback),
        averageScore: avgScore,
        positiveCount: Number(positiveCount),
        negativeCount: Number(negativeCount),
        lastQueried: Date.now(),
      };

      // Cache the result
      this.reputationCache.set(agentId, {
        data: summary,
        expiresAt: Date.now() + this.config.cacheTimeMs,
      });

      logger.info({ agentId, summary }, 'Retrieved ERC-8004 reputation');
      return summary;
    } catch (error) {
      logger.error({ agentId, error }, 'Failed to get ERC-8004 reputation');
      return null;
    }
  }

  /**
   * Calculate bond modifier based on ERC-8004 reputation
   * Used for reputation-weighted bond requirements
   */
  async calculateBondForAgent(agentId: string): Promise<BondModifier> {
    const reputation = await this.getReputation(agentId);

    if (!reputation || reputation.totalFeedback === 0) {
      return {
        agentId,
        erc8004Score: 0,
        modifier: 1.0,
        effectiveBond: STANDARD_BOND,
        reasoning: 'Standard bond - no ERC-8004 history',
      };
    }

    const { modifier, reasoning } = calculateBondModifier(reputation.averageScore);
    const effectiveBond = BigInt(Math.floor(Number(STANDARD_BOND) * modifier));

    return {
      agentId,
      erc8004Score: reputation.averageScore,
      modifier,
      effectiveBond,
      reasoning,
    };
  }

  // ============ Signal Publishing ============

  /**
   * Publish a validation signal to ERC-8004 Reputation Registry
   */
  async publishValidation(signal: ValidationSignal): Promise<Hash | null> {
    if (!this.config.enabled) {
      logger.info({ signal }, 'ERC-8004 disabled, logging validation signal only');
      return null;
    }

    if (!this.walletClient) {
      logger.warn({ signal }, 'No wallet configured for ERC-8004 publishing');
      return null;
    }

    try {
      const tokenId = BigInt(signal.agentId);
      const feedbackConfig = SIGNAL_TO_FEEDBACK[signal.signalType];

      // Prepare feedback parameters
      const value = BigInt(feedbackConfig.value * 100); // 2 decimal places
      const valueDecimals = 2;
      const tag1 = 'irsb'; // Primary tag for IRSB signals
      const tag2 = feedbackConfig.tag;
      const endpoint = ''; // IRSB doesn't have per-endpoint feedback
      const feedbackURI = ''; // Could point to evidence bundle
      const feedbackHash = signal.evidenceHash as `0x${string}`;

      const chain = this.config.network === 'mainnet' ? mainnet : sepolia;
      const account = this.walletClient.account;
      if (!account) {
        throw new Error('Wallet client has no account configured');
      }
      const hash = await this.walletClient.writeContract({
        chain,
        account,
        address: this.addresses.reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'giveFeedback',
        args: [tokenId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
      });

      logger.info({ signal, txHash: hash }, 'Published validation signal to ERC-8004');

      // Invalidate cache for this agent
      this.reputationCache.delete(signal.agentId);

      return hash;
    } catch (error) {
      logger.error({ signal, error }, 'Failed to publish validation signal to ERC-8004');
      return null;
    }
  }

  /**
   * Publish reputation update (convenience wrapper)
   */
  async updateReputation(update: ReputationUpdate): Promise<Hash | null> {
    // Map delta to signal type
    // Thresholds based on SIGNAL_TO_FEEDBACK values:
    //   RECEIPT_FINALIZED: +100, DISPUTE_WON: +90, DISPUTE_LOST: -50,
    //   SOLVER_SLASHED: -80, SOLVER_JAILED: -100
    let signalType: ValidationSignal['signalType'];
    if (update.delta >= 50) {
      signalType = 'RECEIPT_FINALIZED';
    } else if (update.delta >= 0) {
      signalType = 'DISPUTE_WON';
    } else if (update.delta > -80) {
      // Covers range (-80, 0), e.g. -50 for DISPUTE_LOST
      signalType = 'DISPUTE_LOST';
    } else if (update.delta > -100) {
      // Covers range [-100, -80], e.g. -80 for SLASHED
      signalType = 'SOLVER_SLASHED';
    } else {
      // Covers values <= -100, e.g. -100 for JAILED
      signalType = 'SOLVER_JAILED';
    }

    return this.publishValidation({
      agentId: update.agentId,
      signalType,
      receiptId: '', // Not available in this context
      timestamp: Date.now(),
      evidenceHash: update.evidenceHash,
    });
  }

  // ============ IntentScore Mapping ============

  /**
   * Convert IRSB IntentScore (0-10000) to ERC-8004 scale (0-100)
   */
  mapIntentScoreToERC8004(irsbScore: number): IntentScoreMapping {
    return {
      irsbScore,
      erc8004Score: Math.floor(irsbScore / 100),
    };
  }

  /**
   * Convert ERC-8004 score (0-100) to IRSB IntentScore (0-10000)
   */
  mapERC8004ToIntentScore(erc8004Score: number): IntentScoreMapping {
    return {
      irsbScore: erc8004Score * 100,
      erc8004Score,
    };
  }
}

// ============ Factory Functions ============

/**
 * Create default ERC-8004 configuration (disabled)
 */
export function createDefaultERC8004Config(): ERC8004Config {
  return { ...DEFAULT_CONFIG };
}

/**
 * Create ERC-8004 configuration from environment
 */
export function createERC8004ConfigFromEnv(): ERC8004Config {
  const enabled = process.env['ERC8004_ENABLED'] === 'true';

  if (!enabled) {
    return { enabled: false, network: 'sepolia', rpcUrl: '', providerName: 'IRSB Protocol', cacheTimeMs: 60_000 };
  }

  const privateKey = process.env['ERC8004_PRIVATE_KEY'] || process.env['LIT_AUTH_PRIVATE_KEY'];
  const config: ERC8004Config = {
    enabled: true,
    network: (process.env['ERC8004_NETWORK'] as 'mainnet' | 'sepolia') || 'sepolia',
    rpcUrl: process.env['ERC8004_RPC_URL'] || process.env['RPC_URL'] || '',
    providerName: process.env['ERC8004_PROVIDER_NAME'] || 'IRSB Protocol',
    cacheTimeMs: parseInt(process.env['ERC8004_CACHE_MS'] || '60000', 10),
  };
  if (privateKey) {
    config.privateKey = privateKey;
  }
  return config;
}

/**
 * Create a configured ERC-8004 adapter from environment
 */
export function createERC8004Adapter(): ERC8004Adapter {
  const config = createERC8004ConfigFromEnv();
  return new ERC8004Adapter(config);
}
