import { describe, it, expect } from "vitest";
import { evaluatePolicy, createRefusalRecord } from "./policy.js";
import type { NormalizedIntent } from "../types/intent.js";
import type { ResolvedConfig } from "../config.js";

const baseIntent: NormalizedIntent = {
  intentVersion: "0.1.0",
  intentId: "abc123",
  requester: "test@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-12-31T23:59:59.999Z", // Far future
  jobType: "SAFE_REPORT",
  inputs: {
    subject: "Test Report",
    data: { key: "value" },
  },
};

const baseConfig: ResolvedConfig = {
  NODE_ENV: "test",
  LOG_LEVEL: "info",
  PORT: 8080,
  METRICS_ENABLED: true,
  DATA_DIR: "./data",
  POLICY_JOBTYPE_ALLOWLIST: ["SAFE_REPORT"],
  POLICY_MAX_ARTIFACT_MB: 5,
  RECEIPTS_PATH: "./data/receipts.jsonl",
  REFUSALS_PATH: "./data/refusals.jsonl",
  EVIDENCE_DIR: "./data/evidence",
  SIGNING_MODE: "kms",
  KMS_LOCATION: "us-central1",
  KMS_KEY_VERSION: "1",
  CHAIN_ID: 11155111,
};

describe("evaluatePolicy", () => {
  it("should allow valid intent matching all policies", () => {
    const result = evaluatePolicy(baseIntent, baseConfig);

    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("should refuse intent with disallowed jobType", () => {
    const intent: NormalizedIntent = {
      ...baseIntent,
      jobType: "UNKNOWN_JOB" as NormalizedIntent["jobType"],
    };

    const result = evaluatePolicy(intent, baseConfig);

    expect(result.allowed).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("jobType");
    expect(result.reasons[0]).toContain("allowlist");
  });

  it("should refuse expired intent", () => {
    const intent: NormalizedIntent = {
      ...baseIntent,
      expiresAt: "2020-01-01T00:00:00.000Z", // Past date
    };

    const result = evaluatePolicy(intent, baseConfig);

    expect(result.allowed).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("expired");
  });

  it("should allow intent without expiresAt", () => {
    const intent: NormalizedIntent = {
      ...baseIntent,
      expiresAt: undefined,
    };

    const result = evaluatePolicy(intent, baseConfig);

    expect(result.allowed).toBe(true);
  });

  it("should refuse requester not in allowlist when configured", () => {
    const config: ResolvedConfig = {
      ...baseConfig,
      POLICY_REQUESTER_ALLOWLIST: ["allowed@example.com"],
    };

    const result = evaluatePolicy(baseIntent, config);

    expect(result.allowed).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("requester");
    expect(result.reasons[0]).toContain("allowlist");
  });

  it("should allow requester in allowlist", () => {
    const config: ResolvedConfig = {
      ...baseConfig,
      POLICY_REQUESTER_ALLOWLIST: ["test@example.com", "other@example.com"],
    };

    const result = evaluatePolicy(baseIntent, config);

    expect(result.allowed).toBe(true);
  });

  it("should refuse oversized inputs", () => {
    const largeData = "x".repeat(10 * 1024 * 1024); // 10MB
    const intent: NormalizedIntent = {
      ...baseIntent,
      inputs: {
        subject: "Large",
        data: { large: largeData },
      },
    };

    const result = evaluatePolicy(intent, baseConfig);

    expect(result.allowed).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("size");
    expect(result.reasons[0]).toContain("exceeds");
  });

  it("should collect all failure reasons", () => {
    const intent: NormalizedIntent = {
      ...baseIntent,
      jobType: "UNKNOWN" as NormalizedIntent["jobType"],
      expiresAt: "2020-01-01T00:00:00.000Z",
    };

    const config: ResolvedConfig = {
      ...baseConfig,
      POLICY_REQUESTER_ALLOWLIST: ["other@example.com"],
    };

    const result = evaluatePolicy(intent, config);

    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("createRefusalRecord", () => {
  it("should create valid refusal record", () => {
    const reasons = ["policy violation 1", "policy violation 2"];
    const record = createRefusalRecord(baseIntent, "run-123", reasons);

    expect(record.intentId).toBe(baseIntent.intentId);
    expect(record.runId).toBe("run-123");
    expect(record.jobType).toBe(baseIntent.jobType);
    expect(record.requester).toBe(baseIntent.requester);
    expect(record.reasons).toEqual(reasons);
    expect(record.intentVersion).toBe(baseIntent.intentVersion);
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
