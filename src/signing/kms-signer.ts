/**
 * GCP KMS Signer
 *
 * Signs messages using GCP Cloud KMS with secp256k1 keys.
 * Non-extractable keys - private key never leaves KMS.
 */

import { KeyManagementServiceClient } from '@google-cloud/kms';
import { keccak256, computeAddress } from 'ethers';
import { derToRsv, type EthSignature } from './der-to-rsv.js';
import pino from 'pino';

const logger = pino({ name: 'kms-signer' });

/**
 * KMS key configuration
 */
export interface KmsKeyConfig {
  /**
   * GCP project ID
   */
  projectId: string;

  /**
   * KMS location (e.g., 'us-central1')
   */
  location: string;

  /**
   * Key ring name
   */
  keyRing: string;

  /**
   * Key name
   */
  keyName: string;

  /**
   * Key version (default: '1')
   */
  keyVersion?: string;
}

/**
 * KMS signer for IRSB protocol
 */
export class KmsSigner {
  private readonly client: KeyManagementServiceClient;
  private readonly keyPath: string;
  private publicKey?: string;
  private address?: string;

  constructor(private readonly config: KmsKeyConfig) {
    this.client = new KeyManagementServiceClient();
    this.keyPath = this.buildKeyPath();
  }

  private buildKeyPath(): string {
    const version = this.config.keyVersion ?? '1';
    return (
      `projects/${this.config.projectId}/` +
      `locations/${this.config.location}/` +
      `keyRings/${this.config.keyRing}/` +
      `cryptoKeys/${this.config.keyName}/` +
      `cryptoKeyVersions/${version}`
    );
  }

  /**
   * Get the Ethereum address for this signer
   */
  async getAddress(): Promise<string> {
    if (this.address) {
      return this.address;
    }

    const publicKey = await this.getPublicKey();
    this.address = computeAddress(publicKey);

    logger.info({ address: this.address }, 'Resolved signer address');
    return this.address;
  }

  /**
   * Get the public key from KMS
   */
  async getPublicKey(): Promise<string> {
    if (this.publicKey) {
      return this.publicKey;
    }

    const [response] = await this.client.getPublicKey({ name: this.keyPath });

    if (!response.pem) {
      throw new Error('KMS returned empty public key');
    }

    // Parse PEM to get raw public key
    this.publicKey = this.pemToPublicKey(response.pem);

    logger.info({ keyPath: this.keyPath }, 'Retrieved public key from KMS');
    return this.publicKey;
  }

  /**
   * Sign a message hash using KMS
   */
  async sign(messageHash: string): Promise<EthSignature> {
    // Ensure we have the address for recovery
    const expectedAddress = await this.getAddress();

    // Convert message hash to bytes
    const digest = Buffer.from(messageHash.slice(2), 'hex');

    // Sign with KMS
    const [signResponse] = await this.client.asymmetricSign({
      name: this.keyPath,
      digest: { sha256: digest },
    });

    if (!signResponse.signature) {
      throw new Error('KMS returned empty signature');
    }

    // Convert DER signature to (r, s, v)
    const derHex = '0x' + Buffer.from(signResponse.signature).toString('hex');
    const signature = derToRsv(derHex, messageHash, expectedAddress);

    logger.debug(
      { messageHash, r: signature.r, s: signature.s, v: signature.v },
      'Signed message'
    );

    return signature;
  }

  /**
   * Sign a typed data hash (EIP-712)
   */
  async signTypedData(domainHash: string, structHash: string): Promise<EthSignature> {
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
   * Parse PEM-encoded public key to uncompressed format
   */
  private pemToPublicKey(pem: string): string {
    // Remove PEM headers and decode base64
    const base64 = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');

    const der = Buffer.from(base64, 'base64');

    // Skip DER header (26 bytes for secp256k1 public key)
    // Format: 30 56 30 10 ... 03 42 00 04 <x> <y>
    // Find the 0x04 prefix that marks uncompressed point
    let offset = 0;
    while (offset < der.length && der[offset] !== 0x04) {
      offset++;
    }

    if (offset >= der.length) {
      throw new Error('Could not find uncompressed public key in PEM');
    }

    // Return the 65-byte uncompressed public key (04 + 32 bytes x + 32 bytes y)
    const publicKey = der.slice(offset, offset + 65);
    return '0x' + publicKey.toString('hex');
  }
}

/**
 * Create a KMS signer from environment variables
 */
export function createKmsSignerFromEnv(): KmsSigner {
  const config: KmsKeyConfig = {
    projectId: requireEnv('KMS_PROJECT_ID'),
    location: requireEnv('KMS_LOCATION'),
    keyRing: requireEnv('KMS_KEY_RING'),
    keyName: requireEnv('KMS_KEY_NAME'),
    keyVersion: process.env['KMS_KEY_VERSION'] ?? '1',
  };

  return new KmsSigner(config);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
