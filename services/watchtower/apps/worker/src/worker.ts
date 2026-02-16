import { createServer, type Server } from 'node:http';
import { parseAllowlist, getEffectiveChains, type ChainEntry } from '@irsb-watchtower/config';
import {
  RuleEngine,
  RuleRegistry,
  createReceiptStaleRule,
  serializeFinding,
  type ChainContext,
  type Finding,
  ActionLedger,
  BlockCursor,
  ActionExecutor,
  ActionType,
} from '@irsb-watchtower/core';
import {
  createEvidenceStore,
  type EvidenceStore,
  type FindingRecord,
  type ActionResultRecord,
} from '@irsb-watchtower/evidence-store';
import { IrsbClient, DisputeReason } from '@irsb-watchtower/irsb-adapter';
import { metrics, registry as metricsRegistry } from '@irsb-watchtower/metrics';
import { createWebhookSink, type WebhookSink } from '@irsb-watchtower/webhook';
import { getConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';

/**
 * Create a chain context for rule evaluation using the IRSB client.
 * Queries real on-chain data via the IrsbClient.
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
        createdAt: new Date(Number(blockTimestamp) - 3600_000), // Approximate
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
 * Post findings to API (if configured)
 */
async function postFindingsToApi(
  findings: Finding[],
  apiUrl: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings: findings.map(serializeFinding) }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Failed to post findings to API');
    } else {
      logger.debug({ count: findings.length }, 'Posted findings to API');
    }
  } catch (error) {
    logger.warn({ error }, 'Error posting findings to API');
  }
}

/**
 * Context object for scan cycle - encapsulates all per-chain components
 */
interface ScanContext {
  engine: RuleEngine;
  client: IrsbClient;
  cursor: BlockCursor;
  executor: ActionExecutor;
  logger: ReturnType<typeof createLogger>;
  config: ReturnType<typeof getConfig>;
  webhookSink?: WebhookSink;
  evidenceStore?: EvidenceStore;
}

/**
 * Convert a Finding to a FindingRecord for storage
 */
function findingToRecord(finding: Finding, chainId: number): FindingRecord {
  return {
    id: finding.id,
    ruleId: finding.ruleId,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    category: finding.category,
    timestamp: finding.timestamp.toISOString(),
    blockNumber: finding.blockNumber.toString(),
    chainId,
    txHash: finding.txHash,
    contractAddress: finding.contractAddress,
    solverId: finding.solverId,
    receiptId: finding.receiptId,
    recommendedAction: finding.recommendedAction,
    metadata: finding.metadata as Record<string, unknown>,
    actedUpon: finding.actedUpon,
    actionTxHash: finding.actionTxHash,
  };
}

/**
 * Run a single scan cycle
 */
async function runScanCycle(ctx: ScanContext): Promise<Finding[]> {
  const { engine, client, cursor, executor, logger, config, webhookSink, evidenceStore } = ctx;
  const chainId = config.chain.chainId;
  const scanStartTime = Date.now();

  // Track active scan
  metrics.scanStarted(chainId);
  metrics.recordTick(chainId);

  try {
    // Get current block and its timestamp from the chain
    const currentBlock = await client.getBlockNumber();
    const blockTimestamp = new Date(Number(await client.getBlockTimestamp(currentBlock)) * 1000);

    // Update last block metric
    metrics.setLastBlock(chainId, currentBlock);

    // Get start block for scan
    const startBlock = cursor.getStartBlock(
      currentBlock,
      config.worker.lookbackBlocks,
      config.rules.blockConfirmations
    );

    logger.info(
      {
        currentBlock: currentBlock.toString(),
        startBlock: startBlock.toString(),
        endBlock: currentBlock.toString(),
      },
      'Starting scan cycle'
    );

    // Create chain context with real on-chain data
    const context = createChainContext(client, currentBlock, blockTimestamp, chainId, config.worker.lookbackBlocks);

    // Execute rules
    const result = await engine.execute(context);

    // Log results and record metrics for findings
    if (result.findings.length > 0) {
      logger.info(
        {
          findingsCount: result.findings.length,
          rulesExecuted: result.rulesExecuted,
          durationMs: result.totalDurationMs,
        },
        'Scan cycle completed with findings'
      );

      // Log each finding and record metrics
      for (const finding of result.findings) {
        logger.warn(
          {
            ruleId: finding.ruleId,
            severity: finding.severity,
            category: finding.category,
            title: finding.title,
            receiptId: finding.receiptId,
            recommendedAction: finding.recommendedAction,
          },
          'Finding detected'
        );

        // Record alert metric
        metrics.recordAlert(finding.ruleId, finding.severity, chainId);

        // Store finding in evidence store if enabled
        if (evidenceStore) {
          const writeResult = evidenceStore.writeFinding(findingToRecord(finding, chainId));
          if (!writeResult.success) {
            logger.warn({ error: writeResult.error, findingId: finding.id }, 'Failed to store finding');
          }
        }
      }

      // Send findings to webhook if configured
      if (webhookSink) {
        const serializedFindings = result.findings.map(serializeFinding);
        const webhookResult = await webhookSink.sendFindings(serializedFindings);
        if (webhookResult.success) {
          logger.debug({ attempts: webhookResult.attempts }, 'Findings sent to webhook');
        } else {
          logger.warn({ error: webhookResult.error, attempts: webhookResult.attempts }, 'Failed to send findings to webhook');
        }
      }

      // Execute actions for findings
      const actionResults = await executor.executeActions(result.findings);

      for (const actionResult of actionResults) {
        // Create action record for evidence store
        const actionRecord: ActionResultRecord = {
          id: `action-${actionResult.finding.id}-${Date.now()}`,
          findingId: actionResult.finding.id,
          receiptId: actionResult.finding.receiptId ?? '',
          actionType: actionResult.finding.recommendedAction,
          success: actionResult.success,
          dryRun: actionResult.dryRun ?? false,
          txHash: actionResult.txHash,
          error: actionResult.error,
          timestamp: new Date().toISOString(),
          chainId,
        };

        if (actionResult.success) {
          if (actionResult.dryRun) {
            logger.info(
              { receiptId: actionResult.finding.receiptId, action: actionResult.finding.recommendedAction },
              '[DRY RUN] Would execute action'
            );
            metrics.recordAction(
              actionResult.finding.recommendedAction,
              'dry_run',
              chainId
            );
          } else {
            logger.info(
              { receiptId: actionResult.finding.receiptId, txHash: actionResult.txHash },
              'Action executed successfully'
            );
            metrics.recordAction(
              actionResult.finding.recommendedAction,
              'success',
              chainId
            );

            // Send action result to webhook if configured
            if (webhookSink) {
              const actionWebhookResult = await webhookSink.sendActionResult({
                receiptId: actionResult.finding.receiptId,
                action: actionResult.finding.recommendedAction,
                txHash: actionResult.txHash,
                chainId,
              });
              if (!actionWebhookResult.success) {
                logger.warn({ error: actionWebhookResult.error }, 'Failed to send action result to webhook');
              }
            }
          }
        } else {
          logger.error(
            { receiptId: actionResult.finding.receiptId, error: actionResult.error },
            'Action execution failed'
          );
          metrics.recordAction(
            actionResult.finding.recommendedAction,
            'failure',
            chainId
          );
        }

        // Store action result in evidence store if enabled
        if (evidenceStore) {
          const writeResult = evidenceStore.writeActionResult(actionRecord);
          if (!writeResult.success) {
            logger.warn({ error: writeResult.error, actionId: actionRecord.id }, 'Failed to store action result');
          }
        }
      }
    } else {
      logger.debug(
        {
          rulesExecuted: result.rulesExecuted,
          durationMs: result.totalDurationMs,
        },
        'Scan cycle completed - no findings'
      );
    }

    // Log any rule errors and record metrics
    for (const ruleResult of result.ruleResults) {
      if (ruleResult.error) {
        logger.error(
          {
            ruleId: ruleResult.ruleId,
            error: ruleResult.error.message,
          },
          'Rule execution error'
        );
        metrics.recordError('rule_execution', chainId);
      }
    }

    // Update cursor
    cursor.update(currentBlock);

    // Post to API if configured
    if (config.worker.postToApi && config.worker.apiUrl) {
      await postFindingsToApi(result.findings, config.worker.apiUrl, logger);
    }

    return result.findings;
  } catch (error) {
    // Record error metric
    metrics.recordError('scan_cycle', chainId);
    throw error;
  } finally {
    // Always mark scan as completed and record duration
    metrics.scanCompleted(chainId);
    metrics.recordScanDuration(chainId, Date.now() - scanStartTime);
  }
}

/**
 * Create and start a chain watcher
 * Returns cleanup function and interval ID
 */
function createChainWatcher(
  chainEntry: ChainEntry,
  config: ReturnType<typeof getConfig>,
  logger: ReturnType<typeof createLogger>,
  webhookSink: WebhookSink | undefined,
  evidenceStore: EvidenceStore | undefined,
  startTime: number
): { intervalId: NodeJS.Timeout; heartbeatIntervalId?: NodeJS.Timeout; runScan: () => Promise<Finding[]> } {
  const chainLogger = logger.child({ chain: chainEntry.name, chainId: chainEntry.chainId });

  // Initialize state management for this chain (chain-specific ledger file)
  const ledger = new ActionLedger(config.rules.stateDir, chainEntry.chainId);
  const cursor = new BlockCursor(config.rules.stateDir, chainEntry.chainId);

  chainLogger.info(
    {
      stateDir: config.rules.stateDir,
      ledgerSize: ledger.size,
      lastProcessedBlock: cursor.getLastProcessedBlock()?.toString() ?? 'none',
    },
    'State management initialized for chain'
  );

  // Create IRSB client for this chain
  const client = new IrsbClient({
    rpcUrl: chainEntry.rpcUrl,
    chainId: chainEntry.chainId,
    contracts: chainEntry.contracts,
  });

  // Create action executor for this chain
  const executor = new ActionExecutor({
    dryRun: config.rules.dryRun,
    maxActionsPerBatch: config.rules.maxActionsPerScan,
    ledger,
  });

  // Set up logger for executor
  executor.setLogger((message: string, level: 'info' | 'warn' | 'error') => {
    chainLogger[level]({ component: 'ActionExecutor' }, message);
  });

  // Register action handlers - uses real IRSB client when signer is available
  executor.registerHandler('OPEN_DISPUTE' as ActionType, async (finding: Finding) => {
    chainLogger.info({ receiptId: finding.receiptId }, 'Opening dispute via IRSB client');

    if (!finding.receiptId) {
      throw new Error('Cannot open dispute: no receiptId in finding');
    }

    // Check if signer is configured
    if (!config.signer) {
      throw new Error('Cannot open dispute: no signer configured (set SIGNER_TYPE)');
    }

    // Build signer and set wallet client on the IRSB client
    const { buildSigner } = await import('./lib/signer.js');
    const signer = await buildSigner(config.signer, chainEntry.rpcUrl);
    const account = await signer.getAccount();
    client.setWalletClient(account, chainEntry.rpcUrl);

    // Compute evidence hash from finding metadata
    const evidenceHash = finding.metadata?.evidenceHash as `0x${string}`
      ?? '0x0000000000000000000000000000000000000000000000000000000000000000';

    const txHash = await client.openDispute({
      receiptId: finding.receiptId as `0x${string}`,
      reason: (finding.metadata?.disputeReason as DisputeReason) ?? DisputeReason.TIMEOUT,
      evidenceHash,
      bondAmount: await client.getMinimumBond(),
    });

    return { txHash };
  });

  // Create rule registry with receipt stale rule
  const registry = new RuleRegistry();

  const receiptStaleRule = createReceiptStaleRule({
    challengeWindowSeconds: config.rules.challengeWindowSeconds,
    minReceiptAgeSeconds: config.rules.minReceiptAgeSeconds,
    allowlistSolverIds: parseAllowlist(config.rules.allowlistSolverIds),
    allowlistReceiptIds: parseAllowlist(config.rules.allowlistReceiptIds),
    blockConfirmations: config.rules.blockConfirmations,
  });
  registry.register(receiptStaleRule);

  // Create rule engine
  const engine = new RuleEngine(registry);

  // Create chain-specific config with this chain's details
  const chainConfig = {
    ...config,
    chain: {
      rpcUrl: chainEntry.rpcUrl,
      chainId: chainEntry.chainId,
    },
    contracts: chainEntry.contracts,
  };

  // Create scan context for this chain
  const scanContext: ScanContext = {
    engine,
    client,
    cursor,
    executor,
    logger: chainLogger,
    config: chainConfig,
    webhookSink,
    evidenceStore,
  };

  // Scan function for this chain
  const runScan = async () => {
    return runScanCycle(scanContext);
  };

  // Start interval loop for this chain
  const intervalId = setInterval(async () => {
    try {
      await runScan();
    } catch (error) {
      chainLogger.error({ error }, 'Scan cycle failed');
    }
  }, config.worker.scanIntervalMs);

  // Set up heartbeat for this chain if enabled
  let heartbeatIntervalId: NodeJS.Timeout | undefined;
  if (webhookSink && config.webhook.sendHeartbeat) {
    heartbeatIntervalId = setInterval(async () => {
      const lastBlock = cursor.getLastProcessedBlock();
      const result = await webhookSink.sendHeartbeat({
        chainId: chainEntry.chainId,
        lastBlock: lastBlock?.toString() ?? '0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
      });
      if (!result.success) {
        chainLogger.warn({ error: result.error }, 'Failed to send heartbeat');
      }
    }, config.webhook.heartbeatIntervalMs);
  }

  return { intervalId, heartbeatIntervalId, runScan };
}

/**
 * Main worker loop
 */
async function main() {
  const config = getConfig();
  const logger = createLogger(config.logging.level, config.logging.format);

  // Get effective chains (multi-chain or single-chain mode)
  const chains = getEffectiveChains(config);

  logger.info(
    {
      scanIntervalMs: config.worker.scanIntervalMs,
      chainCount: chains.length,
      chains: chains.map(c => ({ name: c.name, chainId: c.chainId })),
      postToApi: config.worker.postToApi,
      dryRun: config.rules.dryRun,
      maxActionsPerScan: config.rules.maxActionsPerScan,
    },
    'IRSB Watchtower Worker starting'
  );

  // Create evidence store if enabled (shared across all chains)
  let evidenceStore: EvidenceStore | undefined;
  if (config.evidence.enabled) {
    evidenceStore = createEvidenceStore({
      dataDir: config.evidence.dataDir,
      maxFileSizeBytes: config.evidence.maxFileSizeBytes,
      validateOnWrite: config.evidence.validateOnWrite,
    });
    logger.info({ dataDir: config.evidence.dataDir }, 'Evidence store initialized');
  }

  // Create webhook sink if enabled (shared across all chains)
  let webhookSink: WebhookSink | undefined;
  const startTime = Date.now();

  if (config.webhook.enabled && config.webhook.url && config.webhook.secret) {
    webhookSink = createWebhookSink({
      url: config.webhook.url,
      secret: config.webhook.secret,
      timeoutMs: config.webhook.timeoutMs,
      maxRetries: config.webhook.maxRetries,
      retryDelayMs: config.webhook.retryDelayMs,
    });
    logger.info({ url: config.webhook.url }, 'Webhook sink configured');
  }

  // Start metrics HTTP server on port 9090
  const metricsPort = 9090;
  const metricsServer: Server = createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      try {
        const metricsOutput = await metricsRegistry.metrics();
        res.writeHead(200, { 'Content-Type': metricsRegistry.contentType });
        res.end(metricsOutput);
      } catch (error) {
        res.writeHead(500);
        res.end('Error generating metrics');
      }
    } else if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', chains: chains.length }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  metricsServer.listen(metricsPort, () => {
    logger.info({ port: metricsPort }, 'Worker metrics server started');
  });

  // Create watchers for each chain
  const watchers: Array<ReturnType<typeof createChainWatcher>> = [];

  for (const chainEntry of chains) {
    logger.info(
      { chain: chainEntry.name, chainId: chainEntry.chainId, rpcUrl: chainEntry.rpcUrl.replace(/\/\/.*@/, '//***@') },
      'Starting chain watcher'
    );

    const watcher = createChainWatcher(
      chainEntry,
      config,
      logger,
      webhookSink,
      evidenceStore,
      startTime
    );
    watchers.push(watcher);
  }

  // Run initial scans for all chains concurrently
  logger.info({ chainCount: chains.length }, 'Running initial scans');
  await Promise.all(watchers.map(w => w.runScan().catch(err => {
    logger.error({ error: err }, 'Initial scan failed');
  })));

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down worker');

    // Clear all intervals
    for (const watcher of watchers) {
      clearInterval(watcher.intervalId);
      if (watcher.heartbeatIntervalId) {
        clearInterval(watcher.heartbeatIntervalId);
      }
    }

    metricsServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info({ chainCount: chains.length }, 'Worker running. Press Ctrl+C to stop.');
}

// Run if this is the main module
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runScanCycle, createChainContext };
