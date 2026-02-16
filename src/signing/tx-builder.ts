/**
 * Transaction Builder
 *
 * Builds and signs Ethereum transactions for IRSB actions.
 * Owns nonce management to prevent race conditions.
 */

import { Transaction, keccak256, Interface } from 'ethers';
import type { Signer } from './signer.js';
import type { IrsbAction } from '../types/actions.js';
import { toEip155Signature } from './der-to-rsv.js';
import pino from 'pino';

const logger = pino({ name: 'tx-builder' });

/**
 * Transaction type
 */
export type TxType = 'legacy' | 'eip1559';

/**
 * Transaction configuration
 */
export interface TxConfig {
  /**
   * Chain ID
   */
  chainId: number;

  /**
   * Target contract address
   */
  to: string;

  /**
   * Value in wei
   */
  value: bigint;

  /**
   * Gas limit
   */
  gasLimit: bigint;

  /**
   * Transaction type
   */
  type: TxType;

  /**
   * Gas price (for legacy tx)
   */
  gasPrice?: bigint;

  /**
   * Max fee per gas (for EIP-1559)
   */
  maxFeePerGas?: bigint;

  /**
   * Max priority fee per gas (for EIP-1559)
   */
  maxPriorityFeePerGas?: bigint;
}

/**
 * Built transaction result
 */
export interface BuiltTransaction {
  /**
   * Signed transaction (RLP-encoded hex)
   */
  signedTx: string;

  /**
   * Transaction hash
   */
  txHash: string;

  /**
   * Nonce used
   */
  nonce: number;
}

/**
 * Nonce manager state
 */
interface NonceState {
  /**
   * Next nonce to use
   */
  nextNonce: number;

  /**
   * Pending transactions (nonce -> requestId)
   */
  pending: Map<number, string>;

  /**
   * Used request IDs for idempotency
   */
  usedRequestIds: Set<string>;
}

/**
 * Transaction builder with nonce management
 */
export class TxBuilder {
  private readonly nonceState: Map<string, NonceState> = new Map();

  /**
   * ABI for IRSB protocol contract
   */
  private readonly irsbInterface = new Interface([
    'function submitReceipt(bytes32 intentId, bytes32 receiptHash, bytes32 evidenceHash)',
    'function openDispute(bytes32 receiptId, bytes32 evidenceHash, uint8 reasonCode)',
    'function submitEvidence(bytes32 disputeId, bytes32 evidenceHash)',
  ]);

  /**
   * Build and sign a transaction for an IRSB action
   */
  async buildTransaction(
    signer: Signer,
    action: IrsbAction,
    config: TxConfig,
    requestId: string
  ): Promise<BuiltTransaction> {
    const address = await signer.getAddress();

    // Check idempotency
    const state = this.getOrCreateState(address);
    if (state.usedRequestIds.has(requestId)) {
      throw new Error(`Duplicate request: ${requestId}`);
    }

    // Get nonce
    const nonce = this.allocateNonce(address, requestId);

    try {
      // Encode action as calldata
      const data = this.encodeAction(action);

      // Build unsigned transaction
      const tx = this.buildUnsignedTx(config, nonce, data);

      // Compute transaction hash for signing
      const unsignedHash = keccak256(tx.unsignedSerialized);

      // Sign with KMS
      const signature = await signer.sign(unsignedHash);

      // Convert to EIP-155 signature
      const eip155Sig = toEip155Signature(signature, config.chainId);

      // Attach signature to transaction
      tx.signature = {
        r: eip155Sig.r,
        s: eip155Sig.s,
        v: eip155Sig.v,
      };

      const signedTx = tx.serialized;
      const txHash = keccak256(signedTx);

      // Mark request as used
      state.usedRequestIds.add(requestId);

      logger.info(
        { txHash, nonce, action: action.action, address },
        'Built and signed transaction'
      );

      return { signedTx, txHash, nonce };
    } catch (error) {
      // Release nonce on failure
      this.releaseNonce(address, nonce);
      throw error;
    }
  }

  /**
   * Encode an IRSB action as calldata
   */
  private encodeAction(action: IrsbAction): string {
    switch (action.action) {
      case 'SUBMIT_RECEIPT':
        return this.irsbInterface.encodeFunctionData('submitReceipt', [
          action.intentId,
          action.receiptHash,
          action.evidenceHash,
        ]);

      case 'OPEN_DISPUTE':
        return this.irsbInterface.encodeFunctionData('openDispute', [
          action.receiptId,
          action.evidenceHash,
          this.disputeReasonToCode(action.reasonCode),
        ]);

      case 'SUBMIT_EVIDENCE':
        return this.irsbInterface.encodeFunctionData('submitEvidence', [
          action.disputeId,
          action.evidenceHash,
        ]);

      default:
        throw new Error('Unknown action type');
    }
  }

  /**
   * Build unsigned transaction
   */
  private buildUnsignedTx(config: TxConfig, nonce: number, data: string): Transaction {
    const tx = new Transaction();

    tx.chainId = BigInt(config.chainId);
    tx.nonce = nonce;
    tx.to = config.to;
    tx.value = config.value;
    tx.gasLimit = config.gasLimit;
    tx.data = data;

    if (config.type === 'eip1559') {
      tx.type = 2;
      tx.maxFeePerGas = config.maxFeePerGas ?? BigInt(0);
      tx.maxPriorityFeePerGas = config.maxPriorityFeePerGas ?? BigInt(0);
    } else {
      tx.type = 0;
      tx.gasPrice = config.gasPrice ?? BigInt(0);
    }

    return tx;
  }

  /**
   * Convert dispute reason to on-chain code
   */
  private disputeReasonToCode(reason: string): number {
    const codes: Record<string, number> = {
      INTENT_MISMATCH: 0,
      EVIDENCE_INVALID: 1,
      SLIPPAGE_EXCEEDED: 2,
      TIMEOUT_VIOLATION: 3,
      MALFORMED_RECEIPT: 4,
      DUPLICATE_EXECUTION: 5,
    };
    return codes[reason] ?? 0;
  }

  /**
   * Get or create nonce state for an address
   */
  private getOrCreateState(address: string): NonceState {
    const key = address.toLowerCase();
    let state = this.nonceState.get(key);

    if (!state) {
      state = {
        nextNonce: 0,
        pending: new Map(),
        usedRequestIds: new Set(),
      };
      this.nonceState.set(key, state);
    }

    return state;
  }

  /**
   * Allocate a nonce for a transaction
   */
  private allocateNonce(address: string, requestId: string): number {
    const state = this.getOrCreateState(address);
    const nonce = state.nextNonce++;
    state.pending.set(nonce, requestId);
    return nonce;
  }

  /**
   * Release a nonce after failed transaction
   */
  private releaseNonce(address: string, nonce: number): void {
    const state = this.getOrCreateState(address);
    state.pending.delete(nonce);

    // If this was the last nonce, we can reuse it
    if (nonce === state.nextNonce - 1 && state.pending.size === 0) {
      state.nextNonce = nonce;
    }
  }

  /**
   * Sync nonce with chain (call on startup or after errors)
   */
  async syncNonce(_address: string, _chainNonce: number): Promise<void> {
    // TODO: Implement chain sync
    // For now, this is a stub
  }

  /**
   * Clear idempotency cache (for testing)
   */
  clearIdempotencyCache(address: string): void {
    const state = this.nonceState.get(address.toLowerCase());
    if (state) {
      state.usedRequestIds.clear();
    }
  }
}
