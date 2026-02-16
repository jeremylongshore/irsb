import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateKeyPair,
  createLeaf,
  verifyLeaf,
  appendLeaf,
  verifyLogFile,
  readLogFile,
  logFilePath,
} from '../src/index.js';
import type { TransparencyLeaf, WatchtowerKeyPair } from '../src/index.js';

let tmpDir: string;
let kp: WatchtowerKeyPair;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wt-transparency-'));
  kp = generateKeyPair();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('transparency leaf', () => {
  const input = {
    agentId: 'erc8004:11155111:0xabc:42',
    riskReportHash: 'deadbeef1234567890',
    overallRisk: 75,
  };

  it('should create a leaf with deterministic ID', () => {
    const leaf = createLeaf(input, kp);
    expect(leaf.leafVersion).toBe('0.1.0');
    expect(leaf.leafId).toBeTruthy();
    expect(leaf.leafId.length).toBe(64); // sha256 hex
    expect(leaf.agentId).toBe(input.agentId);
    expect(leaf.riskReportHash).toBe(input.riskReportHash);
    expect(leaf.overallRisk).toBe(75);
    expect(leaf.watchtowerSig).toBeTruthy();
    expect(leaf.writtenAt).toBeGreaterThan(0);
  });

  it('should produce same leafId for same input (excluding writtenAt)', () => {
    const leaf1 = createLeaf(input, kp);
    const leaf2 = createLeaf(input, kp);
    expect(leaf1.leafId).toBe(leaf2.leafId);
    // Signatures may differ due to timing
  });

  it('should produce different leafId for different input', () => {
    const leaf1 = createLeaf(input, kp);
    const leaf2 = createLeaf({ ...input, overallRisk: 50 }, kp);
    expect(leaf1.leafId).not.toBe(leaf2.leafId);
  });

  it('should include optional fields in leafId', () => {
    const withReceipt = createLeaf({ ...input, receiptId: 'r1' }, kp);
    const withoutReceipt = createLeaf(input, kp);
    expect(withReceipt.leafId).not.toBe(withoutReceipt.leafId);
  });

  it('should verify a valid leaf', () => {
    const leaf = createLeaf(input, kp);
    const result = verifyLeaf(leaf, kp.publicKey);
    expect(result.valid).toBe(true);
  });

  it('should reject tampered leafId', () => {
    const leaf = createLeaf(input, kp);
    const tampered: TransparencyLeaf = { ...leaf, leafId: 'bad'.repeat(16) + 'badbadba' };
    const result = verifyLeaf(tampered, kp.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('leafId mismatch');
  });

  it('should reject tampered risk', () => {
    const leaf = createLeaf(input, kp);
    const tampered: TransparencyLeaf = { ...leaf, overallRisk: 0 };
    const result = verifyLeaf(tampered, kp.publicKey);
    expect(result.valid).toBe(false);
  });

  it('should reject wrong public key', () => {
    const leaf = createLeaf(input, kp);
    const otherKp = generateKeyPair();
    const result = verifyLeaf(leaf, otherKp.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature verification failed');
  });
});

describe('transparency log', () => {
  const input = {
    agentId: 'agent-1',
    riskReportHash: 'hash1',
    overallRisk: 42,
  };

  it('should generate correct log file path', () => {
    const date = new Date('2025-03-15T12:00:00Z');
    const path = logFilePath(tmpDir, date);
    expect(path).toContain('leaves-2025-03-15.ndjson');
  });

  it('should append a leaf and read it back', () => {
    const leaf = createLeaf(input, kp);
    const filePath = appendLeaf(tmpDir, leaf);
    expect(filePath).toContain('.ndjson');

    const leaves = readLogFile(filePath);
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.leafId).toBe(leaf.leafId);
    expect(leaves[0]!.agentId).toBe('agent-1');
  });

  it('should append multiple leaves to the same file', () => {
    const leaf1 = createLeaf(input, kp);
    const leaf2 = createLeaf({ ...input, riskReportHash: 'hash2' }, kp);
    const path1 = appendLeaf(tmpDir, leaf1);
    const path2 = appendLeaf(tmpDir, leaf2);
    expect(path1).toBe(path2); // Same date → same file

    const leaves = readLogFile(path1);
    expect(leaves).toHaveLength(2);
  });

  it('should verify a valid log file', () => {
    const leaf1 = createLeaf(input, kp);
    const leaf2 = createLeaf({ ...input, overallRisk: 10 }, kp);
    appendLeaf(tmpDir, leaf1);
    const filePath = appendLeaf(tmpDir, leaf2);

    const result = verifyLogFile(filePath, kp.publicKey);
    expect(result.totalLeaves).toBe(2);
    expect(result.validLeaves).toBe(2);
    expect(result.invalidLeaves).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect corrupted JSON', () => {
    const leaf = createLeaf(input, kp);
    const filePath = appendLeaf(tmpDir, leaf);

    // Append garbage
    const content = readFileSync(filePath, 'utf-8');
    writeFileSync(filePath, content + 'not valid json\n', 'utf-8');

    const result = verifyLogFile(filePath, kp.publicKey);
    expect(result.totalLeaves).toBe(2);
    expect(result.validLeaves).toBe(1);
    expect(result.invalidLeaves).toBe(1);
    expect(result.errors[0]!.leafId).toBe('PARSE_ERROR');
  });

  it('should detect tampered leaf in log', () => {
    const leaf = createLeaf(input, kp);
    const filePath = appendLeaf(tmpDir, leaf);

    // Tamper the leaf in the file
    const tampered = { ...leaf, overallRisk: 0 };
    writeFileSync(filePath, JSON.stringify(tampered) + '\n', 'utf-8');

    const result = verifyLogFile(filePath, kp.publicKey);
    expect(result.totalLeaves).toBe(1);
    expect(result.invalidLeaves).toBe(1);
    expect(result.errors[0]!.error).toContain('leafId mismatch');
  });

  it('should detect signature from wrong key', () => {
    const leaf = createLeaf(input, kp);
    appendLeaf(tmpDir, leaf);

    // Verify with a different key
    const otherKp = generateKeyPair();
    const filePath = logFilePath(tmpDir, new Date(leaf.writtenAt * 1000));
    const result = verifyLogFile(filePath, otherKp.publicKey);
    expect(result.invalidLeaves).toBe(1);
    expect(result.errors[0]!.error).toContain('signature verification failed');
  });

  it('should return empty result for nonexistent file', () => {
    const result = verifyLogFile(join(tmpDir, 'nope.ndjson'), kp.publicKey);
    expect(result.totalLeaves).toBe(0);
    expect(result.validLeaves).toBe(0);
  });

  it('should return empty array for nonexistent file', () => {
    const leaves = readLogFile(join(tmpDir, 'nope.ndjson'));
    expect(leaves).toEqual([]);
  });
});
