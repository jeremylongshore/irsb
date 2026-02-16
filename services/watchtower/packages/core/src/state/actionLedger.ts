import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Entry in the action ledger
 */
export interface ActionEntry {
  /** Receipt ID that was acted upon */
  receiptId: string;

  /** Type of action taken */
  actionType: 'OPEN_DISPUTE' | 'SUBMIT_EVIDENCE';

  /** Transaction hash of the action */
  txHash: string;

  /** Block number when action was taken */
  blockNumber: bigint;

  /** Timestamp when action was recorded */
  timestamp: Date;

  /** Finding ID that triggered the action */
  findingId: string;
}

/**
 * Serialized format for JSON storage
 */
interface SerializedActionEntry {
  receiptId: string;
  actionType: 'OPEN_DISPUTE' | 'SUBMIT_EVIDENCE';
  txHash: string;
  blockNumber: string;
  timestamp: string;
  findingId: string;
}

/**
 * Action Ledger - Idempotency tracking for watchtower actions
 *
 * Prevents duplicate actions by maintaining a persistent record of
 * all actions taken. Before taking any action, check this ledger
 * to ensure we haven't already acted on a given receipt.
 *
 * Persists to JSON file for durability across restarts.
 * Each chain has its own ledger file when chainId is provided.
 */
export class ActionLedger {
  private entries: Map<string, ActionEntry> = new Map();
  private filePath: string;

  constructor(stateDir: string, chainId?: number) {
    // Ensure state directory exists
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    // Use chain-specific file path if chainId provided
    const fileName = chainId !== undefined
      ? `action-ledger-${chainId}.json`
      : 'action-ledger.json';
    this.filePath = join(stateDir, fileName);
    this.load();
  }

  /**
   * Check if an action has already been taken for a receipt
   */
  hasActed(receiptId: string): boolean {
    return this.entries.has(receiptId.toLowerCase());
  }

  /**
   * Get the action entry for a receipt (if exists)
   */
  getEntry(receiptId: string): ActionEntry | undefined {
    return this.entries.get(receiptId.toLowerCase());
  }

  /**
   * Record an action taken
   */
  recordAction(entry: Omit<ActionEntry, 'timestamp'>): void {
    const key = entry.receiptId.toLowerCase();

    if (this.entries.has(key)) {
      throw new Error(`Action already recorded for receipt ${entry.receiptId}`);
    }

    this.entries.set(key, {
      ...entry,
      receiptId: key,
      timestamp: new Date(),
    });

    this.save();
  }

  /**
   * Get all entries (for diagnostics)
   */
  getAllEntries(): ActionEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get count of entries
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Load ledger from disk
   */
  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const serialized: SerializedActionEntry[] = JSON.parse(data);

      for (const entry of serialized) {
        this.entries.set(entry.receiptId, {
          receiptId: entry.receiptId,
          actionType: entry.actionType,
          txHash: entry.txHash,
          blockNumber: BigInt(entry.blockNumber),
          timestamp: new Date(entry.timestamp),
          findingId: entry.findingId,
        });
      }
    } catch {
      // If file is corrupted, start fresh but log warning
      console.warn(`[ActionLedger] Failed to load ${this.filePath}, starting fresh`);
      this.entries.clear();
    }
  }

  /**
   * Save ledger to disk
   */
  private save(): void {
    const serialized: SerializedActionEntry[] = Array.from(this.entries.values()).map(
      (entry) => ({
        receiptId: entry.receiptId,
        actionType: entry.actionType,
        txHash: entry.txHash,
        blockNumber: entry.blockNumber.toString(),
        timestamp: entry.timestamp.toISOString(),
        findingId: entry.findingId,
      })
    );

    writeFileSync(this.filePath, JSON.stringify(serialized, null, 2));
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
    this.save();
  }
}
