/**
 * Buyer SDK Tests
 *
 * Tests for high-level buyer delegation setup and payment helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  setupBuyerDelegation,
  makeDelegatedPayment,
  getDelegationStatus,
} from '../src/buyer.js';
import type { BuyerSetupConfig, CaveatConfig } from '../src/types.js';

const MOCK_ENFORCER_ADDRESSES = {
  spendLimit: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  timeWindow: '0x2222222222222222222222222222222222222222' as `0x${string}`,
  allowedTargets: '0x3333333333333333333333333333333333333333' as `0x${string}`,
  allowedMethods: '0x4444444444444444444444444444444444444444' as `0x${string}`,
  nonce: '0x5555555555555555555555555555555555555555' as `0x${string}`,
};

const MOCK_WALLET_DELEGATE = '0xDE1E000000000000000000000000000000000000' as `0x${string}`;
const MOCK_DELEGATOR = '0xB0E2000000000000000000000000000000000000' as `0x${string}`;
const MOCK_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`;
const MOCK_SELLER = '0x5E11000000000000000000000000000000000000' as `0x${string}`;

describe('setupBuyerDelegation', () => {
  it('should return complete setup with authorization', () => {
    const config: BuyerSetupConfig = {
      delegator: MOCK_DELEGATOR,
      walletDelegateAddress: MOCK_WALLET_DELEGATE,
      chainId: 11155111,
      caveats: {
        enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
        spendLimit: {
          token: MOCK_USDC,
          dailyCap: 1000n * 10n ** 6n,
          perTxCap: 100n * 10n ** 6n,
        },
        timeWindow: {
          notBefore: BigInt(Math.floor(Date.now() / 1000)),
          notAfter: BigInt(Math.floor(Date.now() / 1000) + 86400),
        },
      },
    };

    const result = setupBuyerDelegation(config);

    expect(result.authorization).toBeDefined();
    expect(result.authorization.chainId).toBe(11155111);
    expect(result.delegation).toBeDefined();
    expect(result.typedData).toBeDefined();
    expect(result.delegationHash).toMatch(/^0x/);
    expect(result.permissionRequest).toBeDefined();
    expect(result.summary).toContain('Delegation Setup');
  });

  it('should include permission request with correct structure', () => {
    const config: BuyerSetupConfig = {
      delegator: MOCK_DELEGATOR,
      walletDelegateAddress: MOCK_WALLET_DELEGATE,
      chainId: 11155111,
      caveats: {
        enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
        spendLimit: {
          token: MOCK_USDC,
          dailyCap: 500n * 10n ** 6n,
          perTxCap: 50n * 10n ** 6n,
        },
      },
    };

    const result = setupBuyerDelegation(config);

    expect(result.permissionRequest.chainId).toBe(11155111);
    expect(result.permissionRequest.permissions).toHaveLength(1);
    expect(result.permissionRequest.permissions[0].type).toBe('spend-limit');
  });
});

describe('makeDelegatedPayment', () => {
  it('should build delegated payment params', () => {
    const result = makeDelegatedPayment({
      delegationHash: '0xabcd' as `0x${string}`,
      paymentHash: '0x1234' as `0x${string}`,
      token: MOCK_USDC,
      amount: 50n * 10n ** 6n,
      seller: MOCK_SELLER,
      buyer: MOCK_DELEGATOR,
      receiptId: '0xreceipt' as `0x${string}`,
      intentHash: '0xintent' as `0x${string}`,
      proof: '0xproof' as `0x${string}`,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });

    expect(result.delegationHash).toBe('0xabcd');
    expect(result.settlementParams.amount).toBe(50n * 10n ** 6n);
    expect(result.functionName).toBe('settleDelegated');
    expect(result.args).toHaveLength(2);
  });
});

describe('getDelegationStatus', () => {
  it('should report valid delegation with no caveats', () => {
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
    };

    const status = getDelegationStatus(config);

    expect(status.isValid).toBe(true);
    expect(status.issues).toHaveLength(0);
    expect(status.caveats.hasSpendLimit).toBe(false);
    expect(status.caveats.hasTimeWindow).toBe(false);
  });

  it('should detect expired delegation', () => {
    const now = Math.floor(Date.now() / 1000);
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      timeWindow: {
        notBefore: BigInt(now - 7200),
        notAfter: BigInt(now - 3600),
      },
    };

    const status = getDelegationStatus(config);

    expect(status.isValid).toBe(false);
    expect(status.timeValid).toBe(false);
    expect(status.issues).toContain('Delegation expired');
  });

  it('should detect not-yet-active delegation', () => {
    const now = Math.floor(Date.now() / 1000);
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      timeWindow: {
        notBefore: BigInt(now + 3600),
        notAfter: BigInt(now + 7200),
      },
    };

    const status = getDelegationStatus(config);

    expect(status.isValid).toBe(false);
    expect(status.issues).toContain('Delegation not yet active');
  });

  it('should report all caveat flags', () => {
    const now = Math.floor(Date.now() / 1000);
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      spendLimit: { token: MOCK_USDC, dailyCap: 1000n, perTxCap: 100n },
      timeWindow: { notBefore: BigInt(now - 3600), notAfter: BigInt(now + 3600) },
      allowedTargets: { targets: [MOCK_SELLER] },
      allowedMethods: { selectors: ['0xa9059cbb' as `0x${string}`] },
      nonce: { startNonce: 0n },
    };

    const status = getDelegationStatus(config);

    expect(status.caveats.hasSpendLimit).toBe(true);
    expect(status.caveats.hasTimeWindow).toBe(true);
    expect(status.caveats.hasTargetAllowlist).toBe(true);
    expect(status.caveats.hasMethodAllowlist).toBe(true);
    expect(status.caveats.hasNonce).toBe(true);
  });
});
