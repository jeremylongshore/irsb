import type { FastifyInstance } from 'fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';

describe('API Server', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ok');
      expect(body.version).toBe('0.1.0');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health/ready', () => {
    it('returns ok status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ok');
    });
  });

  describe('POST /scan', () => {
    // Scan routes now make real RPC calls to fetch block data.
    // These are integration tests that require a live RPC endpoint.
    // Skip in unit test runs; run with RPC_URL set for integration testing.
    it.skipIf(!process.env.RPC_URL)('executes scan with live RPC', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/scan',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.findings)).toBe(true);
      expect(body.metadata).toBeDefined();
    }, 30_000);

    it.skipIf(!process.env.RPC_URL)('accepts specific rule IDs with live RPC', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/scan',
        payload: {
          ruleIds: ['MOCK-ALWAYS-FIND'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.findings.length).toBe(1);
      expect(body.findings[0].ruleId).toBe('MOCK-ALWAYS-FIND');
    }, 30_000);
  });

  describe('GET /scan/rules', () => {
    it('returns list of available rules', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/scan/rules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body.rules)).toBe(true);
      expect(body.rules.length).toBeGreaterThan(0);

      const rule = body.rules[0];
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
    });
  });

  describe('POST /actions/open-dispute', () => {
    it('returns 403 when actions are disabled', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/actions/open-dispute',
        payload: {
          receiptId: '0x123',
          reason: 'TIMEOUT',
          evidenceHash: '0x456',
          bondAmount: '100000000000000000',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Actions are disabled');
    });
  });

  describe('GET /actions/status', () => {
    it('returns action status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/actions/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.enabled).toBe(false); // Default is disabled
      expect(body.signerConfigured).toBeDefined();
    });
  });

  describe('GET /metrics', () => {
    it('returns Prometheus metrics', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');

      // Check for expected metric names
      const body = response.payload;
      expect(body).toContain('watchtower_ticks_total');
      expect(body).toContain('watchtower_alerts_total');
      expect(body).toContain('watchtower_errors_total');
      expect(body).toContain('watchtower_last_block');
    });

    it('includes default Node.js metrics', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;
      // Default metrics include process info
      expect(body).toContain('process_cpu');
      expect(body).toContain('nodejs_heap');
    });
  });
});
