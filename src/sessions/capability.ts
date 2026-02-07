/**
 * Session Capabilities
 *
 * Short-lived, scoped tokens that authorize specific actions.
 * Similar to OAuth scopes but for IRSB operations.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import type { IrsbActionType } from '../types/actions.js';
import type { AgentRole } from '../types/signing-request.js';

/**
 * Maximum capability TTL (24 hours)
 */
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Session capability schema
 */
export const SessionCapabilitySchema = z.object({
  /**
   * Unique capability ID
   */
  id: z.string().uuid(),

  /**
   * Agent ID this capability is issued to
   */
  agentId: z.string(),

  /**
   * Agent role
   */
  role: z.enum(['SOLVER', 'WATCHTOWER']),

  /**
   * Allowed action types
   */
  allowedActions: z.array(z.enum(['SUBMIT_RECEIPT', 'OPEN_DISPUTE', 'SUBMIT_EVIDENCE'])),

  /**
   * Allowed contract addresses (empty = all allowed)
   */
  allowedContracts: z.array(z.string()).optional(),

  /**
   * Allowed chain IDs (empty = all allowed)
   */
  allowedChains: z.array(z.number()).optional(),

  /**
   * Maximum spend per request (wei)
   */
  maxSpendPerRequest: z.string().optional(),

  /**
   * Maximum requests during this session
   */
  maxRequests: z.number().optional(),

  /**
   * Issued at (unix ms)
   */
  issuedAt: z.number(),

  /**
   * Expires at (unix ms)
   */
  expiresAt: z.number(),

  /**
   * Signature for verification
   */
  signature: z.string(),
});

export type SessionCapability = z.infer<typeof SessionCapabilitySchema>;

/**
 * Capability token (base64-encoded capability)
 */
export type CapabilityToken = string;

/**
 * Capability issuer configuration
 */
export interface IssuerConfig {
  /**
   * HMAC secret for signing capabilities
   */
  secret: string;

  /**
   * Default TTL in milliseconds
   */
  defaultTtlMs: number;

  /**
   * Maximum requests per session
   */
  maxRequestsPerSession: number;
}

/**
 * Issue session capabilities
 */
export class CapabilityIssuer {
  constructor(private readonly config: IssuerConfig) {}

  /**
   * Issue a new capability token
   */
  issue(params: {
    agentId: string;
    role: AgentRole;
    allowedActions: IrsbActionType[];
    allowedContracts?: string[];
    allowedChains?: number[];
    maxSpendPerRequest?: bigint;
    ttlMs?: number;
  }): CapabilityToken {
    const now = Date.now();
    const ttl = Math.min(params.ttlMs ?? this.config.defaultTtlMs, MAX_TTL_MS);

    const capability: Omit<SessionCapability, 'signature'> = {
      id: randomUUID(),
      agentId: params.agentId,
      role: params.role,
      allowedActions: params.allowedActions,
      allowedContracts: params.allowedContracts,
      allowedChains: params.allowedChains,
      maxSpendPerRequest: params.maxSpendPerRequest?.toString(),
      maxRequests: this.config.maxRequestsPerSession,
      issuedAt: now,
      expiresAt: now + ttl,
    };

    // Sign the capability
    const signature = this.sign(capability);
    const signedCapability: SessionCapability = { ...capability, signature };

    // Encode as base64
    return Buffer.from(JSON.stringify(signedCapability)).toString('base64url');
  }

  /**
   * Sign a capability
   */
  private sign(capability: Omit<SessionCapability, 'signature'>): string {
    const payload = JSON.stringify(capability);
    const hmac = createHmac('sha256', this.config.secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }
}

/**
 * Validate session capabilities
 */
export class CapabilityValidator {
  private readonly requestCounts: Map<string, number> = new Map();

  constructor(private readonly config: IssuerConfig) {}

  /**
   * Validate a capability token
   */
  validate(
    token: CapabilityToken,
    request: { agentId: string; action: IrsbActionType; chainId: number; to: string; value: string }
  ): { valid: boolean; reason?: string; capability?: SessionCapability } {
    try {
      // Decode token
      const json = Buffer.from(token, 'base64url').toString('utf-8');
      const capability = SessionCapabilitySchema.parse(JSON.parse(json));

      // Verify signature
      const { signature, ...unsigned } = capability;
      const expectedSig = this.computeSignature(unsigned);
      if (signature !== expectedSig) {
        return { valid: false, reason: 'Invalid signature' };
      }

      // Check expiry
      if (Date.now() > capability.expiresAt) {
        return { valid: false, reason: 'Capability expired' };
      }

      // Check agent ID
      if (capability.agentId !== request.agentId) {
        return { valid: false, reason: 'Agent ID mismatch' };
      }

      // Check action is allowed
      if (!capability.allowedActions.includes(request.action)) {
        return { valid: false, reason: `Action ${request.action} not allowed` };
      }

      // Check chain is allowed
      if (capability.allowedChains && capability.allowedChains.length > 0) {
        if (!capability.allowedChains.includes(request.chainId)) {
          return { valid: false, reason: `Chain ${request.chainId} not allowed` };
        }
      }

      // Check contract is allowed
      if (capability.allowedContracts && capability.allowedContracts.length > 0) {
        const normalized = capability.allowedContracts.map((c) => c.toLowerCase());
        if (!normalized.includes(request.to.toLowerCase())) {
          return { valid: false, reason: 'Contract not allowed' };
        }
      }

      // Check spend limit
      if (capability.maxSpendPerRequest) {
        const max = BigInt(capability.maxSpendPerRequest);
        const value = BigInt(request.value);
        if (value > max) {
          return { valid: false, reason: 'Spend limit exceeded' };
        }
      }

      // Check request count
      if (capability.maxRequests) {
        const count = this.requestCounts.get(capability.id) ?? 0;
        if (count >= capability.maxRequests) {
          return { valid: false, reason: 'Request limit exceeded' };
        }
      }

      return { valid: true, capability };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, reason: `Invalid token: ${message}` };
    }
  }

  /**
   * Record a request against a capability
   */
  recordRequest(capabilityId: string): void {
    const count = this.requestCounts.get(capabilityId) ?? 0;
    this.requestCounts.set(capabilityId, count + 1);
  }

  /**
   * Compute signature for verification
   */
  private computeSignature(capability: Omit<SessionCapability, 'signature'>): string {
    const payload = JSON.stringify(capability);
    const hmac = createHmac('sha256', this.config.secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Clear request counts (for testing)
   */
  clearRequestCounts(): void {
    this.requestCounts.clear();
  }
}

/**
 * Create default issuer configuration
 */
export function createDefaultIssuerConfig(): IssuerConfig {
  return {
    secret: process.env['CAPABILITY_SECRET'] ?? 'development-secret-change-me',
    defaultTtlMs: 60 * 60 * 1000, // 1 hour
    maxRequestsPerSession: 100,
  };
}
