/**
 * Spending and Rate Limits
 *
 * Enforce economic limits on signing requests.
 */

import type { PolicyCheck } from '../types/audit-artifact.js';

/**
 * Limit configuration
 */
export interface LimitConfig {
  /**
   * Maximum daily spend per agent (wei)
   */
  dailySpendCapWei: bigint;

  /**
   * Maximum requests per hour per agent
   */
  requestsPerHour: number;

  /**
   * Time window for velocity limit (ms)
   */
  velocityWindowMs?: number;
}

/**
 * Runtime state for limit tracking
 */
export interface LimitState {
  /**
   * Current spend by agent (resets daily)
   */
  spendByAgent: Map<string, bigint>;

  /**
   * Request timestamps by agent
   */
  requestsByAgent: Map<string, number[]>;
}

const DEFAULT_VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check spend cap for an agent
 */
export function checkSpendCap(
  agentId: string,
  value: bigint,
  config: LimitConfig,
  state: LimitState
): PolicyCheck {
  const currentSpend = state.spendByAgent.get(agentId) ?? BigInt(0);
  const newTotal = currentSpend + value;

  if (newTotal > config.dailySpendCapWei) {
    return {
      name: 'spendCap',
      passed: false,
      reason: 'Daily spend cap exceeded',
      metadata: {
        currentSpend: currentSpend.toString(),
        requestedValue: value.toString(),
        dailyCap: config.dailySpendCapWei.toString(),
      },
    };
  }

  return {
    name: 'spendCap',
    passed: true,
    metadata: {
      currentSpend: currentSpend.toString(),
      remainingBudget: (config.dailySpendCapWei - newTotal).toString(),
    },
  };
}

/**
 * Check velocity limit (requests per hour) for an agent
 */
export function checkVelocityLimit(
  agentId: string,
  config: LimitConfig,
  state: LimitState
): PolicyCheck {
  const now = Date.now();
  const windowMs = config.velocityWindowMs ?? DEFAULT_VELOCITY_WINDOW_MS;
  const windowStart = now - windowMs;

  // Get requests in window
  const allRequests = state.requestsByAgent.get(agentId) ?? [];
  const recentRequests = allRequests.filter((t) => t > windowStart);

  // Update state with pruned list
  state.requestsByAgent.set(agentId, recentRequests);

  if (recentRequests.length >= config.requestsPerHour) {
    const oldestInWindow = recentRequests[0];
    const retryAfterMs = oldestInWindow ? oldestInWindow + windowMs - now : windowMs;

    return {
      name: 'velocityLimit',
      passed: false,
      reason: 'Rate limit exceeded',
      metadata: {
        requestsInWindow: recentRequests.length,
        limit: config.requestsPerHour,
        retryAfterMs,
      },
    };
  }

  return {
    name: 'velocityLimit',
    passed: true,
    metadata: {
      requestsInWindow: recentRequests.length,
      limit: config.requestsPerHour,
      remaining: config.requestsPerHour - recentRequests.length,
    },
  };
}

/**
 * Create default limit configuration
 */
export function createDefaultLimitConfig(): LimitConfig {
  return {
    dailySpendCapWei: BigInt('1000000000000000000'), // 1 ETH
    requestsPerHour: 100,
    velocityWindowMs: DEFAULT_VELOCITY_WINDOW_MS,
  };
}

/**
 * Create empty limit state
 */
export function createEmptyLimitState(): LimitState {
  return {
    spendByAgent: new Map(),
    requestsByAgent: new Map(),
  };
}
