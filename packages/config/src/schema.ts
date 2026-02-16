import { z } from 'zod';

/**
 * Ethereum address validation (0x + 40 hex chars)
 */
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/**
 * Private key validation (0x + 64 hex chars)
 */
const privateKeySchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format');

/**
 * Signer type enumeration
 */
export const signerTypeSchema = z.enum(['local', 'gcp-kms']);
export type SignerType = z.infer<typeof signerTypeSchema>;

/**
 * Log level enumeration
 */
export const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * Log format enumeration
 */
export const logFormatSchema = z.enum(['json', 'pretty']);
export type LogFormat = z.infer<typeof logFormatSchema>;

/**
 * Chain configuration schema
 */
export const chainConfigSchema = z.object({
  rpcUrl: z.string().url('RPC_URL must be a valid URL'),
  chainId: z.coerce.number().int().positive('CHAIN_ID must be a positive integer'),
});
export type ChainConfig = z.infer<typeof chainConfigSchema>;

/**
 * IRSB contract addresses schema
 */
export const irsbContractsSchema = z.object({
  solverRegistry: addressSchema,
  intentReceiptHub: addressSchema,
  disputeModule: addressSchema,
});
export type IrsbContracts = z.infer<typeof irsbContractsSchema>;

/**
 * Multi-chain entry - combines chain config with its contracts
 */
export const chainEntrySchema = z.object({
  /** Human-readable name for this chain (e.g., "sepolia", "mainnet") */
  name: z.string().min(1),

  /** RPC URL for this chain */
  rpcUrl: z.string().url('RPC_URL must be a valid URL'),

  /** Chain ID */
  chainId: z.coerce.number().int().positive('CHAIN_ID must be a positive integer'),

  /** IRSB contract addresses for this chain */
  contracts: irsbContractsSchema,

  /** Whether this chain watcher is enabled (default: true) */
  enabled: z.coerce.boolean().default(true),
});
export type ChainEntry = z.infer<typeof chainEntrySchema>;

/**
 * Multi-chain configuration - array of chain entries
 */
export const multiChainConfigSchema = z.array(chainEntrySchema).min(1);
export type MultiChainConfig = z.infer<typeof multiChainConfigSchema>;

/**
 * Local signer configuration
 */
export const localSignerConfigSchema = z.object({
  type: z.literal('local'),
  privateKey: privateKeySchema,
});
export type LocalSignerConfig = z.infer<typeof localSignerConfigSchema>;

/**
 * GCP KMS signer configuration
 */
export const gcpKmsSignerConfigSchema = z.object({
  type: z.literal('gcp-kms'),
  projectId: z.string().min(1),
  location: z.string().min(1).default('us-central1'),
  keyring: z.string().min(1),
  key: z.string().min(1),
  keyVersion: z.string().min(1).default('1'),
});
export type GcpKmsSignerConfig = z.infer<typeof gcpKmsSignerConfigSchema>;

/**
 * Union of all signer configurations
 */
export const signerConfigSchema = z.discriminatedUnion('type', [
  localSignerConfigSchema,
  gcpKmsSignerConfigSchema,
]);
export type SignerConfig = z.infer<typeof signerConfigSchema>;

/**
 * API server configuration
 */
export const apiConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  enableActions: z.coerce.boolean().default(false),
});
export type ApiConfig = z.infer<typeof apiConfigSchema>;

/**
 * Worker configuration
 */
export const workerConfigSchema = z.object({
  scanIntervalMs: z.coerce.number().int().min(1000).default(60000),
  lookbackBlocks: z.coerce.number().int().min(1).default(1000),
  postToApi: z.coerce.boolean().default(false),
  apiUrl: z.string().url().optional(),
});
export type WorkerConfig = z.infer<typeof workerConfigSchema>;

/**
 * Rule configuration for receipt stale detection
 */
export const ruleConfigSchema = z.object({
  /** Challenge window in seconds (default: 1 hour) */
  challengeWindowSeconds: z.coerce.number().int().min(60).default(3600),

  /** Minimum receipt age before considering it stale (default: equals challenge window) */
  minReceiptAgeSeconds: z.coerce.number().int().min(60).default(3600),

  /** Maximum actions per scan cycle (rate limiting) */
  maxActionsPerScan: z.coerce.number().int().min(0).max(100).default(3),

  /** Dry run mode - if true, findings are logged but no actions taken */
  dryRun: z.coerce.boolean().default(true),

  /** Allowlist of solver IDs (CSV string, empty = all allowed) */
  allowlistSolverIds: z.string().default(''),

  /** Allowlist of receipt IDs (CSV string, empty = all allowed) */
  allowlistReceiptIds: z.string().default(''),

  /** Directory for state files */
  stateDir: z.string().default('.state'),

  /** Block confirmations before processing (reorg safety) */
  blockConfirmations: z.coerce.number().int().min(0).default(6),
});
export type RuleConfig = z.infer<typeof ruleConfigSchema>;

/**
 * Parse CSV allowlist string into array
 */
export function parseAllowlist(csv: string): string[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}

/**
 * Logging configuration
 */
export const loggingConfigSchema = z.object({
  level: logLevelSchema.default('info'),
  format: logFormatSchema.default('pretty'),
});
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;

/**
 * Resilience configuration for RPC retry and circuit breaker
 */
export const resilienceConfigSchema = z.object({
  /** Maximum retry attempts for RPC calls */
  maxRetries: z.coerce.number().int().min(0).max(10).default(3),

  /** Base delay in milliseconds for retry backoff */
  retryBaseDelayMs: z.coerce.number().int().min(100).max(60000).default(1000),

  /** Maximum delay in milliseconds for retry backoff */
  retryMaxDelayMs: z.coerce.number().int().min(100).max(300000).default(10000),

  /** Number of failures before opening circuit breaker */
  circuitBreakerFailureThreshold: z.coerce.number().int().min(1).max(100).default(5),

  /** Time in ms before attempting to close circuit */
  circuitBreakerResetTimeoutMs: z.coerce.number().int().min(1000).max(300000).default(30000),

  /** Number of successes in half-open state to close circuit */
  circuitBreakerSuccessThreshold: z.coerce.number().int().min(1).max(10).default(2),
});
export type ResilienceConfig = z.infer<typeof resilienceConfigSchema>;

/**
 * Evidence store configuration
 */
export const evidenceConfigSchema = z.object({
  /** Enable evidence store */
  enabled: z.coerce.boolean().default(false),

  /** Directory to store evidence files (default: ./data) */
  dataDir: z.string().default('./data'),

  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSizeBytes: z.coerce.number().int().min(1024).default(10 * 1024 * 1024),

  /** Whether to validate records on write (default: true) */
  validateOnWrite: z.coerce.boolean().default(true),
});
export type EvidenceConfig = z.infer<typeof evidenceConfigSchema>;

/**
 * Webhook configuration
 */
export const webhookConfigSchema = z.object({
  /** Enable webhook notifications */
  enabled: z.coerce.boolean().default(false),

  /** Webhook URL to send notifications to */
  url: z.string().url().optional(),

  /** HMAC secret for signing payloads (minimum 32 characters) */
  secret: z.string().min(32).optional(),

  /** Request timeout in milliseconds */
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(10000),

  /** Maximum retry attempts */
  maxRetries: z.coerce.number().int().min(0).max(10).default(3),

  /** Base delay for exponential backoff in ms */
  retryDelayMs: z.coerce.number().int().min(100).max(10000).default(1000),

  /** Send heartbeat notifications */
  sendHeartbeat: z.coerce.boolean().default(false),

  /** Heartbeat interval in milliseconds (default: 60000 = 1 minute) */
  heartbeatIntervalMs: z.coerce.number().int().min(10000).default(60000),
}).refine(
  (data) => !data.enabled || (data.url && data.secret),
  { message: 'WEBHOOK_URL and WEBHOOK_SECRET are required when webhooks are enabled' }
);
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;

/**
 * Complete watchtower configuration
 */
export const watchtowerConfigSchema = z.object({
  /** Single chain config (for backward compatibility) */
  chain: chainConfigSchema,

  /** Single chain contracts (for backward compatibility) */
  contracts: irsbContractsSchema,

  /**
   * Multi-chain configuration (optional)
   * If provided, enables concurrent watchers for multiple chains.
   * When set, `chain` and `contracts` are ignored.
   */
  chains: multiChainConfigSchema.optional(),

  signer: signerConfigSchema.optional(),
  api: apiConfigSchema,
  worker: workerConfigSchema,
  rules: ruleConfigSchema,
  logging: loggingConfigSchema,
  webhook: webhookConfigSchema,
  resilience: resilienceConfigSchema,
  evidence: evidenceConfigSchema,
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});
export type WatchtowerConfig = z.infer<typeof watchtowerConfigSchema>;

/**
 * Get effective chains from config
 * Returns array of chain entries - either from `chains` (multi-chain mode)
 * or a single entry built from `chain` + `contracts` (single-chain mode)
 */
export function getEffectiveChains(config: WatchtowerConfig): ChainEntry[] {
  if (config.chains && config.chains.length > 0) {
    return config.chains.filter(c => c.enabled);
  }

  // Single-chain mode - convert to array format
  return [{
    name: `chain-${config.chain.chainId}`,
    rpcUrl: config.chain.rpcUrl,
    chainId: config.chain.chainId,
    contracts: config.contracts,
    enabled: true,
  }];
}
