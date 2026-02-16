# Subagent Usage by Phase

**Document ID:** 014-PR-GUID-phases-subagent-usage
**Status:** Active
**Created:** 2026-02-05
**Timezone:** America/Chicago

---

## Overview

This guide maps which subagents are most useful during each implementation phase of the irsb-solver project.

## Phase → Subagent Matrix

| Phase | Primary Agents | Secondary Agents |
|-------|---------------|------------------|
| Pre-Phase (Setup) | `github-operator`, `ci-engineer` | `security-auditor` |
| Phase 1 (Scaffold) | `ts-architect`, `ci-engineer` | `github-operator` |
| Phase 2 (Intent Schema) | `protocol-researcher`, `ts-architect` | `test-engineer` |
| Phase 3 (Evidence) | `determinism-guardian`, `ts-architect` | `test-engineer` |
| Phase 4 (Receipts) | `protocol-researcher`, `ts-architect` | `determinism-guardian` |
| Phase 5 (Policy) | `ts-architect`, `security-auditor` | `test-engineer` |
| Phase 6 (Integration) | `test-engineer`, `protocol-researcher` | `repo-librarian` |
| Phase 7 (Observability) | `ci-engineer`, `ts-architect` | `security-auditor` |
| Phase 8 (Hardening) | `security-auditor`, `determinism-guardian` | `test-engineer` |

## Detailed Phase Guidance

### Pre-Phase: Repository Setup

**Primary:** `github-operator`, `ci-engineer`

- Use `github-operator` for branch creation, PR workflow
- Use `ci-engineer` for CI/CD setup and validation
- Use `security-auditor` for initial security posture review

### Phase 1: Scaffold

**Primary:** `ts-architect`, `ci-engineer`

- Use `ts-architect` to design initial directory structure
- Use `ci-engineer` to ensure CI pipeline is green
- Validate with `pnpm lint && pnpm test && pnpm build`

### Phase 2: Intent Schema + Config + CLI

**Primary:** `protocol-researcher`, `ts-architect`

- Use `protocol-researcher` to align with irsb-protocol schemas
- Use `ts-architect` to design Zod config and types
- Use `test-engineer` to write config validation tests

**Key alignment:** `IntentReceipt` struct must match protocol exactly.

### Phase 3: Evidence Bundle + Hashing

**Primary:** `determinism-guardian`, `ts-architect`

- Use `determinism-guardian` to audit all hashing logic
- Use `ts-architect` to design evidence manifest structure
- Use `test-engineer` to write determinism tests

**Critical:** No randomness, no wall-clock timestamps in hashed content.

### Phase 4: Receipt Builder + Submitter

**Primary:** `protocol-researcher`, `ts-architect`

- Use `protocol-researcher` to verify receiptId computation matches
- Use `determinism-guardian` to audit signature building
- Use `test-engineer` for receipt validation tests

**Key alignment:** `receiptId = keccak256(abi.encode(intentHash, solverId, createdAt))`

### Phase 5: Policy Engine

**Primary:** `ts-architect`, `security-auditor`

- Use `ts-architect` to design policy interface
- Use `security-auditor` to review allowlist/budget enforcement
- Use `test-engineer` for policy rejection tests

### Phase 6: Integration Testing

**Primary:** `test-engineer`, `protocol-researcher`

- Use `test-engineer` to build end-to-end test paths
- Use `protocol-researcher` to verify full flow matches protocol expectations
- Use `repo-librarian` to locate integration points

### Phase 7: Observability

**Primary:** `ci-engineer`, `ts-architect`

- Use `ts-architect` to design metrics and logging structure
- Use `ci-engineer` to add observability checks to CI
- Use `security-auditor` to ensure no secrets in logs

### Phase 8: Production Hardening

**Primary:** `security-auditor`, `determinism-guardian`

- Use `security-auditor` for final security audit
- Use `determinism-guardian` for final determinism audit
- Use `test-engineer` for edge case testing

## Common Multi-Agent Workflows

### New Feature Implementation

1. `protocol-researcher` → Verify alignment with protocol
2. `ts-architect` → Design module structure
3. `test-engineer` → Write tests first (TDD)
4. Implement feature
5. `determinism-guardian` → Audit for non-determinism
6. `security-auditor` → Security review
7. `github-operator` → Create PR

### Debugging CI Failure

1. `ci-engineer` → Analyze workflow logs
2. `repo-librarian` → Find relevant test files
3. `test-engineer` → Debug failing test
4. `ci-engineer` → Verify fix in CI

### Cross-Repo Schema Change

1. `protocol-researcher` → Identify changes in irsb-protocol
2. `repo-librarian` → Find affected files in solver
3. `ts-architect` → Plan migration
4. `test-engineer` → Update tests
5. `determinism-guardian` → Verify hash computations still match

---

## Revision History

| Date | Change |
|------|--------|
| 2026-02-05 | Initial phase-subagent mapping |

---

*End of Document*
