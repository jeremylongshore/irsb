/**
 * DER to (r, s, v) Conversion
 *
 * GCP KMS returns DER-encoded ECDSA signatures.
 * We need to convert to Ethereum's (r, s, v) format.
 */

import { Signature, recoverAddress } from 'ethers';

/**
 * secp256k1 curve order
 */
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

/**
 * Half of the curve order (for EIP-2 low-s normalization)
 */
const SECP256K1_N_DIV_2 = SECP256K1_N / BigInt(2);

/**
 * Parsed ECDSA signature components
 */
export interface EcdsaComponents {
  r: bigint;
  s: bigint;
}

/**
 * Ethereum signature with recovery id
 */
export interface EthSignature {
  r: string; // 32-byte hex
  s: string; // 32-byte hex
  v: number; // 27 or 28 (or EIP-155 variant)
}

/**
 * Parse DER-encoded ECDSA signature to (r, s) components
 *
 * DER format:
 * 0x30 <total-length> 0x02 <r-length> <r> 0x02 <s-length> <s>
 */
export function parseDer(derHex: string): EcdsaComponents {
  const bytes = hexToBytes(derHex);
  let offset = 0;

  // Sequence tag
  if (bytes[offset++] !== 0x30) {
    throw new Error('Invalid DER: expected SEQUENCE tag (0x30)');
  }

  // Total length (skip)
  const totalLen = bytes[offset++];
  if (totalLen === undefined || offset + totalLen > bytes.length) {
    throw new Error('Invalid DER: length mismatch');
  }

  // R component
  if (bytes[offset++] !== 0x02) {
    throw new Error('Invalid DER: expected INTEGER tag (0x02) for r');
  }

  const rLen = bytes[offset++];
  if (rLen === undefined) {
    throw new Error('Invalid DER: missing r length');
  }

  const rBytes = bytes.slice(offset, offset + rLen);
  offset += rLen;

  // S component
  if (bytes[offset++] !== 0x02) {
    throw new Error('Invalid DER: expected INTEGER tag (0x02) for s');
  }

  const sLen = bytes[offset++];
  if (sLen === undefined) {
    throw new Error('Invalid DER: missing s length');
  }

  const sBytes = bytes.slice(offset, offset + sLen);

  // Convert to bigint (remove leading zero if present for positive number)
  const r = bytesToBigInt(rBytes);
  const s = bytesToBigInt(sBytes);

  return { r, s };
}

/**
 * Normalize s to lower half of curve order (EIP-2)
 *
 * ECDSA signatures are malleable: both (r, s) and (r, n-s) are valid.
 * EIP-2 requires s to be in the lower half to prevent replay attacks.
 */
export function normalizeS(s: bigint): bigint {
  if (s > SECP256K1_N_DIV_2) {
    return SECP256K1_N - s;
  }
  return s;
}

/**
 * Check if s is in lower half (EIP-2 compliant)
 */
export function isLowS(s: bigint): boolean {
  return s <= SECP256K1_N_DIV_2;
}

/**
 * Convert DER signature to Ethereum format with recovery id
 *
 * This function:
 * 1. Parses DER to (r, s)
 * 2. Normalizes s to low-s (EIP-2)
 * 3. Computes recovery id (v) by trial recovery
 */
export function derToRsv(
  derHex: string,
  messageHash: string,
  expectedAddress: string
): EthSignature {
  // Parse DER
  const { r, s: rawS } = parseDer(derHex);

  // Normalize s to low-s
  const s = normalizeS(rawS);

  // Format r and s as 32-byte hex
  const rHex = bigIntToHex(r, 32);
  const sHex = bigIntToHex(s, 32);

  // Try recovery with v=27 and v=28
  for (const v of [27, 28]) {
    try {
      const sig = Signature.from({ r: rHex, s: sHex, v });
      const recovered = recoverAddress(messageHash, sig);

      if (recovered.toLowerCase() === expectedAddress.toLowerCase()) {
        return { r: rHex, s: sHex, v };
      }
    } catch {
      // Try next v value
    }
  }

  throw new Error('Could not recover signer address with either v=27 or v=28');
}

/**
 * Convert signature to EIP-155 format
 */
export function toEip155Signature(sig: EthSignature, chainId: number): EthSignature {
  // EIP-155: v = chainId * 2 + 35 + (v - 27)
  const v = chainId * 2 + 35 + (sig.v - 27);
  return { r: sig.r, s: sig.s, v };
}

/**
 * Convert signature to serialized format for transaction
 */
export function serializeSignature(sig: EthSignature): string {
  // Concatenate r + s + v (65 bytes)
  const rBytes = hexToBytes(sig.r);
  const sBytes = hexToBytes(sig.s);
  const vByte = sig.v;

  const result = new Uint8Array(65);
  result.set(rBytes, 0);
  result.set(sBytes, 32);
  result[64] = vByte;

  return bytesToHex(result);
}

// Helper functions

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = '0x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return BigInt(hex);
}

function bigIntToHex(n: bigint, length: number): string {
  const hex = n.toString(16).padStart(length * 2, '0');
  return '0x' + hex;
}
