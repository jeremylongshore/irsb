# IRSB Global Accountability Layer + ERC-8004 Integration Plan

**Author:** CTO
**Date:** 2026-02-07
**Status:** Approved for Implementation

## Executive Summary

IRSB aims to become **Ethereum's global accountability layer for intent-based transactions**. ERC-8004 is the emerging standard for agent identity and reputation. This plan details how they integrate to create the definitive trust infrastructure.

## Strategic Position

```text
                    ┌─────────────────────────────────────┐
                    │       IRSB: Global Accountability   │
                    │       "Stamp of Approval"           │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────────┐   ┌─────────────────────────┐   ┌───────────────────┐
│   ERC-7683        │   │      ERC-8004           │   │   Intent Infra    │
│   Cross-Chain     │   │   Agent Identity        │   │   (Across, CoW,   │
│   Intents         │   │   & Reputation          │   │    UniswapX)      │
└───────────────────┘   └─────────────────────────┘   └───────────────────┘
```

**Key insight:** IRSB doesn't compete with ERC-8004. IRSB is the **scoring methodology** that feeds ERC-8004 for intent-related reputation.

## The Three Layers

| Layer | Standard/System | What It Does | IRSB Role |
|-------|-----------------|--------------|-----------|
| **Identity** | ERC-8004 Identity Registry | Store agent NFTs, resolve agentURI | Consumer: verify solver identity |
| **Signals** | ERC-8004 Reputation Registry | Store raw feedback signals | Producer: publish validation signals |
| **Scoring** | IRSB CredibilityRegistry | Compute weighted IntentScore | Owner: authoritative scoring for intents |

## IntentScore: The Differentiator

ERC-8004 stores raw signals but **intentionally doesn't aggregate them**. This is by design - different use cases need different aggregation logic.

IRSB provides the **authoritative aggregation for intent execution**:

```text
IntentScore Formula:
  40% × Success Rate (finalized receipts / total)
+ 25% × Dispute Win Rate (wins + 50% partials)
+ 20% × Stake Factor (bond commitment)
+ 15% × Longevity (time in network, activity)
- Slash Penalty (5% per slash, max 30%)
= 0-10000 basis points
```

**Why this matters:**
1. Other protocols can query IRSB for intent-specific reputation
2. IRSB signals flow to ERC-8004 for cross-protocol visibility
3. A solver's UniswapX reputation + CoW reputation + IRSB reputation can be aggregated by off-chain services

## Implementation Status

### Completed

| Component | Lines | Location | Description |
|-----------|-------|----------|-------------|
| CredibilityRegistry.sol | 450+ | protocol/src/ | On-chain IntentScore computation |
| ERC8004Adapter.sol | 350 | protocol/src/adapters/ | On-chain signal emission |
| adapter.ts | 400+ | agent-passkey/src/erc8004/ | Off-chain ERC-8004 integration |
| ADR-001 | 150 | 000-docs/ | Integration strategy documentation |

### Ready to Enable

```bash
# To enable ERC-8004 integration:
export ERC8004_ENABLED=true
export ERC8004_NETWORK=sepolia  # or mainnet
export ERC8004_RPC_URL=https://...
export ERC8004_PRIVATE_KEY=0x...  # For publishing signals
```

### Phase 1: Signal Publishing (Week 1-2)

| Task | Owner | Status |
|------|-------|--------|
| Wire IntentReceiptHub → ERC8004Adapter.signalFinalized() | Protocol | Ready |
| Wire DisputeModule → ERC8004Adapter.signalDisputeWon/Lost() | Protocol | Ready |
| Wire SolverRegistry → ERC8004Adapter.signalSlashed() | Protocol | Ready |
| Enable ERC8004_ENABLED in staging | DevOps | TODO |
| Monitor signal emission in Sepolia | DevOps | TODO |
| Gas analysis for signal emission | Protocol | TODO |

### Phase 2: Reputation Consumption (Week 3-4)

| Task | Owner | Status |
|------|-------|--------|
| Implement bond modifier in SolverRegistry | Protocol | TODO |
| Query ERC-8004 reputation during registration | Protocol | TODO |
| Add cross-protocol reputation to dashboard | Frontend | TODO |
| Leaderboard: include ERC-8004 aggregate | Protocol | TODO |

### Phase 3: Identity Linking (Week 5-6)

| Task | Owner | Status |
|------|-------|--------|
| Link solverId → agentId mapping | Protocol | TODO |
| Verify solver controls agentWallet | agent-passkey | Ready |
| Cross-chain reputation proofs | Protocol | Designed |
| Multi-chain IntentScore sync | Protocol | Designed |

## Signal Flow Diagram

```text
IRSB Event                       ERC-8004 Signal              Value
───────────────────────────────────────────────────────────────────
Receipt finalized (no dispute) → validationResponse()        +100
Dispute opened against solver  → giveFeedback()               -10
Dispute won by solver          → validationResponse()         +90
Dispute lost, minor slash      → validationResponse()         +30
Dispute lost, full slash       → validationResponse()           0
Solver jailed                  → giveFeedback()               -50
```

## Bond Modifier Table

| ERC-8004 Avg Score | Bond Modifier | Effective Bond | Reasoning |
|--------------------|---------------|----------------|-----------|
| 90-100 | 0.5× | 0.05 ETH | Excellent cross-protocol reputation |
| 70-89 | 0.75× | 0.075 ETH | Good cross-protocol reputation |
| 50-69 | 1.0× | 0.1 ETH | Standard (moderate history) |
| 30-49 | 1.5× | 0.15 ETH | Elevated (low reputation) |
| 0-29 | 2.0× | 0.2 ETH | Maximum (poor reputation) |
| No history | 1.0× | 0.1 ETH | Standard (new solver, no cross-protocol data) |

## ERC-8004 Contract Addresses

### Sepolia (Current IRSB Network)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Mainnet (Future)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## Gas Estimates

| Operation | Estimated Gas | Cost @ 30 gwei |
|-----------|---------------|----------------|
| giveFeedback (signal) | ~80,000 | ~0.0024 ETH |
| getSummary (query) | ~20,000 | Read-only |
| tokenURI (query) | ~10,000 | Read-only |

**Cost analysis:** At ~3 signals per successful intent (submit, finalize, potential dispute), signal publishing costs ~0.007 ETH per intent. This is acceptable for the network effect benefit.

## Success Metrics

| Metric | Target (Month 1) | Target (Month 3) | Target (Month 6) |
|--------|------------------|------------------|------------------|
| Signals published to ERC-8004 | 100 | 1,000 | 10,000 |
| Solvers with ERC-8004 identity | 10 | 50 | 200 |
| Cross-protocol reputation queries | 50 | 500 | 5,000 |
| Reputation-weighted bonds issued | 10 | 100 | 1,000 |

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ERC-8004 contracts upgraded | Low | Medium | Adapter pattern isolates changes |
| Gas costs too high | Medium | Medium | Batch signals, L2 deployment |
| ERC-8004 adoption stalls | Low | High | IRSB works standalone, ERC-8004 is optional enrichment |
| Reputation gaming | Medium | Medium | Require minimum history, detect anomalies |

## Next Steps

1. **Immediate:** Enable ERC8004_ENABLED in staging environment
2. **Week 1:** Deploy signal wiring in protocol contracts
3. **Week 2:** Monitor and tune signal publishing
4. **Week 3:** Implement bond modifier consumption
5. **Week 4:** Launch cross-protocol reputation in dashboard
6. **Month 2:** Production mainnet deployment

## Appendix: Code Locations

| File | Purpose |
|------|---------|
| `protocol/src/CredibilityRegistry.sol` | IntentScore computation |
| `protocol/src/adapters/ERC8004Adapter.sol` | On-chain signal emission |
| `protocol/src/interfaces/ICredibilityRegistry.sol` | Reputation types |
| `agent-passkey/src/erc8004/adapter.ts` | Off-chain integration |
| `000-docs/001-DR-ADR-intentscore-erc8004-integration.md` | Decision record |

---

**Approved by:** CTO
**Implementation Start:** Immediate
