# AAR: W1 Watchtower Core

**Doc ID**: 016-AA-REPT
**Timestamp**: 2026-02-05 22:34 CST
**Branch**: `feature/w1-watchtower-core`

## Objective

Stand up the Watchtower "brain" locally: Zod schemas, SQLite storage, deterministic scoring engine, and a minimal CLI (`wt`) that emits deterministic RiskReports and Alerts.

## Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `git checkout -b feature/w1-watchtower-core` | Branch created |
| `pnpm install` | better-sqlite3 + all deps installed (+28 packages) |
| `pnpm build` | All 14 workspace projects build clean |
| `pnpm test` | All tests pass (45 new + existing) |
| `pnpm typecheck` | No type errors |
| `pnpm lint` | 0 errors, 81 warnings (all no-console in CLI files — expected) |
| `pnpm canonical:check` | Canonical docs match pinned hashes |
| `wt init-db` | DB created successfully |
| `wt upsert-agent --agentId test1` | Agent upserted |
| `wt add-snapshot --agentId test1 --signals test-signals.json` | Snapshot added (2 signals) |
| `wt score-agent --agentId test1` | Risk 35/100, MEDIUM confidence |
| `wt risk-report test1` | Full report with reasons, signals, evidence |
| `wt list-alerts` | No alerts (score below threshold) |

## Files Created

### Agents (`.claude/agents/`)
- `ts-architect.md` — adapted from irsb-solver
- `test-engineer.md` — adapted from irsb-solver
- `security-auditor.md` — adapted from irsb-solver
- `determinism-guardian.md` — adapted from irsb-solver

### Package: `packages/watchtower-core/`
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/schemas/` — agent.ts, signal.ts, snapshot.ts, riskReport.ts, alert.ts, index.ts
- `src/utils/` — canonical.ts, sort.ts, index.ts
- `src/scoring/` — scoreAgent.ts, index.ts
- `src/storage/` — db.ts, agentStore.ts, snapshotStore.ts, alertStore.ts, reportStore.ts, index.ts
- `src/storage/migrations/001_init.sql`
- `src/index.ts` — barrel export
- `test/schemas.test.ts` — 18 tests
- `test/determinism.test.ts` — 14 tests
- `test/storage.test.ts` — 13 tests

### Package: `packages/watchtower-cli/`
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/cli.ts` — 6 CLI commands (init-db, upsert-agent, add-snapshot, score-agent, risk-report, list-alerts)
- `src/index.ts`

### Docs (`000-docs/`)
- `014-PR-ADDM-w1-watchtower-core-architecture.md`
- `015-DR-RUNB-w1-local-dev-runbook.md`
- `016-AA-REPT-w1-watchtower-core.md` (this file)

### Modified
- `package.json` (root) — added `dev:wt` script

## Test Summary

- **watchtower-core**: 45 tests (3 files) — schemas (18), determinism (14), storage (13)
- **All packages**: Full suite green

## Key Design Decisions

1. **`initDbWithInlineMigrations()`** — dual migration strategy: file-based for dev, inline for bundled builds
2. **Deterministic IDs** — all IDs derived from SHA-256 of canonical JSON payloads; `generatedAt` excluded from report hash
3. **`better-sqlite3`** — synchronous API, zero async overhead, WAL mode for concurrent reads
4. **Zod for all schemas** — runtime validation at boundaries, TypeScript types inferred

## PR Link

https://github.com/intent-solutions-io/irsb-watchtower/pull/10
