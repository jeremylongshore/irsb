# CLAUDE.md — IRSB Solver (Reference Executor)

> **AI Context**: For ecosystem-wide reference (contracts, deployments, concepts, glossary), see [../AI-CONTEXT.md](../AI-CONTEXT.md)

This file defines how Claude Code must operate in this repo. Treat it as binding.

---

## 0) Project Summary

**Repo:** `irsb-solver` | **Version:** v0.3.0
**Purpose:** Reference **solver/executor service** for the IRSB protocol. It consumes intents, runs allowed workflows off-chain, produces evidence, and submits receipts.
**Related repos:**
- `irsb-protocol` — on-chain contracts + schemas + settlement primitives
- `irsb-watchtower` — indexing/monitoring/alerts/dashboards

IRSB is **not an agent**. This repo is the actor implementation that uses IRSB.

---

## 1) Non-Negotiable Rules

1. **Use Beads for all work tracking.** No work without an epic + child tasks.
2. **`000-docs/` must be strictly flat** (no subdirectories).
3. **Docs follow `/docs-filing`** standard:
   - Project docs: `NNN-CC-ABCD-short-description.ext` (001-999)
   - Canonical standards: `000-CC-ABCD-short-description.ext` (cross-repo, must be identical)
4. **AAR required after every phase/PR merge**:
   - `NNN-AA-REPT-<short>.md` in `000-docs/`
5. **No secrets in git.** `.env.example` only; redact keys/tokens from logs and docs.
6. **Conventional commits only.** No "wip".
7. **CI must be green** before merge.

If any rule conflicts with convenience, the rule wins.

---

## 2) Operating Procedure (Always)

### 2.1 State Recovery (start of every session)
Run and summarize:
- `git status`
- `git branch -vv`
- `git log -n 10 --oneline --decorate`
- `ls -la`
- `ls 000-docs || true`
- `bd status || true`
- `bd list || true`

### 2.2 Beads Workflow (Mandatory)
Before coding:
- Ensure there is a **P0 epic** for the current initiative.
- Ensure there are **child tasks with acceptance criteria**.
- Mark the active child task as `in_progress`.

During work:
- Add notes to the Beads task with:
  - commands run
  - files changed
  - test evidence

Before PR:
- Ensure the Beads tasks referenced in the PR are complete (or explicitly deferred with rationale).

After merge:
- Mark tasks `done`.
- Create the AAR doc in `000-docs/`.

If Beads is not installed or errors:
- Stop and report the exact error output.
- Do not "simulate" Beads.

---

## 3) Branching, Commits, PRs (Required)

### 3.1 Branch naming (required)
- `feature/<short-kebab>`
- `fix/<short-kebab>`
- `docs/<short-kebab>` (docs-only changes)
- `chore/<short-kebab>` (tooling/CI/build changes)

### 3.2 Conventional commits (required)
Use Conventional Commits with scoped, readable messages.

**Allowed types:**
- `feat:`
- `fix:`
- `docs:`
- `test:`
- `chore:`
- `refactor:`
- `perf:`

**Hard rules:**
- No `wip`, no "temp", no "misc".
- One logical change per commit where practical.
- If a commit touches behavior, it must have tests or be explicitly justified in the PR.

**Examples (copy these patterns):**
- `chore: initialize irsb-solver scaffold`
- `docs: add 000-* canonical standards`
- `chore(ci): add github actions pipeline`
- `feat: add intent polling adapter`
- `feat: implement evidence manifest hashing`
- `fix: add rpc backoff with jitter`
- `test: add rule evaluation fixtures`

### 3.3 Required PRs per Phase (hard requirement)
Every phase MUST result in a PR to `main`. No phase is "done" until merged or explicitly marked "merge pending" with an AAR stating why.

**Minimum PR count:**
- **1 PR per phase** (8 phases → minimum 8 PRs)

**Additionally required PR triggers (mandatory extra PRs):**
- **Security or dependency upgrades** that are non-trivial → separate PR
- **Refactors** touching >20 files or changing module boundaries → separate PR
- **CI/tooling** changes that affect workflow reliability → separate PR
- **Docs-only** large changes → separate PR

If multiple triggers occur in one phase, split into multiple PRs.

### 3.4 PR naming + format (required)
PR Title format:
- `[Phase N] <short action phrase>`
Examples:
- `[Phase 1] scaffold repo + docs filing`
- `[Phase 2] intent schema + config + cli`
- `[Phase 3] evidence bundle + hashing`

PR description must include (required sections):
- Summary
- Beads tasks closed (IDs + titles)
- Tests run (commands + results)
- Security notes (what was checked)
- Docs changed/added (filenames in `000-docs/`)
- Rollback notes (if applicable)

Use `.github/pull_request_template.md`.

### 3.5 PR checks (required)
PR cannot merge unless:
- `pnpm lint` passes
- `pnpm test` passes
- `pnpm build` passes
- CI is green
- A reviewer/judge step exists (human or automated)

---

## 4) Code Standards

### 4.1 Tech stack (default)
- Node 20 + TypeScript
- pnpm
- `viem` for EVM interaction
- `zod` config validation
- `pino` logging
- `prom-client` metrics
- `vitest` tests
- `eslint` + `prettier`

If you change stack:
- Create ADR in `000-docs/` and justify.

### 4.2 Project structure (target)
- `src/` runtime code
- `src/index.ts` entry
- `src/config.ts` config schema (zod)
- `src/logger.ts` pino setup
- `src/metrics.ts` prom-client registry + `/metrics`
- `src/intents/` intent listeners/adapters
- `src/execution/` workflow runners + sandbox hooks
- `src/evidence/` evidence manifest + hashing + stores
- `src/receipts/` receipt builder + submitter
- `src/signing/` Cloud KMS signing client
- `src/execution/` workflow runners, x402 facilitator
- `src/policy/` allowlists/budgets/risk gates
- `src/cli.ts` small utilities
- `000-docs/` flat docs
- `.github/workflows/` CI

### 4.3 Signing Architecture

**Cloud KMS** — Direct signing via Google Cloud KMS with on-chain policy enforcement through EIP-7702 caveat enforcers (spend limits, time windows, allowed targets). Sub-100ms latency per signature. Keys never leave Google HSMs.

Implementation: `src/signing/kms-signer.ts`

```typescript
import { createKmsSigner } from './signing/kms-signer';

const signer = createKmsSigner({
  KMS_PROJECT_ID: process.env.KMS_PROJECT_ID,
  KMS_LOCATION: process.env.KMS_LOCATION ?? 'us-central1',
  KMS_KEYRING: process.env.KMS_KEYRING,
  KMS_KEY: process.env.KMS_KEY,
  KMS_KEY_VERSION: process.env.KMS_KEY_VERSION ?? '1',
  CHAIN_ID: Number(process.env.CHAIN_ID ?? '11155111'),
});
```

**Key env vars:** `KMS_PROJECT_ID`, `KMS_LOCATION`, `KMS_KEYRING`, `KMS_KEY`, `KMS_KEY_VERSION`

See `protocol/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md` for the delegation ADR.

Keep modules small and testable.

### 4.4 Testing rules
- No live RPC or external network calls in CI tests.
- Use fakes/mocks for chain clients.
- Add tests for:
  - config parsing
  - evidence manifest hashing
  - signature/HMAC if applicable
  - at least one intent→receipt path (offline)

---

## 5) Security Requirements

1. **Fail-fast config validation** on startup.
2. **Least privilege**: no default credentials; explicit env vars only.
3. **Evidence integrity**:
   - hash artifacts
   - store manifest
   - include versions (service + rule versions)
4. **Logging discipline**:
   - never log secrets
   - include correlation IDs (`intentId`, `runId`, `receiptId`)
5. **Dependency scanning** in CI (audit step).
6. Add/maintain:
   - `SECURITY.md`
   - threat model doc in `000-docs/`

---

## 6) Documentation Requirements

### 6.1 Required docs (minimum)
- `000-docs/000-DR-STND-document-filing-system.md` (canonical, v4.3)
- `000-docs/001-DR-INDX-repo-docs-index.md`
- Threat model doc (when runtime is added)
- AAR after every phase/PR merge

### 6.2 Doc writing rules
- Keep docs concise and actionable.
- Use exact filenames per docs-filing.
- No subdirectories under `000-docs/`.

---

## 7) Phase Execution Rules

Work must be delivered in phases. For each phase:
1. Create/confirm Beads epic + children.
2. Create a feature branch.
3. Implement changes.
4. Run:
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`
5. Open PR with template filled.
6. Merge when CI is green.
7. After merge, write the AAR in `000-docs/`.

---

## 8) "If Lost" Recovery Checklist
If uncertain about state:
- Re-run State Recovery (2.1)
- Read latest AAR in `000-docs/` (highest NNN)
- Check open PRs/issues (if GitHub available)
- Check Beads for `in_progress` or `blocked` tasks
- Do not proceed until the next concrete task is identified

---

## 9) Project-Local Subagents

This repo includes 8 specialized subagents in `.claude/agents/`. Use them for their designated purposes:

| Agent | When to Use |
|-------|-------------|
| `repo-librarian` | Finding files, understanding project structure |
| `security-auditor` | Security reviews, secret leak checks |
| `protocol-researcher` | Cross-repo alignment, schema verification |
| `ts-architect` | Module design, structural decisions |
| `test-engineer` | Test writing, fixture setup, debugging tests |
| `ci-engineer` | CI/CD workflow updates, debugging CI failures |
| `github-operator` | Branch/PR management, Git operations |
| `determinism-guardian` | Hash logic audit, reproducibility checks |

### Usage Guidelines

1. **Automatic Invocation**: Agents trigger on matching task patterns
2. **Cross-Repo Work**: Use `protocol-researcher` for any irsb-protocol/watchtower correlation
3. **Determinism Critical**: Use `determinism-guardian` for any hashing or ID computation
4. **Before Merge**: Use `security-auditor` for security review

### Phase Mapping

See `000-docs/014-PR-GUID-phases-subagent-usage.md` for which agents to use in each implementation phase.

### Full Roster

See `000-docs/013-DR-GUID-claude-subagents-roster.md` for detailed agent profiles.

---
