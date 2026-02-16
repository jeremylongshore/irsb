# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## IRSB Watchtower — Project Context

Off-chain monitoring and enforcement for the IRSB (Intent Receipts & Solver Bonds) protocol.
Watches ERC-8004 IdentityRegistry events, ingests solver evidence manifests, detects violations
via a deterministic rule engine, and produces structured risk reports.

### Quickstart

```bash
pnpm install
pnpm build
pnpm test          # all tests must pass before any PR
pnpm typecheck     # zero errors required
```

### Key Commands

| Command | What it does |
|---------|-------------|
| `pnpm test` | Run all vitest suites across packages + apps |
| `pnpm build` | Build all packages (tsc) |
| `pnpm typecheck` | TypeScript strict checking |
| `pnpm lint` | ESLint |
| `pnpm --filter @irsb-watchtower/watchtower-core test` | Run core tests only |

### Watchtower CLI (`wt`)

```bash
wt init-db                                   # Create/migrate SQLite DB
wt ingest-receipt --agentId <id> --receipt <path>  # Behavior lens (W2)
wt verify-receipt --receipt <path>                  # Read-only verification
wt id:sync --rpc-url <url>                          # Identity lens (W3) — poll chain
wt id:fetch                                         # Fetch cards + score agents
wt id:show <agentId>                                # Show identity details
wt score-agent --agentId <id>                        # Score an agent
wt risk-report <agentId>                             # Show latest risk report
wt list-alerts                                       # List alerts
```

### Documentation

All docs live in the flat `000-docs/` directory. Sequential numbering, no subdirectories.
Format: `NNN-CATEGORY-slug.md`.

### Constellation

| Repo | Role |
|------|------|
| `irsb-protocol` | Smart contracts (SolverRegistry, IntentReceiptHub, DisputeModule) |
| `irsb-solver` | Reference solver implementation |
| `irsb-watchtower` | Off-chain monitoring (this repo) |

### Merge Gate

All PRs require:
1. `pnpm build` — clean
2. `pnpm test` — all pass
3. `pnpm typecheck` — zero errors
4. Human approval from Jeremy before merge

