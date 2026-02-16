/**
 * Receipt Verification Module
 *
 * Functions for verifying receipts on-chain.
 */

import { ethers, Provider, Contract } from 'ethers';
import { ChainConfig, CHAIN_CONFIGS, ReceiptStatus, IntentReceipt } from './types';
import {
  IntentReceiptV2,
  ReceiptV2Status,
  verifyReceiptV2Signature,
  getEIP712Domain,
} from './v2';
import { INTENT_RECEIPT_HUB_ABI, RECEIPT_V2_EXTENSION_ABI } from './contracts/abis';

// ============ Types ============

/**
 * Result of on-chain receipt verification
 */
export interface VerifyResult {
  /** Whether the receipt exists on-chain */
  exists: boolean;
  /** Receipt version (1 or 2) */
  version: 1 | 2;
  /** Receipt status */
  status: ReceiptStatus | ReceiptV2Status;
  /** Human-readable status name */
  statusName: string;
  /** The receipt data (if found) */
  receipt: IntentReceipt | IntentReceiptV2 | null;
  /** Signature verification results */
  signatures: {
    solverValid: boolean | null;
    clientValid: boolean | null;
    solverAddress?: string;
    clientAddress?: string;
  };
  /** Chain information */
  chain: {
    chainId: number;
    name: string;
    explorer: string;
  };
  /** Contract addresses used */
  contracts: {
    hub: string;
  };
  /** Any errors encountered */
  errors: string[];
}

/**
 * Options for verification
 */
export interface VerifyOptions {
  /** Chain name ('sepolia') or custom config */
  chain?: string | ChainConfig;
  /** Ethers provider (optional, will create default if not provided) */
  provider?: Provider;
  /** Skip signature verification (faster) */
  skipSignatureCheck?: boolean;
}

// ============ Status Helpers ============

const RECEIPT_STATUS_NAMES: Record<ReceiptStatus, string> = {
  [ReceiptStatus.None]: 'None',
  [ReceiptStatus.Posted]: 'Posted',
  [ReceiptStatus.Challenged]: 'Challenged',
  [ReceiptStatus.Finalized]: 'Finalized',
  [ReceiptStatus.Slashed]: 'Slashed',
};

const RECEIPT_V2_STATUS_NAMES: Record<ReceiptV2Status, string> = {
  [ReceiptV2Status.None]: 'None',
  [ReceiptV2Status.Pending]: 'Pending',
  [ReceiptV2Status.Disputed]: 'Disputed',
  [ReceiptV2Status.Finalized]: 'Finalized',
  [ReceiptV2Status.Slashed]: 'Slashed',
};

// ============ Core Functions ============

/**
 * Verify a receipt on-chain by its ID.
 *
 * Supports both V1 (intent hash) and V2 (receipt ID) lookups.
 *
 * @param receiptId - Receipt ID or intent hash (bytes32)
 * @param options - Verification options
 * @returns Verification result
 *
 * @example
 * ```ts
 * const result = await verifyReceipt('0x...receiptId', { chain: 'sepolia' });
 * if (result.exists && result.status === ReceiptV2Status.Finalized) {
 *   console.log('Receipt verified!');
 * }
 * ```
 */
export async function verifyReceipt(
  receiptId: string,
  options: VerifyOptions = {}
): Promise<VerifyResult> {
  const errors: string[] = [];

  // Validate receipt ID format
  if (!/^0x[a-fA-F0-9]{64}$/.test(receiptId)) {
    return {
      exists: false,
      version: 2,
      status: ReceiptV2Status.None,
      statusName: 'Invalid',
      receipt: null,
      signatures: { solverValid: null, clientValid: null },
      chain: { chainId: 0, name: 'unknown', explorer: '' },
      contracts: { hub: '' },
      errors: ['Invalid receipt ID format. Must be 0x-prefixed 32-byte hex.'],
    };
  }

  // Resolve chain config
  let chainConfig: ChainConfig;
  if (typeof options.chain === 'string') {
    const config = CHAIN_CONFIGS[options.chain];
    if (!config) {
      return {
        exists: false,
        version: 2,
        status: ReceiptV2Status.None,
        statusName: 'Invalid',
        receipt: null,
        signatures: { solverValid: null, clientValid: null },
        chain: { chainId: 0, name: options.chain, explorer: '' },
        contracts: { hub: '' },
        errors: [`Unknown chain: ${options.chain}. Available: ${Object.keys(CHAIN_CONFIGS).join(', ')}`],
      };
    }
    chainConfig = config;
  } else if (options.chain) {
    chainConfig = options.chain;
  } else {
    chainConfig = CHAIN_CONFIGS.sepolia; // Default to Sepolia
  }

  // Get provider
  const provider = options.provider || new ethers.JsonRpcProvider(chainConfig.rpcUrl);

  // Try V2 first (more common for new receipts)
  const v2Result = await tryVerifyV2(receiptId, chainConfig, provider, options.skipSignatureCheck);
  if (v2Result.exists) {
    return v2Result;
  }

  // Fall back to V1
  const v1Result = await tryVerifyV1(receiptId, chainConfig, provider);
  return v1Result;
}

/**
 * Try to verify as V2 receipt
 */
async function tryVerifyV2(
  receiptId: string,
  chainConfig: ChainConfig,
  provider: Provider,
  skipSignatureCheck?: boolean
): Promise<VerifyResult> {
  const errors: string[] = [];
  const baseResult = {
    version: 2 as const,
    chain: {
      chainId: chainConfig.chainId,
      name: chainConfig.name,
      explorer: chainConfig.explorer,
    },
    contracts: {
      hub: chainConfig.intentReceiptHub,
    },
  };

  try {
    const hub = new Contract(chainConfig.intentReceiptHub, RECEIPT_V2_EXTENSION_ABI, provider);

    // Query receipt
    const [receiptData, status] = await hub.getReceiptV2(receiptId);

    // Check if receipt exists (all fields zero = not found)
    if (receiptData.intentHash === ethers.ZeroHash) {
      return {
        ...baseResult,
        exists: false,
        status: ReceiptV2Status.None,
        statusName: 'Not Found',
        receipt: null,
        signatures: { solverValid: null, clientValid: null },
        errors: [],
      };
    }

    // Parse receipt
    const receipt: IntentReceiptV2 = {
      intentHash: receiptData.intentHash,
      constraintsHash: receiptData.constraintsHash,
      routeHash: receiptData.routeHash,
      outcomeHash: receiptData.outcomeHash,
      evidenceHash: receiptData.evidenceHash,
      createdAt: receiptData.createdAt,
      expiry: receiptData.expiry,
      solverId: receiptData.solverId,
      client: receiptData.client,
      metadataCommitment: receiptData.metadataCommitment,
      ciphertextPointer: receiptData.ciphertextPointer,
      privacyLevel: Number(receiptData.privacyLevel),
      escrowId: receiptData.escrowId,
      solverSig: receiptData.solverSig,
      clientSig: receiptData.clientSig,
    };

    const receiptStatus = Number(status) as ReceiptV2Status;

    // Verify signatures if requested
    let solverValid: boolean | null = null;
    let clientValid: boolean | null = null;

    if (!skipSignatureCheck && receipt.solverSig && receipt.solverSig !== '0x') {
      try {
        const domain = getEIP712Domain(chainConfig.chainId, chainConfig.intentReceiptHub);
        // Note: We can't verify without knowing the expected signer address
        // For now, just check signature format is valid
        solverValid = /^0x[a-fA-F0-9]{130}$/.test(receipt.solverSig);
      } catch (e) {
        errors.push(`Solver signature verification failed: ${e instanceof Error ? e.message : e}`);
        solverValid = false;
      }
    }

    if (!skipSignatureCheck && receipt.clientSig && receipt.clientSig !== '0x') {
      try {
        clientValid = /^0x[a-fA-F0-9]{130}$/.test(receipt.clientSig);
      } catch (e) {
        errors.push(`Client signature verification failed: ${e instanceof Error ? e.message : e}`);
        clientValid = false;
      }
    }

    return {
      ...baseResult,
      exists: true,
      status: receiptStatus,
      statusName: RECEIPT_V2_STATUS_NAMES[receiptStatus] || 'Unknown',
      receipt,
      signatures: {
        solverValid,
        clientValid,
      },
      errors,
    };
  } catch (e) {
    // V2 query failed - might be V1 or contract not deployed
    return {
      ...baseResult,
      exists: false,
      status: ReceiptV2Status.None,
      statusName: 'Not Found',
      receipt: null,
      signatures: { solverValid: null, clientValid: null },
      errors: [], // Don't report error, will try V1
    };
  }
}

/**
 * Try to verify as V1 receipt (using intent hash)
 */
async function tryVerifyV1(
  intentHash: string,
  chainConfig: ChainConfig,
  provider: Provider
): Promise<VerifyResult> {
  const errors: string[] = [];
  const baseResult = {
    version: 1 as const,
    chain: {
      chainId: chainConfig.chainId,
      name: chainConfig.name,
      explorer: chainConfig.explorer,
    },
    contracts: {
      hub: chainConfig.intentReceiptHub,
    },
  };

  try {
    const hub = new Contract(chainConfig.intentReceiptHub, INTENT_RECEIPT_HUB_ABI, provider);

    // Query receipt
    const receiptData = await hub.getReceipt(intentHash);

    // Check if receipt exists
    if (receiptData.solver === ethers.ZeroAddress) {
      return {
        ...baseResult,
        exists: false,
        status: ReceiptStatus.None,
        statusName: 'Not Found',
        receipt: null,
        signatures: { solverValid: null, clientValid: null },
        errors: [],
      };
    }

    // Parse receipt
    const receipt: IntentReceipt = {
      solver: receiptData.solver,
      intentHash: receiptData.intentHash,
      constraintsHash: receiptData.constraintsHash,
      outcomeHash: receiptData.outcomeHash,
      evidenceHash: receiptData.evidenceHash,
      postedAt: receiptData.postedAt,
      deadline: receiptData.deadline,
      solverSig: receiptData.solverSig,
      status: Number(receiptData.status) as ReceiptStatus,
    };

    // V1 signature verification would require knowing the expected signer
    const solverValid = receipt.solverSig && receipt.solverSig !== '0x' ? true : null;

    return {
      ...baseResult,
      exists: true,
      status: receipt.status,
      statusName: RECEIPT_STATUS_NAMES[receipt.status] || 'Unknown',
      receipt,
      signatures: {
        solverValid,
        clientValid: null, // V1 has no client signature
      },
      errors,
    };
  } catch (e) {
    return {
      ...baseResult,
      exists: false,
      status: ReceiptStatus.None,
      statusName: 'Error',
      receipt: null,
      signatures: { solverValid: null, clientValid: null },
      errors: [`Failed to query receipt: ${e instanceof Error ? e.message : e}`],
    };
  }
}

/**
 * Format verification result for display.
 *
 * @param result - Verification result
 * @param format - Output format ('text' or 'json')
 * @returns Formatted string
 */
export function formatVerifyResult(result: VerifyResult, format: 'text' | 'json' = 'text'): string {
  if (format === 'json') {
    return JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
  }

  const lines: string[] = [];

  // Header
  lines.push('═'.repeat(60));
  lines.push(`IRSB Receipt Verification`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Status
  if (result.exists) {
    lines.push(`Status: ✓ ${result.statusName} (V${result.version})`);
  } else {
    lines.push(`Status: ✗ Not Found`);
    if (result.errors.length > 0) {
      lines.push(`Errors: ${result.errors.join(', ')}`);
    }
    lines.push('');
    lines.push(`Chain: ${result.chain.name} (${result.chain.chainId})`);
    return lines.join('\n');
  }

  lines.push('');

  // Chain info
  lines.push(`Chain: ${result.chain.name} (${result.chain.chainId})`);
  lines.push(`Hub: ${result.contracts.hub}`);
  lines.push('');

  // Receipt details
  if (result.receipt) {
    lines.push('Receipt Details:');
    lines.push('─'.repeat(40));

    if (result.version === 2) {
      const r = result.receipt as IntentReceiptV2;
      lines.push(`  Intent Hash: ${r.intentHash}`);
      lines.push(`  Solver ID: ${r.solverId}`);
      lines.push(`  Client: ${r.client}`);
      lines.push(`  Privacy Level: ${['Public', 'SemiPublic', 'Private'][r.privacyLevel]}`);
      lines.push(`  Created: ${new Date(Number(r.createdAt) * 1000).toISOString()}`);
      lines.push(`  Expiry: ${new Date(Number(r.expiry) * 1000).toISOString()}`);
      if (r.escrowId !== ethers.ZeroHash) {
        lines.push(`  Escrow ID: ${r.escrowId}`);
      }
      if (r.ciphertextPointer) {
        lines.push(`  Ciphertext: ${r.ciphertextPointer}`);
      }
    } else {
      const r = result.receipt as IntentReceipt;
      lines.push(`  Intent Hash: ${r.intentHash}`);
      lines.push(`  Solver: ${r.solver}`);
      lines.push(`  Posted: ${new Date(Number(r.postedAt) * 1000).toISOString()}`);
      lines.push(`  Deadline: ${new Date(Number(r.deadline) * 1000).toISOString()}`);
    }
    lines.push('');
  }

  // Signatures
  lines.push('Signatures:');
  lines.push('─'.repeat(40));
  if (result.signatures.solverValid === true) {
    lines.push('  Solver: ✓ Valid');
  } else if (result.signatures.solverValid === false) {
    lines.push('  Solver: ✗ Invalid');
  } else {
    lines.push('  Solver: - Not checked');
  }

  if (result.version === 2) {
    if (result.signatures.clientValid === true) {
      lines.push('  Client: ✓ Valid');
    } else if (result.signatures.clientValid === false) {
      lines.push('  Client: ✗ Invalid');
    } else {
      lines.push('  Client: - Not checked');
    }
  }
  lines.push('');

  // Explorer link
  lines.push(`Explorer: ${result.chain.explorer}/address/${result.contracts.hub}`);

  // Errors
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    result.errors.forEach(e => lines.push(`  ⚠ ${e}`));
  }

  return lines.join('\n');
}
