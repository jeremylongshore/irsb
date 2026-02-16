# ADR-001: IntentScore and ERC-8004 Integration Strategy

**Status:** Approved
**Date:** 2026-02-07
**Author:** CTO
**Deciders:** Engineering Leadership

## Context

IRSB has a comprehensive on-chain reputation system (CredibilityRegistry with IntentScore). ERC-8004 is an emerging standard with three registries (Identity, Reputation, Validation). Initial confusion arose about overlap between IRSB's scoring and ERC-8004's "0-100 scale."

## Decision

**IRSB IntentScore and ERC-8004 are complementary, not competing.**

### Key Insight

| Layer | ERC-8004 | IRSB |
|-------|----------|------|
| **Data Collection** | Reputation/Validation Registries collect raw signals | CredibilityRegistry collects IRSB-specific events |
| **Aggregation** | None (intentionally left to off-chain aggregators) | On-chain IntentScore algorithm (weighted composite) |
| **Score Output** | Individual signals (0-100 per event) | Aggregate score (0-10000 basis points) |

### Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ERC-8004 (Signal Registry)                   │
│  - Stores raw validation signals from many providers            │
│  - No aggregation logic                                         │
│  - Enables cross-protocol reputation portability                │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────────┐     ┌─────────────────────────────────────┐
│  IRSB Publishes     │     │  IRSB Consumes                      │
│  - Receipt finalized│     │  - Query cross-protocol reputation  │
│  - Dispute outcomes │     │  - Reputation-weighted bonds        │
│  - Slash events     │     │  - Trust bootstrapping              │
└─────────────────────┘     └─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 IRSB CredibilityRegistry                        │
│  - Computes IntentScore from IRSB-specific data                 │
│  - Weights: 40% success, 25% disputes, 20% stake, 15% longevity │
│  - Maintains leaderboard (top 100)                              │
│  - Cross-chain reputation proofs                                │
└─────────────────────────────────────────────────────────────────┘
```

## Signal Flow

### IRSB → ERC-8004 (Publishing)

When IRSB events occur, publish validation signals to ERC-8004:

| IRSB Event | ERC-8004 Signal | Value |
|------------|-----------------|-------|
| Receipt finalized (no dispute) | `validationResponse` | 100 |
| Dispute opened against solver | `giveFeedback` | -10 |
| Dispute won by solver | `validationResponse` | 90 |
| Dispute lost, minor slash | `validationResponse` | 30 |
| Dispute lost, full slash | `validationResponse` | 0 |
| Solver jailed | `giveFeedback` | -50 |

### ERC-8004 → IRSB (Consuming)

Query ERC-8004 for cross-protocol reputation:

| Use Case | ERC-8004 Query | IRSB Action |
|----------|----------------|-------------|
| New solver registration | `getSummary(agentId)` | Reputation-weighted initial bond |
| High-value intent | `getReputation(agentId)` | Require minimum cross-protocol score |
| Trust bootstrapping | `getValidationStatus()` | Accept validated agents faster |

## Score Mapping

### IRSB IntentScore → ERC-8004 Signal

IRSB uses 0-10000 basis points internally. When publishing to ERC-8004:

```text
ERC-8004 Signal = IRSB IntentScore / 100

Example: IntentScore 7,850 → ERC-8004 Signal 78
```

### ERC-8004 Reputation → IRSB Bond Modifier

When consuming ERC-8004 reputation for bond calculation:

| ERC-8004 Avg Score | Bond Modifier | Effective Bond |
|--------------------|---------------|----------------|
| 90-100 | 0.5x | 0.05 ETH |
| 70-89 | 0.75x | 0.075 ETH |
| 50-69 | 1.0x | 0.1 ETH (standard) |
| 30-49 | 1.5x | 0.15 ETH |
| 0-29 | 2.0x | 0.2 ETH |
| No history | 1.0x | 0.1 ETH |

## Implementation Phases

### Phase 1: Signal Publishing (H1 Hardening)

1. Enable ERC8004Adapter signal emission (already deployed)
2. Implement off-chain adapter in agent-passkey
3. Configure IntentReceiptHub to trigger signals on finalization
4. Configure DisputeModule to trigger signals on resolution

### Phase 2: Signal Consumption (H2 Hardening)

1. Query ERC-8004 reputation during solver registration
2. Implement bond modifier calculation
3. Add cross-protocol reputation to leaderboard display
4. Enable reputation portability proofs

### Phase 3: Cross-Chain Identity (H3)

1. Link IRSB solverId to ERC-8004 agentId
2. Cross-chain reputation aggregation
3. Multi-chain IntentScore proofs

## Consequences

### Positive

- IRSB becomes authoritative scoring layer for intent reputation
- Cross-protocol reputation enables trust bootstrapping
- ERC-8004 integration positions IRSB as industry standard
- No duplication - each system does what it's best at

### Negative

- Additional gas costs for ERC-8004 signal emission
- Dependency on ERC-8004 contract availability
- Complexity in cross-chain reputation sync

### Mitigations

- ERC8004Adapter already designed to fail gracefully (non-blocking)
- Signals are optional enrichment, not critical path
- Cross-chain proofs use existing oracle infrastructure

## References

- EIP-8004: https://eips.ethereum.org/EIPS/eip-8004
- IRSB CredibilityRegistry: `protocol/src/CredibilityRegistry.sol`
- ERC8004Adapter: `protocol/src/adapters/ERC8004Adapter.sol`
- Off-chain adapter: `agent-passkey/src/erc8004/adapter.ts`
