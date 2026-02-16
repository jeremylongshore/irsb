import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface WatchtowerKeyPair {
  publicKey: string;   // base64-encoded SPKI DER Ed25519 public key
  privateKey: string;  // base64-encoded PKCS8 DER private key
}

/**
 * Generate a new Ed25519 keypair.
 */
export function generateKeyPair(): WatchtowerKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' });
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  return {
    publicKey: pubRaw.toString('base64'),
    privateKey: privDer.toString('base64'),
  };
}

/**
 * Save a keypair to disk as JSON.
 */
export function saveKeyPair(path: string, kp: WatchtowerKeyPair): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(kp, null, 2) + '\n', 'utf-8');
}

/**
 * Load a keypair from disk.
 */
export function loadKeyPair(path: string): WatchtowerKeyPair {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as WatchtowerKeyPair;
}

/**
 * Check if a key file exists.
 */
export function keyFileExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Get the Node.js crypto KeyObject from a stored private key.
 */
export function getPrivateKeyObject(kp: WatchtowerKeyPair) {
  return createPrivateKey({
    key: Buffer.from(kp.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
}

/**
 * Get the Node.js crypto KeyObject from a stored public key.
 */
export function getPublicKeyObject(kp: WatchtowerKeyPair) {
  return createPublicKey({
    key: Buffer.from(kp.publicKey, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

/**
 * Get or create a keypair at the given path.
 */
export function ensureKeyPair(path: string): WatchtowerKeyPair {
  if (keyFileExists(path)) {
    return loadKeyPair(path);
  }
  const kp = generateKeyPair();
  saveKeyPair(path, kp);
  return kp;
}
