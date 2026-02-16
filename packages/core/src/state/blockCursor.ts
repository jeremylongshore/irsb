import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Block cursor state
 */
export interface BlockCursorState {
  /** Last fully processed block number */
  lastProcessedBlock: bigint;

  /** Timestamp of last update */
  updatedAt: Date;

  /** Chain ID this cursor is tracking */
  chainId: number;
}

/**
 * Serialized format for JSON storage
 */
interface SerializedBlockCursor {
  lastProcessedBlock: string;
  updatedAt: string;
  chainId: number;
}

/**
 * Block Cursor - Tracks scan progress for resumption
 *
 * Maintains the last fully processed block number so that
 * on restart, we can resume from where we left off rather
 * than rescanning from the beginning.
 *
 * Persists to JSON file for durability.
 */
export class BlockCursor {
  private state: BlockCursorState | null = null;
  private filePath: string;
  private chainId: number;

  constructor(stateDir: string, chainId: number) {
    this.chainId = chainId;

    // Ensure state directory exists
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    this.filePath = join(stateDir, `block-cursor-${chainId}.json`);
    this.load();
  }

  /**
   * Get the last processed block, or null if never run
   */
  getLastProcessedBlock(): bigint | null {
    return this.state?.lastProcessedBlock ?? null;
  }

  /**
   * Update the cursor to a new block number
   *
   * @param blockNumber - The block number that was fully processed
   * @throws if blockNumber is less than current (no backwards movement)
   */
  update(blockNumber: bigint): void {
    if (this.state && blockNumber < this.state.lastProcessedBlock) {
      throw new Error(
        `Cannot move cursor backwards: ${blockNumber} < ${this.state.lastProcessedBlock}`
      );
    }

    this.state = {
      lastProcessedBlock: blockNumber,
      updatedAt: new Date(),
      chainId: this.chainId,
    };

    this.save();
  }

  /**
   * Get the starting block for a scan
   *
   * @param currentBlock - Current chain head block
   * @param lookbackBlocks - Maximum blocks to look back
   * @param confirmations - Block confirmations required
   * @returns The block to start scanning from
   */
  getStartBlock(currentBlock: bigint, lookbackBlocks: number, confirmations: number): bigint {
    // Safe block = current - confirmations (reorg safety)
    const safeBlock = currentBlock - BigInt(confirmations);

    // If we have a cursor, start from there + 1
    if (this.state) {
      const resumeBlock = this.state.lastProcessedBlock + 1n;
      // Don't go past safe block
      return resumeBlock > safeBlock ? safeBlock : resumeBlock;
    }

    // No cursor - start from lookback
    const lookbackStart = currentBlock - BigInt(lookbackBlocks);
    return lookbackStart > 0n ? lookbackStart : 1n;
  }

  /**
   * Get full cursor state (for diagnostics)
   */
  getState(): BlockCursorState | null {
    return this.state ? { ...this.state } : null;
  }

  /**
   * Load cursor from disk
   */
  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const serialized: SerializedBlockCursor = JSON.parse(data);

      // Validate chain ID matches
      if (serialized.chainId !== this.chainId) {
        console.warn(
          `[BlockCursor] Chain ID mismatch: file has ${serialized.chainId}, expected ${this.chainId}. Starting fresh.`
        );
        return;
      }

      this.state = {
        lastProcessedBlock: BigInt(serialized.lastProcessedBlock),
        updatedAt: new Date(serialized.updatedAt),
        chainId: serialized.chainId,
      };
    } catch {
      console.warn(`[BlockCursor] Failed to load ${this.filePath}, starting fresh`);
      this.state = null;
    }
  }

  /**
   * Save cursor to disk
   */
  private save(): void {
    if (!this.state) {
      return;
    }

    const serialized: SerializedBlockCursor = {
      lastProcessedBlock: this.state.lastProcessedBlock.toString(),
      updatedAt: this.state.updatedAt.toISOString(),
      chainId: this.state.chainId,
    };

    writeFileSync(this.filePath, JSON.stringify(serialized, null, 2));
  }

  /**
   * Reset cursor (for testing)
   */
  reset(): void {
    this.state = null;
    if (existsSync(this.filePath)) {
      writeFileSync(this.filePath, '{}');
    }
  }
}
