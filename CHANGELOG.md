# Changelog

All notable changes to IRSB-Watchtower will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.5.0] - 2026-02-11

EIP-7702 delegation monitoring and Cloud KMS signing migration.

### Added
- DelegationPaymentRule for EIP-7702 WalletDelegate monitoring (#16)
- Detects anomalous delegated payments (spend limit violations, time window violations, unauthorized targets)
- GCP KMS signer implementation for production signing (#17)

### Removed
- Lit Protocol PKP signer stub removed (deprecated in favor of Cloud KMS + on-chain policy enforcement)
- `SIGNING_MODE` simplified to `"local" | "gcp-kms"` only

### Changed
- Chain integration refactored for cleaner multi-chain support (#17)
- README updated to remove Lit PKP stub references

---

## [0.4.0] - 2026-02-08

Five watchtower phases complete: core engine, behavior lens, identity lens, context lens, and API/alerting.

### Added

#### W1: Watchtower Core (#9)
- Schemas and base types for watchtower operations
- SQLite storage for findings and state
- Scoring engine for solver reputation
- CLI utilities for configuration and simulation

#### W2: Behavior Lens (#10)
- Receipt ingest from on-chain events
- Evidence verification pipeline
- Behavioral signal extraction

#### W3: Identity Lens (#11)
- ERC-8004 agent card discovery
- Agent card validation
- Identity signal publishing to registry

#### W4: Context Lens (#12)
- Ethereum L1 lightweight heuristics
- Optional payment adjacency detection
- Cross-chain context aggregation

#### W5: API + Alerting (#14)
- Fastify API endpoints for findings and actions
- Alerting subsystem with configurable sinks
- Signed transparency log for verifiable off-chain findings

### Changed
- CLAUDE.md rewritten to reflect full codebase architecture
- CI now enforces canonical drift detection

### Documentation
- Synced canonical standards from irsb-solver (000-* prefix)
- Complete architecture documentation

---

## [0.3.0] - 2026-02-03

### Added
- **Multi-Chain Support** - Run concurrent watchers per chain with chain-specific state isolation (#6)
- **CLI Utilities** - New `@irsb-watchtower/cli` package with `health`, `check-config`, and `simulate` commands
- **Chain-Specific State** - ActionLedger and BlockCursor now support chain ID for proper multi-chain isolation
- **CHAINS_CONFIG** - New environment variable for JSON array of chain configurations

### Changed
- Worker refactored to use `ScanContext` pattern for cleaner parameter passing
- Configuration schema extended with `chainEntrySchema` and `multiChainConfigSchema`

## [0.2.0] - 2026-02-03

### Added
- **Evidence Store** - JSONL persistence with Zod schema validation, file rotation, and query API
- **Resilience Patterns** - Retry with exponential backoff and circuit breaker for chain operations
- **Webhook Sink** - Configurable webhook notifications with HMAC-SHA256 signing
- **Prometheus Metrics** - `/metrics` endpoint with findings, actions, RPC latency, and rule duration histograms
- **Security Scan** - CI now includes `pnpm audit` for dependency vulnerability detection
- **Receipt Stale Rule** - First production rule detecting stale receipts past challenge window (Epic 1)
- **Action Executor** - Executes on-chain actions with dry-run mode and action ledger
- **State Management** - Checkpoint persistence for resumable scanning

### Changed
- CI workflow now runs build before typecheck for proper monorepo dependency resolution
- ESLint config updated to disable import resolver rules (ESM compatibility)

## [0.1.0] - 2026-01-30

### Added
- Initial scaffold with monorepo structure (pnpm workspaces)
- Core rule engine with Finding schema
- Chain provider abstraction (viem-based)
- IRSB contract adapter for Sepolia testnet
- Pluggable signer architecture (local, GCP-KMS, Lit PKP)
- Fastify API server with health, scan, and action endpoints
- Background worker for continuous scanning
- Comprehensive documentation in `000-docs/`
