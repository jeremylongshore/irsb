# IRSB Protocol Threat Model

**Document ID:** 025-AA-SEC-threat-model
**Version:** 1.0
**Date:** January 2026
**Status:** Living Document

---

## 1. Executive Summary

This document identifies and analyzes threats to the IRSB (Intent Receipts & Solver Bonds) protocol. It covers attack vectors, threat actors, security controls, and residual risks for smart contracts deployed on Ethereum.

### Scope

- **In Scope:** SolverRegistry, IntentReceiptHub, DisputeModule, EscrowVault, ReceiptV2Extension, OptimisticDisputeModule
- **Out of Scope:** Off-chain indexers, SDK implementations, frontend applications

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IRSB Protocol                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Actors:                                                             │
│  - Users (intent originators)                                        │
│  - Solvers (intent executors with bonded stake)                      │
│  - Challengers (dispute initiators)                                  │
│  - Arbitrators (dispute resolvers)                                   │
│  - Owner/Admin (protocol governance)                                 │
│                                                                      │
│  Assets:                                                             │
│  - Solver bonds (ETH staked for accountability)                      │
│  - Challenger bonds (ETH for dispute incentive alignment)            │
│  - Escrow funds (ETH/ERC20 locked for intent completion)             │
│  - Receipt attestations (cryptographic proof of execution)           │
│  - Reputation scores (solver credibility)                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Actors

| Actor | Motivation | Capabilities | Threat Level |
|-------|-----------|--------------|--------------|
| **Malicious Solver** | Profit from incomplete/incorrect execution | Deploy contracts, sign receipts, control operator keys | HIGH |
| **Malicious Challenger** | Grief solvers, steal bonds | Open disputes, submit evidence | MEDIUM |
| **Malicious Arbitrator** | Extract value through biased rulings | Resolve disputes, slash bonds | HIGH |
| **External Attacker** | Drain funds, DoS protocol | Contract interaction, frontrunning | HIGH |
| **Compromised Admin** | Extract value, brick protocol | Owner functions, pause, upgrade | CRITICAL |
| **MEV Bot** | Extract value through ordering | Transaction ordering, sandwiching | MEDIUM |

---

## 4. Threat Categories

### 4.1 Smart Contract Vulnerabilities

| ID | Threat | Impact | Likelihood | Mitigation | Status |
|----|--------|--------|------------|------------|--------|
| SC-1 | Reentrancy in bond withdrawal | CRITICAL | LOW | ReentrancyGuard on all external calls | MITIGATED |
| SC-2 | Signature replay attacks | HIGH | MEDIUM | ChainId + nonce in signature hash (IRSB-SEC-001, IRSB-SEC-006) | MITIGATED |
| SC-3 | Integer overflow/underflow | HIGH | LOW | Solidity 0.8+ checked arithmetic | MITIGATED |
| SC-4 | Front-running receipt posting | MEDIUM | HIGH | Commit-reveal not implemented; accepted risk | ACCEPTED |
| SC-5 | Flash loan attacks | HIGH | LOW | Bond lock duration prevents instant arbitrage | MITIGATED |

### 4.2 Economic Attacks

| ID | Threat | Impact | Likelihood | Mitigation | Status |
|----|--------|--------|------------|------------|--------|
| EC-1 | Griefing via false disputes | MEDIUM | MEDIUM | Challenger bond requirement, forfeiture on loss | MITIGATED |
| EC-2 | Bond drain via repeated slashing | HIGH | LOW | Minimum bond threshold, jail/ban system | MITIGATED |
| EC-3 | Sybil solver registration | LOW | MEDIUM | Minimum bond requirement creates economic barrier | MITIGATED |
| EC-4 | Arbitrator collusion | HIGH | LOW | Single arbitrator risk; v2 will add decentralized arbitration | ACCEPTED RISK |

### 4.3 Access Control

| ID | Threat | Impact | Likelihood | Mitigation | Status |
|----|--------|--------|------------|------------|--------|
| AC-1 | Unauthorized slashing | CRITICAL | LOW | Only authorized callers (hub, dispute module) can slash | MITIGATED |
| AC-2 | Admin key compromise | CRITICAL | LOW | Timelock + Multisig planned (A1-A3 tasks) | PENDING |
| AC-3 | Unauthorized pause | HIGH | LOW | Only owner can pause; Timelock will add delay | PENDING |
| AC-4 | Dispute party spoofing | HIGH | MEDIUM | Verify caller is challenger or solver operator (IRSB-SEC-002) | MITIGATED |

### 4.4 Denial of Service

| ID | Threat | Impact | Likelihood | Mitigation | Status |
|----|--------|--------|------------|------------|--------|
| DOS-1 | Block gas limit on batch operations | MEDIUM | LOW | Batch size limits in batchPostReceipts() | MITIGATED |
| DOS-2 | Spam disputes to overwhelm arbitrator | MEDIUM | MEDIUM | Challenger bond creates economic cost | MITIGATED |
| DOS-3 | Contract pause abuse | HIGH | LOW | Timelock will add delay and governance | PENDING |

### 4.5 Information Disclosure

| ID | Threat | Impact | Likelihood | Mitigation | Status |
|----|--------|--------|------------|------------|--------|
| ID-1 | Intent details leak | MEDIUM | HIGH | Hash-only on-chain, ciphertext pointer for V2 | MITIGATED |
| ID-2 | Solver strategy revelation | LOW | HIGH | Inherent blockchain transparency; accepted | ACCEPTED |

---

## 5. Attack Scenarios

### 5.1 Replay Attack (MITIGATED)

**Scenario:** Attacker captures valid receipt signature and replays on:
- Same chain (same contract)
- Different chain (cross-chain)
- Different hub contract (same chain)

**Mitigations:**
1. **IRSB-SEC-001:** ChainId and hub address in signature hash prevents cross-chain and cross-contract replay
2. **IRSB-SEC-006:** Per-solver nonce prevents same-chain replay

**Verification:** Tests `test_IRSB_SEC_001_*` and `testFuzz_ReceiptIdDeterministic` confirm protection.

### 5.2 Dispute Re-Challenge Attack (MITIGATED)

**Scenario:** Challenger opens dispute, loses, then immediately re-challenges to grief solver.

**Mitigation:** IRSB-SEC-003 - After dispute rejection, receipt is finalized (not returned to Pending).

**Verification:** Test `test_IRSB_SEC_003_rejectedDisputeCannotBeRechallenged` confirms behavior.

### 5.3 Zero-Slash Manipulation (MITIGATED)

**Scenario:** Arbitrator issues 1% slash on tiny bond, rounds to zero, but still triggers slashing flow.

**Mitigation:** IRSB-SEC-010 - If calculated slash amount rounds to zero, treat as no-fault.

**Verification:** Test `test_IRSB_SEC_010_zeroSlashTreatedAsNoFault` confirms behavior.

### 5.4 Non-Party Escalation DoS (MITIGATED)

**Scenario:** Third party escalates dispute to grief solver with arbitration fees.

**Mitigation:** IRSB-SEC-002 - Only challenger or solver operator can escalate disputes.

**Verification:** Test `test_IRSB_SEC_002_escalateRevertNonParty` confirms restriction.

### 5.5 Arbitrator Bias (ACCEPTED RISK)

**Scenario:** Single arbitrator colludes with challengers or solvers.

**Current State:** Single arbitrator model is centralized.

**Acceptance Rationale:**
- Distribution favors user (70% in arbitration, 80% in deterministic)
- Arbitrator timeout (7 days) provides default resolution
- Clear path to decentralized arbitration in v2

---

## 6. Security Controls Matrix

| Control | Type | Location | Coverage |
|---------|------|----------|----------|
| ReentrancyGuard | Technical | All contracts | All external value transfers |
| Ownable | Access Control | All contracts | Admin functions |
| Pausable | Operational | Hub, Registry, Extensions | Emergency stop |
| ChainId verification | Technical | Signature verification | Cross-chain replay |
| Nonce tracking | Technical | IntentReceiptHub | Same-chain replay |
| Minimum bond | Economic | SolverRegistry, Hub | Sybil, griefing |
| Withdrawal cooldown | Economic | SolverRegistry | Flash loan attacks |
| Jail/ban system | Economic | SolverRegistry | Repeated violations |
| Timelock | Governance | PENDING | Admin key protection |
| Multisig | Governance | PENDING | Admin key protection |

---

## 7. Invariants

These properties must always hold:

| ID | Invariant | Enforced By |
|----|-----------|-------------|
| SR-1 | Bond accounting never exceeds balance | SolverRegistry invariant tests |
| SR-2 | Locked balance <= total bond | lockBond() validation |
| SR-3 | Slash cannot exceed available bond | slash() caps amount |
| IRH-1 | Receipt IDs are unique | computeReceiptId() deterministic |
| IRH-6 | Slash distribution = 100% | Static BPS validation |
| IRH-7 | Valid status transitions only | State machine checks |
| EC-1 | No value creation | Withdrawal <= deposits |
| EC-2 | Challenger bond at risk | Bond > 0 enforcement |
| EC-3 | User compensation priority | User share > 50% |
| EC-4 | Loss bounded by bond | uint256 underflow protection |

---

## 8. Residual Risks

### High Priority (Action Required)

| Risk | Current State | Required Action | Owner |
|------|---------------|-----------------|-------|
| Admin key compromise | EOA ownership | Deploy Multisig + Timelock (A1-A3) | DevOps |

### Accepted Risks

| Risk | Rationale | Review Date |
|------|-----------|-------------|
| Single arbitrator | Clear v2 roadmap, timeouts provide safety valve | Q2 2026 |
| Receipt front-running | Commit-reveal adds complexity, low impact | Q3 2026 |
| On-chain data visibility | Fundamental blockchain property | N/A |

---

## 9. Monitoring Requirements

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Dispute rate per solver | > 5% of receipts | High dispute activity |
| Slash amount per day | > 1 ETH | Potential attack |
| Jail events | Any | Solver violation |
| Pause events | Any | Emergency action |
| Bond withdrawal spike | > 10 in 1 hour | Potential exit |
| Failed receipt postings | > 10% | Signature issues |

---

## 10. Incident Response

### Severity Levels

| Level | Definition | Response Time | Actions |
|-------|------------|---------------|---------|
| P0 | Active exploit, funds at risk | Immediate | Pause contracts, notify stakeholders |
| P1 | Vulnerability discovered, not exploited | < 4 hours | Assess, prepare patch, coordinate disclosure |
| P2 | Security concern, no immediate risk | < 24 hours | Document, plan remediation |

### Emergency Contacts

- Primary: Protocol Owner (Timelock proposer)
- Secondary: Arbitrator
- Escalation: Gnosis Safe signers

---

## 11. Review Schedule

| Review Type | Frequency | Next Date |
|-------------|-----------|-----------|
| Threat model update | Quarterly | April 2026 |
| Invariant test review | Per release | Next release |
| External audit | Major version | v2.0 |
| Penetration test | Annual | January 2027 |

---

## 12. References

- [IRSB Security Audit v1](009-AA-SEC-irsb-security-audit-v1.md)
- [Baseline Audit Report](024-PP-RPRT-baseline-audit-report.md)
- [INVARIANTS.md](../audit/INVARIANTS.md)
- [Incident Playbook](011-OD-GUID-incident-playbook.md)
- [Monitoring Guide](012-OD-GUID-monitoring-guide.md)

---

## Appendix A: STRIDE Analysis

| Category | Threat | Controls |
|----------|--------|----------|
| **Spoofing** | Fake solver signatures | ECDSA verification, operator registry |
| **Tampering** | Modified receipt data | Hash-based IDs, signature verification |
| **Repudiation** | Solver denies execution | On-chain receipts, event logs |
| **Information Disclosure** | Intent details leaked | Hash-only storage, V2 encryption |
| **Denial of Service** | Contract pause, dispute spam | Pausable, challenger bonds |
| **Elevation of Privilege** | Unauthorized admin actions | Ownable, Timelock (pending) |

---

*Document maintained by IRSB Protocol Security Team*
