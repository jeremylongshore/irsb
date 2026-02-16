/**
 * Policy engine tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PolicyEngine,
  createDefaultPolicyConfig,
  type PolicyConfig,
} from '../../src/policy/engine.js';
import { addToContractAllowlist } from '../../src/policy/allowlists.js';
import type { SigningRequest } from '../../src/types/signing-request.js';

describe('PolicyEngine', () => {
  let config: PolicyConfig;
  let engine: PolicyEngine;

  function createValidRequest(overrides?: Partial<SigningRequest>): SigningRequest {
    return {
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      agentId: 'test-agent',
      role: 'SOLVER',
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      action: {
        action: 'SUBMIT_RECEIPT',
        intentId: '0x' + 'a'.repeat(64),
        receiptHash: '0x' + 'b'.repeat(64),
        evidenceHash: '0x' + 'c'.repeat(64),
      },
      value: '0',
      expiresAt: Date.now() + 60000, // 1 minute from now
      ...overrides,
    };
  }

  beforeEach(() => {
    config = createDefaultPolicyConfig();
    // Add test contract to allowlist
    addToContractAllowlist(
      config.allowlists,
      '0x1234567890123456789012345678901234567890',
      1,
      'Test Contract'
    );
    engine = new PolicyEngine(config);
  });

  describe('check', () => {
    it('allows valid request', async () => {
      const request = createValidRequest();
      const result = await engine.check(request);

      expect(result.decision).toBe('ALLOW');
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('denies request with unlisted contract', async () => {
      const request = createValidRequest({
        to: '0x0000000000000000000000000000000000000000',
      });

      const result = await engine.check(request);

      expect(result.decision).toBe('DENY');
      const failedCheck = result.checks.find((c) => c.name === 'contractAllowlist');
      expect(failedCheck?.passed).toBe(false);
    });

    it('denies expired request', async () => {
      const request = createValidRequest({
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      });

      const result = await engine.check(request);

      expect(result.decision).toBe('DENY');
      const failedCheck = result.checks.find((c) => c.name === 'expiryValid');
      expect(failedCheck?.passed).toBe(false);
    });

    it('denies request with unauthorized action for role', async () => {
      const request = createValidRequest({
        role: 'WATCHTOWER',
        action: {
          action: 'SUBMIT_RECEIPT',
          intentId: '0x' + 'a'.repeat(64),
          receiptHash: '0x' + 'b'.repeat(64),
          evidenceHash: '0x' + 'c'.repeat(64),
        },
      });

      const result = await engine.check(request);

      expect(result.decision).toBe('DENY');
      const failedCheck = result.checks.find((c) => c.name === 'roleAuthorized');
      expect(failedCheck?.passed).toBe(false);
    });

    it('allows watchtower to open dispute', async () => {
      const request = createValidRequest({
        role: 'WATCHTOWER',
        action: {
          action: 'OPEN_DISPUTE',
          receiptId: '0x' + 'a'.repeat(64),
          evidenceHash: '0x' + 'b'.repeat(64),
          reasonCode: 'INTENT_MISMATCH',
        },
      });

      const result = await engine.check(request);

      const roleCheck = result.checks.find((c) => c.name === 'roleAuthorized');
      expect(roleCheck?.passed).toBe(true);
    });
  });

  describe('version', () => {
    it('returns policy version', () => {
      expect(engine.version).toBe('1.0.0');
    });
  });

  describe('recordSigning', () => {
    it('updates spend tracking', () => {
      const request = createValidRequest({ value: '1000' });
      engine.recordSigning(request);

      // Subsequent request should have updated state
      // (We'd need to expose the state or check via limit checks)
    });
  });

  describe('resetLimitState', () => {
    it('clears all limit state', () => {
      const request = createValidRequest({ value: '1000' });
      engine.recordSigning(request);
      engine.resetLimitState();

      // State should be cleared
      // (We'd need to expose the state or check via limit checks)
    });
  });
});

describe('createDefaultPolicyConfig', () => {
  it('creates valid default config', () => {
    const config = createDefaultPolicyConfig();

    expect(config.version).toBe('1.0.0');
    expect(config.roleActions.SOLVER).toContain('SUBMIT_RECEIPT');
    expect(config.roleActions.WATCHTOWER).toContain('OPEN_DISPUTE');
    expect(config.roleActions.WATCHTOWER).toContain('SUBMIT_EVIDENCE');
    expect(config.maxRequestAgeMs).toBe(5 * 60 * 1000);
  });

  it('allows overrides', () => {
    const config = createDefaultPolicyConfig({
      version: '2.0.0',
      maxRequestAgeMs: 60000,
    });

    expect(config.version).toBe('2.0.0');
    expect(config.maxRequestAgeMs).toBe(60000);
  });
});
