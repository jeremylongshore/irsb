# IRSB Watchtower

Off-chain monitoring and enforcement for the [IRSB](https://github.com/intent-solutions-io) (Intent Receipts & Solver Bonds) protocol. Watches on-chain events, detects violations via a deterministic rule engine, produces structured Findings, and optionally auto-acts (open disputes, submit evidence).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        IRSB Watchtower                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │     Core     │    │    Runner    │    │    Signer    │      │
│  │  (portable)  │    │ (env-aware)  │    │  (pluggable) │      │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤      │
│  │ Rule Engine  │    │   API App    │    │ LocalPrivKey │      │
│  │ Finding Type │    │ Worker App   │    │ GCP KMS ○    │      │
│  │ No cloud dep │    │ Config load  │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  ○ = stub (integration pending)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Quickstart

```bash
# Prerequisites: Node.js >= 20, pnpm >= 8

git clone https://github.com/intent-solutions-io/IRSB-watchtower.git
cd IRSB-watchtower
pnpm install

# Configure
cp .env.example .env
# Edit .env with your RPC URL and chain settings

# Build all packages
pnpm build

# Run checks
pnpm lint && pnpm typecheck && pnpm test

# Start
pnpm dev:api      # Fastify API on :3000
pnpm dev:worker   # Background scanner
```

## What CI Enforces

Every push and PR runs:

| Check | Command |
|-------|---------|
| Canonical drift | `pnpm canonical:check` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Tests | `pnpm test` |
| Security audit | `pnpm audit --audit-level=high` |

## Packages

| Package | Description |
|---------|-------------|
| `@irsb-watchtower/config` | Zod schemas, environment loader, type exports |
| `@irsb-watchtower/core` | Rule engine, Finding type, action executor. Zero cloud deps |
| `@irsb-watchtower/chain` | Chain provider abstraction (viem) |
| `@irsb-watchtower/irsb-adapter` | IRSB contract client with retry + circuit breaker |
| `@irsb-watchtower/signers` | Pluggable signer interface (LocalPrivateKey, GCP KMS stub) |
| `@irsb-watchtower/resilience` | Retry and circuit breaker utilities |
| `@irsb-watchtower/webhook` | HMAC-signed webhook delivery |
| `@irsb-watchtower/evidence-store` | JSONL evidence persistence |
| `@irsb-watchtower/metrics` | Prometheus metrics |

## Apps

| App | Description |
|-----|-------------|
| `@irsb-watchtower/api` | Fastify HTTP server with scan/action endpoints |
| `@irsb-watchtower/worker` | Background scanner that runs rules on interval |
| `@irsb-watchtower/cli` | Health check, config validation, simulation |

## IRSB Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## Documentation

Detailed docs live in [`000-docs/`](./000-docs/). Canonical standards (prefixed `000-*`) are synced from [irsb-solver](https://github.com/intent-solutions-io/irsb-solver) and enforced by CI drift checks.

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## License

MIT
