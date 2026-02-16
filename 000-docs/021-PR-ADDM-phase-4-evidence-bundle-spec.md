# Phase 4 Addendum: Evidence Bundle Specification

**Document ID:** 021-PR-ADDM-phase-4-evidence-bundle-spec
**Repository:** irsb-solver
**Created:** 2026-02-05
**Status:** Complete

---

## Overview

Evidence bundles provide verifiable integrity for job execution artifacts. Each successful run produces a manifest documenting all artifacts with their cryptographic hashes.

---

## Bundle Directory Layout

```
{DATA_DIR}/runs/{runId}/
├── artifacts/
│   ├── report.json
│   └── report.md
└── evidence/
    ├── manifest.json
    └── manifest.sha256
```

### Path Components

| Component | Format | Description |
|-----------|--------|-------------|
| `DATA_DIR` | Configurable | Base data directory |
| `runId` | SHA-256 hex (64 chars) | Unique run identifier |
| `artifacts/` | Fixed | Job output files |
| `evidence/` | Fixed | Integrity metadata |

---

## Manifest Schema (v0.1.0)

### Structure

```typescript
interface EvidenceManifestV0 {
  manifestVersion: "0.1.0";
  intentId: string;
  runId: string;
  jobType: string;
  createdAt: string;           // ISO timestamp (excluded from hash)
  artifacts: ArtifactEntry[];
  policyDecision: PolicyDecision;
  executionSummary: ExecutionSummary;
  solver: SolverMetadata;
}

interface ArtifactEntry {
  path: string;        // Relative to run directory
  sha256: string;      // Hex-encoded SHA-256
  bytes: number;       // File size
  contentType: string; // MIME type
}

interface PolicyDecision {
  allowed: boolean;
  reasons: string[];
}

interface ExecutionSummary {
  status: "SUCCESS" | "FAILED" | "REFUSED";
  error?: string;
}

interface SolverMetadata {
  service: "irsb-solver";
  serviceVersion: string;
  gitCommit?: string;
}
```

### Example Manifest

```json
{
  "manifestVersion": "0.1.0",
  "intentId": "cf2639629317d970...",
  "runId": "e7aac0da74b4a792...",
  "jobType": "SAFE_REPORT",
  "createdAt": "2026-02-05T12:00:00.000Z",
  "artifacts": [
    {
      "path": "artifacts/report.json",
      "sha256": "e44d2c99ea0469b4...",
      "bytes": 491,
      "contentType": "application/json"
    },
    {
      "path": "artifacts/report.md",
      "sha256": "a1b2c3d4e5f67890...",
      "bytes": 431,
      "contentType": "text/markdown"
    }
  ],
  "policyDecision": {
    "allowed": true,
    "reasons": []
  },
  "executionSummary": {
    "status": "SUCCESS"
  },
  "solver": {
    "service": "irsb-solver",
    "serviceVersion": "0.1.0"
  }
}
```

---

## Artifact Rules

### Path Requirements

- Must be relative to run directory
- Must start with `artifacts/`
- No path traversal (`..`)
- No absolute paths
- No null bytes

### Sorting

Artifacts are listed in **lexicographic order by path**. This ensures deterministic manifest content.

### Content Types

| Extension | MIME Type |
|-----------|-----------|
| `.json` | `application/json` |
| `.md` | `text/markdown` |
| `.txt` | `text/plain` |
| Other | `application/octet-stream` |

---

## CLI Commands

### run-fixture (Updated)

After successful job execution, automatically creates evidence bundle:

```bash
pnpm cli -- run-fixture <intent-file>
```

Output includes:
- Artifact list
- Evidence manifest path
- `manifestSha256`

### make-evidence

Creates/regenerates evidence bundle for an existing run:

```bash
pnpm cli -- make-evidence <runDir>
```

### validate-evidence

Validates evidence bundle integrity:

```bash
pnpm cli -- validate-evidence <runDir | manifestPath>
```

Checks:
1. Manifest schema validity
2. Path safety
3. Artifact existence
4. Hash integrity
5. Size match

Exit codes:
- `0`: Valid
- `1`: Invalid (with error details)

---

## Validation Errors

| Code | Description |
|------|-------------|
| `MANIFEST_NOT_FOUND` | No manifest.json in evidence directory |
| `MANIFEST_PARSE_ERROR` | JSON parse failure |
| `SCHEMA_VALIDATION_ERROR` | Schema validation failure |
| `UNSAFE_PATH` | Path traversal or absolute path |
| `PATH_ESCAPE` | Path resolves outside run directory |
| `ARTIFACT_NOT_FOUND` | Referenced file missing |
| `SIZE_MISMATCH` | File size differs from manifest |
| `HASH_MISMATCH` | SHA-256 hash differs from manifest |

---

## Security Considerations

### Path Safety

All artifact paths are validated:
- Rejected: `../secret`, `/etc/passwd`
- Accepted: `artifacts/report.json`

### Hash Verification

SHA-256 provides collision resistance for tamper detection.

### Atomic Writes

Manifests are written atomically (temp-then-rename) to prevent corruption.

---

*End of Document*
