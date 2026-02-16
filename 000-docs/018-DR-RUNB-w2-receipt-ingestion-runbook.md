# Runbook: W2 Receipt Ingestion

**Doc ID**: 018-DR-RUNB
**Status**: Active
**Created**: 2026-02-06

## Prerequisites

- `pnpm install` and `pnpm build` completed
- SQLite DB initialized (auto-created on first use)

## CLI Commands

### verify-receipt (read-only)

Verify a solver evidence manifest without writing to the database.

```bash
wt verify-receipt --receipt <path-to-manifest.json> [--runDir <dir>]
```

**Options:**
- `--receipt` (required) — Path to the evidence `manifest.json`
- `--runDir` (optional) — Run directory root. If omitted, inferred by stripping `evidence/manifest.json` from the receipt path.

**Exit codes:**
- `0` — PASS (all artifacts verified)
- `2` — FAIL (verification failures detected)
- `1` — Config/IO error

**Example:**
```bash
# Verify a good manifest
wt verify-receipt --receipt /path/to/run-001/evidence/manifest.json
# Output: PASS — 3 evidence links

# Verify a tampered manifest
wt verify-receipt --receipt /path/to/tampered-run/evidence/manifest.json
# Output: FAIL — 2 failure(s)
#   ARTIFACT_HASH_MISMATCH artifacts/report.txt ...
#   ARTIFACT_SIZE_MISMATCH artifacts/report.txt ...
```

### ingest-receipt (writes to DB)

Ingest a solver evidence manifest: verify, derive signals, score, store everything.

```bash
wt ingest-receipt --agentId <id> --receipt <path-to-manifest.json> [--runDir <dir>]
```

**Options:**
- `--agentId` (required) — Agent identifier (auto-created if missing)
- `--receipt` (required) — Path to the evidence `manifest.json`
- `--runDir` (optional) — Run directory root

**Exit codes:**
- `0` — Success (even if verification fails — data is stored for audit)
- `1` — Config/IO error

**Example:**
```bash
# Ingest from a solver run
export WATCHTOWER_DB_PATH=./data/watchtower.db
wt ingest-receipt --agentId solver-alpha --receipt /runs/run-001/evidence/manifest.json

# Output:
#   Ingest Result for solver-alpha
#   Receipt ID:   1b707379add18550...
#   Verification: PASS
#   Overall Risk: 1/100
#   Report ID:    abd18553ce78e0c8...
#   New Alerts:   0
```

## Typical Workflow

```bash
# 1. Initialize DB (first time only)
wt init-db

# 2. Quick-check a manifest before ingesting
wt verify-receipt --receipt /runs/run-042/evidence/manifest.json

# 3. Ingest and score
wt ingest-receipt --agentId solver-alpha --receipt /runs/run-042/evidence/manifest.json

# 4. View the risk report
wt risk-report solver-alpha

# 5. Check for alerts
wt list-alerts --agentId solver-alpha --active-only
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `WATCHTOWER_DB_PATH` | `./data/watchtower.db` | SQLite database file path |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MANIFEST_NOT_FOUND` | Check `--receipt` path is correct |
| `MANIFEST_HASH_MISMATCH` | Manifest file was modified after receipt was created |
| `ARTIFACT_NOT_FOUND` | Artifact referenced in manifest is missing from disk |
| `UNSAFE_PATH` | Manifest references paths with `..` or absolute paths |
| Exit code 1 on ingest | Check file permissions and DB path |
