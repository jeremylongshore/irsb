# 028-DR-ADDM-phase-7-erc8004-adapter-boundary

**Document ID:** 028-DR-ADDM-phase-7-erc8004-adapter-boundary
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This addendum explains the ERC-8004 adapter boundary architecture and isolation decisions.

---

## 1. Why Isolate ERC-8004?

The ERC-8004 standard is designed for LLM agents with chat capabilities. The IRSB Solver is **not** an LLM agent - it's an intent executor. We borrow only the discovery/registration patterns.

**Isolation ensures:**
- No LLM/chat dependencies leak in
- No payment/wallet code required
- Clean separation from core execution logic
- Easy to remove or replace if standard evolves

---

## 2. Adapter Boundary

All ERC-8004 code lives in `src/erc8004/`:

```
src/erc8004/
├── index.ts           # Module exports (minimal surface)
├── types.ts           # Type definitions
├── agentCard.ts       # Agent card generation
├── registration.ts    # Registration payload generation
├── registerStub.ts    # CLI command implementation
└── erc8004.test.ts    # Tests
```

### 2.1 What Crosses the Boundary

| Direction | What | Where |
|-----------|------|-------|
| Inbound | Config (baseUrl) | Server → agentCard |
| Outbound | AgentCard JSON | agentCard → Server endpoint |
| Outbound | CLI output | registerStub → CLI |

### 2.2 What Does NOT Cross

- Intent data
- Execution context
- Evidence manifests
- Receipts
- Policy decisions

---

## 3. Module Dependencies

```
src/erc8004/
  └── types.ts          (no deps)
  └── agentCard.ts      (deps: types)
  └── registration.ts   (deps: types, agentCard, node:crypto)
  └── registerStub.ts   (deps: registration)
  └── index.ts          (re-exports all)

src/server/server.ts
  └── imports: generateAgentCard from erc8004

src/cli.ts
  └── imports: executeRegisterCommand from erc8004
```

No circular dependencies. No imports from `erc8004/` into core execution paths.

---

## 4. What We Borrowed from ERC-8004

| Pattern | Used | Notes |
|---------|------|-------|
| `/.well-known/agent-card.json` | Yes | Standard discovery location |
| Agent card schema | Partial | Only fields we need |
| Registration payload shape | Yes | Stub implementation |
| Registry API shape | Placeholder | No real registry yet |

---

## 5. What We Did NOT Borrow

| Pattern | Status | Why |
|---------|--------|-----|
| LLM agent wrapper | Omitted | We're not an LLM agent |
| MCP server integration | Omitted | Not applicable |
| Chat/conversation handling | Omitted | Non-interactive service |
| Wallet/key management | Omitted | No on-chain writes in stub |
| Payment handling | Omitted | Out of scope |

---

## 6. Future Extensions (Phase 8+)

If on-chain registration is needed later:

```
src/erc8004/
  ├── ... (existing)
  ├── chainClient.ts     # Viem client for registration tx
  ├── registerChain.ts   # On-chain registration
  └── config.ts          # Registry address, RPC config
```

This would:
1. Add viem as dependency (already in repo for other purposes)
2. Require wallet/signer configuration
3. Add new CLI option `--execute` (vs `--dry-run`)

The adapter boundary means this extension won't affect core solver logic.

---

## 7. Testing Strategy

Tests verify isolation:

| Test | Verifies |
|------|----------|
| Agent card generation | No side effects, deterministic |
| Registration payload | Checksum matches card |
| Endpoint serving | No auth required, returns valid JSON |
| CLI command | Exits cleanly, outputs expected format |

No tests depend on core solver state.

---

## 8. Determinism

The agent card is deterministic:
- Same code → same output
- No timestamps in card
- Keys in stable order

This allows:
- Repeatable checksums
- Cache-friendly responses
- Predictable testing

---

*End of Document*
