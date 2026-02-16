# 032-DR-ADDM-cross-repo-alignment-solver-watchtower-protocol

**Document ID:** 032-DR-ADDM-cross-repo-alignment-solver-watchtower-protocol
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This document captures alignment between irsb-solver, irsb-watchtower, and irsb-protocol repositories. It identifies shared fields, expected behaviors, and any mismatches requiring attention.

---

## 1. Repository Roles

| Repository | Role | Primary Concern |
|------------|------|-----------------|
| **irsb-protocol** | On-chain contracts, schemas, settlement | Intent schema, receipt format, chain interaction |
| **irsb-solver** | Off-chain executor | Run intents, produce evidence, format receipts |
| **irsb-watchtower** | Indexer, monitor | Track events, index receipts, alert on anomalies |

---

## 2. Shared Identifiers

### 2.1 Fields Solver Produces

| Field | Source | Format | Notes |
|-------|--------|--------|-------|
| `intentId` | SHA-256 of canonical intent JSON | 64-char hex | Stable, deterministic |
| `runId` | Same as intentId (currently) | 64-char hex | May diverge if re-execution allowed |
| `jobType` | From intent.jobType | String | Must match protocol allowlist |
| `status` | Execution result | `SUCCESS` / `FAILED` / `REFUSED` | |
| `manifestSha256` | SHA-256 of manifest JSON | 64-char hex | Evidence integrity |

### 2.2 Fields Watchtower Needs to Index

| Field | Purpose | Source |
|-------|---------|--------|
| `intentId` | Primary key for intent tracking | Solver evidence |
| `runId` | Execution instance | Solver evidence |
| `receiptId` | Receipt tracking (future) | Solver receipt |
| `manifestSha256` | Evidence verification | Solver manifest |
| `status` | Outcome tracking | Solver evidence |
| `jobType` | Category filtering | Solver evidence |
| `createdAt` | Temporal queries | Solver manifest |

### 2.3 Fields Protocol Expects

| Field | Purpose | Notes |
|-------|---------|-------|
| `intentId` | Match to on-chain intent | Must use same hash algorithm |
| `receiptId` | Settlement claim | May be derived or assigned |
| `evidenceHash` | Proof of execution | Should be manifestSha256 |
| `solver` | Executor identity | From ERC-8004 agentId |

---

## 3. Current Alignment Status

### 3.1 Aligned

| Aspect | Status | Notes |
|--------|--------|-------|
| Intent ID derivation | ✅ Aligned | SHA-256 of canonical JSON |
| Evidence hashing | ✅ Aligned | SHA-256 for all artifacts |
| Job type format | ✅ Aligned | SCREAMING_SNAKE_CASE |
| Status values | ✅ Aligned | SUCCESS/FAILED/REFUSED |

### 3.2 Needs Verification

| Aspect | Status | Action |
|--------|--------|--------|
| Receipt format | ⚠️ Not implemented | Define schema in protocol, implement in solver |
| Chain submission | ⚠️ Stubbed | Implement in future phase |
| Event structure | ⚠️ Unknown | Verify watchtower event format |

### 3.3 Known Mismatches

| Mismatch | Description | Resolution |
|----------|-------------|------------|
| None critical | - | - |

---

## 4. ERC-8004 Discovery Mapping

| Solver Feature | ERC-8004 Field | Notes |
|----------------|----------------|-------|
| Service name | `agentId` | `irsb-solver@0.1.0` |
| Capabilities | `capabilities` | `["intent-execution", "evidence-generation", "receipt-submission"]` |
| Endpoints | `endpoints` | health, metrics, execute=N/A |
| Non-interactive | `execute: "N/A"` | Not a chat agent |

Watchtower can discover solver via:
```
GET /.well-known/agent-card.json
```

---

## 5. Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Protocol   │     │    Solver    │     │  Watchtower  │
│  (On-Chain)  │     │ (Off-Chain)  │     │  (Indexer)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │  1. Intent posted  │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ 2. Execute job     │
       │                    │ 3. Generate evidence
       │                    │ 4. Format receipt  │
       │                    │                    │
       │  5. Submit receipt │                    │
       │<───────────────────│                    │
       │                    │                    │
       │  6. Receipt event  │                    │
       │────────────────────│───────────────────>│
       │                    │                    │
       │                    │                    │ 7. Index receipt
       │                    │                    │ 8. Verify evidence
```

---

## 6. Actionable TODOs

### For irsb-solver

- [ ] Implement receipt writer (write to receipts.jsonl)
- [ ] Add verify-receipt CLI command
- [ ] Document receipt schema

### For irsb-protocol

- [ ] Define Receipt struct for on-chain submission
- [ ] Specify evidenceHash field requirements
- [ ] Document settlement flow

### For irsb-watchtower

- [ ] Define event indexing schema
- [ ] Implement evidence verification
- [ ] Add solver discovery via agent-card

---

## 7. Schema Reference

### Intent (Solver Input)

```typescript
interface Intent {
  jobType: string;      // "SAFE_REPORT"
  requester: string;    // "0x..."
  inputs: {
    title: string;
    description: string;
    data?: unknown;
  };
  constraints?: {
    deadline?: string;
    maxGas?: string;
  };
}
```

### Evidence Manifest (Solver Output)

```typescript
interface Manifest {
  schemaVersion: string;  // "1.0.0"
  intentId: string;       // 64-char hex
  runId: string;          // 64-char hex
  jobType: string;
  solver: {
    name: string;
    version: string;
  };
  policyDecision: {
    allowed: boolean;
    reasons: string[];
  };
  executionSummary: {
    status: string;       // SUCCESS/FAILED
  };
  artifacts: Array<{
    path: string;
    sha256: string;
    bytes: number;
    mimeType: string;
  }>;
  createdAt: string;      // ISO 8601
}
```

---

## 8. Version Compatibility

| Solver Version | Protocol Version | Watchtower Version | Compatible |
|----------------|------------------|-------------------|------------|
| 0.1.0 | N/A (pre-chain) | N/A | ✅ |

---

*End of Document*
