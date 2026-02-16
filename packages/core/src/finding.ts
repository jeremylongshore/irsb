/**
 * Severity levels for findings
 */
export enum Severity {
  /** Informational - no action required */
  INFO = 'INFO',
  /** Low severity - monitor situation */
  LOW = 'LOW',
  /** Medium severity - may require action */
  MEDIUM = 'MEDIUM',
  /** High severity - action recommended */
  HIGH = 'HIGH',
  /** Critical - immediate action required */
  CRITICAL = 'CRITICAL',
}

/**
 * Categories of findings
 */
export enum FindingCategory {
  /** Receipt-related violations */
  RECEIPT = 'RECEIPT',
  /** Bond-related violations */
  BOND = 'BOND',
  /** Dispute-related findings */
  DISPUTE = 'DISPUTE',
  /** Solver behavior findings */
  SOLVER = 'SOLVER',
  /** Escrow-related findings */
  ESCROW = 'ESCROW',
  /** System/operational findings */
  SYSTEM = 'SYSTEM',
}

/**
 * Recommended action types
 */
export enum ActionType {
  /** No action needed */
  NONE = 'NONE',
  /** Open a dispute */
  OPEN_DISPUTE = 'OPEN_DISPUTE',
  /** Submit evidence */
  SUBMIT_EVIDENCE = 'SUBMIT_EVIDENCE',
  /** Escalate to arbitration */
  ESCALATE = 'ESCALATE',
  /** Notify operator */
  NOTIFY = 'NOTIFY',
  /** Manual review required */
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

/**
 * A finding represents a detected issue or notable event
 */
export interface Finding {
  /** Unique identifier for this finding */
  id: string;

  /** Rule that generated this finding */
  ruleId: string;

  /** Human-readable title */
  title: string;

  /** Detailed description of the finding */
  description: string;

  /** Severity level */
  severity: Severity;

  /** Category of finding */
  category: FindingCategory;

  /** When the finding was created */
  timestamp: Date;

  /** Block number where the issue was detected */
  blockNumber: bigint;

  /** Transaction hash (if applicable) */
  txHash?: string;

  /** Contract address involved */
  contractAddress?: string;

  /** Solver ID involved (if applicable) */
  solverId?: string;

  /** Receipt ID involved (if applicable) */
  receiptId?: string;

  /** Recommended action */
  recommendedAction: ActionType;

  /** Additional context as key-value pairs */
  metadata: Record<string, unknown>;

  /** Whether this finding has been acted upon */
  actedUpon: boolean;

  /** ID of action taken (if any) */
  actionTxHash?: string;
}

/**
 * Create a new finding with defaults
 */
export function createFinding(params: {
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  blockNumber: bigint;
  recommendedAction?: ActionType;
  txHash?: string;
  contractAddress?: string;
  solverId?: string;
  receiptId?: string;
  metadata?: Record<string, unknown>;
}): Finding {
  return {
    id: `${params.ruleId}-${params.blockNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ruleId: params.ruleId,
    title: params.title,
    description: params.description,
    severity: params.severity,
    category: params.category,
    timestamp: new Date(),
    blockNumber: params.blockNumber,
    txHash: params.txHash,
    contractAddress: params.contractAddress,
    solverId: params.solverId,
    receiptId: params.receiptId,
    recommendedAction: params.recommendedAction ?? ActionType.NONE,
    metadata: params.metadata ?? {},
    actedUpon: false,
  };
}

/**
 * Serialize a finding to JSON-safe format
 */
export function serializeFinding(finding: Finding): Record<string, unknown> {
  return {
    ...finding,
    blockNumber: finding.blockNumber.toString(),
    timestamp: finding.timestamp.toISOString(),
  };
}

/**
 * Deserialize a finding from JSON
 */
export function deserializeFinding(data: Record<string, unknown>): Finding {
  return {
    ...data,
    blockNumber: BigInt(data.blockNumber as string),
    timestamp: new Date(data.timestamp as string),
  } as Finding;
}
