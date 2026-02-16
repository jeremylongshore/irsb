# ADR-009: IRSB vNext - Agent Trust Layer Scope

**Status:** Accepted
**Date:** 2026-01-28
**Authors:** Jeremy Longshore
**Supersedes:** None

---

## Context

IRSB (Intent Receipts & Solver Bonds) v1 is deployed on Sepolia with:
- 3 core contracts (~900 SLOC)
- 127 passing tests
- Functioning SDK, subgraph, and dashboard
- Active testnet users

The protocol provides accountability for intent-based transactions through receipts, bonds, and deterministic disputes. However, v1 has limitations:

1. **Single-party attestation**: Only solver signs receipts
2. **No escrow primitive**: Settlement happens outside the protocol
3. **Limited dispute flexibility**: No optimistic challenge flow with counter-bonds
4. **No privacy model**: All receipt data is public on-chain
5. **No external validation signals**: Cannot feed outcomes to other systems

vNext addresses these gaps to position IRSB as the **credible accountability engine** for agent/intent commerce.

---

## Decision

We will extend IRSB through **additive modules** without breaking existing functionality:

### Core Extensions

| Component | Purpose |
|-----------|---------|
| `ReceiptV2Extension` | Dual attestation (solver + client), metadata commitments, EIP-712 signatures |
| `EscrowVault` | Hold funds tied to receipt lifecycle; release on finalize, refund on dispute |
| `OptimisticDisputeModule` | Counter-bond mechanism with timeout-based default resolution |
| `ERC8004Adapter` | Emit validation signals consumable by external registries |
| `x402 Integration Pack` | TypeScript library for HTTP 402 payment → IRSB receipt flow |

### Design Principles

1. **Additive, not breaking**: All v1 functions remain unchanged
2. **Modular deployment**: Extensions can be deployed independently
3. **Privacy by design**: Commitments on-chain, plaintext off-chain
4. **Role-gated access**: Strict authorization between modules

---

## Hard Constraints (Cannot Break)

### Existing Deployment
- Sepolia contracts must remain functional
- SDK must continue working with v1 receipts
- Subgraph must index existing events
- Dashboard must display existing data

### Contract Guarantees
- **No breaking changes** to public function signatures
- **No storage layout changes** in existing contracts
- Existing 127 tests must pass
- No proxy upgrades (deploy new modules with migration paths)

### Security Invariants
- Never emit private data in events
- All ETH transfers use CEI pattern
- Access control via OpenZeppelin patterns (AccessControl, Pausable)
- Slashing math sums to 100%

### Test Requirements
- All existing tests pass
- New features have unit + fuzz tests
- Fuzz tests run at 10,000 iterations in CI

---

## New Attack Surfaces

### EscrowVault
| Threat | Mitigation |
|--------|------------|
| Reentrancy on release/refund | ReentrancyGuard, CEI pattern |
| ERC20 token quirks (fee-on-transfer, rebasing) | SafeERC20, explicit amount tracking |
| Double-release | Status enum prevents repeat operations |
| Escrow-receipt mismatch | escrowId → receiptId immutable link |

### EIP-712 Signatures (ReceiptV2)
| Threat | Mitigation |
|--------|------------|
| Cross-chain replay | chainId in domain separator |
| Cross-contract replay | verifyingContract in domain separator |
| Signature malleability | Use OpenZeppelin ECDSA.recover |
| Missing client signature | Explicit clientSig validation |

### Optimistic Disputes
| Threat | Mitigation |
|--------|------------|
| Counter-bond timing attacks | Fixed 24h window, permissionless timeout resolution |
| Griefing via false challenges | Challenger bond requirement |
| Arbitrator collusion | Transparent on-chain rulings, timeout defaults |

### Privacy Pointers
| Threat | Mitigation |
|--------|------------|
| CID injection/overflow | Max 64 chars, alphanumeric + base58 validation |
| Zero commitment bypass | Reject zero-value commitments |
| Commitment preimage exposure | Never store preimage on-chain |

---

## New Invariants

### EscrowVault Invariants

**EV-1: Balance Consistency**
```
∀ escrow: escrows[id].amount <= address(this).balance (for native)
∀ escrow: escrows[id].amount <= IERC20(token).balanceOf(address(this)) (for ERC20)
```

**EV-2: Status Finality**
```
∀ escrow: escrow.status ∈ {Released, Refunded} → status cannot change
```

**EV-3: Receipt Linkage**
```
∀ escrow: escrow.receiptId != 0 → receipts[escrow.receiptId].escrowId == escrow.id
```

### ReceiptV2 Invariants

**RV2-1: Dual Signature Requirement**
```
∀ receiptV2: validReceipt →
  ecrecover(hash, solverSig) == solver.operator ∧
  ecrecover(hash, clientSig) == expectedClient
```

**RV2-2: Commitment Non-Zero**
```
∀ receiptV2: receiptV2.metadataCommitment != bytes32(0)
```

**RV2-3: Privacy Level Immutability**
```
∀ receiptV2: posted → privacyLevel cannot change
```

### OptimisticDispute Invariants

**OD-1: Counter-Bond Timing**
```
∀ dispute: dispute.status == Open →
  postCounterBond() only valid if block.timestamp <= dispute.counterBondDeadline
```

**OD-2: Timeout Resolution**
```
∀ dispute: dispute.status == Open ∧ block.timestamp > dispute.counterBondDeadline →
  resolveByTimeout() can be called by anyone → challenger wins
```

**OD-3: Bond Accounting**
```
∀ dispute: challengerBond + counterBond == total bonds held for dispute
```

---

## Alternatives Considered

### Option A: Upgrade Existing Contracts via Proxy
**Rejected**: Adds complexity, requires migration of existing state, higher audit surface.

### Option B: Replace All Contracts
**Rejected**: Breaks existing deployment, loses accumulated reputation/receipts.

### Option C: Additive Extension Modules (Selected)
**Accepted**: Preserves v1 functionality, enables gradual migration, easier auditing.

---

## Phase Delivery Plan

| Phase | Branch | Scope |
|-------|--------|-------|
| 0 | `feature/ph0-adr-and-issues` | ADR, GitHub scaffolding, tracking issues |
| 1 | `feature/ph1-receipts-v2-dual-attestation` | ReceiptV2Extension, dual signatures, EIP-712 |
| 2 | `feature/ph2-escrow-vault` | EscrowVault, Hub integration |
| 3 | `feature/ph3-disputes-optimistic` | OptimisticDisputeModule, counter-bonds |
| 4 | `feature/ph4-lit-commitments-sdk` | Privacy pointers, SDK helpers |
| 5 | `feature/ph5-erc8004-adapter` | Validation registry adapter |
| 6 | `feature/ph6-polygon-amoy-deploy` | Multi-chain deployment |
| 7 | `feature/ph7-ops-hardening` | Monitoring, fuzz CI, runbooks |
| 8 | `feature/ph8-x402-integration-pack` | x402 ↔ IRSB TypeScript integration |

---

## Consequences

### Positive
- Existing users unaffected
- New features opt-in
- Modular auditing (each extension auditable independently)
- Clear migration path for power users

### Negative
- More contracts to maintain
- SDK must support both v1 and v2 patterns
- Subgraph requires additive schema changes

### Risks
- Feature fragmentation if adoption splits between v1/v2
- Complexity in coordinating extension modules
- Increased gas costs for v2 receipts (dual signatures)

---

## References

- [ERC-7683 Cross Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)
- [EIP-712 Typed Structured Data Hashing](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-8004 Validation Provider](https://eips.ethereum.org/EIPS/eip-8004)
- Protocol Spec: `000-docs/001-RL-PROP-irsb-solver-accountability.md`
- Receipt Schema: `000-docs/007-AT-SPEC-irsb-receipt-schema.md`
- Threat Model: `audit/THREAT-MODEL.md`
- Invariants: `audit/INVARIANTS.md`
