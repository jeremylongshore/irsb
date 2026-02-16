/**
 * Signing service tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SigningService, type ServiceConfig } from '../../src/server/service.js';
import type { SigningRequest } from '../../src/types/signing-request.js';

describe('SigningService', () => {
  let service: SigningService;

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
      expiresAt: Date.now() + 60000,
      ...overrides,
    };
  }

  beforeEach(() => {
    const config: ServiceConfig = {
      irsbContracts: new Map([[1, '0x1234567890123456789012345678901234567890']]),
      defaultGasLimit: BigInt(200000),
      useEip1559: true,
    };
    service = new SigningService(config);
  });

  describe('isSigningEnabled', () => {
    it('returns false when Lit not configured', () => {
      expect(service.isSigningEnabled()).toBe(false);
    });
  });

  describe('getSignerType', () => {
    it('returns none when Lit not configured', () => {
      expect(service.getSignerType()).toBe('none');
    });
  });

  describe('getAddress', () => {
    it('returns null when Lit not configured', async () => {
      const address = await service.getAddress();
      expect(address).toBeNull();
    });
  });

  describe('getPolicyVersion', () => {
    it('returns policy version', () => {
      expect(service.getPolicyVersion()).toBe('1.0.0');
    });
  });

  describe('sign', () => {
    it('returns error when Lit not configured', async () => {
      const request = createValidRequest();
      const result = await service.sign(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toBe('Signing not configured');
      }
    });

    it('returns policy denied for unauthorized role/action', async () => {
      const request = createValidRequest({
        role: 'WATCHTOWER',
        action: {
          action: 'SUBMIT_RECEIPT',
          intentId: '0x' + 'a'.repeat(64),
          receiptHash: '0x' + 'b'.repeat(64),
          evidenceHash: '0x' + 'c'.repeat(64),
        },
      });

      const result = await service.sign(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('POLICY_DENIED');
      }
    });

    it('includes audit artifact on failure', async () => {
      const request = createValidRequest();
      const result = await service.sign(request);

      expect(result.success).toBe(false);
      expect(result.artifact).toBeDefined();
      expect(result.artifact?.auditId).toBeDefined();
      expect(result.artifact?.requestId).toBe(request.requestId);
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

      const result = await service.sign(request);

      // Should pass policy but fail on signing (Lit not configured)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toBe('Signing not configured');
      }
    });
  });
});
