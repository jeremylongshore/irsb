# Phase 3 Addendum: Artifact Layout and Atomic Writes

**Document ID:** 019-DR-ADDM-phase-3-artifact-layout-atomic-writes
**Repository:** irsb-solver
**Created:** 2026-02-05
**Status:** Complete

---

## Overview

This document specifies the directory structure for run artifacts and the atomic write mechanism used to ensure data integrity.

---

## Directory Structure

### Base Layout

```
{DATA_DIR}/
├── runs/
│   └── {runId}/
│       └── artifacts/
│           ├── report.json
│           └── report.md
├── receipts.jsonl
└── refusals.jsonl
```

### Path Computation

```typescript
// Run artifacts directory
const artifactsDir = `${dataDir}/runs/${runId}/artifacts`;

// Individual artifact paths
const jsonPath = `${artifactsDir}/report.json`;
const mdPath = `${artifactsDir}/report.md`;
```

### Naming Conventions

| Component | Format | Example |
|-----------|--------|---------|
| DATA_DIR | Configurable | `./data` or `/var/irsb/data` |
| runId | SHA-256 hex (64 chars) | `e7aac0da74b4a792...` |
| Artifacts | Fixed names per job type | `report.json`, `report.md` |

---

## Atomic Write Pattern

### Why Atomic Writes?

1. **Crash safety**: Partial writes don't corrupt files
2. **Concurrent access**: Multiple processes can write safely
3. **Consistency**: Either all artifacts exist or none do

### Write-to-Temp-then-Rename

```
1. Create temp file: .tmp-{random}.ext
2. Write content to temp file
3. fsync (optional for durability)
4. Rename temp to target (atomic on POSIX)
5. Cleanup temp if rename fails
```

### Implementation

```typescript
function writeArtifact(filePath: string, content: string): number {
  ensureDir(filePath);

  const temp = tempPath(filePath);
  writeFileSync(temp, content, "utf8");
  renameSync(temp, filePath);

  return statSync(filePath).size;
}
```

---

## Batch Writing

### All-or-Nothing Semantics

When writing multiple artifacts:

```
Phase 1: Write all files to temp locations
Phase 2: Rename all temps to targets
Phase 3: Cleanup on failure
```

### Implementation

```typescript
function writeArtifacts(artifacts: { path: string; content: string }[]): ArtifactInfo[] {
  const tempFiles: { temp: string; target: string }[] = [];
  const results: ArtifactInfo[] = [];

  try {
    // Phase 1: Write to temps
    for (const { path, content } of artifacts) {
      const temp = tempPath(path);
      writeFileSync(temp, content);
      tempFiles.push({ temp, target: path });
    }

    // Phase 2: Rename all and collect results
    for (const { temp, target } of tempFiles) {
      renameSync(temp, target);
      results.push({ path: basename(target), bytes: statSync(target).size });
    }

    return results;
  } catch (error) {
    // Cleanup temps on failure
    for (const { temp } of tempFiles) {
      try { unlinkSync(temp); } catch { }
    }
    throw error;
  }
}
```

---

## Failure Semantics

### Scenarios

| Scenario | Result | Recovery |
|----------|--------|----------|
| Write fails | No temp created | Re-run job |
| Rename fails | Temp exists, target missing | Manual cleanup + re-run |
| Partial batch | Some temps, some targets | Cleanup temps + re-run |
| Process crash during write | Partial temp file | Auto-cleanup on next run |
| Process crash during rename | Undefined | Check target integrity |

### Best Practices

1. Always check for orphan temp files (`.tmp-*`)
2. Verify artifact integrity via hash before relying on content
3. Use file locking for high-concurrency scenarios

---

## Directory Creation

Parent directories are created on-demand:

```typescript
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
```

---

## Security Considerations

### Write Isolation

All writes are constrained to:
- `{DATA_DIR}/runs/{runId}/artifacts/` for job artifacts
- `{DATA_DIR}/receipts.jsonl` for receipts
- `{DATA_DIR}/refusals.jsonl` for refusals

### Path Validation

The runId is a SHA-256 hash, so:
- No path traversal possible (`../`)
- No special characters
- Fixed length (64 hex chars)

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | Base directory for all storage |

### Derived Paths

| Path | Derivation |
|------|------------|
| `RECEIPTS_PATH` | `{DATA_DIR}/receipts.jsonl` |
| `REFUSALS_PATH` | `{DATA_DIR}/refusals.jsonl` |
| `EVIDENCE_DIR` | `{DATA_DIR}/evidence` |

---

*End of Document*
