#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig } from '@irsb-watchtower/config';
import { RpcProvider } from '@irsb-watchtower/chain';
import { createDefaultRegistry } from '@irsb-watchtower/core';
import { IrsbClient } from '@irsb-watchtower/irsb-adapter';

const program = new Command();

program
  .name('irsb-watchtower')
  .description('CLI utilities for IRSB Watchtower')
  .version('0.2.0');

/**
 * Health check command - verifies RPC connectivity and contract access
 */
program
  .command('health')
  .description('Check RPC connectivity and contract access')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    console.log(pc.bold('\nIRSB Watchtower Health Check\n'));

    const checks: Array<{ name: string; status: 'pass' | 'fail'; detail?: string }> = [];

    // 1. Load config
    try {
      const config = loadConfig();
      checks.push({ name: 'Configuration', status: 'pass', detail: `Chain ID: ${config.chain.chainId}` });

      // 2. Check RPC connectivity
      try {
        const provider = new RpcProvider({
          rpcUrl: config.chain.rpcUrl,
          chainId: config.chain.chainId,
        });

        const blockNumber = await provider.getBlockNumber();
        checks.push({
          name: 'RPC Connection',
          status: 'pass',
          detail: `Block #${blockNumber.toString()}`,
        });

        const chainId = await provider.getChainId();
        if (chainId === config.chain.chainId) {
          checks.push({ name: 'Chain ID Match', status: 'pass', detail: `${chainId}` });
        } else {
          checks.push({
            name: 'Chain ID Match',
            status: 'fail',
            detail: `Expected ${config.chain.chainId}, got ${chainId}`,
          });
        }

        // 3. Check IRSB contracts
        try {
          const client = new IrsbClient({
            rpcUrl: config.chain.rpcUrl,
            chainId: config.chain.chainId,
            contracts: config.contracts,
          });

          // Try to get block number through client
          await client.getBlockNumber();
          checks.push({
            name: 'IRSB Contracts',
            status: 'pass',
            detail: 'Accessible',
          });
        } catch (err) {
          checks.push({
            name: 'IRSB Contracts',
            status: 'fail',
            detail: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } catch (err) {
        checks.push({
          name: 'RPC Connection',
          status: 'fail',
          detail: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } catch (err) {
      checks.push({
        name: 'Configuration',
        status: 'fail',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Print results
    let allPassed = true;
    for (const check of checks) {
      const icon = check.status === 'pass' ? pc.green('✓') : pc.red('✗');
      const name = check.status === 'pass' ? pc.green(check.name) : pc.red(check.name);
      console.log(`  ${icon} ${name}`);
      if (options.verbose && check.detail) {
        console.log(pc.gray(`      ${check.detail}`));
      }
      if (check.status === 'fail') allPassed = false;
    }

    console.log('');
    if (allPassed) {
      console.log(pc.green(pc.bold('All checks passed!')));
      process.exit(0);
    } else {
      console.log(pc.red(pc.bold('Some checks failed.')));
      process.exit(1);
    }
  });

/**
 * Check config command - validates environment configuration
 */
program
  .command('check-config')
  .description('Validate environment configuration')
  .option('--env-file <path>', 'Path to .env file')
  .action(async (options) => {
    console.log(pc.bold('\nConfiguration Validation\n'));

    if (options.envFile) {
      console.log(pc.gray(`Loading from: ${options.envFile}\n`));
    }

    try {
      const config = loadConfig();

      const items = [
        { key: 'RPC_URL', value: config.chain.rpcUrl.replace(/\/\/.*@/, '//***@') },
        { key: 'CHAIN_ID', value: config.chain.chainId.toString() },
        { key: 'ENABLE_ACTIONS', value: config.api.enableActions.toString() },
        { key: 'SOLVER_REGISTRY', value: config.contracts.solverRegistry },
        { key: 'INTENT_RECEIPT_HUB', value: config.contracts.intentReceiptHub },
        { key: 'DISPUTE_MODULE', value: config.contracts.disputeModule },
        { key: 'SCAN_INTERVAL_MS', value: config.worker.scanIntervalMs.toString() },
        { key: 'SCAN_LOOKBACK_BLOCKS', value: config.worker.lookbackBlocks.toString() },
        { key: 'DRY_RUN', value: config.rules.dryRun.toString() },
      ];

      for (const item of items) {
        console.log(`  ${pc.cyan(item.key)}: ${item.value}`);
      }

      // Validate rules
      console.log(`\n  ${pc.cyan('Registered Rules')}:`);
      const registry = createDefaultRegistry();
      const rules = registry.getAll();
      for (const rule of rules) {
        console.log(`    - ${rule.metadata.id} (${rule.metadata.name})`);
      }

      console.log('');
      console.log(pc.green(pc.bold('Configuration is valid!')));
      process.exit(0);
    } catch (err) {
      console.log(pc.red('Configuration Error:'));
      console.log(pc.red(`  ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Simulate command - preview what receipts would be scanned
 */
program
  .command('simulate')
  .description('Preview receipts in scan range (dry run)')
  .option('-b, --blocks <number>', 'Number of blocks to scan', '100')
  .option('--from-block <number>', 'Start from specific block')
  .action(async (options) => {
    console.log(pc.bold('\nSimulating Scan (Dry Run)\n'));

    try {
      const config = loadConfig();

      console.log(pc.gray(`Chain ID: ${config.chain.chainId}`));
      console.log(pc.gray(`RPC: ${config.chain.rpcUrl.replace(/\/\/.*@/, '//***@')}`));

      const provider = new RpcProvider({
        rpcUrl: config.chain.rpcUrl,
        chainId: config.chain.chainId,
      });

      const currentBlock = await provider.getBlockNumber();
      const blocksToScan = BigInt(options.blocks);
      const fromBlock = options.fromBlock ? BigInt(options.fromBlock) : currentBlock - blocksToScan;
      const toBlock = currentBlock;

      console.log(pc.gray(`Scanning blocks ${fromBlock} to ${toBlock} (${blocksToScan} blocks)\n`));

      const client = new IrsbClient({
        rpcUrl: config.chain.rpcUrl,
        chainId: config.chain.chainId,
        contracts: config.contracts,
      });

      // Show registered rules
      const registry = createDefaultRegistry();
      const rules = registry.getAll();
      console.log(`Registered ${rules.length} rule(s):`);
      for (const rule of rules) {
        const enabled = rule.metadata.enabledByDefault ? pc.green('enabled') : pc.gray('disabled');
        console.log(`  - ${rule.metadata.id} [${enabled}]`);
      }
      console.log('');

      // Get receipts in range
      console.log(pc.cyan('Fetching receipt events...'));
      const receiptEvents = await client.getReceiptPostedEvents(fromBlock, toBlock);
      console.log(`Found ${receiptEvents.length} ReceiptPosted event(s)\n`);

      if (receiptEvents.length === 0) {
        console.log(pc.yellow('No receipts found in the specified range.'));
        console.log(pc.gray('Try increasing --blocks or checking a different range.'));
      } else {
        console.log(pc.cyan('Receipts found:'));
        for (const event of receiptEvents.slice(0, 10)) {
          console.log(`  ${pc.gray('Receipt:')} ${event.receiptId.slice(0, 18)}...`);
          console.log(`    ${pc.gray('Solver:')} ${event.solverId.slice(0, 18)}...`);
          console.log(`    ${pc.gray('Block:')} ${event.blockNumber}`);
          console.log(`    ${pc.gray('Deadline:')} ${new Date(Number(event.challengeDeadline) * 1000).toISOString()}`);
          console.log('');
        }
        if (receiptEvents.length > 10) {
          console.log(pc.gray(`  ... and ${receiptEvents.length - 10} more`));
        }
      }

      // Get dispute events too
      const disputeEvents = await client.getDisputeOpenedEvents(fromBlock, toBlock);
      if (disputeEvents.length > 0) {
        console.log(`\n${pc.cyan('Disputes found:')} ${disputeEvents.length}`);
        for (const event of disputeEvents.slice(0, 5)) {
          console.log(`  ${pc.gray('Dispute:')} ${event.disputeId.slice(0, 18)}...`);
          console.log(`    ${pc.gray('Receipt:')} ${event.receiptId.slice(0, 18)}...`);
          console.log(`    ${pc.gray('Reason:')} ${event.reason.slice(0, 50)}${event.reason.length > 50 ? '...' : ''}`);
          console.log('');
        }
      }

      console.log(pc.bold('\nSimulation complete (no on-chain actions taken).'));
      console.log(pc.gray('Run the full worker to evaluate rules and take actions.'));
      process.exit(0);
    } catch (err) {
      console.log(pc.red('Simulation Error:'));
      console.log(pc.red(`  ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program.parse();
