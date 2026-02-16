/**
 * IRSB State Validator
 *
 * Validates that on-chain state allows the requested action.
 * Queries the IRSB protocol contracts to verify state transitions are valid.
 */

import type { PolicyCheck } from '../types/audit-artifact.js';
import type { IrsbAction } from '../types/actions.js';

/**
 * State validator configuration
 */
export interface StateValidatorConfig {
  /**
   * Whether state validation is enabled
   */
  enabled: boolean;

  /**
   * RPC URL for chain queries
   */
  rpcUrl: string;

  /**
   * IRSB protocol contract addresses by chain ID
   */
  protocolContracts?: Map<number, string>;

  /**
   * Cache TTL in milliseconds
   */
  cacheTtlMs?: number;
}

/**
 * State validation result
 */
export interface StateValidationResult {
  valid: boolean;
  reason?: string;
  currentState?: string;
}

/**
 * Check if an IRSB action is valid given current on-chain state
 */
export async function checkStateTransition(
  action: IrsbAction,
  chainId: number,
  config: StateValidatorConfig
): Promise<PolicyCheck> {
  // Skip if validation is disabled
  if (!config.enabled) {
    return {
      name: 'stateTransitionValid',
      passed: true,
      metadata: { skipped: true, reason: 'State validation disabled' },
    };
  }

  try {
    const result = await validateAction(action, chainId, config);

    if (!result.valid) {
      return {
        name: 'stateTransitionValid',
        passed: false,
        reason: result.reason ?? 'Invalid state transition',
        metadata: {
          action: action.action,
          chainId,
          currentState: result.currentState,
        },
      };
    }

    return {
      name: 'stateTransitionValid',
      passed: true,
      metadata: {
        action: action.action,
        chainId,
        currentState: result.currentState,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      name: 'stateTransitionValid',
      passed: false,
      reason: `State validation failed: ${message}`,
      metadata: { error: message },
    };
  }
}

/**
 * Validate an action against on-chain state
 */
async function validateAction(
  action: IrsbAction,
  chainId: number,
  config: StateValidatorConfig
): Promise<StateValidationResult> {
  // TODO: Implement actual chain queries
  // For now, return a stub that always passes

  switch (action.action) {
    case 'SUBMIT_RECEIPT':
      return validateSubmitReceipt(action.intentId, chainId, config);

    case 'OPEN_DISPUTE':
      return validateOpenDispute(action.receiptId, chainId, config);

    case 'SUBMIT_EVIDENCE':
      return validateSubmitEvidence(action.disputeId, chainId, config);

    default:
      // TypeScript exhaustiveness check
      return { valid: false, reason: 'Unknown action type' };
  }
}

/**
 * Validate SUBMIT_RECEIPT action
 */
async function validateSubmitReceipt(
  _intentId: string,
  _chainId: number,
  _config: StateValidatorConfig
): Promise<StateValidationResult> {
  // TODO: Query chain to verify:
  // 1. Intent exists and is not already fulfilled
  // 2. Solver is registered for this intent
  // 3. Deadline has not passed

  return { valid: true, currentState: 'PENDING' };
}

/**
 * Validate OPEN_DISPUTE action
 */
async function validateOpenDispute(
  _receiptId: string,
  _chainId: number,
  _config: StateValidatorConfig
): Promise<StateValidationResult> {
  // TODO: Query chain to verify:
  // 1. Receipt exists
  // 2. Receipt is in FINALIZED state (not already disputed)
  // 3. Dispute window is still open
  // 4. Watchtower has bond staked

  return { valid: true, currentState: 'FINALIZED' };
}

/**
 * Validate SUBMIT_EVIDENCE action
 */
async function validateSubmitEvidence(
  _disputeId: string,
  _chainId: number,
  _config: StateValidatorConfig
): Promise<StateValidationResult> {
  // TODO: Query chain to verify:
  // 1. Dispute exists and is OPEN
  // 2. Evidence submission period is still open
  // 3. Agent is party to the dispute

  return { valid: true, currentState: 'OPEN' };
}

/**
 * Create default state validator config (disabled)
 */
export function createDefaultStateValidatorConfig(): StateValidatorConfig {
  return {
    enabled: false,
    rpcUrl: '',
    protocolContracts: new Map(),
    cacheTtlMs: 30_000, // 30 seconds
  };
}
