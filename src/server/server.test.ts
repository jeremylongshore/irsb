/**
 * Server and observability tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { mkdirSync, rmSync } from "node:fs";
import { createApp } from "./server.js";
import { metricsRegistry, recordIntentReceived, recordRunSuccess } from "../obs/metrics.js";
import type { ResolvedConfig } from "../config.js";

const TEST_DATA_DIR = "./test-server-data";

const testConfig: ResolvedConfig = {
  NODE_ENV: "test",
  LOG_LEVEL: "error", // Quiet logs during tests
  PORT: 0, // Use random port
  METRICS_ENABLED: true,
  DATA_DIR: TEST_DATA_DIR,
  POLICY_JOBTYPE_ALLOWLIST: ["SAFE_REPORT"],
  POLICY_MAX_ARTIFACT_MB: 5,
  RECEIPTS_PATH: `${TEST_DATA_DIR}/receipts.jsonl`,
  REFUSALS_PATH: `${TEST_DATA_DIR}/refusals.jsonl`,
  EVIDENCE_DIR: `${TEST_DATA_DIR}/evidence`,
  SIGNING_MODE: "kms",
  KMS_LOCATION: "us-central1",
  KMS_KEY_VERSION: "1",
  CHAIN_ID: 11155111,
};

describe("Server Endpoints", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Create test data directory
    mkdirSync(TEST_DATA_DIR, { recursive: true });

    // Start server on random port with metrics enabled
    const app = createApp(testConfig);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${String(address.port)}`;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
    // Clean up
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe("GET /healthz", () => {
    it("should return ok status", async () => {
      const response = await fetch(`${baseUrl}/healthz`);
      expect(response.status).toBe(200);

      const body = await response.json() as { ok: boolean; service: string; serviceVersion: string; uptimeSeconds: number };
      expect(body.ok).toBe(true);
      expect(body.service).toBe("irsb-solver");
      expect(body.serviceVersion).toBe("0.1.0");
      expect(typeof body.uptimeSeconds).toBe("number");
    });
  });

  describe("GET /readyz", () => {
    it("should return ok when data dir exists and is writable", async () => {
      const response = await fetch(`${baseUrl}/readyz`);
      expect(response.status).toBe(200);

      const body = await response.json() as { ok: boolean };
      expect(body.ok).toBe(true);
    });
  });

  describe("GET /metrics", () => {
    it("should return Prometheus metrics", async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      expect(response.status).toBe(200);

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/plain");

      const body = await response.text();
      expect(body).toContain("# HELP");
      expect(body).toContain("# TYPE");
    });

    it("should contain solver metric names", async () => {
      // Record some metrics to ensure they're initialized
      recordIntentReceived();

      const response = await fetch(`${baseUrl}/metrics`);
      const body = await response.text();

      // Check for our custom metric names (values may vary)
      expect(body).toContain("solver_intents_received_total");
    });
  });
});

describe("Metrics Functions", () => {
  it("should increment counters when recording", async () => {
    // Record some metrics
    recordIntentReceived();
    recordRunSuccess("SAFE_REPORT", 250);

    const metrics = await metricsRegistry.metrics();

    // Check that metrics contain our metric names
    expect(metrics).toContain("solver_intents_received_total");
    expect(metrics).toContain("solver_runs_total");
    expect(metrics).toContain("solver_evidence_bundles_total");
    expect(metrics).toContain("solver_run_duration_ms");
    expect(metrics).toContain("SAFE_REPORT");
  });
});
