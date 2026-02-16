# 1inch Fusion Partnership Outreach

## Context

1inch Fusion is the largest intent aggregator by volume ($28.6B+ monthly). Their resolver system has a critical gap:

- **1inch does NOT assess resolvers' private backend code**
- Resolvers can secretly implement unfair pricing
- Only ex-post legal enforcement, no real-time monitoring
- "Unicorn Power" reputation is opaque and protocol-locked

IRSB provides the transparent, verifiable accountability layer they lack.

## Outreach Materials

---

### 1. Initial Email

**Target**: 1inch Labs team
**Subject**: IRSB - Cross-Intent Reputation Standard for Fusion Resolvers

```
Hi 1inch Team,

I'm building IRSB — a standardized accountability layer for intent solvers.

1inch Fusion is the largest intent router ($28.6B monthly). You've built an incredible system, but there's a known gap: proving resolver execution quality.

**The Problem**

From your own docs:
- "1inch does not assess the private backend code of resolvers"
- Resolvers could secretly implement unfair pricing
- Resolution is ex-post (legal), not real-time

**What IRSB Provides**

1. **Cryptographic receipts** — Resolvers prove execution quality
2. **IntentScore** — Transparent reputation (not opaque Unicorn Power)
3. **Automatic enforcement** — Bad behavior triggers immediate slashing

**Proposal**

- Optional receipts for Fusion resolvers (opt-in)
- IntentScore API you can license/display
- Pilot with 10 resolvers on Sepolia

**Why This Helps 1inch**

- Reduced support overhead (proofs settle disputes)
- Improved resolver stickiness (reputation becomes portable value)
- User trust increase (verifiable execution)

Our contracts are live:
- SolverRegistry: 0xB6ab964832808E49635fF82D1996D6a888ecB745
- IntentReceiptHub: 0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c

Would you be open to discussing integration?

Best,
Jeremy
jeremy@intentsolutions.io
```

---

### 2. Follow-Up Email (If No Response)

**Send**: 5 days after initial email
**Subject**: Re: IRSB - Cross-Intent Reputation Standard for Fusion Resolvers

```
Hi 1inch Team,

Following up on my previous email about IRSB integration.

Quick value prop:
1. Your users get verifiable proof of resolver execution
2. Your resolvers get portable reputation (works across protocols)
3. Your support team gets automatic dispute resolution

We're launching pilots with CoWSwap and Across. Would love to include 1inch in the standard.

15 minutes to discuss?

Best,
Jeremy
```

---

### 3. Resolver Direct Outreach

**Target**: Top 1inch Fusion resolvers

**Subject**: IRSB Resolver Pilot - Build Your IntentScore

```
Hi [Resolver Name],

You're a top 1inch Fusion resolver by volume. I'm building IRSB — a cross-protocol reputation system for intent solvers.

**Why This Matters for You**

Today, your reputation is locked to 1inch (Unicorn Power). If you want to expand to CoWSwap, UniswapX, or Across, you start from zero.

With IRSB:
- Your IntentScore is portable
- Good execution on 1inch builds reputation usable everywhere
- Cryptographic receipts reduce dispute burden

**Pilot Details**

- Duration: 8 weeks
- Bond: 0.1 ETH
- Integration: ~2 hours
- Benefit: Public IntentScore, reduced disputes, cross-protocol rep

We're taking 5 resolvers. Would you like to join?

Best,
Jeremy
```

---

### 4. Technical Integration for 1inch Resolvers

```
IRSB Integration for 1inch Fusion Resolvers

OVERVIEW:
Post a receipt after each Fusion fill to build IntentScore.

INTEGRATION STEPS:

1. Register with SolverRegistry
   - Deposit 0.1+ ETH bond
   - Get approved for receipt posting

2. Post-Fill Hook
   After your resolver fills an intent:

   const receipt = {
     intentHash: keccak256(abi.encode(intent)),
     constraintsHash: keccak256(abi.encode(minOutput, deadline)),
     outcomeHash: keccak256(abi.encode(actualOutput, fillTime)),
     evidenceHash: ipfsHash, // optional: store fill proof
     solverSig: wallet.signMessage(receiptData)
   };

   await intentReceiptHub.postReceipt(intentHash, receipt);

3. Handle Challenges (rare)
   If challenged, provide evidence within 24 hours.
   Good fills are auto-approved.

GAS COST: ~80K per receipt
LATENCY: Can batch with fill or post next block

BENEFIT:
- Each successful receipt increases IntentScore
- High IntentScore = user preference + reduced bond requirements
```

---

### 5. Partnership Proposal Deck Outline

```
Slide 1: Title
IRSB x 1inch Fusion: Transparent Resolver Accountability

Slide 2: The Gap
- 1inch doesn't verify resolver backend code
- Unicorn Power is opaque
- Disputes require ex-post legal action

Slide 3: The Solution
- Cryptographic receipts (verifiable execution)
- IntentScore (transparent reputation)
- Automatic slashing (no legal overhead)

Slide 4: Integration Path
- Optional for resolvers (opt-in)
- License IntentScore API for UI display
- No changes to Fusion core protocol

Slide 5: Timeline
- Week 1-2: Sepolia integration
- Week 3-8: Mainnet pilot (10 resolvers)
- Week 9+: Full rollout if successful

Slide 6: Ask
- Technical contact for integration
- 10 resolver introductions
- Co-marketing opportunity
```

---

## Contact Information

| Contact | Role | Method |
|---------|------|--------|
| Sergej Kunz | Co-founder | sergej@1inch.io (verify) |
| Anton Bukov | Co-founder | anton@1inch.io (verify) |
| 1inch Labs | General | labs@1inch.io |
| Discord | Community | discord.gg/1inch |

## Key Documents to Reference

- [1inch Fusion FAQ](https://help.1inch.com/en/articles/6796085-what-is-1inch-fusion-and-how-does-it-work)
- [Resolver onboarding docs](https://docs.1inch.io/docs/fusion-swap/introduction)

## Tracking

| Date | Action | Contact | Response |
|------|--------|---------|----------|
| | Initial email | team | |
| | Discord intro | #resolvers | |
| | Resolver outreach | Top 5 | |
| | Follow-up | | |
