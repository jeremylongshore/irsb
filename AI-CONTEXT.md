# IRSB AI Context Reference

> **Single source of truth for AI assistants working on the IRSB ecosystem.**
> Last updated: 2026-02-15

## Quick Facts

| Attribute | Value |
|-----------|-------|
| **Organization** | `intent-solutions-io` |
| **GCP Project** | `irsb-protocol` (308207955734) |
| **Network** | Sepolia testnet (chain ID: 11155111) |
| **Repos** | 5 (protocol, solver, watchtower, agents, agent-passkey) |
| **License** | MIT |
| **Primary positioning** | On-chain guardrails for AI agents |

## AI Agents as Primary Use Case

IRSB's core infrastructure — EIP-7702 delegation, caveat enforcers, cryptographic receipts, watchtower monitoring, and on-chain disputes — maps directly to the problem of giving AI agents wallet access without adequate guardrails.

### The Market Gap

Every major AI agent framework gives agents wallet access. None provide on-chain policy enforcement, verifiable execution receipts, or automated recourse.

| Capability | AgentKit | ElizaOS | Olas | Virtuals | Brian AI | Safe | **IRSB** |
|------------|----------|---------|------|----------|----------|------|----------|
| Wallet access | Coinbase API | Lit/KMS | Safe multisig | TBA/bonding | Aggregator | Modules | **EIP-7702** |
| Spend limits | None | None | Consensus | None | Aggregator | Module-based | **On-chain enforcers** |
| Execution receipts | None | None | None | None | None | None | **Cryptographic proof** |
| Automated monitoring | None | None | None | None | None | None | **Watchtower** |
| Dispute resolution | None | None | None | None | None | None | **On-chain arbitration** |

### How IRSB Maps to Agent Guardrails

| IRSB Component | Agent Guardrail Function |
|----------------|------------------------|
| WalletDelegate (EIP-7702) | Agent wallet policy — delegates execution with on-chain constraints |
| SpendLimitEnforcer | Spending caps — daily and per-transaction limits |
| TimeWindowEnforcer | Session bounds — agents sign only during defined windows |
| AllowedTargetsEnforcer | Contract whitelist — agents interact only with approved contracts |
| AllowedMethodsEnforcer | Function whitelist — agents call only approved methods |
| NonceEnforcer | Replay prevention — each action gets a unique nonce |
| IntentReceiptHub | Execution receipts — cryptographic proof of every action |
| Watchtower | Automated monitoring — detects violations and files disputes |
| DisputeModule | Recourse — on-chain arbitration when agents act outside mandate |
| ERC-8004 + IntentScore | Portable reputation — agent track records across protocols |

### Target Frameworks (Integration Priority)

1. **ElizaOS** — Plugin architecture, largest AI agent community, currently uses Lit/KMS with ProofGate
2. **Safe** — Module system, existing smart account infrastructure, natural fit for WalletDelegate
3. **Coinbase AgentKit** — TypeScript SDK, Coinbase wallet API, broad developer reach
4. **Olas** — Autonomous agent services, Safe multisig, consensus-based execution
5. **Brian AI** — Natural language to transactions, aggregator model
6. **Virtuals** — Token-bonded agents, TBA architecture

## Live Deployments

| Service | URL | Status |
|---------|-----|--------|
| **Protocol Contracts** | See addresses below | Sepolia |
| **Agent Passkey** (legacy) | https://irsb-agent-passkey-308207955734.us-central1.run.app | Deprecated (still running) |

## Contract Addresses (Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| **SolverRegistry** | `0xB6ab964832808E49635fF82D1996D6a888ecB745` | Solver lifecycle, bonding, slashing |
| **IntentReceiptHub** | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` | Receipt posting, disputes, finalization |
| **DisputeModule** | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` | Arbitration for complex disputes |
| **WalletDelegate** | `0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB` | EIP-7702 delegation with caveat enforcement |
| **X402Facilitator** | `0x0CDf48B293cdee132918cFb3a976aA6da59f4E6F` | Payment settlement (direct + delegated) |
| **SpendLimitEnforcer** | `0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D` | Daily + per-tx spend limits |
| **TimeWindowEnforcer** | `0x51DF412e99E9066B1B3Cab81a1756239659207B4` | Session time bounds |
| **AllowedTargetsEnforcer** | `0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b` | Approved contract allowlist |
| **AllowedMethodsEnforcer** | `0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf` | Approved function selector allowlist |
| **NonceEnforcer** | `0x02962c406A7a29adF26F40657b111B90c236DbF1` | Replay prevention |

### Operational Accounts (Sepolia)

| Account | Address | Purpose |
|---------|---------|---------|
| Deployer/Operator | `0x83A5F432f02B1503765bB61a9B358942d87c9dc0` | Signs receipts, pays gas |
| Solver ID | `0xdf816d7b86303c3452e53d84aaa02c01b0de6ae23c1e518bd2642870f9f7603b` | Registered solver identifier |
| ERC-8004 Agent ID | `967` (on IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`) | Agent identity NFT |
| Safe (Owner) | `0xBcA0c8d0B5ce874a9E3D84d49f3614bb79189959` | Owns contracts (2/3 multisig) |

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  AI Agents / DeFi Solvers                                        │
│  - Any framework: AgentKit, ElizaOS, Olas, custom                │
│  - Delegate wallet to WalletDelegate for policy enforcement      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ delegate wallet
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  IRSB Protocol (On-Chain Guardrails) - protocol/                 │
│  - WalletDelegate (EIP-7702 delegation + ERC-7710)               │
│  - Caveat enforcers (spend limits, time, targets, methods, nonce)│
│  - Intent receipts (V1 single-sig, V2 dual attestation)          │
│  - Solver bonds (0.1 ETH minimum)                                │
│  - Dispute resolution (1hr challenge window)                     │
│  - Escrow (ETH + ERC20)                                          │
│  - X402Facilitator (direct + delegated payment settlement)       │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
┌──────────┴──────────┐      ┌────────────┴────────────┐
│  Solver (solver/)   │      │  Watchtower (watchtower/)│
│  - Execute intents  │      │  - Monitor receipts      │
│  - Submit receipts  │      │  - File disputes         │
│  - Produce evidence │      │  - Submit evidence       │
└──────────┬──────────┘      └────────────┬────────────┘
           │                              │
           └── Cloud KMS (signing) ───────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ERC-8004 (Registry Layer) - Agent identity & reputation         │
│  - Agent identity registry (24,549+ agents on mainnet)           │
│  - Reputation scores from execution history                      │
│  - Validation provider discovery                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Delegation Standards (EIP-7702 Ecosystem)

| Standard | Role | Status |
|----------|------|--------|
| **EIP-7702** | EOA delegates execution to WalletDelegate contract | Adopted (Pectra, May 2025) |
| **ERC-7710** | `redeemDelegations()` interface for smart contract delegation | Implemented |
| **ERC-7715** | `wallet_requestExecutionPermissions` for dapp UX | SDK support |
| **x402** | HTTP payment protocol | Already integrated |

### Delegation Contracts (Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| **WalletDelegate** | `0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB` | EIP-7702 delegation with caveat enforcement |
| **X402Facilitator** | `0x0CDf48B293cdee132918cFb3a976aA6da59f4E6F` | Payment settlement (direct + delegated + batch) |
| **SpendLimitEnforcer** | `0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D` | Daily + per-tx spend limits |
| **TimeWindowEnforcer** | `0x51DF412e99E9066B1B3Cab81a1756239659207B4` | Session time bounds |
| **AllowedTargetsEnforcer** | `0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b` | Approved contract allowlist |
| **AllowedMethodsEnforcer** | `0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf` | Approved function selector allowlist |
| **NonceEnforcer** | `0x02962c406A7a29adF26F40657b111B90c236DbF1` | Replay prevention |

### Delegation vs Lit Protocol

| Aspect | Lit Protocol (deprecated) | EIP-7702 Delegation (current) |
|--------|--------------------------|-------------------------------|
| **Signing** | 2/3 TEE threshold via agent-passkey | Cloud KMS direct signing |
| **Policy** | Off-chain checks (8 rules) | On-chain caveat enforcers |
| **Latency** | 1-2s per signature | <100ms (KMS) |
| **Buyer flow** | Not supported | 7702 authorize → set limits → auto-pay |
| **Verification** | Trust agent-passkey service | On-chain, transparent |
| **SDK** | v8 alpha, type hacks needed | Standard viem/ethers |

### Buyer Delegation Flow

```text
1. Developer calls wallet_requestExecutionPermissions (ERC-7715)
2. Wallet shows: "Allow IRSB to spend up to $100/day USDC?"
3. Developer signs EIP-7702 authorization → designates WalletDelegate as code
4. Developer signs EIP-712 delegation → sets caveats (spend limit, time, targets)
5. WalletDelegate.setupDelegation() stores delegation on-chain
6. API calls trigger x402 payment → X402Facilitator.settleDelegated() → auto-pays
7. Each settlement validates ALL caveat enforcers before execution
```

## Key Concepts Glossary

| Term | Definition |
|------|------------|
| **Intent Receipt** | On-chain proof of intent execution. Contains intentHash, constraintsHash, evidenceHash, solver signature. |
| **Solver Bond** | Staked ETH collateral (min 0.1 ETH) slashable for violations. Creates economic accountability. |
| **Challenge Window** | 1-hour period after receipt posting where disputes can be opened. |
| **Typed Actions** | `SUBMIT_RECEIPT`, `OPEN_DISPUTE`, `SUBMIT_EVIDENCE` - the only signing operations allowed. |
| **Lit Protocol PKP** | DEPRECATED. Programmable Key Pairs via TEE nodes. Replaced by Cloud KMS + EIP-7702 delegation. |
| **EIP-7702 Delegation** | EOA delegates execution to WalletDelegate contract with on-chain caveat enforcers. |
| **Caveat Enforcer** | On-chain contract validating a specific constraint (spend limit, time window, etc.) on delegated execution. |
| **ERC-8004** | Ethereum standard for trustless agent identity with identity, reputation, and validation registries. |
| **Evidence Bundle** | Structured proof artifact with manifest, hashes, timestamps. Used in disputes. |
| **Finding** | Watchtower detection result with severity, category, and recommended action. |
| **WalletDelegate** | Contract implementing ERC-7710 that manages delegations and enforces caveats. |
| **X402Facilitator** | Contract for settling x402 HTTP payments, supporting direct and delegated flows. |

## Cross-Repo Dependencies

```text
protocol → (ABI/types + delegation contracts) → solver, watchtower
Cloud KMS → (signing) → solver, watchtower
```

**Update order when making changes:**
1. Update `protocol/` first (including delegation contracts and enforcers)
2. Regenerate types for TypeScript projects
3. Update `solver/` and `watchtower/` (both use Cloud KMS directly now)

## Common Patterns

| Pattern | Implementation |
|---------|----------------|
| **Config validation** | Zod schemas with fail-fast on startup |
| **Logging** | pino with structured JSON, correlation IDs (`intentId`, `runId`, `receiptId`) |
| **Signing** | Cloud KMS (solver: KMS-only, watchtower: local/gcp-kms). Buyer payments via EIP-7702 delegation. |
| **Determinism** | Canonical JSON serialization for hashing (sorted keys, no whitespace) |
| **CI/CD** | GitHub Actions + Workload Identity Federation (keyless GCP auth) |
| **Error handling** | Custom error classes, structured error codes |
| **Testing** | vitest for TS, Foundry for Solidity |

## Test Commands per Repo

| Repo | Test Command | Coverage |
|------|--------------|----------|
| `protocol/` | `forge test` | 552 tests |
| `solver/` | `pnpm test` | vitest |
| `watchtower/` | `pnpm test` | vitest |
| `agents/` | `pytest tests/ -v` | pytest |
| `agent-passkey/` | `pnpm test` | vitest |

## Environment Variables

### Common (All TypeScript Repos)

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | pino log level | `info` |
| `PORT` | HTTP server port | `8080` |

### Agent Passkey (DEPRECATED)

> Agent-passkey is fully deprecated. Solver and watchtower no longer reference it.
> The service is still running on Cloud Run but unused by any active signing path.

### Solver/Watchtower Specific

| Variable | Description | Default |
|----------|-------------|---------|
| `SIGNING_MODE` | Signing backend (solver: `kms` only; watchtower: `local` or `gcp-kms`) | `kms` / `local` |
| `KMS_KEY_NAME` | Cloud KMS key resource name | Required (KMS) |
| `GCP_PROJECT_ID` | GCP project for KMS | Required (KMS) |
| `SOLVER_AUTH_TOKEN` / `WATCHTOWER_AUTH_TOKEN` | Service auth token | Required |
| `RPC_URL` | Ethereum RPC endpoint | Required |
| `CHAIN_ID` | Target chain ID | `11155111` |

## Protocol Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MINIMUM_BOND` | 0.1 ETH | Solver activation threshold |
| `CHALLENGE_WINDOW` | 1 hour | Time to dispute receipt |
| `WITHDRAWAL_COOLDOWN` | 7 days | Bond withdrawal delay |
| `MAX_JAILS` | 3 | Strikes before permanent ban |
| `COUNTER_BOND_WINDOW` | 24 hours | Time for solver to counter |
| `ARBITRATION_TIMEOUT` | 7 days | Max time for arbitration |

## Slashing Distribution

| Recipient | Standard | Arbitration |
|-----------|----------|-------------|
| User | 80% | 70% |
| Challenger | 15% | - |
| Treasury | 5% | 20% |
| Arbitrator | - | 10% |

## GitHub Repositories

| Repo | URL | Tech Stack |
|------|-----|------------|
| `irsb-protocol` | https://github.com/intent-solutions-io/irsb-protocol | Solidity, Foundry |
| `irsb-solver` | https://github.com/intent-solutions-io/irsb-solver | TypeScript, Node.js |
| `irsb-watchtower` | https://github.com/intent-solutions-io/irsb-watchtower | TypeScript, Node.js |
| `irsb-agents` | https://github.com/intent-solutions-io/irsb-agents | Python, FastAPI, LangChain |
| `irsb-agent-passkey` | https://github.com/intent-solutions-io/irsb-agent-passkey | TypeScript, Fastify |

## Local Workspace Structure

```text
~/000-projects/irsb/
├── protocol/           # On-chain Solidity contracts (v1.4.0)
├── solver/             # Reference off-chain solver (v0.3.0)
├── watchtower/         # Monitoring and dispute service (v0.5.0)
├── agents/             # AI agents with RAG + Z3 verification (v0.2.0)
├── agent-passkey/      # Policy-gated signing gateway (DEPRECATED)
├── CLAUDE.md           # Workspace-level guidance
└── AI-CONTEXT.md       # This file
```

## ERC-8004: Trustless Agents Standard

### What is ERC-8004?

Ethereum standard for **trustless agent discovery and verification**. Enables agents to be discovered, chosen, and interacted with across organizational boundaries without pre-existing trust.

**Status:** Draft standard, live on 12+ chains
**Explorer:** https://www.8004scan.io/
**Spec:** https://eips.ethereum.org/EIPS/eip-8004
**Contracts:** https://github.com/erc-8004/erc-8004-contracts

### The Three Registries

| Registry | Purpose | Implementation |
|----------|---------|----------------|
| **Identity Registry** | ERC-721 NFTs for agent identities. Portable, browsable, transferable. `tokenURI` → registration file. | `IdentityRegistry.sol` |
| **Reputation Registry** | Collect/query feedback signals from clients about agent performance. On-chain core + IPFS details. | `ReputationRegistry.sol` |
| **Validation Registry** | Independent verification. Validators publish responses (0-100 scale) with evidence. | `ValidationRegistry.sol` |

### ERC-8004 Contract Addresses

**Mainnet (Ethereum, Base, Polygon, Arbitrum, Celo, Gnosis, Scroll, Taiko, Monad, BSC):**

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

**Sepolia (Ethereum, Base, Polygon, Arbitrum, Scroll, BSC testnets):**

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Agent Registration File Schema

When an agent registers, `agentURI` (the NFT's `tokenURI`) must resolve to:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "My IRSB Solver",
  "description": "Intent execution with accountability",
  "image": "https://example.com/solver-icon.png",
  "services": [
    { "name": "A2A", "endpoint": "https://solver.example.com/a2a" },
    { "name": "MCP", "endpoint": "https://solver.example.com/mcp" }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [
    { "agentId": 42, "agentRegistry": "eip155:11155111:0x8004A818..." }
  ],
  "supportedTrust": ["reputation", "crypto-economic"]
}
```

### Key ERC-8004 Interfaces

```solidity
// Identity Registry
function register(string agentURI, MetadataEntry[] metadata) returns (uint256 agentId);
function setAgentURI(uint256 agentId, string newURI);
function getAgentWallet(uint256 agentId) returns (address);

// Reputation Registry
function giveFeedback(uint256 agentId, int128 value, uint8 decimals,
    string tag1, string tag2, string endpoint, string feedbackURI, bytes32 hash);
function getSummary(uint256 agentId, address[] clients, string tag1, string tag2);

// Validation Registry
function validationRequest(address validator, uint256 agentId, string uri, bytes32 hash);
function validationResponse(bytes32 hash, uint8 response, string uri, bytes32 evidenceHash, string tag);
```

### IRSB + ERC-8004 Integration Strategy

**IRSB as a Signal Publisher (see ADR-001 for full signal table):**

| IRSB Event | ERC-8004 Signal | Value |
|------------|-----------------|-------|
| Receipt finalized (no dispute) | `validationResponse` | 100 |
| Dispute opened against solver | `giveFeedback` | -10 |
| Dispute won by solver | `validationResponse` | 90 |
| Dispute lost, minor slash | `validationResponse` | 30 |
| Dispute lost, full slash | `validationResponse` | 0 |
| Solver jailed | `giveFeedback` | -50 |

**Reputation-Weighted Bonds:**
1. Query solver's ERC-8004 reputation before accepting bond
2. High reputation → lower bond requirements (0.5× to 2.0× modifier)
3. No history → standard bond (0.1 ETH)

**Agent Identity Resolution:**
1. Solver provides ERC-8004 `agentId` when registering
2. IRSB verifies solver controls the `agentWallet`
3. Link IRSB `solverId` to ERC-8004 `agentId`

### IRSB IntentScore vs ERC-8004 (Critical Distinction)

**They are COMPLEMENTARY, not competing:**

| Aspect | ERC-8004 | IRSB IntentScore |
|--------|----------|------------------|
| **Purpose** | Store raw signals from many providers | Compute weighted aggregate score |
| **Score type** | Individual signals (0-100 per event) | Composite score (0-10000 bps) |
| **Aggregation** | None (intentionally left to off-chain) | On-chain weighted formula |
| **Data model** | Many signals from many providers | Single score from IRSB events |

**IRSB publishes signals TO ERC-8004, not the other way around.**

### IntentScore Algorithm

```text
Score = (40% × SuccessRate) + (25% × DisputeWinRate) + (20% × StakeFactor) + (15% × Longevity) - SlashPenalty
```

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Success Rate | 40% | successfulTasks / totalTasks |
| Dispute Win Rate | 25% | (wins×100 + partials×50) / totalDisputes |
| Stake Factor | 20% | min(currentBond, 10 ETH) / 10 ETH |
| Longevity | 15% | min(age, 365 days) / 365 days, halved if inactive 90+ days |
| Slash Penalty | -5% each | slashCount × 500 bps (max 30%) |

**Minimum tasks for reliable score:** 10 (new solvers get neutral 5000/50%)

### Current IRSB Integration Status

| Component | Location | Status |
|-----------|----------|--------|
| Agent registration | `protocol/script/RegisterERC8004Agent.s.sol` | **Registered (Agent ID: 967)** |
| On-chain adapter | `protocol/src/adapters/ERC8004Adapter.sol` | Deployed (350 lines) |
| Off-chain adapter | `agent-passkey/src/erc8004/adapter.ts` | Implemented (400+ lines) |
| CredibilityRegistry | `protocol/src/CredibilityRegistry.sol` | Active (450+ lines) |
| Env variable | `ERC8004_ENABLED` | `false` (disabled, ready to enable) |

**Off-chain adapter features:**
- Resolve agent identity from ERC-8004
- Verify agent ownership
- Query cross-protocol reputation
- Publish validation signals (RECEIPT_FINALIZED, DISPUTE_WON/LOST, SLASHED, JAILED)
- Calculate reputation-weighted bond modifiers

**Roadmap:**
- **H1 Hardening:** Enable signal publishing in production
- **H2 Hardening:** Reputation-weighted bonds, cross-chain identity

## Three-Level Identity Assurance

| Level | Name | What It Proves | Status |
|-------|------|----------------|--------|
| **L1** | Transport Identity | Verified caller (JWT/workload identity) | MVP |
| **L2** | Action Authorization | Only allowed IRSB state transitions | MVP |
| **L3** | Instance Attestation | Agent runs in approved environment (TEE) | Hardening |

## Typed Actions (No Arbitrary Signing)

The IRSB signing layer (Cloud KMS or legacy agent-passkey) only processes these action types:

```typescript
type IrsbAction =
  | { action: "SUBMIT_RECEIPT"; intentId: string; receiptHash: string; evidenceHash: string }
  | { action: "OPEN_DISPUTE"; receiptId: string; evidenceHash: string; reasonCode: DisputeReason }
  | { action: "SUBMIT_EVIDENCE"; disputeId: string; evidenceHash: string };
```

**No "sign this arbitrary digest" API.** Ever.

## Audit Artifacts

Every signing decision produces deterministic artifacts:

```typescript
interface AuditArtifact {
  signingRequestHash: string;      // keccak256(canonical(request))
  policyDecisionHash: string;      // keccak256(canonical(checks + result))
  signatureHash?: string;          // keccak256(signature)
  decision: "ALLOW" | "DENY";
  auditId: string;                 // UUID for log correlation
  timestamp: number;               // Unix ms
}
```

These are included in solver/watchtower evidence bundles and referenced in dispute submissions.

## Lit Protocol Notes (DEPRECATED - See EIP-7702 Delegation)

> **Lit Protocol is being replaced by Cloud KMS + EIP-7702 delegation.** See `protocol/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md` for the migration ADR.

**Current Network:** `naga-dev` (development)
**SDK:** `@lit-protocol/*@8.0.0-alpha.0` (npm `naga` dist-tag). Pin exact version — `^8.0.0` won't match prerelease.
**Migration:** Completed 2026-02-08. Datil (V0) SDK v7 → Naga (V1) SDK v8. Datil networks shut down Feb 25, 2026.

**Naga PKP (minted 2026-02-08):**

| Attribute | Value |
|-----------|-------|
| Token ID | `0xa8b507b20e325ef3b80fb0287943764fb9e44e2803668b4ea08d62260a471542` |
| ETH Address | `0x7bcD6e1b4822491B6b4f79884e77c3AD780DfCcb` |
| Owner | `0x494B46CC87C6e3bC1586DeFA4B31838cBE9f035A` (auth wallet) |
| GCP Secret | `lit-pkp-public-key` (version 2) |

**How it works:**
- PKP keys live in 2/3 TEE nodes (no single point of compromise)
- Session signatures for scoped, time-limited access
- Threshold signatures: 2/3 nodes must agree to produce valid signature
- SDK v8 types `litNetwork` as `'naga-dev' | 'custom'` only — cast needed for broader values

## Quick Health Check

```bash
# Check Sepolia contracts (requires RPC)
cast call 0xB6ab964832808E49635fF82D1996D6a888ecB745 "minimumBond()" --rpc-url $SEPOLIA_RPC

# Check agent-passkey is alive (legacy service)
curl -s https://irsb-agent-passkey-308207955734.us-central1.run.app/health | jq
```

## Documentation Filing

All repos use flat `000-docs/` with naming convention:
- `NNN-CC-ABCD-short-description.md`
- CC = Category code (DR=Decision Record, AT=Architecture, OD=Operations, etc.)
- ABCD = Subcategory

See `/docs-filing` skill for full specification.

---

**For project-specific guidance, see the CLAUDE.md in each repo.**
