import { z } from 'zod';

export const AgentStatusEnum = z.enum(['ACTIVE', 'PROBATION', 'BLOCKED']);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const AgentSchema = z.object({
  agentId: z.string().min(1),
  createdAt: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
  status: AgentStatusEnum.optional(),
});

export type Agent = z.infer<typeof AgentSchema>;
