import type { Finding, ActionType } from '../finding.js';
import type { ActionLedger } from '../state/actionLedger.js';

/**
 * Result of executing an action
 */
export interface ActionResult {
  /** Whether the action was executed successfully */
  success: boolean;

  /** Transaction hash (if action involved a tx) */
  txHash?: string;

  /** Error message (if failed) */
  error?: string;

  /** Whether this was a dry run (no real action taken) */
  dryRun: boolean;

  /** The finding that triggered this action */
  finding: Finding;
}

/**
 * Configuration for action execution
 */
export interface ActionExecutorConfig {
  /** If true, log actions but don't execute them */
  dryRun: boolean;

  /** Maximum actions per execution batch */
  maxActionsPerBatch: number;

  /** Action ledger for idempotency */
  ledger: ActionLedger;
}

/**
 * Handler for executing a specific action type
 */
export type ActionHandler = (finding: Finding) => Promise<{ txHash: string }>;

/**
 * Action Executor
 *
 * Takes findings with recommended actions and executes them.
 * Handles:
 * - Dry run mode (log but don't execute)
 * - Idempotency via action ledger
 * - Rate limiting
 * - Error handling
 */
export class ActionExecutor {
  private config: ActionExecutorConfig;
  private handlers: Map<ActionType, ActionHandler> = new Map();
  private onLog?: (message: string, level: 'info' | 'warn' | 'error') => void;

  constructor(config: ActionExecutorConfig) {
    this.config = config;
  }

  /**
   * Set the logging callback
   */
  setLogger(onLog: (message: string, level: 'info' | 'warn' | 'error') => void): void {
    this.onLog = onLog;
  }

  /**
   * Register a handler for an action type
   */
  registerHandler(actionType: ActionType, handler: ActionHandler): void {
    this.handlers.set(actionType, handler);
  }

  /**
   * Execute actions for a batch of findings
   *
   * @param findings - Findings to process
   * @returns Results for each executed action
   */
  async executeActions(findings: Finding[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    let actionsExecuted = 0;

    for (const finding of findings) {
      // Check rate limit
      if (actionsExecuted >= this.config.maxActionsPerBatch) {
        this.log(
          `Rate limit reached (${this.config.maxActionsPerBatch} actions). Skipping remaining findings.`,
          'warn'
        );
        break;
      }

      // Skip findings that don't recommend an action
      if (finding.recommendedAction === 'NONE') {
        continue;
      }

      // Skip if we've already acted on this receipt
      if (finding.receiptId && this.config.ledger.hasActed(finding.receiptId)) {
        this.log(`Already acted on receipt ${finding.receiptId}, skipping`, 'info');
        continue;
      }

      // Execute the action
      const result = await this.executeAction(finding);
      results.push(result);

      if (result.success && !result.dryRun) {
        actionsExecuted++;
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(finding: Finding): Promise<ActionResult> {
    const actionType = finding.recommendedAction as ActionType;

    // Dry run mode
    if (this.config.dryRun) {
      this.log(
        `[DRY RUN] Would execute ${actionType} for receipt ${finding.receiptId}`,
        'info'
      );
      return {
        success: true,
        dryRun: true,
        finding,
      };
    }

    // Check for handler
    const handler = this.handlers.get(actionType);
    if (!handler) {
      this.log(`No handler registered for action type: ${actionType}`, 'warn');
      return {
        success: false,
        error: `No handler for action type: ${actionType}`,
        dryRun: false,
        finding,
      };
    }

    // Execute the action
    try {
      this.log(`Executing ${actionType} for receipt ${finding.receiptId}`, 'info');

      const { txHash } = await handler(finding);

      // Record in ledger
      if (finding.receiptId) {
        this.config.ledger.recordAction({
          receiptId: finding.receiptId,
          actionType: this.mapActionType(actionType),
          txHash,
          blockNumber: finding.blockNumber,
          findingId: finding.id,
        });
      }

      this.log(`Successfully executed ${actionType}, tx: ${txHash}`, 'info');

      return {
        success: true,
        txHash,
        dryRun: false,
        finding,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Failed to execute ${actionType}: ${errorMessage}`, 'error');

      return {
        success: false,
        error: errorMessage,
        dryRun: false,
        finding,
      };
    }
  }

  /**
   * Map ActionType enum to ledger action type
   */
  private mapActionType(actionType: ActionType): 'OPEN_DISPUTE' | 'SUBMIT_EVIDENCE' {
    switch (actionType) {
      case 'OPEN_DISPUTE':
        return 'OPEN_DISPUTE';
      case 'SUBMIT_EVIDENCE':
        return 'SUBMIT_EVIDENCE';
      default:
        // Throw error for unhandled action types to catch missing handler registrations
        throw new Error(`Unhandled action type: ${actionType}`);
    }
  }

  /**
   * Log a message
   */
  private log(message: string, level: 'info' | 'warn' | 'error'): void {
    if (this.onLog) {
      this.onLog(message, level);
    }
  }
}

/**
 * Create an action executor with the given config
 */
export function createActionExecutor(config: ActionExecutorConfig): ActionExecutor {
  return new ActionExecutor(config);
}
