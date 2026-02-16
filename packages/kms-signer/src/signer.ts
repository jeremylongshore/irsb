import type { Address, Hex, Account } from 'viem';

/**
 * Signer type identifier
 */
export type SignerType = 'local' | 'gcp-kms';

/**
 * Transaction request for signing
 */
export interface TransactionRequest {
  /** Target contract address */
  to: Address;

  /** Transaction data */
  data: Hex;

  /** Value in wei */
  value?: bigint;

  /** Gas limit */
  gas?: bigint;

  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;

  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;

  /** Nonce (optional, will be fetched if not provided) */
  nonce?: number;

  /** Chain ID */
  chainId: number;
}

/**
 * Signed transaction
 */
export interface SignedTransaction {
  /** Raw signed transaction bytes */
  rawTransaction: Hex;

  /** Transaction hash */
  hash: Hex;
}

/**
 * Message to sign (for EIP-712, etc)
 */
export interface SignableMessage {
  /** Raw message bytes or string */
  raw: Hex | string;
}

/**
 * EIP-712 typed data for signing
 */
export interface TypedData {
  /** Domain separator */
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: Address;
    salt?: Hex;
  };

  /** Type definitions */
  types: Record<string, Array<{ name: string; type: string }>>;

  /** Primary type name */
  primaryType: string;

  /** Message to sign */
  message: Record<string, unknown>;
}

/**
 * Signer interface
 *
 * All signer implementations must implement this interface.
 * This allows for pluggable signing mechanisms:
 * - LocalPrivateKeySigner: For development/testing
 * - GcpKmsSigner: For production with Cloud KMS
 */
export interface Signer {
  /**
   * Get the signer type
   */
  getType(): SignerType;

  /**
   * Get the signer's address
   */
  getAddress(): Promise<Address>;

  /**
   * Get a viem Account for use with wallet clients
   */
  getAccount(): Promise<Account>;

  /**
   * Sign a transaction
   */
  signTransaction(tx: TransactionRequest): Promise<SignedTransaction>;

  /**
   * Sign a message (personal_sign)
   */
  signMessage(message: SignableMessage): Promise<Hex>;

  /**
   * Sign typed data (EIP-712)
   */
  signTypedData(data: TypedData): Promise<Hex>;

  /**
   * Check if signer is available/healthy
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Factory function type for creating signers
 */
export type SignerFactory<TConfig> = (config: TConfig) => Promise<Signer>;
