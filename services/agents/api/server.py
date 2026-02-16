"""
FastAPI server for IRSB Agents.
Exposes Builder + Money agent endpoints and shared health/audit routes.
"""

import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.middleware import add_verification_middleware
from builder.agent import BuilderAgent
from builder.reviewer import ReviewRequest, ReviewResponse
from shared.chain.reader import ChainReader
from shared.core.config import Config
from shared.core.ledger import RunLedger
from shared.core.models import (
    HealthStatus,
    IndexRequest,
    IndexResult,
    PlanRequest,
    PlanResponse,
    QueryRequest,
    QueryResponse,
)
from shared.core.rag_pipeline import RAGPipeline
from shared.corpus.ingestor import IRSB_REPOS

app = FastAPI(
    title="IRSB Agents API",
    description="Builder Agent + Money Agent — RAG-grounded protocol intelligence",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Formal verification middleware — gates all tool-like requests through Z3 constraints.
# Must be added after CORS (Starlette middleware executes in reverse add order).
_verifier = add_verification_middleware(app)

_pipelines: dict[str, RAGPipeline] = {}
_agents: dict[str, BuilderAgent] = {}
_start_time = time.time()
_ledger = RunLedger()
_chain_reader = ChainReader()


def get_pipeline(workspace_id: str = "irsb") -> RAGPipeline:
    if workspace_id not in _pipelines:
        _pipelines[workspace_id] = RAGPipeline(workspace_id=workspace_id)
    return _pipelines[workspace_id]


def get_builder_agent(workspace_id: str = "irsb") -> BuilderAgent:
    if workspace_id not in _agents:
        pipeline = get_pipeline(workspace_id)
        _agents[workspace_id] = BuilderAgent(pipeline=pipeline)
    return _agents[workspace_id]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthStatus)
async def health():
    pipeline = get_pipeline()
    vs = pipeline._get_vectorstore()
    doc_count = vs._collection.count() if vs else 0

    return HealthStatus(
        status="healthy" if vs else "degraded",
        mode=Config.NEXUS_MODE.value,
        llm_provider=Config.NEXUS_LLM_PROVIDER.value,
        embed_provider=Config.NEXUS_EMBED_PROVIDER.value,
        vector_store_ready=vs is not None,
        documents_indexed=doc_count,
        corpus_repos=len(IRSB_REPOS),
        uptime_seconds=time.time() - _start_time,
    )


# ---------------------------------------------------------------------------
# Builder Agent endpoints
# ---------------------------------------------------------------------------

@app.post("/builder/query", response_model=QueryResponse)
async def builder_query(request: QueryRequest):
    """Query IRSB knowledge base with grounded citations."""
    try:
        pipeline = get_pipeline(request.workspace_id)
        return pipeline.query(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/builder/plan", response_model=PlanResponse)
async def builder_plan(request: PlanRequest):
    """Generate RAG-grounded implementation plan for an IRSB feature."""
    try:
        agent = get_builder_agent(request.workspace_id)
        return agent.plan(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/builder/review", response_model=ReviewResponse)
async def builder_review(request: ReviewRequest):
    """Review a code diff for IRSB patterns, security, and test coverage."""
    try:
        agent = get_builder_agent(request.workspace_id)
        return agent.review(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/builder/chain/{query_type}")
async def builder_chain(query_type: str, id: str = ""):
    """Read-only on-chain queries against IRSB Sepolia contracts."""
    try:
        if query_type == "solver" and id:
            return _chain_reader.get_solver_info(bytes.fromhex(id))
        elif query_type == "receipt" and id:
            return _chain_reader.get_receipt(bytes.fromhex(id))
        elif query_type == "agent" and id:
            uri = _chain_reader.get_agent_uri(int(id))
            return {"agent_id": id, "uri": uri}
        elif query_type == "status":
            return {"connected": _chain_reader.is_connected(), "rpc_url": "***"}
        else:
            raise HTTPException(
                status_code=400,
                detail="Valid query types: solver, receipt, agent, status. "
                "Provide 'id' param for solver/receipt/agent.",
            )
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid 'id' format for query type '{query_type}'.",
        )


# ---------------------------------------------------------------------------
# Money Agent endpoints (Phase 2 stubs)
# ---------------------------------------------------------------------------

@app.post("/money/research")
async def money_research():
    """Research a protocol for IRSB fit (Phase 2)."""
    raise HTTPException(status_code=501, detail="Money agent ships in Phase 2")


@app.post("/money/outreach")
async def money_outreach():
    """Generate outreach draft (Phase 2)."""
    raise HTTPException(status_code=501, detail="Money agent ships in Phase 2")


@app.get("/money/pipeline")
async def money_pipeline():
    """Get lead pipeline (Phase 2)."""
    raise HTTPException(status_code=501, detail="Money agent ships in Phase 2")


# ---------------------------------------------------------------------------
# Corpus management
# ---------------------------------------------------------------------------

@app.post("/index", response_model=IndexResult)
async def index_documents(request: IndexRequest):
    """Index documents into workspace."""
    try:
        pipeline = get_pipeline(request.workspace_id)
        return pipeline.index_documents(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Audit ledger
# ---------------------------------------------------------------------------

@app.get("/runs")
async def list_runs(
    workspace_id: str | None = None,
    run_type: str = "all",
    limit: int = 100,
):
    return _ledger.list_runs(workspace_id=workspace_id, run_type=run_type, limit=limit)


@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    run = _ledger.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "service": "IRSB Agents API",
        "version": "0.1.0",
        "agents": {
            "builder": {
                "status": "phase-1",
                "endpoints": [
                    "/builder/query",
                    "/builder/plan",
                    "/builder/review",
                    "/builder/chain/{query_type}",
                ],
            },
            "money": {
                "status": "phase-2-stub",
                "endpoints": ["/money/research", "/money/outreach", "/money/pipeline"],
            },
        },
        "shared": ["/health", "/index", "/runs"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=Config.API_HOST, port=Config.API_PORT)
