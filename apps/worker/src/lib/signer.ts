/**
 * Signer builder utility for the watchtower worker.
 * Creates a Signer instance based on the config type.
 */

import type { Signer } from '@irsb-watchtower/signers';
import type { SignerConfig } from '@irsb-watchtower/config';

/**
 * Build a Signer instance from config
 */
export async function buildSigner(config: SignerConfig, _rpcUrl?: string): Promise<Signer> {
  switch (config.type) {
    case 'local': {
      const { createLocalSigner } = await import('@irsb-watchtower/signers');
      return createLocalSigner({
        privateKey: config.privateKey as `0x${string}`,
        rpcUrl: _rpcUrl,
      });
    }

    case 'gcp-kms': {
      const { createGcpKmsSigner } = await import('@irsb-watchtower/signers');
      return createGcpKmsSigner({
        projectId: config.projectId,
        location: config.location,
        keyring: config.keyring,
        key: config.key,
        keyVersion: (config as { keyVersion?: string }).keyVersion,
        rpcUrl: _rpcUrl,
      });
    }

    default:
      throw new Error(`Unknown signer type: ${(config as { type: string }).type}`);
  }
}
