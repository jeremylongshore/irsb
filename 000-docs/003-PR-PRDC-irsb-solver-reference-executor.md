# Product Requirements Document: IRSB Solver (Reference Executor)

**Document ID:** 003-PR-PRDC-irsb-solver-reference-executor
**Product:** IRSB Solver (Reference Executor)
**Status:** Draft
**Owner:** Jeremy
**Created:** 2026-02-04
**Timezone:** America/Chicago

---

## 1. Problem Statement

The IRSB protocol defines accountability primitives (intents, receipts, evidence references, settlement rules), but without a working solver implementation:
- Protocol developers cannot validate that schemas and settlement logic work end-to-end
- Requesters have no reference for how intents should be processed
- Watchtower operators have no baseline behavior to monitor
- The protocol remains theoretical without a proven "golden path"

A reference solver proves the protocol works by consuming intents, executing workflows, producing verifiable evidence, and generating deterministic receipts.

---

## 2. Goals (MVP)

1. **Prove the protocol loop**: Intent → Policy → Execution → Evidence → Receipt
2. **Establish determinism**: Same input produces identical evidence hashes and receipt IDs
3. **Provide testable artifacts**: Evidence bundles that can be validated offline
4. **Enable local development**: One-command setup with no external dependencies
5. **Document the golden path**: Clear demo showing end-to-end flow

---

## 3. Non-Goals (Explicitly Out of Scope)

- Full decentralization or distributed solver network
- Production-grade dispute court or on-chain settlement
- Real financial transactions or bond management
- Complex sandboxing or multi-tenant execution
- High-availability or horizontal scaling
- External API integrations (GitHub, cloud services) in MVP

---

## 4. Users / Personas

### Persona 1 — Requester (Protocol Consumer)
**Job:** Post an intent and receive a verifiable outcome.
**Needs:**
- Clear acceptance criteria
- Deterministic receipt
- Ability to verify evidence without trusting the solver

### Persona 2 — Solver Operator (this repo user)
**Job:** Run a solver service that safely accepts/executes only allowed intents.
**Needs:**
- Policy and allowlists
- Budget ceilings and rate limits
- Observability and replayable evidence

### Persona 3 — Watchtower Operator
**Job:** Monitor solver/protocol behavior and detect anomalies.
**Needs:**
- Predictable events/metrics
- Signed receipts and evidence pointers

### Persona 4 — Protocol Developer
**Job:** Validate that intents/receipts map cleanly to on-chain primitives.
**Needs:**
- Stable schema and versioning
- Test vectors and deterministic IDs

---

## 5. Core Concepts

| Concept | Definition |
|---------|------------|
| **Intent** | A structured request describing desired outcome, constraints, acceptance criteria, and settlement terms |
| **Solver** | The actor (this repo) that accepts an intent, executes work, and produces evidence + a receipt |
| **Evidence Bundle** | Immutable proof artifacts (files/logs/results) + a manifest listing hashes and metadata |
| **Receipt** | A structured record referencing intent, evidence bundle, and delivered outcome |
| **Bond** | Collateral posted by solver to guarantee honest execution (future) |
| **Judge/Verifier** | An entity that re-evaluates evidence and signs attestations (future) |
| **Settlement** | Protocol logic releasing payment / slashing bond based on receipt verification |
| **Golden Path** | Local deterministic demo: fixture intent → safe execution → evidence → receipt |

---

## 6. User Stories

### Requester Stories
1. As a requester, I want to submit an intent with clear acceptance criteria so I know what outcome to expect.
2. As a requester, I want to receive a receipt with evidence pointers so I can verify the work was done.
3. As a requester, I want deterministic receipt IDs so I can deduplicate requests.

### Solver Operator Stories
4. As a solver operator, I want policy gates that refuse dangerous intents so my system stays safe.
5. As a solver operator, I want budget limits so I don't overspend on execution.
6. As a solver operator, I want structured logs with correlation IDs so I can debug issues.
7. As a solver operator, I want metrics endpoints so I can monitor health.

### Watchtower Stories
8. As a watchtower operator, I want predictable receipt formats so I can index them.
9. As a watchtower operator, I want evidence manifests with hashes so I can verify integrity.

### Protocol Developer Stories
10. As a protocol developer, I want versioned schemas so I can evolve the protocol safely.
11. As a protocol developer, I want test fixtures so I can validate schema changes.
12. As a protocol developer, I want deterministic IDs so I can test idempotency.

---

## 7. Functional Requirements (MVP)

### FR1 — Intent Intake
**Requirement:** Support intake via at least one deterministic method.
- **MVP:** JSON fixture file path (`INTENT_FIXTURE_PATH` env var)
- **Future:** `POST /intent` API, on-chain event listener

**Acceptance:**
- Solver processes fixture intent with `pnpm dev`
- Intent is validated against schema before processing

### FR2 — Intent Schema + Validation
**Requirement:** Define `Intent` schema (Zod) with versioning.

**Minimum fields:**
- `intentVersion` (semver string)
- `intentId` (string; computed if missing)
- `requester` (string; address or DID)
- `createdAt` (ISO timestamp)
- `expiresAt` (ISO timestamp, optional)
- `chainId` (number, optional for MVP)
- `reward` (optional)
- `bondRequired` (optional)
- `jobType` (enum; MVP: `SAFE_REPORT`)
- `inputs` (object; jobType-specific)
- `constraints` (object; time/budget/allowlist)
- `acceptanceCriteria` (array of check definitions)

**Acceptance:**
- Invalid intents fail fast with clear error messages
- Schema is unit-tested with valid + invalid fixtures

### FR3 — Policy Gate
**Requirement:** Refuse intents that violate policy before execution.

**Policy checks (MVP):**
- `jobType` allowlist (only `SAFE_REPORT` initially)
- `maxBudgetUsd` (default 0 unless explicitly set)
- `requesterAllowlist` (optional)
- `timeWindow` (reject expired intents)
- `artifactSizeLimitMb` (for evidence generation)

**Output:** `policyDecision: { allowed: boolean, reasons: string[] }`

**Acceptance:**
- Disallowed intent produces structured log, refusal evidence, no receipt

### FR4 — Execution Engine (SAFE_REPORT)
**Requirement:** Provide a single safe workflow producing deterministic output.

**MVP job type:** `SAFE_REPORT`
- Input: `{ subject: string, data: Record<string, unknown> }`
- Output: JSON report file + Markdown report
- Determinism: stable ordering; no timestamps in content

**Produces:**
- `runId` (deterministic hash of intentId + jobType + canonical inputs)
- `runStartAt`, `runEndAt`
- `runStatus` (`SUCCESS` | `FAILED` | `REFUSED`)

**Acceptance:**
- Same fixture twice yields identical report hashes
- No network access required

### FR5 — Evidence Bundle
**Requirement:** Every execution produces an Evidence Bundle.

**Structure:**
- `evidence/manifest.json`
- `evidence/artifacts/*` (reports, logs)
- All artifacts hashed SHA-256 and listed in manifest

**Manifest fields:**
- `manifestVersion` (semver)
- `intentId`, `runId`
- `artifacts[]`: `{ path, sha256, bytes, contentType, createdAt }`
- `solver`: `{ serviceVersion, gitCommit?, environment }`
- `policyDecision`
- `executionSummary`: `{ status, startedAt, endedAt, durationMs }`

**Acceptance:**
- `pnpm evidence:validate` validates schema, existence, hash matches
- Unit tests cover manifest generation + hash verification

### FR6 — Receipt Generation
**Requirement:** Generate a `Receipt` object for successful runs.

**Receipt fields:**
- `receiptVersion` (semver)
- `receiptId` (deterministic: hash of intentId + runId + manifestSha256)
- `intentId`, `runId`
- `status` (`SUCCESS` | `FAILED` | `REFUSED`)
- `delivered`: pointers to primary artifacts (paths + sha256)
- `evidence`: `{ manifestSha256, manifestPath }`
- `timestamps`: `{ createdAt }`
- `signatures` (optional in MVP)
- `attestations` (optional)

**Acceptance:**
- Receipt generated and printed to stdout as JSON
- Receipt references manifest hash and key artifacts

### FR7 — Receipt Submission
**Requirement:** Provide submission interface with two implementations.
- `LocalStoreSubmitter` (writes to `./data/receipts.jsonl`)
- `ChainSubmitter` (stub with TODO)

**Acceptance:**
- Receipt persisted locally in stable format
- Interface exists for future on-chain submission

### FR8 — Observability
**Requirement:** Structured logs and metrics.

**Logs:**
- pino JSON logs
- Include `intentId`, `runId`, `receiptId`
- Never log secrets

**Metrics (Prometheus):**
- `solver_intents_received_total`
- `solver_intents_refused_total{reason}`
- `solver_runs_total{status,jobType}`
- `solver_evidence_artifacts_total`
- `solver_errors_total{type}`

**Health:**
- `GET /healthz` returns `{ ok, serviceVersion, gitCommit?, uptimeSeconds }`
- `GET /metrics` returns Prometheus text

**Acceptance:**
- Both endpoints respond during `pnpm dev`
- Metrics increment during runs

### FR9 — CLI Utilities
**Commands:**
- `pnpm cli -- check-config`
- `pnpm cli -- run-fixture <path>`
- `pnpm cli -- validate-evidence <manifestPath>`
- `pnpm cli -- print-receipt <receiptPath|latest>`

**Acceptance:**
- All commands have `--help`
- Non-zero exit codes on failure

---

## 8. Non-Functional Requirements

### NFR1 — Security
- Fail-fast config validation
- No secrets committed
- No external network calls in MVP execution
- Evidence integrity via hashing/validation
- Dependency scanning in CI

### NFR2 — Reliability
- Idempotency: same fixture produces same receiptId/runId
- Crash safety: atomic writes (temp file then rename)

### NFR3 — Determinism
- Stable JSON canonicalization (sorted keys)
- No wall-clock timestamps in hashed artifact contents

### NFR4 — Portability
- One-command local run
- Works in CI with no external dependencies

---

## 9. Threat Model Summary

A full threat model document will be created when runtime implementation begins. Key threats to address:

| Threat | Mitigation |
|--------|------------|
| Malicious intent causes harm | Policy gate with strict allowlists |
| Evidence tampering | SHA-256 hashes in manifest |
| Receipt forgery | Deterministic IDs; future signing |
| Secret leakage | No secrets in code; env-only; log redaction |
| Dependency vulnerabilities | CI audit step |

---

## 10. Acceptance Criteria (Definition of Done)

The repo is MVP-complete when:

- [ ] `pnpm dev` processes a fixture intent and produces evidence manifest, report artifacts, and receipt object
- [ ] `pnpm evidence:validate` passes and verifies hashes
- [ ] `pnpm test` includes intent schema validation, evidence hashing, and determinism tests
- [ ] `GET /healthz` and `GET /metrics` respond correctly
- [ ] CI is green on PRs
- [ ] PRD + ADR exist and match implementation

---

## 11. Phased Delivery Plan

| Phase | Deliverables |
|-------|--------------|
| **1** | Repo scaffold + docs filing + Beads + CI skeleton |
| **2** | Config system + intent schema + fixture runner CLI |
| **3** | Execution engine (SAFE_REPORT) + deterministic outputs |
| **4** | Evidence bundle (manifest + hashing) + validators + tests |
| **5** | Receipt generation + local store + idempotency |
| **6** | Observability (metrics/logs/health) + hardening |
| **7** | Protocol integration stubs (chain submitter interface) |
| **8** | End-to-end demo + threat model + golden path runbook |

Each phase results in 1+ PRs, closed Beads tasks, and an AAR.

---

## 12. Golden Path Demo

The reference demo that proves MVP completeness:

```bash
# 1. Start solver
pnpm dev

# 2. Process fixture intent
INTENT_FIXTURE_PATH=fixtures/safe-report-intent.json pnpm cli -- run-fixture

# 3. Validate evidence
pnpm cli -- validate-evidence ./data/evidence/latest/manifest.json

# 4. View receipt
pnpm cli -- print-receipt latest

# 5. Verify determinism (run again, same hashes)
INTENT_FIXTURE_PATH=fixtures/safe-report-intent.json pnpm cli -- run-fixture
# receiptId and evidence hashes should match first run
```

---

## 13. Open Questions

1. **Receipt signing strategy**: Which key management approach? HSM, KMS, local dev key?
2. **Evidence retention**: How long to keep local evidence before cleanup?
3. **Chain submission timing**: Immediate vs batched vs manual trigger?
4. **Multi-solver coordination**: How do multiple solvers avoid duplicate work? (future)
5. **Attestation format**: What standard for third-party verifier signatures?

---

*End of PRD*
