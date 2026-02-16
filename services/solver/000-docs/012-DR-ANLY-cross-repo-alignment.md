# Cross-Repo Alignment Analysis: IRSB Protocol, Watchtower, and Solver

**Document ID:** 012-DR-ANLY-cross-repo-alignment
**Status:** Active
**Created:** 2026-02-05
**Timezone:** America/Chicago

---

## 1. Purpose

This document analyzes alignment between the three IRSB repositories to ensure the solver implementation correctly integrates with the protocol contracts and watchtower monitoring.

## 2. Repository Responsibilities

| Repo | Role | Key Outputs |
|------|------|-------------|
| **irsb-protocol** | On-chain contracts, schemas, settlement | `IntentReceipt`, `SolverRegistry`, dispute primitives |
| **irsb-watchtower** | Monitoring, violation detection, auto-actions | `Finding`, rule engine, `ActionExecutor` |
| **irsb-solver** | Reference executor | Evidence bundles, receipts, policy enforcement |

## 3. Schema Alignment

### 3.1 Intent Receipt (Protocol → Solver)

The solver MUST produce receipts matching `Types.IntentReceipt`:

```solidity
struct IntentReceipt {
    bytes32 intentHash;      // Hash of original intent
    bytes32 constraintsHash; // Hash of ConstraintEnvelope
    bytes32 routeHash;       // Hash of execution route
    bytes32 outcomeHash;     // Hash of OutcomeEnvelope
    bytes32 evidenceHash;    // IPFS/Arweave CID of evidence bundle
    uint64 createdAt;        // Receipt creation timestamp
    uint64 expiry;           // Deadline for settlement proof
    bytes32 solverId;        // Unique solver identifier
    bytes solverSig;         // Solver's signature over receipt
}
```

**Solver Requirements:**
- Compute `constraintsHash` via `keccak256(abi.encode(ConstraintEnvelope))`
- Compute `outcomeHash` via `keccak256(abi.encode(OutcomeEnvelope))`
- Sign receipts using EIP-712 typed data
- Use `createdAt` = block.timestamp at execution (NOT local wall clock)

### 3.2 ID Computation (Critical Alignment)

**receiptId** (used by all three repos):
```solidity
receiptId = keccak256(abi.encode(intentHash, solverId, createdAt))
```

**solverId** (assigned at registration):
```solidity
solverId = keccak256(abi.encodePacked(operator, block.timestamp, totalSolvers))
```

**Solver Requirements:**
- Store `solverId` from registration and reuse it
- Compute `receiptId` deterministically for deduplication
- Include `receiptId` in evidence manifests

### 3.3 Evidence Hash Expectations

The protocol expects `evidenceHash` to be a content-addressed pointer:
- IPFS CID (QmXXX...)
- Arweave TX ID
- Or other content-addressed storage

**Solver Requirements:**
- Hash evidence bundle deterministically before upload
- Store hash in receipt before posting
- Evidence MUST be retrievable for dispute verification

## 4. Watchtower Integration Points

### 4.1 Finding → Solver Correlation

Watchtower produces Findings with these fields solver must understand:

| Finding Field | Solver Relevance |
|---------------|------------------|
| `receiptId` | Maps to solver's receipt |
| `solverId` | Identifies the solver |
| `intentHash` | Maps to original intent |
| `recommendedAction` | What watchtower suggests |

### 4.2 Action Types

Watchtower may take these actions that affect solver:

| Action | Effect on Solver |
|--------|------------------|
| `OPEN_DISPUTE` | Solver must respond with evidence |
| `SUBMIT_EVIDENCE` | Watchtower submitting against solver |
| `NOTIFY` | Informational, no direct effect |

### 4.3 Rule Categories

Watchtower rules the solver should be aware of:

| Category | Example Rule | Solver Defense |
|----------|--------------|----------------|
| RECEIPT | `ReceiptStaleRule` | Finalize receipts promptly |
| BOND | Bond below minimum | Maintain adequate bond |
| DISPUTE | Dispute timeout approaching | Respond to disputes in time |

## 5. Naming Conventions

### 5.1 Consistent Naming Across Repos

| Concept | Protocol | Watchtower | Solver (Target) |
|---------|----------|------------|-----------------|
| Receipt hash | `receiptId` | `receiptId` | `receiptId` |
| Solver ID | `solverId` | `solverId` | `solverId` |
| Intent reference | `intentHash` | `intentHash` | `intentHash` |
| Evidence pointer | `evidenceHash` | (in metadata) | `evidenceHash` |

### 5.2 TypeScript Type Naming

The solver should mirror protocol's TypeScript types (from SDK):

```typescript
// Matches protocol SDK
interface IntentReceipt {
  intentHash: string;      // bytes32 as 0x-prefixed hex
  constraintsHash: string;
  routeHash: string;
  outcomeHash: string;
  evidenceHash: string;
  createdAt: bigint;       // uint64
  expiry: bigint;
  solverId: string;
  solverSig: string;       // bytes as hex
}
```

## 6. Hashing Expectations

### 6.1 Canonical JSON for Off-Chain Data

All repos expect deterministic hashing. The solver MUST:

1. **Sort object keys alphabetically**
2. **Use consistent numeric formatting** (no floats in hashed content)
3. **Exclude wall-clock timestamps** from hashed artifacts
4. **Use UTF-8 encoding**

### 6.2 EIP-712 Signature Domain

The protocol uses EIP-712 for receipt signatures:

```solidity
// Expected domain
bytes32 DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);
```

Solver must match:
- `name`: "IntentReceiptHub"
- `version`: "1"
- `chainId`: Target chain ID
- `verifyingContract`: IntentReceiptHub address

## 7. Contract Addresses (Sepolia)

All three repos reference these addresses:

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## 8. Timing Parameters

| Parameter | Value | Solver Implication |
|-----------|-------|-------------------|
| CHALLENGE_WINDOW | 1 hour | Receipts finalize after 1hr if no dispute |
| WITHDRAWAL_COOLDOWN | 7 days | Bond locked for 7 days after withdrawal request |
| MINIMUM_BOND | 0.1 ETH | Solver must maintain this to be Active |
| COUNTER_BOND_WINDOW | 24 hours | Time to counter optimistic disputes |

## 9. Identified Mismatches

### 9.1 No Current Mismatches

After analysis, the three repos are well-aligned on:
- Schema definitions
- ID computation
- Naming conventions
- Timing parameters

### 9.2 Areas Requiring Solver Attention

| Area | Note |
|------|------|
| **Determinism** | Solver must ensure all hashed content is reproducible |
| **Evidence format** | Not yet specified - solver should propose a standard |
| **Run ID** | Solver introduces `runId = hash(intentId + jobType + inputs)` - not used by protocol/watchtower |

## 10. Recommendations

1. **Define Evidence Bundle Schema**
   - Solver should propose a standard evidence bundle format
   - Document in `000-docs/` and share with watchtower for verification

2. **Use Protocol SDK**
   - Import types from `@irsb/sdk` when available
   - Avoid duplicating struct definitions

3. **Match Watchtower Finding Fields**
   - Include `intentHash`, `receiptId`, `solverId` in all logs
   - Enable correlation with watchtower findings

4. **Test Against Protocol Fakes**
   - Use protocol's test fixtures where available
   - Ensure hash computation matches contract expectations

---

## Revision History

| Date | Change |
|------|--------|
| 2026-02-05 | Initial cross-repo alignment analysis |

---

*End of Document*
