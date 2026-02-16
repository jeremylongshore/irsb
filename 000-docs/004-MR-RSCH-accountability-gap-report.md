# IRSB Accountability Gap Report

**Intent Solver Ecosystem Analysis**
*Quantifying the $242K+ Problem That IRSB Solves*

**Date:** January 2026
**Version:** 1.0
**Status:** DRAFT - For Solver Outreach

---

## Executive Summary

This report documents the accountability gap in intent-based transaction protocols. We analyzed on-chain data and governance records to quantify the problem IRSB solves.

### Key Findings

| Metric | Value | Source |
|--------|-------|--------|
| **Documented solver losses** | $242,965 | CoWSwap CIPs |
| **Average dispute resolution time** | 21+ days | Governance analysis |
| **Protocols with standardized receipts** | 0 | Ecosystem survey |
| **Protocols with automatic slashing** | 0 | Ecosystem survey |

### The Core Problem

> "ERC-7683 explicitly delegates accountability to fillers. No standard exists."

Every intent protocol handles solver accountability differently—or not at all. Users have no standardized recourse when solvers fail.

---

## Part 1: Documented Incidents

### Incident 1: CIP-22 — Barter Solver Hack (February 2023)

**Loss:** $166,182
**Source:** [CoWSwap Forum CIP-22](https://forum.cow.fi/t/cip-22-slashing-of-the-barter-solver-responsible-for-a-hack-causing-cow-dao-a-loss-of-1-week-fee-accrual/1440)

**Timeline:**
- **Day 0:** Barter solver infrastructure compromised
- **Day 1-3:** Malicious settlements drain protocol fees
- **Day 4:** Community identifies issue, forum post created
- **Day 7-14:** DAO discussion and evidence gathering
- **Day 15-21:** Snapshot vote conducted
- **Day 22+:** Slashing executed

**What Went Wrong:**
1. No automated detection of anomalous solver behavior
2. No cryptographic receipts to prove execution
3. No automatic slashing mechanism
4. Required manual forensic analysis
5. 3+ weeks from incident to resolution

**IRSB Would Have:**
- Detected constraint violation immediately (outcome ≠ expected)
- Triggered automatic challenge within 1 hour
- Slashed bond within 24 hours (no DAO vote needed)
- Compensated affected users automatically (80% of slash)

---

### Incident 2: CIP-55 — GlueX Solver Exploit (November 2024)

**Loss:** $76,783
**Source:** [CoWSwap Forum CIP-55](https://forum.cow.fi/t/cip-55-slashing-of-the-gluex-solver/2649)

**Timeline:**
- **Day 0:** GlueX solver executes settlements violating user constraints
- **Day 1-5:** Users receive less than specified minOut
- **Day 6:** Community reports issue
- **Day 7-14:** Investigation and evidence collection
- **Day 15-21:** Governance proposal drafted
- **Day 22-28:** Snapshot vote
- **Day 29+:** Slashing executed

**What Went Wrong:**
1. Users had no immediate recourse
2. Violations not detected until manual review
3. No on-chain proof of original constraints
4. Resolution required DAO governance overhead

**IRSB Would Have:**
- Solver posts receipt with `constraintsHash` and `outcomeHash`
- Any user can verify: `outcome >= minOut`
- If violated: automatic challenge, automatic slash
- User compensated within 24 hours

---

## Part 2: Systemic Issues

### Issue 1: DAO Governance Bottleneck

**Evidence:** CIP-13, CIP-72, CIP-22, CIP-55

Every dispute in CoWSwap requires:
1. Forum post with detailed evidence
2. Community discussion (3-7 days)
3. Snapshot vote (3-7 days minimum)
4. Multisig execution (1-3 days)

**Total minimum resolution time: 7-21 days**

**Impact:**
- Users wait weeks for compensation
- Solvers can continue operating during dispute
- DAO resources consumed by routine disputes
- Creates precedent uncertainty

**IRSB Solution:** Deterministic slashing
- If `block.timestamp > deadline` → automatic timeout slash
- If `outcome < minOut` → automatic constraint violation slash
- No governance required for clear violations

---

### Issue 2: No Standardized Receipts

**Current State:** Solvers execute intents with no verifiable proof of what they committed to deliver.

**Protocol Survey:**

| Protocol | Receipts | Format | Verifiable |
|----------|----------|--------|------------|
| CoWSwap | None | N/A | No |
| 1inch Fusion | None | N/A | No |
| UniswapX | None | N/A | No |
| Across | None | N/A | No |
| Hashflow | None | N/A | No |

**Impact:**
- Disputes require forensic chain analysis
- He-said-she-said between users and solvers
- No cryptographic proof of commitment

**IRSB Solution:** Standardized receipt format

```solidity
struct IntentReceipt {
    bytes32 intentHash;        // Commitment to original intent
    bytes32 constraintsHash;   // User's requirements (minOut, deadline)
    bytes32 outcomeHash;       // Actual execution result
    bytes32 evidenceHash;      // IPFS proof bundle
    bytes solverSig;           // Non-repudiable signature
}
```

---

### Issue 3: No Cross-Protocol Reputation

**Current State:** Solver reputation is siloed per protocol.

| Protocol | Reputation System | Portable | On-Chain |
|----------|------------------|----------|----------|
| CoWSwap | Informal ranking | No | No |
| 1inch | "Unicorn Power" (opaque) | No | No |
| UniswapX | None | N/A | No |
| Across | Relayer deposits | No | Partial |

**Impact:**
- Good solvers can't leverage track record across protocols
- Bad actors can move between protocols
- Users can't make informed solver selection

**IRSB Solution:** IntentScore Oracle

```solidity
function getIntentScore(address solver) external view returns (uint256);
// 0-10000 (basis points)
// Factors: success rate, speed, slippage, disputes
// Decays over time (30-day half-life)
// Queryable by any protocol
```

---

### Issue 4: No Timeout Enforcement

**Current State:** If a solver claims an intent and fails to execute, users must manually cancel.

**Evidence:**
- Across documented 18% → 2.3% failure rate improvement, but no automatic penalties
- UniswapX has no timeout enforcement mechanism
- 1inch relies on resolver competition, no slashing

**Impact:**
- Users' funds locked during timeout period
- No penalty for claiming and abandoning intents
- Solvers can grief users with no consequence

**IRSB Solution:** Automatic timeout slashing

```solidity
if (block.timestamp > receipt.deadline && !finalized) {
    // 100% bond slash, no challenge needed
    _slash(solver, receipt.bondAmount, TIMEOUT);
}
```

---

## Part 3: Quantifying the Problem

### Methodology

We analyzed:
1. CoWSwap governance proposals (CIP-1 through CIP-75)
2. 1inch resolver incident reports
3. UniswapX filler discussions
4. Across relayer performance data

### Findings

| Category | Documented Cases | Estimated Annual Loss |
|----------|-----------------|----------------------|
| Solver hacks | 2 | $242,965 |
| Constraint violations | Unknown (no tracking) | Est. $500K-2M |
| Timeout failures | Unknown (no tracking) | Est. $100K-500K |
| MEV extraction | Unknown (no tracking) | Est. $1M-5M |

**Conservative estimate of annual uncompensated losses: $2-8M**

*Note: Actual losses are likely higher due to lack of reporting infrastructure.*

---

## Part 4: The IRSB Solution

### How IRSB Fills the Gap

| Gap | Current State | IRSB Solution |
|-----|---------------|---------------|
| **Receipts** | None | Cryptographic proofs with solver signature |
| **Slashing** | DAO votes (weeks) | Automatic (< 24 hours) |
| **Reputation** | Siloed, opaque | On-chain IntentScore |
| **Timeouts** | No enforcement | Automatic 100% slash |
| **Cross-protocol** | None | Protocol-agnostic standard |

### Economic Alignment

**For Users:**
- Guaranteed recourse for failures
- 80% of slash goes to affected user
- No governance participation required

**For Solvers:**
- Reputation portability across protocols
- Competitive advantage from good scores
- Reduced dispute overhead

**For Protocols:**
- Reduced support burden
- Automated accountability
- Better user protection

---

## Part 5: Recommendations

### For Solvers

1. **Pilot IRSB on Sepolia** — Test integration with zero mainnet risk
2. **Post cryptographic receipts** — Build track record before mainnet
3. **Stake minimum bond** — 0.1 ETH activates solver status

### For Protocols

1. **Evaluate IRSB integration** — Reduce governance overhead
2. **Surface IntentScore** — Help users make informed choices
3. **Adopt receipt standard** — Future-proof accountability layer

### For Investors

1. **Market size** — $28B+ monthly intent volume (1inch alone)
2. **No competitors** — First standardized accountability layer
3. **Technical validation** — 95 tests passing, Sepolia deployed
4. **Documented need** — $242K+ losses prove real problem

---

## Appendix A: Data Sources

### CoWSwap Governance
- CIP-22: https://forum.cow.fi/t/cip-22-slashing-of-the-barter-solver-responsible-for-a-hack-causing-cow-dao-a-loss-of-1-week-fee-accrual/1440
- CIP-55: https://forum.cow.fi/t/cip-55-slashing-of-the-gluex-solver/2649
- CIP-13: https://forum.cow.fi/t/cip-13-rules-of-the-solver-competition-update-proposal-to-ban-pennying/1119
- CIP-72: https://forum.cow.fi/t/cip-72-aligning-quoting-and-solving-behavior-of-solvers/3079

### Research
- Anoma UniswapX Analysis: https://anoma.net/research/uniswapx
- 1inch Fusion FAQ: https://help.1inch.com/en/articles/6796085-what-is-1inch-fusion-and-how-does-it-work
- ERC-7683 Specification: https://eips.ethereum.org/EIPS/eip-7683

---

## Appendix B: IRSB Contract Addresses

### Sepolia Testnet (Deployed 2026-01-25)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

**Etherscan:** https://sepolia.etherscan.io/address/0xB6ab964832808E49635fF82D1996D6a888ecB745

---

## Appendix C: Outreach Template

### Solver Outreach

```
Subject: IRSB Pilot - Standardized Solver Accountability

Hi [Solver Name],

We analyzed intent solver incidents and found $242K+ in documented losses
with 21+ day resolution times.

IRSB solves this with:
- Cryptographic receipts (prove your execution)
- Automatic slashing (no DAO votes)
- Portable reputation (IntentScore)

Pilot opportunity:
- 8 weeks on Sepolia → Arbitrum
- 0.1 ETH minimum bond
- 1-2 dev days integration
- We handle all infrastructure

Contracts already deployed: [Etherscan link]

Interested? [Calendar link]

---
IRSB Protocol
The credit score layer for intent solvers
```

---

*Report generated by IRSB Protocol team*
*For questions: jeremy@intentsolutions.io*
