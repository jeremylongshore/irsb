# 040-AT-ARCH: Intentions Gateway + IRSB Architecture

> **Status:** Approved (2026-02-15)
> **Author:** Jeremy Longshore
> **Beads:** `irsb-0hd` (Pre-0 doc currency), `irsb-upx` (Phase 1), `irsb-1lw` (Phase 2)

---

## 1. Executive Summary

The Intentions Gateway unifies **Web2 MCP governance** with **Web3 on-chain enforcement** through a shared Canonical Intent Envelope. Every AI agent action — whether calling an API or executing a blockchain transaction — flows through the same policy evaluation, receipt generation, and audit trail.

**Nobody occupies unified Web2+Web3 intent governance.** The market is bifurcated between Web2 MCP governance players (Runlayer, Natoma, Acuvity) who lack cryptographic receipts and Web3 intent protocols (CoW, Across/UMA, Coinbase AgentKit) who lack Web2 audit trails. IRSB targets the gap.

---

## 2. Competitive Landscape

### 2.1 Market Quadrants

| Quadrant | Players | Gap vs. IRSB |
|----------|---------|--------------|
| Web2 MCP Governance | Runlayer ($11M), Natoma ($7M), Proofpoint/Acuvity, Lasso | No cryptographic receipts, no on-chain enforcement, no disputes |
| Web3 Intent Accountability | CoW Protocol, Across/UMA, Coinbase AgentKit+x402 | No Web2 dimension, no MCP governance, no cross-domain audit |
| AI Agent Guardrails | Snyk/Invariant, Guardrails AI, F5, LangSmith | Detect-and-block only. No cryptographic proofs. No dispute mechanism |
| Unified Web2+Web3 | **Nobody** | **IRSB's target position** |

### 2.2 Strategic Threats (Ranked)

1. **Coinbase assembles it first** — x402 + AgentKit + Agentic Wallets = 80% of the pieces
2. **ERC-7683/OIF adds accountability** — Open Intents Framework (30+ teams, Ethereum Foundation)
3. **Runlayer adds on-chain proofs** — MCP creator as advisor, $11M, enterprise customers

### 2.3 Strategic Response

- Position as **accountability layer for OIF/ERC-7683**, not competing standard
- **Insurance partnership** — AgentCover Pro (BDIC) needs verifiable enforcement evidence
- **EU AI Act compliance** — August 2, 2026 deadline for high-risk AI systems; record-keeping requirements match IRSB receipts
- **MCP gateway integration** — Partner with Runlayer/Natoma, provide the crypto receipt layer they lack

### 2.4 Pain Validation

- AI agents autonomously finding $4.6M in smart contract exploits for $1.22/contract (Anthropic research)
- $400M stolen in January 2026 alone
- Coinbase launched Agentic Wallets (Feb 2026) = validates the exact problem IRSB solves
- 87% of enterprises lack AI security frameworks (Gartner)

---

## 3. Architecture Audit (vs. Existing IRSB)

### 3.1 What Exists (Keep As-Is)

| Component | Location | Status |
|-----------|----------|--------|
| SolverRegistry, IntentReceiptHub, DisputeModule, EscrowVault | `protocol/src/` | Deployed (Sepolia), 552 tests |
| WalletDelegate + 5 enforcers | `protocol/src/delegation/`, `protocol/src/enforcers/` | Deployed (Sepolia) |
| X402Facilitator | `protocol/src/X402Facilitator.sol` | Deployed (Sepolia) |
| Solver (intent execution, receipt submission) | `solver/` | v0.3.0 |
| Watchtower (monitoring, dispute filing) | `watchtower/` | v0.5.0 |
| Agents (RAG + Z3 verification) | `agents/` | v0.2.0 |

**Do NOT rebuild what exists.** The Intentions Gateway should be a NEW service that calls INTO existing contracts, not replace them.

### 3.2 What's New (Build)

```
intentions-gateway/    — TypeScript, Cloud Run
  Request normalization + Canonical Intent Envelope construction
  Cedar policy engine (PDP)
  Web2 execution path (MCP tool calls with mTLS)
  Web3 execution path (delegate to solver/direct tx)
  Receipt generation (Web2 DecisionRecord + Web3 IntentReceipt bridge)
  Audit vault (hash-chained, Merkle-anchored)
  Multi-tenant isolation (per-tenant KMS keyrings, policy bundles)
  OpenTelemetry traces with intentId + traceId correlation

policy-admin/          — TypeScript, Cloud Run
  Policy authoring UI/API
  Policy compilation (YAML → Cedar policy set)
  Policy signing + deployment
  On-chain enforcer sync (update delegation caveats)
  Emergency freeze capability

audit-vault/           — TypeScript, Cloud Run
  Append-only receipt storage (Firestore with retention policies)
  Hash-chain verification API
  Merkle root computation + anchoring (on-chain or EAS)
  Auditor replay/verification endpoint
  BigQuery export for analytics
```

### 3.3 Key Architecture Adjustments

1. **Web2 receipt != Web3 receipt** — Web2 DecisionRecords (off-chain, Firestore, hash-chained) vs Web3 IntentReceipts (on-chain, IntentReceiptHub). Bridge is the Canonical Intent Envelope generating an `intentId` used in BOTH.

2. **Signing architecture** — IRSB already uses Cloud KMS + EIP-7702 WalletDelegate. Extend delegation caveats to include Intentions Gateway as a recognized delegation source, don't rebuild.

3. **Policy sync to on-chain** — Keep Web2 policies off-chain and only sync constraints (spend limits, allowed targets) to existing enforcers. Dynamic policy updates require new `PolicyRegistryEnforcer` or use existing TimelockController.

4. **Spanner is premature** — Start with Firestore (auto-scaling, 10K+ writes/sec). Migrate to Spanner only at >50K intents/min.

5. **GKE is premature** — Cloud Run everywhere. Sub-second cold start, auto-scaling, no cluster management.

---

## 4. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Data store (receipts)** | **Firestore** (MVP), Spanner upgrade path | Already in IRSB stack, auto-scaling, 10K+ writes/sec |
| **Queue** | **Cloud Tasks** for execution, **Pub/Sub** for events | Cloud Tasks: exactly-once, HTTP target. Pub/Sub: fan-out |
| **Gateway runtime** | **Cloud Run** everywhere | Sub-second cold start, auto-scaling, no cluster management |
| **Policy engine** | **Cedar** | 42-60x faster than OPA. Sub-ms evaluation. Entity-attribute model maps to Tenant/Agent/Intent/Resource |
| **Audit vault** | **Firestore with Object Lifecycle + BigQuery export** | Retention policies prevent deletion. Separate GCP project for audit data |
| **Anchoring** | **On-chain Merkle root** (Sepolia → mainnet) | Hourly anchor on IntentReceiptHub (`anchorMerkleRoot(bytes32, uint256, uint256)`) |
| **Correlation** | **intentId (bytes32) + traceId (W3C) + correlationHash** | intentId from canonical envelope. traceId for distributed tracing |
| **Key separation** | **Per-tenant keyring, per-role keys** | `projects/{project}/locations/{region}/keyRings/{tenantId}` with gateway-signer, policy-admin, audit-reader keys |

---

## 5. Canonical Intent Envelope (Sketch)

```
EIP-712 TypedData:
  CanonicalIntentEnvelope {
    uint8    version;           // Forward compatibility
    bytes32  intentId;          // keccak256(canonicalEnvelopeBytes)
    bytes32  tenantId;          // Multi-tenant isolation
    address  agentAddress;      // Agent's wallet
    uint256  agentId;           // ERC-8004 agent ID
    uint8    domain;            // WEB2=0, WEB3=1, HYBRID=2
    bytes32  actionHash;        // keccak256(action payload)
    bytes32  constraintsHash;   // keccak256(policy constraints)
    uint64   timestamp;         // Envelope creation time
    uint64   expiry;            // Envelope expiry
    bytes    extensionData;     // Version-specific extensions
  }

Signatures:
  AgentSig     — agent signs the envelope (authorization)
  GatewaySig   — gateway signs the policy decision (enforcement)
  UserSig      — optional user co-sign (high-value actions)
```

**intentId** = `keccak256(canonicalBytes(envelope))` — same hash used in both Web2 DecisionRecords and Web3 IntentReceipts.

---

## 6. Phased Build Plan

### Phase Map

| Phase | Epic | Scope | Priority |
|-------|------|-------|----------|
| Pre-0 | `irsb-0hd` | Documentation currency audit | P0 (done) |
| Pre-1 | `irsb-kaj` | Competitive analysis + feasibility | P0 (done) |
| 1 | `irsb-upx` | Canonical Intent Envelope + Gateway Scaffold | P0 |
| 2 | `irsb-1lw` | Cedar Policy Engine + Policy Admin | P0 |
| 3 | `irsb-hh9` | Web2 Execution Path (MCP + mTLS) | P0 |
| 4 | `irsb-7kz` | Web3 Execution Path (Delegation Bridge) | P0 |
| 5 | `irsb-3o1` | Audit Vault (Hash-Chain + Merkle Anchoring) | P0 |
| 6 | `irsb-dau` | Multi-Tenancy + Isolation | P1 |
| 7 | `irsb-bj9` | Observability + SLOs | P1 |
| 8 | `irsb-m7k` | Security Hardening | P0 |
| 9 | `irsb-rer` | Production + Insurance | P1 |

### Dependency Graph

```
Pre-0 (doc currency) ──→ Phase 1 (envelope + scaffold)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             Phase 2 (Cedar)     Phase 2 (Cedar)
                    │                   │
           ┌───────┴───────┐           │
           ▼               ▼           │
     Phase 3 (Web2)  Phase 4 (Web3)   │
           │               │           │
           └───────┬───────┘           │
                   ▼                   │
            Phase 5 (Audit)            │
                   │                   │
                   │     Phase 6 (Multi-Tenant) ◀──┘
                   │            │
                   ▼            ▼
            Phase 7 (Obs)  Phase 8 (Security)
                   │            │
                   └──────┬─────┘
                          ▼
                   Phase 9 (Production)
```

### Phase 1 Tasks (Next Up)

| ID | Task | Deps | Acceptance |
|----|------|------|------------|
| `irsb-upx.1` | Design Canonical Intent Envelope v1 spec | None | EIP-712 struct defined, intentId computation, signature model |
| `irsb-upx.2` | Scaffold intentions-gateway repo | upx.1 | TypeScript Cloud Run, Zod schemas, health endpoint, OTel, CI/CD |
| `irsb-upx.3` | Implement envelope canonicalization + hashing | upx.1, upx.2 | Property tests (50+), fuzz tests, compatible with IntentReceipt.intentHash |
| `irsb-upx.4` | Implement envelope signing (KMS + EIP-712) | upx.3 | Cloud KMS integration, EIP-712 verification, roundtrip test |
| `irsb-upx.5` | Write ADR for Canonical Intent Envelope | upx.1 | In 000-docs/ |
| `irsb-upx.6` | Phase 1 AAR | upx.2-4 | After-action report |

---

## 7. Testing + Verification Matrix

| Category | Scope | Tools |
|----------|-------|-------|
| Unit | Envelope canonicalization, Cedar evaluation, hash-chain | vitest |
| Property | intentId stability (same input → same output), signature roundtrip | fast-check |
| Fuzz | Envelope parser (malformed inputs), Cedar policy (edge cases) | vitest + custom fuzzer |
| Integration | KMS signing, Firestore CRUD, Cloud Tasks dispatch | vitest + testcontainers |
| E2E | Full Web2 path, full Web3 path, hybrid step DAG | vitest + Sepolia fork |
| Security | Tenant confusion, replay, signature substitution, bypass | Dedicated security suite |
| Observability | Trace propagation, metric accuracy | OpenTelemetry test SDK |

---

## 8. Feasibility Confirmation

| Component | Feasibility | Notes |
|-----------|-------------|-------|
| EIP-712 Canonical Envelope at 10K/min | YES | Local hashing + ECDSA. Trivially fast |
| Cloud KMS at 10K/min | YES | Software keys: 60K QPM (6x headroom). HSM: 30K QPM (3x) |
| Firestore for receipts (MVP) | YES | Auto-scaling, 10K+ writes/sec. Spanner at >50K/min |
| Cedar for policy engine | YES | 42-60x faster than OPA. Sub-ms. Amazon Verified Permissions proves enterprise readiness |
| Multi-tenant isolation | YES | GCP project-level isolation + per-tenant KMS keyrings |

---

## 9. First 10 Golden Path Tasks

1. Create `intentions-gateway/` repo with TypeScript scaffold
2. Define `CanonicalIntentEnvelope` Zod schema + EIP-712 type
3. Implement `computeIntentId(envelope)` with property tests
4. Implement `signEnvelope(envelope, role)` with Cloud KMS
5. Install Cedar SDK, define entity schema, write first 3 policy templates
6. Implement `/execute` endpoint (Web2 path: normalize → policy → execute → receipt)
7. Implement `DecisionRecord` + `ExecutionReceipt` Firestore storage
8. Implement hash-chain linking (prevHash on each record)
9. Wire OpenTelemetry with intentId + traceId correlation
10. Deploy to Cloud Run with health check + basic CI

---

## 10. Verification Criteria

- Pre-0: `grep -r "v0.2.0\|v0.4.0\|Phase 1" */CLAUDE.md` returns 0 matches (done)
- Phase 1: `pnpm test` in intentions-gateway passes 50+ tests
- Phase 2: Cedar policy evaluation benchmark <1ms p99
- Phase 3-4: Full E2E test: intent → policy → execution → Web2 receipt → Web3 receipt → verification
- Phase 5: Hash-chain tamper detection test + Merkle proof verification
- All phases: `bd list --status open --parent <epic-id>` returns 0 for completed phases
