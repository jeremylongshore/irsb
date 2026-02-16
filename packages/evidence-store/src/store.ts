import {
  existsSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import {
  FindingRecordSchema,
  ActionResultRecordSchema,
  EvidenceLineSchema,
  type FindingRecord,
  type ActionResultRecord,
  type EvidenceLine,
} from './schemas.js';

/**
 * Configuration for the evidence store
 */
export interface EvidenceStoreConfig {
  /** Directory to store evidence files (default: ./data) */
  dataDir: string;

  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSizeBytes?: number;

  /** Whether to validate records on write (default: true) */
  validateOnWrite?: boolean;
}

/**
 * Result of a write operation
 */
export interface WriteResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Query options for reading evidence
 */
export interface QueryOptions {
  /** Filter by record type */
  type?: 'finding' | 'action';

  /** Filter by chain ID */
  chainId?: number;

  /** Filter by rule ID (for findings) */
  ruleId?: string;

  /** Filter by receipt ID */
  receiptId?: string;

  /** Filter by severity (for findings) */
  severity?: string;

  /** Start date (inclusive) */
  startDate?: Date;

  /** End date (inclusive) */
  endDate?: Date;

  /** Maximum number of records to return */
  limit?: number;

  /** Skip first N records */
  offset?: number;
}

/**
 * Evidence Store - JSONL-based evidence persistence
 *
 * Stores findings and action results in append-only JSONL files
 * with Zod schema validation.
 *
 * File naming: evidence-{YYYY-MM-DD}.jsonl
 * Rotates daily and when max file size is exceeded.
 */
export class EvidenceStore {
  private readonly dataDir: string;
  private readonly maxFileSizeBytes: number;
  private readonly validateOnWrite: boolean;

  constructor(config: EvidenceStoreConfig) {
    this.dataDir = config.dataDir;
    this.maxFileSizeBytes = config.maxFileSizeBytes ?? 10 * 1024 * 1024; // 10MB
    this.validateOnWrite = config.validateOnWrite ?? true;

    // Ensure data directory exists
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get the current evidence file path
   */
  private getCurrentFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return join(this.dataDir, `evidence-${date}.jsonl`);
  }

  /**
   * Get file path with rotation suffix if needed
   */
  private getRotatedFilePath(): string {
    const basePath = this.getCurrentFilePath();

    if (!existsSync(basePath)) {
      return basePath;
    }

    const stats = statSync(basePath);
    if (stats.size < this.maxFileSizeBytes) {
      return basePath;
    }

    // Need to rotate - find next available suffix
    let suffix = 1;
    let rotatedPath: string;
    do {
      const date = new Date().toISOString().split('T')[0];
      rotatedPath = join(this.dataDir, `evidence-${date}-${suffix}.jsonl`);
      suffix++;
    } while (existsSync(rotatedPath));

    return rotatedPath;
  }

  /**
   * Write a finding record to the evidence store
   */
  writeFinding(finding: FindingRecord): WriteResult {
    try {
      // Validate if enabled
      if (this.validateOnWrite) {
        const validation = FindingRecordSchema.safeParse(finding);
        if (!validation.success) {
          return {
            success: false,
            error: `Validation failed: ${validation.error.message}`,
          };
        }
      }

      const line: EvidenceLine = {
        type: 'finding',
        schemaVersion: 1,
        data: finding,
      };

      return this.writeLine(line);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write an action result record to the evidence store
   */
  writeActionResult(actionResult: ActionResultRecord): WriteResult {
    try {
      // Validate if enabled
      if (this.validateOnWrite) {
        const validation = ActionResultRecordSchema.safeParse(actionResult);
        if (!validation.success) {
          return {
            success: false,
            error: `Validation failed: ${validation.error.message}`,
          };
        }
      }

      const line: EvidenceLine = {
        type: 'action',
        schemaVersion: 1,
        data: actionResult,
      };

      return this.writeLine(line);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write a line to the evidence file
   */
  private writeLine(line: EvidenceLine): WriteResult {
    const filePath = this.getRotatedFilePath();
    const jsonLine = JSON.stringify(line) + '\n';

    try {
      appendFileSync(filePath, jsonLine, 'utf-8');
      return { success: true, filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Query evidence records
   */
  query(options: QueryOptions = {}): (FindingRecord | ActionResultRecord)[] {
    const results: (FindingRecord | ActionResultRecord)[] = [];
    const files = this.getEvidenceFiles();

    let skipped = 0;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? Infinity;

    fileLoop: for (const file of files) {
      const lines = this.readFile(file);

      for (const line of lines) {
        // Parse and validate
        const parsed = EvidenceLineSchema.safeParse(line);
        if (!parsed.success) continue;

        const evidence = parsed.data;

        // Apply filters
        if (options.type && evidence.type !== options.type) continue;

        const record = evidence.data;

        if (options.chainId !== undefined && record.chainId !== options.chainId) continue;

        if (options.receiptId && record.receiptId !== options.receiptId) continue;

        // Finding-specific filters
        if (evidence.type === 'finding') {
          const finding = record as FindingRecord;
          if (options.ruleId && finding.ruleId !== options.ruleId) continue;
          if (options.severity && finding.severity !== options.severity) continue;
        }

        // Date filters
        const recordDate = new Date(record.timestamp);
        if (options.startDate && recordDate < options.startDate) continue;
        if (options.endDate && recordDate > options.endDate) continue;

        // Apply offset
        if (skipped < offset) {
          skipped++;
          continue;
        }

        results.push(record);

        // Apply limit
        if (results.length >= limit) {
          break fileLoop;
        }
      }
    }

    return results;
  }

  /**
   * Get all findings
   */
  getFindings(options: Omit<QueryOptions, 'type'> = {}): FindingRecord[] {
    return this.query({ ...options, type: 'finding' }) as FindingRecord[];
  }

  /**
   * Get all action results
   */
  getActionResults(options: Omit<QueryOptions, 'type'> = {}): ActionResultRecord[] {
    return this.query({ ...options, type: 'action' }) as ActionResultRecord[];
  }

  /**
   * Get a specific finding by ID
   */
  getFindingById(id: string): FindingRecord | null {
    const findings = this.getFindings();
    return findings.find((f) => f.id === id) ?? null;
  }

  /**
   * Get action results for a specific finding
   */
  getActionsForFinding(findingId: string): ActionResultRecord[] {
    return this.getActionResults().filter((a) => a.findingId === findingId);
  }

  /**
   * Get evidence files sorted by date (oldest first)
   */
  private getEvidenceFiles(): string[] {
    if (!existsSync(this.dataDir)) return [];

    const files = readdirSync(this.dataDir)
      .filter((f) => f.startsWith('evidence-') && f.endsWith('.jsonl'))
      .map((f) => join(this.dataDir, f))
      .sort((a, b) => basename(a).localeCompare(basename(b)));

    return files;
  }

  /**
   * Read and parse a JSONL file
   */
  private readFile(filePath: string): unknown[] {
    if (!existsSync(filePath)) return [];

    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter((l) => l.length > 0);

      return lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter((l) => l !== null);
    } catch {
      return [];
    }
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalFiles: number;
    totalFindings: number;
    totalActions: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  } {
    const findings = this.getFindings();
    const actions = this.getActionResults();

    const allTimestamps = [
      ...findings.map((f) => new Date(f.timestamp)),
      ...actions.map((a) => new Date(a.timestamp)),
    ].sort((a, b) => a.getTime() - b.getTime());

    return {
      totalFiles: this.getEvidenceFiles().length,
      totalFindings: findings.length,
      totalActions: actions.length,
      oldestRecord: allTimestamps[0] ?? null,
      newestRecord: allTimestamps[allTimestamps.length - 1] ?? null,
    };
  }

  /**
   * Get the data directory path
   */
  getDataDir(): string {
    return this.dataDir;
  }
}

/**
 * Create an evidence store instance
 */
export function createEvidenceStore(config: EvidenceStoreConfig): EvidenceStore {
  return new EvidenceStore(config);
}
