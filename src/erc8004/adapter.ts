/**
 * ERC-8004 Adapter
 *
 * Integration with ERC-8004 Agent Registry for identity and reputation.
 *
 * IRSB = Accountability layer
 * ERC-8004 = Registry layer
 *
 * We read identity from ERC-8004 and publish validation signals back.
 */

import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'erc8004-adapter' });

/**
 * Agent Card from ERC-8004 registry
 */
export interface AgentCard {
  agentId: string;
  name: string;
  description: string;
  owner: string;
  publicKey: string;
  capabilities: string[];
  registeredAt: number;
  metadata: Record<string, unknown>;
}

/**
 * Reputation score from ERC-8004
 */
export interface ReputationScore {
  agentId: string;
  score: number; // 0-100
  totalTransactions: number;
  successRate: number;
  lastUpdated: number;
}

/**
 * Validation signal to publish to ERC-8004
 */
export const ValidationSignalSchema = z.object({
  agentId: z.string(),
  signalType: z.enum(['RECEIPT_FINALIZED', 'DISPUTE_WON', 'DISPUTE_LOST']),
  receiptId: z.string(),
  timestamp: z.number(),
  evidenceHash: z.string(),
});

export type ValidationSignal = z.infer<typeof ValidationSignalSchema>;

/**
 * Reputation update to publish to ERC-8004
 */
export const ReputationUpdateSchema = z.object({
  agentId: z.string(),
  delta: z.number(), // +1 for success, -X for slash
  reason: z.string(),
  evidenceHash: z.string(),
});

export type ReputationUpdate = z.infer<typeof ReputationUpdateSchema>;

/**
 * ERC-8004 adapter configuration
 */
export interface ERC8004Config {
  /**
   * Whether ERC-8004 integration is enabled
   */
  enabled: boolean;

  /**
   * ERC-8004 registry contract address
   */
  registryAddress?: string;

  /**
   * Chain ID for ERC-8004 registry
   */
  registryChainId?: number;

  /**
   * RPC URL for registry queries
   */
  rpcUrl?: string;

  /**
   * API endpoint for off-chain registry (if applicable)
   */
  apiEndpoint?: string;
}

/**
 * ERC-8004 integration adapter
 */
export class ERC8004Adapter {
  constructor(private readonly config: ERC8004Config) {}

  /**
   * Check if adapter is enabled
   */
  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Resolve an agent identity from ERC-8004 registry
   */
  async resolveAgent(agentId: string): Promise<AgentCard | null> {
    if (!this.config.enabled) {
      logger.debug({ agentId }, 'ERC-8004 disabled, skipping agent resolution');
      return null;
    }

    // TODO: Implement actual ERC-8004 contract call
    // For now, return a stub
    logger.info({ agentId }, 'Resolving agent from ERC-8004 registry');

    return {
      agentId,
      name: `Agent ${agentId.slice(0, 8)}`,
      description: 'IRSB Protocol Agent',
      owner: '0x0000000000000000000000000000000000000000',
      publicKey: '0x',
      capabilities: ['IRSB_SOLVER', 'IRSB_WATCHTOWER'],
      registeredAt: Date.now(),
      metadata: {},
    };
  }

  /**
   * Check if an agent is a registered validator
   */
  async isValidator(agentId: string, _registryId: string): Promise<boolean> {
    if (!this.config.enabled) {
      return true; // Assume valid when disabled
    }

    // TODO: Implement actual ERC-8004 contract call
    logger.info({ agentId }, 'Checking validator status');
    return true;
  }

  /**
   * Get an agent's reputation score
   */
  async getReputation(agentId: string): Promise<ReputationScore | null> {
    if (!this.config.enabled) {
      return null;
    }

    // TODO: Implement actual ERC-8004 contract call
    logger.info({ agentId }, 'Getting agent reputation');

    return {
      agentId,
      score: 100,
      totalTransactions: 0,
      successRate: 1.0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Publish a validation signal to ERC-8004
   */
  async publishValidation(signal: ValidationSignal): Promise<void> {
    if (!this.config.enabled) {
      logger.info({ signal }, 'ERC-8004 disabled, logging validation signal only');
      return;
    }

    // TODO: Implement actual ERC-8004 contract call or API
    logger.info({ signal }, 'Publishing validation signal to ERC-8004');
  }

  /**
   * Update an agent's reputation
   */
  async updateReputation(update: ReputationUpdate): Promise<void> {
    if (!this.config.enabled) {
      logger.info({ update }, 'ERC-8004 disabled, logging reputation update only');
      return;
    }

    // TODO: Implement actual ERC-8004 contract call or API
    logger.info({ update }, 'Publishing reputation update to ERC-8004');
  }
}

/**
 * Create default ERC-8004 configuration (disabled)
 */
export function createDefaultERC8004Config(): ERC8004Config {
  return {
    enabled: false,
  };
}

/**
 * Create ERC-8004 configuration from environment
 */
export function createERC8004ConfigFromEnv(): ERC8004Config {
  const enabled = process.env['ERC8004_ENABLED'] === 'true';

  if (!enabled) {
    return { enabled: false };
  }

  const chainIdStr = process.env['ERC8004_REGISTRY_CHAIN_ID'];
  const registryAddress = process.env['ERC8004_REGISTRY_ADDRESS'];
  const rpcUrl = process.env['ERC8004_RPC_URL'];
  const apiEndpoint = process.env['ERC8004_API_ENDPOINT'];

  const config: ERC8004Config = { enabled: true };

  if (registryAddress !== undefined) {
    config.registryAddress = registryAddress;
  }
  if (chainIdStr !== undefined) {
    config.registryChainId = parseInt(chainIdStr, 10);
  }
  if (rpcUrl !== undefined) {
    config.rpcUrl = rpcUrl;
  }
  if (apiEndpoint !== undefined) {
    config.apiEndpoint = apiEndpoint;
  }

  return config;
}
