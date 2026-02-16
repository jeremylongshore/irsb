export {
  makeAgentId,
  parseAgentId,
} from './identityTypes.js';

export type {
  IdentityRegistrationEvent,
  IdentityEventSource,
  CardFetchResult,
  CardFetchStatus,
} from './identityTypes.js';

export { IdentityConfigSchema } from './identityConfig.js';
export type { IdentityConfig } from './identityConfig.js';

export { AgentCardSchema, AgentCardServiceSchema, AgentCardRegistrationSchema } from './agentCardSchema.js';
export type { AgentCard } from './agentCardSchema.js';

export { fetchAgentCard } from './agentCardFetcher.js';
export type { FetchOptions as CardFetchOptions, DnsLookupFn } from './agentCardFetcher.js';

export {
  getCursor,
  setCursor,
  insertIdentityEvent,
  getLatestEventForAgent,
  getDistinctAgentTokenIds,
  insertIdentitySnapshot,
  getLatestIdentitySnapshots,
  getDistinctCardHashes,
} from './identityStore.js';

export type { IdentitySnapshotRow, IdentityEventRow } from './identityStore.js';

export { pollIdentityEvents } from './identityPoller.js';
export type { PollResult } from './identityPoller.js';

export { deriveIdentitySignals } from './deriveIdentitySignals.js';

export { syncIdentityEvents, fetchAndScoreIdentities } from './ingestIdentity.js';
export type { SyncResult, FetchResult, FetchOptions } from './ingestIdentity.js';
