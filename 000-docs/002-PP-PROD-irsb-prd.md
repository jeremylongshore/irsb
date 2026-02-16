# Product Requirements Document (PRD)
# IRSB — Intent Receipts & Solver Bonds

**Version:** 0.1.0
**Status:** Draft
**Author:** Jeremy Longshore
**Date:** 2026-01-13
**Last Updated:** 2026-01-13

---

## 1. Executive Summary

### 1.1 Problem Statement

The intent-based transaction ecosystem lacks a standardized accountability layer. While ERC-7683 standardizes cross-chain intents, there is no mechanism to:
- Verify that solvers executed intents as promised
- Economically penalize solvers for violations
- Compensate users when solvers fail

### 1.2 Proposed Solution

IRSB (Intent Receipts & Solver Bonds) provides:
- **Intent Receipts**: Canonical, on-chain records proving intent execution
- **Solver Bonds**: Staked collateral that can be slashed for violations
- **Deterministic Enforcement**: Automated slashing for provable violations

### 1.3 Value Proposition

| Stakeholder | Benefit |
|-------------|---------|
| Users | Economic protection against solver failures |
| Solvers | Reputation system for differentiation |
| Protocols | Standardized accountability integration |
| Ecosystem | Production-safe intent infrastructure |

---

## 2. Goals & Success Metrics

### 2.1 Primary Goals

1. **Standardize Intent Accountability** - Create canonical receipt format adopted by 3+ intent protocols
2. **Enable Economic Enforcement** - Deploy slashing mechanism with $1M+ in solver bonds
3. **Build Reputation Layer** - IntentScore adopted as standard solver quality metric

### 2.2 Key Performance Indicators (KPIs)

| Metric | Target (90 days) | Target (6 months) |
|--------|------------------|-------------------|
| Solver Registrations | 10 | 50 |
| Total Value Bonded | $100K | $1M |
| Intents Receipted | 1,000 | 100,000 |
| Dispute Rate | <5% | <2% |
| False Positive Slash Rate | <1% | <0.1% |

### 2.3 Non-Goals (v0.1)

- Subjective dispute resolution (defer to v0.2)
- Cross-chain receipt validation (single chain first)
- Solver discovery/matching (out of scope)

---

## 3. User Stories & Use Cases

### 3.1 User Personas

**Solver Operator**
- Operates solver infrastructure for intent protocols
- Wants to differentiate on reliability and speed
- Needs clear rules for participation and slashing

**Protocol Integrator**
- Building intent-based application (DEX, bridge, aggregator)
- Wants plug-and-play accountability layer
- Needs simple API and clear documentation

**End User**
- Submits intents through frontend
- Expects execution as specified
- Wants compensation if solver fails

### 3.2 User Stories

#### As a Solver Operator:
- [ ] I can register my solver with metadata and operator address
- [ ] I can deposit bond collateral to activate my solver
- [ ] I can post receipts for intents I execute
- [ ] I can withdraw unbonded funds after cooldown period
- [ ] I can view my IntentScore and dispute history

#### As a Protocol Integrator:
- [ ] I can verify solver bond status before routing intents
- [ ] I can query receipt status for any intent
- [ ] I can open disputes with evidence
- [ ] I can integrate deterministic slashing into my settlement flow

#### As an End User:
- [ ] I can verify my intent was receipted
- [ ] I receive compensation from solver bond if execution fails
- [ ] I can view solver reputation before accepting fills

---

## 4. Functional Requirements

### 4.1 Core Contracts

#### 4.1.1 SolverRegistry

| Function | Description | Access |
|----------|-------------|--------|
| `registerSolver(metadataURI, operatorAddr)` | Register new solver | Public |
| `depositBond(solverId, amount)` | Deposit collateral | Solver |
| `withdrawBond(solverId, amount)` | Withdraw (if no disputes) | Solver |
| `setSolverKey(solverId, newOperator)` | Rotate operator key | Solver |
| `getSolverStatus(solverId)` | Query status | Public (view) |

#### 4.1.2 IntentReceiptHub

| Function | Description | Access |
|----------|-------------|--------|
| `postReceipt(IntentReceipt)` | Post execution receipt | Solver |
| `openDispute(receiptId, reasonCode, evidence)` | Open dispute | Public |
| `resolveDeterministic(receiptId)` | Execute slashing | Internal |
| `finalize(receiptId)` | Mark settled | Internal |
| `getReceipt(receiptId)` | Query receipt | Public (view) |

#### 4.1.3 DisputeModule (v0.2)

| Function | Description | Access |
|----------|-------------|--------|
| `submitEvidence(disputeId, evidence)` | Add evidence | Parties |
| `escalate(disputeId)` | Escalate to arbitration | Parties |
| `resolve(disputeId, outcome)` | Resolve dispute | Arbitrator |

### 4.2 Data Structures

```solidity
struct IntentReceipt {
    bytes32 intentHash;
    bytes32 constraintsHash;
    bytes32 routeHash;
    bytes32 outcomeHash;
    bytes32 evidenceHash;
    uint64 createdAt;
    uint64 expiry;
    bytes32 solverId;
    bytes solverSig;
}

struct Solver {
    address operator;
    string metadataURI;
    uint256 bondBalance;
    uint256 lockedBalance;
    SolverStatus status;
    IntentScore score;
}

enum SolverStatus {
    Inactive,
    Active,
    Jailed,
    Banned
}
```

### 4.3 Events

```solidity
event SolverRegistered(bytes32 indexed solverId, address operator);
event BondDeposited(bytes32 indexed solverId, uint256 amount);
event BondWithdrawn(bytes32 indexed solverId, uint256 amount);
event ReceiptPosted(bytes32 indexed receiptId, bytes32 indexed intentHash, bytes32 solverId);
event DisputeOpened(bytes32 indexed receiptId, uint8 reasonCode);
event SolverSlashed(bytes32 indexed solverId, uint256 amount, bytes32 receiptId);
event ReceiptFinalized(bytes32 indexed receiptId);
```

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target |
|-------------|--------|
| Receipt posting gas | <100K gas |
| Receipt query latency | <100ms |
| Dispute resolution time | <1 hour (deterministic) |

### 5.2 Security

- [ ] Formal verification of slashing logic
- [ ] Audit by 2+ reputable firms
- [ ] Bug bounty program ($50K+ pool)
- [ ] Emergency pause mechanism
- [ ] Upgradeable with timelock

### 5.3 Scalability

- Support 10K+ receipts/day on mainnet
- L2 deployment for high-volume use cases
- Batch receipt posting for efficiency

---

## 6. Technical Architecture

### 6.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         IRSB Protocol                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │   Solver     │───▶│  IntentReceipt   │◀───│   Protocol   │  │
│  │   Registry   │    │      Hub         │    │  Integrator  │  │
│  └──────────────┘    └──────────────────┘    └──────────────┘  │
│         │                    │                      │           │
│         ▼                    ▼                      ▼           │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │    Bonds     │    │    Disputes      │    │   Evidence   │  │
│  │   (Staked)   │    │   (Slashing)     │    │   (IPFS)     │  │
│  └──────────────┘    └──────────────────┘    └──────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Integration Points

| Integration | Method | Notes |
|-------------|--------|-------|
| ERC-7683 | intentHash derivation | Standard order struct |
| IPFS/Arweave | evidenceHash storage | Off-chain evidence |
| The Graph | Receipt indexing | Query API |
| Chainlink | Price feeds | Slashing calculations |

---

## 7. Implementation Plan

### 7.1 Phase 1: MVP (Days 0-30)

| Week | Deliverables |
|------|--------------|
| 1 | Receipt schema finalization, contract scaffolding |
| 2 | SolverRegistry implementation + tests |
| 3 | IntentReceiptHub implementation + tests |
| 4 | Deterministic slashing logic, testnet deployment |

### 7.2 Phase 2: Integration (Days 31-60)

| Week | Deliverables |
|------|--------------|
| 5-6 | First protocol integration (ERC-7683 compatible) |
| 7 | Evidence bundling pipeline |
| 8 | Basic reputation counters, subgraph |

### 7.3 Phase 3: Production (Days 61-90)

| Week | Deliverables |
|------|--------------|
| 9-10 | Security audit |
| 11 | DisputeModule interface (pluggable) |
| 12 | Mainnet deployment, documentation |

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Smart contract vulnerability | Critical | Medium | Audits, formal verification, bug bounty |
| Low solver adoption | High | Medium | Incentive program, easy integration |
| False positive slashing | High | Low | Conservative thresholds, appeal process |
| Gas costs too high | Medium | Medium | L2 deployment, batching |
| Regulatory uncertainty | Medium | Low | Legal review, compliant design |

---

## 9. Open Questions

1. **Bond token**: ETH only or multi-token support?
2. **Slashing distribution**: User compensation vs. protocol treasury vs. burn?
3. **Reputation decay**: Time-weighted or volume-weighted scoring?
4. **Cross-chain**: Bridge receipts or L2-native deployment?

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|------|------------|
| Intent | User's desired outcome (not specific execution path) |
| Solver | Entity that executes intents for users |
| Receipt | Proof that solver executed an intent |
| Bond | Collateral staked by solver |
| Slashing | Penalty for provable violations |

### 10.2 References

- [ERC-7683: Cross Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)
- [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702)
- [UniswapX](https://docs.uniswap.org/contracts/uniswapx/overview)
- [Across Protocol](https://docs.across.to/)

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Security | | | |
