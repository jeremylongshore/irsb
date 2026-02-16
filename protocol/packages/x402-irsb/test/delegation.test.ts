/**
 * Delegation Builder Tests
 *
 * Tests for EIP-7702 delegation building, caveat encoding, and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDelegationAuthorization,
  buildDelegation,
  buildCaveats,
  isDelegationTimeValid,
} from '../src/delegation.js';
import type { CaveatConfig, BuyerDelegationConfig } from '../src/types.js';

const MOCK_ENFORCER_ADDRESSES = {
  spendLimit: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  timeWindow: '0x2222222222222222222222222222222222222222' as `0x${string}`,
  allowedTargets: '0x3333333333333333333333333333333333333333' as `0x${string}`,
  allowedMethods: '0x4444444444444444444444444444444444444444' as `0x${string}`,
  nonce: '0x5555555555555555555555555555555555555555' as `0x${string}`,
};

const MOCK_WALLET_DELEGATE = '0xDELE000000000000000000000000000000000000' as `0x${string}`;
const MOCK_DELEGATOR = '0xBUYR000000000000000000000000000000000000' as `0x${string}`;

describe('buildDelegationAuthorization', () => {
  it('should build EIP-7702 authorization', () => {
    const auth = buildDelegationAuthorization({
      delegator: MOCK_DELEGATOR,
      walletDelegateAddress: MOCK_WALLET_DELEGATE,
      chainId: 11155111,
      caveats: { enforcerAddresses: MOCK_ENFORCER_ADDRESSES },
    });

    expect(auth.chainId).toBe(11155111);
    expect(auth.address).toBe(MOCK_WALLET_DELEGATE);
    expect(auth.nonce).toBe(0n);
  });

  it('should accept custom nonce', () => {
    const auth = buildDelegationAuthorization({
      delegator: MOCK_DELEGATOR,
      walletDelegateAddress: MOCK_WALLET_DELEGATE,
      chainId: 11155111,
      caveats: { enforcerAddresses: MOCK_ENFORCER_ADDRESSES },
      nonce: 42n,
    });

    expect(auth.nonce).toBe(42n);
  });
});

describe('buildCaveats', () => {
  it('should build spend limit caveat', () => {
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      spendLimit: {
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        dailyCap: 1000n * 10n ** 6n,
        perTxCap: 100n * 10n ** 6n,
      },
    };

    const caveats = buildCaveats(config);
    expect(caveats).toHaveLength(1);
    expect(caveats[0].enforcer).toBe(MOCK_ENFORCER_ADDRESSES.spendLimit);
    expect(caveats[0].terms).toMatch(/^0x/);
  });

  it('should build multiple caveats in order', () => {
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      spendLimit: {
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        dailyCap: 10n ** 18n,
        perTxCap: 10n ** 17n,
      },
      timeWindow: {
        notBefore: BigInt(Math.floor(Date.now() / 1000)),
        notAfter: BigInt(Math.floor(Date.now() / 1000) + 86400),
      },
      allowedTargets: {
        targets: [
          '0xAAAA000000000000000000000000000000000000' as `0x${string}`,
          '0xBBBB000000000000000000000000000000000000' as `0x${string}`,
        ],
      },
    };

    const caveats = buildCaveats(config);
    expect(caveats).toHaveLength(3);
    expect(caveats[0].enforcer).toBe(MOCK_ENFORCER_ADDRESSES.spendLimit);
    expect(caveats[1].enforcer).toBe(MOCK_ENFORCER_ADDRESSES.timeWindow);
    expect(caveats[2].enforcer).toBe(MOCK_ENFORCER_ADDRESSES.allowedTargets);
  });

  it('should handle empty caveats', () => {
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
    };

    const caveats = buildCaveats(config);
    expect(caveats).toHaveLength(0);
  });
});

describe('buildDelegation', () => {
  it('should build complete delegation struct', () => {
    const config: BuyerDelegationConfig = {
      delegator: MOCK_DELEGATOR,
      walletDelegateAddress: MOCK_WALLET_DELEGATE,
      chainId: 11155111,
      caveats: { enforcerAddresses: MOCK_ENFORCER_ADDRESSES },
      salt: 12345n,
    };

    const result = buildDelegation(config);

    expect(result.delegation.delegator).toBe(MOCK_DELEGATOR);
    expect(result.delegation.delegate).toBe(MOCK_WALLET_DELEGATE);
    expect(result.delegation.salt).toBe(12345n);
    expect(result.typedData.domain.name).toBe('IRSB WalletDelegate');
    expect(result.typedData.domain.chainId).toBe(11155111);
    expect(result.delegationHash).toMatch(/^0x/);
  });

  it('should include EIP-712 typed data', () => {
    const config: BuyerDelegationConfig = {
      delegator: MOCK_DELEGATOR,
      walletDelegateAddress: MOCK_WALLET_DELEGATE,
      chainId: 11155111,
      caveats: { enforcerAddresses: MOCK_ENFORCER_ADDRESSES },
    };

    const result = buildDelegation(config);

    expect(result.typedData.primaryType).toBe('Delegation');
    expect(result.typedData.types.Delegation).toBeDefined();
    expect(result.typedData.types.Caveat).toBeDefined();
  });
});

describe('isDelegationTimeValid', () => {
  it('should return true with no time window', () => {
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
    };

    expect(isDelegationTimeValid(config)).toBe(true);
  });

  it('should return true within time window', () => {
    const now = Math.floor(Date.now() / 1000);
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      timeWindow: {
        notBefore: BigInt(now - 3600),
        notAfter: BigInt(now + 3600),
      },
    };

    expect(isDelegationTimeValid(config)).toBe(true);
  });

  it('should return false before time window', () => {
    const now = Math.floor(Date.now() / 1000);
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      timeWindow: {
        notBefore: BigInt(now + 3600),
        notAfter: BigInt(now + 7200),
      },
    };

    expect(isDelegationTimeValid(config)).toBe(false);
  });

  it('should return false after time window', () => {
    const now = Math.floor(Date.now() / 1000);
    const config: CaveatConfig = {
      enforcerAddresses: MOCK_ENFORCER_ADDRESSES,
      timeWindow: {
        notBefore: BigInt(now - 7200),
        notAfter: BigInt(now - 3600),
      },
    };

    expect(isDelegationTimeValid(config)).toBe(false);
  });
});
