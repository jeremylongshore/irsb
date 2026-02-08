/**
 * Lit Protocol Signer
 *
 * Signs messages using Lit Protocol's threshold signature network.
 * PKP (Programmable Key Pair) keys are distributed across TEE nodes -
 * no single node holds the full private key.
 *
 * This is the crypto-native, decentralized alternative to cloud KMS.
 *
 * MIGRATION: Datil (V0) networks shut down Feb 25, 2026.
 * Naga (V1) networks are the replacement:
 *   naga-dev (development), naga-test (testnet), naga (mainnet)
 * See: https://developer.litprotocol.com/network/migration
 */

import { keccak256, ethers, Signature } from 'ethers';
import pino from 'pino';
import type { Signer, EthSignature } from './signer.js';

// Re-export EthSignature from signer interface
export type { EthSignature } from './signer.js';

const logger = pino({ name: 'lit-signer' });

/**
 * Lit Protocol network options
 *
 * Naga (V1) networks - active:
 * - naga-dev: Development
 * - naga-test: Testnet
 * - naga: Mainnet
 *
 * Datil (V0) networks - deprecated, shutdown Feb 25, 2026:
 * - datil-dev, datil-test, datil
 */
export const VALID_LIT_NETWORKS = [
  'naga-dev', 'naga-test', 'naga',           // V1 (active)
  'datil-dev', 'datil-test', 'datil',         // V0 (deprecated, removed after Feb 25)
] as const;
export type LitNetwork = (typeof VALID_LIT_NETWORKS)[number];

/**
 * Validate network string is a valid LitNetwork
 */
export function isValidLitNetwork(network: string): network is LitNetwork {
  return VALID_LIT_NETWORKS.includes(network as LitNetwork);
}

/**
 * Lit signer configuration
 */
export interface LitSignerConfig {
  /**
   * Lit network to use
   */
  network: LitNetwork;

  /**
   * PKP public key (required for signing)
   * This is the uncompressed public key of the PKP.
   * If not provided, must call mintPkp() before signing.
   */
  pkpPublicKey?: string;

  /**
   * PKP token ID (NFT that controls the PKP)
   */
  pkpTokenId?: string;

  /**
   * Auth method for session creation
   * For server-side: use wallet auth with a controller key
   *
   * SECURITY: This key should be stored securely.
   * - Use secret management (GCP Secret Manager, AWS Secrets Manager, etc.)
   * - Never commit to version control
   * - Rotate periodically
   */
  authPrivateKey: string;

  /**
   * Session expiration in seconds (default: 1 hour, max: 24 hours)
   */
  sessionExpirationSeconds?: number;
}

/**
 * Lit Protocol signer for IRSB
 *
 * Uses PKP (Programmable Key Pairs) with threshold signatures.
 * 2/3 of Lit nodes must agree to sign - no single point of compromise.
 */
export class LitSigner implements Signer {
  private readonly config: LitSignerConfig;
  private pkpPublicKey: string | null = null;
  private ethAddress: string | null = null;
  private connected = false;
  private litNodeClient: unknown = null;
  private sessionSigs: unknown = null;

  constructor(config: LitSignerConfig) {
    this.config = config;
    this.pkpPublicKey = config.pkpPublicKey ?? null;

    // Log deprecation warning for Datil networks
    if (config.network.startsWith('datil')) {
      logger.warn(
        { network: config.network },
        'URGENT: Datil (V0) networks shut down Feb 25, 2026. ' +
          'Migrate to Naga networks: naga-dev, naga-test, or naga.'
      );
    }
  }

  /**
   * Connect to Lit network and establish session
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info({ network: this.config.network }, 'Connecting to Lit network');

    if (!this.config.authPrivateKey) {
      throw new Error('LIT_AUTH_PRIVATE_KEY required');
    }

    // Validate auth key is a valid private key
    let authWallet: ethers.Wallet;
    try {
      authWallet = new ethers.Wallet(this.config.authPrivateKey);
    } catch {
      throw new Error('Invalid LIT_AUTH_PRIVATE_KEY');
    }

    try {
      // Dynamic import for Lit Protocol SDK
      const { LitNodeClientNodeJs } = await import('@lit-protocol/lit-node-client-nodejs');

      // Create Lit client
      // Cast network: SDK v8 alpha only types 'naga-dev' | 'custom',
      // but we validate network values ourselves via VALID_LIT_NETWORKS
      this.litNodeClient = new LitNodeClientNodeJs({
        litNetwork: this.config.network as 'naga-dev',
        debug: false,
      });

      // Connect to the network
      await (this.litNodeClient as { connect: () => Promise<void> }).connect();

      // Create session signatures using the auth wallet
      const sessionExpiry = Math.min(this.config.sessionExpirationSeconds ?? 3600, 86400) * 1000; // Max 24 hours

      // Get session signatures
      // Note: This is a simplified flow. Production should use proper auth methods.
      const litClient = this.litNodeClient as {
        getSessionSigs: (params: {
          chain: string;
          resourceAbilityRequests: Array<{
            resource: { resource: string; resourcePrefix: string };
            ability: string;
          }>;
          authNeededCallback: (params: {
            uri: string;
            expiration: string;
            resourceAbilityRequests: unknown[];
          }) => Promise<{
            sig: string;
            derivedVia: string;
            signedMessage: string;
            address: string;
          }>;
          expiration: string;
        }) => Promise<unknown>;
      };

      const expiration = new Date(Date.now() + sessionExpiry).toISOString();

      this.sessionSigs = await litClient.getSessionSigs({
        chain: 'ethereum',
        resourceAbilityRequests: [
          {
            resource: {
              resource: '*',
              resourcePrefix: 'lit-pkp',
            },
            ability: 'pkp-signing',
          },
        ],
        authNeededCallback: async (params: {
          uri: string;
          expiration: string;
          resourceAbilityRequests: unknown[];
        }) => {
          const message = `I am signing this message to authenticate with Lit Protocol.\n\nURI: ${params.uri}\nExpiration: ${params.expiration}`;
          const signature = await authWallet.signMessage(message);
          return {
            sig: signature,
            derivedVia: 'web3.eth.personal.sign',
            signedMessage: message,
            address: authWallet.address,
          };
        },
        expiration,
      });

      this.connected = true;
      logger.info({ network: this.config.network, expiration }, 'Connected to Lit network');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to connect to Lit network');
      throw new Error(`Failed to connect to Lit network: ${message}`);
    }
  }

  /**
   * Get the Ethereum address for this signer's PKP
   */
  async getAddress(): Promise<string> {
    if (this.ethAddress) {
      return this.ethAddress;
    }

    if (!this.pkpPublicKey) {
      throw new Error('PKP public key not set. Provide pkpPublicKey in config or call mintPkp().');
    }

    // Validate hex format
    if (!this.pkpPublicKey.startsWith('0x')) {
      throw new Error('PKP public key must start with 0x');
    }

    // Derive Ethereum address from PKP public key
    this.ethAddress = ethers.computeAddress(this.pkpPublicKey);

    logger.info({ address: this.ethAddress }, 'Resolved PKP address');
    return this.ethAddress;
  }

  /**
   * Get the PKP public key
   */
  getPublicKey(): string | null {
    return this.pkpPublicKey;
  }

  /**
   * Check if signer is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Sign a message hash using Lit Protocol threshold signatures
   */
  async sign(messageHash: string): Promise<EthSignature> {
    await this.connect();

    if (!this.pkpPublicKey) {
      throw new Error('PKP public key not set');
    }

    // Validate hex format
    if (!messageHash.startsWith('0x')) {
      throw new Error('Message hash must start with 0x');
    }

    logger.debug({ messageHash }, 'Signing with PKP');

    try {
      const litClient = this.litNodeClient as {
        pkpSign: (params: {
          pubKey: string;
          toSign: Uint8Array;
          sessionSigs: unknown;
        }) => Promise<{ r: string; s: string; recid: number; signature: string }>;
      };

      // Convert hex to bytes
      const toSign = ethers.getBytes(messageHash);

      // Sign using Lit Protocol threshold signatures
      const sigResult = await litClient.pkpSign({
        pubKey: this.pkpPublicKey,
        toSign,
        sessionSigs: this.sessionSigs,
      });

      // Normalize signature to EIP-2 (low-s)
      const r = '0x' + sigResult.r;
      const s = '0x' + sigResult.s;
      const v = sigResult.recid + 27; // Convert recid to v

      // Create signature - ethers v6 auto-normalizes s to low-s
      const sig = Signature.from({ r, s, v });

      logger.debug({ r: sig.r, s: sig.s, v: sig.v }, 'Signature created');

      return {
        r: sig.r,
        s: sig.s,
        v: sig.v,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to sign with PKP');
      throw new Error(`Failed to sign with PKP: ${message}`);
    }
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(domainHash: string, structHash: string): Promise<EthSignature> {
    // Validate hex format
    if (!domainHash.startsWith('0x')) {
      throw new Error('Domain hash must start with 0x');
    }
    if (!structHash.startsWith('0x')) {
      throw new Error('Struct hash must start with 0x');
    }

    // EIP-712 message hash
    const messageHash = keccak256(
      Buffer.concat([
        Buffer.from([0x19, 0x01]),
        Buffer.from(domainHash.slice(2), 'hex'),
        Buffer.from(structHash.slice(2), 'hex'),
      ])
    );

    return this.sign(messageHash);
  }

  /**
   * Disconnect from Lit network
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.litNodeClient) {
      try {
        await (this.litNodeClient as { disconnect: () => Promise<void> }).disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.litNodeClient = null;
      this.sessionSigs = null;
      this.connected = false;
      logger.info('Disconnected from Lit network');
    }
  }
}

/**
 * Create a Lit signer from environment variables
 */
export function createLitSignerFromEnv(): LitSigner {
  const networkEnv = process.env['LIT_NETWORK'] ?? 'naga-dev';
  const authPrivateKey = process.env['LIT_AUTH_PRIVATE_KEY'];
  const pkpPublicKey = process.env['LIT_PKP_PUBLIC_KEY'];

  // Validate network
  if (!isValidLitNetwork(networkEnv)) {
    throw new Error(
      `Invalid LIT_NETWORK: ${networkEnv}. Valid values: ${VALID_LIT_NETWORKS.join(', ')}`
    );
  }

  if (!authPrivateKey) {
    throw new Error('LIT_AUTH_PRIVATE_KEY environment variable required');
  }

  // Validate session expiry is a valid number
  const sessionExpiryStr = process.env['LIT_SESSION_EXPIRY'] ?? '3600';
  const sessionExpiry = parseInt(sessionExpiryStr, 10);
  if (isNaN(sessionExpiry) || sessionExpiry <= 0) {
    throw new Error(`Invalid LIT_SESSION_EXPIRY: ${sessionExpiryStr}. Must be a positive number.`);
  }

  const config: LitSignerConfig = {
    network: networkEnv,
    authPrivateKey,
    sessionExpirationSeconds: sessionExpiry,
  };

  if (pkpPublicKey !== undefined) {
    config.pkpPublicKey = pkpPublicKey;
  }

  return new LitSigner(config);
}
