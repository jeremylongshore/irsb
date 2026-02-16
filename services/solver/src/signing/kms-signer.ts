/**
 * Cloud KMS Signer for IRSB Solver
 *
 * Direct signing via GCP Cloud KMS, replacing the agent-passkey
 * HTTP service for on-chain transaction signing.
 *
 * Benefits over agent-passkey:
 * - No network dependency on Lit Protocol
 * - Sub-100ms signing latency (vs 1-2s with Lit TEE)
 * - Keys never leave Google HSMs
 * - IAM-based access control with audit logging
 *
 * Environment variables:
 * - KMS_PROJECT_ID: GCP project ID
 * - KMS_LOCATION: Key location (default: us-central1)
 * - KMS_KEYRING: Keyring name
 * - KMS_KEY: Key name
 * - KMS_KEY_VERSION: Key version (default: 1)
 */

import { KeyManagementServiceClient } from '@google-cloud/kms';
import crypto from 'node:crypto';
import { keccak256 as viemKeccak256, toHex } from 'viem';

/** Ethereum hex string (0x-prefixed) */
type Hex = `0x${string}`;

/**
 * KMS Signer configuration
 */
export interface KmsSignerConfig {
  /** GCP project ID */
  projectId: string;

  /** KMS location (e.g., 'us-central1') */
  location: string;

  /** KMS keyring name */
  keyring: string;

  /** KMS key name */
  key: string;

  /** KMS key version (default: '1') */
  keyVersion?: string;

  /** Chain ID for transaction signing */
  chainId: number;
}

/**
 * Signing result
 */
export interface KmsSigningResult {
  /** Whether signing succeeded */
  success: boolean;

  /** Signed transaction hex */
  signedTx?: Hex;

  /** Transaction hash */
  txHash?: Hex;

  /** Signer address */
  signerAddress?: Hex;

  /** Error message if failed */
  error?: string;
}

/** secp256k1 curve order (n) */
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const SECP256K1_HALF_N = SECP256K1_N / 2n;

/**
 * Cloud KMS Signer
 *
 * Signs transactions using GCP Cloud KMS secp256k1 keys.
 *
 * @example
 * ```typescript
 * const signer = new KmsSigner({
 *   projectId: 'irsb-protocol',
 *   location: 'us-central1',
 *   keyring: 'irsb-signing',
 *   key: 'solver-key',
 *   chainId: 11155111,
 * });
 *
 * const address = await signer.getSignerAddress();
 * const result = await signer.signDigest(digest);
 * ```
 */
export class KmsSigner {
  private config: Required<KmsSignerConfig>;
  private client: KeyManagementServiceClient;
  private cachedAddress: Hex | null = null;
  private cachedPublicKey: Buffer | null = null;

  constructor(config: KmsSignerConfig) {
    this.config = {
      ...config,
      keyVersion: config.keyVersion ?? '1',
    };
    this.client = new KeyManagementServiceClient();
  }

  /**
   * Get the KMS key resource name
   */
  getKeyResourceName(): string {
    const { projectId, location, keyring, key, keyVersion } = this.config;
    return `projects/${projectId}/locations/${location}/keyRings/${keyring}/cryptoKeys/${key}/cryptoKeyVersions/${keyVersion}`;
  }

  /**
   * Get the uncompressed secp256k1 public key from KMS
   * Returns 65-byte uncompressed key (04 || x || y)
   */
  async getPublicKeyBytes(): Promise<Buffer> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const [publicKey] = await this.client.getPublicKey({
      name: this.getKeyResourceName(),
    });

    if (!publicKey.pem) {
      throw new Error('KMS returned empty public key');
    }

    // Parse PEM to DER SubjectPublicKeyInfo
    const raw = crypto.createPublicKey(publicKey.pem).export({
      type: 'spki',
      format: 'der',
    });

    // The uncompressed point is the last 65 bytes
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
  async getSignerAddress(): Promise<Hex> {
    if (this.cachedAddress) return this.cachedAddress;

    const publicKeyBytes = await this.getPublicKeyBytes();
    // keccak256 of the 64-byte public key (without 0x04 prefix)
    const hash = viemKeccak256(toHex(publicKeyBytes.subarray(1)));
    // Take last 20 bytes (last 40 hex chars)
    const address = `0x${hash.slice(hash.length - 40)}` as Hex;
    this.cachedAddress = address;
    return address;
  }

  /**
   * Sign a keccak256 digest using KMS
   *
   * 1. Call asymmetricSign with the digest
   * 2. Parse DER signature to (r, s)
   * 3. Normalize s to low-S form (EIP-2)
   * 4. Compute recovery parameter (v)
   */
  async signDigest(digest: Hex): Promise<{ r: Hex; s: Hex; v: number }> {
    const digestBuffer = Buffer.from(digest.slice(2), 'hex');

    if (digestBuffer.length !== 32) {
      throw new Error(`Expected 32-byte digest, got ${digestBuffer.length}`);
    }

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

    // Determine v by verifying signature
    const publicKey = await this.getPublicKeyBytes();
    const v = computeRecoveryV(digestBuffer, r, s, sNormalized, publicKey);

    return {
      r: `0x${r.toString(16).padStart(64, '0')}` as Hex,
      s: `0x${s.toString(16).padStart(64, '0')}` as Hex,
      v,
    };
  }

  /**
   * Check if the KMS key is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.getSignerAddress();
      return true;
    } catch {
      return false;
    }
  }
}

// ============ DER Parsing ============

/**
 * Parse a DER-encoded ECDSA signature into (r, s) bigints
 */
function parseDerSignature(der: Buffer): { r: bigint; s: bigint } {
  const tag = der[0];
  if (tag !== 0x30) {
    throw new Error(`Invalid DER: expected 0x30, got 0x${(tag ?? 0).toString(16)}`);
  }

  let offset = 2; // skip SEQUENCE tag + length

  // Parse r INTEGER
  const rTag = der[offset];
  if (rTag !== 0x02) {
    throw new Error(`Invalid DER: expected 0x02 for r, got 0x${(rTag ?? 0).toString(16)}`);
  }
  offset++;
  const rLen = der[offset] ?? 0;
  offset++;
  const rBytes = der.subarray(offset, offset + rLen);
  offset += rLen;

  // Parse s INTEGER
  const sTag = der[offset];
  if (sTag !== 0x02) {
    throw new Error(`Invalid DER: expected 0x02 for s, got 0x${(sTag ?? 0).toString(16)}`);
  }
  offset++;
  const sLen = der[offset] ?? 0;
  offset++;
  const sBytes = der.subarray(offset, offset + sLen);

  const r = BigInt(`0x${Buffer.from(rBytes).toString('hex')}`);
  const s = BigInt(`0x${Buffer.from(sBytes).toString('hex')}`);

  return { r, s };
}

// ============ Signature Verification ============

/**
 * Compute the Ethereum recovery parameter v (27 or 28).
 *
 * We verify the signature is valid using Node.js crypto.verify,
 * then determine v based on whether s was normalized.
 */
function computeRecoveryV(
  digest: Buffer,
  r: bigint,
  s: bigint,
  sWasNormalized: boolean,
  publicKey: Buffer,
): number {
  // For verification, use the original s (before normalization)
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

  // Normalizing s flips the recovery ID
  return sWasNormalized ? 28 : 27;
}

// ============ ASN.1 DER Helpers ============

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
  if ((trimmed[0] ?? 0) & 0x80) {
    trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
  }
  return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
}

/**
 * Build SubjectPublicKeyInfo DER for secp256k1 uncompressed key
 */
function buildSpkiDer(uncompressedKey: Buffer): Buffer {
  // OID for EC public key: 1.2.840.10045.2.1
  const ecOid = Buffer.from([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
  // OID for secp256k1: 1.3.132.0.10
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
 * Create a KMS signer from resolved config
 */
export function createKmsSigner(config: {
  KMS_PROJECT_ID?: string;
  KMS_LOCATION: string;
  KMS_KEYRING?: string;
  KMS_KEY?: string;
  KMS_KEY_VERSION: string;
  CHAIN_ID: number;
}): KmsSigner {
  const projectId = config.KMS_PROJECT_ID;
  const keyring = config.KMS_KEYRING;
  const key = config.KMS_KEY;

  if (!projectId || !keyring || !key) {
    throw new Error(
      'KMS signer requires KMS_PROJECT_ID, KMS_KEYRING, and KMS_KEY in config'
    );
  }

  return new KmsSigner({
    projectId,
    location: config.KMS_LOCATION,
    keyring,
    key,
    keyVersion: config.KMS_KEY_VERSION,
    chainId: config.CHAIN_ID,
  });
}
