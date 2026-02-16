import { ethers, Signer, Provider, Contract, TransactionResponse } from 'ethers';
import {
  ChainConfig,
  CHAIN_CONFIGS,
  SolverInfo,
  SolverStatus,
  IntentReceipt,
  ReceiptStatus,
  Challenge,
  DisputeReason,
  PostReceiptParams,
  CONSTANTS,
} from './types';
import {
  SOLVER_REGISTRY_ABI,
  INTENT_RECEIPT_HUB_ABI,
  DISPUTE_MODULE_ABI,
} from './contracts/abis';
import {
  WalletApi,
  RiskScore,
  RecentReceiptsResponse,
  BondStatus,
  SUBGRAPH_URLS,
} from './api/walletApi';

export interface IRSBClientConfig {
  /** Chain name ('sepolia') or custom config */
  chain: string | ChainConfig;
  /** Ethers signer for write operations */
  signer?: Signer;
  /** Ethers provider for read operations (optional if signer provided) */
  provider?: Provider;
}

/**
 * IRSB Protocol SDK Client
 *
 * @example
 * ```ts
 * import { IRSBClient } from '@irsb/sdk';
 * import { ethers } from 'ethers';
 *
 * const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
 * const signer = new ethers.Wallet(PRIVATE_KEY, provider);
 *
 * const client = new IRSBClient({
 *   chain: 'sepolia',
 *   signer,
 * });
 *
 * // Register as solver
 * await client.register({ value: ethers.parseEther('0.1') });
 *
 * // Post a receipt
 * await client.postReceipt({
 *   intentHash: '0x...',
 *   constraintsHash: '0x...',
 *   outcomeHash: '0x...',
 *   evidenceHash: '0x...',
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
 *   solverSig: '0x...',
 * });
 * ```
 */
export class IRSBClient {
  readonly config: ChainConfig;
  readonly provider: Provider;
  readonly signer?: Signer;

  private solverRegistry: Contract;
  private intentReceiptHub: Contract;
  private disputeModule: Contract;

  constructor(options: IRSBClientConfig) {
    // Resolve chain config
    if (typeof options.chain === 'string') {
      const config = CHAIN_CONFIGS[options.chain];
      if (!config) {
        throw new Error(`Unknown chain: ${options.chain}. Available: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
      }
      this.config = config;
    } else {
      this.config = options.chain;
    }

    // Set up provider
    if (options.signer) {
      this.signer = options.signer;
      this.provider = options.signer.provider!;
    } else if (options.provider) {
      this.provider = options.provider;
    } else {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    }

    // Initialize contracts
    const signerOrProvider = this.signer || this.provider;
    this.solverRegistry = new Contract(
      this.config.solverRegistry,
      SOLVER_REGISTRY_ABI,
      signerOrProvider
    );
    this.intentReceiptHub = new Contract(
      this.config.intentReceiptHub,
      INTENT_RECEIPT_HUB_ABI,
      signerOrProvider
    );
    this.disputeModule = new Contract(
      this.config.disputeModule,
      DISPUTE_MODULE_ABI,
      signerOrProvider
    );
  }

  // ============ Solver Registry - Read ============

  /**
   * Get solver information
   */
  async getSolver(address: string): Promise<SolverInfo> {
    const data = await this.solverRegistry.solvers(address);
    return {
      bondAmount: data.bondAmount,
      lockedAmount: data.lockedAmount,
      reputation: data.reputation,
      registrationTime: data.registrationTime,
      lastActiveTime: data.lastActiveTime,
      totalIntents: data.totalIntents,
      successfulIntents: data.successfulIntents,
      jailCount: Number(data.jailCount),
      status: Number(data.status) as SolverStatus,
      pendingWithdrawal: data.pendingWithdrawal,
      withdrawalRequestTime: data.withdrawalRequestTime,
    };
  }

  /**
   * Check if address is an active solver
   */
  async isActiveSolver(address: string): Promise<boolean> {
    return this.solverRegistry.isActiveSolver(address);
  }

  /**
   * Get solver's total bond amount
   */
  async getSolverBond(address: string): Promise<bigint> {
    return this.solverRegistry.getSolverBond(address);
  }

  /**
   * Get solver's available (unlocked) bond
   */
  async getAvailableBond(address: string): Promise<bigint> {
    return this.solverRegistry.getAvailableBond(address);
  }

  /**
   * Get minimum bond required for registration
   */
  async getMinimumBond(): Promise<bigint> {
    return this.solverRegistry.MINIMUM_BOND();
  }

  // ============ Solver Registry - Write ============

  /**
   * Register as a solver with initial bond
   * @param options.value - ETH to deposit as bond (must be >= MINIMUM_BOND)
   */
  async register(options: { value: bigint }): Promise<TransactionResponse> {
    this.requireSigner();
    return this.solverRegistry.register({ value: options.value });
  }

  /**
   * Deposit additional bond
   * @param options.value - ETH to deposit
   */
  async depositBond(options: { value: bigint }): Promise<TransactionResponse> {
    this.requireSigner();
    return this.solverRegistry.depositBond({ value: options.value });
  }

  /**
   * Request withdrawal of bond (starts cooldown)
   * @param amount - Amount to withdraw
   */
  async requestWithdrawal(amount: bigint): Promise<TransactionResponse> {
    this.requireSigner();
    return this.solverRegistry.requestWithdrawal(amount);
  }

  /**
   * Cancel pending withdrawal
   */
  async cancelWithdrawal(): Promise<TransactionResponse> {
    this.requireSigner();
    return this.solverRegistry.cancelWithdrawal();
  }

  /**
   * Execute withdrawal after cooldown
   */
  async executeWithdrawal(): Promise<TransactionResponse> {
    this.requireSigner();
    return this.solverRegistry.executeWithdrawal();
  }

  /**
   * Unjail solver by paying penalty
   * @param options.value - Unjail penalty amount
   */
  async unjail(options: { value: bigint }): Promise<TransactionResponse> {
    this.requireSigner();
    return this.solverRegistry.unjail({ value: options.value });
  }

  // ============ Intent Receipt Hub - Read ============

  /**
   * Get receipt by intent hash
   */
  async getReceipt(intentHash: string): Promise<IntentReceipt | null> {
    try {
      const data = await this.intentReceiptHub.getReceipt(intentHash);
      if (data.solver === ethers.ZeroAddress) return null;
      return {
        solver: data.solver,
        intentHash: data.intentHash,
        constraintsHash: data.constraintsHash,
        outcomeHash: data.outcomeHash,
        evidenceHash: data.evidenceHash,
        postedAt: data.postedAt,
        deadline: data.deadline,
        solverSig: data.solverSig,
        status: Number(data.status) as ReceiptStatus,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get challenge for an intent
   */
  async getChallenge(intentHash: string): Promise<Challenge | null> {
    try {
      const data = await this.intentReceiptHub.getChallenge(intentHash);
      if (data.challenger === ethers.ZeroAddress) return null;
      return {
        challenger: data.challenger,
        reason: Number(data.reason) as DisputeReason,
        bond: data.bond,
        timestamp: data.timestamp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get challenge window duration
   */
  async getChallengeWindow(): Promise<bigint> {
    return this.intentReceiptHub.challengeWindow();
  }

  // ============ Intent Receipt Hub - Write ============

  /**
   * Post a receipt for an executed intent
   */
  async postReceipt(params: PostReceiptParams): Promise<TransactionResponse> {
    this.requireSigner();
    return this.intentReceiptHub.postReceipt(
      params.intentHash,
      params.constraintsHash,
      params.outcomeHash,
      params.evidenceHash,
      params.deadline,
      params.solverSig
    );
  }

  /**
   * Challenge a receipt
   * @param intentHash - Hash of the intent to challenge
   * @param reason - Dispute reason code
   * @param options.value - Challenger bond (must meet minimum)
   */
  async challengeReceipt(
    intentHash: string,
    reason: DisputeReason,
    options: { value: bigint }
  ): Promise<TransactionResponse> {
    this.requireSigner();
    return this.intentReceiptHub.challengeReceipt(intentHash, reason, {
      value: options.value,
    });
  }

  /**
   * Finalize a receipt after challenge window
   */
  async finalizeReceipt(intentHash: string): Promise<TransactionResponse> {
    this.requireSigner();
    return this.intentReceiptHub.finalizeReceipt(intentHash);
  }

  // ============ Dispute Module - Read ============

  /**
   * Get dispute details
   */
  async getDispute(intentHash: string): Promise<any | null> {
    try {
      const data = await this.disputeModule.getDispute(intentHash);
      if (data.challenger === ethers.ZeroAddress) return null;
      return data;
    } catch {
      return null;
    }
  }

  // ============ Dispute Module - Write ============

  /**
   * Submit evidence for a dispute
   */
  async submitEvidence(
    intentHash: string,
    evidenceHash: string
  ): Promise<TransactionResponse> {
    this.requireSigner();
    return this.disputeModule.submitEvidence(intentHash, evidenceHash);
  }

  /**
   * Escalate dispute to arbitration
   */
  async escalateToArbitration(intentHash: string): Promise<TransactionResponse> {
    this.requireSigner();
    return this.disputeModule.escalateToArbitration(intentHash);
  }

  // ============ Utilities ============

  /**
   * Create a signed receipt for posting
   */
  async signReceipt(params: {
    intentHash: string;
    constraintsHash: string;
    outcomeHash: string;
    evidenceHash: string;
    deadline: bigint;
  }): Promise<string> {
    this.requireSigner();

    const message = ethers.solidityPackedKeccak256(
      ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint64'],
      [
        params.intentHash,
        params.constraintsHash,
        params.outcomeHash,
        params.evidenceHash,
        params.deadline,
      ]
    );

    return this.signer!.signMessage(ethers.getBytes(message));
  }

  /**
   * Calculate required challenger bond for a slash amount
   */
  calculateChallengerBond(slashAmount: bigint): bigint {
    return (slashAmount * BigInt(CONSTANTS.CHALLENGER_BOND_BPS)) / BigInt(10000);
  }

  /**
   * Get contract addresses
   */
  getAddresses() {
    return {
      solverRegistry: this.config.solverRegistry,
      intentReceiptHub: this.config.intentReceiptHub,
      disputeModule: this.config.disputeModule,
    };
  }

  // ============ Wallet API Methods ============

  /**
   * Get wallet API instance for subgraph queries
   * @param subgraphUrl - Optional custom subgraph URL
   */
  getWalletApi(subgraphUrl?: string): WalletApi {
    const url = subgraphUrl || SUBGRAPH_URLS[this.config.chainId === 11155111 ? 'sepolia' : 'mainnet'];
    return new WalletApi(url);
  }

  /**
   * Get risk score for a solver (wallet-grade API)
   * @param executor - Solver address or ID
   * @param subgraphUrl - Optional custom subgraph URL
   */
  async getRiskScore(executor: string, subgraphUrl?: string): Promise<RiskScore> {
    const api = this.getWalletApi(subgraphUrl);
    return api.getRiskScore(executor);
  }

  /**
   * Get recent receipts for a solver (wallet-grade API)
   * @param executor - Solver address or ID
   * @param limit - Maximum receipts to return
   * @param subgraphUrl - Optional custom subgraph URL
   */
  async getRecentReceipts(
    executor: string,
    limit: number = 10,
    subgraphUrl?: string
  ): Promise<RecentReceiptsResponse> {
    const api = this.getWalletApi(subgraphUrl);
    return api.getRecentReceipts(executor, limit);
  }

  /**
   * Get active bond status for a solver (wallet-grade API)
   * @param executor - Solver address or ID
   * @param subgraphUrl - Optional custom subgraph URL
   */
  async getActiveBond(executor: string, subgraphUrl?: string): Promise<BondStatus> {
    const api = this.getWalletApi(subgraphUrl);
    return api.getActiveBond(executor);
  }

  /**
   * Check if solver is safe to use (combined metrics check)
   * @param executor - Solver address or ID
   * @param subgraphUrl - Optional custom subgraph URL
   */
  async isSolverSafe(executor: string, subgraphUrl?: string): Promise<boolean> {
    const api = this.getWalletApi(subgraphUrl);
    return api.isSolverSafe(executor);
  }

  private requireSigner(): void {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }
  }
}
