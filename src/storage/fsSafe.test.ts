import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateRelativePath,
  safeJoin,
  safeRelative,
  ensureDir,
  atomicWrite,
  listFilesRecursive,
} from "./fsSafe.js";

const TEST_DIR = "/tmp/irsb-solver-test-fsSafe";

describe("validateRelativePath", () => {
  it("should accept valid relative paths", () => {
    expect(validateRelativePath("file.txt").valid).toBe(true);
    expect(validateRelativePath("dir/file.txt").valid).toBe(true);
    expect(validateRelativePath("a/b/c/d.json").valid).toBe(true);
  });

  it("should reject empty paths", () => {
    const result = validateRelativePath("");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("empty");
  });

  it("should reject absolute paths", () => {
    const result = validateRelativePath("/etc/passwd");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Absolute");
  });

  it("should reject path traversal", () => {
    expect(validateRelativePath("../file.txt").valid).toBe(false);
    expect(validateRelativePath("dir/../../../etc/passwd").valid).toBe(false);
    expect(validateRelativePath("./dir/../../secret").valid).toBe(false);
  });

  it("should reject null bytes", () => {
    const result = validateRelativePath("file\0.txt");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Null");
  });
});

describe("safeJoin", () => {
  it("should join paths within base directory", () => {
    const result = safeJoin("/base/dir", "sub", "file.txt");
    expect(result).toBe("/base/dir/sub/file.txt");
  });

  it("should return null for path traversal attempts", () => {
    const result = safeJoin("/base/dir", "..", "..", "etc", "passwd");
    expect(result).toBeNull();
  });

  it("should handle single path component", () => {
    const result = safeJoin("/base", "file.txt");
    expect(result).toBe("/base/file.txt");
  });
});

describe("safeRelative", () => {
  it("should compute relative path within base", () => {
    const result = safeRelative("/base/dir", "/base/dir/sub/file.txt");
    expect(result).toBe("sub/file.txt");
  });

  it("should return null for paths outside base", () => {
    const result = safeRelative("/base/dir", "/other/dir/file.txt");
    expect(result).toBeNull();
  });
});

describe("ensureDir", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("should create directory if not exists", () => {
    const dirPath = join(TEST_DIR, "a", "b", "c");
    expect(existsSync(dirPath)).toBe(false);

    ensureDir(dirPath);

    expect(existsSync(dirPath)).toBe(true);
  });

  it("should not fail if directory already exists", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    expect(() => {
      ensureDir(TEST_DIR);
    }).not.toThrow();
  });
});

describe("atomicWrite", () => {
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

  it("should write file atomically", () => {
    const filePath = join(TEST_DIR, "test.txt");
    const content = "test content";

    atomicWrite(filePath, content);

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(content);
  });

  it("should create parent directories", () => {
    const filePath = join(TEST_DIR, "sub", "dir", "test.txt");
    const content = "nested content";

    atomicWrite(filePath, content);

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(content);
  });

  it("should overwrite existing file", () => {
    const filePath = join(TEST_DIR, "overwrite.txt");
    writeFileSync(filePath, "original");

    atomicWrite(filePath, "updated");

    expect(readFileSync(filePath, "utf8")).toBe("updated");
  });
});

describe("listFilesRecursive", () => {
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

  it("should list files in flat directory", () => {
    writeFileSync(join(TEST_DIR, "a.txt"), "a");
    writeFileSync(join(TEST_DIR, "b.txt"), "b");

    const files = listFilesRecursive(TEST_DIR);

    expect(files).toContain("a.txt");
    expect(files).toContain("b.txt");
    expect(files).toHaveLength(2);
  });

  it("should list files recursively", () => {
    mkdirSync(join(TEST_DIR, "sub"));
    writeFileSync(join(TEST_DIR, "root.txt"), "root");
    writeFileSync(join(TEST_DIR, "sub", "nested.txt"), "nested");

    const files = listFilesRecursive(TEST_DIR);

    expect(files).toContain("root.txt");
    expect(files).toContain("sub/nested.txt");
  });

  it("should return sorted list", () => {
    writeFileSync(join(TEST_DIR, "z.txt"), "z");
    writeFileSync(join(TEST_DIR, "a.txt"), "a");
    writeFileSync(join(TEST_DIR, "m.txt"), "m");

    const files = listFilesRecursive(TEST_DIR);

    expect(files).toEqual(["a.txt", "m.txt", "z.txt"]);
  });

  it("should return empty array for non-existent directory", () => {
    const files = listFilesRecursive(join(TEST_DIR, "does-not-exist"));
    expect(files).toEqual([]);
  });
});
