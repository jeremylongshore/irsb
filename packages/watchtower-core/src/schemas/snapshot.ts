import { z } from 'zod';
import { SignalSchema } from './signal.js';

export const SnapshotSchema = z.object({
  snapshotId: z.string(),
  agentId: z.string().min(1),
  observedAt: z.number().int(),
  signals: z.array(SignalSchema),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
