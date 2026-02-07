/**
 * Action schema tests
 */

import { describe, it, expect } from 'vitest';
import {
  IrsbActionSchema,
  SubmitReceiptActionSchema,
  OpenDisputeActionSchema,
  SubmitEvidenceActionSchema,
  isIrsbAction,
  parseIrsbAction,
} from '../../src/types/actions.js';

describe('IrsbActionSchema', () => {
  describe('SUBMIT_RECEIPT', () => {
    it('validates valid submit receipt action', () => {
      const action = {
        action: 'SUBMIT_RECEIPT',
        intentId: '0x' + 'a'.repeat(64),
        receiptHash: '0x' + 'b'.repeat(64),
        evidenceHash: '0x' + 'c'.repeat(64),
      };

      const result = SubmitReceiptActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('rejects invalid intentId format', () => {
      const action = {
        action: 'SUBMIT_RECEIPT',
        intentId: 'not-a-hash',
        receiptHash: '0x' + 'b'.repeat(64),
        evidenceHash: '0x' + 'c'.repeat(64),
      };

      const result = SubmitReceiptActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('rejects missing fields', () => {
      const action = {
        action: 'SUBMIT_RECEIPT',
        intentId: '0x' + 'a'.repeat(64),
      };

      const result = SubmitReceiptActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });
  });

  describe('OPEN_DISPUTE', () => {
    it('validates valid open dispute action', () => {
      const action = {
        action: 'OPEN_DISPUTE',
        receiptId: '0x' + 'a'.repeat(64),
        evidenceHash: '0x' + 'b'.repeat(64),
        reasonCode: 'INTENT_MISMATCH',
      };

      const result = OpenDisputeActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('rejects invalid reason code', () => {
      const action = {
        action: 'OPEN_DISPUTE',
        receiptId: '0x' + 'a'.repeat(64),
        evidenceHash: '0x' + 'b'.repeat(64),
        reasonCode: 'INVALID_REASON',
      };

      const result = OpenDisputeActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('accepts all valid reason codes', () => {
      const reasons = [
        'INTENT_MISMATCH',
        'EVIDENCE_INVALID',
        'SLIPPAGE_EXCEEDED',
        'TIMEOUT_VIOLATION',
        'MALFORMED_RECEIPT',
        'DUPLICATE_EXECUTION',
      ];

      for (const reason of reasons) {
        const action = {
          action: 'OPEN_DISPUTE',
          receiptId: '0x' + 'a'.repeat(64),
          evidenceHash: '0x' + 'b'.repeat(64),
          reasonCode: reason,
        };

        const result = OpenDisputeActionSchema.safeParse(action);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('SUBMIT_EVIDENCE', () => {
    it('validates valid submit evidence action', () => {
      const action = {
        action: 'SUBMIT_EVIDENCE',
        disputeId: '0x' + 'a'.repeat(64),
        evidenceHash: '0x' + 'b'.repeat(64),
      };

      const result = SubmitEvidenceActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });
  });

  describe('discriminatedUnion', () => {
    it('correctly discriminates action types', () => {
      const submitReceipt = {
        action: 'SUBMIT_RECEIPT',
        intentId: '0x' + 'a'.repeat(64),
        receiptHash: '0x' + 'b'.repeat(64),
        evidenceHash: '0x' + 'c'.repeat(64),
      };

      const openDispute = {
        action: 'OPEN_DISPUTE',
        receiptId: '0x' + 'a'.repeat(64),
        evidenceHash: '0x' + 'b'.repeat(64),
        reasonCode: 'INTENT_MISMATCH',
      };

      const submitEvidence = {
        action: 'SUBMIT_EVIDENCE',
        disputeId: '0x' + 'a'.repeat(64),
        evidenceHash: '0x' + 'b'.repeat(64),
      };

      expect(IrsbActionSchema.safeParse(submitReceipt).success).toBe(true);
      expect(IrsbActionSchema.safeParse(openDispute).success).toBe(true);
      expect(IrsbActionSchema.safeParse(submitEvidence).success).toBe(true);
    });

    it('rejects unknown action types', () => {
      const unknown = {
        action: 'UNKNOWN_ACTION',
        data: 'whatever',
      };

      const result = IrsbActionSchema.safeParse(unknown);
      expect(result.success).toBe(false);
    });
  });

  describe('isIrsbAction', () => {
    it('returns true for valid actions', () => {
      const action = {
        action: 'SUBMIT_RECEIPT',
        intentId: '0x' + 'a'.repeat(64),
        receiptHash: '0x' + 'b'.repeat(64),
        evidenceHash: '0x' + 'c'.repeat(64),
      };

      expect(isIrsbAction(action)).toBe(true);
    });

    it('returns false for invalid actions', () => {
      expect(isIrsbAction(null)).toBe(false);
      expect(isIrsbAction(undefined)).toBe(false);
      expect(isIrsbAction({})).toBe(false);
      expect(isIrsbAction({ action: 'INVALID' })).toBe(false);
    });
  });

  describe('parseIrsbAction', () => {
    it('returns parsed action for valid input', () => {
      const action = {
        action: 'SUBMIT_RECEIPT',
        intentId: '0x' + 'a'.repeat(64),
        receiptHash: '0x' + 'b'.repeat(64),
        evidenceHash: '0x' + 'c'.repeat(64),
      };

      const parsed = parseIrsbAction(action);
      expect(parsed.action).toBe('SUBMIT_RECEIPT');
    });

    it('throws for invalid input', () => {
      expect(() => parseIrsbAction({})).toThrow();
    });
  });
});
