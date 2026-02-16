import {
  CircuitBreaker,
  createRpcCircuitBreaker,
  resilient,
  type RetryConfig,
  type CircuitBreakerConfig,
} from '@irsb-watchtower/resilience';
import { IrsbClient, type IrsbClientConfig } from './irsbClient.js';
import type {
  OnChainReceipt,
  Solver,
  Dispute,
  OpenDisputeParams,
  SubmitEvidenceParams,
  ReceiptPostedEvent,
  ReceiptFinalizedEvent,
  DisputeOpenedEvent,
} from './types.js';
import type { Hex, Account } from 'viem';

/**
 * Configuration for resilient IRSB client
 */
export interface ResilientIrsbClientConfig extends IrsbClientConfig {
  /** Retry configuration for RPC calls */
  retry?: RetryConfig;

  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;

  /** Optional callback for circuit state changes */
  onCircuitStateChange?: (from: string, to: string) => void;

  /** Optional callback for retries */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Resilient IRSB Client with retry and circuit breaker patterns
 *
 * Wraps the base IrsbClient with:
 * - Automatic retry with exponential backoff for transient failures
 * - Circuit breaker to prevent cascading failures
 */
export class ResilientIrsbClient {
  private readonly client: IrsbClient;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryConfig: RetryConfig;

  constructor(config: ResilientIrsbClientConfig) {
    this.client = new IrsbClient(config);

    // Set up circuit breaker with optional callback
    this.circuitBreaker = createRpcCircuitBreaker({
      ...config.circuitBreaker,
      onStateChange: config.onCircuitStateChange,
    });

    // Set up retry config with optional callback
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      jitterFactor: 0.2,
      ...config.retry,
      onRetry: config.onRetry,
    };
  }

  /**
   * Get the circuit breaker for monitoring
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Reset the circuit breaker manually
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Check if the client is healthy (circuit is not open)
   */
  isHealthy(): boolean {
    return this.circuitBreaker.getState() !== 'open';
  }

  /**
   * Wrap an async function with resilience patterns
   */
  private resilientCall<T>(fn: () => Promise<T>): Promise<T> {
    const wrappedFn = resilient(fn as () => Promise<T>, {
      retry: this.retryConfig,
      circuitBreaker: this.circuitBreaker,
    });
    return wrappedFn();
  }

  // ============================================================
  // Resilient Read Operations
  // ============================================================

  /**
   * Set up wallet client for write operations
   */
  setWalletClient(account: Account, rpcUrl: string): void {
    this.client.setWalletClient(account, rpcUrl);
  }

  /**
   * Get receipt by ID with resilience
   */
  async getReceipt(receiptId: Hex): Promise<OnChainReceipt | null> {
    return this.resilientCall(() => this.client.getReceipt(receiptId));
  }

  /**
   * Get solver by ID with resilience
   */
  async getSolver(solverId: Hex): Promise<Solver | null> {
    return this.resilientCall(() => this.client.getSolver(solverId));
  }

  /**
   * Get dispute by ID with resilience
   */
  async getDispute(disputeId: Hex): Promise<Dispute | null> {
    return this.resilientCall(() => this.client.getDispute(disputeId));
  }

  /**
   * Get challenge window duration with resilience
   */
  async getChallengeWindow(): Promise<bigint> {
    return this.resilientCall(() => this.client.getChallengeWindow());
  }

  /**
   * Get minimum bond requirement with resilience
   */
  async getMinimumBond(): Promise<bigint> {
    return this.resilientCall(() => this.client.getMinimumBond());
  }

  // ============================================================
  // Resilient Write Operations
  // ============================================================

  /**
   * Open a dispute against a receipt with resilience
   */
  async openDispute(params: OpenDisputeParams): Promise<Hex> {
    return this.resilientCall(() => this.client.openDispute(params));
  }

  /**
   * Submit evidence for a dispute with resilience
   */
  async submitEvidence(params: SubmitEvidenceParams): Promise<Hex> {
    return this.resilientCall(() => this.client.submitEvidence(params));
  }

  // ============================================================
  // Resilient Event Queries
  // ============================================================

  /**
   * Get ReceiptPosted events with resilience
   */
  async getReceiptPostedEvents(
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<ReceiptPostedEvent[]> {
    return this.resilientCall(() =>
      this.client.getReceiptPostedEvents(fromBlock, toBlock)
    );
  }

  /**
   * Get ReceiptFinalized events with resilience
   */
  async getReceiptFinalizedEvents(
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<ReceiptFinalizedEvent[]> {
    return this.resilientCall(() =>
      this.client.getReceiptFinalizedEvents(fromBlock, toBlock)
    );
  }

  /**
   * Get DisputeOpened events with resilience
   */
  async getDisputeOpenedEvents(
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<DisputeOpenedEvent[]> {
    return this.resilientCall(() =>
      this.client.getDisputeOpenedEvents(fromBlock, toBlock)
    );
  }

  /**
   * Get block timestamp with resilience
   */
  async getBlockTimestamp(blockNumber: bigint): Promise<bigint> {
    return this.resilientCall(() => this.client.getBlockTimestamp(blockNumber));
  }

  /**
   * Get current block number with resilience
   */
  async getBlockNumber(): Promise<bigint> {
    return this.resilientCall(() => this.client.getBlockNumber());
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Get contract addresses
   */
  getContractAddresses() {
    return this.client.getContractAddresses();
  }

  /**
   * Get the underlying non-resilient client (for advanced usage)
   */
  getBaseClient(): IrsbClient {
    return this.client;
  }
}

/**
 * Create a resilient IRSB client
 */
export function createResilientIrsbClient(
  config: ResilientIrsbClientConfig
): ResilientIrsbClient {
  return new ResilientIrsbClient(config);
}
