/**
 * Policy Engine
 *
 * Validates signing requests against configurable policy rules.
 * All checks must pass for a signature to be issued.
 */

import type { SigningRequest, AgentRole } from '../types/signing-request.js';
import type { PolicyCheck, PolicyDecision } from '../types/audit-artifact.js';
import type { IrsbActionType } from '../types/actions.js';
import { checkContractAllowlist, checkMethodAllowlist, type Allowlists } from './allowlists.js';
import { checkSpendCap, checkVelocityLimit, type LimitConfig, type LimitState } from './limits.js';
import { checkStateTransition, type StateValidatorConfig } from './state-validator.js';

/**
 * Policy configuration
 */
export interface PolicyConfig {
  /**
   * Policy version string
   */
  version: string;

  /**
   * Contract and method allowlists
   */
  allowlists: Allowlists;

  /**
   * Spending and rate limits
   */
  limits: LimitConfig;

  /**
   * State validator configuration
   */
  stateValidator: StateValidatorConfig;

  /**
   * Role-to-action mapping
   */
  roleActions: Record<AgentRole, IrsbActionType[]>;

  /**
   * Maximum request age in milliseconds
   */
  maxRequestAgeMs: number;
}

/**
 * Result of running all policy checks
 */
export interface PolicyCheckResult {
  decision: PolicyDecision;
  checks: PolicyCheck[];
}

/**
 * Policy engine for validating signing requests
 */
export class PolicyEngine {
  private readonly config: PolicyConfig;
  private readonly limitState: LimitState;

  constructor(config: PolicyConfig) {
    this.config = config;
    this.limitState = {
      spendByAgent: new Map(),
      requestsByAgent: new Map(),
    };
  }

  /**
   * Get the policy version
   */
  get version(): string {
    return this.config.version;
  }

  /**
   * Run all policy checks on a signing request
   */
  async check(request: SigningRequest): Promise<PolicyCheckResult> {
    const checks: PolicyCheck[] = [];

    // 1. Contract allowlist
    checks.push(
      checkContractAllowlist(request.to, request.chainId, this.config.allowlists)
    );

    // 2. Method allowlist (based on action type)
    checks.push(
      checkMethodAllowlist(request.action.action, this.config.allowlists)
    );

    // 3. Spend cap
    checks.push(
      checkSpendCap(
        request.agentId,
        BigInt(request.value),
        this.config.limits,
        this.limitState
      )
    );

    // 4. Velocity limit
    checks.push(
      checkVelocityLimit(
        request.agentId,
        this.config.limits,
        this.limitState
      )
    );

    // 5. Expiry validation
    checks.push(this.checkExpiry(request));

    // 6. Replay protection (idempotency)
    checks.push(this.checkReplay(request));

    // 7. Role authorization
    checks.push(this.checkRoleAuthorization(request));

    // 8. IRSB state transition (async - calls chain)
    const stateCheck = await checkStateTransition(
      request.action,
      request.chainId,
      this.config.stateValidator
    );
    checks.push(stateCheck);

    // Determine overall decision
    const allPassed = checks.every((c) => c.passed);
    const decision: PolicyDecision = allPassed ? 'ALLOW' : 'DENY';

    return { decision, checks };
  }

  /**
   * Check request expiry
   */
  private checkExpiry(request: SigningRequest): PolicyCheck {
    const now = Date.now();
    const age = request.expiresAt - now;

    if (request.expiresAt <= now) {
      return {
        name: 'expiryValid',
        passed: false,
        reason: 'Request has expired',
        metadata: { expiresAt: request.expiresAt, now },
      };
    }

    if (age > this.config.maxRequestAgeMs) {
      return {
        name: 'expiryValid',
        passed: false,
        reason: 'Request expiry too far in future',
        metadata: { age, maxAge: this.config.maxRequestAgeMs },
      };
    }

    return { name: 'expiryValid', passed: true };
  }

  /**
   * Check for replay attacks (idempotency)
   */
  private checkReplay(request: SigningRequest): PolicyCheck {
    // TODO: Implement idempotency store
    // For now, always pass - will be implemented with nonce management
    return {
      name: 'replayProtection',
      passed: true,
      metadata: { requestId: request.requestId },
    };
  }

  /**
   * Check role authorization for action
   */
  private checkRoleAuthorization(request: SigningRequest): PolicyCheck {
    const allowedActions = this.config.roleActions[request.role];

    if (!allowedActions) {
      return {
        name: 'roleAuthorized',
        passed: false,
        reason: `Unknown role: ${request.role}`,
      };
    }

    const actionType = request.action.action;
    if (!allowedActions.includes(actionType)) {
      return {
        name: 'roleAuthorized',
        passed: false,
        reason: `Role ${request.role} not authorized for ${actionType}`,
        metadata: { role: request.role, action: actionType, allowedActions },
      };
    }

    return { name: 'roleAuthorized', passed: true };
  }

  /**
   * Record a successful signing (updates limit state)
   */
  recordSigning(request: SigningRequest): void {
    const { agentId, value } = request;
    const now = Date.now();

    // Update spend
    const currentSpend = this.limitState.spendByAgent.get(agentId) ?? BigInt(0);
    this.limitState.spendByAgent.set(agentId, currentSpend + BigInt(value));

    // Update request count
    const requests = this.limitState.requestsByAgent.get(agentId) ?? [];
    requests.push(now);
    this.limitState.requestsByAgent.set(agentId, requests);
  }

  /**
   * Reset limit state (for testing or daily reset)
   */
  resetLimitState(): void {
    this.limitState.spendByAgent.clear();
    this.limitState.requestsByAgent.clear();
  }
}

/**
 * Create default policy configuration
 */
export function createDefaultPolicyConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
  return {
    version: '1.0.0',
    allowlists: {
      contracts: new Map(),
      methods: new Set(['SUBMIT_RECEIPT', 'OPEN_DISPUTE', 'SUBMIT_EVIDENCE']),
    },
    limits: {
      dailySpendCapWei: BigInt('1000000000000000000'), // 1 ETH
      requestsPerHour: 100,
    },
    stateValidator: {
      enabled: false,
      rpcUrl: '',
    },
    roleActions: {
      SOLVER: ['SUBMIT_RECEIPT'],
      WATCHTOWER: ['OPEN_DISPUTE', 'SUBMIT_EVIDENCE'],
    },
    maxRequestAgeMs: 5 * 60 * 1000, // 5 minutes
    ...overrides,
  };
}
