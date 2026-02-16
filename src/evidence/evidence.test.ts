import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  MANIFEST_VERSION,
  EvidenceManifestV0Schema,
  validateManifest,
} from "./manifest.js";
import {
  computeManifestHash,
  getManifestForHashing,
} from "./manifestHash.js";
import {
  createEvidenceBundle,
  readManifest,
} from "./createEvidenceBundle.js";
import {
  validateEvidenceBundle,
} from "./validateEvidenceBundle.js";
import type { EvidenceManifestV0 } from "./manifest.js";

const TEST_DIR = "/tmp/irsb-solver-test-evidence";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("Evidence Manifest Schema", () => {
  it("should accept valid manifest", () => {
    const manifest: EvidenceManifestV0 = {
      manifestVersion: MANIFEST_VERSION,
      intentId: "test-intent-id",
      runId: "test-run-id",
      jobType: "SAFE_REPORT",
      createdAt: "2026-02-05T12:00:00.000Z",
      artifacts: [
        {
          path: "artifacts/report.json",
          sha256: "a".repeat(64),
          bytes: 100,
          contentType: "application/json",
        },
      ],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
      solver: {
        service: "irsb-solver",
        serviceVersion: "0.1.0",
      },
    };

    const result = EvidenceManifestV0Schema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("should reject invalid manifest version", () => {
    const manifest = {
      manifestVersion: "0.0.1",
      intentId: "test",
      runId: "test",
      jobType: "SAFE_REPORT",
      createdAt: "2026-02-05T12:00:00.000Z",
      artifacts: [],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
      solver: { service: "irsb-solver", serviceVersion: "0.1.0" },
    };

    const result = validateManifest(manifest);
    expect(result.success).toBe(false);
  });

  it("should reject invalid hash format", () => {
    const manifest = {
      manifestVersion: MANIFEST_VERSION,
      intentId: "test",
      runId: "test",
      jobType: "SAFE_REPORT",
      createdAt: "2026-02-05T12:00:00.000Z",
      artifacts: [
        { path: "file.txt", sha256: "invalid-hash", bytes: 10, contentType: "text/plain" },
      ],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
      solver: { service: "irsb-solver", serviceVersion: "0.1.0" },
    };

    const result = validateManifest(manifest);
    expect(result.success).toBe(false);
  });
});

describe("Manifest Hash", () => {
  const baseManifest: EvidenceManifestV0 = {
    manifestVersion: MANIFEST_VERSION,
    intentId: "test-intent",
    runId: "test-run",
    jobType: "SAFE_REPORT",
    createdAt: "2026-02-05T12:00:00.000Z",
    artifacts: [],
    policyDecision: { allowed: true, reasons: [] },
    executionSummary: { status: "SUCCESS" },
    solver: { service: "irsb-solver", serviceVersion: "0.1.0" },
  };

  it("should exclude createdAt from hash computation", () => {
    const manifest1 = { ...baseManifest, createdAt: "2026-02-05T12:00:00.000Z" };
    const manifest2 = { ...baseManifest, createdAt: "2026-02-06T18:30:00.000Z" };

    const hash1 = computeManifestHash(manifest1);
    const hash2 = computeManifestHash(manifest2);

    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different content", () => {
    const manifest1 = { ...baseManifest, intentId: "intent-1" };
    const manifest2 = { ...baseManifest, intentId: "intent-2" };

    const hash1 = computeManifestHash(manifest1);
    const hash2 = computeManifestHash(manifest2);

    expect(hash1).not.toBe(hash2);
  });

  it("should produce deterministic hashes", () => {
    const hash1 = computeManifestHash(baseManifest);
    const hash2 = computeManifestHash(baseManifest);

    expect(hash1).toBe(hash2);
  });

  it("should remove createdAt from hashable payload", () => {
    const hashable = getManifestForHashing(baseManifest);
    expect(hashable).not.toHaveProperty("createdAt");
    expect(hashable).toHaveProperty("intentId");
    expect(hashable).toHaveProperty("runId");
  });
});

describe("Evidence Bundle Creation", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should create manifest with correct structure", async () => {
    const runDir = join(TEST_DIR, "run-001");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    // Create test artifacts
    const content = '{"test":"data"}';
    writeFileSync(join(artifactsDir, "report.json"), content);

    const result = await createEvidenceBundle({
      runDir,
      intentId: "intent-123",
      runId: "run-001",
      jobType: "SAFE_REPORT",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    expect(result.manifest.manifestVersion).toBe(MANIFEST_VERSION);
    expect(result.manifest.intentId).toBe("intent-123");
    expect(result.manifest.runId).toBe("run-001");
    expect(result.manifest.artifacts).toHaveLength(1);
    const firstArtifact = result.manifest.artifacts[0];
    expect(firstArtifact).toBeDefined();
    expect(firstArtifact?.path).toBe("artifacts/report.json");
  });

  it("should compute correct artifact hashes", async () => {
    const runDir = join(TEST_DIR, "run-002");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    const content = "test content";
    const expectedHash = sha256(content);
    writeFileSync(join(artifactsDir, "test.txt"), content);

    const result = await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-002",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    const artifact = result.manifest.artifacts[0];
    expect(artifact).toBeDefined();
    expect(artifact?.sha256).toBe(expectedHash);
  });

  it("should sort artifacts by path", async () => {
    const runDir = join(TEST_DIR, "run-003");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    writeFileSync(join(artifactsDir, "zebra.txt"), "z");
    writeFileSync(join(artifactsDir, "apple.txt"), "a");
    writeFileSync(join(artifactsDir, "mango.txt"), "m");

    const result = await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-003",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    const paths = result.manifest.artifacts.map((a) => a.path);
    expect(paths).toEqual([
      "artifacts/apple.txt",
      "artifacts/mango.txt",
      "artifacts/zebra.txt",
    ]);
  });

  it("should write manifest atomically", async () => {
    const runDir = join(TEST_DIR, "run-004");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, "test.txt"), "content");

    const result = await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-004",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(join(runDir, "evidence", "manifest.sha256"))).toBe(true);
  });

  it("should read manifest from disk", async () => {
    const runDir = join(TEST_DIR, "run-005");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, "test.txt"), "content");

    const createResult = await createEvidenceBundle({
      runDir,
      intentId: "read-test-intent",
      runId: "run-005",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    const readResult = readManifest(createResult.manifestPath);
    expect(readResult.intentId).toBe("read-test-intent");
    expect(readResult.runId).toBe("run-005");
  });
});

describe("Evidence Bundle Validation", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should validate a correct bundle", async () => {
    const runDir = join(TEST_DIR, "run-valid");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, "test.txt"), "content");

    await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-valid",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing manifest", async () => {
    const runDir = join(TEST_DIR, "run-no-manifest");
    mkdirSync(runDir, { recursive: true });

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "MANIFEST_NOT_FOUND")).toBe(true);
  });

  it("should detect tampered artifact (hash mismatch)", async () => {
    const runDir = join(TEST_DIR, "run-tampered");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    const originalContent = "original content";
    writeFileSync(join(artifactsDir, "test.txt"), originalContent);

    await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-tampered",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    // Tamper with the artifact
    writeFileSync(join(artifactsDir, "test.txt"), "modified content");

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "HASH_MISMATCH")).toBe(true);
  });

  it("should detect missing artifact", async () => {
    const runDir = join(TEST_DIR, "run-missing-artifact");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    writeFileSync(join(artifactsDir, "test.txt"), "content");

    await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-missing-artifact",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    // Delete the artifact
    rmSync(join(artifactsDir, "test.txt"));

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ARTIFACT_NOT_FOUND")).toBe(true);
  });

  it("should detect size mismatch", async () => {
    const runDir = join(TEST_DIR, "run-size-mismatch");
    const artifactsDir = join(runDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    writeFileSync(join(artifactsDir, "test.txt"), "short");

    await createEvidenceBundle({
      runDir,
      intentId: "intent",
      runId: "run-size-mismatch",
      jobType: "TEST",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    // Change the content to different length but same-ish hash beginning
    writeFileSync(join(artifactsDir, "test.txt"), "much longer content here");

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SIZE_MISMATCH")).toBe(true);
  });
});

describe("Path Safety", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should reject path traversal in manifest", async () => {
    const runDir = join(TEST_DIR, "run-traversal");
    const evidenceDir = join(runDir, "evidence");
    mkdirSync(evidenceDir, { recursive: true });

    // Manually create a malicious manifest
    const badManifest: EvidenceManifestV0 = {
      manifestVersion: MANIFEST_VERSION,
      intentId: "intent",
      runId: "run-traversal",
      jobType: "TEST",
      createdAt: new Date().toISOString(),
      artifacts: [
        {
          path: "../../../etc/passwd",
          sha256: "a".repeat(64),
          bytes: 100,
          contentType: "text/plain",
        },
      ],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
      solver: { service: "irsb-solver", serviceVersion: "0.1.0" },
    };

    writeFileSync(
      join(evidenceDir, "manifest.json"),
      JSON.stringify(badManifest, null, 2)
    );

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNSAFE_PATH")).toBe(true);
  });

  it("should reject absolute paths in manifest", async () => {
    const runDir = join(TEST_DIR, "run-absolute");
    const evidenceDir = join(runDir, "evidence");
    mkdirSync(evidenceDir, { recursive: true });

    const badManifest: EvidenceManifestV0 = {
      manifestVersion: MANIFEST_VERSION,
      intentId: "intent",
      runId: "run-absolute",
      jobType: "TEST",
      createdAt: new Date().toISOString(),
      artifacts: [
        {
          path: "/etc/passwd",
          sha256: "a".repeat(64),
          bytes: 100,
          contentType: "text/plain",
        },
      ],
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
      solver: { service: "irsb-solver", serviceVersion: "0.1.0" },
    };

    writeFileSync(
      join(evidenceDir, "manifest.json"),
      JSON.stringify(badManifest, null, 2)
    );

    const result = await validateEvidenceBundle(runDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNSAFE_PATH")).toBe(true);
  });
});

describe("Determinism", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should produce identical manifest hashes for identical content", async () => {
    // Run 1
    const runDir1 = join(TEST_DIR, "run-determ-1");
    const artifactsDir1 = join(runDir1, "artifacts");
    mkdirSync(artifactsDir1, { recursive: true });
    writeFileSync(join(artifactsDir1, "report.json"), '{"key":"value"}');
    writeFileSync(join(artifactsDir1, "report.md"), "# Report\n");

    const result1 = await createEvidenceBundle({
      runDir: runDir1,
      intentId: "same-intent",
      runId: "same-run",
      jobType: "SAFE_REPORT",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    // Clean and run 2 with identical content
    rmSync(runDir1, { recursive: true });

    const runDir2 = join(TEST_DIR, "run-determ-1");
    const artifactsDir2 = join(runDir2, "artifacts");
    mkdirSync(artifactsDir2, { recursive: true });
    writeFileSync(join(artifactsDir2, "report.json"), '{"key":"value"}');
    writeFileSync(join(artifactsDir2, "report.md"), "# Report\n");

    const result2 = await createEvidenceBundle({
      runDir: runDir2,
      intentId: "same-intent",
      runId: "same-run",
      jobType: "SAFE_REPORT",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    // Hash should be identical (createdAt is excluded)
    expect(result1.manifestSha256).toBe(result2.manifestSha256);
  });

  it("should produce different hashes for different artifact content", async () => {
    const runDir1 = join(TEST_DIR, "run-diff-1");
    const artifactsDir1 = join(runDir1, "artifacts");
    mkdirSync(artifactsDir1, { recursive: true });
    writeFileSync(join(artifactsDir1, "report.json"), '{"version":1}');

    const result1 = await createEvidenceBundle({
      runDir: runDir1,
      intentId: "same-intent",
      runId: "same-run",
      jobType: "SAFE_REPORT",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    const runDir2 = join(TEST_DIR, "run-diff-2");
    const artifactsDir2 = join(runDir2, "artifacts");
    mkdirSync(artifactsDir2, { recursive: true });
    writeFileSync(join(artifactsDir2, "report.json"), '{"version":2}');

    const result2 = await createEvidenceBundle({
      runDir: runDir2,
      intentId: "same-intent",
      runId: "same-run",
      jobType: "SAFE_REPORT",
      policyDecision: { allowed: true, reasons: [] },
      executionSummary: { status: "SUCCESS" },
    });

    expect(result1.manifestSha256).not.toBe(result2.manifestSha256);
  });
});
