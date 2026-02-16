import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildServer } from '../src/server.js';
import {
  initDbWithInlineMigrations,
  upsertAgent,
  insertSnapshot,
  scoreAgent,
  insertRiskReport,
  insertAlerts,
  getAgent,
  getLatestSnapshots,
  generateKeyPair,
  saveKeyPair,
} from '@irsb-watchtower/watchtower-core';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

let tmpDir: string;
let server: FastifyInstance;
let db: Database.Database;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wt-api-test-'));
  const dbPath = join(tmpDir, 'test.db');
  const keyPath = join(tmpDir, 'key.json');
  const logDir = join(tmpDir, 'logs');

  // Create a keypair for transparency routes
  const kp = generateKeyPair();
  saveKeyPair(keyPath, kp);

  // Seed the DB with test data
  db = initDbWithInlineMigrations(dbPath);
  upsertAgent(db, { agentId: 'agent-1', labels: ['test'], status: 'ACTIVE' });
  insertSnapshot(db, {
    snapshotId: 'snap-1',
    agentId: 'agent-1',
    observedAt: 1700000000,
    signals: [
      { signalId: 'TEST_SIG', severity: 'MEDIUM', weight: 0.5, observedAt: 1700000000, evidence: [] },
    ],
  });

  const agent = getAgent(db, 'agent-1')!;
  const snapshots = getLatestSnapshots(db, 'agent-1', 20);
  const { report, newAlerts } = scoreAgent(agent, snapshots, 1700000000);
  insertRiskReport(db, report);
  if (newAlerts.length > 0) insertAlerts(db, newAlerts);
  db.close();

  server = await buildServer({ dbPath, keyPath, logDir });
});

afterAll(async () => {
  await server.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /healthz', () => {
  it('should return ok', async () => {
    const res = await server.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.3.0');
  });
});

describe('GET /v1/agents/:agentId/risk', () => {
  it('should return the risk report', async () => {
    const res = await server.inject({ method: 'GET', url: '/v1/agents/agent-1/risk' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBe('agent-1');
    expect(typeof body.overallRisk).toBe('number');
    expect(body.reportVersion).toBeTruthy();
  });

  it('should 404 for unknown agent', async () => {
    const res = await server.inject({ method: 'GET', url: '/v1/agents/nope/risk' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/agents/:agentId/alerts', () => {
  it('should return alerts for an agent', async () => {
    const res = await server.inject({ method: 'GET', url: '/v1/agents/agent-1/alerts' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBe('agent-1');
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('should 404 for unknown agent', async () => {
    const res = await server.inject({ method: 'GET', url: '/v1/agents/nope/alerts' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/transparency/leaves', () => {
  it('should return empty leaves for a date with no log', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/v1/transparency/leaves?date=2020-01-01',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(0);
    expect(body.leaves).toEqual([]);
  });

  it('should reject invalid date', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/v1/transparency/leaves?date=not-a-date',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('API key auth', () => {
  afterEach(() => {
    delete process.env['WATCHTOWER_API_KEY'];
  });

  it('should pass without API key when env is unset', async () => {
    const res = await server.inject({ method: 'GET', url: '/v1/agents/agent-1/risk' });
    expect(res.statusCode).toBe(200);
  });

  it('should 401 when API key is set but header is missing', async () => {
    process.env['WATCHTOWER_API_KEY'] = 'test-secret-key';
    const res = await server.inject({ method: 'GET', url: '/v1/agents/agent-1/risk' });
    expect(res.statusCode).toBe(401);
  });

  it('should 401 when wrong API key is provided', async () => {
    process.env['WATCHTOWER_API_KEY'] = 'test-secret-key';
    const res = await server.inject({
      method: 'GET',
      url: '/v1/agents/agent-1/risk',
      headers: { 'x-watchtower-key': 'wrong-key' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should 200 when correct API key is provided', async () => {
    process.env['WATCHTOWER_API_KEY'] = 'test-secret-key';
    const res = await server.inject({
      method: 'GET',
      url: '/v1/agents/agent-1/risk',
      headers: { 'x-watchtower-key': 'test-secret-key' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('should not require API key for /healthz', async () => {
    process.env['WATCHTOWER_API_KEY'] = 'test-secret-key';
    const res = await server.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });
});
