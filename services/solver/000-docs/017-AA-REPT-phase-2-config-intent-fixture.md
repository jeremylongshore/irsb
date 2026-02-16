# After-Action Report: Phase 2 - Config, Intent Schema, Fixture CLI

**Document ID:** 017-AA-REPT-phase-2-config-intent-fixture
**Repository:** irsb-solver
**Date:** 2026-02-05
**Status:** Complete

---

## Summary

Phase 2 established the foundational data structures and CLI tooling for intent processing. All acceptance criteria met:

- Configuration system with Zod validation
- Intent Schema v0.1.0 with strong typing
- Deterministic ID computation (intentId/runId)
- Policy gate with explicit refusal reasons
- Fixture CLI with three commands
- Comprehensive test coverage (58 tests)

---

## Deliverables

### Source Files Created

| File | Purpose |
|------|---------|
| `src/config.ts` | Configuration schema and loader |
| `src/cli.ts` | Commander.js CLI with check-config, print-intent, run-fixture |
| `src/types/intent.ts` | Intent Schema v0.1.0 with Zod validation |
| `src/intent/normalize.ts` | Intent normalization and intentId computation |
| `src/plan/plan.ts` | Execution plan and runId computation |
| `src/policy/policy.ts` | Policy gate with refusal record generation |
| `src/storage/jsonl.ts` | Atomic JSONL append (write-temp-rename pattern) |
| `src/utils/canonicalJson.ts` | Deterministic JSON serialization |
| `src/utils/hash.ts` | SHA-256 helper functions |

### Test Files Created

| File | Tests |
|------|-------|
| `src/utils/canonicalJson.test.ts` | 10 tests |
| `src/intent/normalize.test.ts` | 13 tests |
| `src/plan/plan.test.ts` | 8 tests |
| `src/types/intent.test.ts` | 16 tests |
| `src/policy/policy.test.ts` | 9 tests |
| `src/index.test.ts` | 2 tests |

### Fixtures Created

| File | Purpose |
|------|---------|
| `fixtures/intents/sample-safe-report.intent.json` | Sample SAFE_REPORT intent for testing |

### Documentation Created

| File | Purpose |
|------|---------|
| `016-DR-GUID-phase-2-intent-schema-config.md` | Phase 2 technical guide |
| `017-AA-REPT-phase-2-config-intent-fixture.md` | This AAR |

---

## Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Config validation throws on invalid env | PASS | Zod.parse throws ZodError |
| Intent schema rejects wrong version | PASS | `intent.test.ts` line 35-43 |
| Intent schema rejects invalid jobType | PASS | `intent.test.ts` line 79-87 |
| intentId is deterministic | PASS | `normalize.test.ts` lines 12-60 |
| runId is deterministic | PASS | `plan.test.ts` lines 40-97 |
| canonicalJson sorts keys | PASS | `canonicalJson.test.ts` |
| Policy refusal lists all reasons | PASS | `policy.test.ts` lines 119-135 |
| JSONL writes atomically | PASS | `jsonl.ts` temp-rename pattern |
| CLI exit codes correct | PASS | 0=success, 1=error, 2=refusal |

---

## Technical Decisions

### 1. Canonical JSON Implementation

Custom implementation chosen over libraries to ensure:
- Zero dependencies for core serialization
- Predictable behavior across versions
- Direct control over edge cases

### 2. exactOptionalPropertyTypes

Enabled in tsconfig.json for strict optional property handling. Required explicit `| undefined` on optional interface properties when assigned from Zod output.

### 3. Atomic JSONL Writes

Implemented write-to-temp-then-rename pattern for atomicity on POSIX systems. Protects against partial writes on crash.

### 4. Policy Gate - All Reasons Collected

Policy evaluation runs all checks even after first failure, collecting all reasons. This provides better debugging and user feedback.

---

## Issues Encountered

### 1. TypeScript strictOptionalPropertyTypes

**Issue:** `exactOptionalPropertyTypes: true` requires explicit `| undefined` when assigning `T | undefined` to optional property.

**Resolution:** Updated `ResolvedConfig` interface:
```typescript
INTENT_FIXTURE_PATH?: string | undefined;
POLICY_REQUESTER_ALLOWLIST?: string[] | undefined;
```

### 2. ESLint Unused Destructured Variables

**Issue:** Destructured variables used to omit properties from test objects flagged as unused.

**Resolution:** Updated ESLint config to add `varsIgnorePattern: '^_'` alongside existing `argsIgnorePattern`.

### 3. Template Literal Type Safety

**Issue:** ESLint `restrict-template-expressions` flagged boolean/number in template literals.

**Resolution:** Wrapped with `String()` for explicit conversion.

---

## Metrics

| Metric | Value |
|--------|-------|
| Files created | 12 source + 2 docs |
| Tests | 58 passing |
| Type check | Clean |
| Lint | Clean |
| Build | Clean |
| CLI commands | 3 working |

---

## Beads Tasks Closed

| Task ID | Subject |
|---------|---------|
| sjc.1 | Zod config with env + optional JSON |
| sjc.2 | Intent schema v0.1.0 |
| sjc.3 | Deterministic intentId |
| sjc.4 | Deterministic runId |
| sjc.5 | Policy gate with refusal reasons |
| sjc.6 | Tests: schema + determinism + policy |
| sjc.7 | Docs: Phase 2 notes + docs index |

---

## Next Phase

Phase 3: Evidence Bundle

- Evidence manifest with artifact hashing
- Evidence directory writer
- Receipt generation
- Evidence integrity verification

---

*End of AAR*
