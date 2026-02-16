import type { Finding, FindingCategory, Severity } from '../finding.js';

/**
 * Chain context provided to rules for evaluation
 */
export interface ChainContext {
  /** Current block number */
  currentBlock: bigint;

  /** Block timestamp */
  blockTimestamp: Date;

  /** Chain ID */
  chainId: number;

  /**
   * Query receipts in challenge window
   * Implementation provided by runner
   */
  getReceiptsInChallengeWindow(): Promise<ReceiptInfo[]>;

  /**
   * Query active disputes
   * Implementation provided by runner
   */
  getActiveDisputes(): Promise<DisputeInfo[]>;

  /**
   * Query solver info
   * Implementation provided by runner
   */
  getSolverInfo(solverId: string): Promise<SolverInfo | null>;

  /**
   * Get events from a range of blocks
   * Implementation provided by runner
   */
  getEvents(fromBlock: bigint, toBlock: bigint): Promise<ChainEvent[]>;
}

/**
 * Receipt information for rule evaluation
 */
export interface ReceiptInfo {
  id: string;
  intentHash: string;
  solverId: string;
  createdAt: Date;
  expiry: Date;
  status: 'pending' | 'challenged' | 'finalized' | 'disputed';
  challengeDeadline: Date;
  blockNumber: bigint;
  txHash: string;
}

/**
 * Dispute information for rule evaluation
 */
export interface DisputeInfo {
  id: string;
  receiptId: string;
  challenger: string;
  reason: string;
  status: 'open' | 'countered' | 'resolved' | 'escalated';
  openedAt: Date;
  deadline: Date;
  blockNumber: bigint;
}

/**
 * Solver information for rule evaluation
 */
export interface SolverInfo {
  id: string;
  owner: string;
  bondAmount: bigint;
  status: 'active' | 'jailed' | 'banned' | 'inactive';
  reputation: number;
  jailCount: number;
}

/**
 * Generic chain event
 */
export interface ChainEvent {
  name: string;
  blockNumber: bigint;
  txHash: string;
  args: Record<string, unknown>;
}

/**
 * Rule metadata
 */
export interface RuleMetadata {
  /** Unique rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the rule detects */
  description: string;

  /** Default severity for findings */
  defaultSeverity: Severity;

  /** Finding category */
  category: FindingCategory;

  /** Whether the rule is enabled by default */
  enabledByDefault: boolean;

  /** Version of the rule */
  version: string;
}

/**
 * Rule interface - all rules must implement this
 */
export interface Rule {
  /** Rule metadata */
  metadata: RuleMetadata;

  /**
   * Evaluate the rule against the current chain context
   * Returns findings (can be empty if no issues detected)
   *
   * Rules should be:
   * - Idempotent: same input produces same output
   * - Deterministic: no random behavior
   * - Pure: no side effects
   *
   * @param context - Chain context for evaluation
   * @returns Array of findings (empty if no issues)
   */
  evaluate(context: ChainContext): Promise<Finding[]>;
}

/**
 * Type guard to check if an object is a valid Rule
 */
export function isRule(obj: unknown): obj is Rule {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const rule = obj as Rule;

  return (
    typeof rule.metadata === 'object' &&
    typeof rule.metadata.id === 'string' &&
    typeof rule.metadata.name === 'string' &&
    typeof rule.evaluate === 'function'
  );
}
