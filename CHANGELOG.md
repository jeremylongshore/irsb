# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.3.0] - 2026-02-11

Cloud KMS signing migration and deprecated code cleanup.

### Added
- Cloud KMS signer implementation with Google Cloud KMS integration (#13, #14)
- X402Facilitator client for EIP-7702 delegated payment settlement
- Chain wiring for direct on-chain interaction

### Removed
- Agent-passkey client removed (deprecated in favor of Cloud KMS + on-chain policy enforcement)
- `SIGNING_MODE` simplified to `"kms"` only

### Changed
- Signing architecture now uses Cloud KMS directly instead of agent-passkey service
- On-chain policy enforcement via EIP-7702 WalletDelegate with caveat enforcers

---

## [0.2.0] - 2026-02-08

### Added
- AgentPasskeyClient for receipt submission via agent-passkey service
- Agent-passkey signing integration guidance documentation
- AI-CONTEXT.md cross-reference in CLAUDE.md

### Documentation
- Signing integration guidance for agent-passkey service

---

## [0.1.0] - 2026-02-05

### Added

#### Core Infrastructure (Phase 1-2)
- Repository scaffold with TypeScript, pnpm, Node 20
- Document filing system (`000-docs/` flat structure)
- PRD and ADR for reference executor
- GitHub Actions CI (lint, test, build, audit)
- CodeQL security scanning
- Community docs (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- Issue and PR templates with CODEOWNERS
- Configuration system with Zod validation (`check-config` CLI)
- Intent schema with canonical JSON normalization
- Fixture runner CLI (`run-fixture`)

#### Execution Engine (Phase 3-4)
- SAFE_REPORT job type execution with deterministic artifacts
- Atomic file writes with temp-rename pattern
- Evidence bundle with manifest and SHA-256 hashing
- Artifact integrity verification (`validate-evidence` CLI)
- Reproducible execution (same intent → same hashes)

#### Observability (Phase 6)
- Health endpoints (`/healthz`, `/readyz`)
- Prometheus metrics (`/metrics`)
- Structured JSON logging with Pino
- Log redaction for sensitive fields
- Operator runbook documentation

#### Discovery (Phase 7)
- ERC-8004 agent card (`/.well-known/agent-card.json`)
- Service discovery endpoint
- Registration payload generator (`generate-registration` CLI)

#### Production Hardening (Phase 8)
- One-command demo (`pnpm demo`)
- Replay determinism verification (`pnpm replay`)
- Threat model v0 documentation
- Security hardening checklist
- Cross-repo alignment documentation (solver/watchtower/protocol)
- CI E2E smoke test

### Security
- CodeQL analysis enabled
- Dependabot intentionally disabled (manual dependency review)
- Pino log redaction for passwords, tokens, API keys
- Rate limiting on `/readyz` endpoint
- No secrets in agent card or public endpoints

### Documentation
- 33 documents in `000-docs/` following filing standard
- Phase AARs for audit trail
- Operator runbook for production deployment

## [0.0.0] - 2026-02-04

### Added
- Initial repository creation
- Placeholder entry point (`src/index.ts`)

[Unreleased]: https://github.com/intent-solutions-io/irsb-solver/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/intent-solutions-io/irsb-solver/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/intent-solutions-io/irsb-solver/compare/v0.0.0...v0.1.0
[0.0.0]: https://github.com/intent-solutions-io/irsb-solver/releases/tag/v0.0.0
