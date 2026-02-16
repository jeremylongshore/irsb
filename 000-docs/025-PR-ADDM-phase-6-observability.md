# 025-PR-ADDM-phase-6-observability

**Document ID:** 025-PR-ADDM-phase-6-observability
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This addendum documents the observability features added in Phase 6, including structured logging, Prometheus metrics, and health endpoints.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     IRSB Solver                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   CLI       │  │   Server    │  │   Observability     │  │
│  │  run-fixture│  │  /healthz   │  │   - pino logger     │  │
│  │  check-*    │  │  /readyz    │  │   - prom-client     │  │
│  │  make-*     │  │  /metrics   │  │   - correlation ctx │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Execution Pipeline                        │
│  Intent → Policy → Runner → Artifacts → Evidence → Receipt  │
│     ↓        ↓        ↓         ↓           ↓         ↓     │
│   log      log      log       log         log       log     │
│  metric   metric   metric    metric      metric    metric   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Structured Logging

### 2.1 Logger Configuration

```typescript
// src/obs/logger.ts
import pino from "pino";

const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service: "irsb-solver",
    serviceVersion: "0.1.0",
    pid: process.pid,
  },
  redact: {
    paths: [
      "inputs.data",
      "*.password",
      "*.secret",
      "*.token",
      "*.apiKey",
      "*.privateKey",
    ],
    censor: "[REDACTED]",
  },
});
```

### 2.2 Correlation Context

Every log during a run includes:

| Field | Description | Example |
|-------|-------------|---------|
| `intentId` | Intent identifier | `"intent-abc123"` |
| `runId` | Execution run ID | `"run-xyz789"` |
| `jobType` | Job type being executed | `"SAFE_REPORT"` |
| `status` | Current status | `"SUCCESS"` |

### 2.3 Redaction Policy

The following patterns are automatically redacted:

| Pattern | Reason |
|---------|--------|
| `inputs.data` | May contain sensitive business data |
| `*.password` | Authentication credentials |
| `*.secret` | Generic secrets |
| `*.token` | API/auth tokens |
| `*.apiKey` | API keys |
| `*.privateKey` | Cryptographic keys |

### 2.4 Log Levels

| Level | Usage |
|-------|-------|
| `trace` | Detailed debugging |
| `debug` | Development debugging |
| `info` | Normal operations |
| `warn` | Policy refusals, recoverable issues |
| `error` | Failures requiring attention |
| `fatal` | Service cannot continue |

---

## 3. Prometheus Metrics

### 3.1 Counters

| Metric | Labels | Description |
|--------|--------|-------------|
| `solver_intents_received_total` | - | Total intents received |
| `solver_intents_refused_total` | - | Intents refused by policy |
| `solver_runs_total` | `status`, `jobType` | Runs by outcome |
| `solver_receipts_written_total` | `status` | Receipts written |
| `solver_evidence_bundles_total` | - | Evidence bundles created |
| `solver_errors_total` | `type` | Errors by type |

### 3.2 Histograms

| Metric | Labels | Buckets (ms) |
|--------|--------|--------------|
| `solver_run_duration_ms` | `jobType` | 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000 |

### 3.3 Gauges

| Metric | Description |
|--------|-------------|
| `solver_process_start_time_seconds` | Unix timestamp when process started |

### 3.4 Label Cardinality

Labels are strictly controlled to prevent metric explosion:

- **Allowed:** `status` (SUCCESS, FAILED, REFUSED), `jobType` (from allowlist)
- **Forbidden:** `intentId`, `runId`, user-provided values

---

## 4. Health Endpoints

### 4.1 Liveness (`/healthz`)

Purpose: Tell orchestrator the process is alive.

Response fields:
- `ok`: Always `true` if responding
- `service`: Service name
- `serviceVersion`: Current version
- `gitCommit`: Git commit (if available)
- `uptimeSeconds`: Seconds since start

### 4.2 Readiness (`/readyz`)

Purpose: Tell load balancer the service can handle requests.

**Rate limited**: 10 requests/second (prevents DoS via filesystem access abuse).

Checks performed:
1. Configuration loaded successfully
2. DATA_DIR exists and is writable
3. RECEIPTS_PATH parent directory writable
4. REFUSALS_PATH parent directory writable

Failure response includes `reasons` array.

---

## 5. Metric Emission Points

| Event | Metrics Updated |
|-------|-----------------|
| Intent received | `intents_received_total++` |
| Policy refusal | `intents_refused_total++`, `runs_total{status=REFUSED}++` |
| Run success | `runs_total{status=SUCCESS}++`, `run_duration_ms`, `evidence_bundles_total++`, `receipts_written_total++` |
| Run failure | `runs_total{status=FAILED}++`, `run_duration_ms`, `errors_total++` |
| Exception | `errors_total{type=exception}++` |

---

## 6. Determinism Preservation

Observability does NOT affect determinism of:
- Evidence manifests (no log/metric data in artifacts)
- Receipts (deterministic fields only)
- Artifact hashes (unchanged)

Timestamps in logs and metrics are for operational visibility only.

---

## 7. Files Added/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/obs/logger.ts` | Structured logging with pino |
| `src/obs/metrics.ts` | Prometheus metrics with prom-client |
| `src/obs/index.ts` | Module exports |
| `src/server/server.ts` | Express server with endpoints |
| `src/server/index.ts` | Server exports |
| `src/main.ts` | Server entry point |

### Modified Files

| File | Changes |
|------|---------|
| `src/config.ts` | Added PORT, METRICS_ENABLED |
| `src/cli.ts` | Added logging and metrics to run-fixture |
| `package.json` | Added dependencies, start/dev:server scripts |

---

## 8. Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `pino` | ^9.14.0 | Structured JSON logging |
| `pino-pretty` | ^11.0.0 | Development log formatting |
| `prom-client` | ^15.1.3 | Prometheus metrics |
| `express` | ^5.2.1 | HTTP server |
| `express-rate-limit` | ^8.2.1 | Rate limiting for I/O endpoints |
| `@types/express` | ^5.0.6 | TypeScript types |

---

*End of Document*
