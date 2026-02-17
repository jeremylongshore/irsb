# CLAUDE.md

> **Part of the IRSB monorepo** (`jeremylongshore/irsb`). See root CLAUDE.md for workspace overview.

This file provides guidance to Claude Code (claude.ai/code) when working with this sub-project.

## Project Overview

**IRSB-Watchtower** (`@irsb/watchtower-*` packages) - Universal watchtower service for the IRSB (Intent Receipts & Solver Bonds) protocol.

Off-chain monitoring and enforcement: watches IRSB contract events, detects violations via a deterministic rule engine, produces structured Findings, and optionally auto-acts (open disputes, submit evidence).

**Version**: v0.5.0 | **Status**: Epic 1 complete (Receipt Stale auto-challenge rule). Multi-chain support shipped in v0.3.0. EIP-7702 delegation monitoring in v0.4.0. Deprecated code cleanup in v0.5.0.

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (required before first run)
pnpm test             # Run all tests (vitest)
pnpm typecheck        # TypeScript strict checking
pnpm lint             # ESLint
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier

# Development
pnpm dev:api          # Fastify API on :3000
pnpm dev:worker       # Background scanner

# Single package operations
pnpm --filter @irsb-watchtower/core test
pnpm --filter @irsb-watchtower/core test:watch
pnpm --filter @irsb-watchtower/core vitest run receiptStaleRule  # Single test file
pnpm --filter @irsb-watchtower/api build
```

## Architecture

Three-layer design with 9 packages and 3 apps:

1. **Core** (`packages/core`) - Portable rule engine, Finding schema, ActionExecutor. Zero cloud deps.
2. **Runner** (`apps/api`, `apps/worker`, `apps/cli`) - API server, background scanner, CLI utilities
3. **Signer** (`packages/signers`) - Pluggable: LocalPrivateKey (dev/test) | Cloud KMS (production)

Supporting packages: `config` (Zod schemas), `chain` (viem abstraction), `irsb-adapter` (contract client), `resilience` (retry + circuit breaker), `webhook` (HMAC-signed delivery), `evidence-store` (JSONL persistence), `metrics` (Prometheus)

### Data Flow

```
Worker scan cycle (per chain):
  IrsbClient → getBlockNumber() → createChainContext()
                                         ↓
  RuleEngine.execute(context) → ReceiptStaleRule.evaluate()
                                         ↓
                                    Finding[]
                                         ↓
  ActionExecutor.executeActions() → [DRY_RUN or real tx]
                                         ↓
                          ActionLedger (idempotency) + EvidenceStore (JSONL)
                                         ↓
                          WebhookSink (optional) + Metrics (Prometheus)
```

### Package Dependency Graph

```
apps/worker → core, config, chain, irsb-adapter, evidence-store, metrics, webhook
apps/api    → core, config, chain, irsb-adapter, metrics, signers
apps/cli    → config, chain, irsb-adapter
irsb-adapter → config, resilience
```

All internal deps use `workspace:*` protocol. Build order follows this graph.

### Multi-Chain Support (v0.3.0)

Two modes:
- **Single-chain** (default): `RPC_URL` + `CHAIN_ID` + individual contract address env vars
- **Multi-chain**: `CHAINS_CONFIG` env var (JSON array of `ChainEntry` objects)

`getEffectiveChains()` in `packages/config` normalizes both modes into `ChainEntry[]`. The worker spawns concurrent watchers per enabled chain. Per-chain state files:
- `block-cursor-{chainId}.json` - last processed block
- `action-ledger-{chainId}.json` - idempotency tracking

### TypeScript Configuration

`tsconfig.base.json`: ES2022 target, ESNext modules, `moduleResolution: "bundler"`, strict mode with all strict flags enabled. Each package extends it. Tests use `vitest.workspace.ts` which discovers `*/vitest.config.ts` across packages and apps.

## Key Interfaces

**Rule** (`packages/core/src/rules/rule.ts`):
- `metadata: RuleMetadata` - id, name, severity, category, version
- `evaluate(context: ChainContext): Promise<Finding[]>` - must be idempotent and deterministic

**ChainContext** (`packages/core/src/rules/rule.ts`) - injected by runner:
- `getReceiptsInChallengeWindow()`, `getActiveDisputes()`, `getSolverInfo(solverId)`, `getEvents(fromBlock, toBlock)`

**Finding** (`packages/core/src/finding.ts`):
- Severity: INFO, LOW, MEDIUM, HIGH, CRITICAL
- Category: RECEIPT, BOND, DISPUTE, SOLVER, ESCROW, SYSTEM
- ActionType: NONE, OPEN_DISPUTE, SUBMIT_EVIDENCE, ESCALATE, NOTIFY, MANUAL_REVIEW
- Helpers: `createFinding()`, `serializeFinding()`, `deserializeFinding()`

**RuleEngine** (`packages/core/src/engine.ts`):
- Stateless orchestrator. Evaluates rules sequentially with per-rule timeout (30s default).
- Error isolation: one rule failing doesn't stop others.
- Returns `EngineResult`: findings[], ruleResults[], totalDurationMs, rulesExecuted, rulesFailed

**ActionExecutor** (`packages/core/src/actions/actionExecutor.ts`):
- Processes findings with recommended actions. Respects `DRY_RUN` mode and `maxActionsPerBatch`.
- Uses `ActionLedger` for idempotency (won't re-act on same receipt).

**IrsbClient** (`packages/irsb-adapter/src/irsbClient.ts`):
- Read: `getReceipt()`, `getSolver()`, `getDispute()`, `getChallengeWindow()`, `getMinimumBond()`
- Write: `openDispute()`, `submitEvidence()` (require wallet client)
- Events: `getReceiptPostedEvents()`, `getReceiptFinalizedEvents()`, `getDisputeOpenedEvents()`

**ChainProvider** (`packages/chain/src/provider.ts`):
- Interface wrapping viem PublicClient: `getBlockNumber()`, `getBlock()`, `getEvents()`, `readContract()`
- `RpcProvider` is the concrete implementation

## Writing New Rules

1. Create rule class implementing `Rule` interface in `packages/core/src/rules/`
2. Define `metadata: RuleMetadata` (id, name, severity, category, version)
3. Implement `evaluate(context: ChainContext): Promise<Finding[]>`
4. Export from `packages/core/src/rules/index.ts`
5. Register in `RuleRegistry` (`packages/core/src/rules/index.ts`)
6. Wire into worker (`apps/worker/src/worker.ts`)
7. Add tests in `packages/core/test/`

Reference implementation: `ReceiptStaleRule` in `packages/core/src/rules/receiptStaleRule.ts`

## CLI Utilities (`apps/cli`)

Commander-based CLI with three commands:
- `health [--verbose]` - Check RPC connectivity, chain ID, IRSB contract accessibility
- `check-config` - Validate all env vars against Zod schemas
- `simulate` - Run single scan cycle locally

## IRSB Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## Configuration

All via environment variables (see `.env.example` for full list). Key groups:

| Group | Variables | Notes |
|-------|-----------|-------|
| Chain | `RPC_URL`, `CHAIN_ID` | Single-chain mode |
| Multi-chain | `CHAINS_CONFIG` | JSON array of ChainEntry objects |
| Contracts | `SOLVER_REGISTRY_ADDRESS`, `INTENT_RECEIPT_HUB_ADDRESS`, `DISPUTE_MODULE_ADDRESS` | Single-chain mode |
| Actions | `ENABLE_ACTIONS`, `DRY_RUN`, `SIGNER_TYPE`, `PRIVATE_KEY` | Actions off by default |
| Worker | `SCAN_INTERVAL_MS`, `LOOKBACK_BLOCKS`, `WORKER_POST_TO_API` | Scanner tuning |
| Resilience | `RPC_MAX_RETRIES`, `CIRCUIT_BREAKER_*` | Retry + circuit breaker |
| Webhook | `WEBHOOK_ENABLED`, `WEBHOOK_URL`, `WEBHOOK_SECRET` | HMAC-signed delivery |
| Evidence | `EVIDENCE_ENABLED`, `EVIDENCE_DATA_DIR` | JSONL persistence |
| State | `STATE_DIR` | Block cursors + action ledgers |

## Non-Negotiables

- Actions disabled by default (`ENABLE_ACTIONS=false`)
- Start with `DRY_RUN=true` for any new deployment
- Never log private keys
- Rules must be deterministic and idempotent
- All config validated by Zod schemas
- Docs stay in flat `000-docs/` (no subdirectories)

## Known Stubs / TODOs

- `createChainContext()` in worker uses mock data — real IRSB client integration pending
- Cloud KMS signer (`packages/signers`) - scaffolded in delegation upgrade, integration pending
- CLI `check-config` and `simulate` commands are stubs
- Delegation payment monitoring rule (`delegationPaymentRule.ts`) — detects anomalous delegated payments via EIP-7702 WalletDelegate events
