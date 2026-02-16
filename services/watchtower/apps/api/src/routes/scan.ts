import {
  RuleEngine,
  createDefaultRegistry,
  serializeFinding,
  type ChainContext,
} from '@irsb-watchtower/core';
import { IrsbClient } from '@irsb-watchtower/irsb-adapter';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../lib/config.js';

/**
 * Scan request body
 */
interface ScanRequestBody {
  /** Specific rule IDs to run (optional, runs all enabled if not specified) */
  ruleIds?: string[];

  /** Number of blocks to look back (optional) */
  lookbackBlocks?: number;
}

/**
 * Scan response
 */
interface ScanResponse {
  success: boolean;
  findings: unknown[];
  metadata: {
    rulesExecuted: number;
    rulesFailed: number;
    totalDurationMs: number;
    blockNumber: string;
    timestamp: string;
  };
  errors?: Array<{ ruleId: string; error: string }>;
}

/**
 * Create a chain context backed by real on-chain data
 */
function createChainContext(
  client: IrsbClient,
  blockNumber: bigint,
  blockTimestamp: Date,
  chainId: number,
  lookbackBlocks: number,
): ChainContext {
  return {
    currentBlock: blockNumber,
    blockTimestamp,
    chainId,

    async getReceiptsInChallengeWindow() {
      const fromBlock = blockNumber > BigInt(lookbackBlocks)
        ? blockNumber - BigInt(lookbackBlocks)
        : 0n;

      const events = await client.getReceiptPostedEvents(fromBlock, blockNumber);

      return events.map((event) => ({
        id: event.receiptId,
        intentHash: event.intentHash,
        solverId: event.solverId,
        createdAt: new Date(Number(blockTimestamp) - 3600_000),
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending' as const,
        challengeDeadline: new Date(Number(event.challengeDeadline) * 1000),
        blockNumber: event.blockNumber,
        txHash: event.txHash,
      }));
    },

    async getActiveDisputes() {
      const fromBlock = blockNumber > BigInt(lookbackBlocks)
        ? blockNumber - BigInt(lookbackBlocks)
        : 0n;

      const events = await client.getDisputeOpenedEvents(fromBlock, blockNumber);

      return events.map((event) => ({
        id: event.disputeId,
        receiptId: event.receiptId,
        challenger: event.challenger,
        reason: event.reason,
        status: 'open' as const,
        openedAt: blockTimestamp,
        deadline: new Date(blockTimestamp.getTime() + 24 * 60 * 60 * 1000),
        blockNumber: event.blockNumber,
      }));
    },

    async getSolverInfo(solverId: string) {
      const solver = await client.getSolver(solverId as `0x${string}`);
      if (!solver) return null;
      return {
        id: solver.id,
        owner: solver.owner,
        bondAmount: solver.bondAmount,
        status: solver.status,
        reputation: solver.reputation,
        jailCount: solver.jailCount,
        registeredAt: solver.registeredAt,
      };
    },

    async getEvents(fromBlock: bigint, toBlock: bigint) {
      const receipts = await client.getReceiptPostedEvents(fromBlock, toBlock);
      const disputes = await client.getDisputeOpenedEvents(fromBlock, toBlock);
      return [
        ...receipts.map((r) => ({
          name: 'ReceiptPosted',
          blockNumber: r.blockNumber,
          txHash: r.txHash,
          args: { receiptId: r.receiptId, solverId: r.solverId, intentHash: r.intentHash } as Record<string, unknown>,
        })),
        ...disputes.map((d) => ({
          name: 'DisputeOpened',
          blockNumber: d.blockNumber,
          txHash: d.txHash,
          args: { disputeId: d.disputeId, receiptId: d.receiptId, challenger: d.challenger } as Record<string, unknown>,
        })),
      ];
    },
  };
}

/**
 * Register scan routes
 */
export async function scanRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Create rule engine with default rules
  const engine = new RuleEngine(createDefaultRegistry());

  // Create IRSB client for chain queries
  const client = new IrsbClient({
    rpcUrl: config.chain.rpcUrl,
    chainId: config.chain.chainId,
    contracts: config.contracts,
  });

  /**
   * POST /scan
   *
   * Trigger a scan and return findings
   */
  fastify.post<{ Body: ScanRequestBody }>(
    '/scan',
    async (request: FastifyRequest<{ Body: ScanRequestBody }>, reply: FastifyReply) => {
      const { ruleIds, lookbackBlocks } = request.body || {};

      fastify.log.info({ ruleIds }, 'Starting scan');

      try {
        // Get current block from chain
        const blockNumber = await client.getBlockNumber();
        const blockTimestamp = new Date(
          Number(await client.getBlockTimestamp(blockNumber)) * 1000
        );

        // Create chain context with real data
        const context = createChainContext(
          client,
          blockNumber,
          blockTimestamp,
          config.chain.chainId,
          lookbackBlocks ?? config.worker.lookbackBlocks,
        );

        // Execute rules
        const result = await engine.execute(context, { ruleIds });

        // Collect any errors
        const errors = result.ruleResults
          .filter((r) => r.error)
          .map((r) => ({
            ruleId: r.ruleId,
            error: r.error!.message,
          }));

        const response: ScanResponse = {
          success: result.rulesFailed === 0,
          findings: result.findings.map(serializeFinding),
          metadata: {
            rulesExecuted: result.rulesExecuted,
            rulesFailed: result.rulesFailed,
            totalDurationMs: result.totalDurationMs,
            blockNumber: blockNumber.toString(),
            timestamp: new Date().toISOString(),
          },
          ...(errors.length > 0 && { errors }),
        };

        fastify.log.info(
          {
            findingsCount: result.findings.length,
            rulesExecuted: result.rulesExecuted,
            durationMs: result.totalDurationMs,
          },
          'Scan completed'
        );

        return reply.send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Scan failed');
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /scan/rules
   *
   * List available rules
   */
  fastify.get('/scan/rules', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = engine.getRegistry().getAll().map((rule) => ({
      id: rule.metadata.id,
      name: rule.metadata.name,
      description: rule.metadata.description,
      severity: rule.metadata.defaultSeverity,
      category: rule.metadata.category,
      enabledByDefault: rule.metadata.enabledByDefault,
      version: rule.metadata.version,
    }));

    return reply.send({ rules });
  });
}
