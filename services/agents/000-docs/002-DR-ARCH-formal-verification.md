# 002-DR-ARCH — Formal Agent Verification via Z3 SMT Solver

**Status**: Accepted
**Date**: 2026-02-12
**Deciders**: Jeremy Longshore
**References**: [FormalJudge (arXiv:2602.11136)](https://arxiv.org/abs/2602.11136), [zscole/ai-poc-daily 2026-02-12](https://github.com/zscole/ai-poc-daily/tree/main/2026-02-12), Pre-Mortem PM-AG-002

## Context

The IRSB agents repo will gain signing capabilities in Phase 3, allowing AI agents to submit on-chain transactions. The pre-mortem analysis (PM-AG-002, CRITICAL) identified **zero prompt injection defense** as the highest-severity gap in the agents layer.

Traditional approaches use "LLM-as-a-judge" — one LLM evaluating another's outputs. The FormalJudge paper demonstrates that probabilistic systems cannot reliably supervise other probabilistic systems without inheriting their failure modes. Their Z3 SMT-based approach achieved 16.6% improvement over LLM-as-judge baselines.

### Two Trust Domains

IRSB has two distinct security layers:

1. **On-chain (EVM)**: WalletDelegate + caveat enforcers provide atomic, deterministic guarantees. Already strong.
2. **Off-chain (AI agents)**: LLM prompts, RAG queries, tool calls. Zero formal guarantees prior to this ADR.

The formal verifier addresses the off-chain gap without duplicating on-chain enforcement.

## Decision

Adopt Z3 SMT-based formal verification for all AI agent tool calls, integrated as:

1. **`shared/core/verifier.py`** — Core FormalAgentVerifier with 9 default constraints
2. **`shared/core/verifier_config.py`** — Environment-based constraint configuration
3. **`api/middleware.py`** — FastAPI middleware gating all POST requests
4. **RAG pipeline hardening** — Input sanitization, injection pattern detection, output validation

### Constraint Categories

| Category | Constraints | Verification Method |
|----------|------------|-------------------|
| FILE_ACCESS | Sensitive file detection, path traversal, safe path allowlist | Z3 string theory + pattern matching |
| COMMAND_EXEC | Dangerous command blocklist, command allowlist | Regex pattern matching |
| DATA_EXFIL | Secret material detection (ETH keys, API keys, tokens) | Regex with recursive parameter scanning |
| NETWORK | Host allowlist for outbound HTTP | String matching with suffix support |
| RESOURCE_LIMIT | Timeout bounds | Z3 integer arithmetic |
| PERMISSION | Transaction value limits (Phase 3) | Z3 integer arithmetic |

### Integration Architecture

```
API Request
    │
    ▼
VerificationMiddleware (api/middleware.py)
    ├─ Extract parameters from JSON body
    ├─ Map route → tool name
    ├─ FormalAgentVerifier.verify(ToolCall)
    │   ├─ Get applicable constraints by tool type
    │   ├─ Run Z3 solver for each constraint
    │   ├─ Aggregate: any violation → PROVEN_UNSAFE
    │   └─ Return VerificationReport
    ├─ PROVEN_SAFE → proceed to handler
    └─ PROVEN_UNSAFE → 403 with violation details
```

### Fail-Closed Design

- Z3 solver timeout → PROVEN_UNSAFE (reject)
- Unknown constraint → violation (reject)
- Verification error → violation (reject)
- Disabled verifier → PROVEN_SAFE (explicit opt-out only)

## Alternatives Considered

| Approach | Why Not |
|----------|---------|
| LLM-as-a-Judge | Inherits failure modes of the system it's supervising. Not deterministic. |
| Regex-only validation | No formal proofs. Limited composability. Can't express arithmetic constraints. |
| Deterministic policy engine (like solver's Zod) | Good for schema validation, but can't prove absence of properties (e.g., "no traversal sequence exists"). |
| Formal verification of Solidity (Certora/Halmos) | Different domain — verifies contracts, not agent behavior. |

## Consequences

### Positive
- Mathematical proof of constraint satisfaction for every tool call
- Defense-in-depth: off-chain Z3 + on-chain enforcers
- Auditable verification reports with constraint-level detail
- Sub-millisecond verification (vs seconds for LLM-as-judge)
- Directly mitigates PM-AG-002 (prompt injection)

### Negative
- Z3 dependency adds ~50MB to container image
- Specification errors in constraints could block legitimate actions
- False positives require allowlist tuning

### Risks
- Z3 solver timeout on complex constraints → mitigated by 5s timeout + fail-closed
- Constraint specification errors → mitigated by comprehensive test suite

## Phase 3 Preparation

When agents gain signing capabilities, the verifier will:
1. Pre-check transaction value against `VERIFIER_MAX_TX_VALUE_WEI`
2. Validate target contract against delegation caveats (read from chain)
3. Verify method selector against enforcer allowlists
4. Ensure all constraints pass BEFORE the transaction reaches KMS for signing
