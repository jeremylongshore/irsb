// Schemas
export {
  AgentSchema,
  AgentStatusEnum,
  SignalSchema,
  SeverityEnum,
  EvidenceLinkSchema,
  SnapshotSchema,
  RiskReportSchema,
  ConfidenceEnum,
  AlertSchema,
} from './schemas/index.js';

export type {
  Agent,
  AgentStatus,
  Signal,
  Severity,
  EvidenceLink,
  Snapshot,
  RiskReport,
  Confidence,
  Alert,
} from './schemas/index.js';

// Utils
export { canonicalJson, sha256Hex, sortSignals, sortEvidence } from './utils/index.js';

// Scoring
export { scoreAgent } from './scoring/index.js';

// Storage
export {
  initDb,
  initDbWithInlineMigrations,
  upsertAgent,
  getAgent,
  listAgents,
  insertSnapshot,
  getLatestSnapshots,
  insertAlerts,
  listAlerts,
  insertRiskReport,
  getLatestRiskReport,
} from './storage/index.js';

// Integrations
export {
  SolverReceiptV0Schema,
  ArtifactEntrySchema,
  normalizeReceipt,
} from './integrations/index.js';

export type {
  SolverReceiptV0,
  ArtifactEntry,
  NormalizedReceipt,
  DeliveredArtifact,
} from './integrations/index.js';

// Behavior
export {
  verifyEvidence,
  deriveBehaviorSignals,
  ingestReceipt,
} from './behavior/index.js';

export type {
  VerificationResult,
  VerificationFailure,
  VerifyOptions,
  FailureCode,
  IngestResult,
} from './behavior/index.js';

// Identity
export {
  makeAgentId,
  parseAgentId,
  IdentityConfigSchema,
  AgentCardSchema,
  AgentCardServiceSchema,
  AgentCardRegistrationSchema,
  fetchAgentCard,
  getCursor,
  setCursor,
  insertIdentityEvent,
  getLatestEventForAgent,
  getDistinctAgentTokenIds,
  insertIdentitySnapshot,
  getLatestIdentitySnapshots,
  getDistinctCardHashes,
  pollIdentityEvents,
  deriveIdentitySignals,
  syncIdentityEvents,
  fetchAndScoreIdentities,
} from './identity/index.js';

export type {
  IdentityRegistrationEvent,
  IdentityEventSource,
  CardFetchResult,
  CardFetchStatus,
  IdentityConfig,
  AgentCard,
  IdentitySnapshotRow,
  IdentityEventRow,
  PollResult,
  SyncResult,
  FetchResult,
  CardFetchOptions,
  FetchOptions,
  DnsLookupFn,
} from './identity/index.js';

// Context
export {
  ContextConfigSchema,
  classifyFunding,
  parseTagFile,
  deriveContextSignals,
  getContextCursor,
  setContextCursor,
  syncAndScoreContext,
} from './context/index.js';

export type {
  TransactionInfo,
  TokenTransferInfo,
  FundingKind,
  FundingSource,
  ContextDataSource,
  ContextConfig,
  AddressTagMap,
  ContextSignalInput,
  ContextSyncOptions,
  ContextSyncResult,
} from './context/index.js';

// Signing
export {
  generateKeyPair,
  saveKeyPair,
  loadKeyPair,
  keyFileExists,
  ensureKeyPair,
  signReport,
  verifyReportSignature,
  signData,
  verifyData,
} from './signing/index.js';

export type {
  WatchtowerKeyPair,
  ReportSignature,
} from './signing/index.js';

// Transparency
export {
  createLeaf,
  verifyLeaf,
  logFilePath,
  appendLeaf,
  verifyLogFile,
  readLogFile,
} from './transparency/index.js';

export type {
  TransparencyLeaf,
  LeafInput,
  VerifyLogResult,
} from './transparency/index.js';
