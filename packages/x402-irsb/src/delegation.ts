/**
 * Delegation helpers for EIP-7702 buyer authorization
 *
 * Build, sign, and manage delegations that allow the WalletDelegate
 * contract to execute payments on behalf of a buyer's EOA.
 */

import type {
  CaveatConfig,
  BuyerDelegationConfig,
  DelegationResult,
  EIP7702Authorization,
} from './types.js';

/**
 * Build a delegation authorization for EIP-7702
 *
 * @param config - Delegation configuration with caveats
 * @returns EIP-7702 authorization object ready for signing
 */
export function buildDelegationAuthorization(config: BuyerDelegationConfig): EIP7702Authorization {
  const { walletDelegateAddress, chainId } = config;

  return {
    chainId,
    address: walletDelegateAddress,
    nonce: config.nonce ?? 0n,
  };
}

/**
 * Build caveat terms from high-level config
 *
 * @param config - Human-readable caveat configuration
 * @returns Array of encoded caveats for the delegation
 */
export function buildCaveats(config: CaveatConfig): Array<{ enforcer: `0x${string}`; terms: `0x${string}` }> {
  const caveats: Array<{ enforcer: `0x${string}`; terms: `0x${string}` }> = [];

  if (config.spendLimit) {
    // ABI encode: (address token, uint256 dailyCap, uint256 perTxCap)
    const encoded = abiEncode(
      ['address', 'uint256', 'uint256'],
      [config.spendLimit.token, config.spendLimit.dailyCap, config.spendLimit.perTxCap],
    );
    caveats.push({
      enforcer: config.enforcerAddresses.spendLimit,
      terms: encoded,
    });
  }

  if (config.timeWindow) {
    const encoded = abiEncode(
      ['uint64', 'uint64'],
      [config.timeWindow.notBefore, config.timeWindow.notAfter],
    );
    caveats.push({
      enforcer: config.enforcerAddresses.timeWindow,
      terms: encoded,
    });
  }

  if (config.allowedTargets) {
    const encoded = abiEncode(['address[]'], [config.allowedTargets.targets]);
    caveats.push({
      enforcer: config.enforcerAddresses.allowedTargets,
      terms: encoded,
    });
  }

  if (config.allowedMethods) {
    const encoded = abiEncode(['bytes4[]'], [config.allowedMethods.selectors]);
    caveats.push({
      enforcer: config.enforcerAddresses.allowedMethods,
      terms: encoded,
    });
  }

  if (config.nonce) {
    const encoded = abiEncode(['uint256'], [config.nonce.startNonce]);
    caveats.push({
      enforcer: config.enforcerAddresses.nonce,
      terms: encoded,
    });
  }

  return caveats;
}

/**
 * Build a complete delegation struct for signing
 *
 * @param config - Full delegation configuration
 * @returns Delegation object with caveats, ready for EIP-712 signing
 */
export function buildDelegation(config: BuyerDelegationConfig): DelegationResult {
  const caveats = buildCaveats(config.caveats);
  const salt = config.salt ?? BigInt(Date.now());

  const delegation = {
    delegator: config.delegator,
    delegate: config.walletDelegateAddress,
    authority: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    caveats,
    salt,
  };

  // Build EIP-712 typed data for signing
  const typedData = {
    domain: {
      name: 'IRSB WalletDelegate',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.walletDelegateAddress,
    },
    types: {
      Delegation: [
        { name: 'delegator', type: 'address' },
        { name: 'delegate', type: 'address' },
        { name: 'authority', type: 'bytes32' },
        { name: 'caveats', type: 'Caveat[]' },
        { name: 'salt', type: 'uint256' },
      ],
      Caveat: [
        { name: 'enforcer', type: 'address' },
        { name: 'terms', type: 'bytes' },
      ],
    },
    primaryType: 'Delegation' as const,
    message: delegation,
  };

  return {
    delegation,
    typedData,
    delegationHash: computeDelegationHash(delegation),
  };
}

/**
 * Compute the delegation hash (same as Solidity TypesDelegation.hashDelegation)
 */
export function computeDelegationHash(delegation: {
  delegator: `0x${string}`;
  delegate: `0x${string}`;
  authority: `0x${string}`;
  caveats: Array<{ enforcer: `0x${string}`; terms: `0x${string}` }>;
  salt: bigint;
}): `0x${string}` {
  // This is a simplified hash computation
  // In production, use viem's hashTypedData or equivalent
  const parts = [
    delegation.delegator,
    delegation.delegate,
    delegation.authority,
    delegation.caveats.length.toString(),
    delegation.salt.toString(),
  ].join(':');

  // Note: For production use, this should match the Solidity EIP-712 hash exactly
  // Using keccak256 from viem/ethers in the actual implementation
  return `0x${Buffer.from(parts).toString('hex').padEnd(64, '0')}` as `0x${string}`;
}

/**
 * Check if a delegation is currently valid based on its caveats
 *
 * @param config - The caveat configuration to check
 * @returns Whether the delegation would pass all time-based checks
 */
export function isDelegationTimeValid(config: CaveatConfig): boolean {
  if (!config.timeWindow) return true;

  const now = BigInt(Math.floor(Date.now() / 1000));
  return now >= config.timeWindow.notBefore && now <= config.timeWindow.notAfter;
}

/**
 * Minimal ABI encoding helper (for building caveat terms)
 * In production, use viem's encodeAbiParameters
 */
function abiEncode(types: string[], values: unknown[]): `0x${string}` {
  // Placeholder: In production, use viem.encodeAbiParameters()
  // This returns a type-safe hex string
  const encoded = types.map((t, i) => `${t}:${String(values[i])}`).join(',');
  return `0x${Buffer.from(encoded).toString('hex')}` as `0x${string}`;
}
