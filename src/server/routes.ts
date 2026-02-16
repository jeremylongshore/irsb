/**
 * API Routes
 *
 * HTTP endpoints for the signing gateway.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  SigningRequestSchema,
  type SigningResponse,
  type SigningError,
} from '../types/signing-request.js';
import { SigningService, createServiceFromEnv } from './service.js';

// Lazy-initialize service to ensure env vars are loaded
let _service: SigningService | null = null;

function getService(): SigningService {
  if (!_service) {
    _service = createServiceFromEnv();
  }
  return _service;
}

export async function routes(fastify: FastifyInstance): Promise<void> {
  // Initialize service on first request
  const service = getService();
  /**
   * Sign a request
   */
  fastify.post(
    '/v1/sign',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<SigningResponse | SigningError> => {
      try {
        // Parse and validate request
        const parseResult = SigningRequestSchema.safeParse(request.body);

        if (!parseResult.success) {
          reply.code(400);
          return {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
            details: { errors: parseResult.error.errors },
          };
        }

        const signingRequest = parseResult.data;

        // Process signing request
        const outcome = await service.sign(signingRequest);

        if (outcome.success) {
          return outcome.response;
        } else {
          // Map error code to HTTP status
          const statusMap: Record<string, number> = {
            INVALID_REQUEST: 400,
            UNAUTHORIZED: 401,
            POLICY_DENIED: 403,
            EXPIRED: 400,
            DUPLICATE: 409,
            RATE_LIMITED: 429,
            INTERNAL_ERROR: 500,
          };

          reply.code(statusMap[outcome.error.code] ?? 500);
          return outcome.error;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Signing request failed');

        reply.code(500);
        return {
          code: 'INTERNAL_ERROR',
          message,
        };
      }
    }
  );

  /**
   * Get policy configuration (read-only)
   */
  fastify.get('/v1/policy', async (): Promise<{ version: string }> => {
    return {
      version: service.getPolicyVersion(),
    };
  });

  /**
   * Get signing address and backend info
   */
  fastify.get(
    '/v1/address',
    async (): Promise<{
      address: string | null;
      enabled: boolean;
      backend: string;
    }> => {
      const address = await service.getAddress();
      return {
        address,
        enabled: service.isSigningEnabled(),
        backend: service.getSignerType(),
      };
    }
  );
}
