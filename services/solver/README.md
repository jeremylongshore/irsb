# IRSB Solver

Reference solver/executor service for the IRSB protocol.

## What is IRSB Solver?

IRSB Solver is the actor implementation that:
- Consumes intents from the IRSB protocol
- Runs allowed workflows off-chain
- Produces evidence of execution
- Submits receipts for settlement

## Determinism Pledge

This solver is designed for **reproducible, auditable execution**:

- **Deterministic IDs**: All identifiers (`runId`, `receiptId`) are computed from canonical inputs, not random UUIDs
- **Canonical Hashing**: JSON is sorted by keys, no floats in hashed content, no wall-clock timestamps in artifacts
- **Reproducible Evidence**: Given the same intent and inputs, the solver produces identical evidence hashes
- **Idempotent Retries**: Re-running the same intent produces the same receipt (no duplicate work)

This enables:
- Third-party verification of execution correctness
- Watchtower correlation of receipts to intents
- Dispute resolution based on reproducible evidence

## What This Repo Does NOT Do

**Out of Scope:**

| Not Here | Where It Belongs |
|----------|------------------|
| On-chain contracts | [irsb-protocol](https://github.com/intent-solutions-io/irsb-protocol) |
| Monitoring/alerting | [irsb-watchtower](https://github.com/intent-solutions-io/irsb-watchtower) |
| LLM/AI agent orchestration | Not part of IRSB (ERC-8004 discovery shapes only) |
| Multi-solver coordination | Future scope |
| Chain-native execution | Solvers execute off-chain, post receipts on-chain |

## Related Repositories

| Repo | Purpose |
|------|---------|
| [irsb-protocol](https://github.com/intent-solutions-io/irsb-protocol) | On-chain contracts, schemas, settlement primitives |
| [irsb-watchtower](https://github.com/intent-solutions-io/irsb-watchtower) | Indexing, monitoring, alerts, dashboards |
| **irsb-solver** (this repo) | Reference solver/executor service |

## Current Status

**Phase 8: Production Hardening** - E2E demo, replay determinism, security documentation.

## Quickstart Demo

Run the complete solver demo in one command:

```bash
pnpm install
pnpm demo
```

This will:
1. Validate configuration
2. Run a sample intent fixture
3. Generate evidence bundle with artifacts
4. Verify evidence integrity

## Replay Determinism

Verify that the solver produces identical results across runs:

```bash
pnpm replay
```

This script:
1. Runs the same fixture twice in isolated directories
2. Compares run IDs, artifact hashes, and manifest hashes
3. Verifies deterministic execution (excluding timestamps)

See [Determinism Pledge](#determinism-pledge) for design principles.

## ERC-8004 Discovery

The solver exposes a standard agent card for service discovery:

```bash
# Start the server
pnpm start

# Fetch agent card
curl http://localhost:3000/.well-known/agent-card.json
```

The agent card declares:
- Service identity (`irsb-solver@0.1.0`)
- Capabilities (`intent-execution`, `evidence-generation`, `receipt-submission`)
- Endpoints (health, metrics, execute=N/A for non-interactive service)

Note: This solver borrows only the discovery/registration shapes from ERC-8004. It is **not** an LLM chat agent.

## Security

See the [Threat Model](./000-docs/030-DR-THMD-threat-model-v0.md) for:
- Asset classification
- Trust boundaries
- Threat analysis and mitigations
- Current security posture

See the [Security Hardening Checklist](./000-docs/031-DR-CHKL-security-hardening-checklist.md) for production deployment requirements.

## Local Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Build for production
pnpm build
```

## Requirements

- Node.js 20+
- pnpm 9+

## License

MIT License - See [LICENSE](./LICENSE) for details.

### Licensing Scope

This license applies to:
- All source code in this repository
- Documentation in `000-docs/`
- Configuration files and examples

This license does NOT cover:
- The IRSB protocol specification (separate ERC proposal)
- On-chain contracts (see [irsb-protocol](https://github.com/intent-solutions-io/irsb-protocol))
- Third-party dependencies (see their respective licenses)
