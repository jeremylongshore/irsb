# CLAUDE.md

> **DEPRECATED** - This project is deprecated. Both solver and watchtower have migrated to Cloud KMS signing.
> No new development should occur here. Kept for reference only.
>
> **Part of the IRSB monorepo** (`jeremylongshore/irsb`). See root CLAUDE.md for workspace overview.

This file provides guidance to Claude Code when working with the IRSB Agent Passkey codebase.

## Project Overview

**IRSB Agent Passkey** is the identity plane for IRSB Protocol agents. It provides policy-gated signing using **Lit Protocol PKP** (Programmable Key Pairs) with threshold signatures across decentralized TEE nodes.

**Key principle:** Agents submit typed IRSB actions, not raw digests. The signer enforces policy, builds transactions, manages nonces, and produces audit artifacts.

## Deployment

| Environment | URL | Status |
|-------------|-----|--------|
| Production | https://irsb-agent-passkey-308207955734.us-central1.run.app | ✅ Live |
| Health | `/health` | `{"status":"ok"}` |
| Ready | `/ready` | `{"ready":true}` |

**GCP Project:** `irsb-protocol`
**Cloud Run Region:** `us-central1`
**GitHub:** https://github.com/jeremylongshore/irsb (monorepo, `archive/agent-passkey/`)

## Signing Architecture

Uses **Lit Protocol** for non-extractable threshold signatures:
- PKP keys live in 2/3 TEE nodes (no single point of compromise)
- Session signatures for scoped, time-limited access
- Network: `naga-dev` (migrated from Datil V0; Datil shutdown Feb 25, 2026)

## Quick Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Run local server (hot reload)
pnpm build            # Build TypeScript

# Testing
pnpm test             # Run tests
pnpm test:coverage    # Run with coverage
pnpm test:watch       # Watch mode

# Quality
pnpm lint             # ESLint
pnpm lint:fix         # Auto-fix
pnpm format           # Prettier
pnpm typecheck        # TypeScript check
```

## Project Structure

```
src/
├── types/
│   ├── actions.ts           # IRSB action schemas (SUBMIT_RECEIPT, etc.)
│   ├── signing-request.ts   # Full request/response schemas
│   └── audit-artifact.ts    # Audit record schemas
├── policy/
│   ├── engine.ts            # Policy orchestrator
│   ├── allowlists.ts        # Contract/method allowlists
│   ├── limits.ts            # Spend caps, rate limits
│   └── state-validator.ts   # On-chain state checks
├── signing/
│   ├── lit-signer.ts        # Lit Protocol PKP integration
│   ├── der-to-rsv.ts        # DER → (r,s,v) conversion
│   └── tx-builder.ts        # Nonce management, tx construction
├── sessions/
│   └── capability.ts        # Session capability tokens
├── audit/
│   ├── artifact.ts          # Create audit records
│   └── hasher.ts            # Canonical JSON hashing
├── erc8004/
│   └── adapter.ts           # ERC-8004 registry integration
└── server/
    ├── gateway.ts           # Fastify entrypoint
    ├── routes.ts            # API routes
    └── auth.ts              # JWT/workload identity
```

## Architecture Decisions

### Nonce Management (ADR-001)

The signer owns nonce management. Agents don't build transactions; they submit high-level actions. See `000-docs/001-DR-ADR-nonce-management.md`.

### Typed Actions Only

No "sign this digest" API. Only these actions are allowed:
- `SUBMIT_RECEIPT` - Solver submits receipt for executed intent
- `OPEN_DISPUTE` - Watchtower opens dispute against receipt
- `SUBMIT_EVIDENCE` - Either party submits evidence

### Three-Level Identity Assurance

- **L1 Transport**: Verified caller (JWT/workload identity)
- **L2 Action Auth**: Only allowed IRSB state transitions
- **L3 Attestation**: TEE/measured boot (future hardening)

## Testing

Tests are organized by type:
- `test/unit/` - Unit tests (fast, no external deps)
- `test/integration/` - Integration tests (may need KMS)
- `test/security/` - Security-focused tests

Key test files:
- `test/unit/actions.test.ts` - Action schema validation
- `test/unit/policy.test.ts` - Policy engine checks
- `test/unit/der-to-rsv.test.ts` - Signature conversion

## Dependencies

Core:
- `@lit-protocol/lit-node-client` - Lit Protocol SDK
- `@lit-protocol/auth-helpers` - Session signature helpers
- `ethers` - Ethereum utilities
- `fastify` - HTTP server
- `zod` - Schema validation
- `pino` - Logging

## Environment Variables

```bash
# Server
PORT=8080
LOG_LEVEL=info

# Lit Protocol (required for signing)
LIT_NETWORK=naga-dev               # naga-dev | naga-test | naga (datil-* deprecated)
LIT_AUTH_PRIVATE_KEY=0x...         # Auth wallet for session signatures
LIT_PKP_PUBLIC_KEY=0x04...         # PKP public key (uncompressed)

# Capabilities (stored in Secret Manager)
CAPABILITY_SECRET=...              # Shared secret for capability signing

# Auth
AUTH_AUDIENCE=irsb-agent-passkey
AUTH_ISSUERS=https://accounts.google.com
AUTH_SKIP=false  # true for local dev

# ERC-8004 (optional)
ERC8004_ENABLED=false
```

## Secrets (Google Secret Manager)

Sensitive values stored in Secret Manager and injected at runtime:
- `lit-auth-private-key` - Auth wallet private key
- `lit-pkp-public-key` - PKP public key
- `capability-secret` - Session capability signing secret

## Related Projects

This is part of the IRSB ecosystem:
- `../protocol/` - On-chain contracts (Solidity)
- `../solver/` - Reference solver implementation
- `../watchtower/` - Monitoring service

## Key Files

| File | Purpose |
|------|---------|
| `src/types/actions.ts:1` | IRSB action definitions |
| `src/policy/engine.ts:1` | Policy engine orchestrator |
| `src/signing/lit-signer.ts:1` | Lit Protocol PKP integration |
| `src/signing/der-to-rsv.ts:1` | DER signature conversion |
| `src/server/routes.ts:1` | API endpoints |
| `src/server/gateway.ts:1` | Fastify server entrypoint |

## CI/CD

Push to `main` triggers automatic deployment via GitHub Actions:
- **Workflow:** `.github/workflows/deploy.yml`
- **Auth:** Workload Identity Federation (keyless)
- **Registry:** `us-central1-docker.pkg.dev/irsb-protocol/irsb-containers`
- **Guardrails:** `max-instances=3` to prevent runaway scaling

## Lit Network Migration

⚠️ **Datil networks deprecated Feb 25, 2026**

Migration path (Datil → Naga):
1. SDK upgraded from v7 to v8 (`@lit-protocol/*`)
2. `LIT_NETWORK` changed from `datil-dev` to `naga-dev`
3. PKP must be re-minted on Naga (addresses change between networks)
4. Network options: `naga-dev` (dev), `naga-test` (testnet), `naga` (mainnet)
