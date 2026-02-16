import { z } from 'zod';

export const IdentityConfigSchema = z.object({
  chainId: z.number().int().positive(),
  registryAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid 0x address'),
  startBlock: z.number().int().nonnegative().default(0),
  batchSize: z.number().int().positive().default(10_000),
  confirmations: z.number().int().nonnegative().default(12),
  overlapBlocks: z.number().int().nonnegative().default(50),
  fetchTimeoutMs: z.number().int().positive().default(5_000),
  maxCardBytes: z.number().int().positive().default(2 * 1024 * 1024),
  allowHttp: z.boolean().default(false),
  maxRedirects: z.number().int().nonnegative().default(3),
  churnWindowSeconds: z.number().int().positive().default(604_800),
  churnThreshold: z.number().int().positive().default(3),
  newbornAgeSeconds: z.number().int().positive().default(1_209_600),
});

export type IdentityConfig = z.infer<typeof IdentityConfigSchema>;
