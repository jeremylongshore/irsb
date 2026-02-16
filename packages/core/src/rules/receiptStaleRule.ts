import {
  createFinding,
  type Finding,
  Severity,
  FindingCategory,
  ActionType,
} from '../finding.js';
import type { Rule, RuleMetadata, ChainContext, ReceiptInfo, DisputeInfo } from './rule.js';

/**
 * Configuration for the Receipt Stale rule
 */
export interface ReceiptStaleRuleConfig {
  /** Challenge window in seconds (must match contract) */
  challengeWindowSeconds: number;

  /** Minimum receipt age before considering it stale */
  minReceiptAgeSeconds: number;

  /** Allowlist of solver IDs (empty = all) */
  allowlistSolverIds: string[];

  /** Allowlist of receipt IDs (empty = all) */
  allowlistReceiptIds: string[];

  /** Block confirmations for reorg safety */
  blockConfirmations: number;
}

/**
 * Receipt info with additional computed fields
 */
interface EnrichedReceiptInfo {
  receiptId: string;
  solverId: string;
  blockNumber: bigint;
  txHash: string;
  challengeDeadline: Date;
  intentHash: string;
  ageSeconds: number;
  isPastDeadline: boolean;
}

/**
 * Receipt Stale Rule
 *
 * Detects receipts that:
 * 1. Have passed their challenge deadline
 * 2. Have NOT been finalized
 * 3. Have NOT already been disputed
 *
 * These receipts are "stale" - the solver may have failed to complete
 * the intent, or there may be an issue requiring investigation.
 *
 * When a stale receipt is found, we generate a HIGH severity finding
 * with a recommended action of OPEN_DISPUTE.
 */
export class ReceiptStaleRule implements Rule {
  readonly metadata: RuleMetadata = {
    id: 'RECEIPT_STALE',
    name: 'Receipt Stale Detection',
    description: 'Detects receipts past their challenge deadline that have not been finalized',
    defaultSeverity: Severity.HIGH,
    category: FindingCategory.RECEIPT,
    enabledByDefault: true,
    version: '1.0.0',
  };

  private config: ReceiptStaleRuleConfig;

  constructor(config: ReceiptStaleRuleConfig) {
    this.config = config;
  }

  async evaluate(context: ChainContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const currentTimestamp = context.blockTimestamp;

    // Fetch receipts in challenge window
    const receipts = await context.getReceiptsInChallengeWindow();

    // Fetch active disputes to check for existing disputes
    const disputes = await context.getActiveDisputes();

    // Create a set of receipt IDs that already have disputes
    const disputedReceiptIds = new Set(
      disputes.map((d: DisputeInfo) => d.receiptId.toLowerCase())
    );

    // Process each receipt
    for (const receipt of receipts) {
      // Skip if already finalized
      if (receipt.status === 'finalized') {
        continue;
      }

      // Skip if already disputed/challenged
      if (receipt.status === 'challenged' || receipt.status === 'disputed') {
        continue;
      }

      // Skip if dispute already exists for this receipt
      if (disputedReceiptIds.has(receipt.id.toLowerCase())) {
        continue;
      }

      // Apply allowlist filters
      if (!this.isAllowed(receipt.id, receipt.solverId)) {
        continue;
      }

      // Enrich receipt with computed fields
      const enriched = this.enrichReceipt(receipt, currentTimestamp);

      // Skip if not past deadline
      if (!enriched.isPastDeadline) {
        continue;
      }

      // Skip if not old enough (min age check)
      if (enriched.ageSeconds < this.config.minReceiptAgeSeconds) {
        continue;
      }

      // Generate finding for stale receipt
      const finding = createFinding({
        ruleId: this.metadata.id,
        title: `Stale receipt detected: ${this.truncateId(receipt.id)}`,
        description: this.buildDescription(enriched),
        severity: Severity.HIGH,
        category: FindingCategory.RECEIPT,
        blockNumber: context.currentBlock,
        recommendedAction: ActionType.OPEN_DISPUTE,
        txHash: receipt.txHash,
        contractAddress: undefined,
        solverId: receipt.solverId,
        receiptId: receipt.id,
        metadata: {
          challengeDeadline: receipt.challengeDeadline.toISOString(),
          ageSeconds: enriched.ageSeconds,
          intentHash: receipt.intentHash,
          receiptStatus: receipt.status,
        },
      });

      findings.push(finding);
    }

    return findings;
  }

  /**
   * Check if receipt/solver passes allowlist filters
   * Uses exact matching to prevent unintended partial matches
   */
  private isAllowed(receiptId: string, solverId: string): boolean {
    const { allowlistReceiptIds, allowlistSolverIds } = this.config;
    const receiptLower = receiptId.toLowerCase();
    const solverLower = solverId.toLowerCase();

    // If receipt allowlist is set, the receipt ID must be in it
    if (allowlistReceiptIds.length > 0 && !allowlistReceiptIds.includes(receiptLower)) {
      return false;
    }

    // If solver allowlist is set, the solver ID must be in it
    if (allowlistSolverIds.length > 0 && !allowlistSolverIds.includes(solverLower)) {
      return false;
    }

    return true;
  }

  /**
   * Enrich receipt with computed fields
   */
  private enrichReceipt(receipt: ReceiptInfo, currentTimestamp: Date): EnrichedReceiptInfo {
    const currentTime = currentTimestamp.getTime();
    const deadlineTime = receipt.challengeDeadline.getTime();
    const isPastDeadline = currentTime > deadlineTime;
    const ageSeconds = isPastDeadline ? Math.floor((currentTime - deadlineTime) / 1000) : 0;

    return {
      receiptId: receipt.id,
      solverId: receipt.solverId,
      blockNumber: receipt.blockNumber,
      txHash: receipt.txHash,
      challengeDeadline: receipt.challengeDeadline,
      intentHash: receipt.intentHash,
      ageSeconds,
      isPastDeadline,
    };
  }

  /**
   * Build human-readable description
   */
  private buildDescription(receipt: EnrichedReceiptInfo): string {
    const deadlineDate = receipt.challengeDeadline.toISOString();
    const overdueMins = Math.floor(receipt.ageSeconds / 60);

    return (
      `Receipt ${receipt.receiptId} from solver ${receipt.solverId} ` +
      `passed its challenge deadline (${deadlineDate}) ${overdueMins} minutes ago. ` +
      `The receipt has not been finalized, suggesting the solver may have failed ` +
      `to complete the intent or there is an issue requiring investigation. ` +
      `Consider opening a dispute to trigger resolution.`
    );
  }

  /**
   * Truncate ID for display
   */
  private truncateId(id: string): string {
    if (id.length <= 14) return id;
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
  }
}

/**
 * Create a receipt stale rule with the given config
 */
export function createReceiptStaleRule(config: ReceiptStaleRuleConfig): ReceiptStaleRule {
  return new ReceiptStaleRule(config);
}
