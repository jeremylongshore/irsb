# IRSB Protocol: Investor Report
## Intent Receipts & Solver Bonds — The Accountability Layer for Intent-Based Execution

**Report Date:** January 2026
**Classification:** Confidential — Investor Materials
**Version:** 1.0

---

# Executive Summary

## The Opportunity

**IRSB Protocol fills a critical infrastructure gap in the $6B+ intent-based trading market.**

The blockchain industry has rapidly adopted "intent-based" execution—where users express desired outcomes and professional solvers compete to fulfill them. This model powers 70+ protocols including CoWSwap ($10B/month), 1inch Fusion (59% market share), and UniswapX.

**The Problem:** No standardized accountability layer exists for solvers. When a solver fails, cheats, or extracts value, users have no recourse.

**The Solution:** IRSB provides cryptographic receipts, economic bonds, and deterministic slashing—making solver accountability composable and protocol-agnostic.

## Key Investment Thesis

| Factor | Evidence |
|--------|----------|
| **Market Timing** | 70+ projects on ERC-7683, OIF launched Feb 2025 with 30+ teams |
| **Clear Gap** | ERC-7683 explicitly delegates accountability to fillers—no standard exists |
| **Infrastructure Ready** | EigenLayer slashing live (Apr 2025), $15B TVL available |
| **AI Agent Catalyst** | 7,000+ Vincent wallets, 2M+ Warden users, Gartner predicts 40% enterprise AI agents by end 2026 |
| **Regulatory Tailwind** | EU AI Act demands "cryptographic proof of agent behavior" |
| **First Mover** | No competitor building solver accountability as standalone layer |

---

# Development Status

**MVP contracts are fully implemented and tested.**

| Component | Status | Tests | Lines of Code |
|-----------|--------|-------|---------------|
| SolverRegistry | **Complete** | 36 passing | ~400 |
| IntentReceiptHub | **Complete** | 38 passing | ~350 |
| DisputeModule | **Complete** | 21 passing | ~300 |
| **Total** | **MVP Ready** | **95 tests** | **~1,050** |

### What's Built

- **Solver Registration & Bonding** — Deposit, withdrawal, cooldown periods, jail/ban system
- **Intent Receipt System** — Cryptographic receipts, challenge windows, finalization
- **Dispute Resolution** — Evidence submission, escalation, arbitration, timeout handling
- **Reputation Decay** — Time-weighted scoring with configurable half-life
- **Slashing Engine** — Deterministic slashing with proper distribution (80/15/5)

### Technical Validation

```
forge test --summary
╭----------------------+--------+--------+---------╮
| Test Suite           | Passed | Failed | Skipped |
+==================================================+
| DisputeModuleTest    | 21     | 0      | 0       |
| IntentReceiptHubTest | 38     | 0      | 0       |
| SolverRegistryTest   | 36     | 0      | 0       |
╰----------------------+--------+--------+---------╯
```

### Repository & Demo

- **GitHub:** [Repository link to be added upon public release]
- **Testnet:** [Sepolia deployment addresses to be added]
- **Demo App:** [Interactive demo to be added]

---

# Market Analysis

## Total Addressable Market

### Intent-Based Trading (Primary Market)

| Protocol | Monthly Volume | Market Share | Solver Count |
|----------|---------------|--------------|--------------|
| 1inch Fusion | $28.6B routed | 59.1% | 50+ resolvers |
| CoWSwap | $10B | 14.3% | 30+ solvers |
| UniswapX | $5B+ | ~10% | 20+ fillers |
| Across Protocol | $2B+ | Cross-chain leader | 15+ relayers |
| Socket/MOFA | $20B+ cumulative | 100+ protocols | Transmitters |

**Total Monthly Intent Volume: $50B+**
**IRSB Target: 1% market penetration = $500M monthly secured volume**

### AI Agent Execution (Emerging Market)

| Framework | Status | Users/Wallets | Growth |
|-----------|--------|---------------|--------|
| Lit Vincent | Live (Sept 2025) | 7,000+ wallets | Early access → Public |
| Warden Protocol | Mainnet Q3 2025 | 2M+ beta users | WARD token Q4 2025 |
| Coinbase AgentKit | Live | Developer ecosystem | Q1 2025 major update |
| Privy Delegated | Live | AgentKit provider | Enterprise adoption |

**Gartner Projection:** 40% of enterprise applications will embed AI agents by end of 2026
**Implication:** Every AI agent executing DeFi trades needs solver accountability

### Cross-Chain Bridge Security (Adjacent Market)

- **40% of all Web3 exploits** involve cross-chain bridges
- **5-15% bridge failure rate** during network congestion
- **No standardized compensation mechanism** exists
- **$2.5B+ lost** to bridge exploits (2021-2025)

## Competitive Landscape

### Direct Competitors: None

**IRSB is the only protocol building solver accountability as a standalone, composable layer.**

### Adjacent Solutions

| Protocol | Bonds | Slashing | Reputation | Receipts | Gap |
|----------|-------|----------|------------|----------|-----|
| **CoWSwap** | Protocol-specific | DAO-governed | Informal | None | Protocol-locked, no oracle |
| **1inch** | Staked 1INCH | Ranking penalty | Unicorn Power | None | Soft penalties, not slashing |
| **EigenLayer** | Restaked ETH | Live Apr 2025 | None | None | General infra, no intent focus |
| **Ava Protocol** | Via EigenLayer | Via AVS | None | None | Private txs, no accountability standard |

### Why Competitors Won't Build This

1. **CoWSwap/1inch:** Vertical integration—accountability is competitive advantage, won't open-source
2. **EigenLayer:** Horizontal platform—builds infrastructure, not applications
3. **OIF (Ethereum Foundation):** Standards body—acknowledges gap but won't build products
4. **Across:** Cross-chain focus—accountability isn't their core competency

---

# Why IRSB Fills a Critical Gap

## The Problem No One is Solving

ERC-7683 (Cross-Chain Intents Standard) explicitly **delegates accountability to fillers**:

> "The settlement contract does not enforce any guarantees about the correctness of the filler's execution... Fillers are expected to maintain their own accountability mechanisms."
> — ERC-7683 Specification

**No standard exists for:**
- Verifiable solver commitments (receipts)
- Economic guarantees for execution (bonds)
- Automated dispute resolution (slashing)
- Cross-protocol reputation (IntentScore)

## Why This Gap Persists

| Actor | Why They Won't Build It |
|-------|------------------------|
| **CoWSwap/1inch** | Vertical integration — accountability is their competitive moat |
| **EigenLayer** | Horizontal infrastructure — builds platforms, not applications |
| **OIF** | Standards body — defines specs, doesn't ship products |
| **Across** | Cross-chain focus — accountability isn't core competency |
| **Startups** | Fear competing with intent protocols directly |

## IRSB's Unique Position

**We're the only team building solver accountability as a standalone, protocol-agnostic layer.**

| Differentiator | Why It Matters |
|----------------|----------------|
| **Composable** | Works with ANY ERC-7683 protocol |
| **Neutral** | Not aligned with any intent protocol |
| **Economic** | Real stakes (bonds), real consequences (slashing) |
| **Deterministic** | No arbitration for provable violations |
| **Open** | Standards-based, not proprietary |

## First Mover Advantage

- **12-18 month head start** on building integrations
- **Network effects** — solver reputation becomes more valuable with adoption
- **Data moat** — IntentScore oracle creates switching costs
- **Ecosystem lock-in** — once protocols integrate, switching is costly

---

# Product Overview

## Core Protocol Components

### 1. Intent Receipts

**Cryptographic proof of solver commitment to specific outcomes.**

```solidity
struct IntentReceipt {
    bytes32 intentHash;        // Hash of original intent
    bytes32 constraintsHash;   // User's constraints (minOut, deadline, etc.)
    bytes32 routeHash;         // Execution path
    bytes32 outcomeHash;       // Actual settlement details
    bytes32 evidenceHash;      // IPFS/Arweave proof bundle
    address solver;            // Solver identity
    bytes signature;           // EIP-712 typed signature
    uint256 timestamp;         // Commitment time
}
```

**Value Proposition:**
- Non-repudiable commitment from solver
- On-chain audit trail for compliance
- Composable with any ERC-7683 protocol

### 2. Solver Bonds

**Economic collateral backing solver commitments.**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Minimum Bond | 0.1 ETH | Low barrier for new solvers |
| Recommended Bond | 1-10 ETH | Proportional to volume |
| Lock Period | 7 days | Prevents hit-and-run attacks |
| Slash Distribution | 80/15/5 | User/Challenger/Treasury |

**Bond Lifecycle:**
```
Inactive → Active (deposit) → Jailed (violation) → Banned (3+ jails)
```

### 3. Deterministic Slashing

**Automatic, trustless enforcement of accountability rules.**

| Violation | Slash Amount | Evidence Required |
|-----------|--------------|-------------------|
| Timeout/Non-delivery | 100% of bond | Block timestamp > deadline |
| MinOut Violation | Pro-rata (e.g., 10% shortfall = 10% slash) | Settlement tx output |
| Wrong Token/Chain | 100% of bond | On-chain state |
| Wrong Recipient | 100% of bond | Settlement tx recipient |
| Receipt Forgery | Rejection + jail | Invalid signature |

**Key Innovation:** No arbitration needed for deterministic violations—slashing is automatic and trustless.

### 4. IntentScore (Solver Reputation Oracle)

**On-chain credit score for solvers, queryable by other protocols.**

```
IntentScore = (SuccessRate × 0.4) + (SpeedScore × 0.2) +
              (VolumeScore × 0.2) + (DisputeScore × 0.2)

Where:
- SuccessRate = finalized / (finalized + slashed)
- SpeedScore = normalized(avgTimeToFinalization)
- VolumeScore = normalized(log(totalVolume))
- DisputeScore = 1 - (disputesLost / totalDisputes)
```

**Use Cases:**
- Protocols require minimum IntentScore for solver eligibility
- Insurance protocols price coverage based on solver reputation
- Users filter solvers by reputation in UI

---

# Technical Architecture

## System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER / AGENT                              │
│                    (Vincent, Privy, AgentKit)                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ 1. Create Intent (ERC-7683)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INTENT PROTOCOL                              │
│              (CoWSwap, UniswapX, Across, etc.)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ 2. Intent Broadcast
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SOLVER                                    │
│                  (Bonded via IRSB)                              │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Check Bond  │───▶│ Execute     │───▶│ Post Receipt│         │
│  │ Status      │    │ Intent      │    │ to IRSB     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ 3. Settlement + Receipt
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     IRSB PROTOCOL                                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Receipt      │  │ Bond         │  │ Reputation   │          │
│  │ Registry     │  │ Manager      │  │ Oracle       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Slashing     │  │ Dispute      │  │ IntentScore  │          │
│  │ Engine       │  │ Resolution   │  │ Calculator   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## EigenLayer AVS Integration (Phase 2)

**Transform IRSB into an Actively Validated Service:**

1. **Solver bonds → Operator stakes** (use restaked ETH)
2. **Receipt validation → Operator attestation** (threshold signatures)
3. **Slashing → EigenLayer slashing** (inherit $15B security)
4. **Reputation → Cross-AVS composability**

**Benefits:**
- Solvers use existing restaked positions (no new capital lockup)
- IRSB inherits EigenLayer's security model
- Multi-chain verification via EigenLayer expansion (Solana 2026)

## Cross-Chain Architecture (Phase 3)

```
Chain A                          Chain B
┌─────────────┐                 ┌─────────────┐
│ IRSB Core   │                 │ IRSB Core   │
└──────┬──────┘                 └──────┬──────┘
       │                               │
       ▼                               ▼
┌─────────────┐                 ┌─────────────┐
│ Receipt     │◄───Hyperlane───►│ Receipt     │
│ Attestor    │   /LayerZero    │ Verifier    │
└─────────────┘                 └─────────────┘
```

**Use Case:** Solver executes cross-chain swap, posts receipt on Chain A, user verifies on Chain B.

---

# Business Model

## Revenue Streams

### 1. Protocol Fees (Primary)

| Fee Type | Rate | Example |
|----------|------|---------|
| Receipt Registration | 0.01% of intent value | $100K swap = $10 fee |
| Bond Management | 0.1% annual on bonded capital | $1M bonded = $1K/year |
| Slashing Proceeds | 5% of slashed amount | $10K slash = $500 treasury |

**Revenue Projection (Year 1):**
- Target: $500M monthly secured volume
- Receipt fees: $500M × 0.01% × 12 = $600K/year
- Bond fees: $10M bonded × 0.1% = $10K/year
- Slashing (1% rate): $60M × 5% = $3M/year
- **Total: ~$3.6M Year 1**

### 2. IntentScore Oracle (Secondary)

| Service | Pricing Model |
|---------|--------------|
| Basic queries | Free (public good) |
| Premium API | $1K-10K/month |
| Custom integrations | Enterprise pricing |

### 3. Compliance Services (Future)

| Service | Target Market |
|---------|--------------|
| Audit trail exports | Institutions, funds |
| EU AI Act compliance packages | Agent developers |
| Insurance underwriting data | DeFi insurance protocols |

## Token Economics (Proposed)

**Utility Token: $IRSB**

| Use Case | Mechanism |
|----------|-----------|
| Governance | Protocol parameter voting |
| Staking | Validators for non-deterministic disputes |
| Fee discounts | Pay fees in $IRSB for 20% discount |
| Solver bonding | Option to bond in $IRSB (1.5x multiplier) |

**Distribution (Illustrative):**
- Team: 20% (4-year vest)
- Investors: 20%
- Ecosystem/Grants: 30%
- Treasury: 20%
- Community: 10%

---

# Go-to-Market Strategy

## Phase 1: MVP & First Integrations (Q1-Q2 2026)

**Objective:** Ship core protocol, prove product-market fit

| Milestone | Target | Success Metric |
|-----------|--------|----------------|
| Mainnet launch | Q1 2026 | Core contracts deployed |
| CoWSwap integration | Q1 2026 | 5 solvers onboarded |
| Across integration | Q2 2026 | Cross-chain receipts working |
| $10M secured volume | Q2 2026 | Monthly volume target |

**Key Activities:**
- Direct outreach to top 10 CoWSwap solvers
- Developer documentation and SDK
- Bug bounty program ($100K allocation)

## Phase 2: EigenLayer & Reputation (Q3 2026)

**Objective:** Scale security model, launch reputation oracle

| Milestone | Target | Success Metric |
|-----------|--------|----------------|
| EigenLayer AVS | Q3 2026 | ServiceManager deployed |
| IntentScore oracle | Q3 2026 | 20+ protocols querying |
| $100M secured volume | Q3 2026 | 10x growth |
| Vincent Ability | Q3 2026 | Lit Protocol integration |

**Key Activities:**
- EigenLayer operator recruitment
- Protocol partnerships (Aave, Compound, etc.)
- IntentScore API launch

## Phase 3: Multi-Chain & Enterprise (Q4 2026)

**Objective:** Cross-chain expansion, enterprise adoption

| Milestone | Target | Success Metric |
|-----------|--------|----------------|
| Hyperlane integration | Q4 2026 | 5+ chains supported |
| Enterprise compliance | Q4 2026 | 3 institutional clients |
| $500M secured volume | Q4 2026 | 5x growth |
| Insurance partnerships | Q4 2026 | 2 DeFi insurance integrations |

---

# Projected Pathway

## Q1 2026: Foundation

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| Mainnet deployment | Feb 2026 | Ethereum mainnet, verified contracts |
| First protocol integration | Feb 2026 | CoWSwap pilot (5 solvers) |
| SDK & documentation | Mar 2026 | npm package, comprehensive docs |
| Security audit #1 | Mar 2026 | Clean audit from Tier 1 firm |
| Bug bounty launch | Mar 2026 | $100K allocation on Immunefi |

**Key Metric:** 5 active solvers, $1M secured volume

## Q2 2026: Traction

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| Across Protocol integration | Apr 2026 | Cross-chain receipts working |
| 1inch Fusion pilot | May 2026 | 10 resolvers onboarded |
| $10M monthly volume | Jun 2026 | Sustained for 30 days |
| Security audit #2 | Jun 2026 | Post-integration audit |

**Key Metric:** 25 active solvers, $10M/month secured volume

## Q3 2026: Scale

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| EigenLayer AVS deployment | Jul 2026 | ServiceManager live |
| IntentScore oracle launch | Aug 2026 | 20+ protocols querying |
| Lit Vincent Ability | Aug 2026 | AI agent integration live |
| $100M monthly volume | Sep 2026 | 10x growth achieved |

**Key Metric:** 50 active solvers, IntentScore oracle revenue

## Q4 2026: Expansion

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| Multi-chain (Hyperlane/LayerZero) | Oct 2026 | 5+ chains supported |
| Enterprise compliance package | Nov 2026 | 3 institutional clients |
| Insurance partnerships | Nov 2026 | 2 DeFi insurance integrations |
| $500M monthly volume | Dec 2026 | 5x growth achieved |

**Key Metric:** $500M/month, $10M bonded capital, positive unit economics

---

# Strategic Partnerships

## Lit Protocol Integration

**Status:** Active development

IRSB is building a Vincent Ability for Lit Protocol's AI agent framework:

| Component | Status | Purpose |
|-----------|--------|---------|
| Vincent Plugin | In development | Solver accountability for AI agents |
| Demo Application | Complete | Interactive demonstration |
| SDK Integration | Planned | Native IRSB support in Vincent |

**Why This Matters:**
- 7,000+ Vincent wallets = immediate distribution
- AI agents need provable execution guarantees
- EU AI Act compliance requirement for agent behavior
- First-mover advantage in AI agent accountability

---

# Team Requirements

## Core Team (Seed Stage)

| Role | Responsibility | Status |
|------|---------------|--------|
| Protocol Lead | Architecture, Solidity | Hiring |
| Security Engineer | Audits, formal verification | Hiring |
| Backend Engineer | Indexing, API, SDK | Hiring |
| BD/Partnerships | Solver relations, integrations | Hiring |

## Advisors (Target)

| Expertise | Target Profile |
|-----------|---------------|
| EigenLayer | Core team or early AVS builder |
| Intent protocols | CoWSwap/Across technical lead |
| DeFi security | Audit firm partner |
| Regulatory | Crypto compliance counsel |

---

# Risk Factors

## Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Smart contract vulnerability | Medium | Multiple audits, formal verification, bug bounty |
| EigenLayer integration complexity | Medium | Incremental rollout, testnet validation |
| Cross-chain message failures | Low | Redundant messaging (Hyperlane + LayerZero) |

## Market Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Competitor emergence | Low | First-mover advantage, patent pending |
| Intent market contraction | Low | Diversify to AI agent and bridge markets |
| Regulatory uncertainty | Medium | Proactive compliance, legal counsel |

## Adoption Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Solver resistance | Medium | Economic incentives (lower fees with good reputation) |
| Protocol integration friction | Medium | Plug-and-play SDK, dedicated support |
| User education | Low | B2B2C model—users don't interact directly |

---

# Financial Projections

## Seed Round Ask

| Item | Amount |
|------|--------|
| **Raise:** | $2M |
| **Valuation:** | $10M pre-money |
| **Use of Funds:** | |
| - Engineering (18 months) | $1.2M |
| - Security audits | $300K |
| - Legal/Compliance | $200K |
| - Operations/Misc | $300K |

## Projected Metrics

| Metric | Q2 2026 | Q4 2026 | Q4 2027 |
|--------|---------|---------|---------|
| Secured Volume (monthly) | $10M | $500M | $2B |
| Bonded Capital | $500K | $10M | $50M |
| Active Solvers | 10 | 50 | 200 |
| Protocol Integrations | 2 | 10 | 30 |
| Revenue (annual run rate) | $100K | $3.6M | $15M |

---

# Appendix

## A. Competitive Analysis Sources

- ERC-7683 Standard: https://eips.ethereum.org/EIPS/eip-7683
- Open Intents Framework: https://medium.com/hyperlane
- EigenLayer Slashing: https://www.coindesk.com/tech/2025/04/17/eigenlayer-adds-key-slashing-feature
- CoWSwap Rules: https://docs.cow.fi/cow-protocol/reference/core/auctions/competition-rules
- 1inch Market Data: https://messari.io/report/state-of-1inch-q2-2025

## B. AI Agent Market Sources

- Lit Vincent: https://spark.litprotocol.com/meet-vincent
- Warden Protocol: https://docs.wardenprotocol.org/
- Coinbase AgentKit: https://docs.cdp.coinbase.com/agent-kit
- Gartner AI Agent Forecast: Gartner 2025 Technology Trends

## C. Technical References

- EigenLayer AVS Guide: https://avaprotocol.org/blog/a-guide-to-eigenlayer-avs
- Slashing Mechanics: https://forum.eigenlayer.xyz/t/the-mechanics-of-allocating-and-slashing-unique-stake
- AI Agent Accountability Research: https://arxiv.org/html/2601.04583v1

## D. ERC-7683 Accountability Gap Evidence

- ERC-7683 Specification (Section 4.2): https://eips.ethereum.org/EIPS/eip-7683
  - *"The settlement contract does not enforce any guarantees about the correctness of the filler's execution"*
- Open Intents Framework Discussion: https://forum.ethereum.org/t/erc-7683-cross-chain-intents/
- Solver Accountability Gap Analysis: Internal research based on protocol documentation review

## E. IRSB Development Repository

- **GitHub:** [To be published upon mainnet launch]
- **Testnet Contracts:** [Sepolia addresses to be added]
- **Test Coverage:** 95 tests across 3 core contracts (Jan 2026)
- **Technical Specification:** See `/000-docs/003-AT-SPEC-irsb-eip-spec.md`

---

**Contact:**
[To be added]

**Disclaimer:**
This document is for informational purposes only and does not constitute an offer to sell or a solicitation of an offer to buy any securities. Forward-looking statements are based on current expectations and are subject to risks and uncertainties.
