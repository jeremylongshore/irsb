/**
 * API Routes
 *
 * HTTP endpoints for the signing gateway.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PolicyEngine, createDefaultPolicyConfig } from '../policy/engine.js';
import { createAuditArtifact, hashArtifact } from '../audit/artifact.js';
import {
  SigningRequestSchema,
  type SigningRequest,
  type SigningResponse,
  type SigningError,
} from '../types/signing-request.js';
import { addToContractAllowlist } from '../policy/allowlists.js';

// Initialize policy engine with default config
const policyConfig = createDefaultPolicyConfig();

// Add default IRSB contracts (would come from config in production)
addToContractAllowlist(
  policyConfig.allowlists,
  '0x0000000000000000000000000000000000000000', // Placeholder
  1, // Mainnet
  'IRSB Protocol'
);

const policyEngine = new PolicyEngine(policyConfig);

export async function routes(fastify: FastifyInstance): Promise<void> {
  /**
   * Sign a request
   */
  fastify.post('/v1/sign', async (
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

      // Run policy checks
      const policyResult = await policyEngine.check(signingRequest);

      // Create audit artifact
      const artifact = createAuditArtifact({
        request: signingRequest,
        policyVersion: policyEngine.version,
        checks: policyResult.checks,
        decision: policyResult.decision,
      });

      // Log the decision
      fastify.log.info({
        auditId: artifact.auditId,
        requestId: signingRequest.requestId,
        agentId: signingRequest.agentId,
        action: signingRequest.action.action,
        decision: policyResult.decision,
      }, 'Signing request processed');

      if (policyResult.decision === 'DENY') {
        reply.code(403);
        return {
          requestId: signingRequest.requestId,
          code: 'POLICY_DENIED',
          message: 'Request denied by policy',
          details: {
            checks: policyResult.checks.filter((c) => !c.passed),
          },
          auditId: artifact.auditId,
        };
      }

      // TODO: Actually sign the transaction with KMS
      // For now, return a stub response
      reply.code(501);
      return {
        requestId: signingRequest.requestId,
        code: 'INTERNAL_ERROR',
        message: 'Signing not yet implemented',
        auditId: artifact.auditId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ error }, 'Signing request failed');

      reply.code(500);
      return {
        code: 'INTERNAL_ERROR',
        message,
      };
    }
  });

  /**
   * Get policy configuration (read-only)
   */
  fastify.get('/v1/policy', async (): Promise<{ version: string }> => {
    return {
      version: policyEngine.version,
    };
  });

  /**
   * Get signing address
   */
  fastify.get('/v1/address', async (): Promise<{ address: string }> => {
    // TODO: Get from KMS signer
    return {
      address: '0x0000000000000000000000000000000000000000',
    };
  });
}
