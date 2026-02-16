import { z } from 'zod';

/**
 * Severity levels for findings
 */
export const SeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Finding categories
 */
export const FindingCategorySchema = z.enum([
  'RECEIPT',
  'BOND',
  'DISPUTE',
  'SOLVER',
  'ESCROW',
  'SYSTEM',
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

/**
 * Action types
 */
export const ActionTypeSchema = z.enum([
  'NONE',
  'OPEN_DISPUTE',
  'SUBMIT_EVIDENCE',
  'ESCALATE',
  'NOTIFY',
  'MANUAL_REVIEW',
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

/**
 * Finding evidence record schema
 * This is the serialized format stored in JSONL
 */
export const FindingRecordSchema = z.object({
  /** Unique identifier for this finding */
  id: z.string().min(1),

  /** Rule that generated this finding */
  ruleId: z.string().min(1),

  /** Human-readable title */
  title: z.string().min(1),

  /** Detailed description */
  description: z.string(),

  /** Severity level */
  severity: SeveritySchema,

  /** Category of finding */
  category: FindingCategorySchema,

  /** ISO timestamp when finding was created */
  timestamp: z.string().datetime(),

  /** Block number as string (for BigInt serialization) */
  blockNumber: z.string(),

  /** Chain ID */
  chainId: z.number().int(),

  /** Transaction hash (if applicable) */
  txHash: z.string().optional(),

  /** Contract address involved */
  contractAddress: z.string().optional(),

  /** Solver ID involved */
  solverId: z.string().optional(),

  /** Receipt ID involved */
  receiptId: z.string().optional(),

  /** Recommended action */
  recommendedAction: ActionTypeSchema,

  /** Additional metadata */
  metadata: z.record(z.unknown()).default({}),

  /** Whether this finding has been acted upon */
  actedUpon: z.boolean().default(false),

  /** Transaction hash of action taken (if any) */
  actionTxHash: z.string().optional(),
});

export type FindingRecord = z.infer<typeof FindingRecordSchema>;

/**
 * Action result record schema
 */
export const ActionResultRecordSchema = z.object({
  /** Unique ID for this action result */
  id: z.string().min(1),

  /** Finding ID this action was for */
  findingId: z.string().min(1),

  /** Receipt ID that was acted upon */
  receiptId: z.string(),

  /** Type of action taken */
  actionType: ActionTypeSchema,

  /** Whether the action succeeded */
  success: z.boolean(),

  /** Was this a dry run? */
  dryRun: z.boolean().default(false),

  /** Transaction hash (if action was executed) */
  txHash: z.string().optional(),

  /** Error message (if action failed) */
  error: z.string().optional(),

  /** ISO timestamp when action was executed */
  timestamp: z.string().datetime(),

  /** Chain ID */
  chainId: z.number().int(),

  /** Block number when action was submitted (as string) */
  blockNumber: z.string().optional(),
});

export type ActionResultRecord = z.infer<typeof ActionResultRecordSchema>;

/**
 * Generic evidence record wrapper for JSONL lines
 */
export const EvidenceLineSchema = z.object({
  /** Type of record */
  type: z.enum(['finding', 'action']),

  /** Version of the schema */
  schemaVersion: z.literal(1),

  /** The actual record data */
  data: z.union([FindingRecordSchema, ActionResultRecordSchema]),
});

export type EvidenceLine = z.infer<typeof EvidenceLineSchema>;
