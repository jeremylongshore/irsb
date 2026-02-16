import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IrsbClient, DisputeReason } from '@irsb-watchtower/irsb-adapter';
import type { Signer } from '@irsb-watchtower/signers';
import { getConfig } from '../lib/config.js';

/**
 * Open dispute request body
 */
interface OpenDisputeRequest {
  /** Receipt ID to dispute */
  receiptId: string;

  /** Reason for dispute */
  reason: string;

  /** Evidence hash (IPFS CID, etc) */
  evidenceHash: string;

  /** Bond amount in wei */
  bondAmount: string;
}

/**
 * Submit evidence request body
 */
interface SubmitEvidenceRequest {
  /** Dispute ID */
  disputeId: string;

  /** Evidence hash */
  evidenceHash: string;

  /** Optional description */
  description?: string;
}

/**
 * Action response
 */
interface ActionResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  message?: string;
}

/** Cached signer instance */
let cachedSigner: Signer | null = null;

/**
 * Build signer on demand
 */
async function getSigner(config: ReturnType<typeof getConfig>): Promise<Signer> {
  if (cachedSigner) return cachedSigner;

  if (!config.signer) {
    throw new Error('No signer configured. Set SIGNER_TYPE environment variable.');
  }

  const { buildSigner } = await import('../lib/signer.js');
  cachedSigner = await buildSigner(config.signer, config.chain.rpcUrl);
  return cachedSigner;
}

/**
 * Register action routes
 *
 * These routes are disabled by default (ENABLE_ACTIONS=false)
 * They allow the watchtower to take on-chain actions like opening disputes
 */
export async function actionRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  /**
   * Middleware to check if actions are enabled
   */
  const checkActionsEnabled = async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!config.api.enableActions) {
      return reply.status(403).send({
        success: false,
        error: 'Actions are disabled',
        message: 'Set ENABLE_ACTIONS=true to enable on-chain actions',
      });
    }
  };

  /**
   * POST /actions/open-dispute
   *
   * Open a dispute against a receipt
   */
  fastify.post<{ Body: OpenDisputeRequest }>(
    '/actions/open-dispute',
    { preHandler: [checkActionsEnabled] },
    async (request: FastifyRequest<{ Body: OpenDisputeRequest }>, reply: FastifyReply) => {
      const { receiptId, reason, evidenceHash, bondAmount } = request.body;

      fastify.log.info({ receiptId, reason }, 'Opening dispute');

      try {
        // Build signer and IRSB client
        const signer = await getSigner(config);
        const account = await signer.getAccount();

        const client = new IrsbClient({
          rpcUrl: config.chain.rpcUrl,
          chainId: config.chain.chainId,
          contracts: config.contracts,
        });

        // Validate receipt exists
        const receipt = await client.getReceipt(receiptId as `0x${string}`);
        if (!receipt) {
          return reply.status(404).send({
            success: false,
            error: `Receipt ${receiptId} not found on-chain`,
          } satisfies ActionResponse);
        }

        // Set up wallet client for write operations
        client.setWalletClient(account, config.chain.rpcUrl);

        // Open dispute
        const txHash = await client.openDispute({
          receiptId: receiptId as `0x${string}`,
          reason: reason as DisputeReason,
          evidenceHash: evidenceHash as `0x${string}`,
          bondAmount: BigInt(bondAmount),
        });

        const response: ActionResponse = {
          success: true,
          txHash,
          message: `Dispute opened for receipt ${receiptId}`,
        };

        return reply.send(response);
      } catch (error) {
        fastify.log.error({ error, receiptId }, 'Failed to open dispute');

        const response: ActionResponse = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };

        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /actions/submit-evidence
   *
   * Submit additional evidence for an existing dispute
   */
  fastify.post<{ Body: SubmitEvidenceRequest }>(
    '/actions/submit-evidence',
    { preHandler: [checkActionsEnabled] },
    async (request: FastifyRequest<{ Body: SubmitEvidenceRequest }>, reply: FastifyReply) => {
      const { disputeId, evidenceHash, description } = request.body;

      fastify.log.info({ disputeId, evidenceHash }, 'Submitting evidence');

      try {
        const signer = await getSigner(config);
        const account = await signer.getAccount();

        const client = new IrsbClient({
          rpcUrl: config.chain.rpcUrl,
          chainId: config.chain.chainId,
          contracts: config.contracts,
        });

        // Validate dispute exists
        const dispute = await client.getDispute(disputeId as `0x${string}`);
        if (!dispute) {
          return reply.status(404).send({
            success: false,
            error: `Dispute ${disputeId} not found on-chain`,
          } satisfies ActionResponse);
        }

        client.setWalletClient(account, config.chain.rpcUrl);

        const txHash = await client.submitEvidence({
          disputeId: disputeId as `0x${string}`,
          evidenceHash: evidenceHash as `0x${string}`,
          description,
        });

        const response: ActionResponse = {
          success: true,
          txHash,
          message: `Evidence submitted for dispute ${disputeId}`,
        };

        return reply.send(response);
      } catch (error) {
        fastify.log.error({ error, disputeId }, 'Failed to submit evidence');

        const response: ActionResponse = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };

        return reply.status(500).send(response);
      }
    }
  );

  /**
   * GET /actions/status
   *
   * Check if actions are enabled and signer is healthy
   */
  fastify.get('/actions/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    let signerHealthy = false;

    if (config.signer && config.api.enableActions) {
      try {
        const signer = await getSigner(config);
        signerHealthy = await signer.isHealthy();
      } catch {
        // Signer not available
      }
    }

    const status = {
      enabled: config.api.enableActions,
      signerConfigured: !!config.signer,
      signerType: config.signer?.type ?? null,
      signerHealthy,
    };

    return reply.send(status);
  });
}
