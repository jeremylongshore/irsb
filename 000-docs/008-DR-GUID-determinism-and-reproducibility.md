# Determinism and Reproducibility Guide

**Document ID:** 008-DR-GUID-determinism-and-reproducibility
**Created:** 2026-02-04
**Timezone:** America/Chicago

---

## Overview

IRSB Solver is designed for **deterministic, reproducible execution**. The same input must always produce the same output, enabling verification and auditability.

---

## Core Pledge

> **Same intent fixture → same evidence hashes → same receipt ID**

This pledge ensures:
- Verifiers can reproduce results
- Watchtowers can detect anomalies
- Disputes can be resolved objectively

---

## Environment Requirements

### Pinned Versions

| Component | Version | Enforcement |
|-----------|---------|-------------|
| Node.js | 20.x | `engines` in package.json |
| pnpm | 9.x | `packageManager` in package.json |
| TypeScript | 5.x | `devDependencies` |

### Lockfile

- Use `pnpm install --frozen-lockfile` in CI
- Never modify `pnpm-lock.yaml` manually
- Commit lockfile to version control

---

## Canonical JSON Rules

All JSON content that will be hashed must follow canonical encoding:

1. **Sorted keys** — alphabetical order, recursive
2. **No trailing whitespace** — compact encoding
3. **Consistent number formatting** — no floating point where integers suffice
4. **UTF-8 encoding** — no BOM

### Implementation

```typescript
function canonicalStringify(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
```

---

## Deterministic ID Formulas

### Intent ID
If not provided by requester:
```
intentId = sha256(canonical({ requester, jobType, inputs, createdAt }))
```

### Run ID
```
runId = sha256(canonical({ intentId, jobType, inputs }))
```

### Receipt ID
```
receiptId = sha256(canonical({ intentId, runId, manifestSha256 }))
```

---

## Artifact Hashing

All evidence artifacts are hashed with SHA-256:

1. Read file as bytes
2. Compute SHA-256
3. Encode as lowercase hex
4. Record in manifest

### Manifest Entry Example
```json
{
  "path": "report.json",
  "sha256": "a1b2c3d4...",
  "bytes": 1234,
  "contentType": "application/json"
}
```

---

## What to Avoid

### Never Embed in Hashed Content
- Wall-clock timestamps (`new Date()`)
- Random values (`Math.random()`, `crypto.randomUUID()`)
- Process IDs or hostnames
- Non-deterministic iteration order

### Allowed in Metadata (Not Hashed)
- Execution timestamps in manifest metadata
- Environment info (for debugging)
- Service version info

---

## Verification Commands

```bash
# Run fixture twice, compare hashes
pnpm cli -- run-fixture fixtures/test-intent.json
pnpm cli -- run-fixture fixtures/test-intent.json
# Receipt IDs should match

# Validate evidence integrity
pnpm cli -- validate-evidence ./data/evidence/latest/manifest.json
```

---

## CI Enforcement

- Tests must be deterministic (no flaky tests)
- No external network calls in tests
- Fixtures are version-controlled
- Hash comparison tests included

---

*End of Document*
