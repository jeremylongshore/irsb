# W2 Behavior Lens: Receipt Ingest + Evidence Verification + Signals

**Doc ID**: 017-PR-ADDM
**Status**: Active
**Created**: 2026-02-06

## Overview

The Behavior Lens extends W1's Watchtower Core with the ability to **ingest solver evidence manifests**, **verify evidence bundles**, and **derive deterministic behavior signals** that flow through the existing scoring pipeline. Local-first, no chain indexing required.

## Schema Mapping: irsb-solver → Watchtower

The irsb-solver produces Evidence Manifests at `{runDir}/evidence/manifest.json`. The W2 adapter normalizes manifests into watchtower's receipt format:

| W2 Receipt Field | irsb-solver Source |
|---|---|
| `receiptId` | `sha256Hex(canonicalJson({intentId, runId, jobType, manifestSha256}))` |
| `receiptVersion` | `manifest.manifestVersion` ("0.1.0") |
| `intentId` | `manifest.intentId` |
| `runId` | `manifest.runId` |
| `jobType` | `manifest.jobType` |
| `status` | `manifest.executionSummary.status` |
| `manifestPath` | `"evidence/manifest.json"` (fixed convention) |
| `manifestSha256` | `sha256Hex(manifest_bytes)` — raw file hash |
| `delivered[]` | `manifest.artifacts` sorted by path |

## Verification Flow

1. Resolve manifest path under `runDir` via safe join
2. Check exists + size <= maxManifestBytes (2 MB)
3. Read bytes → SHA-256 → compare to `receipt.manifestSha256`
4. Parse JSON + validate with `SolverReceiptV0Schema`
5. For each artifact: validate path safety → safe join → exists → size check → SHA-256 check
6. Sort failures by `(code, path)` for determinism
7. Collect evidence links

### Failure Codes

| Code | Meaning |
|---|---|
| `ARTIFACT_HASH_MISMATCH` | SHA-256 doesn't match |
| `ARTIFACT_NOT_FOUND` | Referenced file missing |
| `ARTIFACT_SIZE_MISMATCH` | Bytes field != actual size |
| `ARTIFACT_TOO_LARGE` | Exceeds maxArtifactBytes (10 MB) |
| `DELIVERED_MISMATCH` | Receipt delivered[] != manifest artifacts |
| `MANIFEST_HASH_MISMATCH` | File SHA-256 != receipt.manifestSha256 |
| `MANIFEST_NOT_FOUND` | manifest.json missing |
| `MANIFEST_PARSE_FAIL` | Invalid JSON |
| `MANIFEST_READ_ERROR` | IO error |
| `MANIFEST_SCHEMA_INVALID` | Zod validation fails |
| `MANIFEST_TOO_LARGE` | Exceeds maxManifestBytes |
| `UNSAFE_PATH` | Path traversal or absolute path |

## Behavior Signals

| Signal ID | Condition | Severity | Weight |
|---|---|---|---|
| `BE_VERIFIED_OK` | ok === true | LOW | 0.1 |
| `BE_MANIFEST_NOT_FOUND` | MANIFEST_NOT_FOUND | CRITICAL | 1.0 |
| `BE_MANIFEST_HASH_MISMATCH` | MANIFEST_HASH_MISMATCH | CRITICAL | 1.0 |
| `BE_MANIFEST_PARSE_FAIL` | MANIFEST_PARSE_FAIL or MANIFEST_READ_ERROR | HIGH | 0.8 |
| `BE_MANIFEST_SCHEMA_INVALID` | MANIFEST_SCHEMA_INVALID | HIGH | 0.8 |
| `BE_MANIFEST_TOO_LARGE` | MANIFEST_TOO_LARGE | HIGH | 0.8 |
| `BE_ARTIFACT_MISSING` | ARTIFACT_NOT_FOUND | CRITICAL | 1.0 |
| `BE_ARTIFACT_HASH_MISMATCH` | ARTIFACT_HASH_MISMATCH | CRITICAL | 1.0 |
| `BE_ARTIFACT_SIZE_MISMATCH` | ARTIFACT_SIZE_MISMATCH | HIGH | 0.8 |
| `BE_UNSAFE_PATH` | UNSAFE_PATH | CRITICAL | 1.0 |
| `BE_DELIVERED_MISMATCH` | DELIVERED_MISMATCH | CRITICAL | 1.0 |
| `BE_RECEIPT_SCHEMA_INVALID` | Receipt fails Zod parse | HIGH | 0.8 |

Multiple failures of same type collapse into one signal with all evidence refs collected.

## Ingest Pipeline

```
receiptPath → readFileSync → manifestSha256
    ↓
SolverReceiptV0Schema.safeParse → normalizeReceipt
    ↓
verifyEvidence(receipt, runDir) → VerificationResult
    ↓
deriveBehaviorSignals(result, receipt, observedAt) → Signal[]
    ↓
upsertAgent + insertSnapshot + scoreAgent → RiskReport + Alerts
    ↓
IngestResult {receiptId, snapshotId, reportId, ok, overallRisk, alertCount}
```

## Security

Path safety (adapted from irsb-solver `fsSafe.ts`):
- `validateRelativePath()`: reject absolute, `..`, null bytes
- `safeJoin()`: `resolve()` + enforce prefix containment
- Size checks before reading full content
- Only read files under resolved `runDir`

## Files Created

| File | Purpose |
|---|---|
| `packages/watchtower-core/src/integrations/solverReceiptV0.ts` | Zod schema + normalizeReceipt |
| `packages/watchtower-core/src/integrations/index.ts` | Barrel export |
| `packages/watchtower-core/src/behavior/verifyEvidence.ts` | Evidence verification |
| `packages/watchtower-core/src/behavior/deriveBehaviorSignals.ts` | Signal derivation |
| `packages/watchtower-core/src/behavior/ingestReceipt.ts` | Full ingest pipeline |
| `packages/watchtower-core/src/behavior/index.ts` | Barrel export |
| `packages/watchtower-core/test/behavior.test.ts` | 21 behavior tests |
| `packages/watchtower-core/test/integrations.test.ts` | 7 integration tests |
| `packages/watchtower-core/test/fixtures/solver/**` | 4 test fixture directories |
