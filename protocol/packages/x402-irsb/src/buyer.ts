/**
 * High-level buyer SDK for EIP-7702 delegated payments
 *
 * Provides a simple interface for developers to:
 * 1. Set up a delegation (connect wallet, set limits)
 * 2. Make delegated payments (auto-pay for API calls)
 * 3. Monitor delegation status
 */

import type {
  BuyerSetupConfig,
  PaymentResult,
  DelegationStatusInfo,
  CaveatConfig,
} from './types.js';
import { buildDelegation, buildDelegationAuthorization, isDelegationTimeValid } from './delegation.js';
import { buildPermissionRequest } from './permissions.js';

/**
 * Set up a buyer delegation for auto-paying x402 API calls
 *
 * Flow:
 * 1. Build EIP-7702 authorization
 * 2. Build delegation with caveats
 * 3. Return signing payloads for the wallet
 *
 * @param config - Buyer setup configuration
 * @returns Setup result with authorization and delegation ready for signing
 */
export function setupBuyerDelegation(config: BuyerSetupConfig) {
  // Build EIP-7702 authorization (designates WalletDelegate as code)
  const authorization = buildDelegationAuthorization({
    delegator: config.delegator,
    walletDelegateAddress: config.walletDelegateAddress,
    chainId: config.chainId,
    caveats: config.caveats,
  });

  // Build delegation struct with caveats
  const { delegation, typedData, delegationHash } = buildDelegation({
    delegator: config.delegator,
    walletDelegateAddress: config.walletDelegateAddress,
    chainId: config.chainId,
    caveats: config.caveats,
    salt: config.salt,
  });

  // Build ERC-7715 permission request for wallet UX
  const permissionRequest = buildPermissionRequest(config);

  return {
    /** EIP-7702 authorization for wallet to sign */
    authorization,
    /** Delegation struct for EIP-712 signing */
    delegation,
    /** EIP-712 typed data for wallet to sign */
    typedData,
    /** Hash identifying this delegation */
    delegationHash,
    /** ERC-7715 permission request for wallet UX */
    permissionRequest,
    /** Human-readable summary */
    summary: buildSetupSummary(config),
  };
}

/**
 * Build parameters for a delegated payment via X402Facilitator
 *
 * @param delegationHash - Hash of the active delegation
 * @param paymentHash - Unique payment identifier
 * @param token - ERC20 token address
 * @param amount - Payment amount
 * @param seller - Payment recipient
 * @param buyer - Delegator address
 * @returns Encoded transaction data for settleDelegated()
 */
export function makeDelegatedPayment(params: {
  delegationHash: `0x${string}`;
  paymentHash: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  seller: `0x${string}`;
  buyer: `0x${string}`;
  receiptId: `0x${string}`;
  intentHash: `0x${string}`;
  proof: `0x${string}`;
  expiry: bigint;
}): PaymentResult {
  return {
    delegationHash: params.delegationHash,
    settlementParams: {
      paymentHash: params.paymentHash,
      token: params.token,
      amount: params.amount,
      seller: params.seller,
      buyer: params.buyer,
      receiptId: params.receiptId,
      intentHash: params.intentHash,
      proof: params.proof,
      expiry: params.expiry,
    },
    // In production: encode the X402Facilitator.settleDelegated() calldata
    functionName: 'settleDelegated',
    args: [params.delegationHash, {
      paymentHash: params.paymentHash,
      token: params.token,
      amount: params.amount,
      seller: params.seller,
      buyer: params.buyer,
      receiptId: params.receiptId,
      intentHash: params.intentHash,
      proof: params.proof,
      expiry: params.expiry,
    }],
  };
}

/**
 * Get delegation status from on-chain data
 *
 * @param caveats - Current caveat configuration
 * @returns Status information about the delegation
 */
export function getDelegationStatus(caveats: CaveatConfig): DelegationStatusInfo {
  const timeValid = isDelegationTimeValid(caveats);

  const issues: string[] = [];

  if (caveats.timeWindow) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < caveats.timeWindow.notBefore) {
      issues.push('Delegation not yet active');
    }
    if (now > caveats.timeWindow.notAfter) {
      issues.push('Delegation expired');
    }
  }

  return {
    isValid: timeValid && issues.length === 0,
    timeValid,
    issues,
    caveats: {
      hasSpendLimit: !!caveats.spendLimit,
      hasTimeWindow: !!caveats.timeWindow,
      hasTargetAllowlist: !!caveats.allowedTargets,
      hasMethodAllowlist: !!caveats.allowedMethods,
      hasNonce: !!caveats.nonce,
    },
  };
}

/**
 * Build a human-readable summary of the delegation setup
 */
function buildSetupSummary(config: BuyerSetupConfig): string {
  const lines: string[] = ['Delegation Setup:'];

  lines.push(`  Delegator: ${config.delegator}`);
  lines.push(`  Chain: ${config.chainId}`);

  if (config.caveats.spendLimit) {
    lines.push(`  Spend Limit: ${config.caveats.spendLimit.dailyCap} daily, ${config.caveats.spendLimit.perTxCap} per-tx`);
  }

  if (config.caveats.timeWindow) {
    const start = new Date(Number(config.caveats.timeWindow.notBefore) * 1000).toISOString();
    const end = new Date(Number(config.caveats.timeWindow.notAfter) * 1000).toISOString();
    lines.push(`  Time Window: ${start} to ${end}`);
  }

  if (config.caveats.allowedTargets) {
    lines.push(`  Allowed Targets: ${config.caveats.allowedTargets.targets.length} contracts`);
  }

  if (config.caveats.allowedMethods) {
    lines.push(`  Allowed Methods: ${config.caveats.allowedMethods.selectors.length} selectors`);
  }

  return lines.join('\n');
}
