/**
 * Resilience patterns for RPC and external service calls
 *
 * Provides:
 * - Retry with exponential backoff and jitter
 * - Circuit breaker pattern
 * - Composable wrappers for async functions
 */

// ============================================================
// Retry with Exponential Backoff
// ============================================================

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;

  /** Jitter factor (0-1), randomizes delay to prevent thundering herd (default: 0.1) */
  jitterFactor?: number;

  /** Function to determine if an error is retryable (default: all errors are retryable) */
  isRetryable?: (error: unknown) => boolean;

  /** Optional callback for retry events */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: +/- jitterFactor * delay
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default function to check if an error is retryable
 * Treats network errors and rate limits as retryable
 */
export function isDefaultRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    ) {
      return true;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return true;
    }

    // RPC-specific errors that are often transient
    if (
      message.includes('internal server error') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('bad gateway') ||
      message.includes('service unavailable')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result with value or error, plus metadata
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitterFactor = 0.1,
    isRetryable = isDefaultRetryable,
    onRetry,
  } = config;

  let lastError: unknown;
  let totalDelayMs = 0;
  let actualAttempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    actualAttempts = attempt + 1;

    try {
      const value = await fn();
      return {
        success: true,
        value,
        attempts: actualAttempts,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < maxRetries && isRetryable(error)) {
        const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor);
        totalDelayMs += delayMs;

        if (onRetry) {
          onRetry(attempt + 1, error, delayMs);
        }

        await sleep(delayMs);
      } else {
        // Not retryable or out of retries
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: actualAttempts,
    totalDelayMs,
  };
}

/**
 * Create a retryable version of an async function
 */
export function retryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  config: RetryConfig = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const result = await withRetry(() => fn(...args), config);
    if (result.success) {
      return result.value as TReturn;
    }
    throw result.error;
  };
}

// ============================================================
// Circuit Breaker
// ============================================================

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Configuration for circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;

  /** Time in ms before attempting to close circuit (default: 30000) */
  resetTimeoutMs?: number;

  /** Number of successful calls in half-open state to close circuit (default: 2) */
  successThreshold?: number;

  /** Function to determine if an error should count as a failure (default: all errors) */
  isFailure?: (error: unknown) => boolean;

  /** Optional callback for state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/**
 * Circuit breaker error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly remainingMs: number,
    public readonly failures: number
  ) {
    super(`Circuit breaker is open. Will retry in ${remainingMs}ms after ${failures} failures.`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit breaker implementation
 *
 * Prevents cascading failures by failing fast when a service is unhealthy
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000,
      successThreshold: config.successThreshold ?? 2,
      isFailure: config.isFailure ?? (() => true),
      onStateChange: config.onStateChange ?? (() => {}),
    };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailures(): number {
    return this.failures;
  }

  /**
   * Check if circuit allows requests
   */
  isAllowed(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }

    // half-open: allow limited requests
    return true;
  }

  /**
   * Get remaining time until circuit can transition from open
   */
  getRemainingTimeout(): number {
    if (this.state !== 'open') {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(error: unknown): void {
    if (!this.config.isFailure(error)) {
      return;
    }

    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Any failure in half-open immediately opens circuit
      this.transitionTo('open');
    } else if (this.state === 'closed' && this.failures >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('closed');
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }

    this.config.onStateChange(oldState, newState);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isAllowed()) {
      throw new CircuitOpenError(this.getRemainingTimeout(), this.failures);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
}

/**
 * Create a circuit-breaker protected version of an async function
 */
export function withCircuitBreaker<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  breaker: CircuitBreaker
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs): Promise<TReturn> => {
    return breaker.execute(() => fn(...args));
  };
}

// ============================================================
// Combined Resilience Wrapper
// ============================================================

/**
 * Configuration for resilient function wrapper
 */
export interface ResilientConfig {
  /** Retry configuration */
  retry?: RetryConfig;

  /** Circuit breaker instance (optional) */
  circuitBreaker?: CircuitBreaker;
}

/**
 * Create a resilient version of an async function with retry and circuit breaker
 *
 * Order of operations:
 * 1. Check circuit breaker (fail fast if open)
 * 2. Execute with retry logic
 * 3. Update circuit breaker based on final result
 */
export function resilient<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  config: ResilientConfig = {}
): (...args: TArgs) => Promise<TReturn> {
  const { retry = {}, circuitBreaker } = config;

  return async (...args: TArgs): Promise<TReturn> => {
    // Check circuit breaker first
    if (circuitBreaker && !circuitBreaker.isAllowed()) {
      throw new CircuitOpenError(
        circuitBreaker.getRemainingTimeout(),
        circuitBreaker.getFailures()
      );
    }

    // Execute with retry
    const result = await withRetry(() => fn(...args), retry);

    // Update circuit breaker
    if (circuitBreaker) {
      if (result.success) {
        circuitBreaker.recordSuccess();
      } else {
        circuitBreaker.recordFailure(result.error);
      }
    }

    if (result.success) {
      return result.value as TReturn;
    }
    throw result.error;
  };
}

// ============================================================
// RPC-Specific Helpers
// ============================================================

/**
 * Default retry configuration optimized for RPC calls
 */
export const RPC_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.2,
  isRetryable: isDefaultRetryable,
};

/**
 * Default circuit breaker configuration for RPC calls
 */
export const RPC_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 2,
};

/**
 * Create a circuit breaker optimized for RPC calls
 */
export function createRpcCircuitBreaker(
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  return new CircuitBreaker({
    ...RPC_CIRCUIT_BREAKER_CONFIG,
    ...config,
  });
}

/**
 * Create a resilient RPC function with default settings
 */
export function resilientRpc<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  circuitBreaker?: CircuitBreaker
): (...args: TArgs) => Promise<TReturn> {
  return resilient(fn, {
    retry: RPC_RETRY_CONFIG,
    circuitBreaker,
  });
}
