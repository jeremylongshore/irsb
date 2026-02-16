/**
 * X402Facilitator Client
 *
 * Client for interacting with the X402Facilitator contract
 * for settling payments (direct and delegated).
 *
 * Uses viem for ABI encoding and contract interaction.
 */

import {
  type Address,
  type Hex,
  type Account,
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
} from 'viem';
import { sepolia } from 'viem/chains';

/**
 * X402Facilitator contract configuration
 */
export interface FacilitatorConfig {
  /** X402Facilitator contract address */
  facilitatorAddress: Hex;

  /** WalletDelegate contract address */
  walletDelegateAddress: Hex;

  /** RPC URL for the target chain */
  rpcUrl: string;

  /** Chain ID */
  chainId: number;
}

/**
 * Settlement parameters matching Solidity SettlementParams
 */
export interface SettlementParams {
  paymentHash: Hex;
  token: Hex;
  amount: bigint;
  seller: Hex;
  buyer: Hex;
  receiptId: Hex;
  intentHash: Hex;
  proof: Hex;
  expiry: bigint;
}

/**
 * Settlement result
 */
export interface SettlementResult {
  success: boolean;
  txHash?: Hex;
  error?: string;
}

/**
 * X402Facilitator ABI (relevant functions only)
 */
const X402_FACILITATOR_ABI = [
  {
    type: 'function',
    name: 'settlePayment',
    inputs: [{
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'paymentHash', type: 'bytes32' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'seller', type: 'address' },
        { name: 'buyer', type: 'address' },
        { name: 'receiptId', type: 'bytes32' },
        { name: 'intentHash', type: 'bytes32' },
        { name: 'proof', type: 'bytes' },
        { name: 'expiry', type: 'uint64' },
      ],
    }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleDelegated',
    inputs: [
      { name: 'delegationHash', type: 'bytes32' },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'paymentHash', type: 'bytes32' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'seller', type: 'address' },
          { name: 'buyer', type: 'address' },
          { name: 'receiptId', type: 'bytes32' },
          { name: 'intentHash', type: 'bytes32' },
          { name: 'proof', type: 'bytes' },
          { name: 'expiry', type: 'uint64' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchSettle',
    inputs: [{
      name: 'params',
      type: 'tuple[]',
      components: [
        { name: 'paymentHash', type: 'bytes32' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'seller', type: 'address' },
        { name: 'buyer', type: 'address' },
        { name: 'receiptId', type: 'bytes32' },
        { name: 'intentHash', type: 'bytes32' },
        { name: 'proof', type: 'bytes' },
        { name: 'expiry', type: 'uint64' },
      ],
    }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isSettled',
    inputs: [{ name: 'paymentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Convert SettlementParams to tuple args for ABI encoding
 */
function toSettlementTuple(params: SettlementParams) {
  return {
    paymentHash: params.paymentHash,
    token: params.token as Address,
    amount: params.amount,
    seller: params.seller as Address,
    buyer: params.buyer as Address,
    receiptId: params.receiptId,
    intentHash: params.intentHash,
    proof: params.proof,
    expiry: params.expiry,
  };
}

/**
 * X402Facilitator Client
 *
 * @example
 * ```typescript
 * const facilitator = new FacilitatorClient({
 *   facilitatorAddress: '0x...',
 *   walletDelegateAddress: '0x...',
 *   rpcUrl: 'https://rpc.sepolia.org',
 *   chainId: 11155111,
 * });
 *
 * const result = await facilitator.settlePayment(params, signerFn);
 * ```
 */
export class FacilitatorClient {
  private config: FacilitatorConfig;

  constructor(config: FacilitatorConfig) {
    this.config = config;
  }

  /**
   * Settle a direct payment (buyer pays directly)
   */
  async settlePayment(
    params: SettlementParams,
    signAndSend: (txData: { to: Hex; data: Hex }) => Promise<Hex>,
  ): Promise<SettlementResult> {
    try {
      const data = encodeFunctionData({
        abi: X402_FACILITATOR_ABI,
        functionName: 'settlePayment',
        args: [toSettlementTuple(params)],
      });

      const txHash = await signAndSend({
        to: this.config.facilitatorAddress,
        data,
      });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Settle a payment via delegation (buyer has active 7702 delegation)
   */
  async settleDelegated(
    delegationHash: Hex,
    params: SettlementParams,
    signAndSend: (txData: { to: Hex; data: Hex }) => Promise<Hex>,
  ): Promise<SettlementResult> {
    try {
      const data = encodeFunctionData({
        abi: X402_FACILITATOR_ABI,
        functionName: 'settleDelegated',
        args: [delegationHash, toSettlementTuple(params)],
      });

      const txHash = await signAndSend({
        to: this.config.facilitatorAddress,
        data,
      });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Settle multiple payments in a batch
   */
  async batchSettle(
    paramsList: SettlementParams[],
    signAndSend: (txData: { to: Hex; data: Hex }) => Promise<Hex>,
  ): Promise<SettlementResult> {
    try {
      const data = encodeFunctionData({
        abi: X402_FACILITATOR_ABI,
        functionName: 'batchSettle',
        args: [paramsList.map(toSettlementTuple)],
      });

      const txHash = await signAndSend({
        to: this.config.facilitatorAddress,
        data,
      });

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if a payment has been settled
   */
  async isSettled(paymentHash: Hex): Promise<boolean> {
    const chain = this.config.chainId === 11155111 ? sepolia : {
      id: this.config.chainId,
      name: `Chain ${this.config.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [this.config.rpcUrl] } },
    };

    const publicClient = createPublicClient({
      chain,
      transport: http(this.config.rpcUrl),
    });

    const result = await publicClient.readContract({
      address: this.config.facilitatorAddress as Address,
      abi: X402_FACILITATOR_ABI,
      functionName: 'isSettled',
      args: [paymentHash],
    });

    return result;
  }

  /**
   * Create a signAndSend function from a viem Account
   */
  createSignAndSend(account: Account): (txData: { to: Hex; data: Hex }) => Promise<Hex> {
    const chain = this.config.chainId === 11155111 ? sepolia : {
      id: this.config.chainId,
      name: `Chain ${this.config.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [this.config.rpcUrl] } },
    };

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(this.config.rpcUrl),
    });

    return async (txData: { to: Hex; data: Hex }) => {
      const hash = await walletClient.sendTransaction({
        to: txData.to as Address,
        data: txData.data,
      });
      return hash;
    };
  }
}

/**
 * Create a FacilitatorClient from resolved config
 */
export function createFacilitatorClient(config: {
  X402_FACILITATOR_ADDRESS?: string;
  WALLET_DELEGATE_ADDRESS?: string;
  RPC_URL?: string;
  CHAIN_ID: number;
}): FacilitatorClient {
  const facilitatorAddress = config.X402_FACILITATOR_ADDRESS as Hex | undefined;
  const walletDelegateAddress = config.WALLET_DELEGATE_ADDRESS as Hex | undefined;
  const rpcUrl = config.RPC_URL;

  if (!facilitatorAddress || !walletDelegateAddress || !rpcUrl) {
    throw new Error(
      'FacilitatorClient requires X402_FACILITATOR_ADDRESS, WALLET_DELEGATE_ADDRESS, and RPC_URL'
    );
  }

  return new FacilitatorClient({
    facilitatorAddress,
    walletDelegateAddress,
    rpcUrl,
    chainId: config.CHAIN_ID,
  });
}
