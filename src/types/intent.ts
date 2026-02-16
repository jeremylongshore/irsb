/**
 * Intent schema v0.1.0
 *
 * Defines the structure of intents consumed by the solver.
 */

import { z } from "zod";

/**
 * Intent version - must be exact match
 */
export const INTENT_VERSION = "0.1.0" as const;

/**
 * Job types supported by the solver
 */
export const JobTypeSchema = z.enum(["SAFE_REPORT"]);
export type JobType = z.infer<typeof JobTypeSchema>;

/**
 * SAFE_REPORT job inputs
 */
export const SafeReportInputsSchema = z.object({
  subject: z.string().min(1),
  data: z.record(z.unknown()),
});
export type SafeReportInputs = z.infer<typeof SafeReportInputsSchema>;

/**
 * Inputs schema - for now just SAFE_REPORT, will expand with more job types
 */
export const InputsSchema = SafeReportInputsSchema;
export type Inputs = z.infer<typeof InputsSchema>;

/**
 * Constraints (optional, placeholder for Phase 2)
 */
export const ConstraintsSchema = z.record(z.unknown()).optional();
export type Constraints = z.infer<typeof ConstraintsSchema>;

/**
 * Acceptance criteria (optional, placeholder structure)
 */
export const AcceptanceCriteriaItemSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  value: z.unknown().optional(),
});
export type AcceptanceCriteriaItem = z.infer<typeof AcceptanceCriteriaItemSchema>;

export const AcceptanceCriteriaSchema = z.array(AcceptanceCriteriaItemSchema).optional();
export type AcceptanceCriteria = z.infer<typeof AcceptanceCriteriaSchema>;

/**
 * Metadata (optional)
 */
export const MetaSchema = z.record(z.unknown()).optional();
export type Meta = z.infer<typeof MetaSchema>;

/**
 * ISO timestamp string
 */
export const IsoTimestampSchema = z.string().refine(
  (s) => {
    const d = new Date(s);
    return !isNaN(d.getTime());
  },
  { message: "Invalid ISO timestamp" }
);

/**
 * Intent schema v0.1.0
 */
export const IntentV0Schema = z.object({
  intentVersion: z.literal(INTENT_VERSION),
  intentId: z.string().optional(), // Computed if missing
  requester: z.string().min(1),
  createdAt: IsoTimestampSchema,
  expiresAt: IsoTimestampSchema.optional(),
  jobType: JobTypeSchema,
  inputs: InputsSchema,
  constraints: ConstraintsSchema,
  acceptanceCriteria: AcceptanceCriteriaSchema,
  meta: MetaSchema,
});

/**
 * Intent type (may or may not have intentId)
 */
export type IntentV0 = z.infer<typeof IntentV0Schema>;

/**
 * Normalized intent with guaranteed intentId
 */
export interface NormalizedIntent extends IntentV0 {
  intentId: string;
}

/**
 * Validates that an unknown value is a valid IntentV0.
 * Returns the parsed intent or throws ZodError.
 */
export function parseIntent(value: unknown): IntentV0 {
  return IntentV0Schema.parse(value);
}

/**
 * Type guard for IntentV0
 */
export function isIntentV0(value: unknown): value is IntentV0 {
  return IntentV0Schema.safeParse(value).success;
}
