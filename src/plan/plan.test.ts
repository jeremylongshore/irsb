import { describe, it, expect } from "vitest";
import { computeRunId, createExecutionPlan, formatExecutionPlan } from "./plan.js";
import type { NormalizedIntent } from "../types/intent.js";
import type { ResolvedConfig } from "../config.js";
import type { PolicyResult } from "../policy/policy.js";

const baseIntent: NormalizedIntent = {
  intentVersion: "0.1.0",
  intentId: "intent-abc123",
  requester: "test@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
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

const allowedPolicy: PolicyResult = {
  allowed: true,
  reasons: [],
};

const refusedPolicy: PolicyResult = {
  allowed: false,
  reasons: ["test reason 1", "test reason 2"],
};

describe("computeRunId", () => {
  it("should produce deterministic runId", () => {
    const id1 = computeRunId(baseIntent);
    const id2 = computeRunId(baseIntent);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("should produce different runId for different intentId", () => {
    const intent2: NormalizedIntent = {
      ...baseIntent,
      intentId: "different-intent-id",
    };

    const id1 = computeRunId(baseIntent);
    const id2 = computeRunId(intent2);

    expect(id1).not.toBe(id2);
  });

  it("should produce different runId for different inputs", () => {
    const intent2: NormalizedIntent = {
      ...baseIntent,
      inputs: {
        subject: "Different Subject",
        data: {},
      },
    };

    const id1 = computeRunId(baseIntent);
    const id2 = computeRunId(intent2);

    expect(id1).not.toBe(id2);
  });

  it("should produce same runId regardless of input key order", () => {
    const intent1: NormalizedIntent = {
      ...baseIntent,
      inputs: {
        subject: "Test",
        data: { b: 2, a: 1 },
      },
    };

    const intent2: NormalizedIntent = {
      ...baseIntent,
      inputs: {
        data: { a: 1, b: 2 },
        subject: "Test",
      },
    };

    const id1 = computeRunId(intent1);
    const id2 = computeRunId(intent2);

    expect(id1).toBe(id2);
  });
});

describe("createExecutionPlan", () => {
  it("should create plan with correct fields", () => {
    const plan = createExecutionPlan(baseIntent, baseConfig, allowedPolicy);

    expect(plan.intentId).toBe(baseIntent.intentId);
    expect(plan.runId).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.jobType).toBe(baseIntent.jobType);
    expect(plan.paths.receiptsPath).toBe(baseConfig.RECEIPTS_PATH);
    expect(plan.paths.refusalsPath).toBe(baseConfig.REFUSALS_PATH);
    expect(plan.paths.evidenceDir).toBe(baseConfig.EVIDENCE_DIR);
    expect(plan.policyDecision).toBe(allowedPolicy);
  });

  it("should compute runId consistently", () => {
    const plan1 = createExecutionPlan(baseIntent, baseConfig, allowedPolicy);
    const plan2 = createExecutionPlan(baseIntent, baseConfig, allowedPolicy);

    expect(plan1.runId).toBe(plan2.runId);
  });
});

describe("formatExecutionPlan", () => {
  it("should format allowed plan", () => {
    const plan = createExecutionPlan(baseIntent, baseConfig, allowedPolicy);
    const output = formatExecutionPlan(plan);

    expect(output).toContain("intentId:");
    expect(output).toContain("runId:");
    expect(output).toContain("jobType: SAFE_REPORT");
    expect(output).toContain("allowed: true");
    expect(output).not.toContain("reasons:");
  });

  it("should format refused plan with reasons", () => {
    const plan = createExecutionPlan(baseIntent, baseConfig, refusedPolicy);
    const output = formatExecutionPlan(plan);

    expect(output).toContain("allowed: false");
    expect(output).toContain("reasons:");
    expect(output).toContain("test reason 1");
    expect(output).toContain("test reason 2");
  });
});
