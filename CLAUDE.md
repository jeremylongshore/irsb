# CLAUDE.md

This file provides guidance to Claude Code when working with the IRSB Agent Passkey codebase.

## Project Overview

**IRSB Agent Passkey** is the identity plane for IRSB Protocol agents. It provides policy-gated signing using GCP Cloud KMS with non-extractable keys.

**Key principle:** Agents submit typed IRSB actions, not raw digests. The signer enforces policy, builds transactions, manages nonces, and produces audit artifacts.

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
│   ├── kms-signer.ts        # GCP KMS integration
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
- `@google-cloud/kms` - GCP KMS for signing
- `ethers` - Ethereum utilities
- `fastify` - HTTP server
- `zod` - Schema validation
- `pino` - Logging

## Environment Variables

```bash
# Server
PORT=8080
LOG_LEVEL=info

# KMS (required for signing)
KMS_PROJECT_ID=your-project
KMS_LOCATION=us-central1
KMS_KEY_RING=irsb
KMS_KEY_NAME=agent-signer

# Auth
AUTH_AUDIENCE=irsb-agent-passkey
AUTH_ISSUERS=https://accounts.google.com
AUTH_SKIP=false  # true for local dev

# ERC-8004 (optional)
ERC8004_ENABLED=false
```

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
| `src/signing/kms-signer.ts:1` | GCP KMS integration |
| `src/signing/der-to-rsv.ts:1` | DER signature conversion |
| `src/server/routes.ts:1` | API endpoints |
