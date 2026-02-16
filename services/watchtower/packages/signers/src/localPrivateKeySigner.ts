import {
  type Address,
  type Hex,
  type Account,
  createWalletClient,
  http,
} from 'viem';
import {
  privateKeyToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';
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
 * Configuration for local private key signer
 */
export interface LocalPrivateKeySignerConfig {
  /** Private key (hex string with 0x prefix) */
  privateKey: Hex;

  /** RPC URL for transaction signing */
  rpcUrl?: string;

  /** Chain ID */
  chainId?: number;
}

/**
 * Local private key signer
 *
 * Uses a local private key for signing. Suitable for:
 * - Local development
 * - Testing
 * - Self-hosted environments with secure key storage
 *
 * WARNING: Never use this in production with keys that hold real value.
 * For production, use GcpKmsSigner.
 */
export class LocalPrivateKeySigner implements Signer {
  private account: PrivateKeyAccount;
  private rpcUrl: string;

  constructor(config: LocalPrivateKeySignerConfig) {
    this.account = privateKeyToAccount(config.privateKey);
    this.rpcUrl = config.rpcUrl ?? 'https://rpc.sepolia.org';
    // chainId stored for future multi-chain support
    void config.chainId;
  }

  getType(): SignerType {
    return 'local';
  }

  async getAddress(): Promise<Address> {
    return this.account.address;
  }

  async getAccount(): Promise<Account> {
    return this.account;
  }

  async signTransaction(tx: TransactionRequest): Promise<SignedTransaction> {
    // Create wallet client for signing (always use Sepolia for simplicity)
    const walletClient = createWalletClient({
      account: this.account,
      chain: sepolia,
      transport: http(this.rpcUrl),
    });

    // Prepare transaction request
    const request = await walletClient.prepareTransactionRequest({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      nonce: tx.nonce,
    });

    // Sign the transaction
    const serialized = await walletClient.signTransaction(request);

    // For now, return the serialized transaction
    // The hash would need to be computed or obtained after broadcast
    return {
      rawTransaction: serialized,
      hash: '0x' as Hex, // Hash is computed on broadcast
    };
  }

  async signMessage(message: SignableMessage): Promise<Hex> {
    const messageToSign = typeof message.raw === 'string'
      ? message.raw
      : message.raw;

    return this.account.signMessage({
      message: messageToSign as `0x${string}` | { raw: `0x${string}` },
    });
  }

  async signTypedData(data: TypedData): Promise<Hex> {
    return this.account.signTypedData({
      domain: data.domain,
      types: data.types,
      primaryType: data.primaryType,
      message: data.message,
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Just verify we can get the address
      await this.getAddress();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a local private key signer
 */
export function createLocalSigner(config: LocalPrivateKeySignerConfig): LocalPrivateKeySigner {
  return new LocalPrivateKeySigner(config);
}
