/**
 * ERC-8004 Module Tests
 *
 * Tests for:
 * - Agent card generation and validation
 * - Registration payload generation
 * - Determinism (same input = same output)
 * - Endpoint serving
 * - CLI command
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { mkdirSync, rmSync } from "node:fs";
import { createApp } from "../server/server.js";
import type { ResolvedConfig } from "../config.js";
import type { AgentCard } from "./index.js";
import {
  generateAgentCard,
  generateAgentCardJson,
  computeAgentCardChecksum,
  generateRegistration,
  executeRegisterCommand,
} from "./index.js";

const TEST_DATA_DIR = "./test-erc8004-data";

const testConfig: ResolvedConfig = {
  NODE_ENV: "test",
  LOG_LEVEL: "error",
  PORT: 0,
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

describe("Agent Card Generation", () => {
  it("should generate a valid agent card", () => {
    const card = generateAgentCard();

    expect(card.agentId).toBe("irsb-solver@0.1.0");
    expect(card.name).toBe("irsb-solver");
    expect(card.version).toBe("0.1.0");
    expect(card.description).toBeDefined();
    expect(card.capabilities).toContain("intent-execution");
    expect(card.capabilities).toContain("evidence-generation");
    expect(card.capabilities).toContain("receipt-submission");
    expect(card.endpoints.health).toBe("/healthz");
    expect(card.endpoints.metrics).toBe("/metrics");
    expect(card.endpoints.execute).toBe("N/A");
    expect(card.standards).toContain("ERC-8004");
    expect(Array.isArray(card.supportedTrust)).toBe(true);
    expect(card.links.repository).toBeDefined();
  });

  it("should allow custom agentId", () => {
    const card = generateAgentCard({ agentId: "custom-id" });

    expect(card.agentId).toBe("custom-id");
  });

  it("should serialize to valid JSON", () => {
    const json = generateAgentCardJson();
    const parsed = JSON.parse(json) as AgentCard;

    expect(parsed.agentId).toBe("irsb-solver@0.1.0");
    expect(parsed.standards).toContain("ERC-8004");
  });
});

describe("Agent Card Determinism", () => {
  it("should produce identical output on multiple calls", () => {
    const json1 = generateAgentCardJson();
    const json2 = generateAgentCardJson();

    expect(json1).toBe(json2);
  });

  it("should produce identical checksums on multiple calls", () => {
    const json1 = generateAgentCardJson();
    const json2 = generateAgentCardJson();

    const checksum1 = computeAgentCardChecksum(json1);
    const checksum2 = computeAgentCardChecksum(json2);

    expect(checksum1).toBe(checksum2);
  });

  it("should produce 64-character hex checksum", () => {
    const json = generateAgentCardJson();
    const checksum = computeAgentCardChecksum(json);

    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Registration Payload", () => {
  it("should generate valid registration payload", () => {
    const payload = generateRegistration({
      baseUrl: "http://localhost:8080",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(payload.agentId).toBe("irsb-solver@0.1.0");
    expect(payload.name).toBe("irsb-solver");
    expect(payload.version).toBe("0.1.0");
    expect(payload.standards).toContain("ERC-8004");
    expect(payload.agentCardUrl).toBe("http://localhost:8080/.well-known/agent-card.json");
    expect(payload.agentCardChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.registeredAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("should handle trailing slash in baseUrl", () => {
    const payload = generateRegistration({
      baseUrl: "http://localhost:8080/",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(payload.agentCardUrl).toBe("http://localhost:8080/.well-known/agent-card.json");
  });
});

describe("Register Command", () => {
  it("should succeed in dry-run mode", () => {
    const result = executeRegisterCommand({
      baseUrl: "http://localhost:8080",
      dryRun: true,
      format: "text",
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("ERC-8004 Registration (Dry Run)");
    expect(result.output).toContain("agentId");
  });

  it("should output JSON when format is json", () => {
    const result = executeRegisterCommand({
      baseUrl: "http://localhost:8080",
      dryRun: true,
      format: "json",
    });

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.output) as { agentId: string };
    expect(parsed.agentId).toBe("irsb-solver@0.1.0");
  });

  it("should fail when dry-run is false", () => {
    const result = executeRegisterCommand({
      baseUrl: "http://localhost:8080",
      dryRun: false,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Only --dry-run mode is supported");
  });
});

describe("Agent Card Endpoint", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    mkdirSync(TEST_DATA_DIR, { recursive: true });

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
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it("should serve agent card at /.well-known/agent-card.json", async () => {
    const response = await fetch(`${baseUrl}/.well-known/agent-card.json`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const card = await response.json() as { agentId: string; standards: string[] };
    expect(card.agentId).toBe("irsb-solver@0.1.0");
    expect(card.standards).toContain("ERC-8004");
  });

  it("should return valid JSON that matches generated card", async () => {
    const response = await fetch(`${baseUrl}/.well-known/agent-card.json`);
    const served = await response.json();

    const generated = generateAgentCard();

    expect(served).toEqual(generated);
  });

  it("should not require authentication", async () => {
    // No auth header - should still work
    const response = await fetch(`${baseUrl}/.well-known/agent-card.json`);
    expect(response.status).toBe(200);
  });
});
