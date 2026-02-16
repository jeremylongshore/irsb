# AAR: PRE1 - CI Baseline + Canonical Drift Enforcement + Repo Hygiene

**Date**: 2026-02-05 21:25 CST
**Branch**: `chore/pre1-ci-baseline`
**PR**: https://github.com/intent-solutions-io/irsb-watchtower/pull/9

## What Changed

| File | Action | Purpose |
|------|--------|---------|
| `scripts/canonical-hashes.json` | Created | SHA-256 hashes for 000-* canonical docs |
| `scripts/check-canonical-ci.sh` | Created | CI-compatible drift checker (no irsb-solver repo needed) |
| `scripts/refresh-canonical-hashes.sh` | Created | Regenerates hashes after canonical doc sync |
| `package.json` | Edited | Added `canonical:check` and `canonical:refresh` scripts |
| `.github/workflows/ci.yml` | Edited | Added canonical drift check step before build |
| `.github/PULL_REQUEST_TEMPLATE.md` | Edited | Added canonical check + AAR checkboxes |
| `.github/ISSUE_TEMPLATE/config.yml` | Created | Enable blank issues |
| `README.md` | Edited | Operator-grade: quickstart, CI table, correct clone URL |
| `000-docs/013-AA-REPT-pre1-ci-baseline.md` | Created | This AAR |

## Commands Run + Outcomes

| Command | Result |
|---------|--------|
| `pnpm install --frozen-lockfile` | Done in 1.4s, lockfile up to date |
| `pnpm canonical:check` | 1/1 canonical doc(s) match pinned hashes |
| `pnpm build` | All 13 packages built successfully |
| `pnpm lint` | 0 errors, 43 warnings (pre-existing `no-explicit-any`) |
| `pnpm typecheck` | All packages pass |
| `pnpm test` | All test files pass (core: 13, api: 17, worker: 7) |

## CI Enforcement Summary

The CI pipeline now runs these checks on every push/PR to main:

1. Canonical drift check (`pnpm canonical:check`)
2. Build (`pnpm build`)
3. Lint (`pnpm lint`)
4. Typecheck (`pnpm typecheck`)
5. Test (`pnpm test`)
6. Security audit (`pnpm audit --audit-level=high`)

## No Dependabot

Intentionally omitted. Dependency updates are manual and deliberate for a blockchain security tool.

## Follow-ups

- W1: First real rule + contract integration
- Wire real `createChainContext()` (currently mock data in worker)
- GCP KMS / Lit PKP signer implementations
