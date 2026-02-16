# Architecture Decision Record: IRSB Solver

**Document ID:** 004-DR-ADRD-irsb-solver-architecture-decisions
**Status:** Accepted
**Created:** 2026-02-04
**Timezone:** America/Chicago

---

## 1. Context

### 1.1 Why This Repo Exists

IRSB defines accountability primitives (intent, receipt, evidence references, settlement rules). To prove the protocol works, we need a real actor that:
- Consumes intents
- Applies policy gates
- Executes workflows safely
- Generates evidence with integrity guarantees
- Generates receipts deterministically
- Can later submit receipts on-chain

### 1.2 Relationship to Other Repos

| Repo | Purpose | Boundary |
|------|---------|----------|
| `irsb-protocol` | On-chain contracts, schemas, settlement | Defines what solver submits |
| `irsb-watchtower` | Indexing, monitoring, alerts | Observes solver behavior |
| `irsb-solver` | Reference executor (this repo) | Produces evidence + receipts |

### 1.3 Decision Drivers

- **Determinism**: Reproducible evidence hashes
- **Security**: Safe workflows first, no secrets in code
- **Testability**: No external dependencies in CI
- **Extensibility**: Adapters for intents and execution types
- **Separation**: Clear boundaries between repos

---

## 2. Decision Summary

### Stack Selection

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node 20 | Fast iteration, good ecosystem |
| Language | TypeScript | Type safety, tooling |
| Package Manager | pnpm | Fast, disk efficient |
| EVM Interaction | viem | Modern, typed, lightweight |
| Config Validation | zod | Runtime + static types |
| Logging | pino | Fast, structured JSON |
| Metrics | prom-client | Prometheus standard |
| Testing | vitest | Fast, ESM native |

---

## 3. Key Decisions

### D1 — Solver is Off-Chain Service, Not On-Chain Agent

**Decision:** Implement the solver as an off-chain TypeScript service. On-chain interaction is limited to posting receipts/bonds (future phases).

**Rationale:**
- Real work (tests, file generation, proofs) is inherently off-chain
- On-chain execution is expensive and constrained
- Clearer security boundaries (policy gating, sandboxing)

**Alternatives Considered:**
- Fully on-chain execution: Rejected (expensive, inflexible)
- Hybrid with heavy on-chain logic: Deferred (only settlement belongs on-chain)

**Consequences:**
- Requires strong evidence integrity and receipt signing strategy
- Must carefully define boundary between off-chain proofs and on-chain settlement

---

### D2 — Evidence-First Design: Manifests and Hashes Are First-Class

**Decision:** Evidence bundle is the core artifact. Receipts reference evidence by hash.

**Rationale:**
- Prevents "trust me" claims; enables verification
- Supports disputes and third-party attestations
- Evidence can live off-chain while integrity remains verifiable

**Alternatives Considered:**
- Store full evidence on-chain: Rejected (cost/size)
- Receipts without evidence: Rejected (weak accountability)

**Consequences:**
- Must implement canonical hashing and validation tooling
- Artifacts must be deterministic or explicitly labeled non-deterministic

---

### D3 — Deterministic Identifiers Based on Canonical Inputs

**Decision:** Compute deterministic IDs:
- `runId = hash(intentId + jobType + canonical(inputs))`
- `receiptId = hash(intentId + runId + manifestSha256)`

**Rationale:**
- Enables idempotent retries and deduplication
- Facilitates watchtower monitoring and indexing
- Supports reproducibility in CI

**Alternatives Considered:**
- Random UUIDs: Rejected (breaks determinism, complicates dedupe)

**Consequences:**
- Must define canonical JSON encoding (sorted keys)
- Must avoid timestamps/data that changes between runs in hashed inputs

---

### D4 — Policy Gate is Mandatory Before Execution

**Decision:** Enforce policy checks before executing any intent.

**Rationale:**
- Prevents dangerous actions and unexpected costs
- Ensures the reference solver is safe by default

**Policy MVP Checks:**
- jobType allowlist
- max budget
- requester allowlist (optional)
- expiry checks
- artifact size caps

**Alternatives Considered:**
- Soft policy warnings: Rejected (unsafe default)

**Consequences:**
- Some intents will be refused
- Must produce refusal evidence consistently

---

### D5 — Safe Golden Path First; No Network Dependency in MVP

**Decision:** MVP executes only safe workflows (e.g., `SAFE_REPORT`) without external network calls.

**Rationale:**
- Keeps CI deterministic and secure
- Reduces blast radius while proving core protocol loop

**Alternatives Considered:**
- Jump to GitHub PR execution: Deferred (higher risk, needs sandbox)

**Consequences:**
- Later phases add adapters and sandboxing for more powerful actions

---

### D6 — Adapter/Plugin Architecture for Intake and Execution

**Decision:** Use interfaces for:
- `IntentSource` (fixture, API, chain)
- `JobRunner` per `jobType` (safe report, repo patch, etc.)
- `ReceiptSubmitter` (local, chain)

**Rationale:**
- Keeps core pipeline stable while swapping edges
- Simplifies testing with fakes

**Alternatives Considered:**
- One monolithic pipeline: Rejected (hard to extend/test)

**Consequences:**
- Requires disciplined interfaces and versioning
- Requires minimal shared "core types" module

---

### D7 — Observability is Built-In From Start

**Decision:** Provide structured logs + Prometheus metrics + health endpoints from Phase 1.

**Rationale:**
- Watchtower and operators need visibility
- Debugging deterministic evidence is easier with correlation IDs

**Alternatives Considered:**
- Logging only: Rejected (insufficient for ops)

**Consequences:**
- Must define consistent correlation keys: `intentId`, `runId`, `receiptId`

---

### D8 — Local-First Storage; Future-Proof for Remote

**Decision:** MVP writes:
- Evidence to `./data/evidence/` (gitignored)
- Receipts to `./data/receipts.jsonl`

Interface allows future mapping to S3/GCS/IPFS.

**Rationale:**
- Fast iteration; simple demo
- Keeps external dependencies out of MVP

**Alternatives Considered:**
- Start with S3/GCS: Deferred (adds operational complexity)

**Consequences:**
- Must implement atomic writes and validation commands
- Must document migration strategy to remote storage later

---

### D9 — Security Posture: No Secrets in Code

**Decision:** Environment variables only; validate on startup; never log secrets.

**Rationale:**
- Prevents credential leaks
- Supports deployment to managed secret stores later

**Alternatives Considered:**
- .env with real secrets committed: Rejected (security risk)

**Consequences:**
- Must provide `.env.example` and clear docs

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     IRSB Solver                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Intent       │───▶│ Validate +   │───▶│ Policy       │  │
│  │ Source       │    │ Normalize    │    │ Gate         │  │
│  │ (fixture/    │    │ (Zod schema) │    │ (allowlist/  │  │
│  │  API/chain)  │    │              │    │  budget)     │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                  │          │
│                                                  ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Receipt      │◀───│ Evidence     │◀───│ Execute      │  │
│  │ Submitter    │    │ Bundle       │    │ Workflow     │  │
│  │ (local/      │    │ (manifest +  │    │ (SAFE_REPORT │  │
│  │  chain)      │    │  hashes)     │    │  adapter)    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Observability (pino + prom-client)         │  │
│  │            /healthz  /metrics                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Alternatives Summary Table

| Area | Selected | Alternatives | Why Rejected |
|------|----------|--------------|--------------|
| Runtime | Node+TS | Rust/Go | TS fastest for reference impl |
| Evidence | Off-chain + hashes | On-chain storage | Cost/size constraints |
| IDs | Deterministic hashes | UUIDs | Breaks idempotency |
| Intake | Fixture first | Chain first | Adds complexity, slows MVP |
| Execution | Safe workflow | PR automation first | Risk; needs sandbox maturity |
| Storage | Local first | S3/GCS first | Adds external dependency |

---

## 6. Consequences & Tradeoffs

### Positive
- Deterministic, testable "golden path"
- Evidence integrity is verifiable
- Extensible via adapters
- Clear separation of roles across repos
- Fast local development

### Negative
- Off-chain correctness depends on evidence design
- Requires careful canonicalization rules
- Full on-chain integration deferred to later phases
- No distributed solver coordination in MVP

---

## 7. Implementation Guidance

### 7.1 Canonical JSON
- Use stable key sorting (alphabetical)
- Avoid floats when hashing; normalize numeric strings if needed
- Exclude wall-clock timestamps from hashed artifact contents

### 7.2 Atomic Writes
- Write to temp file then rename
- Validate after write

### 7.3 CI Determinism
- No live RPC calls
- No external network in tests
- Rely on fixtures and fakes

### 7.4 Directory Structure
```
src/
├── index.ts           # Entry point
├── config.ts          # Zod config schema
├── logger.ts          # Pino setup
├── metrics.ts         # Prom-client registry
├── intents/           # Intent sources/adapters
├── execution/         # Workflow runners
├── evidence/          # Manifest + hashing
├── receipts/          # Receipt builder + submitter
├── policy/            # Allowlists/budgets
└── cli.ts             # CLI utilities
```

---

## 8. Future ADRs (When Needed)

Create separate ADRs when these become relevant:
- Sandbox strategy (microVM, container, restricted runner)
- Chain submission strategy (contracts, gas, retries)
- Receipt signing and key management
- Remote evidence storage (GCS/S3/IPFS) and retention
- Dispute and verifier/judge integration
- Multi-solver coordination

---

## 9. ERC-8004 Scope Decision (Phase 7)

### Decision

Phase 7 will borrow **only discovery and registration shapes** from ERC-8004:

| Borrowed | Not Borrowed |
|----------|--------------|
| `/.well-known/agent-card.json` endpoint | LLM agent scaffolding |
| Registration JSON schema | Agent orchestration patterns |
| `register` command stub | AI/ML agent semantics |

### Rationale

IRSB Solver is a **deterministic executor**, not an AI agent:
- No natural language interpretation
- No LLM-based decision making
- No autonomous goal-seeking behavior

ERC-8004's discovery mechanism is useful for:
- Machine-readable capability advertisement
- Integration with agent registries (for reputation signals)
- Standardized service discovery

### Implementation (Phase 7)

1. Add `/.well-known/agent-card.json` endpoint with:
   - Solver capabilities (job types supported)
   - Contract addresses (SolverRegistry, IntentReceiptHub)
   - Reputation link (IntentScore query endpoint)

2. Add `solver register` CLI command to:
   - Generate agent-card.json from config
   - Optionally post to ERC-8004 registry (if available)

3. **Do NOT** import:
   - LLM agent orchestration libraries
   - AI agent decision frameworks
   - Natural language processing

### Consequences

- Solver remains a deterministic, auditable executor
- Compatible with ERC-8004 discovery ecosystem
- Clear separation from AI agent semantics

---

## 10. Revision History

| Date | Change |
|------|--------|
| 2026-02-04 | Initial version |
| 2026-02-05 | Added ERC-8004 scope decision for Phase 7 |

---

*End of ADR*
