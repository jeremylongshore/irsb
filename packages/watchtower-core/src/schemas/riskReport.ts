import { z } from 'zod';
import { EvidenceLinkSchema } from './signal.js';

export const ConfidenceEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type Confidence = z.infer<typeof ConfidenceEnum>;

export const RiskReportSchema = z.object({
  reportVersion: z.literal('0.1.0'),
  reportId: z.string(),
  agentId: z.string().min(1),
  generatedAt: z.number().int(),
  overallRisk: z.number().int().min(0).max(100),
  confidence: ConfidenceEnum,
  reasons: z.array(z.string()),
  evidenceLinks: z.array(EvidenceLinkSchema),
  signals: z.array(
    z.object({
      signalId: z.string(),
      severity: z.string(),
    }),
  ),
});

export type RiskReport = z.infer<typeof RiskReportSchema>;
