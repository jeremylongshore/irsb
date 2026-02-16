import { z } from 'zod';

export const AgentCardServiceSchema = z.object({
  protocol: z.string(),
  endpoint: z.string(),
});

export const AgentCardRegistrationSchema = z.object({
  agentRegistry: z.string(),
  agentId: z.string(),
});

export const AgentCardSchema = z.object({
  type: z.literal('AgentRegistration'),
  name: z.string().max(128),
  description: z.string().optional(),
  services: z.array(AgentCardServiceSchema).default([]),
  active: z.boolean(),
  registrations: z.array(AgentCardRegistrationSchema).default([]),
  supportedTrust: z.array(z.string()).default([]),
});

export type AgentCard = z.infer<typeof AgentCardSchema>;
