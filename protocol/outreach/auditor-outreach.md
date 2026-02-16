# Security Auditor Outreach

## Target Auditors

| Firm | Tier | Specialty | Contact |
|------|------|-----------|---------|
| OpenZeppelin | 1 | DeFi, ERC standards | audits@openzeppelin.com |
| Trail of Bits | 1 | Low-level, crypto | audits@trailofbits.com |
| Spearbit | 1 | Crowd-sourced elite | info@spearbit.com |
| Cyfrin | 1 | Foundry native | audits@cyfrin.io |
| Consensys Diligence | 1 | Enterprise | diligence@consensys.net |
| Sherlock | 2 | Contest-based | contact@sherlock.xyz |
| Code4rena | 2 | Contest-based | team@code4rena.com |

---

## Email Template - Tier 1 Firms

**Subject**: Audit Request - IRSB Protocol (900 SLOC, Intent Accountability Layer)

```
Hi [Firm] Audit Team,

We're requesting a security audit for IRSB Protocol — an accountability layer
for intent-based transactions (ERC-7683 ecosystem).

SCOPE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Contracts: 3 (SolverRegistry, IntentReceiptHub, DisputeModule)
• SLOC: ~900
• Language: Solidity 0.8.20
• Framework: Foundry
• Tests: 95 passing
• Complexity: Medium (bonding, slashing, signature verification)

WHAT IRSB DOES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Solver registration with ETH bonds
• Cryptographic receipt posting for intent execution
• Deterministic dispute resolution (automatic slashing)
• Reputation tracking (IntentScore)

KEY RISK AREAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Reentrancy in ETH transfers (withdrawals, slashing)
• Signature verification (receipt authenticity)
• Access control (slashing authorization)
• State machine transitions (receipt/dispute lifecycle)

RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• GitHub: github.com/intent-solutions-io/irsb-protocol
• Audit Package: /audit/ directory (SCOPE.md, THREAT-MODEL.md, INVARIANTS.md)
• Deployed: Sepolia testnet (verified contracts)
• Dashboard: https://irsb-protocol.web.app

TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Desired start: Q1 2026
• Mainnet target: Post-audit Q1 2026
• Flexible on timing to match your availability

BUDGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please provide a quote based on scope. We're prepared for Tier 1 pricing
given the financial risk profile (bonded collateral, slashing).

Happy to schedule a call to walk through the architecture.

Best regards,
Jeremy Longshore
jeremy@intentsolutions.io
Intent Solutions IO
```

---

## Email Template - Contest Platforms (Sherlock/Code4rena)

**Subject**: Audit Contest Request - IRSB Protocol (900 SLOC)

```
Hi [Platform] Team,

We'd like to run an audit contest for IRSB Protocol.

PROTOCOL SUMMARY
• Intent accountability layer (ERC-7683 ecosystem)
• 3 contracts, ~900 SLOC
• Solidity 0.8.20, Foundry
• 95 tests passing

KEY MECHANICS
• Solver bonding (ETH collateral)
• Receipt posting (signed proofs)
• Deterministic slashing
• Reputation system

CONTEST PARAMETERS (Suggested)
• Prize pool: $30K-50K
• Duration: 7-14 days
• Severity levels: High/Medium/Low/Gas

RESOURCES
• GitHub: github.com/intent-solutions-io/irsb-protocol
• Audit docs: /audit/ directory
• Testnet: Sepolia (verified)

Timeline flexible. Please advise on next steps and pricing.

Best,
Jeremy Longshore
jeremy@intentsolutions.io
```

---

## Follow-Up Template (5 days)

**Subject**: Re: Audit Request - IRSB Protocol

```
Hi [Firm],

Following up on my audit request for IRSB Protocol.

Quick recap:
• 3 contracts, ~900 SLOC
• Foundry, 95 tests
• Intent solver accountability (bonds, receipts, slashing)

Would love to discuss scope and timeline. Available for a call this week.

Best,
Jeremy
```

---

## Tracking

| Date | Firm | Contacted | Response | Quote | Status |
|------|------|-----------|----------|-------|--------|
| 2026-01-25 | OpenZeppelin | ✅ | | | Awaiting response |
| 2026-01-25 | Trail of Bits | ✅ | | | Awaiting response |
| 2026-01-25 | Spearbit | ✅ | | | Awaiting response |
| 2026-01-25 | Cyfrin | ✅ | | | Awaiting response |
| 2026-01-25 | Consensys Diligence | ✅ | | | Awaiting response |
| 2026-01-25 | Sherlock | ✅ | | | Awaiting response |
| 2026-01-25 | Code4rena | ✅ | | | Awaiting response |

---

## Comparison Criteria

When selecting auditor:

| Criteria | Weight | Notes |
|----------|--------|-------|
| Reputation | 30% | Track record, notable audits |
| Timeline | 25% | Availability for Q1 2026 |
| Price | 20% | Budget fit |
| Expertise | 15% | DeFi/bonding experience |
| Deliverables | 10% | Report quality, fix review |

## Budget Guidance

| Firm Type | Typical Range (900 SLOC) |
|-----------|--------------------------|
| Tier 1 (OZ, ToB) | $50K - $100K |
| Tier 1 (Spearbit, Cyfrin) | $30K - $60K |
| Contest (Sherlock) | $30K - $50K pool |
| Contest (Code4rena) | $25K - $40K pool |
