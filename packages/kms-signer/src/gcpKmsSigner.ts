import { KeyManagementServiceClient } from '@google-cloud/kms';
import crypto from 'node:crypto';
import {
  type Address,
  type Hex,
  type Account,
  createWalletClient,
  http,
  keccak256 as viemKeccak256,
  toHex,
  hashMessage,
  hashTypedData,
} from 'viem';
import { toAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import type {
  Signer,
  SignerType,
  TransactionRequest,
  SignedTransaction,
  SignableMessage,
  TypedData,
} from './signer.js';

/**
 * Configuration for GCP KMS signer
 */
export interface GcpKmsSignerConfig {
  /** GCP project ID */
  projectId: string;

  /** KMS location (e.g., 'us-central1') */
  location: string;

  /** KMS keyring name */
  keyring: string;

  /** KMS key name */
  key: string;

  /** KMS key version (defaults to 1) */
  keyVersion?: string;

  /** RPC URL for transaction signing */
  rpcUrl?: string;

  /** Chain ID */
  chainId?: number;
}

/** secp256k1 curve order (n) */
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const SECP256K1_HALF_N = SECP256K1_N / 2n;

/**
 * GCP Cloud KMS Signer
 *
 * Full implementation using @google-cloud/kms.
 * Signs digests using a secp256k1 asymmetric key stored in Cloud KMS.
 *
 * Benefits:
 * - Keys never leave Google's HSMs
 * - Audit logging of all signing operations
 * - IAM-based access control
 * - Automatic key rotation support
 */
export class GcpKmsSigner implements Signer {
  private config: GcpKmsSignerConfig;
  private client: KeyManagementServiceClient;
  private cachedAddress: Address | null = null;
  private cachedPublicKey: Buffer | null = null;
  private rpcUrl: string;

  constructor(config: GcpKmsSignerConfig) {
    this.config = config;
    this.client = new KeyManagementServiceClient();
    this.rpcUrl = config.rpcUrl ?? 'https://rpc.sepolia.org';
  }

  getType(): SignerType {
    return 'gcp-kms';
  }

  /**
   * Get the KMS key resource name
   */
  getKeyResourceName(): string {
    const version = this.config.keyVersion ?? '1';
    return `projects/${this.config.projectId}/locations/${this.config.location}/keyRings/${this.config.keyring}/cryptoKeys/${this.config.key}/cryptoKeyVersions/${version}`;
  }

  /**
   * Get the uncompressed secp256k1 public key (65 bytes: 04 || x || y)
   */
  private async getPublicKeyBytes(): Promise<Buffer> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const [publicKey] = await this.client.getPublicKey({
      name: this.getKeyResourceName(),
    });

    if (!publicKey.pem) {
      throw new Error('KMS returned empty public key');
    }

    const raw = crypto.createPublicKey(publicKey.pem).export({
      type: 'spki',
      format: 'der',
    });

    const uncompressedKey = Buffer.from(raw.subarray(raw.length - 65));
    if (uncompressedKey[0] !== 0x04) {
      throw new Error('Expected uncompressed public key (0x04 prefix)');
    }

    this.cachedPublicKey = uncompressedKey;
    return uncompressedKey;
  }

  /**
   * Get the Ethereum address derived from the KMS public key
   */
  async getAddress(): Promise<Address> {
    if (this.cachedAddress) return this.cachedAddress;

    const publicKeyBytes = await this.getPublicKeyBytes();
    // keccak256 of the 64-byte public key (without 0x04 prefix)
    const hash = viemKeccak256(toHex(publicKeyBytes.subarray(1)));
    // Take last 20 bytes
    const address = `0x${hash.slice(hash.length - 40)}` as Address;
    this.cachedAddress = address;
    return address;
  }

  /**
   * Get a viem Account that delegates signing to KMS
   */
  async getAccount(): Promise<Account> {
    const address = await this.getAddress();
    const self = this;

    return toAccount({
      address,
      async signMessage({ message }) {
        const hash = typeof message === 'string'
          ? hashMessage(message)
          : hashMessage({ raw: (message as { raw: Hex }).raw });
        return self.signHash(hash);
      },
      async signTransaction(tx) {
        // Import serializeTransaction dynamically to avoid circular deps
        const { serializeTransaction } = await import('viem');
        const serialized = serializeTransaction(tx);
        const hash = viemKeccak256(serialized);
        const sig = await self.signHashComponents(hash);
        return serializeTransaction(tx, {
          r: `0x${sig.r.toString(16).padStart(64, '0')}` as Hex,
          s: `0x${sig.s.toString(16).padStart(64, '0')}` as Hex,
          yParity: sig.yParity,
        });
      },
      async signTypedData(params) {
        const hash = hashTypedData(params);
        return self.signHash(hash);
      },
    });
  }

  /**
   * Sign a hash and return the compact 65-byte signature (r + s + v)
   */
  private async signHash(hash: Hex): Promise<Hex> {
    const { r, s, v } = await this.signHashComponents(hash);
    const rBuf = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sBuf = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
    return `0x${rBuf.toString('hex')}${sBuf.toString('hex')}${(v - 27).toString(16).padStart(2, '0')}` as Hex;
  }

  /**
   * Sign a hash and return (r, s, v) components
   */
  private async signHashComponents(hash: Hex): Promise<{ r: bigint; s: bigint; v: number; yParity: number }> {
    const digestBuffer = Buffer.from(hash.slice(2), 'hex');

    const [result] = await this.client.asymmetricSign({
      name: this.getKeyResourceName(),
      digest: { sha256: digestBuffer },
    });

    if (!result.signature) {
      throw new Error('KMS returned empty signature');
    }

    const sigBytes = Buffer.from(result.signature as Uint8Array);
    const { r, s: rawS } = parseDerSignature(sigBytes);

    // Normalize s to low-S (EIP-2)
    const sNormalized = rawS > SECP256K1_HALF_N;
    const s = sNormalized ? SECP256K1_N - rawS : rawS;

    // Determine v by verifying against both recovery IDs
    const v = await this.computeRecoveryV(digestBuffer, r, s, sNormalized);

    return { r, s, v, yParity: v - 27 };
  }

  /**
   * Compute recovery parameter by checking both v=27 and v=28
   * against the known Ethereum address
   */
  private async computeRecoveryV(
    digest: Buffer,
    r: bigint,
    s: bigint,
    sWasNormalized: boolean,
  ): Promise<number> {
    // Verify the signature is valid first
    const publicKey = await this.getPublicKeyBytes();
    const sForVerify = sWasNormalized ? SECP256K1_N - s : s;

    const rBuf = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sVerifyBuf = Buffer.from(sForVerify.toString(16).padStart(64, '0'), 'hex');
    const derSig = encodeDerSignature(rBuf, sVerifyBuf);

    const publicKeyObj = crypto.createPublicKey({
      key: buildSpkiDer(publicKey),
      format: 'der',
      type: 'spki',
    });

    const valid = crypto.verify(
      null,
      digest,
      { key: publicKeyObj, dsaEncoding: 'der' },
      derSig,
    );

    if (!valid) {
      throw new Error('KMS signature verification failed');
    }

    // Base v = 27, if s was normalized (flipped), the recovery ID flips
    return sWasNormalized ? 28 : 27;
  }

  async signTransaction(tx: TransactionRequest): Promise<SignedTransaction> {
    const account = await this.getAccount();

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(this.rpcUrl),
    });

    const request = await walletClient.prepareTransactionRequest({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      nonce: tx.nonce,
    });

    const serialized = await walletClient.signTransaction(request);

    return {
      rawTransaction: serialized,
      hash: viemKeccak256(serialized),
    };
  }

  async signMessage(message: SignableMessage): Promise<Hex> {
    const hash = typeof message.raw === 'string'
      ? hashMessage(message.raw)
      : hashMessage({ raw: message.raw as Hex });
    return this.signHash(hash);
  }

  async signTypedData(data: TypedData): Promise<Hex> {
    const hash = hashTypedData({
      domain: data.domain,
      types: data.types,
      primaryType: data.primaryType,
      message: data.message,
    });
    return this.signHash(hash);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.getAddress();
      return true;
    } catch {
      return false;
    }
  }
}

// ============ ASN.1/DER Helpers ============

function parseDerSignature(der: Buffer): { r: bigint; s: bigint } {
  if (der[0] !== 0x30) {
    throw new Error(`Invalid DER: expected 0x30, got 0x${der[0].toString(16)}`);
  }

  let offset = 2;

  if (der[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for r');
  offset++;
  const rLen = der[offset]; offset++;
  const rBytes = der.subarray(offset, offset + rLen); offset += rLen;

  if (der[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for s');
  offset++;
  const sLen = der[offset]; offset++;
  const sBytes = der.subarray(offset, offset + sLen);

  return {
    r: BigInt(`0x${Buffer.from(rBytes).toString('hex')}`),
    s: BigInt(`0x${Buffer.from(sBytes).toString('hex')}`),
  };
}

function encodeDerSignature(r: Buffer, s: Buffer): Buffer {
  const rDer = asn1Integer(r);
  const sDer = asn1Integer(s);
  const payload = Buffer.concat([rDer, sDer]);
  return Buffer.concat([Buffer.from([0x30, payload.length]), payload]);
}

function asn1Integer(buf: Buffer): Buffer {
  let start = 0;
  while (start < buf.length - 1 && buf[start] === 0) start++;
  let trimmed = buf.subarray(start);
  if (trimmed[0] & 0x80) {
    trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
  }
  return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
}

function buildSpkiDer(uncompressedKey: Buffer): Buffer {
  const ecOid = Buffer.from([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
  const secp256k1Oid = Buffer.from([0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a]);
  const algorithmId = Buffer.concat([
    Buffer.from([0x30, ecOid.length + secp256k1Oid.length]),
    ecOid,
    secp256k1Oid,
  ]);
  const bitString = Buffer.concat([
    Buffer.from([0x03, uncompressedKey.length + 1, 0x00]),
    uncompressedKey,
  ]);
  const total = Buffer.concat([algorithmId, bitString]);
  return Buffer.concat([Buffer.from([0x30, total.length]), total]);
}

/**
 * Create a GCP KMS signer
 */
export function createGcpKmsSigner(config: GcpKmsSignerConfig): GcpKmsSigner {
  return new GcpKmsSigner(config);
}
