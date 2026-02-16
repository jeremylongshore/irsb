# W1 Local Development Runbook

**Doc ID**: 015-DR-RUNB
**Status**: Active
**Created**: 2026-02-05

## Prerequisites

- Node.js >= 20
- pnpm >= 8

## Setup

```bash
pnpm install
pnpm build
```

## Initialize Database

```bash
# Default path: ./data/watchtower.db
npx wt init-db

# Custom path
WATCHTOWER_DB_PATH=/path/to/watchtower.db npx wt init-db
# or
npx wt init-db --db-path /path/to/watchtower.db
```

## Register an Agent

```bash
npx wt upsert-agent --agentId solver-001 --labels solver,tier-1 --status ACTIVE
```

## Add a Snapshot

Create a JSON file with signals:

```json
[
  {
    "signalId": "sig-late-receipt",
    "severity": "HIGH",
    "weight": 0.9,
    "observedAt": 1700000000,
    "evidence": [
      { "type": "tx", "ref": "0xabc123" }
    ]
  },
  {
    "signalId": "sig-low-bond",
    "severity": "MEDIUM",
    "weight": 0.5,
    "observedAt": 1700000000,
    "evidence": [
      { "type": "contract", "ref": "0xdef456" }
    ]
  }
]
```

Then add it:

```bash
npx wt add-snapshot --agentId solver-001 --signals /path/to/signals.json
```

## Score an Agent

```bash
# Score using latest 20 snapshots (default)
npx wt score-agent --agentId solver-001

# Score using latest 5 snapshots
npx wt score-agent --agentId solver-001 --limit 5
```

## View Risk Report

```bash
npx wt risk-report solver-001
```

## List Alerts

```bash
# All alerts
npx wt list-alerts

# Alerts for specific agent
npx wt list-alerts --agentId solver-001

# Only active alerts
npx wt list-alerts --active-only
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WATCHTOWER_DB_PATH` | `./data/watchtower.db` | SQLite database path |

## Development Commands

```bash
# Run watchtower-core tests
pnpm --filter @irsb-watchtower/watchtower-core test

# Watch mode
pnpm --filter @irsb-watchtower/watchtower-core test:watch

# Typecheck
pnpm --filter @irsb-watchtower/watchtower-core typecheck

# Build all
pnpm build
```

## Full Smoke Test

```bash
export WATCHTOWER_DB_PATH=/tmp/wt-test.db
cat > /tmp/wt-test-signals.json <<EOL
[
  {
    "signalId": "sig-smoke-test",
    "severity": "MEDIUM",
    "weight": 0.7,
    "observedAt": 1700000000,
    "evidence": [{ "type": "test", "ref": "smoke" }]
  }
]
EOL
npx wt init-db
npx wt upsert-agent --agentId test1
npx wt add-snapshot --agentId test1 --signals /tmp/wt-test-signals.json
npx wt score-agent --agentId test1
npx wt risk-report test1
npx wt list-alerts
rm /tmp/wt-test.db /tmp/wt-test-signals.json
```
