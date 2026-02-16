# 036-DR-STND: MAPI Adoption for Agent-Facing API Surfaces

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-10 |
| **Authors** | Jeremy Longshore |
| **Standards** | MAPI v0.94 (Markdown API Specification, Draft January 2026) |

## Context

IRSB is pivoting to "on-chain guardrails for AI agents" — meaning AI agents and their frameworks (Olas, Coinbase AgentKit, Brian AI, Virtuals, ElizaOS) are the primary consumers of IRSB's API. Despite having 40+ SDK methods and 80+ exported functions across the Protocol SDK and x402-IRSB package, IRSB has **zero external API documentation**. No OpenAPI specs, no Swagger, no hosted reference. External developers and LLMs must read source code to integrate.

### Problem

If IRSB's value proposition is "integrate our guardrails into your agent framework," the integration surface must be documented in a format those frameworks can consume. JSDoc buried in TypeScript files is not that.

### Options Considered

**Option A: OpenAPI/Swagger.** Industry standard. Tooling ecosystem is mature. But:
- Protocol SDK and x402-IRSB are TypeScript libraries (`INTERNAL` transport), not HTTP APIs. OpenAPI cannot describe them.
- OpenAPI YAML is verbose and token-expensive. An agent loading the full spec into context wastes tokens on structural boilerplate.
- IRSB's target consumers are AI agents using LLMs for reasoning. OpenAPI is optimized for deterministic code generators, not probabilistic reasoning.

**Option B: MAPI (Markdown API) v0.94.** Draft specification (January 2026) designed for human, LLM, and agent consumption. Key advantages:
- `INTERNAL` transport for TypeScript library APIs — fits IRSB's mixed transport model
- `Intention` sections tell LLMs *when* to use a capability, not just *how*
- TypeScript interfaces for schemas (token-efficient, LLM-familiar)
- Progressive disclosure via reference cards minimizes context window usage
- Files are valid Markdown — render on GitHub, no tooling lock-in

**Option C: Status quo (no docs).** Untenable given the agent pivot.

## Decision

**Adopt MAPI v0.94 for agent-facing API surfaces.** Specifically:

### In Scope

| Surface | File | Rationale |
|---------|------|-----------|
| Protocol SDK (`IRSBClient`) | `protocol/sdk/api.mapi.md` | Primary integration surface for all agent frameworks |
| x402-IRSB package | `protocol/packages/x402-irsb/api.mapi.md` | Buyer delegation + payment flow consumed by agent frameworks |
| Future Agent SDK | `protocol/packages/agent-sdk/api.mapi.md` | Greenfield — design API and MAPI spec together |

### Out of Scope

| Surface | Rationale |
|---------|-----------|
| Watchtower API (Fastify HTTP) | Operational endpoints, not agent-facing. Adopt MAPI later if external integrators need it. |
| Solver API (Express HTTP) | 4 health/metrics endpoints — not worth the effort. |
| Agent Passkey (Fastify HTTP) | Deprecated. |

### Reference Material

The full MAPI v0.94 specification is archived at `000-docs/specs/mapi-v0.94.md` in the workspace root.

## Rationale

| Factor | Assessment |
|--------|-----------|
| **Maturity** | Draft v0.94 — not an industry standard yet |
| **Risk** | Low — MAPI files are valid Markdown, render anywhere, no tooling lock-in |
| **Cost** | Low — writing `.mapi.md` files is no harder than writing READMEs |
| **Alignment** | High — IRSB's entire pivot is "built for AI agents"; LLM-native API docs reinforce this |
| **Differentiation** | High — no other Web3 project documents APIs in MAPI; early adoption signals technical leadership |
| **Fallback** | If MAPI doesn't gain traction, the files are still excellent human-readable docs |

## Consequences

### Positive

- AI agents can load IRSB API specs directly into context and reason about capabilities
- `Intention` sections enable correct capability routing on first try (e.g., "use `receipt.post` for V1, use `receipt.post-from-x402` for V2 with delegation")
- TypeScript schemas in MAPI match the actual SDK types — no translation layer
- Documentation renders beautifully on GitHub with zero tooling
- First-mover advantage in Web3 MAPI adoption

### Negative

- MAPI v0.94 is a draft — the spec may evolve and require updates to our files
- No existing MAPI tooling ecosystem (validators, generators, linters)
- New contributors must learn MAPI conventions (mitigated: it's just Markdown with conventions)

### Neutral

- Does not preclude generating OpenAPI specs later for the HTTP-only surfaces (Watchtower API)
- MAPI files coexist with existing JSDoc — they supplement, not replace, inline documentation
