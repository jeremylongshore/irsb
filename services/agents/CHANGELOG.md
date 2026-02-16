# Changelog

All notable changes to IRSB Agents will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.2.0] - 2026-02-12

Z3 formal agent verification and prompt injection hardening.

### Added

- **Z3 Formal Verifier** (`shared/core/verifier.py`) — SMT-based constraint checking for AI agent tool calls
  - 9 constraints across 6 categories: FILE_ACCESS, COMMAND_EXEC, DATA_EXFIL, NETWORK, RESOURCE_LIMIT, PERMISSION
  - Z3 string theory for path traversal detection
  - Z3 integer arithmetic for resource/transaction limits
  - Fail-closed design: solver timeout or errors → PROVEN_UNSAFE
- **Verifier Configuration** (`shared/core/verifier_config.py`) — environment-based constraint tuning
  - Safe paths, hosts, commands via `VERIFIER_*` env vars
  - Transaction value limits for Phase 3 signing capabilities
- **Verification Middleware** (`api/middleware.py`) — gates all POST requests through Z3 verification
  - Returns 403 with violation details on PROVEN_UNSAFE
  - Adds X-Verification-Result headers to responses
- **Prompt Injection Hardening** in RAG pipeline
  - Input sanitization: control characters stripped, injection patterns detected
  - System prompt hardening: explicit instruction to ignore embedded instructions
  - Output validation: truncation at 20k chars to prevent runaway generation
- **70 new tests** (51 verifier + 19 prompt injection), 138 total passing
- **ADR** (`000-docs/002-DR-ARCH-formal-verification.md`)

### Security

- Mitigates **PM-AG-002** (CRITICAL: zero prompt injection defense) from pre-mortem analysis
- Provides mathematical proof of constraint satisfaction vs probabilistic LLM-as-judge

### Dependencies

- Added `z3-solver>=4.12.0`

---

## [0.1.0] - 2026-02-11

Initial release of IRSB Agents with Builder Agent MVP.

### Added

#### Phase 0: Scaffold
- RAG pipeline with LangChain + ChromaDB
- Corpus ingestor for IRSB repos + ERC/EIP specs
- Language-aware chunking (Solidity, TypeScript, Python, Markdown)
- Multi-provider LLM support (Ollama local-first, Anthropic, Vertex AI)
- Policy redactor for cloud LLM safety
- SQLite RunLedger for audit logging
- FastAPI server scaffold
- Docker Compose with Ollama

#### Phase 1: Builder Agent MVP
- Planning mode with step-by-step implementation plans
- Code review mode with quality/security analysis
- On-chain reader for Sepolia contracts (SolverRegistry, IntentReceiptHub, DisputeModule)
- Web3.py integration for read-only queries
- 42 passing tests, ruff clean, mypy clean

### Technical
- Python 3.11+ required
- Local-first architecture (Ollama default, cloud optional)
- MIT licensed
