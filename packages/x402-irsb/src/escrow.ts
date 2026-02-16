/**
 * Escrow Helpers for Commerce Mode
 *
 * Functions for integrating x402 payments with IRSB EscrowVault
 * for higher-stakes commerce operations.
 */

import { JsonRpcProvider, Wallet, Contract, ZeroAddress, keccak256, toUtf8Bytes } from 'ethers';
import type { X402EscrowParams, X402Payment } from './types.js';

/**
 * Minimal EscrowVault ABI
 */
const ESCROW_ABI = [
  'function createEscrow(bytes32 escrowId, bytes32 receiptId, address depositor) payable',
  'function createEscrowERC20(bytes32 escrowId, bytes32 receiptId, address depositor, address token, uint256 amount)',
  'function getEscrow(bytes32 escrowId) view returns (bytes32 receiptId, address depositor, address token, uint256 amount, uint8 status, uint64 createdAt, uint64 deadline)',
  'function release(bytes32 escrowId, address recipient)',
  'function refund(bytes32 escrowId)',
  'event EscrowCreated(bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed depositor, address token, uint256 amount)',
  'event EscrowReleased(bytes32 indexed escrowId, address indexed recipient, uint256 amount)',
  'event EscrowRefunded(bytes32 indexed escrowId, address indexed depositor, uint256 amount)',
];

/**
 * ERC20 approval ABI
 */
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/**
 * Escrow status enum
 */
export enum EscrowStatus {
  Active = 0,
  Released = 1,
  Refunded = 2,
}

/**
 * Escrow information
 */
export interface EscrowInfo {
  receiptId: string;
  depositor: string;
  token: string;
  amount: bigint;
  status: EscrowStatus;
  createdAt: number;
  deadline: number;
}

/**
 * Result of creating an escrow
 */
export interface CreateEscrowResult {
  txHash: string;
  escrowId: string;
  blockNumber: number;
  gasUsed: bigint;
}

/**
 * Generate a deterministic escrow ID from payment reference.
 *
 * @param paymentRef - Payment transaction reference
 * @param chainId - Chain ID where escrow is created
 * @returns bytes32 escrow ID
 */
export function generateEscrowId(paymentRef: string, chainId: number): string {
  return keccak256(toUtf8Bytes(`escrow:${chainId}:${paymentRef}`));
}

/**
 * Generate escrow ID from x402 payment details.
 *
 * @param payment - x402 payment details
 * @param targetChainId - Chain ID for IRSB escrow
 * @returns bytes32 escrow ID
 */
export function escrowIdFromPayment(payment: X402Payment, targetChainId: number): string {
  return generateEscrowId(payment.paymentRef, targetChainId);
}

/**
 * Create a native ETH escrow for commerce mode.
 *
 * @param params - Escrow parameters
 * @param escrowAddress - EscrowVault contract address
 * @param rpcUrl - RPC URL
 * @param signerKey - Private key of authorized caller
 * @returns Escrow creation result
 */
export async function createNativeEscrow(
  params: X402EscrowParams,
  escrowAddress: string,
  rpcUrl: string,
  signerKey: string
): Promise<CreateEscrowResult> {
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(signerKey, provider);
  const escrow = new Contract(escrowAddress, ESCROW_ABI, wallet);

  const tx = await escrow.createEscrow(
    params.escrowId,
    params.receiptId,
    params.depositor,
    { value: params.amount }
  );

  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    escrowId: params.escrowId,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

/**
 * Create an ERC20 escrow for commerce mode.
 *
 * Note: Token must be pre-approved to the escrow contract.
 *
 * @param params - Escrow parameters
 * @param escrowAddress - EscrowVault contract address
 * @param rpcUrl - RPC URL
 * @param signerKey - Private key of authorized caller
 * @returns Escrow creation result
 */
export async function createERC20Escrow(
  params: X402EscrowParams,
  escrowAddress: string,
  rpcUrl: string,
  signerKey: string
): Promise<CreateEscrowResult> {
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(signerKey, provider);
  const escrow = new Contract(escrowAddress, ESCROW_ABI, wallet);

  const tx = await escrow.createEscrowERC20(
    params.escrowId,
    params.receiptId,
    params.depositor,
    params.token,
    params.amount
  );

  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    escrowId: params.escrowId,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

/**
 * Approve ERC20 tokens for escrow deposit.
 *
 * @param tokenAddress - ERC20 token address
 * @param escrowAddress - EscrowVault address
 * @param amount - Amount to approve
 * @param rpcUrl - RPC URL
 * @param signerKey - Token holder's private key
 * @returns Transaction hash
 */
export async function approveERC20ForEscrow(
  tokenAddress: string,
  escrowAddress: string,
  amount: bigint,
  rpcUrl: string,
  signerKey: string
): Promise<string> {
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(signerKey, provider);
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);

  const tx = await token.approve(escrowAddress, amount);
  const receipt = await tx.wait();

  return receipt.hash;
}

/**
 * Get escrow information.
 *
 * @param escrowId - Escrow ID to query
 * @param escrowAddress - EscrowVault address
 * @param rpcUrl - RPC URL
 * @returns Escrow info or null if not found
 */
export async function getEscrowInfo(
  escrowId: string,
  escrowAddress: string,
  rpcUrl: string
): Promise<EscrowInfo | null> {
  const provider = new JsonRpcProvider(rpcUrl);
  const escrow = new Contract(escrowAddress, ESCROW_ABI, provider);

  try {
    const [receiptId, depositor, token, amount, status, createdAt, deadline] =
      await escrow.getEscrow(escrowId);

    // Check if escrow exists (depositor would be zero address if not)
    if (depositor === ZeroAddress) {
      return null;
    }

    return {
      receiptId,
      depositor,
      token,
      amount,
      status,
      createdAt: Number(createdAt),
      deadline: Number(deadline),
    };
  } catch (error) {
    // Log error for debugging while returning null to indicate escrow not found
    console.error('[x402-irsb] Failed to get escrow info:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Check if an escrow can be created (doesn't already exist).
 *
 * @param escrowId - Escrow ID to check
 * @param escrowAddress - EscrowVault address
 * @param rpcUrl - RPC URL
 * @returns true if escrow can be created
 */
export async function canCreateEscrow(
  escrowId: string,
  escrowAddress: string,
  rpcUrl: string
): Promise<boolean> {
  const info = await getEscrowInfo(escrowId, escrowAddress, rpcUrl);
  return info === null;
}

/**
 * Calculate escrow parameters from x402 payment.
 *
 * @param payment - x402 payment details
 * @param receiptId - IRSB receipt ID
 * @param depositor - Client/payer address
 * @param targetChainId - Chain ID for IRSB escrow
 * @param deadlineOffset - Seconds to add to current time for deadline
 * @returns Escrow parameters
 */
export function calculateEscrowParams(
  payment: X402Payment,
  receiptId: string,
  depositor: string,
  targetChainId: number,
  deadlineOffset: number = 3600 // 1 hour default
): X402EscrowParams {
  const escrowId = escrowIdFromPayment(payment, targetChainId);
  const now = Math.floor(Date.now() / 1000);

  return {
    escrowId,
    receiptId,
    depositor,
    token: payment.asset === 'ETH' ? ZeroAddress : payment.asset,
    amount: BigInt(payment.amount),
    deadline: BigInt(now + deadlineOffset),
  };
}

/**
 * Create escrow from x402 payment (auto-detects native vs ERC20).
 *
 * @param payment - x402 payment details
 * @param receiptId - IRSB receipt ID
 * @param depositor - Client/payer address
 * @param escrowAddress - EscrowVault address
 * @param rpcUrl - RPC URL
 * @param signerKey - Authorized caller key
 * @param targetChainId - Chain ID
 * @returns Escrow creation result
 */
export async function createEscrowFromX402(
  payment: X402Payment,
  receiptId: string,
  depositor: string,
  escrowAddress: string,
  rpcUrl: string,
  signerKey: string,
  targetChainId: number
): Promise<CreateEscrowResult> {
  const params = calculateEscrowParams(payment, receiptId, depositor, targetChainId);

  if (params.token === ZeroAddress) {
    return createNativeEscrow(params, escrowAddress, rpcUrl, signerKey);
  } else {
    return createERC20Escrow(params, escrowAddress, rpcUrl, signerKey);
  }
}
