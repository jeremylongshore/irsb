# CoWSwap Partnership Outreach

## Context

CoWSwap has experienced $242K+ in documented solver losses:
- **CIP-22**: Barter Solver hack - $166,182 (Feb 2023)
- **CIP-55**: GlueX exploit - $76,783 (Nov 2024)

These incidents required DAO governance votes for resolution, taking weeks. IRSB eliminates this bottleneck with deterministic, automatic slashing.

## Outreach Materials

---

### 1. Telegram #solvers Channel Post

**Target**: CoWSwap Telegram #solvers channel

```
Hi CoWSwap solver community,

I'm building IRSB (Intent Receipts & Solver Bonds) — a standardized accountability layer for ERC-7683 solvers.

What it does:
• Cryptographic receipts proving execution
• Automatic slashing for violations (no DAO votes)
• Cross-protocol reputation (IntentScore)
• Deterministic timeout enforcement

We're piloting with 5 CoWSwap solvers on Sepolia.

Zero cost:
• We handle integration
• Solvers opt-in
• UX unchanged
• ~2 dev hours to integrate

Live contracts on Sepolia:
• SolverRegistry: 0xB6ab9648...
• IntentReceiptHub: 0xD66A1e88...
• DisputeModule: 0x144DfEcB...

Dashboard: [LINK_WHEN_DEPLOYED]
GitHub: github.com/intent-solutions-io/irsb-protocol

Interested solvers: DM me or reply here.

— Jeremy
```

---

### 2. Direct Email to Top Solvers

**Target**: Top 3 CoWSwap solvers by volume (Beaver Builder, PMM, CowDAO Solver)

**Subject**: Pilot Opportunity - IRSB Solver Reputation System

```
Hi [Solver Name],

You're a top CoWSwap solver by volume. We're launching IRSB — a standardized reputation and accountability system for intent solvers.

**The Problem We Solve**

When CIP-22 (Barter) and CIP-55 (GlueX) happened, the response required:
- Forum proposals
- Weeks of discussion
- DAO votes
- Manual execution

$242K+ lost, weeks of governance overhead.

**IRSB Changes This**

With IRSB:
- Disputes resolve in <24 hours (not weeks)
- Automatic slashing — no governance needed
- Cryptographic receipts prove execution
- Your reputation becomes portable across protocols

**Pilot Details**

- Duration: 8 weeks (Sepolia → L2)
- Minimum bond: 0.1 ETH
- Integration: 1-2 dev hours
- Public IntentScore ranking
- Reduced dispute handling burden

We're taking 5 pilots. First-come-first-served.

Would you be open to a 15-minute call?

Contracts (Sepolia):
- SolverRegistry: 0xB6ab964832808E49635fF82D1996D6a888ecB745
- IntentReceiptHub: 0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c

Best,
Jeremy
jeremy@intentsolutions.io
```

---

### 3. Letter of Intent Template

**Use After**: Initial call with interested solver

```
LETTER OF INTENT - IRSB Protocol Pilot Partnership

DATE: ___________
PARTIES: IRSB Protocol ("Provider") + [Solver Name] ("Solver")

1. PILOT SCOPE
   - Duration: 8 weeks
   - Phase 1: Sepolia testnet (weeks 1-4)
   - Phase 2: Arbitrum (weeks 5-8)
   - Bond: 0.1 ETH minimum

2. PROVIDER RESPONSIBILITIES
   - Deploy and maintain IRSB contracts
   - Integration support (technical docs, API access)
   - Weekly metrics reporting
   - Bug fixes within 24 hours

3. SOLVER RESPONSIBILITIES
   - Post receipts for executed intents
   - Maintain minimum bond
   - Provide integration feedback
   - Surface issues promptly

4. SUCCESS METRICS
   - Integration time: <4 hours
   - Receipt posting latency: <2 blocks
   - Slashing accuracy: 0 false positives
   - Dispute resolution: <24 hours

5. BENEFITS TO SOLVER
   - Public IntentScore ranking
   - Reputation portability
   - Reduced dispute handling
   - Marketing differentiation

6. NON-BINDING
   This LOI is non-binding except for confidentiality.

SIGNATURES:

Provider: _______________    Solver: _______________
Date:     _______________    Date:   _______________
```

---

### 4. Follow-Up Email (After Initial Outreach)

**Send**: 3 days after initial email if no response

**Subject**: Re: Pilot Opportunity - IRSB Solver Reputation System

```
Hi [Solver Name],

Following up on my previous email about the IRSB pilot.

Quick summary of why this matters for you:

1. **Reputation portability** — Your IntentScore works across protocols
2. **Reduced disputes** — Cryptographic proofs settle automatically
3. **Competitive edge** — High scores = premium user selection

We have 3 pilot slots remaining. Would Tuesday or Thursday work for a quick call?

Best,
Jeremy
```

---

## Solver Contact Research

### Known Top CoWSwap Solvers (2024-2025)

| Solver | Status | Contact Method |
|--------|--------|----------------|
| Beaver Builder | Active | builder@flashbots.net (check) |
| PMM Solver | Active | CoWSwap Telegram |
| CowDAO Solver | Active | governance@cow.fi |
| Flashbots Relay | Active | business@flashbots.net |
| MEV Blocker | Active | info@mevblocker.io |

### On-Chain Research

Find top solvers by settlement volume:
```
# Dune Analytics query
SELECT
  solver,
  COUNT(*) as trade_count,
  SUM(trade_value_usd) as total_volume
FROM cow_protocol_ethereum.trades
WHERE block_time > NOW() - INTERVAL '30 days'
GROUP BY solver
ORDER BY total_volume DESC
LIMIT 10
```

---

## Tracking

| Date | Action | Solver | Response |
|------|--------|--------|----------|
| | Telegram post | All | |
| | Email | Beaver Builder | |
| | Email | PMM | |
| | Email | CowDAO | |
| | Follow-up | | |
