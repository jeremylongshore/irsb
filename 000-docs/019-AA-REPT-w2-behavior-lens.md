# AAR: W2 Behavior Lens

**Doc ID**: 019-AA-REPT
**Timestamp**: 2026-02-06 00:20 CST
**Branch**: `feature/w2-behavior-lens`

## Objective

Add the Behavior Lens to Watchtower: ingest solver evidence manifests, verify evidence bundles/artifacts, derive deterministic behavior signals, and flow them through the existing W1 scoring pipeline.

## Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `git checkout -b feature/w2-behavior-lens` | Branch created from W1 |
| `pnpm build` | All 14 workspace projects build clean |
| `pnpm test` | All 332 tests pass (74 in watchtower-core: 46 W1 + 28 W2) |
| `pnpm typecheck` | No type errors |
| `wt verify-receipt --receipt .../good-run/evidence/manifest.json` | PASS (exit 0) |
| `wt verify-receipt --receipt .../tampered-artifact/evidence/manifest.json` | FAIL (exit 2) — 2 failures |
| `wt ingest-receipt --agentId test-solver --receipt .../good-run/evidence/manifest.json` | Risk 1/100, 0 alerts |

## Files Created

| File | Lines | Purpose |
|---|---|---|
| `packages/watchtower-core/src/integrations/solverReceiptV0.ts` | ~100 | Zod schema + normalizeReceipt |
| `packages/watchtower-core/src/integrations/index.ts` | ~15 | Barrel |
| `packages/watchtower-core/src/behavior/verifyEvidence.ts` | ~220 | Evidence verification with path safety |
| `packages/watchtower-core/src/behavior/deriveBehaviorSignals.ts` | ~75 | Signal derivation from verification |
| `packages/watchtower-core/src/behavior/ingestReceipt.ts` | ~130 | Full ingest pipeline |
| `packages/watchtower-core/src/behavior/index.ts` | ~15 | Barrel |
| `packages/watchtower-core/test/behavior.test.ts` | ~200 | 21 tests (verify, signals, ingest) |
| `packages/watchtower-core/test/integrations.test.ts` | ~100 | 7 tests (schema, normalize) |
| `packages/watchtower-core/test/fixtures/solver/**` | — | 4 fixture dirs (good, tampered, missing, bad) |
| `000-docs/017-PR-ADDM-w2-behavior-lens.md` | — | Architecture doc |
| `000-docs/018-DR-RUNB-w2-receipt-ingestion-runbook.md` | — | CLI runbook |
| `000-docs/019-AA-REPT-w2-behavior-lens.md` | — | This AAR |

## Files Modified

| File | Change |
|---|---|
| `packages/watchtower-core/src/index.ts` | Added integrations + behavior exports |
| `packages/watchtower-cli/src/cli.ts` | Added `ingest-receipt` and `verify-receipt` commands |

## Design Decisions

1. **Raw file hash for manifestSha256** — Hash the manifest bytes on disk, not the parsed object. This catches any on-disk tampering.
2. **Path safety inline** — Adapted irsb-solver's `fsSafe.ts` patterns inline rather than adding a dependency. Simple `validateRelativePath()` + `safeJoin()`.
3. **Ingest always stores** — Even if verification fails, we store the snapshot/report/alerts for audit trail. Exit 0 on successful ingest regardless of verification outcome.
4. **Signal dedup** — Multiple failures of the same type (e.g., two missing artifacts) produce one signal with all evidence refs.
5. **snapshotId excludes observedAt** — Idempotent across repeated ingestions of the same manifest.

## PR Link

**PR**: https://github.com/intent-solutions-io/irsb-watchtower/pull/11
