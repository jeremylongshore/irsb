import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { writeArtifact, writeArtifacts } from "./writeArtifacts.js";

const TEST_DIR = "/tmp/irsb-solver-test-writeArtifacts";

describe("writeArtifact", () => {
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

  it("should write content to file", () => {
    const filePath = join(TEST_DIR, "test.txt");
    const content = "Hello, World!";

    const bytes = writeArtifact(filePath, content);

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(content);
    expect(bytes).toBe(content.length);
  });

  it("should create parent directories", () => {
    const filePath = join(TEST_DIR, "deep", "nested", "path", "file.txt");
    const content = "Nested content";

    writeArtifact(filePath, content);

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(content);
  });

  it("should overwrite existing files", () => {
    const filePath = join(TEST_DIR, "overwrite.txt");

    writeArtifact(filePath, "Original content");
    writeArtifact(filePath, "New content");

    expect(readFileSync(filePath, "utf8")).toBe("New content");
  });

  it("should not leave temp files on success", () => {
    const filePath = join(TEST_DIR, "no-temp.txt");

    writeArtifact(filePath, "Content");

    const files = readdirSync(TEST_DIR);
    const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
    expect(tempFiles).toHaveLength(0);
  });
});

describe("writeArtifacts", () => {
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

  it("should write multiple files", () => {
    const artifacts = [
      { path: join(TEST_DIR, "file1.txt"), content: "Content 1" },
      { path: join(TEST_DIR, "file2.txt"), content: "Content 2" },
      { path: join(TEST_DIR, "file3.txt"), content: "Content 3" },
    ];

    const results = writeArtifacts(artifacts);

    expect(results).toHaveLength(3);
    expect(readFileSync(join(TEST_DIR, "file1.txt"), "utf8")).toBe("Content 1");
    expect(readFileSync(join(TEST_DIR, "file2.txt"), "utf8")).toBe("Content 2");
    expect(readFileSync(join(TEST_DIR, "file3.txt"), "utf8")).toBe("Content 3");
  });

  it("should return artifact info with path and bytes", () => {
    const artifacts = [
      { path: join(TEST_DIR, "info.txt"), content: "12345678901234567890" },
    ];

    const results = writeArtifacts(artifacts);

    expect(results[0]?.path).toBe("info.txt");
    expect(results[0]?.bytes).toBe(20);
  });

  it("should create parent directories for all files", () => {
    const artifacts = [
      { path: join(TEST_DIR, "a", "file1.txt"), content: "A" },
      { path: join(TEST_DIR, "b", "file2.txt"), content: "B" },
    ];

    writeArtifacts(artifacts);

    expect(existsSync(join(TEST_DIR, "a", "file1.txt"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "b", "file2.txt"))).toBe(true);
  });

  it("should not leave temp files on success", () => {
    const artifacts = [
      { path: join(TEST_DIR, "clean1.txt"), content: "Content" },
      { path: join(TEST_DIR, "clean2.txt"), content: "Content" },
    ];

    writeArtifacts(artifacts);

    const files = readdirSync(TEST_DIR);
    const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
    expect(tempFiles).toHaveLength(0);
  });
});
