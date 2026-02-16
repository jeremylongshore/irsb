# IRSB Protocol - LLM Briefing Document

**Version**: 1.1.0 (Released 2026-01-30)
**Purpose**: Context document for external LLM brainstorming sessions
**Last Updated**: 2026-01-30

---

## Executive Summary

**IRSB (Intent Receipts & Solver Bonds)** is the accountability layer for intent-based transactions. It answers the question that ERC-7683 (the cross-chain intent standard) doesn't: **"What happens when the solver fails?"**

**Core Value Proposition**: Intents need receipts. Solvers need skin in the game.

**Current State**: Production-ready on Sepolia testnet, 355 tests passing, preparing for mainnet.

---

## The Problem We Solve

### The Intent Execution Gap

1. **User submits intent** (via ERC-7683): "Swap 1 ETH for best USDC across chains"
2. **Solver executes** the trade
3. **??? No accountability** - If solver fails, takes too long, or delivers wrong output, there's no enforcement mechanism

### Today's Reality
- Users lose money when solvers fail
- Solvers face no consequences for poor performance
- Trust is informal and non-portable
- Each protocol builds its own reputation silo

### IRSB's Solution
- **Receipts**: Cryptographic proof of intent execution
- **Bonds**: Staked collateral (0.1 ETH minimum) slashable for violations
- **Disputes**: Automated enforcement with deterministic + optimistic resolution
- **Reputation**: Portable IntentScore that follows solvers across protocols

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ SolverRegistry  │◄───►│ IntentReceiptHub │◄───►│  DisputeModule   │
├─────────────────┤     ├──────────────────┤     ├──────────────────┤
│ • Registration  │     │ • Post receipts  │     │ • Evidence       │
│ • Bond staking  │     │ • V2 dual-attest │     │ • Escalation     │
│ • Slashing      │     │ • Disputes       │     │ • Arbitration    │
│ • Reputation    │     │ • Finalization   │     │                  │
└────────┬────────┘     └────────┬─────────┘     └──────────────────┘
         │                       │
         │              ┌────────▼─────────┐
         │              │   EscrowVault    │
         │              ├──────────────────┤
         │              │ • ETH + ERC20    │
         │              │ • Release/Refund │
         │              └──────────────────┘
         │
┌────────▼────────────────┐     ┌──────────────────────────┐
│ OptimisticDisputeModule │     │    ERC8004Adapter        │
├─────────────────────────┤     ├──────────────────────────┤
│ • Counter-bond window   │     │ • Validation signals     │
│ • Timeout resolution    │     │ • IntentScore publishing │
│ • Escalation to arb     │     │ • Cross-chain proofs     │
└─────────────────────────┘     └──────────────────────────┘
```

---

## What We've Built (v1.1.0)

### Core Contracts (Solidity ^0.8.25)

| Contract | Purpose | Status |
|----------|---------|--------|
| **SolverRegistry** | Solver lifecycle, bonding, slashing, reputation | ✅ Deployed |
| **IntentReceiptHub** | Receipt posting, disputes, finalization | ✅ Deployed |
| **DisputeModule** | Arbitration for complex disputes | ✅ Deployed |
| **EscrowVault** | ETH + ERC20 escrow tied to receipts | ✅ Complete |
| **ReceiptV2Extension** | Dual attestation with EIP-712 | ✅ Complete |
| **OptimisticDisputeModule** | Counter-bond mechanism | ✅ Complete |
| **ERC8004Adapter** | Credibility publishing (v2.0) | ✅ Complete |

### Deployments

**Sepolia Testnet (Production)**:
- SolverRegistry: `0xB6ab964832808E49635fF82D1996D6a888ecB745`
- IntentReceiptHub: `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c`
- DisputeModule: `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D`

### Test Coverage
- **355 tests passing** (all suites)
- **4 economic invariant tests** (256 runs, 128k calls each)
- **6 ERC-8004 integration tests**
- Fuzz testing with 10k runs in CI

---

## Key Protocol Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| MINIMUM_BOND | 0.1 ETH | Solver activation threshold |
| CHALLENGE_WINDOW | 1 hour | Time to dispute a receipt |
| WITHDRAWAL_COOLDOWN | 7 days | Bond withdrawal delay |
| MAX_JAILS | 3 | Strikes before permanent ban |
| COUNTER_BOND_WINDOW | 24 hours | Time for solver to counter dispute |
| ARBITRATION_TIMEOUT | 7 days | Max time for arbitrator ruling |

### Slashing Distribution

| Recipient | Standard Dispute | Arbitration |
|-----------|------------------|-------------|
| User | 80% | 70% |
| Challenger | 15% | - |
| Treasury | 5% | 20% |
| Arbitrator | - | 10% |

---

## Receipt Types

### V1 Receipt (Single Attestation)
```solidity
struct IntentReceipt {
    bytes32 intentHash;       // Hash of original intent
    bytes32 constraintsHash;  // Execution constraints
    bytes32 routeHash;        // Execution path taken
    bytes32 outcomeHash;      // Result hash
    bytes32 evidenceHash;     // Supporting evidence
    uint64 createdAt;         // Timestamp
    uint64 expiry;            // Validity window
    bytes32 solverId;         // Registered solver
    bytes solverSig;          // Solver signature
}
```

### V2 Receipt (Dual Attestation + Privacy)
```solidity
struct IntentReceiptV2 {
    // ... V1 fields ...
    bytes32 metadataCommitment;  // Hash only (privacy)
    string ciphertextPointer;     // IPFS CID for encrypted data
    PrivacyLevel privacyLevel;    // PUBLIC | SEMI_PUBLIC | PRIVATE
    bytes32 escrowId;             // Optional escrow link
    bytes clientSig;              // Client attestation (EIP-712)
}
```

---

## IntentScore Algorithm (ERC-8004)

Portable reputation score published on-chain:

```
IntentScore = (0.40 × SuccessRate) +
              (0.25 × DisputeScore) +
              (0.20 × StakeWeight) +
              (0.15 × Longevity)
```

**Components**:
- **SuccessRate** (40%): Finalized receipts / Total receipts
- **DisputeScore** (25%): 100 - (disputes_lost / total_disputes × 100)
- **StakeWeight** (20%): min(bond / 10 ETH, 1.0) × 100
- **Longevity** (15%): min(days_active / 365, 1.0) × 100

**Cross-chain**: Merkle proofs enable reputation portability across chains.

---

## Dispute Resolution Flow

```
Receipt Posted
    │
    ├── [1 hour CHALLENGE_WINDOW]
    │
    ├── No dispute → finalize() → Reputation updated, ERC-8004 signal
    │
    └── Dispute opened (with challenger bond)
        │
        ├── Deterministic (timeout, wrong amount)
        │   └── resolveDeterministic() → Auto-slash
        │
        └── Optimistic (V2)
            │
            ├── [24h COUNTER_BOND_WINDOW]
            │
            ├── No counter-bond → Challenger wins by timeout
            │
            └── Counter-bond posted → Escalate to Arbitrator
                │
                └── [7d max] → Arbitrator rules → Slash or release
```

---

## Standards Integration

| Standard | Role in IRSB |
|----------|--------------|
| **ERC-7683** | Intent format we hold accountable |
| **ERC-8004** | Credibility signals we publish |
| **EIP-712** | Typed signatures for V2 receipts |
| **x402** | HTTP payment protocol integration |

---

## Competitive Landscape

### Direct Competitors
None building a cross-protocol intent accountability standard.

### Adjacent Solutions

| Project | Approach | IRSB Advantage |
|---------|----------|----------------|
| UniswapX | Internal reputation | Not portable |
| Across Protocol | Internal scoring | Protocol-specific |
| CoW Protocol | Solver competition | No slashing |
| **Wach_AI** | Verification agents | No economic enforcement |

### IRSB's Moat
1. **Economic enforcement** - Bonds make reputation meaningful
2. **Protocol-agnostic** - Works across any intent system
3. **Standard-track** - Aiming for ERC/EIP status
4. **Already shipping** - v1.1.0 live, competitors demo'ing

---

## Roadmap

### Completed (v1.1.0)
- [x] Core contracts (SolverRegistry, IntentReceiptHub, DisputeModule)
- [x] V2 receipts with dual attestation
- [x] Escrow vault (ETH + ERC20)
- [x] Optimistic dispute module
- [x] ERC-8004 adapter v2.0
- [x] Security audit (IRSB-SEC-001 through 015)
- [x] Sepolia deployment
- [x] 355 tests + invariant testing

### Next (Epic C & D)
- [ ] x402 HTTP payment integration (reference implementation)
- [ ] SDK npm publish with provenance
- [ ] Verification CLI tool (`irsb verify`)
- [ ] Integration guides

### Future (Q2-Q4 2026)
- [ ] Mainnet deployment
- [ ] First protocol integration (Across or CoW)
- [ ] ERC/EIP proposal submission
- [ ] Multi-chain (Arbitrum, Base, Polygon)
- [ ] EigenLayer AVS for validation

---

## Repository Structure

```
irsb-protocol/
├── src/                    # Solidity contracts
│   ├── SolverRegistry.sol
│   ├── IntentReceiptHub.sol
│   ├── DisputeModule.sol
│   ├── EscrowVault.sol
│   ├── extensions/         # V2 receipt, optimistic disputes
│   ├── modules/            # Dispute modules
│   ├── adapters/           # ERC-8004 adapter
│   └── libraries/          # Types, Events
├── test/                   # Foundry tests (355)
│   └── fuzz/               # Invariant tests
├── sdk/                    # TypeScript SDK
├── packages/x402-irsb/     # x402 integration
├── dashboard/              # Next.js + Firebase
├── subgraph/               # The Graph indexer
└── 000-docs/               # Documentation (this file)
```

---

## Key Documentation

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Development guide for AI assistants |
| `000-docs/006-MR-FEAS-*` | 25k word feasibility report |
| `000-docs/008-AA-AUDT-*` | DevOps playbook |
| `000-docs/009-AA-SEC-*` | Security audit report |
| `000-docs/016-AT-INTG-*` | x402 integration guide |
| `CHANGELOG.md` | Version history |

---

## Strategic Context

**Goal**: Become the global standard accountability layer for intent-based systems.

**Path to Standard**:
1. ✅ Build production-ready implementation
2. ⏳ Get first major integration (Across, CoW, UniswapX)
3. ⏳ Submit as ERC/EIP proposal
4. ⏳ Multi-chain deployment

**Key Insight**: Don't own a chain. Own the standard. Standards win by being everywhere.

---

## Questions for Brainstorming

1. **Go-to-market**: How do we get the first 5 solvers to stake bonds?
2. **Integration**: Which protocol should we target first?
3. **Differentiation**: How do we communicate "accountability > verification"?
4. **Tokenomics**: Should IRSB have a token? (Currently: no, ETH bonds only)
5. **Governance**: Who controls protocol parameters long-term?
6. **Cross-chain**: Hyperlane vs LayerZero for reputation bridging?

---

## Contact & Links

- **GitHub**: github.com/intent-solutions-io/irsb-protocol
- **Dashboard**: (Sepolia testnet)
- **Release**: v1.1.0 (2026-01-30)

---

*This document is designed to be copy-pasted into an LLM context window for strategic brainstorming.*
