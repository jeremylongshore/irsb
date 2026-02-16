// Types
export type {
  TransactionInfo,
  TokenTransferInfo,
  FundingKind,
  FundingSource,
  ContextDataSource,
} from './contextTypes.js';

// Config
export { ContextConfigSchema } from './contextConfig.js';
export type { ContextConfig } from './contextConfig.js';

// Classification
export { classifyFunding, parseTagFile } from './classifyFunding.js';
export type { AddressTagMap } from './classifyFunding.js';

// Signals
export { deriveContextSignals } from './deriveContextSignals.js';
export type { ContextSignalInput } from './deriveContextSignals.js';

// Store
export { getContextCursor, setContextCursor } from './contextStore.js';

// Pipeline
export { syncAndScoreContext } from './ingestContext.js';
export type { ContextSyncOptions, ContextSyncResult } from './ingestContext.js';
