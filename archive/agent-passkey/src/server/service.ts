/**
 * Signing Service
 *
 * Orchestrates Lit Protocol signing, policy enforcement, and audit artifacts.
 * Uses threshold signatures - no single point of key compromise.
 */

import pino from 'pino';
import { LitSigner, type LitSignerConfig, type LitNetwork } from '../signing/lit-signer.js';
import { TxBuilder, type TxConfig } from '../signing/tx-builder.js';
import { PolicyEngine, createDefaultPolicyConfig, type PolicyConfig } from '../policy/engine.js';
import { createAuditArtifact } from '../audit/artifact.js';
import { addToContractAllowlist } from '../policy/allowlists.js';
import type { SigningRequest, SigningResponse, SigningError } from '../types/signing-request.js';
import type { AuditArtifact } from '../types/audit-artifact.js';

const logger = pino({ name: 'signing-service' });

/**
 * Service configuration
 */
export interface ServiceConfig {
  /**
   * Lit Protocol configuration (optional - if not provided, signing is disabled)
   */
  lit?: LitSignerConfig;

  /**
   * Policy configuration overrides
   */
  policy?: Partial<PolicyConfig>;

  /**
   * IRSB contract addresses by chain ID
   */
  irsbContracts: Map<number, string>;

  /**
   * Default gas limit for transactions
   */
  defaultGasLimit: bigint;

  /**
   * Use EIP-1559 transactions
   */
  useEip1559: boolean;
}

/**
 * Signing result
 */
export interface SigningResult {
  success: true;
  response: SigningResponse;
  artifact: AuditArtifact;
}

/**
 * Signing failure
 */
export interface SigningFailure {
  success: false;
  error: SigningError;
  artifact?: AuditArtifact;
}

export type SigningOutcome = SigningResult | SigningFailure;

/**
 * Core signing service using Lit Protocol
 */
export class SigningService {
  private readonly signer: LitSigner | null;
  private readonly txBuilder: TxBuilder;
  private readonly policyEngine: PolicyEngine;
  private readonly config: ServiceConfig;
  private signerAddress: string | null = null;
  private connected = false;

  constructor(config: ServiceConfig) {
    this.config = config;

    // Initialize Lit signer if configured
    if (config.lit) {
      this.signer = new LitSigner(config.lit);
      logger.info({ network: config.lit.network }, 'Lit Protocol signer initialized');
    } else {
      this.signer = null;
      logger.warn('Lit Protocol not configured - signing disabled');
    }

    // Initialize tx builder
    this.txBuilder = new TxBuilder();

    // Initialize policy engine
    const policyConfig = createDefaultPolicyConfig(config.policy);

    // Add IRSB contracts to allowlist
    for (const [chainId, address] of config.irsbContracts) {
      addToContractAllowlist(policyConfig.allowlists, address, chainId, 'IRSB Protocol');
    }

    this.policyEngine = new PolicyEngine(policyConfig);
  }

  /**
   * Connect to Lit network
   */
  async connect(): Promise<void> {
    if (this.connected || !this.signer) {
      return;
    }

    await this.signer.connect();
    this.connected = true;
  }

  /**
   * Get the signer's Ethereum address (PKP address)
   *
   * Does not require a Lit network session — address is derived
   * from the PKP public key using ethers.computeAddress().
   */
  async getAddress(): Promise<string | null> {
    if (!this.signer) {
      return null;
    }

    if (!this.signerAddress) {
      this.signerAddress = await this.signer.getAddress();
    }

    return this.signerAddress;
  }

  /**
   * Check if signing is enabled
   */
  isSigningEnabled(): boolean {
    return this.signer !== null;
  }

  /**
   * Get signing backend type
   */
  getSignerType(): 'lit-protocol' | 'none' {
    return this.signer ? 'lit-protocol' : 'none';
  }

  /**
   * Get policy version
   */
  getPolicyVersion(): string {
    return this.policyEngine.version;
  }

  /**
   * Process a signing request
   */
  async sign(request: SigningRequest): Promise<SigningOutcome> {
    // Run policy checks
    const policyResult = await this.policyEngine.check(request);

    // Create audit artifact (without signature yet)
    let artifact = createAuditArtifact({
      request,
      policyVersion: this.policyEngine.version,
      checks: policyResult.checks,
      decision: policyResult.decision,
    });

    // Log decision
    logger.info(
      {
        auditId: artifact.auditId,
        requestId: request.requestId,
        agentId: request.agentId,
        action: request.action.action,
        decision: policyResult.decision,
      },
      'Policy decision'
    );

    // Check policy result
    if (policyResult.decision === 'DENY') {
      return {
        success: false,
        error: {
          requestId: request.requestId,
          code: 'POLICY_DENIED',
          message: 'Request denied by policy',
          details: {
            checks: policyResult.checks.filter((c) => !c.passed),
          },
          auditId: artifact.auditId,
        },
        artifact,
      };
    }

    // Check if signing is enabled
    if (!this.signer) {
      return {
        success: false,
        error: {
          requestId: request.requestId,
          code: 'INTERNAL_ERROR',
          message: 'Signing not configured',
          auditId: artifact.auditId,
        },
        artifact,
      };
    }

    try {
      // Ensure connected to Lit network
      await this.connect();

      // Build and sign transaction
      const txConfig: TxConfig = this.config.useEip1559
        ? {
            chainId: request.chainId,
            to: request.to,
            value: BigInt(request.value),
            gasLimit: this.config.defaultGasLimit,
            type: 'eip1559',
            maxFeePerGas: BigInt('50000000000'), // 50 gwei
            maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
          }
        : {
            chainId: request.chainId,
            to: request.to,
            value: BigInt(request.value),
            gasLimit: this.config.defaultGasLimit,
            type: 'legacy',
            gasPrice: BigInt('20000000000'), // 20 gwei
          };

      const tx = await this.txBuilder.buildTransaction(
        this.signer,
        request.action,
        txConfig,
        request.requestId
      );

      // Record the signing for rate limiting
      this.policyEngine.recordSigning(request);

      // Update artifact with signature info
      artifact = {
        ...artifact,
        signatureHash: tx.txHash,
        txHash: tx.txHash,
      };

      const response: SigningResponse = {
        requestId: request.requestId,
        signedTx: tx.signedTx,
        txHash: tx.txHash,
        auditId: artifact.auditId,
        signedAt: Date.now(),
      };

      logger.info(
        {
          auditId: artifact.auditId,
          txHash: tx.txHash,
          nonce: tx.nonce,
          signerType: 'lit-protocol',
        },
        'Transaction signed via Lit Protocol'
      );

      return {
        success: true,
        response,
        artifact,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: message, requestId: request.requestId }, 'Signing failed');

      return {
        success: false,
        error: {
          requestId: request.requestId,
          code: 'INTERNAL_ERROR',
          message: `Signing failed: ${message}`,
          auditId: artifact.auditId,
        },
        artifact,
      };
    }
  }

  /**
   * Disconnect from Lit network
   */
  async disconnect(): Promise<void> {
    if (this.signer) {
      await this.signer.disconnect();
      this.connected = false;
    }
  }
}

/**
 * Create service from environment variables
 */
export function createServiceFromEnv(): SigningService {
  // Lit Protocol config (optional)
  const litNetwork = process.env['LIT_NETWORK'] as LitNetwork | undefined;
  const litAuthKey = process.env['LIT_AUTH_PRIVATE_KEY'];
  const litPkpPublicKey = process.env['LIT_PKP_PUBLIC_KEY'];

  let lit: LitSignerConfig | undefined;
  if (litAuthKey) {
    lit = {
      network: litNetwork ?? 'naga-dev',
      authPrivateKey: litAuthKey,
      sessionExpirationSeconds: parseInt(process.env['LIT_SESSION_EXPIRY'] ?? '3600', 10),
    };
    if (litPkpPublicKey !== undefined) {
      lit.pkpPublicKey = litPkpPublicKey;
    }
  }

  // IRSB contracts
  const irsbContracts = new Map<number, string>();
  const mainnetContract = process.env['IRSB_CONTRACT_MAINNET'];
  const sepoliaContract = process.env['IRSB_CONTRACT_SEPOLIA'];

  if (mainnetContract) {
    irsbContracts.set(1, mainnetContract);
  }
  if (sepoliaContract) {
    irsbContracts.set(11155111, sepoliaContract);
  }

  // Default gas limit
  const defaultGasLimit = BigInt(process.env['DEFAULT_GAS_LIMIT'] ?? '200000');

  // Transaction type
  const useEip1559 = process.env['USE_EIP1559'] !== 'false';

  // Build config
  const config: ServiceConfig = {
    irsbContracts,
    defaultGasLimit,
    useEip1559,
  };

  if (lit !== undefined) {
    config.lit = lit;
  }

  return new SigningService(config);
}
