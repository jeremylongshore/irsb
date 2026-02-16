/**
 * Contract and Method Allowlists
 *
 * Only approved contracts and methods can be called.
 */

import type { PolicyCheck } from '../types/audit-artifact.js';
import type { IrsbActionType } from '../types/actions.js';

/**
 * Contract allowlist entry
 */
export interface ContractEntry {
  address: string;
  chainId: number;
  name: string;
  addedAt: number;
}

/**
 * Allowlist configuration
 */
export interface Allowlists {
  /**
   * Allowed contracts by address (lowercase)
   */
  contracts: Map<string, ContractEntry>;

  /**
   * Allowed action types (method selectors are derived from action type)
   */
  methods: Set<IrsbActionType>;
}

/**
 * Create a contract key for the allowlist
 */
function contractKey(address: string, chainId: number): string {
  return `${address.toLowerCase()}:${chainId}`;
}

/**
 * Check if a contract is in the allowlist
 */
export function checkContractAllowlist(
  address: string,
  chainId: number,
  allowlists: Allowlists
): PolicyCheck {
  const key = contractKey(address, chainId);
  const entry = allowlists.contracts.get(key);

  if (!entry) {
    return {
      name: 'contractAllowlist',
      passed: false,
      reason: `Contract ${address} on chain ${chainId} not in allowlist`,
      metadata: { address, chainId },
    };
  }

  return {
    name: 'contractAllowlist',
    passed: true,
    metadata: { address, chainId, contractName: entry.name },
  };
}

/**
 * Check if an action type is in the method allowlist
 */
export function checkMethodAllowlist(
  actionType: IrsbActionType,
  allowlists: Allowlists
): PolicyCheck {
  if (!allowlists.methods.has(actionType)) {
    return {
      name: 'methodAllowlist',
      passed: false,
      reason: `Action type ${actionType} not allowed`,
      metadata: { actionType },
    };
  }

  return {
    name: 'methodAllowlist',
    passed: true,
    metadata: { actionType },
  };
}

/**
 * Add a contract to the allowlist
 */
export function addToContractAllowlist(
  allowlists: Allowlists,
  address: string,
  chainId: number,
  name: string
): void {
  const key = contractKey(address, chainId);
  allowlists.contracts.set(key, {
    address: address.toLowerCase(),
    chainId,
    name,
    addedAt: Date.now(),
  });
}

/**
 * Remove a contract from the allowlist
 */
export function removeFromContractAllowlist(
  allowlists: Allowlists,
  address: string,
  chainId: number
): boolean {
  const key = contractKey(address, chainId);
  return allowlists.contracts.delete(key);
}

/**
 * Create empty allowlists
 */
export function createEmptyAllowlists(): Allowlists {
  return {
    contracts: new Map(),
    methods: new Set(),
  };
}

/**
 * Create default allowlists with all IRSB action types enabled
 */
export function createDefaultAllowlists(): Allowlists {
  return {
    contracts: new Map(),
    methods: new Set(['SUBMIT_RECEIPT', 'OPEN_DISPUTE', 'SUBMIT_EVIDENCE']),
  };
}
