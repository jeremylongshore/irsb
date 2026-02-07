/**
 * Signing Request Schema
 *
 * Full request schema for the signing gateway. All requests must be typed
 * IRSB actions - no arbitrary digest signing.
 */

import { z } from 'zod';
import { IrsbActionSchema } from './actions.js';

/**
 * Agent role determines allowed actions
 */
export const AgentRoleSchema = z.enum(['SOLVER', 'WATCHTOWER']);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

/**
 * Chain ID must be a known supported chain
 */
export const ChainIdSchema = z.number().int().positive();

/**
 * Ethereum address format
 */
export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be 20-byte hex address');

/**
 * Full signing request
 */
export const SigningRequestSchema = z.object({
  /**
   * Unique request ID for idempotency
   */
  requestId: z.string().uuid(),

  /**
   * Agent identity (from L1 transport auth)
   */
  agentId: z.string().min(1),

  /**
   * Agent role (determines allowed actions)
   */
  role: AgentRoleSchema,

  /**
   * Target chain ID
   */
  chainId: ChainIdSchema,

  /**
   * Target contract address (must be in allowlist)
   */
  to: AddressSchema,

  /**
   * The typed IRSB action to execute
   */
  action: IrsbActionSchema,

  /**
   * Value in wei (usually 0 for IRSB actions)
   */
  value: z
    .string()
    .regex(/^[0-9]+$/, 'Must be numeric string')
    .default('0'),

  /**
   * Request expiry timestamp (unix ms)
   */
  expiresAt: z.number().int().positive(),

  /**
   * Optional session capability token
   */
  capabilityToken: z.string().optional(),
});

export type SigningRequest = z.infer<typeof SigningRequestSchema>;

/**
 * Successful signing response
 */
export const SigningResponseSchema = z.object({
  /**
   * Original request ID
   */
  requestId: z.string().uuid(),

  /**
   * Signed transaction (hex-encoded)
   */
  signedTx: z.string().regex(/^0x[a-fA-F0-9]+$/),

  /**
   * Transaction hash
   */
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),

  /**
   * Audit artifact ID
   */
  auditId: z.string().uuid(),

  /**
   * Signing timestamp
   */
  signedAt: z.number().int().positive(),
});

export type SigningResponse = z.infer<typeof SigningResponseSchema>;

/**
 * Error codes for signing failures
 */
export const SigningErrorCodeSchema = z.enum([
  'INVALID_REQUEST', // Request schema validation failed
  'UNAUTHORIZED', // Agent not authorized for action
  'POLICY_DENIED', // Policy check failed
  'EXPIRED', // Request expired
  'DUPLICATE', // Idempotency key already used
  'RATE_LIMITED', // Velocity limit exceeded
  'INTERNAL_ERROR', // Unexpected error
]);

export type SigningErrorCode = z.infer<typeof SigningErrorCodeSchema>;

/**
 * Signing error response
 */
export const SigningErrorSchema = z.object({
  requestId: z.string().uuid().optional(),
  code: SigningErrorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  auditId: z.string().uuid().optional(),
});

export type SigningError = z.infer<typeof SigningErrorSchema>;

/**
 * Parse and validate a signing request
 */
export function parseSigningRequest(value: unknown): SigningRequest {
  return SigningRequestSchema.parse(value);
}

/**
 * Type guard for signing request
 */
export function isSigningRequest(value: unknown): value is SigningRequest {
  return SigningRequestSchema.safeParse(value).success;
}
