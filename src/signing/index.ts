/**
 * Signing module for IRSB Solver
 *
 * Uses Google Cloud KMS for on-chain transaction signing.
 */

export {
  KmsSigner,
  createKmsSigner,
  type KmsSignerConfig,
  type KmsSigningResult,
} from './kms-signer.js';
