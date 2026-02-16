import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { safeReportRunner, generateSummary, generateJsonReport, generateMarkdownReport, REPORT_VERSION } from "./safeReportRunner.js";
import { createRunContext } from "./runContext.js";
import type { SafeReportInputs } from "../types/intent.js";

const TEST_DATA_DIR = "/tmp/irsb-solver-test-safeReportRunner";

function sha256File(filePath: string): string {
  const content = readFileSync(filePath, "utf8");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("safeReportRunner", () => {
  beforeEach(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  const sampleInputs: SafeReportInputs = {
    subject: "Test Report",
    data: {
      key1: "value1",
      key2: 42,
      nested: { a: 1, b: 2 },
    },
  };

  const createTestContext = (runId: string) =>
    createRunContext({
      intentId: "test-intent-123",
      runId,
      jobType: "SAFE_REPORT",
      dataDir: TEST_DATA_DIR,
      requester: "test@example.com",
    });

  it("should produce SUCCESS result with artifacts", async () => {
    const ctx = createTestContext("run-001");
    const result = await safeReportRunner.run(sampleInputs, ctx);

    expect(result.status).toBe("SUCCESS");
    expect(result.intentId).toBe("test-intent-123");
    expect(result.runId).toBe("run-001");
    expect(result.jobType).toBe("SAFE_REPORT");
    expect(result.artifacts).toHaveLength(2);

    const jsonArtifact = result.artifacts.find((a) => a.path === "report.json");
    const mdArtifact = result.artifacts.find((a) => a.path === "report.md");

    expect(jsonArtifact).toBeDefined();
    expect(mdArtifact).toBeDefined();
    expect(jsonArtifact?.bytes).toBeGreaterThan(0);
    expect(mdArtifact?.bytes).toBeGreaterThan(0);
  });

  it("should write artifacts to correct directory", async () => {
    const ctx = createTestContext("run-002");
    await safeReportRunner.run(sampleInputs, ctx);

    const artifactsDir = join(TEST_DATA_DIR, "runs", "run-002", "artifacts");
    expect(existsSync(join(artifactsDir, "report.json"))).toBe(true);
    expect(existsSync(join(artifactsDir, "report.md"))).toBe(true);
  });

  describe("determinism", () => {
    it("should produce identical artifacts across multiple runs", async () => {
      // First run
      const ctx1 = createTestContext("run-determinism-1");
      await safeReportRunner.run(sampleInputs, ctx1);
      const json1Hash = sha256File(
        join(TEST_DATA_DIR, "runs", "run-determinism-1", "artifacts", "report.json")
      );
      const md1Hash = sha256File(
        join(TEST_DATA_DIR, "runs", "run-determinism-1", "artifacts", "report.md")
      );

      // Second run with same runId (to get same output)
      const ctx2 = createTestContext("run-determinism-1");
      // Clean up and re-run
      rmSync(join(TEST_DATA_DIR, "runs", "run-determinism-1"), { recursive: true });
      await safeReportRunner.run(sampleInputs, ctx2);
      const json2Hash = sha256File(
        join(TEST_DATA_DIR, "runs", "run-determinism-1", "artifacts", "report.json")
      );
      const md2Hash = sha256File(
        join(TEST_DATA_DIR, "runs", "run-determinism-1", "artifacts", "report.md")
      );

      expect(json1Hash).toBe(json2Hash);
      expect(md1Hash).toBe(md2Hash);
    });

    it("should produce different artifacts for different inputs", async () => {
      const ctx1 = createTestContext("run-diff-1");
      await safeReportRunner.run(sampleInputs, ctx1);

      const differentInputs: SafeReportInputs = {
        subject: "Different Report",
        data: { different: "data" },
      };
      const ctx2 = createTestContext("run-diff-2");
      await safeReportRunner.run(differentInputs, ctx2);

      const json1Hash = sha256File(
        join(TEST_DATA_DIR, "runs", "run-diff-1", "artifacts", "report.json")
      );
      const json2Hash = sha256File(
        join(TEST_DATA_DIR, "runs", "run-diff-2", "artifacts", "report.json")
      );

      expect(json1Hash).not.toBe(json2Hash);
    });

    it("should produce stable output regardless of input key order", async () => {
      const inputs1: SafeReportInputs = {
        subject: "Order Test",
        data: { z: 1, a: 2, m: 3 },
      };
      const inputs2: SafeReportInputs = {
        subject: "Order Test",
        data: { a: 2, m: 3, z: 1 },
      };

      const ctx1 = createTestContext("run-order-1");
      const ctx2 = createTestContext("run-order-2");

      await safeReportRunner.run(inputs1, ctx1);
      await safeReportRunner.run(inputs2, ctx2);

      const json1 = readFileSync(
        join(TEST_DATA_DIR, "runs", "run-order-1", "artifacts", "report.json"),
        "utf8"
      );
      const json2 = readFileSync(
        join(TEST_DATA_DIR, "runs", "run-order-2", "artifacts", "report.json"),
        "utf8"
      );

      // Parse and compare data sections - they should be identical
      const parsed1 = JSON.parse(json1) as { data: Record<string, unknown> };
      const parsed2 = JSON.parse(json2) as { data: Record<string, unknown> };

      expect(parsed1.data).toEqual(parsed2.data);
    });
  });

  describe("safety", () => {
    it("should only write to artifacts directory", async () => {
      const ctx = createTestContext("run-safety-1");
      await safeReportRunner.run(sampleInputs, ctx);

      // Verify files only exist in expected location
      const expectedDir = join(TEST_DATA_DIR, "runs", "run-safety-1", "artifacts");
      expect(existsSync(expectedDir)).toBe(true);

      // Verify no files written to other locations
      expect(existsSync(join(TEST_DATA_DIR, "report.json"))).toBe(false);
      expect(existsSync(join(TEST_DATA_DIR, "report.md"))).toBe(false);
    });

    it("should not include timestamps in artifacts", async () => {
      const ctx = createTestContext("run-safety-time");
      await safeReportRunner.run(sampleInputs, ctx);

      const jsonContent = readFileSync(
        join(TEST_DATA_DIR, "runs", "run-safety-time", "artifacts", "report.json"),
        "utf8"
      );
      const mdContent = readFileSync(
        join(TEST_DATA_DIR, "runs", "run-safety-time", "artifacts", "report.md"),
        "utf8"
      );

      // Check for common timestamp patterns
      // ISO timestamp format
      expect(jsonContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(mdContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Time-only format
      expect(jsonContent).not.toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
      expect(mdContent).not.toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);

      // createdAt field
      expect(jsonContent).not.toMatch(/createdAt/i);
      expect(mdContent).not.toMatch(/createdAt/i);
    });
  });
});

describe("generateSummary", () => {
  it("should return empty message for empty data", () => {
    const summary = generateSummary({});
    expect(summary).toBe("Empty data object - no keys to report.");
  });

  it("should list all keys when 5 or fewer", () => {
    const summary = generateSummary({ a: 1, b: 2, c: 3 });
    expect(summary).toBe("Report contains 3 key(s): a, b, c.");
  });

  it("should show first 5 keys when more than 5", () => {
    const summary = generateSummary({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 });
    expect(summary).toBe("Report contains 7 key(s). First 5: a, b, c, d, e.");
  });

  it("should sort keys lexicographically", () => {
    const summary = generateSummary({ z: 1, a: 2, m: 3 });
    expect(summary).toBe("Report contains 3 key(s): a, m, z.");
  });
});

describe("generateJsonReport", () => {
  it("should include all required fields", () => {
    const inputs: SafeReportInputs = {
      subject: "Test",
      data: { key: "value" },
    };
    const ctx = createRunContext({
      intentId: "intent-123",
      runId: "run-456",
      jobType: "SAFE_REPORT",
      dataDir: "/tmp",
      requester: "test@example.com",
    });

    const report = generateJsonReport(inputs, ctx);

    expect(report.subject).toBe("Test");
    expect(report.data).toEqual({ key: "value" });
    expect(report.summary).toBeDefined();
    expect(report.stats.keysCount).toBe(1);
    expect(report.stats.approxBytes).toBeGreaterThan(0);
    expect(report.generatedBy.jobType).toBe("SAFE_REPORT");
    expect(report.generatedBy.intentId).toBe("intent-123");
    expect(report.generatedBy.runId).toBe("run-456");
    expect(report.generatedBy.reportVersion).toBe(REPORT_VERSION);
  });
});

describe("generateMarkdownReport", () => {
  it("should include title with subject", () => {
    const inputs: SafeReportInputs = {
      subject: "My Report",
      data: {},
    };
    const ctx = createRunContext({
      intentId: "intent-123",
      runId: "run-456",
      jobType: "SAFE_REPORT",
      dataDir: "/tmp",
      requester: "test@example.com",
    });

    const md = generateMarkdownReport(inputs, ctx);

    expect(md).toContain("# SAFE_REPORT: My Report");
    expect(md).toContain("## Summary");
    expect(md).toContain("## Data");
    expect(md).toContain("Intent: intent-123");
    expect(md).toContain("Run: run-456");
  });

  it("should format data keys in sorted order", () => {
    const inputs: SafeReportInputs = {
      subject: "Test",
      data: { zebra: "z", apple: "a", mango: "m" },
    };
    const ctx = createRunContext({
      intentId: "intent-123",
      runId: "run-456",
      jobType: "SAFE_REPORT",
      dataDir: "/tmp",
      requester: "test@example.com",
    });

    const md = generateMarkdownReport(inputs, ctx);

    // Check order by finding positions
    const applePos = md.indexOf("**apple**");
    const mangoPos = md.indexOf("**mango**");
    const zebraPos = md.indexOf("**zebra**");

    expect(applePos).toBeLessThan(mangoPos);
    expect(mangoPos).toBeLessThan(zebraPos);
  });
});
