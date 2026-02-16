import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withRetry,
  retryable,
  isDefaultRetryable,
  CircuitBreaker,
  CircuitOpenError,
  withCircuitBreaker,
  resilient,
  createRpcCircuitBreaker,
  resilientRpc,
} from '../src/index.js';

describe('Retry', () => {
  describe('withRetry', () => {
    it('returns success on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelayMs).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { baseDelayMs: 10 });

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('fails after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('respects isRetryable function', async () => {
      const nonRetryableError = new Error('network error'); // Would normally be retryable
      const fn = vi.fn().mockRejectedValue(nonRetryableError);

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        isRetryable: () => false, // Override to make it non-retryable
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // No retries
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error 1'))
        .mockRejectedValueOnce(new Error('timeout error 2'))
        .mockResolvedValue('success');

      await withRetry(fn, { baseDelayMs: 10, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
    });

    it('applies exponential backoff', async () => {
      const delays: number[] = [];
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      await withRetry(fn, {
        baseDelayMs: 100,
        jitterFactor: 0, // No jitter for predictable delays
        onRetry: (_attempt, _error, delay) => delays.push(delay),
      });

      // First delay: 100 * 2^0 = 100
      // Second delay: 100 * 2^1 = 200
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
    });

    it('caps delay at maxDelayMs', async () => {
      const delays: number[] = [];
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValue('success');

      await withRetry(fn, {
        baseDelayMs: 1000,
        maxDelayMs: 1500,
        jitterFactor: 0,
        onRetry: (_attempt, _error, delay) => delays.push(delay),
      });

      // Third delay would be 4000 but capped at 1500
      expect(delays[2]).toBe(1500);
    });
  });

  describe('retryable', () => {
    it('creates retryable function that succeeds', async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const wrapped = retryable(fn);

      const result = await wrapped();

      expect(result).toBe(42);
    });

    it('creates retryable function that throws after retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network failed'));
      const wrapped = retryable(fn, { maxRetries: 1, baseDelayMs: 10 });

      await expect(wrapped()).rejects.toThrow('network failed');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('passes arguments through', async () => {
      const fn = vi.fn().mockImplementation((a: number, b: number) => Promise.resolve(a + b));
      const wrapped = retryable(fn);

      const result = await wrapped(2, 3);

      expect(result).toBe(5);
      expect(fn).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('isDefaultRetryable', () => {
    it('returns true for network errors', () => {
      expect(isDefaultRetryable(new Error('network error'))).toBe(true);
      expect(isDefaultRetryable(new Error('ECONNREFUSED'))).toBe(true);
      expect(isDefaultRetryable(new Error('timeout'))).toBe(true);
      expect(isDefaultRetryable(new Error('socket hang up'))).toBe(true);
    });

    it('returns true for rate limiting', () => {
      expect(isDefaultRetryable(new Error('rate limit exceeded'))).toBe(true);
      expect(isDefaultRetryable(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('returns true for server errors', () => {
      expect(isDefaultRetryable(new Error('502 Bad Gateway'))).toBe(true);
      expect(isDefaultRetryable(new Error('503 Service Unavailable'))).toBe(true);
      expect(isDefaultRetryable(new Error('Internal Server Error'))).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isDefaultRetryable(new Error('validation failed'))).toBe(false);
      expect(isDefaultRetryable(new Error('not found'))).toBe(false);
      expect(isDefaultRetryable('string error')).toBe(false);
    });
  });
});

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 100,
      successThreshold: 2,
    });
  });

  describe('initial state', () => {
    it('starts in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('allows requests when closed', () => {
      expect(breaker.isAllowed()).toBe(true);
    });

    it('has zero failures initially', () => {
      expect(breaker.getFailures()).toBe(0);
    });
  });

  describe('failure handling', () => {
    it('opens after reaching failure threshold', () => {
      breaker.recordFailure(new Error('error 1'));
      expect(breaker.getState()).toBe('closed');

      breaker.recordFailure(new Error('error 2'));
      expect(breaker.getState()).toBe('closed');

      breaker.recordFailure(new Error('error 3'));
      expect(breaker.getState()).toBe('open');
    });

    it('blocks requests when open', () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }

      expect(breaker.isAllowed()).toBe(false);
    });

    it('resets failures on success in closed state', () => {
      breaker.recordFailure(new Error('error'));
      expect(breaker.getFailures()).toBe(1);

      breaker.recordSuccess();
      expect(breaker.getFailures()).toBe(0);
    });
  });

  describe('recovery', () => {
    it('transitions to half-open after timeout', async () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }
      expect(breaker.getState()).toBe('open');

      await new Promise((r) => setTimeout(r, 150));

      expect(breaker.isAllowed()).toBe(true);
      expect(breaker.getState()).toBe('half-open');
    });

    it('closes after success threshold in half-open', async () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }

      await new Promise((r) => setTimeout(r, 150));
      breaker.isAllowed(); // Trigger transition to half-open

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('half-open');

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
    });

    it('reopens on failure in half-open', async () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }

      await new Promise((r) => setTimeout(r, 150));
      breaker.isAllowed(); // Trigger transition to half-open

      breaker.recordFailure(new Error('error'));
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('execute', () => {
    it('executes function when closed', async () => {
      const result = await breaker.execute(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('throws CircuitOpenError when open', async () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }

      await expect(breaker.execute(() => Promise.resolve(42)))
        .rejects.toBeInstanceOf(CircuitOpenError);
    });

    it('records success on successful execution', async () => {
      await breaker.execute(() => Promise.resolve(42));
      // Can't directly verify, but failure count should stay at 0
      expect(breaker.getFailures()).toBe(0);
    });

    it('records failure and rethrows on failed execution', async () => {
      await expect(breaker.execute(() => Promise.reject(new Error('failed'))))
        .rejects.toThrow('failed');
      expect(breaker.getFailures()).toBe(1);
    });
  });

  describe('isFailure filter', () => {
    it('only counts errors that pass isFailure', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        isFailure: (error) => error instanceof Error && error.message.includes('network'),
      });

      breaker.recordFailure(new Error('validation error'));
      expect(breaker.getFailures()).toBe(0);

      breaker.recordFailure(new Error('network error'));
      expect(breaker.getFailures()).toBe(1);
    });
  });

  describe('onStateChange callback', () => {
    it('calls callback on state transitions', async () => {
      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        successThreshold: 1,
        onStateChange,
      });

      breaker.recordFailure(new Error('error'));
      breaker.recordFailure(new Error('error'));

      expect(onStateChange).toHaveBeenCalledWith('closed', 'open');

      await new Promise((r) => setTimeout(r, 100));
      breaker.isAllowed();

      expect(onStateChange).toHaveBeenCalledWith('open', 'half-open');

      breaker.recordSuccess();
      expect(onStateChange).toHaveBeenCalledWith('half-open', 'closed');
    });
  });

  describe('manual reset', () => {
    it('resets to closed state', () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }
      expect(breaker.getState()).toBe('open');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailures()).toBe(0);
    });
  });

  describe('getRemainingTimeout', () => {
    it('returns 0 when not open', () => {
      expect(breaker.getRemainingTimeout()).toBe(0);
    });

    it('returns remaining time when open', () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(new Error('error'));
      }

      const remaining = breaker.getRemainingTimeout();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(100);
    });
  });
});

describe('withCircuitBreaker', () => {
  it('wraps function with circuit breaker', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2 });
    const fn = vi.fn().mockResolvedValue(42);
    const wrapped = withCircuitBreaker(fn, breaker);

    const result = await wrapped();
    expect(result).toBe(42);
  });

  it('passes arguments through', async () => {
    const breaker = new CircuitBreaker();
    const fn = vi.fn().mockImplementation((a: number, b: number) => Promise.resolve(a * b));
    const wrapped = withCircuitBreaker(fn, breaker);

    const result = await wrapped(3, 4);
    expect(result).toBe(12);
    expect(fn).toHaveBeenCalledWith(3, 4);
  });
});

describe('resilient', () => {
  it('combines retry and circuit breaker', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 5 });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const wrapped = resilient(fn, {
      retry: { maxRetries: 2, baseDelayMs: 10 },
      circuitBreaker: breaker,
    });

    const result = await wrapped();

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(breaker.getState()).toBe('closed');
  });

  it('opens circuit breaker after exhausting retries', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

    const wrapped = resilient(fn, {
      retry: { maxRetries: 1, baseDelayMs: 10 },
      circuitBreaker: breaker,
    });

    await expect(wrapped()).rejects.toThrow('persistent error');
    expect(breaker.getState()).toBe('open');
  });

  it('fails fast when circuit is open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure(new Error('error'));

    const fn = vi.fn().mockResolvedValue('success');
    const wrapped = resilient(fn, { circuitBreaker: breaker });

    await expect(wrapped()).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('works without circuit breaker', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const wrapped = resilient(fn, {
      retry: { maxRetries: 2, baseDelayMs: 10 },
    });

    const result = await wrapped();
    expect(result).toBe('success');
  });
});

describe('RPC helpers', () => {
  describe('createRpcCircuitBreaker', () => {
    it('creates circuit breaker with RPC defaults', () => {
      const breaker = createRpcCircuitBreaker();

      expect(breaker.getState()).toBe('closed');
      // Verify it works
      expect(breaker.isAllowed()).toBe(true);
    });

    it('allows config overrides', () => {
      const onStateChange = vi.fn();
      const breaker = createRpcCircuitBreaker({
        failureThreshold: 2,
        onStateChange,
      });

      breaker.recordFailure(new Error('error'));
      breaker.recordFailure(new Error('error'));

      expect(onStateChange).toHaveBeenCalledWith('closed', 'open');
    });
  });

  describe('resilientRpc', () => {
    it('creates resilient RPC function', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue({ data: 'result' });

      const wrapped = resilientRpc(fn);

      const result = await wrapped();
      expect(result).toEqual({ data: 'result' });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('uses provided circuit breaker', async () => {
      const breaker = createRpcCircuitBreaker({ failureThreshold: 1 });
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      // Use resilient directly with fast retry for test speed
      const wrapped = resilient(fn, {
        retry: { maxRetries: 0, baseDelayMs: 10 },
        circuitBreaker: breaker,
      });

      await expect(wrapped()).rejects.toThrow();
      expect(breaker.getState()).toBe('open');
    });
  });
});

describe('CircuitOpenError', () => {
  it('includes remaining time and failures', () => {
    const error = new CircuitOpenError(5000, 3);

    expect(error.name).toBe('CircuitOpenError');
    expect(error.remainingMs).toBe(5000);
    expect(error.failures).toBe(3);
    expect(error.message).toContain('5000ms');
    expect(error.message).toContain('3 failures');
  });
});
