import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EvidenceStore,
  createEvidenceStore,
  type FindingRecord,
  type ActionResultRecord,
} from '../src/index.js';

const TEST_DATA_DIR = join(process.cwd(), '.test-evidence-store');

describe('EvidenceStore', () => {
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  describe('initialization', () => {
    it('creates data directory if it does not exist', () => {
      expect(existsSync(TEST_DATA_DIR)).toBe(false);
      createEvidenceStore({ dataDir: TEST_DATA_DIR });
      expect(existsSync(TEST_DATA_DIR)).toBe(true);
    });

    it('uses existing data directory', () => {
      mkdirSync(TEST_DATA_DIR, { recursive: true });
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      expect(store.getDataDir()).toBe(TEST_DATA_DIR);
    });
  });

  describe('writeFinding', () => {
    it('writes a valid finding to JSONL file', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const finding: FindingRecord = {
        id: 'test-finding-1',
        ruleId: 'receipt-stale',
        title: 'Stale Receipt Detected',
        description: 'Receipt has exceeded challenge window',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '12345678',
        chainId: 11155111,
        receiptId: '0x1234',
        recommendedAction: 'OPEN_DISPUTE',
        metadata: { urgency: 'high' },
        actedUpon: false,
      };

      const result = store.writeFinding(finding);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(existsSync(result.filePath!)).toBe(true);
    });

    it('rejects invalid finding with validation enabled', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const invalidFinding = {
        id: '', // Invalid: empty string
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'INVALID' as const, // Invalid severity
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
      } as FindingRecord;

      const result = store.writeFinding(invalidFinding);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('skips validation when validateOnWrite is false', () => {
      const store = createEvidenceStore({
        dataDir: TEST_DATA_DIR,
        validateOnWrite: false,
      });

      const finding = {
        id: 'test-1',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
      } as FindingRecord;

      const result = store.writeFinding(finding);
      expect(result.success).toBe(true);
    });

    it('appends multiple findings to the same file', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      for (let i = 0; i < 3; i++) {
        const finding: FindingRecord = {
          id: `test-finding-${i}`,
          ruleId: 'receipt-stale',
          title: `Finding ${i}`,
          description: 'Test finding',
          severity: 'MEDIUM',
          category: 'RECEIPT',
          timestamp: new Date().toISOString(),
          blockNumber: String(12345678 + i),
          chainId: 11155111,
          recommendedAction: 'NONE',
          metadata: {},
          actedUpon: false,
        };
        store.writeFinding(finding);
      }

      const files = readdirSync(TEST_DATA_DIR);
      expect(files.length).toBe(1);

      const content = readFileSync(join(TEST_DATA_DIR, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(3);
    });
  });

  describe('writeActionResult', () => {
    it('writes a valid action result to JSONL file', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const actionResult: ActionResultRecord = {
        id: 'action-1',
        findingId: 'finding-1',
        receiptId: '0x1234',
        actionType: 'OPEN_DISPUTE',
        success: true,
        dryRun: false,
        txHash: '0xabcd',
        timestamp: new Date().toISOString(),
        chainId: 11155111,
        blockNumber: '12345679',
      };

      const result = store.writeActionResult(actionResult);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
    });

    it('writes dry run action result', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const actionResult: ActionResultRecord = {
        id: 'action-dry-1',
        findingId: 'finding-1',
        receiptId: '0x1234',
        actionType: 'OPEN_DISPUTE',
        success: true,
        dryRun: true,
        timestamp: new Date().toISOString(),
        chainId: 11155111,
      };

      const result = store.writeActionResult(actionResult);
      expect(result.success).toBe(true);
    });

    it('writes failed action result with error', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const actionResult: ActionResultRecord = {
        id: 'action-fail-1',
        findingId: 'finding-1',
        receiptId: '0x1234',
        actionType: 'OPEN_DISPUTE',
        success: false,
        dryRun: false,
        error: 'Insufficient funds',
        timestamp: new Date().toISOString(),
        chainId: 11155111,
      };

      const result = store.writeActionResult(actionResult);
      expect(result.success).toBe(true);
    });
  });

  describe('query', () => {
    function seedStore(store: EvidenceStore): void {
      // Add findings
      for (let i = 0; i < 5; i++) {
        const finding: FindingRecord = {
          id: `finding-${i}`,
          ruleId: i % 2 === 0 ? 'receipt-stale' : 'bond-insufficient',
          title: `Finding ${i}`,
          description: 'Test finding',
          severity: i < 2 ? 'HIGH' : 'MEDIUM',
          category: 'RECEIPT',
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          blockNumber: String(12345678 + i),
          chainId: i % 2 === 0 ? 11155111 : 1,
          receiptId: `0x${i}234`,
          recommendedAction: 'OPEN_DISPUTE',
          metadata: {},
          actedUpon: false,
        };
        store.writeFinding(finding);
      }

      // Add action results
      for (let i = 0; i < 3; i++) {
        const actionResult: ActionResultRecord = {
          id: `action-${i}`,
          findingId: `finding-${i}`,
          receiptId: `0x${i}234`,
          actionType: 'OPEN_DISPUTE',
          success: i !== 2,
          dryRun: false,
          txHash: i !== 2 ? `0xhash${i}` : undefined,
          error: i === 2 ? 'Failed' : undefined,
          timestamp: new Date(Date.now() - i * 1800000).toISOString(),
          chainId: i % 2 === 0 ? 11155111 : 1,
        };
        store.writeActionResult(actionResult);
      }
    }

    it('returns all records when no filters applied', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const results = store.query();
      expect(results.length).toBe(8); // 5 findings + 3 actions
    });

    it('filters by record type', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const findings = store.query({ type: 'finding' });
      expect(findings.length).toBe(5);

      const actions = store.query({ type: 'action' });
      expect(actions.length).toBe(3);
    });

    it('filters by chain ID', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const sepoliaResults = store.query({ chainId: 11155111 });
      expect(sepoliaResults.length).toBeGreaterThan(0);
      expect(sepoliaResults.every((r) => r.chainId === 11155111)).toBe(true);
    });

    it('filters by rule ID', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const results = store.query({ type: 'finding', ruleId: 'receipt-stale' });
      expect(results.length).toBe(3);
      expect(
        results.every((r) => (r as FindingRecord).ruleId === 'receipt-stale')
      ).toBe(true);
    });

    it('filters by severity', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const results = store.query({ type: 'finding', severity: 'HIGH' });
      expect(results.length).toBe(2);
    });

    it('filters by receipt ID', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const results = store.query({ receiptId: '0x0234' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.receiptId === '0x0234')).toBe(true);
    });

    it('applies limit', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const results = store.query({ limit: 3 });
      expect(results.length).toBe(3);
    });

    it('applies offset', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const allResults = store.query();
      const offsetResults = store.query({ offset: 2 });
      expect(offsetResults.length).toBe(allResults.length - 2);
    });

    it('applies offset and limit together', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });
      seedStore(store);

      const results = store.query({ offset: 2, limit: 3 });
      expect(results.length).toBe(3);
    });
  });

  describe('getFindings', () => {
    it('returns only findings', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      store.writeFinding({
        id: 'finding-1',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
        metadata: {},
        actedUpon: false,
      });

      store.writeActionResult({
        id: 'action-1',
        findingId: 'finding-1',
        receiptId: '0x123',
        actionType: 'NONE',
        success: true,
        dryRun: false,
        timestamp: new Date().toISOString(),
        chainId: 1,
      });

      const findings = store.getFindings();
      expect(findings.length).toBe(1);
      expect(findings[0].id).toBe('finding-1');
    });
  });

  describe('getActionResults', () => {
    it('returns only action results', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      store.writeFinding({
        id: 'finding-1',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
        metadata: {},
        actedUpon: false,
      });

      store.writeActionResult({
        id: 'action-1',
        findingId: 'finding-1',
        receiptId: '0x123',
        actionType: 'OPEN_DISPUTE',
        success: true,
        dryRun: false,
        timestamp: new Date().toISOString(),
        chainId: 1,
      });

      const actions = store.getActionResults();
      expect(actions.length).toBe(1);
      expect(actions[0].id).toBe('action-1');
    });
  });

  describe('getFindingById', () => {
    it('returns finding when found', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      store.writeFinding({
        id: 'target-finding',
        ruleId: 'test',
        title: 'Target',
        description: 'Test',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
        metadata: {},
        actedUpon: false,
      });

      const finding = store.getFindingById('target-finding');
      expect(finding).not.toBeNull();
      expect(finding?.title).toBe('Target');
    });

    it('returns null when not found', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const finding = store.getFindingById('nonexistent');
      expect(finding).toBeNull();
    });
  });

  describe('getActionsForFinding', () => {
    it('returns actions for a specific finding', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      store.writeActionResult({
        id: 'action-1',
        findingId: 'finding-1',
        receiptId: '0x123',
        actionType: 'OPEN_DISPUTE',
        success: true,
        dryRun: false,
        timestamp: new Date().toISOString(),
        chainId: 1,
      });

      store.writeActionResult({
        id: 'action-2',
        findingId: 'finding-2',
        receiptId: '0x456',
        actionType: 'OPEN_DISPUTE',
        success: true,
        dryRun: false,
        timestamp: new Date().toISOString(),
        chainId: 1,
      });

      store.writeActionResult({
        id: 'action-3',
        findingId: 'finding-1',
        receiptId: '0x123',
        actionType: 'SUBMIT_EVIDENCE',
        success: true,
        dryRun: false,
        timestamp: new Date().toISOString(),
        chainId: 1,
      });

      const actions = store.getActionsForFinding('finding-1');
      expect(actions.length).toBe(2);
      expect(actions.every((a) => a.findingId === 'finding-1')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const baseTime = Date.now();

      store.writeFinding({
        id: 'finding-1',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: new Date(baseTime - 3600000).toISOString(), // 1 hour ago
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
        metadata: {},
        actedUpon: false,
      });

      store.writeFinding({
        id: 'finding-2',
        ruleId: 'test',
        title: 'Test 2',
        description: 'Test',
        severity: 'LOW',
        category: 'RECEIPT',
        timestamp: new Date(baseTime).toISOString(), // now
        blockNumber: '124',
        chainId: 1,
        recommendedAction: 'NONE',
        metadata: {},
        actedUpon: false,
      });

      store.writeActionResult({
        id: 'action-1',
        findingId: 'finding-1',
        receiptId: '0x123',
        actionType: 'OPEN_DISPUTE',
        success: true,
        dryRun: false,
        timestamp: new Date(baseTime - 1800000).toISOString(), // 30 min ago
        chainId: 1,
      });

      const stats = store.getStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalFindings).toBe(2);
      expect(stats.totalActions).toBe(1);
      expect(stats.oldestRecord).not.toBeNull();
      expect(stats.newestRecord).not.toBeNull();
    });

    it('returns nulls for empty store', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const stats = store.getStats();
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalFindings).toBe(0);
      expect(stats.totalActions).toBe(0);
      expect(stats.oldestRecord).toBeNull();
      expect(stats.newestRecord).toBeNull();
    });
  });

  describe('file rotation', () => {
    it('rotates file when max size exceeded', () => {
      const store = createEvidenceStore({
        dataDir: TEST_DATA_DIR,
        maxFileSizeBytes: 500, // Very small for testing
      });

      // Write enough findings to trigger rotation
      for (let i = 0; i < 10; i++) {
        store.writeFinding({
          id: `finding-${i}`,
          ruleId: 'test',
          title: `Finding ${i}`,
          description: 'A somewhat longer description to take up more space',
          severity: 'HIGH',
          category: 'RECEIPT',
          timestamp: new Date().toISOString(),
          blockNumber: String(123 + i),
          chainId: 1,
          recommendedAction: 'NONE',
          metadata: { extra: 'data to increase size' },
          actedUpon: false,
        });
      }

      const files = readdirSync(TEST_DATA_DIR);
      expect(files.length).toBeGreaterThan(1);
    });
  });
});

describe('Schema validation', () => {
  describe('FindingRecordSchema', () => {
    it('validates a complete finding', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const finding: FindingRecord = {
        id: 'valid-finding',
        ruleId: 'receipt-stale',
        title: 'Valid Finding',
        description: 'This is a valid finding',
        severity: 'CRITICAL',
        category: 'BOND',
        timestamp: '2024-01-15T12:00:00.000Z',
        blockNumber: '12345678',
        chainId: 11155111,
        txHash: '0x1234567890abcdef',
        contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE',
        solverId: '0xsolver123',
        receiptId: '0xreceipt456',
        recommendedAction: 'ESCALATE',
        metadata: { key: 'value', nested: { foo: 'bar' } },
        actedUpon: true,
        actionTxHash: '0xactiontx789',
      };

      const result = store.writeFinding(finding);
      expect(result.success).toBe(true);
    });

    it('rejects finding with invalid severity', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const finding = {
        id: 'invalid-severity',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'SUPER_HIGH', // Invalid
        category: 'RECEIPT',
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
      } as FindingRecord;

      const result = store.writeFinding(finding);
      expect(result.success).toBe(false);
    });

    it('rejects finding with invalid category', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const finding = {
        id: 'invalid-category',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'HIGH',
        category: 'INVALID_CATEGORY', // Invalid
        timestamp: new Date().toISOString(),
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
      } as FindingRecord;

      const result = store.writeFinding(finding);
      expect(result.success).toBe(false);
    });

    it('rejects finding with invalid timestamp format', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const finding = {
        id: 'invalid-timestamp',
        ruleId: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'HIGH',
        category: 'RECEIPT',
        timestamp: 'not-a-date', // Invalid
        blockNumber: '123',
        chainId: 1,
        recommendedAction: 'NONE',
      } as FindingRecord;

      const result = store.writeFinding(finding);
      expect(result.success).toBe(false);
    });
  });

  describe('ActionResultRecordSchema', () => {
    it('validates a complete action result', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const actionResult: ActionResultRecord = {
        id: 'valid-action',
        findingId: 'finding-1',
        receiptId: '0xreceipt',
        actionType: 'SUBMIT_EVIDENCE',
        success: true,
        dryRun: false,
        txHash: '0xtxhash',
        timestamp: '2024-01-15T12:00:00.000Z',
        chainId: 11155111,
        blockNumber: '12345678',
      };

      const result = store.writeActionResult(actionResult);
      expect(result.success).toBe(true);
    });

    it('rejects action with invalid actionType', () => {
      const store = createEvidenceStore({ dataDir: TEST_DATA_DIR });

      const actionResult = {
        id: 'invalid-action-type',
        findingId: 'finding-1',
        receiptId: '0xreceipt',
        actionType: 'INVALID_ACTION', // Invalid
        success: true,
        dryRun: false,
        timestamp: new Date().toISOString(),
        chainId: 1,
      } as ActionResultRecord;

      const result = store.writeActionResult(actionResult);
      expect(result.success).toBe(false);
    });
  });

  afterEach(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });
});
