# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **AI Context**: For ecosystem-wide reference (contracts, deployments, concepts, glossary), see [AI-CONTEXT.md](./AI-CONTEXT.md). Each sub-project also has its own CLAUDE.md with project-specific rules.

## Workspace Overview

**IRSB (Intent Receipts & Solver Bonds)** is Ethereum's accountability layer for intent-based transactions. This is a multi-project workspace containing five repos in a unified structure.

| Project | Tech Stack | Purpose | Status |
|---------|------------|---------|--------|
| `protocol/` | Solidity 0.8.25, Foundry | On-chain contracts (receipts, bonds, disputes, escrow) | Deployed (Sepolia) |
| `solver/` | TypeScript, Express | Execute intents, produce evidence, submit receipts | v0.3.0 |
| `watchtower/` | TypeScript, Fastify (pnpm monorepo) | Monitor receipts, detect violations, file disputes | v0.5.0 |
| `agents/` | Python 3.11+, FastAPI, LangChain, ChromaDB | AI agents (builder + money) with RAG + Z3 verification | v0.2.0 |
| `agent-passkey/` | TypeScript, Fastify | Policy-gated signing via Lit Protocol PKP | Deprecated (Cloud Run, legacy) |

## Build, Test, Lint Commands

### Protocol (Foundry/Solidity)

```bash
cd protocol/
forge build                           # Compile (via_ir, optimizer 200 runs)
forge test                            # All 552 tests
forge test -vvv                       # Verbose output
forge test --match-test testSlashing  # Single test by name
forge test --match-path "test/EscrowVault.t.sol"  # Single test file
forge test --gas-report               # Gas analysis
forge fmt                             # Format Solidity

# CI fuzz profile (10k runs instead of default 256)
FOUNDRY_PROFILE=ci forge test --match-path "test/fuzz/*.sol"

# SDK and sub-packages
cd sdk && pnpm build && pnpm test
cd packages/x402-irsb && pnpm build && pnpm test
cd dashboard && pnpm dev              # Next.js dashboard (in protocol/)
```

### Solver (single TypeScript project)

```bash
cd solver/
pnpm install
pnpm build              # tsc
pnpm test               # vitest run
pnpm test:watch         # vitest (watch mode)
pnpm test:coverage      # vitest run --coverage
pnpm lint               # eslint src/
pnpm lint:fix
pnpm format             # prettier
pnpm typecheck          # tsc --noEmit
pnpm dev                # tsx watch src/index.ts
pnpm dev:server         # tsx watch src/main.ts (HTTP server)
pnpm cli                # tsx src/cli.ts (Commander CLI)
```

Tests are **co-located** with source: `src/**/*.test.ts`

### Watchtower (pnpm workspace monorepo)

```bash
cd watchtower/
pnpm install
pnpm build              # Build all packages + apps
pnpm test               # Run all tests across workspace
pnpm typecheck          # TypeScript check all packages
pnpm lint               # ESLint all packages
pnpm format             # Prettier all packages

# Development
pnpm dev:api            # Fastify API on :3000
pnpm dev:worker         # Background scanner

# Single package operations (use --filter)
pnpm --filter @irsb-watchtower/core test
pnpm --filter @irsb-watchtower/core test:watch
pnpm --filter @irsb-watchtower/core vitest run receiptStaleRule   # Single test file
pnpm --filter @irsb-watchtower/api build

# Canonical hash drift check
pnpm canonical:check
pnpm canonical:refresh
```

**Workspace layout** (`pnpm-workspace.yaml` defines `packages/*` and `apps/*`):
- **Packages**: `core`, `config`, `chain`, `irsb-adapter`, `signers`, `resilience`, `webhook`, `evidence-store`, `metrics`
- **Apps**: `api` (Fastify), `worker` (scanner), `cli` (health/config/simulate)
- Internal deps use `workspace:*` protocol
- Tests per package in `test/` directories, discovered via `vitest.workspace.ts`

### Agent Passkey (single TypeScript project)

```bash
cd agent-passkey/
pnpm install
pnpm build              # tsc
pnpm test               # vitest run
pnpm test:watch
pnpm test:coverage      # Coverage with thresholds (25% statements, 50% branches)
pnpm lint               # eslint src
pnpm lint:fix
pnpm format             # prettier
pnpm typecheck          # tsc --noEmit
pnpm dev                # tsx watch src/server/gateway.ts
```

Tests in separate `test/` directory with subdirs: `unit/`, `integration/`, `security/`

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  ERC-8004 (Registry Layer) - Agent identity & reputation       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│  IRSB Protocol (protocol/) - On-chain accountability           │
│  - Intent receipts (V1 single-sig, V2 dual attestation)        │
│  - Solver bonds, disputes, escrow                              │
│  - WalletDelegate (EIP-7702) + caveat enforcers                │
│  - X402Facilitator (direct + delegated payment settlement)     │
└──────────┬────────────────────────────┬─────────────────────────┘
           │                            │
┌──────────┴──────────┐    ┌────────────┴────────────┐
│  Solver (solver/)   │    │  Watchtower (watchtower/)│
│  - Execute intents  │    │  - Monitor receipts      │
│  - Submit receipts  │    │  - File disputes         │
│  - KMS signing      │    │  - Delegation monitoring │
└──────────┬──────────┘    └────────────┬────────────┘
           │                            │
           └── Cloud KMS (signing) ──────┘
```

## Cross-Project Dependencies and Update Order

```text
protocol → (ABI/types + delegation contracts) → solver, watchtower
Cloud KMS → (signing) → solver, watchtower
```

When contract interfaces change:
1. Update `protocol/` first (including delegation contracts and enforcers)
2. Regenerate types for TypeScript projects
3. Update `solver/` and `watchtower/` (both use Cloud KMS directly now)

## Signing Architecture

**Cloud KMS + EIP-7702 Delegation.** Solver and watchtower sign directly via Google Cloud KMS. On-chain policy enforcement uses EIP-7702 WalletDelegate with caveat enforcers (spend limits, time windows, allowed targets/methods, replay prevention). See `protocol/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md` for the full ADR.

**Note:** The `agent-passkey/` service (Lit Protocol PKP) is still deployed on Cloud Run but fully deprecated. Both solver and watchtower have been migrated to Cloud KMS — no code references to agent-passkey remain in their signing paths.

## Common Patterns Across TypeScript Projects

| Pattern | Implementation |
|---------|----------------|
| Config validation | Zod schemas, fail-fast on startup |
| Logging | pino with structured JSON, correlation IDs (`intentId`, `runId`, `receiptId`) |
| Testing | vitest for all TypeScript projects |
| Determinism | Canonical JSON serialization for hashing (sorted keys, no whitespace) |
| CI/CD | GitHub Actions + Workload Identity Federation (keyless GCP auth) |
| TypeScript | ES2022 target, strict mode, all strict flags enabled |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `perf:`) |

## Live Deployments

| Service | URL/Address | Network |
|---------|-------------|---------|
| Agent Passkey | `https://irsb-agent-passkey-308207955734.us-central1.run.app` | GCP Cloud Run |
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` | Sepolia |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` | Sepolia |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` | Sepolia |
| ERC-8004 Agent ID | `967` (on `0x8004A818BFB912233c491871b3d84c89A494BD9e`) | Sepolia |

**GCP Project:** `irsb-protocol` (308207955734)

## Documentation

Each project has a flat `000-docs/` directory (no subdirectories). Files follow naming convention: `NNN-CC-ABCD-short-description.md` (CC = category code like DR/AT/OD).

## GitHub Repositories

All repos under `intent-solutions-io`:
- [irsb-protocol](https://github.com/intent-solutions-io/irsb-protocol)
- [irsb-solver](https://github.com/intent-solutions-io/irsb-solver)
- [irsb-watchtower](https://github.com/intent-solutions-io/irsb-watchtower)
- [irsb-agent-passkey](https://github.com/intent-solutions-io/irsb-agent-passkey)
