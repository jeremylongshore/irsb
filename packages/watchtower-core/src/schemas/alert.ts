import { z } from 'zod';
import { SeverityEnum, EvidenceLinkSchema } from './signal.js';

export const AlertSchema = z.object({
  alertId: z.string(),
  agentId: z.string().min(1),
  type: z.string(),
  severity: SeverityEnum,
  description: z.string(),
  evidenceLinks: z.array(EvidenceLinkSchema),
  createdAt: z.number().int(),
  isActive: z.boolean(),
});

export type Alert = z.infer<typeof AlertSchema>;
