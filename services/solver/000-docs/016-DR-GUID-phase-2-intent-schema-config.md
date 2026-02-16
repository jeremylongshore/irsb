# Phase 2: Intent Schema, Config, and Fixture CLI

**Document ID:** 016-DR-GUID-phase-2-intent-schema-config
**Repository:** irsb-solver
**Created:** 2026-02-05
**Status:** Complete

---

## Overview

Phase 2 establishes the foundational data structures and tooling for intent processing:

1. **Configuration System** - Zod-validated config from environment and optional JSON file
2. **Intent Schema v0.1.0** - Strongly-typed intent structure with validation
3. **Deterministic IDs** - Reproducible `intentId` and `runId` via canonical JSON + SHA-256
4. **Policy Gate** - Allowlist/expiry/size enforcement with explicit refusal reasons
5. **Fixture CLI** - Commands for validation, normalization, and dry-run execution

---

## Configuration System

### Source Priority
1. Environment variables (always loaded)
2. JSON config file (if `IRSB_SOLVER_CONFIG_PATH` is set)

JSON file values override environment variables.

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `NODE_ENV` | enum | `development` | Environment: development, test, production |
| `LOG_LEVEL` | enum | `info` | Pino log level |
| `DATA_DIR` | string | `./data` | Base directory for storage |
| `POLICY_JOBTYPE_ALLOWLIST` | string | `SAFE_REPORT` | Comma-separated allowed job types |
| `POLICY_MAX_ARTIFACT_MB` | number | `5` | Maximum inputs size in MB |
| `POLICY_REQUESTER_ALLOWLIST` | string | (none) | Optional comma-separated allowed requesters |
| `RECEIPTS_PATH` | string | `{DATA_DIR}/receipts.jsonl` | Path to receipts file |
| `REFUSALS_PATH` | string | `{DATA_DIR}/refusals.jsonl` | Path to refusals file |
| `EVIDENCE_DIR` | string | `{DATA_DIR}/evidence` | Directory for evidence artifacts |

### Usage

```typescript
import { loadConfig, configSummary } from "./config.js";

const config = loadConfig(); // Throws ZodError on validation failure
console.log(configSummary(config)); // Sanitized view (no secrets)
```

---

## Intent Schema v0.1.0

### Structure

```typescript
interface IntentV0 {
  intentVersion: "0.1.0";        // Must match exactly
  intentId?: string;             // Computed if missing
  requester: string;             // Non-empty identifier
  createdAt: string;             // ISO timestamp
  expiresAt?: string;            // Optional expiry
  jobType: "SAFE_REPORT";        // Enum (currently single value)
  inputs: {
    subject: string;             // Non-empty
    data: Record<string, unknown>;
  };
  constraints?: Record<string, unknown>;
  acceptanceCriteria?: Array<{
    type: string;
    description?: string;
    value?: unknown;
  }>;
  meta?: Record<string, unknown>;
}
```

### Job Types

Currently supported: `SAFE_REPORT`

Future phases will add more job types to the `JobTypeSchema` enum.

---

## Deterministic ID Computation

### intentId Formula

```
sha256("intent:" + intentVersion + ":" + requester + ":" +
       canonicalJson(jobType) + ":" + canonicalJson(inputs) + ":" +
       canonicalJson(constraints ?? {}))
```

### runId Formula

```
sha256("run:" + intentId + ":" + jobType + ":" + canonicalJson(inputs))
```

### Canonical JSON Rules

1. Object keys sorted lexicographically at every level
2. Arrays preserve order
3. No whitespace
4. Numbers and booleans as-is

This ensures identical inputs always produce identical hashes regardless of key insertion order.

---

## Policy Gate

### Checks Performed

1. **jobType allowlist** - Must be in `POLICY_JOBTYPE_ALLOWLIST`
2. **Expiry check** - If `expiresAt` is set, must be in the future
3. **Requester allowlist** - If `POLICY_REQUESTER_ALLOWLIST` is configured, requester must be listed
4. **Size guard** - Serialized inputs must not exceed `POLICY_MAX_ARTIFACT_MB`

### Policy Result

```typescript
interface PolicyResult {
  allowed: boolean;
  reasons: string[];  // Empty if allowed, contains all failures otherwise
}
```

All checks run; all failures are collected (not short-circuit).

---

## Fixture CLI

### Commands

```bash
# Validate configuration
pnpm cli check-config

# Parse and normalize an intent file
pnpm cli print-intent <path>

# Full dry-run: validate, policy gate, show execution plan
pnpm cli run-fixture <path>
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (config, parse, validation) |
| 2 | Policy refusal (intent rejected) |

### Example Output

```
$ pnpm cli run-fixture fixtures/intents/sample-safe-report.intent.json

Execution Plan:
  intentId: cf2639629317d970e52706a58ad8074023e76500beff2cd25fb32d97c40d590d
  runId: e7aac0da74b4a792945ac24723d0f5c31de5dd26332ff10c1198230fc525adab
  jobType: SAFE_REPORT

Paths:
  receipts: /path/to/data/receipts.jsonl
  refusals: /path/to/data/refusals.jsonl
  evidence: /path/to/data/evidence

Policy Decision:
  allowed: true

Intent approved. Ready for execution (Phase 3).
```

---

## File Structure

```
src/
├── config.ts           # Configuration schema and loader
├── cli.ts              # Commander.js CLI entrypoint
├── types/
│   └── intent.ts       # Intent schema v0.1.0
├── intent/
│   └── normalize.ts    # Intent normalization + intentId
├── plan/
│   └── plan.ts         # Execution plan + runId
├── policy/
│   └── policy.ts       # Policy gate + refusal records
├── storage/
│   └── jsonl.ts        # Atomic JSONL append
└── utils/
    ├── canonicalJson.ts # Deterministic JSON serialization
    └── hash.ts         # SHA-256 helpers
```

---

## Testing

All modules have comprehensive tests:

- `canonicalJson.test.ts` - Key sorting, type handling, determinism
- `normalize.test.ts` - intentId computation, normalization
- `plan.test.ts` - runId computation, execution plan creation
- `intent.test.ts` - Schema validation (valid/invalid cases)
- `policy.test.ts` - All policy checks, refusal record creation

Run tests: `pnpm test`

---

## Next Steps (Phase 3)

Phase 3 will add:
- Evidence bundle manifest with artifact hashing
- Evidence directory writer
- Receipt generation and storage

---

*End of Document*
