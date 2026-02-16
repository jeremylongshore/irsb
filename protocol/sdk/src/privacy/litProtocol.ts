/**
 * IRSB Privacy - Lit Protocol Integration (Optional)
 *
 * Provides optional integration with Lit Protocol for:
 * - Payload encryption with access control
 * - Decryption with on-chain conditions
 *
 * This module is designed to work without Lit SDK installed.
 * If Lit SDK is available, it provides enhanced functionality.
 *
 * @see https://developer.litprotocol.com/
 */

import { ethers } from 'ethers';
import {
  AccessControlCondition,
  EncryptedPayload,
  PrivacyConfig,
} from './types';

/**
 * Lit Protocol network options
 */
export type LitNetwork = 'cayenne' | 'manzano' | 'habanero' | 'datil-dev' | 'datil-test';

/**
 * Lit Protocol configuration
 */
export interface LitConfig {
  /** Lit network to use */
  network: LitNetwork;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Auth signature for Lit Protocol
 */
export interface AuthSig {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
}

/**
 * Default Lit network
 */
export const DEFAULT_LIT_NETWORK: LitNetwork = 'datil-test';

/**
 * Create an EVM basic access control condition
 * Allows access to anyone who holds a minimum balance
 *
 * @param chain - Chain name (e.g., 'ethereum', 'sepolia')
 * @param minBalance - Minimum ETH balance in wei
 * @returns Access control condition
 */
export function createBalanceCondition(
  chain: string,
  minBalance: string = '0'
): AccessControlCondition {
  return {
    conditionType: 'evmBasic',
    chain,
    contractAddress: '',
    standardContractType: '',
    method: 'eth_getBalance',
    parameters: [':userAddress', 'latest'],
    returnValueTest: {
      comparator: '>=',
      value: minBalance,
    },
  };
}

/**
 * Create an ERC-20 token balance condition
 *
 * @param chain - Chain name
 * @param tokenAddress - ERC-20 contract address
 * @param minBalance - Minimum token balance
 * @returns Access control condition
 */
export function createTokenBalanceCondition(
  chain: string,
  tokenAddress: string,
  minBalance: string
): AccessControlCondition {
  return {
    conditionType: 'evmBasic',
    chain,
    contractAddress: tokenAddress,
    standardContractType: 'ERC20',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '>=',
      value: minBalance,
    },
  };
}

/**
 * Create an NFT ownership condition
 *
 * @param chain - Chain name
 * @param nftAddress - NFT contract address
 * @param tokenId - Optional specific token ID
 * @returns Access control condition
 */
export function createNFTOwnershipCondition(
  chain: string,
  nftAddress: string,
  tokenId?: string
): AccessControlCondition {
  if (tokenId) {
    return {
      conditionType: 'evmBasic',
      chain,
      contractAddress: nftAddress,
      standardContractType: 'ERC721',
      method: 'ownerOf',
      parameters: [tokenId],
      returnValueTest: {
        comparator: '=',
        value: ':userAddress',
      },
    };
  }

  return {
    conditionType: 'evmBasic',
    chain,
    contractAddress: nftAddress,
    standardContractType: 'ERC721',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '>',
      value: '0',
    },
  };
}

/**
 * Create a condition requiring a specific address
 *
 * @param chain - Chain name
 * @param address - Required address
 * @returns Access control condition
 */
export function createAddressCondition(chain: string, address: string): AccessControlCondition {
  return {
    conditionType: 'evmBasic',
    chain,
    contractAddress: '',
    standardContractType: '',
    method: '',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: address.toLowerCase(),
    },
  };
}

/**
 * Create conditions for IRSB receipt access
 * Access granted to solver, client, or arbitrator
 *
 * @param chain - Chain name
 * @param solverAddress - Solver's address
 * @param clientAddress - Client's address
 * @param arbitratorAddress - Optional arbitrator address
 * @returns Array of access control conditions with OR operators
 */
export function createReceiptAccessConditions(
  chain: string,
  solverAddress: string,
  clientAddress: string,
  arbitratorAddress?: string
): AccessControlCondition[] {
  const conditions: AccessControlCondition[] = [
    createAddressCondition(chain, solverAddress),
    createAddressCondition(chain, clientAddress),
  ];

  if (arbitratorAddress) {
    conditions.push(createAddressCondition(chain, arbitratorAddress));
  }

  return conditions;
}

/**
 * Simulate encryption without Lit SDK
 * For testing/development when Lit is not available
 *
 * @param data - Data to "encrypt"
 * @param conditions - Access control conditions
 * @returns Simulated encrypted payload
 */
export function simulateEncryption(
  data: string,
  conditions: AccessControlCondition[]
): EncryptedPayload {
  // In production, this would use Lit SDK
  // This simulation just base64 encodes for testing
  const ciphertext = Buffer.from(data).toString('base64');
  const dataToEncryptHash = ethers.keccak256(ethers.toUtf8Bytes(data));

  return {
    ciphertext,
    dataToEncryptHash,
    accessControlConditions: conditions,
    encryptionMetadata: {
      network: 'simulated',
      keyType: 'test',
      encryptedAt: Date.now(),
    },
  };
}

/**
 * Simulate decryption without Lit SDK
 *
 * @param encrypted - Encrypted payload
 * @returns Decrypted data
 */
export function simulateDecryption(encrypted: EncryptedPayload): string {
  // In production, this would use Lit SDK with auth
  return Buffer.from(encrypted.ciphertext, 'base64').toString('utf-8');
}

/**
 * Check if Lit SDK is available
 * @returns True if @lit-protocol/lit-node-client is installed
 */
export function isLitAvailable(): boolean {
  try {
    // Dynamic require check
    require.resolve('@lit-protocol/lit-node-client');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Lit client instance (if available)
 * @param config - Lit configuration
 * @returns Lit client instance or null
 */
export async function getLitClient(config: LitConfig = { network: DEFAULT_LIT_NETWORK }): Promise<unknown | null> {
  if (!isLitAvailable()) {
    console.warn('Lit Protocol SDK not installed. Using simulation mode.');
    return null;
  }

  try {
    // Dynamic import for optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const LitModule = await import('@lit-protocol/lit-node-client' as string);
    const LitNodeClient = LitModule.LitNodeClient || LitModule.default?.LitNodeClient;
    if (!LitNodeClient) {
      console.warn('LitNodeClient not found in imported module');
      return null;
    }
    const client = new LitNodeClient({
      litNetwork: config.network,
      debug: config.debug ?? false,
    });
    await client.connect();
    return client;
  } catch (error) {
    console.warn('Failed to initialize Lit client:', error);
    return null;
  }
}

/**
 * Generate an auth signature for Lit Protocol
 *
 * @param signer - Ethers signer
 * @param statement - Statement to sign
 * @returns Auth signature
 */
export async function generateAuthSig(
  signer: ethers.Signer,
  statement: string = 'Sign this message to access encrypted content via IRSB Protocol'
): Promise<AuthSig> {
  const address = await signer.getAddress();
  const message = `${statement}\n\nAddress: ${address}\nTimestamp: ${Date.now()}`;
  const sig = await signer.signMessage(message);

  return {
    sig,
    derivedVia: 'web3.eth.personal.sign',
    signedMessage: message,
    address,
  };
}

/**
 * Create a privacy configuration for V2 receipts
 *
 * @param options - Privacy options
 * @returns Privacy configuration
 */
export function createPrivacyConfig(options: {
  encrypt?: boolean;
  solverAddress?: string;
  clientAddress?: string;
  arbitratorAddress?: string;
  chain?: string;
  storageProvider?: 'ipfs' | 'arweave' | 'custom';
}): PrivacyConfig {
  const config: PrivacyConfig = {
    encrypt: options.encrypt ?? false,
    storageProvider: options.storageProvider ?? 'ipfs',
  };

  if (options.encrypt && options.solverAddress && options.clientAddress) {
    config.accessConditions = createReceiptAccessConditions(
      options.chain ?? 'sepolia',
      options.solverAddress,
      options.clientAddress,
      options.arbitratorAddress
    );
  }

  return config;
}

/**
 * Encrypt data using Lit Protocol (or simulation)
 *
 * @param data - Data to encrypt (string or object)
 * @param config - Privacy configuration
 * @param litConfig - Lit Protocol configuration
 * @returns Encrypted payload
 */
export async function encryptWithLit(
  data: string | Record<string, unknown>,
  config: PrivacyConfig,
  litConfig?: LitConfig
): Promise<EncryptedPayload> {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const conditions = config.accessConditions ?? [];

  // Try to use real Lit SDK
  const litClient = litConfig ? await getLitClient(litConfig) : null;

  if (litClient) {
    try {
      // Use real Lit Protocol encryption
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = litClient as any;

      // Get the chain from conditions or default to ethereum
      const chain = conditions[0]?.chain || 'ethereum';

      // Lit Protocol v3+ encryption API
      const { ciphertext, dataToEncryptHash } = await client.encrypt({
        accessControlConditions: conditions.map(c => ({
          contractAddress: c.contractAddress || '',
          standardContractType: c.standardContractType || '',
          chain,
          method: c.method || '',
          parameters: c.parameters || [],
          returnValueTest: c.returnValueTest,
        })),
        dataToEncrypt: new TextEncoder().encode(dataString),
        chain,
      });

      return {
        ciphertext: typeof ciphertext === 'string' ? ciphertext : Buffer.from(ciphertext).toString('base64'),
        dataToEncryptHash: typeof dataToEncryptHash === 'string' ? dataToEncryptHash : ethers.hexlify(dataToEncryptHash),
        accessControlConditions: conditions,
        encryptionMetadata: {
          network: litConfig?.network || DEFAULT_LIT_NETWORK,
          keyType: 'lit-bls',
          encryptedAt: Date.now(),
        },
      };
    } catch (error) {
      console.warn('Lit Protocol encryption failed, falling back to simulation:', error);
      // Fall through to simulation
    }
  }

  // Fall back to simulation when Lit SDK is not available or encryption fails
  return simulateEncryption(dataString, conditions);
}
