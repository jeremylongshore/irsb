# IRSB Pain Point Research & Validation Plan

**Intent Receipts & Solver Bonds Protocol**
*Proving the Problem is Real — Evidence, Deliverables, and Partnership Strategy*

**Date:** January 2026
**Version:** 1.0

---

## Executive Summary

This document presents concrete evidence that solver accountability is a real, expensive problem — and outlines actionable deliverables to validate IRSB's product-market fit within 2 weeks.

**Key Findings:**
- **$242,965 in documented solver losses** from just two CoWSwap incidents
- **70+ protocols** building on ERC-7683 cross-chain intents standard
- **Zero standardized accountability** exists across the ecosystem
- **DAO governance bottleneck** makes dispute resolution take weeks, not hours

---

## Part 1: Evidence That The Problem Is Real

### Documented Solver Incidents

| Incident | Date | Loss | Source |
|----------|------|------|--------|
| CIP-22: Barter Solver Hack | Feb 2023 | $166,182 | CoWSwap Forum |
| CIP-55: GlueX Exploit | Nov 2024 | $76,783 | CoWSwap Forum |
| **Total Documented Losses** | | **$242,965** | |

#### CIP-22: Barter Solver Hack (February 2023)

The Barter solver was responsible for a hack that caused CoW DAO a loss of 1 week's fee accrual — approximately $166,182 in protocol revenue.

**What happened:**
- Barter solver's infrastructure was compromised
- Malicious settlements drained protocol fees
- DAO required manual intervention via governance vote
- Resolution took 3+ weeks from incident to slashing

**Source:** https://forum.cow.fi/t/cip-22-slashing-of-the-barter-solver-responsible-for-a-hack-causing-cow-dao-a-loss-of-1-week-fee-accrual/1440

#### CIP-55: GlueX Solver Exploit (November 2024)

The GlueX solver was slashed for an exploit resulting in $76,783 in user losses.

**What happened:**
- GlueX solver executed settlements that violated user constraints
- Users received less than their specified minimum output
- Manual forensic analysis required to prove violations
- DAO governance vote required for slashing

**Source:** https://forum.cow.fi/t/cip-55-slashing-of-the-gluex-solver/2649

### Systemic Problems Validated by Protocol Teams

#### 1. CoWSwap DAO Governance Pain

CoWSwap has documented ongoing governance challenges:

- **CIP-13:** Debates over pennying/overbidding rules
- **CIP-72:** Aligning quoting and solving behavior
- **Manual DAO votes** required for every dispute

**The Problem:** Every slashing event requires:
1. Forum post with evidence
2. Community discussion (days)
3. Snapshot vote (3-7 days)
4. Execution (additional delays)

**Total resolution time:** 3-4 weeks minimum

**IRSB Solution:** Deterministic slashing — if `outcome < minOut`, automatic slash within 24 hours.

#### 2. UniswapX Filler Accountability Gap

Anoma Research's analysis of UniswapX identified a critical gap:

> "The question is whether there is an accountability framework such that fillers can be permissionless while ensuring they do not collude to offer users sub-optimal fills."

**The Problem:** UniswapX has:
- No filler bonds
- No slashing mechanism
- No standardized receipts
- No reputation system

**IRSB Solution:** Standardized bond/receipt infrastructure for any ERC-7683 compatible protocol.

#### 3. 1inch Resolver Blind Spot

From 1inch Fusion FAQ:

> "1inch does NOT assess resolvers' private backend code"

**The Problem:**
- Resolvers can secretly implement unfair pricing
- Only ex-post legal enforcement available
- No real-time monitoring of resolver behavior
- Opaque "Unicorn Power" reputation system

**IRSB Solution:** On-chain IntentScore oracle with transparent scoring methodology.

#### 4. Network Liveness Risk

Across Protocol documented their improvement from 18% to 2.3% failure rate — but:

**The Problem:**
- No standardized timeout penalties
- Failed fills have no automatic recourse
- Users must manually file disputes

**IRSB Solution:** Block timestamp > deadline = automatic 100% bond slash.

---

## Part 2: Actionable Deliverables

### Deliverable 1: Accountability Gap Report (3-5 days)

**Objective:** Quantify the exact problem using on-chain data.

**Methodology:**
1. Create Dune Analytics query for CoWSwap intent failures (past 7 days)
2. Categorize failures by type:
   - Timeout (expiry passed, no settlement)
   - MinOut violation (received < promised)
   - MEV extraction (slippage beyond bounds)
   - Non-delivery
3. Calculate dollar value at risk
4. Breakdown by solver

**Output:** 3-page PDF report showing:
- "X% of intents had violations with no recourse"
- Dollar value at risk per month
- Solver-by-solver breakdown

**Outreach Template After Report:**

```
Hi [Solver Name],

We analyzed CoWSwap intents for the past week:
- 4.2% of fills had constraint violations
- Average user recovery time: 18 hours
- $2.3M in uncompensated failures

IRSB would have prevented 100% via automatic slashing.

[Report PDF attached]

Interested in piloting?
```

### Deliverable 2: Solver Reputation Dashboard (5-7 days)

**Objective:** Public dashboard showing solver performance from on-chain data.

**Tech Stack:**
- The Graph subgraph (CoWSwap events)
- Next.js + Vercel (free tier)
- No backend needed

**Metrics to Display:**

| Solver | IntentScore | Fill Rate | Avg Speed | Slashing Events |
|--------|-------------|-----------|-----------|-----------------|
| Beaver | 94 | 99.8% | 12s | 0 |
| PMM | 91 | 99.2% | 15s | 1 |
| CowDAO | 87 | 98.1% | 18s | 3 |

**IntentScore Formula:**

```
IntentScore = (SuccessRate × 0.4) + (SpeedScore × 0.2) +
              (SlippageScore × 0.2) + (DisputeScore × 0.2)
```

**Value Proposition:**
- Solvers see competitive advantage from good scores
- Data-driven proof that differentiation is real
- Live URL to share in outreach

### Deliverable 3: Solver Interview Campaign (1-2 weeks)

**Target:** Top 10 CoWSwap solvers by volume

**Interview Template (30 min):**

**1. Current State (10 min)**
- "How do you prove intent execution to users today?"
- "How do you handle disputes or failed fills?"
- "What % of daily fills could fail due to network/MEV/timeout?"

**2. Economic Pain (7 min)**
- "What does proving your execution cost you?"
- "How much time on post-execution disputes?"
- "Biggest reputational risk in your operation?"

**3. Validation (8 min)**
- "If you could post cryptographic receipts, would that change your business?"
- "What would cause you to adopt a standardized format?"
- "How would a reputation oracle affect your position?"

**4. Partnership (5 min)**
- "Would you pilot this for [specific benefit]?"
- "What would a 3-month trial need to prove?"

**Where to Find Solvers:**
- CoWSwap Telegram: #solvers channel
- On-chain: Top addresses by settlement volume
- Twitter: @CoWSwap mentions

### Deliverable 4: Demo Video (1 week)

**Objective:** 5-minute click-through showing failure scenario.

**Scenario Script:**

**WHAT HAPPENS TODAY:**
1. User submits 100 USDC → 1 ETH intent
2. Solver executes
3. Settlement: user gets 0.97 ETH (< minOut of 0.99)
4. User has no recourse
5. Solver keeps fees

**WHAT HAPPENS WITH IRSB:**
1. Same intent submitted
2. Solver posts cryptographic receipt + bond
3. User/anyone challenges (outcome < minOut)
4. Automatic slashing (no DAO vote)
5. User refunded 80% of slash
6. Solver loses reputation

**Format:** Figma prototype or Loom recording

---

## Part 3: Partnership Outreach Strategy

### CoWSwap Approach

**Phase 1: Soft Signal (Week 1)**

```
CoWSwap Telegram #solvers:

"Hi team,

Building IRSB — standardized accountability for ERC-7683 solvers.
Piloting with 5 CoWSwap solvers on Sepolia.

Zero cost: we handle integration, solvers opt-in, UX unchanged.

[Link to Dashboard / Report]

Interested solvers: DM us."
```

**Phase 2: Direct Outreach to Top 3 Solvers**

```
Subject: Pilot Opportunity - Solver Reputation System

Hi [Solver Name],

You're top 5 CoWSwap by volume. We're launching a standardized
reputation system for intent solvers.

Pilot:
- 8 weeks (Sepolia → L2)
- 0.1 ETH bond minimum
- 1-2 dev days integration
- Public reputation score + reduced disputes

Taking 5 pilots. First-come-first-served.

[Calendar Link]
```

### Across Protocol Approach

```
Subject: IRSB + Across Cross-Chain Receipts

Hi Across Team,

Across relayers are gold standard for cross-chain. IRSB adds
reputation + accountability layer.

Pilot: 5 relayers, cross-chain receipt attestation, no economic changes.

Success = lower user dispute rates + higher trust.

[Calendar Link]
```

### 1inch Approach

```
Subject: IRSB - Cross-Intent Reputation Standard

Hi 1inch,

You're largest intent router ($28.6B monthly). IRSB solves your
support problem: proving resolver execution.

Proposal: Optional receipts, opt-in resolvers, license IntentScore API.

Early win: Reduce dispute volume + improve resolver stickiness.

[Calendar Link]
```

---

## Part 4: Differentiation — The Gaps IRSB Uniquely Fills

### The Core Problem Statement

> "ERC-7683 explicitly delegates accountability to fillers. No standard exists."
> — ERC-7683 Specification, Section 4.2

Every intent protocol faces the same question: **Who enforces solver promises?**

### Gap Analysis: What Exists vs What's Missing

| Capability | CoWSwap | 1inch | UniswapX | Across | IRSB |
|------------|---------|-------|----------|--------|------|
| Solver bonds | Protocol-specific | Staked 1INCH | None | Relayer deposits | **Standardized** |
| Slashing | DAO vote required | Ranking penalty only | None | Manual | **Deterministic, automatic** |
| Receipts | None | None | None | None | **Cryptographic proofs** |
| Reputation | Informal | Unicorn Power (opaque) | None | None | **On-chain IntentScore** |
| Cross-protocol | Locked | Locked | Locked | Locked | **Protocol-agnostic** |
| Timeout enforcement | None | None | None | None | **Automatic slashing** |

### The 5 Gaps IRSB Uniquely Fills

#### Gap 1: No Standardized Receipts

**Current State:** Solvers execute intents with no verifiable proof

**Evidence:** CIP-22 and CIP-55 — when disputes happen, proving what occurred requires forensic analysis

**IRSB Solution:** Cryptographic receipts with intent hash, constraints hash, outcome hash, and solver signature

```solidity
struct IntentReceipt {
    bytes32 intentHash;        // Original intent
    bytes32 constraintsHash;   // User's requirements
    bytes32 outcomeHash;       // Actual result
    bytes32 evidenceHash;      // IPFS proof bundle
    bytes solverSig;           // Non-repudiable commitment
}
```

#### Gap 2: DAO Governance Bottleneck

**Current State:** Every dispute requires DAO vote (weeks/months)

**Evidence:** CIP-22 slashing took forum proposal → vote → execution (3+ weeks)

**IRSB Solution:** Deterministic slashing — if `outcome < minOut`, automatic slash, no governance

| CoWSwap Today | IRSB |
|---------------|------|
| Dispute → Forum post | Dispute → On-chain challenge |
| → Discussion | → 1-hour evidence window |
| → Snapshot vote | → Automatic resolution |
| → Execution | → Immediate slash/refund |
| (3-4 weeks) | (< 24 hours) |

#### Gap 3: No Timeout Enforcement

**Current State:** If solver times out, user waits indefinitely or manually cancels

**Evidence:** Across documented 18% → 2.3% failure rate improvement, but no penalty for timeouts

**IRSB Solution:** Block timestamp > deadline = automatic 100% bond slash

#### Gap 4: No Cross-Protocol Reputation

**Current State:** Solver reputation is siloed — good CoWSwap solver has no reputation on 1inch

**Evidence:** 1inch uses "Unicorn Power" (opaque), CoWSwap has informal rankings, no interoperability

**IRSB Solution:** IntentScore oracle queryable by any protocol

```solidity
function getIntentScore(address solver) external view returns (uint256);
```

#### Gap 5: Protocol Lock-In

**Current State:** Each protocol builds custom accountability (if any)

**Evidence:** CoWSwap has bonds, 1inch has staking, UniswapX has nothing — no standard

**IRSB Solution:** ERC-7683 compatible, works with any intent protocol

### Why Competitors Won't Build This

| Competitor | Why They Won't |
|------------|----------------|
| CoWSwap | Accountability is their competitive moat — they won't open-source it |
| 1inch | Resolver management is proprietary advantage |
| EigenLayer | Horizontal infrastructure — builds platforms, not applications |
| Symbiotic | Restaking focus — accountability layer is out of scope |
| OIF (Ethereum Foundation) | Standards body — defines specs, doesn't ship products |

---

## Part 5: 2-Week Execution Timeline

### Week 1

| Day | Task |
|-----|------|
| 1 | Set up Dune query for CoWSwap intent failures |
| 2 | Deploy contracts to Sepolia (already done) + verify |
| 3 | Publish npm SDK + integration guide |
| 4 | Build Solver Dashboard (The Graph + Next.js) |
| 5 | Write Accountability Gap Report |
| 6 | Create interview templates + LOI |
| 7 | Prepare email templates for top 10 solvers |

### Week 2

| Day | Task |
|-----|------|
| 8-10 | Post in CoWSwap Telegram + direct outreach top 3 |
| 11 | Schedule first 3 onboarding calls |
| 12 | Deploy demo video |
| 13 | Send partnership proposals to CoWSwap/Across/1inch |
| 14 | Schedule partnership calls + compile results |

---

## Part 6: Success Metrics

| Metric | Week 2 Target | Week 4 Target |
|--------|---------------|---------------|
| Solvers reached | 10 | 25 |
| Pilot signups | 2 | 5 |
| Partnership calls | 1 | 3 |
| Dashboard views | 100 | 1K |
| npm SDK downloads | 10 | 100 |

---

## Part 7: Letter of Intent Template

```
LETTER OF INTENT - IRSB Protocol Pilot Partnership

DATE: ___________
PARTIES: IRSB Protocol ("Provider") + [Protocol] ("Partner")

1. PILOT SCOPE
   - Duration: 3 months
   - Network: Sepolia → Arbitrum
   - Solvers: 5-10 (opt-in)

2. PROVIDER RESPONSIBILITIES
   - Deploy IRSB contracts
   - Integrate with Partner's receipt format
   - Technical support for onboarding
   - Weekly metrics (integration time, slashing events)

3. PARTNER RESPONSIBILITIES
   - Nominate pilot solvers
   - Integration guidance (API, settlement format)
   - Surface reputation scores in UI (optional)
   - Feedback on friction

4. SUCCESS METRICS
   - Integration time: <4 hours/solver
   - Slashing accuracy: 0 false positives
   - Adoption: All 5 solvers receipting in 2 weeks
   - Reputation impact: 10%+ improvement in user selection

5. NON-BINDING (except confidentiality)

SIGNATURES: ___________
```

---

## Part 8: Key Evidence Links

### CoWSwap Slashing Incidents
- CIP-22: Barter Solver — https://forum.cow.fi/t/cip-22-slashing-of-the-barter-solver-responsible-for-a-hack-causing-cow-dao-a-loss-of-1-week-fee-accrual/1440
- CIP-55: GlueX — https://forum.cow.fi/t/cip-55-slashing-of-the-gluex-solver/2649

### Governance Discussions
- CIP-13: Pennying — https://forum.cow.fi/t/cip-13-rules-of-the-solver-competition-update-proposal-to-ban-pennying/1119
- CIP-72: Quoting/Solving Alignment — https://forum.cow.fi/t/cip-72-aligning-quoting-and-solving-behavior-of-solvers/3079

### Accountability Gap Analysis
- UniswapX Anoma Research — https://anoma.net/research/uniswapx
- 1inch Fusion FAQ — https://help.1inch.com/en/articles/6796085-what-is-1inch-fusion-and-how-does-it-work

---

## Appendix: Technical Architecture

```
┌─────────────────┐         ┌──────────────────┐
│ SolverRegistry  │◄────────► IntentReceiptHub │
├─────────────────┤         ├──────────────────┤
│ • Registration  │         │ • Receipt post   │
│ • Bond mgmt     │         │ • Disputes       │
│ • Slashing      │         │ • Finalization   │
│ • Reputation    │         │ • Settlement     │
└─────────────────┘         └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │  DisputeModule   │
                            ├──────────────────┤
                            │ • Evidence       │
                            │ • Escalation     │
                            │ • Arbitration    │
                            └──────────────────┘
```

### Key Constants

| Parameter | Value | Purpose |
|-----------|-------|---------|
| MINIMUM_BOND | 0.1 ETH | Solver activation threshold |
| WITHDRAWAL_COOLDOWN | 7 days | Bond withdrawal delay |
| MAX_JAILS | 3 | Jails before permanent ban |
| CHALLENGE_WINDOW | 1 hour | Time to dispute receipt |
| EVIDENCE_WINDOW | 24 hours | Evidence submission period |
| ARBITRATION_TIMEOUT | 7 days | Default resolution deadline |

### Slashing Distribution

| Recipient | Standard Slash | Arbitration |
|-----------|---------------|-------------|
| User | 80% | 70% |
| Challenger | 15% | — |
| Treasury | 5% | 20% |
| Arbitrator | — | 10% |

---

## Conclusion

IRSB fills a critical gap in the intent-based transaction ecosystem. With $242K+ in documented losses, no standardized accountability across protocols, and governance bottlenecks delaying dispute resolution by weeks, the market need is clear.

The 2-week execution plan provides actionable deliverables:
1. **Accountability Gap Report** — Quantify the problem
2. **Solver Dashboard** — Public proof of differentiation
3. **Interview Campaign** — Direct validation from solvers
4. **Partnership Outreach** — CoWSwap, Across, 1inch pilots

**Next Step:** Execute Week 1 deliverables and begin solver outreach.

---

*IRSB Protocol — The Credit Score Layer for Intent Solvers*
