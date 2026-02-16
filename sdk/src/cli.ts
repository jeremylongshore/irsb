#!/usr/bin/env node
/**
 * IRSB CLI
 *
 * Command-line interface for IRSB Protocol operations.
 *
 * Usage:
 *   irsb verify <receipt-id> [--chain sepolia] [--json]
 *   irsb --help
 */

import { verifyReceipt, formatVerifyResult } from './verify';
import { CHAIN_CONFIGS, SUPPORTED_CHAIN_IDS } from './types';

// ============ CLI Parsing ============

interface CLIArgs {
  command: string;
  receiptId?: string;
  chain: string;
  json: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {
    command: '',
    chain: 'sepolia',
    json: false,
    help: false,
    version: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--json' || arg === '-j') {
      result.json = true;
    } else if (arg === '--chain' || arg === '-c') {
      result.chain = args[++i] || 'sepolia';
    } else if (arg.startsWith('--chain=')) {
      result.chain = arg.split('=')[1];
    } else if (!arg.startsWith('-')) {
      if (!result.command) {
        result.command = arg;
      } else if (!result.receiptId) {
        result.receiptId = arg;
      }
    }
    i++;
  }

  return result;
}

// ============ Help Text ============

const HELP_TEXT = `
IRSB CLI - Intent Receipts & Solver Bonds

USAGE
  irsb <command> [options]

COMMANDS
  verify <receipt-id>   Verify a receipt on-chain

OPTIONS
  -c, --chain <name>    Chain to query (default: sepolia)
                        Supported: ${Object.keys(CHAIN_CONFIGS).join(', ')}
  -j, --json            Output as JSON
  -h, --help            Show this help
  -v, --version         Show version

EXAMPLES
  # Verify a receipt on Sepolia
  irsb verify 0x1234...5678

  # Verify with JSON output
  irsb verify 0x1234...5678 --json

  # Verify on a different chain
  irsb verify 0x1234...5678 --chain mainnet

CONTRACT ADDRESSES (Sepolia)
  SolverRegistry:    ${CHAIN_CONFIGS.sepolia?.solverRegistry || 'Not deployed'}
  IntentReceiptHub:  ${CHAIN_CONFIGS.sepolia?.intentReceiptHub || 'Not deployed'}
  DisputeModule:     ${CHAIN_CONFIGS.sepolia?.disputeModule || 'Not deployed'}
`;

const VERSION = '0.1.0';

// ============ Commands ============

async function cmdVerify(args: CLIArgs): Promise<void> {
  if (!args.receiptId) {
    console.error('Error: Receipt ID required');
    console.error('Usage: irsb verify <receipt-id>');
    process.exit(1);
  }

  // Validate receipt ID format early
  if (!/^0x[a-fA-F0-9]{64}$/.test(args.receiptId)) {
    console.error('Error: Invalid receipt ID format');
    console.error('Must be a 0x-prefixed 32-byte hex string (66 characters)');
    process.exit(1);
  }

  // Check chain is valid
  if (!CHAIN_CONFIGS[args.chain]) {
    console.error(`Error: Unknown chain '${args.chain}'`);
    console.error(`Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  try {
    if (!args.json) {
      console.log(`Verifying receipt on ${args.chain}...`);
      console.log('');
    }

    const result = await verifyReceipt(args.receiptId, {
      chain: args.chain,
    });

    const output = formatVerifyResult(result, args.json ? 'json' : 'text');
    console.log(output);

    // Exit with error if receipt not found or has errors
    if (!result.exists || result.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (args.json) {
      console.log(JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : String(error),
      }, null, 2));
    } else {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}

// ============ Main ============

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(`irsb v${VERSION}`);
    return;
  }

  if (args.help || !args.command) {
    console.log(HELP_TEXT);
    return;
  }

  switch (args.command) {
    case 'verify':
      await cmdVerify(args);
      break;

    default:
      console.error(`Unknown command: ${args.command}`);
      console.error('Run "irsb --help" for usage');
      process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
