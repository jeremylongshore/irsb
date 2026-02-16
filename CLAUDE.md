# CLAUDE.md — IRSB Agents

## Workspace Overview

**irsb-agents** v0.2.0 — Two AI agents for the IRSB (Intent Receipts & Solver Bonds) protocol:

| Agent | Purpose | Status |
|-------|---------|--------|
| **Builder** | Answer IRSB questions grounded in code, produce implementation plans | Phase 1 (active) |
| **Money** | Research protocols, qualify leads, draft outreach for integration pilots | Phase 2 (stub) |

Both agents share a RAG knowledge base indexed from all IRSB repos + ERC/EIP specs.

**Key capability**: Z3-based formal verification for policy constraint validation (see `shared/core/verifier.py` and `000-docs/002-DR-ARCH-formal-verification.md`).

## Project Structure

```
irsb-agents/
├── shared/              # Shared RAG infrastructure
│   ├── core/            # Config, models, pipeline, policy, ledger, router, providers
│   ├── corpus/          # Repo cloning + document indexing
│   └── chain/           # Read-only on-chain queries (web3.py)
├── builder/             # Builder Agent
├── money/               # Money Agent
├── api/                 # FastAPI server
├── tests/               # All tests
├── 000-docs/            # Flat docs (NNN-CC-ABCD format)
└── docker-compose.yml   # Ollama + API (local dev)
```

## Build, Test, Lint

```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Test
pytest tests/ -v

# Lint
ruff check .

# Type check
mypy shared/ --ignore-missing-imports

# Run API (requires Ollama running)
uvicorn api.server:app --reload

# Index IRSB corpus
python -m shared.corpus.ingestor

# Docker (includes Ollama)
docker compose up
```

## Key Patterns

| Pattern | Implementation |
|---------|----------------|
| Config | Env-based (`Config` class), local-first defaults |
| LLM providers | Abstract base + Ollama/Anthropic/Vertex implementations |
| RAG | LangChain + ChromaDB, language-aware chunking |
| Safety | PolicyRedactor truncates snippets for cloud LLMs |
| Audit | SQLite RunLedger — every query/index logged |
| On-chain | web3.py read-only against Sepolia contracts |

## IRSB Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |
| ERC-8004 Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Agent ID | `967` |

## Conventions

- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- **Docs**: `000-docs/` flat dir, `NNN-CC-ABCD-description.md` naming
- **Tests**: pytest, co-located in `tests/`
- **Python**: 3.11+, ruff for linting, mypy for types
