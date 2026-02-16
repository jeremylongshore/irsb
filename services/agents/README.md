# IRSB Agents

> Builder Agent + Money Agent — RAG-grounded protocol intelligence for [IRSB](https://github.com/intent-solutions-io).

## Overview

IRSB (Intent Receipts & Solver Bonds) is Ethereum's accountability layer for intent-based transactions. This repo contains two AI agents that operate over the IRSB knowledge base:

- **Builder Agent** — answers technical questions grounded in actual code, produces implementation plans with file paths and diffs
- **Money Agent** — researches protocols for integration fit, qualifies leads, drafts personalized outreach

Both agents share a RAG pipeline backed by ChromaDB, with the full IRSB corpus (4 repos + ERC specs) indexed and citable.

## Quick Start

```bash
# Clone
git clone https://github.com/intent-solutions-io/irsb-agents.git
cd irsb-agents

# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Pull Ollama model
ollama pull llama3

# Index IRSB corpus (clones repos, indexes all files)
python -m shared.corpus.ingestor

# Start API
uvicorn api.server:app --reload
# → http://localhost:8000/health
```

## Docker

```bash
docker compose up
# Ollama on :11434, API on :8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with corpus stats |
| `/builder/query` | POST | Query IRSB knowledge base |
| `/builder/plan` | POST | Generate implementation plan (Phase 1) |
| `/money/research` | POST | Research protocol for IRSB fit (Phase 2) |
| `/money/outreach` | POST | Draft outreach message (Phase 2) |
| `/money/pipeline` | GET | View lead pipeline (Phase 2) |
| `/index` | POST | Index documents into workspace |
| `/runs` | GET | Audit trail |

## Architecture

```
shared/          RAG pipeline, corpus ingestion, on-chain reader
├── core/        Config, models, providers, pipeline, policy, ledger
├── corpus/      Clone repos, discover files, index into ChromaDB
└── chain/       Read-only web3.py queries against Sepolia

builder/         Builder Agent (code Q&A, planning)
money/           Money Agent (research, outreach, pipeline)
api/             FastAPI server exposing both agents
```

## Configuration

Copy `.env.example` to `.env`. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_MODE` | `local` | `local` / `cloud` / `hybrid` |
| `NEXUS_LLM_PROVIDER` | `ollama` | `ollama` / `anthropic` / `vertex` |
| `OLLAMA_MODEL` | `llama3` | Local model name |
| `SEPOLIA_RPC_URL` | `https://rpc.sepolia.org` | Ethereum RPC |

## License

MIT
