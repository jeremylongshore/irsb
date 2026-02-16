# 001-DR-ADR: Agent Architecture Decision

**Status**: Accepted
**Date**: 2026-02-09
**Author**: Jeremy / Intent Solutions

## Context

IRSB needs two AI agents: a Builder agent (engineering tasks) and a Money agent (revenue generation). Three architecture options were evaluated.

## Options Considered

### Option A: Single Super-Agent with Two Modes

One process, mode flag switches between builder/money behavior.

- **Pro**: Simple deployment, shared knowledge base
- **Con**: Role confusion in prompts, security boundary problem (money agent doesn't need signing keys), hard to audit which mode took actions

### Option B: Two Agents + Shared Knowledge Base (Selected)

Separate builder/ and money/ packages, shared RAG pipeline, single API server.

- **Pro**: Clean security boundary, independent audit trails, failure isolation, clear ownership
- **Con**: Two prompt sets to maintain, slightly more code

### Option C: Fleet with Orchestrator + Subagents

Central orchestrator routing to 5+ specialized subagents.

- **Pro**: Maximum modularity, easy to extend
- **Con**: Over-engineered for solo operator, orchestrator is new failure point, latency, complex deployment

## Decision

**Option B** — two agents with shared knowledge base.

### Rationale

1. **Security**: Money agent has NO signing keys. Builder agent can sign (Phase 3+) but money agent is research-only. Single process conflates these boundaries.
2. **Audit**: Each agent has independent audit trail in the SQLite ledger. Easy to trace which agent took which action.
3. **Simplicity**: Option C is the future (when paying customers justify fleet complexity) but premature for a solo operator.
4. **Failure isolation**: Builder agent going down doesn't affect money agent research capabilities.

## Consequences

- Two sets of system prompts to maintain (builder/prompts.py, money/prompts.py)
- Shared RAG pipeline means both agents benefit from corpus improvements
- Single FastAPI server simplifies deployment while keeping agent logic separated
- Migration to Option C (fleet) is straightforward — extract each agent to its own service

## Implementation

- `shared/` — RAG pipeline, corpus, on-chain reader (both agents use)
- `builder/` — Builder agent (has chain tools, signing keys in Phase 3)
- `money/` — Money agent (research tools only, no chain access)
- `api/` — FastAPI server with `/builder/*` and `/money/*` route groups
