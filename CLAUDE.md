# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Each sub-project also has its own CLAUDE.md with project-specific rules (`protocol/`, `services/solver/`, `services/watchtower/`, `services/agents/`).

## Workspace Overview

**IRSB (Intent Receipts & Solver Bonds)** is Ethereum's accountability layer for intent-based transactions. This is a **monorepo** containing all IRSB services and shared packages.

| Directory | Tech Stack | Purpose | Status |
|-----------|------------|---------|--------|
| `protocol/` | Solidity 0.8.25, Foundry | On-chain contracts (receipts, bonds, disputes, escrow) | v1.4.0 (Sepolia) |
| `services/solver/` | TypeScript, Express | Execute intents, produce evidence, submit receipts | v0.3.0 |
| `services/watchtower/` | TypeScript, Fastify (pnpm monorepo) | Monitor receipts, detect violations, file disputes | v0.5.0 |
| `services/agents/` | Python 3.11+, FastAPI, LangChain, ChromaDB | AI agents (builder + money) with RAG + Z3 verification | v0.2.0 |
| `services/indexer/` | TypeScript, Envio HyperIndex | Index all 8 contracts / 41 events (GraphQL API) | v0.1.0 |
| `services/gateway/` | TypeScript (planned) | Intentions Gateway — Web2/Web3 policy enforcement | Phase 1 (not yet created) |
| `packages/kms-signer/` | TypeScript | Shared GCP Cloud KMS signing | v0.1.0 |
| `packages/types/` | TypeScript | Shared types, contract addresses, constants | v0.1.0 |
| `archive/agent-passkey/` | TypeScript, Fastify | Policy-gated signing via Lit Protocol PKP | Deprecated |

## Monorepo Basics

**Requirements:** Node 22+ (`.nvmrc`), pnpm 9+ (`packageManager: pnpm@9.15.0`). All TypeScript is ESM (`"type": "module"`).

**Root-level commands** (run from repo root — delegates to all workspace members):

```bash
pnpm install              # Install all workspace dependencies
pnpm build                # Build all TypeScript packages (pnpm -r build)
pnpm test                 # Test all TypeScript packages (pnpm -r test)
pnpm typecheck            # TypeScript check all packages
pnpm lint                 # ESLint all packages
pnpm format               # Prettier write all TS/JSON/MD files
pnpm format:check         # Prettier check (CI)
pnpm clean                # Clean all dist/build artifacts (pnpm -r clean)

# Per-project shortcuts from root
pnpm test:protocol        # cd protocol && forge test
pnpm test:solver          # pnpm --filter @irsb/solver test
pnpm test:watchtower      # pnpm --filter @irsb/watchtower... test
pnpm test:agents          # cd services/agents && pytest
pnpm test:indexer         # pnpm --filter @irsb/indexer test
pnpm dev:indexer          # pnpm --filter @irsb/indexer dev
```

**pnpm workspace members** (`pnpm-workspace.yaml`):
`packages/*`, `services/solver`, `services/watchtower`, `services/watchtower/packages/*`, `services/watchtower/apps/*`, `services/indexer`, `protocol/sdk`, `protocol/packages/*`

## Code Style

**TypeScript** — `tsconfig.base.json` is unusually strict. Watch for these:
- `exactOptionalPropertyTypes: true` — `foo?: string` does NOT accept `undefined` as a value, only omission
- `noUncheckedIndexedAccess: true` — `arr[0]` returns `T | undefined`, not `T`
- `noUnusedLocals` + `noUnusedParameters` — prefix unused params with `_`

**ESLint** — `eslint.config.js` uses `strictTypeChecked` + `stylisticTypeChecked`:
- `consistent-type-imports: error` — use `import type { Foo }` for type-only imports
- `consistent-type-exports: error` — use `export type { Foo }` for type-only exports
- `no-console: warn` — only `console.warn` and `console.error` allowed (use pino for logging)

**Prettier** — single quotes, semicolons, 100 char print width, es5 trailing commas, LF line endings.

## Build, Test, Lint Commands

### Protocol (Foundry/Solidity)

```bash
# IMPORTANT: Always set PATH before forge/cast commands
export PATH="/home/jeremy/.foundry/bin:$PATH"

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
cd services/solver/
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
cd services/watchtower/
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
pnpm --filter @irsb/watchtower-core test
pnpm --filter @irsb/watchtower-core test:watch
pnpm --filter @irsb/watchtower-core vitest run receiptStaleRule   # Single test file
pnpm --filter @irsb/watchtower-api build

# Canonical hash drift check
pnpm canonical:check
pnpm canonical:refresh
```

**Workspace layout** (`pnpm-workspace.yaml` defines `packages/*` and `apps/*`):
- **Packages**: `chain`, `config`, `core`, `evidence-store`, `irsb-adapter`, `metrics`, `resilience`, `signers`, `watchtower-api`, `watchtower-cli`, `watchtower-core`, `webhook`
- **Apps**: `api` (Fastify), `worker` (scanner), `cli` (health/config/simulate)
- Internal deps use `workspace:*` protocol
- Tests per package in `test/` directories, discovered via `vitest.workspace.ts`

### Indexer (Envio HyperIndex)

**One-time setup:**

```bash
# 1. Install dependencies (from monorepo root)
pnpm install

# 2. Create .env from example (get free token at https://envio.dev/app/api-tokens)
cp services/indexer/.env.example services/indexer/.env
# Edit .env: set ENVIO_API_TOKEN and uncomment port overrides if 5433/8080 are taken

# 3. Generate types + symlink .env into generated/ (MUST run before tests)
pnpm --dir services/indexer codegen
```

**Commands:**

```bash
cd services/indexer/

# Tests (vitest + Envio MockDb — no Docker needed)
pnpm test               # vitest run (requires codegen + ENVIO_API_TOKEN)

# Local dev (Docker required — starts containers, indexer, cleans up on Ctrl+C)
pnpm dev                # PostgreSQL + Hasura + indexer, Ctrl+C tears everything down
                        # GraphQL: http://localhost:8082/v1/graphql (secret: testing)
                        # Console: http://localhost:8082/console

# Manual container control (if needed)
pnpm docker:up          # Start containers only
pnpm docker:down        # Tear down containers + volumes

# Re-run codegen after config.yaml or schema.graphql changes
pnpm codegen            # Also re-symlinks .env → generated/.env
```

**Port config:** System PostgreSQL runs on 5433, Caddy on 8080. The `.env` sets
`ENVIO_PG_PORT=5434` and `HASURA_EXTERNAL_PORT=8082` to avoid conflicts.
The `codegen` script symlinks `.env` into `generated/` so docker-compose reads them.

**What it indexes:** All 8 IRSB contracts on Sepolia (41 events): SolverRegistry, IntentReceiptHub, DisputeModule, WalletDelegate, X402Facilitator, SpendLimitEnforcer, NonceEnforcer, IdentityRegistry.

### Agent Passkey (DEPRECATED — archive only)

Located in `archive/agent-passkey/`. Standard pnpm commands (`build`, `test`, `lint`, `typecheck`). Tests in `test/{unit,integration,security}/`. **Do not invest time here** — replaced by Cloud KMS + EIP-7702 delegation.

### Agents (Python)

```bash
cd services/agents/
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

pytest tests/ -v              # All tests
pytest tests/ -v -k "test_verifier"  # Single test by name
ruff check .                  # Lint
mypy shared/ --ignore-missing-imports  # Type check
uvicorn api.server:app --reload       # Run API (requires Ollama)
python -m shared.corpus.ingestor      # Index IRSB corpus
docker compose up                     # Ollama + API (local dev)
```

Tests in `tests/` directory. Uses pytest with asyncio_mode=auto.

## Shell Gotchas

- **`cd` triggers zoxide** (`__zoxide_z`) which fails in non-interactive shells. Use `builtin cd` or `--root` flag for forge commands.
- **Always export Foundry PATH**: `export PATH="/home/jeremy/.foundry/bin:$PATH"` before `forge`/`cast`.
- **Source `.env`** with `source .env 2>/dev/null` or export vars explicitly.
- **`forge script`** requires contract name: `forge script script/Foo.s.sol:ContractName`

## Environment Setup

Each service has a `.env.example` — copy to `.env` and fill in values:

| Service | Key Requirements |
|---------|-----------------|
| `protocol/` | `SEPOLIA_RPC_URL`, deployer private key (for scripts only) |
| `services/solver/` | `RPC_URL`, `PRIVATE_KEY`, contract addresses |
| `services/watchtower/` | `RPC_URL`, `CHAIN_ID`, contract addresses. **Start with `DRY_RUN=true`** |
| `services/agents/` | `OLLAMA_BASE_URL` (local dev), model config |
| `services/indexer/` | **`ENVIO_API_TOKEN` required** (free at https://envio.dev/app/api-tokens) |

See each project's `.env.example` for the full variable list.

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

**Cloud KMS + EIP-7702 Delegation.** Solver signs via `@irsb/kms-signer` (Google Cloud KMS). Watchtower's KMS signer is scaffolded in `packages/signers` but **integration is pending** — it currently uses `LocalPrivateKey` signer only. On-chain policy enforcement uses EIP-7702 WalletDelegate with caveat enforcers (spend limits, time windows, allowed targets/methods, replay prevention). See `protocol/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md` for the full ADR.

**Note:** The `agent-passkey/` service (Lit Protocol PKP) is still deployed on Cloud Run but fully deprecated. Solver has been migrated to Cloud KMS; watchtower KMS migration is in progress.

## Common Patterns Across TypeScript Projects

| Pattern | Implementation |
|---------|----------------|
| Config validation | Zod schemas, fail-fast on startup |
| Logging | pino with structured JSON, correlation IDs (`intentId`, `runId`, `receiptId`) |
| Testing | vitest for all TypeScript projects |
| Determinism | Canonical JSON serialization for hashing (sorted keys, no whitespace) |
| CI/CD | GitHub Actions with path-filtered workflows (WIF planned, not yet configured) |
| TypeScript | ES2022 target, strict mode, all strict flags enabled |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `perf:`) |

## CI/CD Workflows

All workflows run on push/PR to `main` with path filters (only trigger when relevant files change):

| Workflow | File | Trigger Paths | What It Checks |
|----------|------|---------------|----------------|
| CI — Protocol | `ci-protocol.yml` | `protocol/**` | Foundry build + 552 tests + `forge fmt --check` |
| CI — TypeScript | `ci-typescript.yml` | `services/solver/**`, `services/watchtower/**`, `packages/**`, `protocol/sdk/**` | pnpm build, vitest, typecheck, lint, format:check |
| CI — Agents | `ci-agents.yml` | `services/agents/**` | Python 3.11 pytest + ruff |
| CI — Indexer | `ci-indexer.yml` | `services/indexer/**` | Envio codegen + vitest (needs `ENVIO_API_TOKEN` secret) |
| CodeQL | `codeql.yml` | All paths (+ weekly schedule) | Security scanning for JS/TS and Python |

**Required secret:** `ENVIO_API_TOKEN` (for ci-indexer). No GCP secrets needed — no WIF configured yet.

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

## Intentions Gateway (Planned)

Unifying Web2 MCP governance + Web3 on-chain enforcement. See `protocol/000-docs/040-AT-ARCH-intentions-gateway-architecture.md` for the full architecture doc.

- **Policy engine**: Cedar (42-60x faster than OPA, sub-ms evaluation)
- **New services**: `services/gateway/`, `policy-admin/`, `audit-vault/` — all calling INTO existing IRSB contracts
- **Data store**: Firestore (MVP), Spanner upgrade path at >50K/min
- **Runtime**: Cloud Run everywhere

## CHANGELOG & License

- **CHANGELOG**: See `CHANGELOG.md` — tracks monorepo migration history and version releases.
- **License**: BUSL-1.1 (Business Source License). Converts to MIT on 2029-02-17. See `LICENSE`.

## GitHub Repository

**Monorepo**: [jeremylongshore/irsb](https://github.com/jeremylongshore/irsb)

All code lives in this single repository. The old individual repos under `intent-solutions-io` are archived with redirect notices.
