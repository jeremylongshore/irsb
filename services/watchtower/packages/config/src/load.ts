import {
  type WatchtowerConfig,
  watchtowerConfigSchema,
  type SignerConfig,
  type SignerType,
  type ChainEntry,
  chainEntrySchema,
} from './schema.js';

/**
 * Parse multi-chain config from CHAINS_CONFIG env var (JSON array)
 */
function parseMultiChainConfig(env: NodeJS.ProcessEnv): ChainEntry[] | undefined {
  const chainsJson = env.CHAINS_CONFIG;
  if (!chainsJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(chainsJson);
    if (!Array.isArray(parsed)) {
      throw new Error('CHAINS_CONFIG must be a JSON array');
    }

    // Validate each entry
    const chains: ChainEntry[] = [];
    for (const entry of parsed) {
      const result = chainEntrySchema.safeParse(entry);
      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid chain entry: ${errors}`);
      }
      chains.push(result.data);
    }

    return chains;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('CHAINS_CONFIG is not valid JSON');
    }
    throw error;
  }
}

/**
 * Build signer config from environment variables based on type
 */
function buildSignerConfig(env: NodeJS.ProcessEnv): SignerConfig | undefined {
  const signerType = env.SIGNER_TYPE as SignerType | undefined;

  if (!signerType) {
    return undefined;
  }

  switch (signerType) {
    case 'local':
      if (!env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is required when SIGNER_TYPE=local');
      }
      return {
        type: 'local',
        privateKey: env.PRIVATE_KEY,
      };

    case 'gcp-kms':
      if (!env.GCP_PROJECT_ID || !env.GCP_KMS_KEYRING || !env.GCP_KMS_KEY) {
        throw new Error(
          'GCP_PROJECT_ID, GCP_KMS_KEYRING, and GCP_KMS_KEY are required when SIGNER_TYPE=gcp-kms'
        );
      }
      return {
        type: 'gcp-kms',
        projectId: env.GCP_PROJECT_ID,
        location: env.GCP_KMS_LOCATION ?? 'us-central1',
        keyring: env.GCP_KMS_KEYRING,
        key: env.GCP_KMS_KEY,
        keyVersion: env.GCP_KMS_KEY_VERSION ?? '1',
      };

    default:
      throw new Error(`Unknown SIGNER_TYPE: ${signerType}`);
  }
}

/**
 * Load and validate configuration from environment variables
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Validated watchtower configuration
 * @throws Error if validation fails
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WatchtowerConfig {
  const rawConfig = {
    chain: {
      rpcUrl: env.RPC_URL,
      chainId: env.CHAIN_ID,
    },
    contracts: {
      solverRegistry: env.SOLVER_REGISTRY_ADDRESS,
      intentReceiptHub: env.INTENT_RECEIPT_HUB_ADDRESS,
      disputeModule: env.DISPUTE_MODULE_ADDRESS,
    },
    chains: parseMultiChainConfig(env),
    signer: buildSignerConfig(env),
    api: {
      port: env.API_PORT,
      host: env.API_HOST,
      enableActions: env.ENABLE_ACTIONS,
    },
    worker: {
      scanIntervalMs: env.SCAN_INTERVAL_MS,
      lookbackBlocks: env.LOOKBACK_BLOCKS,
      postToApi: env.WORKER_POST_TO_API,
      apiUrl: env.API_URL,
    },
    rules: {
      challengeWindowSeconds: env.CHALLENGE_WINDOW_SECONDS,
      minReceiptAgeSeconds: env.MIN_RECEIPT_AGE_SECONDS,
      maxActionsPerScan: env.MAX_ACTIONS_PER_SCAN,
      dryRun: env.DRY_RUN,
      allowlistSolverIds: env.ACTION_ALLOWLIST_SOLVER_IDS,
      allowlistReceiptIds: env.ACTION_ALLOWLIST_RECEIPT_IDS,
      stateDir: env.STATE_DIR,
      blockConfirmations: env.BLOCK_CONFIRMATIONS,
    },
    logging: {
      level: env.LOG_LEVEL,
      format: env.LOG_FORMAT,
    },
    webhook: {
      enabled: env.WEBHOOK_ENABLED,
      url: env.WEBHOOK_URL,
      secret: env.WEBHOOK_SECRET,
      timeoutMs: env.WEBHOOK_TIMEOUT_MS,
      maxRetries: env.WEBHOOK_MAX_RETRIES,
      retryDelayMs: env.WEBHOOK_RETRY_DELAY_MS,
      sendHeartbeat: env.WEBHOOK_SEND_HEARTBEAT,
      heartbeatIntervalMs: env.WEBHOOK_HEARTBEAT_INTERVAL_MS,
    },
    resilience: {
      maxRetries: env.RPC_MAX_RETRIES,
      retryBaseDelayMs: env.RPC_RETRY_BASE_DELAY_MS,
      retryMaxDelayMs: env.RPC_RETRY_MAX_DELAY_MS,
      circuitBreakerFailureThreshold: env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      circuitBreakerResetTimeoutMs: env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      circuitBreakerSuccessThreshold: env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
    },
    evidence: {
      enabled: env.EVIDENCE_ENABLED,
      dataDir: env.EVIDENCE_DATA_DIR,
      maxFileSizeBytes: env.EVIDENCE_MAX_FILE_SIZE_BYTES,
      validateOnWrite: env.EVIDENCE_VALIDATE_ON_WRITE,
    },
    nodeEnv: env.NODE_ENV,
  };

  const result = watchtowerConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Load configuration with graceful defaults for development
 * Falls back to Sepolia testnet addresses if not provided
 */
export function loadConfigWithDefaults(env: NodeJS.ProcessEnv = process.env): WatchtowerConfig {
  const defaults: NodeJS.ProcessEnv = {
    RPC_URL: 'https://rpc.sepolia.org',
    CHAIN_ID: '11155111',
    SOLVER_REGISTRY_ADDRESS: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
    INTENT_RECEIPT_HUB_ADDRESS: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
    DISPUTE_MODULE_ADDRESS: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
    ...env,
  };

  return loadConfig(defaults);
}
