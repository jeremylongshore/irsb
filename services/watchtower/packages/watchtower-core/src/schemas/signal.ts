import { z } from 'zod';

export const SeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeverityEnum>;

export const EvidenceLinkSchema = z.object({
  type: z.string(),
  ref: z.string(),
});
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

export const SignalSchema = z.object({
  signalId: z.string().min(1),
  severity: SeverityEnum,
  weight: z.number().min(0).max(1),
  observedAt: z.number().int(),
  evidence: z.array(EvidenceLinkSchema),
  details: z.record(z.unknown()).optional(),
});

export type Signal = z.infer<typeof SignalSchema>;
