/**
 * IRSB Typed Actions
 *
 * The signer MUST reject any request that isn't one of these typed actions.
 * No "sign this arbitrary digest" API. Ever.
 */

import { z } from 'zod';

/**
 * Dispute reason codes aligned with IRSB protocol
 */
export const DisputeReasonSchema = z.enum([
  'INTENT_MISMATCH', // Execution doesn't match declared intent
  'EVIDENCE_INVALID', // Evidence hash doesn't match claimed evidence
  'SLIPPAGE_EXCEEDED', // Execution exceeded allowed slippage
  'TIMEOUT_VIOLATION', // Receipt submitted after deadline
  'MALFORMED_RECEIPT', // Receipt structure invalid
  'DUPLICATE_EXECUTION', // Intent already executed
]);

export type DisputeReason = z.infer<typeof DisputeReasonSchema>;

/**
 * Submit a receipt for an executed intent
 */
export const SubmitReceiptActionSchema = z.object({
  action: z.literal('SUBMIT_RECEIPT'),
  intentId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
  receiptHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
  evidenceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
});

export type SubmitReceiptAction = z.infer<typeof SubmitReceiptActionSchema>;

/**
 * Open a dispute against a receipt
 */
export const OpenDisputeActionSchema = z.object({
  action: z.literal('OPEN_DISPUTE'),
  receiptId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
  evidenceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
  reasonCode: DisputeReasonSchema,
});

export type OpenDisputeAction = z.infer<typeof OpenDisputeActionSchema>;

/**
 * Submit additional evidence for an open dispute
 */
export const SubmitEvidenceActionSchema = z.object({
  action: z.literal('SUBMIT_EVIDENCE'),
  disputeId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
  evidenceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be 32-byte hex'),
});

export type SubmitEvidenceAction = z.infer<typeof SubmitEvidenceActionSchema>;

/**
 * Union of all valid IRSB actions
 */
export const IrsbActionSchema = z.discriminatedUnion('action', [
  SubmitReceiptActionSchema,
  OpenDisputeActionSchema,
  SubmitEvidenceActionSchema,
]);

export type IrsbAction = z.infer<typeof IrsbActionSchema>;

/**
 * Action type literal for type guards
 */
export const IRSB_ACTION_TYPES = ['SUBMIT_RECEIPT', 'OPEN_DISPUTE', 'SUBMIT_EVIDENCE'] as const;
export type IrsbActionType = (typeof IRSB_ACTION_TYPES)[number];

/**
 * Type guard for IRSB actions
 */
export function isIrsbAction(value: unknown): value is IrsbAction {
  return IrsbActionSchema.safeParse(value).success;
}

/**
 * Parse and validate an IRSB action
 */
export function parseIrsbAction(value: unknown): IrsbAction {
  return IrsbActionSchema.parse(value);
}
