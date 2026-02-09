# Changelog

All notable changes to IRSB Agent Passkey will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.0.0] - 2026-02-08

First production release. Deployed to Cloud Run with Lit Protocol Naga network.

### Added

#### Core Infrastructure
- Initial agent-passkey scaffold with complete MVP structure
- Fastify HTTP gateway on port 8080
- Health check endpoint at `/health`
- Structured JSON logging with Pino

#### Lit Protocol Integration
- Lit Protocol PKP (Programmable Key Pairs) for 2/3 threshold signatures
- Migrated from Datil (V0) to Naga (V1) network
- PKP public key derivation without network connection (pure key derivation)
- TEE-based key splitting across Lit nodes

#### Typed Action System
- Three allowed actions: `SUBMIT_RECEIPT`, `OPEN_DISPUTE`, `SUBMIT_EVIDENCE`
- Policy validation before signing
- Audit artifact generation for every signing decision

#### ERC-8004 Integration
- Agent identity resolution via ERC-8004 registry
- On-chain identity binding for solver operations

#### Cloud Run Deployment
- Cloud Run service with Workload Identity Federation
- GCP Secret Manager integration for PKP credentials
- Container health probes

### Fixed
- Duplicate logger config causing container crashes
- TypeScript strict mode errors in erc8004/adapter.ts
- Lit Protocol packages moved to dependencies (not devDependencies)

### Security
- No extractable private keys (threshold signatures)
- Policy engine restricts signing to typed actions only
- Audit trail for all signing decisions

---

[Unreleased]: https://github.com/intent-solutions-io/irsb-agent-passkey/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/intent-solutions-io/irsb-agent-passkey/releases/tag/v1.0.0
