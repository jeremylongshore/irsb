# 024-DR-RUNB-operator-runbook

**Document ID:** 024-DR-RUNB-operator-runbook
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This runbook provides operators with instructions for running, monitoring, and troubleshooting the IRSB Solver service.

---

## 1. Running the Solver

### 1.1 Server Mode (Production)

Start the HTTP server with health and metrics endpoints:

```bash
# Build and start
pnpm build
pnpm start

# Or with environment configuration
PORT=8080 LOG_LEVEL=info NODE_ENV=production pnpm start
```

The server exposes:
- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe
- `GET /metrics` - Prometheus metrics

### 1.2 CLI Mode (Single Runs)

Run individual intents without the server:

```bash
# Development (tsx)
pnpm cli -- run-fixture fixtures/intents/sample-safe-report.intent.json

# Production (built)
node dist/cli.js run-fixture fixtures/intents/sample-safe-report.intent.json
```

### 1.3 Development Mode

```bash
# Watch mode for server
pnpm dev:server

# Watch mode for CLI development
pnpm dev
```

---

## 2. Configuration

### 2.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (development, test, production) |
| `LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, fatal) |
| `PORT` | `8080` | HTTP server port |
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics |
| `DATA_DIR` | `./data` | Base directory for all data |
| `POLICY_JOBTYPE_ALLOWLIST` | `SAFE_REPORT` | Comma-separated allowed job types |
| `POLICY_MAX_ARTIFACT_MB` | `5` | Maximum artifact size in MB |

### 2.2 Config File (Optional)

Set `IRSB_SOLVER_CONFIG_PATH` to load from JSON:

```bash
IRSB_SOLVER_CONFIG_PATH=./config.json pnpm start
```

### 2.3 Verify Configuration

```bash
pnpm cli -- check-config
```

---

## 3. Data Layout

```
data/
├── runs/
│   └── <runId>/
│       ├── artifacts/
│       │   └── report.json
│       └── evidence/
│           ├── manifest.json
│           └── manifest.sha256
├── receipts.jsonl      # Successful execution receipts
└── refusals.jsonl      # Policy refusal records
```

---

## 4. Health Endpoints

### 4.1 Liveness (`/healthz`)

Returns service status and uptime:

```bash
curl http://localhost:8080/healthz
```

Response:
```json
{
  "ok": true,
  "service": "irsb-solver",
  "serviceVersion": "0.1.0",
  "gitCommit": "abc1234",
  "uptimeSeconds": 3600
}
```

### 4.2 Readiness (`/readyz`)

Checks configuration and filesystem access:

```bash
curl http://localhost:8080/readyz
```

Success:
```json
{ "ok": true }
```

Failure:
```json
{
  "ok": false,
  "reasons": [
    "DATA_DIR not writable: /data"
  ]
}
```

---

## 5. Metrics (Prometheus)

### 5.1 Scrape Configuration

```yaml
scrape_configs:
  - job_name: 'irsb-solver'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 5.2 Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `solver_intents_received_total` | Counter | Total intents received |
| `solver_intents_refused_total` | Counter | Intents refused by policy |
| `solver_runs_total{status,jobType}` | Counter | Runs by status and job type |
| `solver_run_duration_ms{jobType}` | Histogram | Run duration in milliseconds |
| `solver_evidence_bundles_total` | Counter | Evidence bundles created |
| `solver_receipts_written_total{status}` | Counter | Receipts written |
| `solver_errors_total{type}` | Counter | Errors by type |
| `solver_process_start_time_seconds` | Gauge | Process start timestamp |

### 5.3 Example Queries (PromQL)

```promql
# Intent success rate
sum(rate(solver_runs_total{status="SUCCESS"}[5m])) /
sum(rate(solver_intents_received_total[5m]))

# Average run duration
histogram_quantile(0.95, rate(solver_run_duration_ms_bucket[5m]))

# Refusal rate
rate(solver_intents_refused_total[5m]) /
rate(solver_intents_received_total[5m])
```

---

## 6. Verifying Receipts and Evidence

### 6.1 Validate Evidence Bundle

```bash
# By run directory
pnpm cli -- validate-evidence data/runs/<runId>

# By manifest file
pnpm cli -- validate-evidence data/runs/<runId>/evidence/manifest.json
```

### 6.2 Create Evidence for Existing Run

```bash
pnpm cli -- make-evidence data/runs/<runId>
```

---

## 7. Logging

### 7.1 Log Format

Production logs are JSON with correlation fields:

```json
{
  "level": 30,
  "time": 1707148800000,
  "service": "irsb-solver",
  "serviceVersion": "0.1.0",
  "intentId": "abc123",
  "runId": "run-xyz",
  "jobType": "SAFE_REPORT",
  "msg": "Job completed successfully"
}
```

### 7.2 Correlation Fields

Every log includes when available:
- `intentId` - Intent identifier
- `runId` - Run identifier
- `receiptId` - Receipt identifier
- `jobType` - Job type
- `status` - Current status

### 7.3 Redacted Fields

The following are automatically redacted:
- `inputs.data` - Input data contents
- `*.password`, `*.secret`, `*.token`
- `*.apiKey`, `*.privateKey`
- Request headers (authorization, cookies)

---

## 8. Troubleshooting

### 8.1 Service Won't Start

**Check configuration:**
```bash
pnpm cli -- check-config
```

**Check data directory permissions:**
```bash
ls -la ./data
touch ./data/test-write && rm ./data/test-write
```

### 8.2 Readiness Check Failing

**Common causes:**
- DATA_DIR doesn't exist or isn't writable
- RECEIPTS_PATH parent directory doesn't exist

**Fix:**
```bash
mkdir -p ./data
chmod 755 ./data
```

### 8.3 Intent Refused

**Check refusals log:**
```bash
tail -f data/refusals.jsonl | jq
```

**Common reasons:**
- Job type not in allowlist
- Requester not in allowlist (if configured)
- Intent expired

### 8.4 High Error Rate

**Check error metrics:**
```bash
curl -s localhost:8080/metrics | grep solver_errors_total
```

**Check logs for errors:**
```bash
# If using structured logs
cat logs/*.log | jq 'select(.level >= 50)'
```

---

## 9. Operations Checklist

### 9.1 Pre-Deployment

- [ ] Configuration validated (`check-config`)
- [ ] Data directory exists and is writable
- [ ] Prometheus scrape target configured
- [ ] Log aggregation configured

### 9.2 Post-Deployment

- [ ] `/healthz` returns ok
- [ ] `/readyz` returns ok
- [ ] `/metrics` accessible
- [ ] Test intent executes successfully

### 9.3 Monitoring Alerts (Recommended)

| Alert | Condition |
|-------|-----------|
| High Refusal Rate | `rate(solver_intents_refused_total[5m]) > 0.1` |
| High Error Rate | `rate(solver_errors_total[5m]) > 0.01` |
| Service Down | `up{job="irsb-solver"} == 0` |
| Slow Runs | `histogram_quantile(0.95, solver_run_duration_ms_bucket) > 5000` |

---

*End of Runbook*
