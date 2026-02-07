/**
 * Authentication Middleware
 *
 * Validates incoming requests using JWT or workload identity.
 */

import type { FastifyRequest } from 'fastify';
import pino from 'pino';

const logger = pino({ name: 'auth' });

/**
 * Authenticated agent info
 */
export interface AuthenticatedAgent {
  agentId: string;
  role: 'SOLVER' | 'WATCHTOWER';
  subject: string;
  issuer: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /**
   * JWT audience (for validation)
   */
  audience: string;

  /**
   * Allowed JWT issuers
   */
  allowedIssuers: string[];

  /**
   * Skip authentication (development only)
   */
  skipAuth: boolean;
}

/**
 * Authenticate a request
 */
export async function authenticate(
  request: FastifyRequest,
  config: AuthConfig
): Promise<AuthenticatedAgent | null> {
  // Skip auth in development
  if (config.skipAuth) {
    logger.warn('Authentication skipped (development mode)');
    return {
      agentId: 'dev-agent',
      role: 'SOLVER',
      subject: 'dev',
      issuer: 'local',
    };
  }

  // Get authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logger.debug('Missing or invalid authorization header');
    return null;
  }

  const token = authHeader.slice(7);

  try {
    // TODO: Implement proper JWT validation
    // For now, just decode and return stub
    const payload = decodeJwtPayload(token);

    if (!payload) {
      return null;
    }

    // Validate issuer
    const issuer = payload['iss'] as string | undefined;
    if (!config.allowedIssuers.includes(issuer ?? '')) {
      logger.warn({ issuer }, 'JWT issuer not allowed');
      return null;
    }

    // Validate audience
    const aud = payload['aud'] as string | string[] | undefined;
    const audiences = Array.isArray(aud) ? aud : [aud];
    if (!audiences.includes(config.audience)) {
      logger.warn({ audience: aud }, 'JWT audience mismatch');
      return null;
    }

    // Validate expiry
    const now = Math.floor(Date.now() / 1000);
    const exp = payload['exp'] as number | undefined;
    if (exp !== undefined && exp < now) {
      logger.debug('JWT expired');
      return null;
    }

    // Extract agent info
    const sub = payload['sub'] as string | undefined;
    const agentId = sub ?? '';
    const role = extractRole(payload);

    return {
      agentId,
      role,
      subject: sub ?? '',
      issuer: issuer ?? '',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn({ error: message }, 'JWT validation failed');
    return null;
  }
}

/**
 * Decode JWT payload (no verification - for development only)
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }

    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract role from JWT claims
 */
function extractRole(payload: Record<string, unknown>): 'SOLVER' | 'WATCHTOWER' {
  // Check custom claims
  const role = payload['role'] ?? payload['irsb:role'];

  if (role === 'SOLVER' || role === 'solver') {
    return 'SOLVER';
  }

  if (role === 'WATCHTOWER' || role === 'watchtower') {
    return 'WATCHTOWER';
  }

  // Default to SOLVER
  return 'SOLVER';
}

/**
 * Create default auth configuration
 */
export function createDefaultAuthConfig(): AuthConfig {
  return {
    audience: process.env['AUTH_AUDIENCE'] ?? 'irsb-agent-passkey',
    allowedIssuers: (process.env['AUTH_ISSUERS'] ?? '').split(',').filter(Boolean),
    skipAuth: process.env['AUTH_SKIP'] === 'true',
  };
}
