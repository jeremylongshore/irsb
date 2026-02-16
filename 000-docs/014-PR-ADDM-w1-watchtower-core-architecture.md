# W1 Watchtower Core Architecture

**Doc ID**: 014-PR-ADDM
**Status**: Active
**Created**: 2026-02-05

## Overview

The Watchtower Core (`packages/watchtower-core`) is the "brain" of the IRSB Watchtower. It provides:

1. **Zod Schemas** — validated data models for agents, signals, snapshots, risk reports, and alerts
2. **Determinism Utilities** — canonical JSON serialization and SHA-256 hashing for reproducible IDs
3. **Scoring Engine** — deterministic risk scoring with weighted signals
4. **SQLite Storage** — local-first persistence via `better-sqlite3`

## Schemas

All schemas live in `packages/watchtower-core/src/schemas/`.

### Agent
Represents a monitored entity (solver, protocol participant).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `agentId` | string | Yes | Unique identifier |
| `createdAt` | integer | No | Unix seconds |
| `labels` | string[] | No | Classification tags |
| `status` | enum | No | ACTIVE, PROBATION, BLOCKED |

### Signal
A single observation about an agent.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `signalId` | string | Yes | Unique per signal |
| `severity` | enum | Yes | LOW, MEDIUM, HIGH, CRITICAL |
| `weight` | number | Yes | 0.0 to 1.0 |
| `observedAt` | integer | Yes | Unix seconds |
| `evidence` | EvidenceLink[] | Yes | Supporting references |
| `details` | record | No | Arbitrary metadata |

### Snapshot
A point-in-time collection of signals for one agent.

| Field | Type | Notes |
|-------|------|-------|
| `snapshotId` | string | SHA-256 of canonical payload |
| `agentId` | string | Target agent |
| `observedAt` | integer | Unix seconds |
| `signals` | Signal[] | Observed signals |

### RiskReport
Deterministic scoring output.

| Field | Type | Notes |
|-------|------|-------|
| `reportVersion` | "0.1.0" | Schema version literal |
| `reportId` | string | SHA-256 of report (excludes `generatedAt`) |
| `agentId` | string | Target agent |
| `generatedAt` | integer | Unix seconds (excluded from hash) |
| `overallRisk` | integer | 0-100 |
| `confidence` | enum | LOW, MEDIUM, HIGH |
| `reasons` | string[] | Sorted lexicographically |
| `evidenceLinks` | EvidenceLink[] | Sorted (type asc, ref asc) |
| `signals` | SignalSummary[] | Sorted (severity desc, signalId asc) |

### Alert
Generated when risk thresholds are crossed.

| Field | Type | Notes |
|-------|------|-------|
| `alertId` | string | SHA-256 of deterministic payload |
| `agentId` | string | Target agent |
| `type` | string | e.g. CRITICAL_SIGNAL_DETECTED |
| `severity` | enum | LOW, MEDIUM, HIGH, CRITICAL |
| `description` | string | Human-readable |
| `evidenceLinks` | EvidenceLink[] | Supporting evidence |
| `createdAt` | integer | Unix seconds |
| `isActive` | boolean | Active or resolved |

## Scoring Algorithm

### Risk Score Calculation

1. Collect all signals across input snapshots
2. For each signal: `points = SEVERITY_POINTS[severity] * weight`
   - LOW = 5, MEDIUM = 15, HIGH = 30, CRITICAL = 60
3. Sum all points, cap at 100
4. If any CRITICAL signal exists: `overallRisk = 100` (override)

### Confidence Levels

| Condition | Confidence |
|-----------|-----------|
| >= 5 signals across >= 2 snapshots | HIGH |
| >= 2 signals | MEDIUM |
| Otherwise | LOW |

### Alert Generation

| Condition | Alert Type | Severity |
|-----------|-----------|----------|
| Any CRITICAL signal | CRITICAL_SIGNAL_DETECTED | CRITICAL |
| overallRisk >= 80 (no CRITICAL) | HIGH_RISK_SCORE | HIGH |

### Determinism Guarantees

- `reportId = SHA-256(canonicalJson(report_without_generatedAt))`
- `alertId = SHA-256(canonicalJson({agentId, severity, type, topEvidenceRefs}))`
- `snapshotId = SHA-256(canonicalJson({agentId, observedAt, signals}))`
- All arrays sorted before hashing
- Canonical JSON: sorted keys, compact, no trailing newline

## Storage Model

SQLite via `better-sqlite3`. WAL mode for concurrent reads.

### Tables

| Table | Primary Key | Purpose |
|-------|------------|---------|
| `agents` | `agent_id` | Agent registry |
| `snapshots` | `snapshot_id` | Signal collections |
| `alerts` | `alert_id` | Generated alerts |
| `risk_reports` | `report_id` | Scoring output |
| `_migrations` | `name` | Migration tracking |

### Indexes

- `idx_snapshots_agent`: `(agent_id, observed_at DESC)` — latest snapshots per agent
- `idx_alerts_agent`: `(agent_id, is_active, created_at DESC)` — active alerts per agent
- `idx_reports_agent`: `(agent_id, generated_at DESC)` — latest reports per agent

### Migration Strategy

SQL files in `src/storage/migrations/` applied in alphabetical order. Tracked in `_migrations` table. An inline migration fallback exists for built/bundled environments.

## Package Dependencies

```
watchtower-cli → watchtower-core → zod, better-sqlite3
                → commander, picocolors, zod
```
