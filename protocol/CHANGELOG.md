# Changelog

All notable changes to IRSB Protocol are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.4.0] - 2026-02-12

Pre-mortem security hardening and Moloch DAO-style test suite adoption.

### Added

#### Security Hardening (Pre-Mortem Response)
- **TimelockController deployment script** (PM-GV-001) — 48-hour delay for governance actions
- **Volume-proportional bond requirements** (PM-EC-001) — bonds scale with solver throughput to prevent undercollateralization
- **Moloch DAO-style systematic test suite** — 104 new tests using invariant-based methodology

### Fixed

#### Smart Contract Security (Pre-Mortem Findings)
- **Arbitrator fee decoupling** (PM-EC-002, PM-SC-023) — arbitrator compensation now uses pull-pattern withdrawals, preventing economic circular dependency
- **NonceEnforcer nonce validation** (PM-SC-002) — validates expected nonce to prevent replay attacks
- **ECDSA.tryRecover address(0) check** (PM-SC-022) — returns failure on signature recovery to zero address

### Documentation
- Catastrophic failure pre-mortem analysis (039-AA-AUDT) — 83 findings across 8 categories, 4 CRITICAL
- Multi-chain feasibility analysis (040-DR-RSRC) — hub-and-spoke architecture recommendation

### Technical
- 552 tests passing (up from 448, +104 Moloch tests)
- All 4 CRITICAL pre-mortem findings addressed in Phase 0

---

## [1.3.1] - 2026-02-11

Maintenance release: automated security audit report and dependency fixes.

### Added
- SolidityGuard v1.2.0 automated audit report (038-AA-AUDT) - 36 contracts, 6,976 lines scanned, 0 actionable critical findings

### Fixed
- Axios DoS vulnerability patched in subgraph dependencies (axios override to 1.13.5)

### Changed
- Subgraph lockfile regenerated with security patches
- Documentation version footer updated from v1.1.0 to v1.3.0
- Test count documentation updated to 448 (accurate)

---

## [1.3.0] - 2026-02-10

EIP-7702 delegation system, AI agent guardrails pivot, and smart contract security exercise.

### Added

#### EIP-7702 Delegation System (#26)
- **WalletDelegate**: EIP-7702 wallet delegation with ERC-7710 caveat redemption
- **DelegationLib**: EIP-712 hashing and verification helpers
- **Caveat Enforcers**: SpendLimit, TimeWindow, AllowedTargets, AllowedMethods, Nonce
- **X402Facilitator**: Direct and delegated payment settlement for AI agents
- 21 new tests for WalletDelegate, 3 fuzz tests, 16 tests for X402Facilitator

#### Smart Contract Security Exercise (#28)
- Educational exercise covering 4 vulnerability classes (reentrancy, flash loan, overflow, access control)
- VulnerableVault with deliberately insecure patterns
- SecureVault with IRSB production patterns (CEI + nonReentrant, internal accounting, checked arithmetic, onlyOwner)
- 11 Foundry tests demonstrating exploits and fixes
- Comprehensive documentation (037-AT-GUID)

#### AI Agent Guardrails Positioning
- Reframed protocol messaging: "On-chain guardrails for AI agents"
- WalletDelegate = agent wallet policy, enforcers = spending limits
- Target market: AI agent frameworks (Olas, Coinbase AgentKit, Brian AI, Virtuals, ElizaOS)

### Changed
- Dashboard status badges updated for delegation contract deployment
- Protocol README and landing page reframed for AI agent narrative

### Fixed
- CI dashboard deploy switched to Workload Identity Federation

### Documentation
- EIP-7702 delegation architecture decision record (030-DR-ARCH)
- Delegation payment flow specification (031-AT-SPEC)
- AI agent pitch deck (032-MK-PITC)
- Agent framework target analysis (033-MK-TARG)
- Twitter thread and EthResearch post drafts (034, 035-MK-CONT)
- MAPI adoption for agent-facing APIs (036-DR-STND)
- Smart contract security exercise guide (037-AT-GUID)

### Technical
- 448 tests passing (up from 426)
- Delegation contracts deployed to Sepolia

---

## [1.2.0] - 2026-02-08

Website ecosystem hub, ERC-8004 agent registration, and SDK/x402 public release.

### Added

#### Website Ecosystem Hub (#23, #24, #25)
- 14 new website pages with grouped navigation and developer docs
- Ecosystem banner showing all 4 IRSB components with status badges
- Comparison page: IRSB vs UniswapX, CoW, 1inch, Across, Ethos, EigenLayer
- Expandable EcosystemCards component on homepage
- Developer quickstart, SDK reference, x402 guide, contract reference

#### ERC-8004 Agent Registration
- Registered IRSB solver on ERC-8004 IdentityRegistry (Agent ID: 967)
- On-chain identity enabling cross-protocol reputation

#### SDK & CLI
- `irsb verify <receipt-id>` CLI command for on-chain receipt verification
- Receipt verification SDK module with V1/V2 support
- npm provenance for all package releases
- `RELEASING.md` release process documentation
- CI guards to prevent publishing under wrong package names

#### x402 HTTP Payments (Epic C, #20)
- Complete x402 integration package (`irsb-x402` v0.1.0)
- 30-minute quickstart guide
- Express example service with x402 payment flow
- Client script for testing

### Changed
- **BREAKING**: SDK package renamed from `@intentsolutionsio/irsb-sdk` to `irsb`
- **BREAKING**: x402 package renamed from `@irsb/x402-integration` to `irsb-x402`
- Old package names deprecated on npm with redirect messages

### Fixed
- Update badges to reflect agent-passkey now live on Cloud Run
- Ecosystem accuracy sweep with honest status badges (#24)
- CI using stable Foundry version instead of nightly
- SDK package-lock.json regenerated for CI

### Documentation
- AI-CONTEXT.md cross-reference added to CLAUDE.md
- Canonical standards synced from irsb-solver (#22)
- ERC-8004 publishing guide
- Adapter integration guide
- Optimistic dispute and counter-bond documentation
- Operational accounts documented in CLAUDE.md
- Epics and tasks roadmap
- LLM briefing document for external brainstorming
- IRSB-SEC-008 marked as accepted risk

### Published
- `irsb` v0.1.0 on npm
- `irsb-x402` v0.1.0 on npm

---

## [1.1.0] - 2026-01-30

ERC-8004 credibility publishing and security hardening release.

### Added

#### ERC-8004 Credibility Publishing (Epic B)
- **ERC8004Adapter v2.0**: Full implementation of ERC-8004 validation signals standard
- **IntentReceiptHub hooks**: Non-reverting signal emission on finalize
- **SolverRegistry hooks**: Non-reverting signal emission on slash
- **Integration test suite**: 6 tests covering full signal flow
- IntentScore algorithm: 40% success + 25% disputes + 20% stake + 15% longevity
- Cross-chain reputation proofs via Merkle trees

#### Security Hardening (PRs #17-19)
- IRSB-SEC-006/010 implementation with economic invariants
- CI hardening with security gates
- Document filing system standard v4.2

### Fixed
- Broken documentation links in README
- Security audit report organization
- Mobile UX improvements in dashboard

### Documentation
- Comprehensive operator-grade system analysis (appaudit)
- 6767 document filing system standard
- Repository housekeeping and community health improvements

### Technical
- 355 tests passing (up from 325)
- 4 economic invariant tests (256 runs, 128k calls each)
- All lint checks passing

---

## [1.0.0] - 2026-01-28

First production release on Sepolia testnet.

### Added

#### Security Audit (PRs #13-16)
- Security fixes for IRSB-SEC-001, 002, 003, 005
- Invariant tests (11 tests, 256 runs, 128k calls each)
- Slither gates in CI (blocking on high/critical)
- Security operations guide

#### Core Protocol (Phases 0-3)
- **SolverRegistry**: Registration, bonding, slashing, jail/ban system
- **IntentReceiptHub**: Receipt posting, disputes, finalization
- **DisputeModule**: Arbitration, evidence submission, timeout resolution
- **ReceiptV2Extension**: Dual attestation with EIP-712 signatures
- **EscrowVault**: Native ETH and ERC20 escrow
- **OptimisticDisputeModule**: Counter-bond mechanism

#### Privacy & Integration (Phases 4-5)
- Privacy SDK with commitment generation
- ERC-8004 validation provider adapter
- V2 Receipt Types: PrivacyLevel enum (PUBLIC, SEMI_PUBLIC, PRIVATE)

#### Multi-Chain Support (Phase 6)
- Polygon Amoy deployment configuration
- Multi-chain SDK with network switching

#### Operations (Phase 7)
- Fuzz test suites (10,000 runs in CI)
- INCIDENT_PLAYBOOK.md, MONITORING.md, MULTISIG_PLAN.md

#### x402 Integration (Phase 8)
- `irsb-x402` package
- Express example for HTTP 402 payments
- EIP-712 signing helpers

### Deployments

**Sepolia Testnet:**
- SolverRegistry: `0xB6ab964832808E49635fF82D1996D6a888ecB745`
- IntentReceiptHub: `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c`
- DisputeModule: `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D`

### Technical
- Solidity ^0.8.25, Foundry, 325 tests passing
- Optimizer: 200 runs, via-ir enabled

---

## [0.9.0] - 2026-01-25

Dashboard and subgraph release.

### Added
- Solver reputation dashboard (Next.js + Firebase)
- The Graph subgraph for indexing
- TypeScript SDK (`irsb`)
- Across Protocol pilot adapter
- Firebase deployment with Workload Identity Federation

### Fixed
- Subgraph query types
- Dashboard mobile navigation
- SSRF vulnerability

### Documentation
- 25,000+ word feasibility report
- Auditor outreach templates

---

## [0.5.0] - 2026-01-16

Dispute module release.

### Added
- `DisputeModule` with deterministic resolution
- Timeout-based disputes
- Challenger bond mechanism
- Reputation decay for inactive solvers

---

## [0.1.0] - 2026-01-14

Initial MVP release.

### Added
- `SolverRegistry`: Registration, bonding, slashing, reputation
- `IntentReceiptHub`: Receipts, disputes, finalization
- Test suite (95 tests)
- Foundry project structure

---

## [0.0.1] - 2026-01-14

Project initialization.

### Added
- Initial documentation
- CLAUDE.md architecture guide

---

[Unreleased]: https://github.com/intent-solutions-io/irsb-protocol/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/intent-solutions-io/irsb-protocol/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/intent-solutions-io/irsb-protocol/releases/tag/v1.0.0
[0.9.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v0.5.0...v0.9.0
[0.5.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/intent-solutions-io/irsb-protocol/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/intent-solutions-io/irsb-protocol/commits/v0.0.1
