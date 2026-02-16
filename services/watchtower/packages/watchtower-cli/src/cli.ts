#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  initDb,
  initDbWithInlineMigrations,
  upsertAgent,
  getAgent,
  insertSnapshot,
  getLatestSnapshots,
  scoreAgent,
  insertRiskReport,
  insertAlerts,
  getLatestRiskReport,
  listAlerts,
  AgentStatusEnum,
  SignalSchema,
  canonicalJson,
  sha256Hex,
  ingestReceipt,
  verifyEvidence,
  SolverReceiptV0Schema,
  normalizeReceipt,
  syncIdentityEvents,
  fetchAndScoreIdentities,
  IdentityConfigSchema,
  parseAgentId,
  getLatestIdentitySnapshots,
  ContextConfigSchema,
  syncAndScoreContext,
  parseTagFile,
  generateKeyPair,
  saveKeyPair,
  loadKeyPair,
  keyFileExists,
  ensureKeyPair,
  verifyReportSignature,
  createLeaf,
  appendLeaf,
  verifyLogFile,
  logFilePath,
} from '@irsb-watchtower/watchtower-core';
import type { ContextDataSource, AddressTagMap, ReportSignature } from '@irsb-watchtower/watchtower-core';
import { RpcProvider } from '@irsb-watchtower/chain';
import { createIdentityEventSource } from './identityAdapter.js';
import { z } from 'zod';

const program = new Command();

program
  .name('wt')
  .description('IRSB Watchtower CLI — local-first agent monitoring')
  .version('0.3.0');

function openDb(): ReturnType<typeof initDb> {
  const dbPath = process.env['WATCHTOWER_DB_PATH'] ?? './data/watchtower.db';
  return initDbWithInlineMigrations(dbPath);
}

// ── init-db ──────────────────────────────────────────────────────────────
program
  .command('init-db')
  .description('Create or migrate the SQLite database')
  .option('--db-path <path>', 'Database file path')
  .action((options: { dbPath?: string }) => {
    const dbPath = options.dbPath ?? process.env['WATCHTOWER_DB_PATH'] ?? './data/watchtower.db';
    console.log(pc.bold('\nInitializing Watchtower DB\n'));
    const db = initDbWithInlineMigrations(dbPath);
    db.close();
    console.log(`  ${pc.green('✓')} Database ready at ${pc.cyan(dbPath)}`);
    console.log('');
  });

// ── upsert-agent ─────────────────────────────────────────────────────────
program
  .command('upsert-agent')
  .description('Create or update an agent')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--status <status>', 'Agent status (ACTIVE, PROBATION, BLOCKED)', 'ACTIVE')
  .action((options: { agentId: string; labels?: string; status?: string }) => {
    const statusResult = AgentStatusEnum.safeParse(options.status ?? 'ACTIVE');
    if (!statusResult.success) {
      console.error(pc.red(`  Invalid status: '${options.status}'. Must be one of: ${AgentStatusEnum.options.join(', ')}`));
      process.exit(1);
    }

    const db = openDb();
    try {
      upsertAgent(db, {
        agentId: options.agentId,
        labels: options.labels ? options.labels.split(',').map((l) => l.trim()) : undefined,
        status: statusResult.data,
      });
      console.log(`  ${pc.green('✓')} Agent ${pc.cyan(options.agentId)} upserted`);
    } finally {
      db.close();
    }
  });

// ── add-snapshot ─────────────────────────────────────────────────────────
program
  .command('add-snapshot')
  .description('Add a snapshot from a JSON file of signals')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .requiredOption('--signals <path>', 'Path to JSON file with signals array')
  .action((options: { agentId: string; signals: string }) => {
    let raw: string;
    try {
      raw = readFileSync(options.signals, 'utf-8');
    } catch (err) {
      console.error(pc.red(`  Error reading signals file: ${options.signals}`));
      console.error(pc.gray(`  ${(err as Error).message}`));
      process.exit(1);
    }

    const db = openDb();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const signals = z.array(SignalSchema).parse(parsed);

      const observedAt = Math.floor(Date.now() / 1000);

      // Deterministic snapshot ID
      const snapshotPayload = {
        agentId: options.agentId,
        observedAt,
        signals,
      };
      const snapshotId = sha256Hex(canonicalJson(snapshotPayload));

      insertSnapshot(db, {
        snapshotId,
        agentId: options.agentId,
        observedAt,
        signals,
      });

      console.log(`  ${pc.green('✓')} Snapshot ${pc.cyan(snapshotId.slice(0, 16))}... added (${signals.length} signals)`);
    } finally {
      db.close();
    }
  });

// ── score-agent ──────────────────────────────────────────────────────────
program
  .command('score-agent')
  .description('Score an agent and store the report + alerts')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .option('--limit <n>', 'Max snapshots to consider', '20')
  .action((options: { agentId: string; limit: string }) => {
    const db = openDb();
    try {
      const agent = getAgent(db, options.agentId);
      if (!agent) {
        console.log(pc.red(`  Agent ${options.agentId} not found`));
        process.exit(1);
      }

      const snapshots = getLatestSnapshots(db, options.agentId, parseInt(options.limit, 10));
      if (snapshots.length === 0) {
        console.log(pc.yellow(`  No snapshots found for agent ${options.agentId}`));
        process.exit(0);
      }

      const generatedAt = Math.floor(Date.now() / 1000);
      const { report, newAlerts } = scoreAgent(agent, snapshots, generatedAt);

      insertRiskReport(db, report);
      if (newAlerts.length > 0) {
        insertAlerts(db, newAlerts);
      }

      console.log(pc.bold(`\n  Risk Report for ${pc.cyan(options.agentId)}\n`));
      console.log(`  Overall Risk: ${riskColor(report.overallRisk)}`);
      console.log(`  Confidence:   ${pc.white(report.confidence)}`);
      console.log(`  Signals:      ${report.signals.length}`);
      console.log(`  New Alerts:   ${newAlerts.length}`);
      console.log(`  Report ID:    ${pc.gray(report.reportId.slice(0, 16))}...`);
      console.log('');
    } finally {
      db.close();
    }
  });

// ── risk-report ──────────────────────────────────────────────────────────
program
  .command('risk-report')
  .description('Show the latest risk report for an agent')
  .argument('<agentId>', 'Agent identifier')
  .action((agentId: string) => {
    const db = openDb();
    try {
      const report = getLatestRiskReport(db, agentId);
      if (!report) {
        console.log(pc.yellow(`  No risk report found for agent ${agentId}`));
        process.exit(0);
      }

      console.log(pc.bold(`\n  Risk Report: ${pc.cyan(agentId)}\n`));
      console.log(`  Report ID:     ${pc.gray(report.reportId)}`);
      console.log(`  Version:       ${report.reportVersion}`);
      console.log(`  Generated:     ${new Date(report.generatedAt * 1000).toISOString()}`);
      console.log(`  Overall Risk:  ${riskColor(report.overallRisk)}`);
      console.log(`  Confidence:    ${report.confidence}`);
      console.log('');

      if (report.reasons.length > 0) {
        console.log(pc.bold('  Reasons:'));
        for (const reason of report.reasons) {
          console.log(`    - ${reason}`);
        }
        console.log('');
      }

      if (report.signals.length > 0) {
        console.log(pc.bold('  Signals:'));
        for (const sig of report.signals) {
          console.log(`    ${severityColor(sig.severity)} ${pc.gray(sig.signalId)}`);
        }
        console.log('');
      }

      if (report.evidenceLinks.length > 0) {
        console.log(pc.bold('  Evidence:'));
        for (const ev of report.evidenceLinks) {
          console.log(`    [${ev.type}] ${pc.gray(ev.ref)}`);
        }
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── list-alerts ──────────────────────────────────────────────────────────
program
  .command('list-alerts')
  .description('List alerts')
  .option('--agentId <id>', 'Filter by agent')
  .option('--active-only', 'Show only active alerts')
  .action((options: { agentId?: string; activeOnly?: boolean }) => {
    const db = openDb();
    try {
      const alerts = listAlerts(db, {
        agentId: options.agentId,
        activeOnly: options.activeOnly,
      });

      if (alerts.length === 0) {
        console.log(pc.gray('  No alerts found'));
        return;
      }

      console.log(pc.bold(`\n  Alerts (${alerts.length})\n`));
      for (const alert of alerts) {
        const active = alert.isActive ? pc.green('ACTIVE') : pc.gray('RESOLVED');
        console.log(`  ${severityColor(alert.severity)} [${active}] ${alert.type}`);
        console.log(`    Agent: ${pc.cyan(alert.agentId)}`);
        console.log(`    ${pc.gray(alert.description)}`);
        console.log(`    ID: ${pc.gray(alert.alertId.slice(0, 16))}...`);
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── ingest-receipt ───────────────────────────────────────────────────────
program
  .command('ingest-receipt')
  .description('Ingest a solver evidence manifest into the watchtower DB')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .requiredOption('--receipt <path>', 'Path to evidence manifest.json')
  .option('--runDir <dir>', 'Run directory (inferred from receipt path if omitted)')
  .action((options: { agentId: string; receipt: string; runDir?: string }) => {
    const db = openDb();
    try {
      const result = ingestReceipt(db, options.agentId, options.receipt, options.runDir);

      console.log(pc.bold(`\n  Ingest Result for ${pc.cyan(options.agentId)}\n`));
      console.log(`  Receipt ID:   ${pc.gray(result.receiptId.slice(0, 16))}...`);
      console.log(`  Verification: ${result.ok ? pc.green('PASS') : pc.red('FAIL')}`);
      console.log(`  Overall Risk: ${riskColor(result.overallRisk)}`);
      console.log(`  Report ID:    ${pc.gray(result.reportId.slice(0, 16))}...`);
      console.log(`  New Alerts:   ${result.alertCount}`);
      console.log('');
    } catch (err) {
      console.error(pc.red(`  Error: ${(err as Error).message}`));
      process.exit(1);
    } finally {
      db.close();
    }
  });

// ── verify-receipt ──────────────────────────────────────────────────────
program
  .command('verify-receipt')
  .description('Verify a solver evidence manifest (read-only, no DB writes)')
  .requiredOption('--receipt <path>', 'Path to evidence manifest.json')
  .option('--runDir <dir>', 'Run directory (inferred from receipt path if omitted)')
  .action((options: { receipt: string; runDir?: string }) => {
    try {
      const absPath = resolve(options.receipt);
      const rawBytes = readFileSync(absPath);
      const manifestSha256 = sha256Hex(rawBytes);

      // Parse manifest
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBytes.toString('utf-8'));
      } catch {
        console.log(pc.red('  FAIL') + ' — manifest is not valid JSON');
        process.exit(2);
      }

      const schemaResult = SolverReceiptV0Schema.safeParse(parsed);
      if (!schemaResult.success) {
        console.log(pc.red('  FAIL') + ' — manifest schema invalid');
        for (const issue of schemaResult.error.issues) {
          console.log(`    ${pc.gray(issue.path.join('.'))} ${issue.message}`);
        }
        process.exit(2);
      }

      const receipt = normalizeReceipt(schemaResult.data, manifestSha256);

      // Infer runDir
      const dir = dirname(absPath);
      const effectiveRunDir =
        options.runDir ??
        (dir.endsWith('/evidence') || dir.endsWith('\\evidence')
          ? dirname(dir)
          : dir);

      const result = verifyEvidence(receipt, effectiveRunDir);

      if (result.ok) {
        console.log(pc.green('  PASS') + ` — ${result.evidenceLinks.length} evidence links`);
        process.exit(0);
      } else {
        console.log(pc.red('  FAIL') + ` — ${result.failures.length} failure(s)`);
        for (const f of result.failures) {
          console.log(`    ${pc.red(f.code)} ${f.path ? pc.gray(f.path) + ' ' : ''}${f.message}`);
        }
        process.exit(2);
      }
    } catch (err) {
      console.error(pc.red(`  Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ── id:sync ─────────────────────────────────────────────────────────────
const SEPOLIA_REGISTRY = '0x7177a6867296406881E20d6647232314736Dd09A';

program
  .command('id:sync')
  .description('Poll ERC-8004 IdentityRegistry for new agent registrations')
  .option('--rpc-url <url>', 'RPC endpoint', process.env['RPC_URL'])
  .option('--chain-id <id>', 'Chain ID', '11155111')
  .option('--registry <addr>', 'Registry contract address', SEPOLIA_REGISTRY)
  .option('--start-block <n>', 'Start block number', '0')
  .action(async (options: { rpcUrl?: string; chainId: string; registry: string; startBlock: string }) => {
    if (!options.rpcUrl) {
      console.error(pc.red('  --rpc-url or RPC_URL env required'));
      process.exit(1);
    }

    const db = openDb();
    try {
      const provider = new RpcProvider({
        rpcUrl: options.rpcUrl,
        chainId: parseInt(options.chainId, 10),
      });
      const source = createIdentityEventSource(
        provider,
        options.registry as `0x${string}`,
      );
      const config = IdentityConfigSchema.parse({
        chainId: parseInt(options.chainId, 10),
        registryAddress: options.registry,
        startBlock: parseInt(options.startBlock, 10),
      });

      console.log(pc.bold('\n  Identity Sync\n'));
      const result = await syncIdentityEvents(db, source, config);

      if (result.poll.skipped) {
        console.log(`  ${pc.yellow('⏭')} Nothing to poll (chain tip too close)`);
      } else {
        console.log(`  ${pc.green('✓')} Polled blocks ${result.poll.fromBlock}–${result.poll.toBlock}`);
        console.log(`  Events found: ${pc.cyan(String(result.poll.eventsFound))}`);
      }
      console.log('');
    } finally {
      db.close();
    }
  });

// ── id:fetch ────────────────────────────────────────────────────────────
program
  .command('id:fetch')
  .description('Fetch agent cards, derive identity signals, and score agents')
  .option('--chain-id <id>', 'Chain ID', '11155111')
  .option('--registry <addr>', 'Registry contract address', SEPOLIA_REGISTRY)
  .option('--agent-token <id>', 'Process only this token ID')
  .option('--allow-http', 'Allow HTTP (not just HTTPS) for card fetch')
  .action(async (options: { chainId: string; registry: string; agentToken?: string; allowHttp?: boolean }) => {
    const db = openDb();
    try {
      const config = IdentityConfigSchema.parse({
        chainId: parseInt(options.chainId, 10),
        registryAddress: options.registry,
        allowHttp: options.allowHttp ?? false,
      });

      console.log(pc.bold('\n  Identity Fetch & Score\n'));
      const results = await fetchAndScoreIdentities(db, config, {
        agentTokenId: options.agentToken,
        allowHttp: options.allowHttp,
      });

      if (results.length === 0) {
        console.log(pc.yellow('  No agents discovered yet. Run id:sync first.'));
      }

      for (const r of results) {
        console.log(`  ${pc.cyan(r.agentId)}`);
        console.log(`    URI:       ${pc.gray(r.agentUri)}`);
        console.log(`    Fetch:     ${r.fetchStatus === 'OK' ? pc.green(r.fetchStatus) : pc.red(r.fetchStatus)}`);
        console.log(`    Signals:   ${r.signalCount}`);
        console.log(`    Risk:      ${riskColor(r.overallRisk)}`);
        console.log(`    Alerts:    ${r.alertCount}`);
        console.log(`    Report:    ${pc.gray(r.reportId.slice(0, 16))}...`);
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── id:show ─────────────────────────────────────────────────────────────
program
  .command('id:show')
  .description('Show identity details for an agent')
  .argument('<agentId>', 'Agent identifier (erc8004:<chainId>:<registry>:<tokenId>)')
  .action((agentId: string) => {
    const parsed = parseAgentId(agentId);
    if (!parsed) {
      console.error(pc.red(`  Invalid agent ID format: ${agentId}`));
      console.error(pc.gray('  Expected: erc8004:<chainId>:<registryAddress>:<tokenId>'));
      process.exit(1);
    }

    const db = openDb();
    try {
      console.log(pc.bold(`\n  Identity: ${pc.cyan(agentId)}\n`));
      console.log(`  Chain:     ${parsed.chainId}`);
      console.log(`  Registry:  ${parsed.registryAddress}`);
      console.log(`  Token ID:  ${parsed.tokenId}`);
      console.log('');

      // Show identity snapshots
      const idSnapshots = getLatestIdentitySnapshots(db, agentId, 5);
      if (idSnapshots.length > 0) {
        console.log(pc.bold('  Recent Identity Snapshots:'));
        for (const snap of idSnapshots) {
          const time = new Date(snap.fetched_at * 1000).toISOString();
          const status = snap.fetch_status === 'OK' ? pc.green(snap.fetch_status) : pc.red(snap.fetch_status);
          console.log(`    ${pc.gray(time)} ${status} ${snap.card_hash ? pc.gray(snap.card_hash.slice(0, 16)) + '...' : ''}`);
          if (snap.error_message) {
            console.log(`      ${pc.yellow(snap.error_message)}`);
          }
        }
        console.log('');
      }

      // Show latest risk report
      const report = getLatestRiskReport(db, agentId);
      if (report) {
        console.log(pc.bold('  Latest Risk Report:'));
        console.log(`    Risk:       ${riskColor(report.overallRisk)}`);
        console.log(`    Confidence: ${report.confidence}`);
        console.log(`    Generated:  ${new Date(report.generatedAt * 1000).toISOString()}`);
        console.log(`    Report ID:  ${pc.gray(report.reportId.slice(0, 16))}...`);

        if (report.signals.length > 0) {
          console.log('    Signals:');
          for (const sig of report.signals) {
            console.log(`      ${severityColor(sig.severity)} ${pc.gray(sig.signalId)}`);
          }
        }
        console.log('');
      } else {
        console.log(pc.gray('  No risk report found. Run id:fetch first.'));
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── cx:sync ────────────────────────────────────────────────────────────
program
  .command('cx:sync')
  .description('Analyze on-chain context for an agent and derive context signals')
  .requiredOption('--agentId <id>', 'Agent identifier (e.g. erc8004:<chainId>:<registry>:<tokenId>)')
  .requiredOption('--address <addr>', 'Ethereum address to analyze')
  .option('--rpc-url <url>', 'RPC endpoint', process.env['RPC_URL'])
  .option('--chain-id <id>', 'Chain ID', '11155111')
  .option('--blocks <n>', 'Max blocks to scan', '50000')
  .option('--from-block <n>', 'Override start block')
  .option('--to-block <n>', 'Override end block')
  .option('--allowlist <path>', 'Path to allowlist file (address,tag per line)')
  .option('--denylist <path>', 'Path to denylist file (address,tag per line)')
  .option('--enable-payment-adjacency', 'Enable payment adjacency signals')
  .option('--payment-tokens <addrs>', 'Comma-separated token contract addresses')
  .action(async (options: {
    agentId: string;
    address: string;
    rpcUrl?: string;
    chainId: string;
    blocks: string;
    fromBlock?: string;
    toBlock?: string;
    allowlist?: string;
    denylist?: string;
    enablePaymentAdjacency?: boolean;
    paymentTokens?: string;
  }) => {
    if (!options.rpcUrl) {
      console.error(pc.red('  --rpc-url or RPC_URL env required'));
      process.exit(1);
    }

    const db = openDb();
    try {
      const provider = new RpcProvider({
        rpcUrl: options.rpcUrl,
        chainId: parseInt(options.chainId, 10),
      });

      // Build a ContextDataSource from the RPC provider
      const source: ContextDataSource = {
        async getBlockNumber() {
          return provider.getBlockNumber();
        },
        async getTransactions(_address, fromBlock, toBlock) {
          // Level 1: simplified — real production would use trace APIs or indexer
          const blockNum = await provider.getBlockNumber();
          const safeToBlock = toBlock > blockNum ? blockNum : toBlock;
          if (fromBlock > safeToBlock) return [];
          // Returns empty for now; live RPC tx enumeration requires
          // eth_getBlockByNumber iteration or a dedicated indexer
          return [];
        },
      };

      // Load allowlist/denylist
      let allowlist: AddressTagMap | undefined;
      let denylist: AddressTagMap | undefined;
      if (options.allowlist) {
        const content = readFileSync(resolve(options.allowlist), 'utf-8');
        allowlist = parseTagFile(content, 'CEX');
      }
      if (options.denylist) {
        const content = readFileSync(resolve(options.denylist), 'utf-8');
        denylist = parseTagFile(content, 'MIXER');
      }

      const config = ContextConfigSchema.parse({
        chainId: parseInt(options.chainId, 10),
        maxBlocks: parseInt(options.blocks, 10),
        enablePaymentAdjacency: options.enablePaymentAdjacency ?? false,
        paymentTokenAddresses: options.paymentTokens
          ? options.paymentTokens.split(',').map((s) => s.trim())
          : [],
      });

      console.log(pc.bold('\n  Context Sync\n'));
      const result = await syncAndScoreContext(db, source, config, {
        agentId: options.agentId,
        agentAddress: options.address,
        fromBlock: options.fromBlock ? BigInt(options.fromBlock) : undefined,
        toBlock: options.toBlock ? BigInt(options.toBlock) : undefined,
        allowlist,
        denylist,
      });

      if (result.skipped) {
        console.log(`  ${pc.yellow('⏭')} Nothing to sync (already at chain tip)`);
      } else {
        console.log(`  ${pc.green('✓')} Scanned blocks ${result.fromBlock}–${result.toBlock}`);
        console.log(`  Transactions: ${pc.cyan(String(result.txCount))}`);
        console.log(`  Signals:      ${result.signalCount}`);
        console.log(`  Risk:         ${riskColor(result.overallRisk)}`);
        console.log(`  Alerts:       ${result.alertCount}`);
        console.log(`  Report:       ${pc.gray(result.reportId.slice(0, 16))}...`);
      }
      console.log('');
    } finally {
      db.close();
    }
  });

// ── cx:show ────────────────────────────────────────────────────────────
program
  .command('cx:show')
  .description('Show context analysis details for an agent')
  .argument('<agentId>', 'Agent identifier')
  .action((agentId: string) => {
    const db = openDb();
    try {
      const agent = getAgent(db, agentId);
      if (!agent) {
        console.error(pc.red(`  Agent ${agentId} not found`));
        process.exit(1);
      }

      console.log(pc.bold(`\n  Context: ${pc.cyan(agentId)}\n`));

      // Show latest risk report with signals
      const report = getLatestRiskReport(db, agentId);
      if (report) {
        console.log(pc.bold('  Latest Risk Report:'));
        console.log(`    Risk:       ${riskColor(report.overallRisk)}`);
        console.log(`    Confidence: ${report.confidence}`);
        console.log(`    Generated:  ${new Date(report.generatedAt * 1000).toISOString()}`);
        console.log(`    Report ID:  ${pc.gray(report.reportId.slice(0, 16))}...`);
        console.log('');

        // Show context signals (CX_ prefix)
        const cxSignals = report.signals.filter((s) => s.signalId.startsWith('CX_'));
        if (cxSignals.length > 0) {
          console.log(pc.bold('  Context Signals:'));
          for (const sig of cxSignals) {
            console.log(`    ${severityColor(sig.severity)} ${pc.gray(sig.signalId)}`);
          }
          console.log('');
        } else {
          console.log(pc.gray('  No context signals in latest report.'));
          console.log('');
        }

        // Show all evidence links
        if (report.evidenceLinks.length > 0) {
          const cxEvidencePrefixes = [
            'funding', 'top', 'tx', 'current', 'prior', 'micro', 'unique', 'activity',
          ];
          const cxEvidence = report.evidenceLinks.filter((e) =>
            cxEvidencePrefixes.some((prefix) => e.type.startsWith(prefix)),
          );
          if (cxEvidence.length > 0) {
            console.log(pc.bold('  Context Evidence:'));
            for (const ev of cxEvidence) {
              console.log(`    [${ev.type}] ${pc.gray(ev.ref)}`);
            }
            console.log('');
          }
        }
      } else {
        console.log(pc.gray('  No risk report found. Run cx:sync first.'));
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── keygen ─────────────────────────────────────────────────────────────
program
  .command('keygen')
  .description('Generate a new Ed25519 signing keypair')
  .option('--key-path <path>', 'Path to save the keypair JSON', './data/watchtower-key.json')
  .option('--force', 'Overwrite existing key file')
  .action((options: { keyPath: string; force?: boolean }) => {
    const keyPath = resolve(options.keyPath);
    if (keyFileExists(keyPath) && !options.force) {
      console.error(pc.red(`  Key file already exists: ${keyPath}`));
      console.error(pc.gray('  Use --force to overwrite'));
      process.exit(1);
    }

    const kp = generateKeyPair();
    saveKeyPair(keyPath, kp);
    console.log(`  ${pc.green('✓')} Keypair saved to ${pc.cyan(keyPath)}`);
    console.log(`  Public key: ${pc.gray(kp.publicKey)}`);
  });

// ── pubkey ─────────────────────────────────────────────────────────────
program
  .command('pubkey')
  .description('Print the public key from a keypair file')
  .option('--key-path <path>', 'Path to the keypair JSON', './data/watchtower-key.json')
  .action((options: { keyPath: string }) => {
    const keyPath = resolve(options.keyPath);
    if (!keyFileExists(keyPath)) {
      console.error(pc.red(`  Key file not found: ${keyPath}`));
      console.error(pc.gray('  Run "wt keygen" first'));
      process.exit(1);
    }

    const kp = loadKeyPair(keyPath);
    console.log(kp.publicKey);
  });

// ── verify-report ──────────────────────────────────────────────────────
program
  .command('verify-report')
  .description('Verify a signed risk report')
  .requiredOption('--report <path>', 'Path to the risk report JSON')
  .requiredOption('--sig <path>', 'Path to the signature JSON')
  .action((options: { report: string; sig: string }) => {
    let reportData: { agentId: string; generatedAt: number; reportVersion: string; reportId: string };
    let sigData: ReportSignature;

    try {
      reportData = JSON.parse(readFileSync(resolve(options.report), 'utf-8'));
    } catch {
      console.error(pc.red('  Failed to parse report JSON'));
      process.exit(1);
    }

    try {
      sigData = JSON.parse(readFileSync(resolve(options.sig), 'utf-8')) as ReportSignature;
    } catch {
      console.error(pc.red('  Failed to parse signature JSON'));
      process.exit(1);
    }

    const valid = verifyReportSignature(reportData, sigData);
    if (valid) {
      console.log(`  ${pc.green('✓')} Signature is ${pc.green('VALID')}`);
      console.log(`  Signed by: ${pc.gray(sigData.publicKey)}`);
    } else {
      console.log(`  ${pc.red('✗')} Signature is ${pc.red('INVALID')}`);
      process.exit(2);
    }
  });

// ── transparency:append ────────────────────────────────────────────────
program
  .command('transparency:append')
  .description('Append a transparency leaf for an agent risk report')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .option('--key-path <path>', 'Path to the keypair JSON', './data/watchtower-key.json')
  .option('--log-dir <dir>', 'Transparency log directory', './data/transparency')
  .action((options: { agentId: string; keyPath: string; logDir: string }) => {
    const keyPath = resolve(options.keyPath);
    const kp = ensureKeyPair(keyPath);

    const db = openDb();
    try {
      const report = getLatestRiskReport(db, options.agentId);
      if (!report) {
        console.error(pc.red(`  No risk report found for agent ${options.agentId}`));
        process.exit(1);
      }

      const leaf = createLeaf({
        agentId: report.agentId,
        riskReportHash: report.reportId,
        overallRisk: report.overallRisk,
      }, kp);

      const filePath = appendLeaf(resolve(options.logDir), leaf);
      console.log(`  ${pc.green('✓')} Leaf appended to ${pc.cyan(filePath)}`);
      console.log(`  Leaf ID:  ${pc.gray(leaf.leafId.slice(0, 16))}...`);
      console.log(`  Agent:    ${pc.cyan(leaf.agentId)}`);
      console.log(`  Risk:     ${riskColor(leaf.overallRisk)}`);
    } finally {
      db.close();
    }
  });

// ── transparency:verify ────────────────────────────────────────────────
program
  .command('transparency:verify')
  .description('Verify the integrity of a transparency log file')
  .option('--date <YYYY-MM-DD>', 'Date to verify (default: today)')
  .option('--log-dir <dir>', 'Transparency log directory', './data/transparency')
  .option('--key-path <path>', 'Path to the keypair JSON (for public key)', './data/watchtower-key.json')
  .option('--public-key <base64>', 'Public key (base64) — overrides --key-path')
  .action((options: { date?: string; logDir: string; keyPath: string; publicKey?: string }) => {
    let pubKey: string;
    if (options.publicKey) {
      pubKey = options.publicKey;
    } else {
      const keyPath = resolve(options.keyPath);
      if (!keyFileExists(keyPath)) {
        console.error(pc.red(`  Key file not found: ${keyPath}`));
        console.error(pc.gray('  Provide --public-key or run "wt keygen" first'));
        process.exit(1);
      }
      pubKey = loadKeyPair(keyPath).publicKey;
    }

    const dateStr = options.date ?? new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) {
      console.error(pc.red(`  Invalid date: ${options.date}`));
      process.exit(1);
    }

    const filePath = logFilePath(resolve(options.logDir), date);
    const result = verifyLogFile(filePath, pubKey);

    console.log(pc.bold(`\n  Transparency Log Verification\n`));
    console.log(`  File:    ${pc.cyan(result.filePath)}`);
    console.log(`  Total:   ${result.totalLeaves}`);
    console.log(`  Valid:   ${pc.green(String(result.validLeaves))}`);
    console.log(`  Invalid: ${result.invalidLeaves > 0 ? pc.red(String(result.invalidLeaves)) : pc.green('0')}`);

    if (result.errors.length > 0) {
      console.log('');
      console.log(pc.bold('  Errors:'));
      for (const err of result.errors) {
        console.log(`    Line ${err.line}: ${pc.red(err.error)} (${pc.gray(err.leafId)})`);
      }
    }
    console.log('');

    if (result.invalidLeaves > 0) {
      process.exit(2);
    }
  });

// ── helpers ──────────────────────────────────────────────────────────────
function riskColor(risk: number): string {
  if (risk >= 80) return pc.red(pc.bold(`${risk}/100`));
  if (risk >= 50) return pc.yellow(`${risk}/100`);
  if (risk >= 20) return pc.cyan(`${risk}/100`);
  return pc.green(`${risk}/100`);
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return pc.red(pc.bold(severity));
    case 'HIGH':
      return pc.red(severity);
    case 'MEDIUM':
      return pc.yellow(severity);
    case 'LOW':
      return pc.green(severity);
    default:
      return severity;
  }
}

program.parse();
