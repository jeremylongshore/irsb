/**
 * ERC-7715 Permission Request helpers
 *
 * Build and parse wallet_requestExecutionPermissions requests
 * for dapp UX when setting up buyer delegations.
 */

import type {
  PermissionRequest,
  PermissionResponse,
  CaveatConfig,
  BuyerSetupConfig,
} from './types.js';

/**
 * Build an ERC-7715 permission request for wallet UX
 *
 * @param config - Buyer setup configuration
 * @returns PermissionRequest for wallet_requestExecutionPermissions
 */
export function buildPermissionRequest(config: BuyerSetupConfig): PermissionRequest {
  const permissions: PermissionRequest['permissions'] = [];

  // Spend permission
  if (config.caveats.spendLimit) {
    permissions.push({
      type: 'spend-limit',
      data: {
        token: config.caveats.spendLimit.token,
        dailyLimit: config.caveats.spendLimit.dailyCap.toString(),
        perTransactionLimit: config.caveats.spendLimit.perTxCap.toString(),
      },
    });
  }

  // Time-bound session
  if (config.caveats.timeWindow) {
    permissions.push({
      type: 'session',
      data: {
        validAfter: Number(config.caveats.timeWindow.notBefore),
        validUntil: Number(config.caveats.timeWindow.notAfter),
      },
    });
  }

  // Target restrictions
  if (config.caveats.allowedTargets) {
    permissions.push({
      type: 'target-allowlist',
      data: {
        addresses: config.caveats.allowedTargets.targets,
      },
    });
  }

  // Method restrictions
  if (config.caveats.allowedMethods) {
    permissions.push({
      type: 'method-allowlist',
      data: {
        selectors: config.caveats.allowedMethods.selectors,
      },
    });
  }

  return {
    chainId: config.chainId,
    address: config.walletDelegateAddress,
    permissions,
    expiry: config.caveats.timeWindow
      ? Number(config.caveats.timeWindow.notAfter)
      : Math.floor(Date.now() / 1000) + 86400, // Default 24h
  };
}

/**
 * Parse an ERC-7715 permission response into a CaveatConfig
 *
 * @param response - Response from wallet_requestExecutionPermissions
 * @param enforcerAddresses - Deployed enforcer contract addresses
 * @returns CaveatConfig extracted from the granted permissions
 */
export function parsePermissionResponse(
  response: PermissionResponse,
  enforcerAddresses: CaveatConfig['enforcerAddresses'],
): CaveatConfig {
  const config: CaveatConfig = { enforcerAddresses };

  for (const grant of response.grants) {
    switch (grant.type) {
      case 'spend-limit':
        config.spendLimit = {
          token: grant.data.token as `0x${string}`,
          dailyCap: BigInt(grant.data.dailyLimit),
          perTxCap: BigInt(grant.data.perTransactionLimit),
        };
        break;

      case 'session':
        config.timeWindow = {
          notBefore: BigInt(grant.data.validAfter),
          notAfter: BigInt(grant.data.validUntil),
        };
        break;

      case 'target-allowlist':
        config.allowedTargets = {
          targets: grant.data.addresses as `0x${string}`[],
        };
        break;

      case 'method-allowlist':
        config.allowedMethods = {
          selectors: grant.data.selectors as `0x${string}`[],
        };
        break;
    }
  }

  return config;
}

/**
 * Build a complete buyer setup from an ERC-7715 permission response
 *
 * @param response - Permission response from wallet
 * @param config - Base setup configuration
 * @returns Full BuyerSetupConfig with caveats from the permission response
 */
export function setupFromPermissions(
  response: PermissionResponse,
  config: Omit<BuyerSetupConfig, 'caveats'> & { enforcerAddresses: CaveatConfig['enforcerAddresses'] },
): BuyerSetupConfig {
  const caveats = parsePermissionResponse(response, config.enforcerAddresses);

  return {
    ...config,
    caveats,
  };
}
