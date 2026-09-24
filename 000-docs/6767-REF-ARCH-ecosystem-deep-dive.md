# IRSB Ecosystem Deep Dive — Architecture Reference

> Evergreen reference for the full IRSB + Moat + Scout ecosystem.
> Last updated: 2026-03-04

---

## 1. What IRSB Is

**IRSB = Intent Receipts & Solver Bonds** — Ethereum's accountability layer for intent-based transactions.

Every major AI agent framework (AgentKit, ElizaOS, Olas, Virtuals, Brian AI, Safe) gives agents wallet access but none provide on-chain policy enforcement, execution receipts, or automated monitoring. IRSB fills that gap with three layers:

1. **Policy Enforcement** — on-chain, cannot be bypassed (caveat enforcers)
2. **Execution Receipts** — cryptographic proof of what happened
3. **Automated Monitoring** — watchtower catches violations, files disputes

**Status:** v1.4.0 on Sepolia testnet, 552 Foundry tests, ready for mainnet security audit.
**GCP Project:** `irsb-protocol` (308207955734)
**License:** BUSL-1.1 (converts to MIT on 2029-02-17)

---

## 2. Repository Map

### IRSB Monorepo (`/home/jeremy/000-projects/irsb-monorepo/`)

```
packages/
  kms-signer/           @irsb/kms-signer    v0.1.0  — GCP Cloud KMS signing
  types/                @irsb/types         v0.1.0  — Shared types, addresses, constants

protocol/                                   v1.4.0  — Solidity contracts
  src/                  37 contracts, 6,976 lines
  test/                 552 tests (unit, integration, fuzz, invariant)
  sdk/                  @irsb/sdk           — TypeScript SDK
  packages/x402-irsb/   @irsb/x402-integration — x402 HTTP payment integration
  dashboard/            Next.js solver leaderboard (live: irsb-protocol.web.app)
  000-docs/             50+ architecture docs

services/
  solver/               @irsb/solver        v0.3.0  — TypeScript, Express
  watchtower/           (pnpm workspace)    v0.5.0  — TypeScript, Fastify, 12 packages
  agents/               Python 3.11+, FastAPI, LangChain, ChromaDB  v0.2.0
  indexer/              @irsb/indexer       v0.1.0  — Envio HyperIndex, TypeScript
```

**Tech Stack:** Solidity 0.8.25 + Foundry | TypeScript ES2022 strict ESM | Python 3.11+ | pnpm 9+ | Node 22+

### Moat (`/home/jeremy/000-projects/moat/`)

```
services/
  control-plane/  :8001  — Capability registry, connections, tenants, vault
  gateway/        :8002  — Execute pipeline: policy → idempotency → adapter → receipt
  trust-plane/    :8003  — Reliability scoring, synthetic checks, outcome events
  mcp-server/     :8004  — Agent-facing tool surface (REST MVP + stdio transport)

packages/
  core/           moat-core  — Models, policy engine, auth, redaction, DB ORM
  cli/            — CLI with Scout-workflow commands
  sdk/            — SDK for integration
```

**Tech:** Python 3.11+, FastAPI, async SQLAlchemy (SQLite local / Postgres Docker)
**License:** Elastic License 2.0

### Perception (`/home/jeremy/000-projects/perception/`) — Separate concern, AI news intelligence

---

## 3. Solidity Contracts

### Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |
| WalletDelegate | `0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB` |
| X402Facilitator | `0x0CDf48B293cdee132918cFb3a976aA6da59f4E6F` |
| SpendLimitEnforcer | `0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D` |
| TimeWindowEnforcer | `0x51DF412e99E9066B1B3Cab81a1756239659207B4` |
| AllowedTargetsEnforcer | `0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b` |
| AllowedMethodsEnforcer | `0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf` |
| NonceEnforcer | `0x02962c406A7a29adF26F40657b111B90c236DbF1` |
| ERC8004IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

**IRSB ERC-8004 Agent ID:** `967`

### File Structure

```
protocol/src/
├── SolverRegistry.sol            # Solver lifecycle, bonding, slashing
├── IntentReceiptHub.sol          # Receipt posting, disputes, finalization
├── X402Facilitator.sol           # x402 payment settlement
├── DisputeModule.sol             # Complex dispute arbitration
├── EscrowVault.sol               # ETH + ERC20 escrow
├── delegation/
│   ├── WalletDelegate.sol        # EIP-7702 delegation + ERC-7710 redemption
│   └── DelegationLib.sol         # EIP-712 hashing helpers
├── enforcers/
│   ├── SpendLimitEnforcer.sol    # Daily + per-tx spend limits
│   ├── TimeWindowEnforcer.sol    # Session time bounds
│   ├── AllowedTargetsEnforcer.sol # Contract whitelist
│   ├── AllowedMethodsEnforcer.sol # Function selector whitelist
│   └── NonceEnforcer.sol         # Replay prevention
├── extensions/
│   └── ReceiptV2Extension.sol    # Dual attestation, EIP-712, privacy
├── modules/
│   └── OptimisticDisputeModule.sol # Counter-bond disputes
├── adapters/
│   └── ERC8004Adapter.sol        # On-chain reputation portability
├── interfaces/
└── libraries/
    ├── Types.sol / TypesV2.sol   # Structs, enums, constants
    └── Events.sol                # Shared event definitions
```

### SolverRegistry

Manages solver lifecycle, bonding, and reputation.

- **MINIMUM_BOND:** 0.1 ETH
- **WITHDRAWAL_COOLDOWN:** 7 days
- **MAX_JAILS:** 3 (permanent ban)
- **DECAY_HALF_LIFE:** 30 days (reputation)
- **bondRatioBps:** 500 (5% volume-proportional)
- **SolverStatus:** Inactive → Active → Jailed → Banned
- **Key functions:** `registerSolver()`, `depositBond()`, `requestWithdrawal()` → 7d cooldown → `executeWithdrawal()`, `getReputation()` (IntentScore with exponential decay)

### IntentReceiptHub

Receipt posting, challenge windows, finalization.

- **DEFAULT_CHALLENGE_WINDOW:** 1 hour
- **MAX_BATCH_SIZE:** 50
- **challengerBondMin:** 10% of MINIMUM_BOND

**Receipt Lifecycle:** `postReceipt()` → 1hr challenge window → `finalize()` OR `openDispute()` → DisputeModule

**V1 Receipt:** intentHash, constraintsHash, routeHash, outcomeHash, evidenceHash, signature
**V2 adds:** metadataCommitment, ciphertextPointer, privacyLevel (PUBLIC|SEMI_PUBLIC|PRIVATE), escrowId, clientSig (EIP-712)

**Slashing:** 80% user / 15% challenger / 5% treasury (standard); 70% user / 10% arbitrator / 20% treasury (arbitration)

**ReceiptStatus:** Pending → Disputed → Finalized → Slashed

**DisputeReason:** Timeout (0x01), MinOutViolation (0x02), WrongToken (0x03), WrongChain (0x04), WrongRecipient (0x05), ReceiptMismatch (0x06), InvalidSignature (0x07), Subjective (0x08)

### DisputeModule

Pluggable arbitration for subjective cases.

- **EVIDENCE_WINDOW:** 24 hours
- **ARBITRATION_TIMEOUT:** 7 days
- **DEFAULT_ARBITRATION_FEE:** 0.01 ETH

**Flow:** Dispute opened → 24hr evidence window → counter-bond or challenger auto-wins → escalation to arbitrator → 7-day timeout → `resolveArbitration()`

### WalletDelegate

EIP-7702 EOA delegation with ERC-7710 redemption support.

- `setupDelegation()` — validates EIP-712 sig, stores delegation + caveats
- `executeDelegated()` — calls `beforeHook()` on each caveat → execute → `afterHook()`
- 5 caveat enforcers implement `ICaveatEnforcer` interface

### X402Facilitator

Bridges HTTP 402 payments to IRSB receipts. Two modes: **Micropayment** (immediate) and **Commerce** (escrow until finalization).

### Standards Implemented

| Standard | Role |
|----------|------|
| ERC-7683 | Cross-chain intent format |
| EIP-7702 | EOA delegation |
| ERC-7710 | Delegation redemption |
| ERC-7715 | Permission requests |
| ERC-8004 | Agent identity + reputation |
| x402 | HTTP payment protocol |

---

## 4. Solver Service (v0.3.0)

Reference executor: consumes intents, runs workflows, produces evidence, submits receipts.

**Determinism Pledge:** Identical intents produce identical receipts. All IDs computed from canonical inputs.

### Intent-to-Receipt Flow

1. **Receive Intent** → `intentId = keccak256(canonical(intent))`
2. **Execute Workflow** → policy checks → on-chain action via EIP-7702 → capture outcome
3. **Produce Evidence** → Manifest: {intent, execution output, artifacts, versions} → SHA256 hash
4. **Build Receipt** → V1 or V2 → sign via Cloud KMS (deterministic ECDSA, RFC 6979)
5. **Submit Receipt** → `postReceipt()` on IntentReceiptHub

### Key Files

```
services/solver/src/
├── intent/intentListener.ts   — Polls for intents (webhook/HTTP modes)
├── execution/executor.ts      — Sandbox-hooked workflow execution
├── evidence/{manifest,hasher}.ts — Evidence bundle + deterministic SHA256
├── receipts/{builder,submitter}.ts — Receipt construction + on-chain submission
├── signing/kms-signer.ts      — @irsb/kms-signer integration
├── erc8004/                   — Agent card discovery (/.well-known/agent-card.json)
```

---

## 5. Watchtower Service (v0.5.0)

Off-chain monitoring, event detection, rule evaluation, dispute filing.

### 12 Packages

**Core (9):**

| Package | Role |
|---------|------|
| `@irsb-watchtower/core` | Rule engine, Finding schema, ActionExecutor — zero cloud deps |
| `@irsb-watchtower/config` | Zod schemas, environment loader |
| `@irsb-watchtower/chain` | viem ChainProvider abstraction |
| `@irsb-watchtower/irsb-adapter` | Contract client (reads + writes) |
| `@irsb-watchtower/signers` | Pluggable: LocalPrivateKey vs GCP KMS |
| `@irsb-watchtower/resilience` | Retry + circuit breaker |
| `@irsb-watchtower/webhook` | HMAC-signed delivery |
| `@irsb-watchtower/evidence-store` | JSONL append-only audit trail |
| `@irsb-watchtower/metrics` | Prometheus metrics |

**Apps (3):**

| App | Role |
|-----|------|
| `@irsb-watchtower/api` | Fastify HTTP :3000 |
| `@irsb-watchtower/worker` | Background scanner |
| `@irsb-watchtower/cli` | health, check-config, simulate, ingest-receipt, verify-receipt |

### Rule Engine

```
Rule.evaluate(ChainContext) → Finding[]
Finding = { severity: INFO|LOW|MEDIUM|HIGH|CRITICAL, actionType: NONE|OPEN_DISPUTE|SUBMIT_EVIDENCE|... }
ActionExecutor processes findings (DRY_RUN mode by default)
ActionLedger for idempotency
```

**Epic 1 (Complete):** ReceiptStaleRule — auto-disputes receipts in challenge window >55 minutes.

---

## 6. Agents Service (v0.2.0)

AI agents with RAG + Z3 constraint verification.

| Agent | Status | Role |
|-------|--------|------|
| Builder Agent | Phase 1 (active) | Answers IRSB questions grounded in code |
| Money Agent | Phase 2 (stub) | Research protocols, qualify leads |

**Tech:** FastAPI, LangChain, ChromaDB (RAG), Z3 (constraint verification), Ollama/Anthropic/Vertex LLM providers. PolicyRedactor truncates snippets for cloud LLMs. SQLite RunLedger for audit trail.

---

## 7. Indexer Service (v0.1.0)

Envio HyperIndex — indexes 8 contracts, 41 events, exposes GraphQL API.

**Events indexed:** SolverRegistry (9), IntentReceiptHub (5), DisputeModule (4), WalletDelegate (3), X402Facilitator (6), SpendLimitEnforcer (1), NonceEnforcer (1), IdentityRegistry (3)

**Local dev ports:** PostgreSQL 5434, Hasura 8082 (GraphQL), Caddy 8080

---

## 8. SDK & x402 Integration

### @irsb/sdk

```typescript
const client = new IRSBClient({ chain: 'sepolia', signer });
await client.register({ value: parseEther('0.1') });
await client.postReceipt({ intentHash, constraintsHash, outcomeHash, evidenceHash, deadline, solverSig });
await client.challengeReceipt(intentHash, DisputeReason.MinOutViolation, { value: challengerBond });
await client.finalizeReceipt(intentHash);
```

### @irsb/x402-integration

Transforms HTTP 402 payments into IRSB receipts. Privacy levels: Public (0), SemiPublic (1, Lit Protocol gated), Private (2, encrypted).

Key exports: `createPayload()`, `buildReceiptV2WithConfig()`, `signAsService()/signAsClient()`, `postReceiptV2()`, escrow creation.

---

## 9. Protocol Dashboard

**Live:** https://irsb-protocol.web.app (Next.js, Firebase Hosting)

**IntentScore Formula:**
```
IntentScore = (SuccessRate × 0.4) + (SpeedScore × 0.2) + (VolumeScore × 0.2) + (DisputeScore × 0.2)
```
30-day half-life decay when inactive.

---

## 10. Moat + Scout Integration

### Scout Identity

| Item | Value |
|------|-------|
| Agent ID | `intent-scout-001` |
| Tenant ID | `automaton` |
| ERC-8004 Agent | `#1319` |
| Solver Address | `0x83Be08FFB22b61733eDf15b0ee9Caf5562cd888d` |

### Scout's Job

ONE JOB: discover work → match agents → route through Moat → collect IRSB receipts.

**Does NOT:** Execute DeFi (Lit Agent), execute git ops (Git Agent), enforce policy (Moat Gateway), generate receipts (IRSB Protocol), register capabilities (Control Plane).

### 8 MCP Tools

**4 Core:** `capabilities.list`, `capabilities.search`, `capabilities.execute`, `capabilities.stats`
**4 Bounty:** `bounty.discover` (Algora, Gitcoin, Polar, GitHub), `bounty.triage`, `bounty.execute`, `bounty.status`

### Moat Architecture Patterns

- **Policy engine:** Priority-ordered, first-failure short-circuits
- **Execute pipeline:** capability → validate → policy → idempotency → adapter → receipt → outcome → cache
- **Auth:** JWT-based (dev: `MOAT_AUTH_DISABLED=true`)
- **Adapters:** Stub, Slack, LocalCLI, HttpProxy, OpenAIProxy, Web3, A2AProxy
- **A2A:** AgentCards at `/.well-known/agent.json`, A2A Proxy Adapter for JSON-RPC `tasks/send`

### Known Boundary Violations (TODO)

1. Receipt generation in `irsb_receipt.py` — Scout directly signs receipts; should migrate to IRSB service
2. Hardcoded identity — Agent ID #1319 should be env vars
3. A2A discovery tools exposed as MCP tools; should be internal-only

---

## 11. How the Pieces Connect

```
Work Source (bounty platform)
    ↓ bounty.discover
Scout (broker in Moat)
    ↓ routes to solver via Moat Gateway
Moat Gateway (policy enforcement)
    ↓ policy → adapter → execute
Solver Service (IRSB)
    ↓ execute workflow → produce evidence → build receipt
IntentReceiptHub (on-chain)
    ↓ receipt posted, 1hr challenge window
Watchtower (monitors)
    ↓ evaluates rules, auto-disputes if needed
Indexer (GraphQL)
    ↓ events indexed for dashboard
Dashboard (reputation UI)
```

---

## 12. Planned: Intentions Gateway (Phase 2)

Architecture approved 2026-02-15. Unifies Web2 MCP governance + Web3 on-chain enforcement via Canonical Intent Envelope (EIP-712).

**New services:** intentions-gateway (Cedar policy engine, 42-60x faster than OPA), policy-admin, audit-vault (hash-chained, Merkle-anchored).

**Roadmap:** Volume-proportional bonds March 2026 → Intentions Gateway MVP April-July 2026 → Security audit May-August 2026 → Mainnet July-September 2026

---

## 13. Key Statistics

- 37 Solidity contracts (6,976 lines)
- 552 Foundry tests (80% coverage threshold)
- 11 live contracts on Sepolia
- 8 contracts indexed (41 events)
- 5 caveat enforcers
- 3 dispute types (deterministic, optimistic, arbitration)
- 12 watchtower packages
- 2 AI agents (Builder active, Money stub)
- 8 MCP tools in Moat (4 core + 4 bounty)
- 4 Moat services

---

## 14. CI/CD

| Workflow | Trigger | Steps |
|----------|---------|-------|
| ci-protocol.yml | `protocol/**` | forge build, 552 tests, fuzz (10k), invariants, coverage, fmt, SDK build |
| ci-typescript.yml | services + packages | pnpm build, test, typecheck, lint |
| ci-agents.yml | `services/agents/**` | pytest, ruff, mypy |
| ci-indexer.yml | `services/indexer/**` | envio codegen, vitest |
| codeql.yml | Weekly + push/PR | JS/TS + Python security scanning |

Uses Workload Identity Federation for keyless GCP auth.
