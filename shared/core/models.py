"""
Pydantic models for IRSB Agents RAG pipeline.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Documents & Chunks
# ---------------------------------------------------------------------------

class DocumentSource(BaseModel):
    """Tracked source file."""

    file_path: str
    file_hash: str
    file_mtime: float
    indexed_at: datetime


class DocumentChunk(BaseModel):
    """A chunk of text with provenance."""

    content: str
    source: str
    page: int | None = None
    chunk_index: int
    language: str | None = None  # "solidity", "typescript", "markdown", etc.
    embedding_hash: str | None = None


# ---------------------------------------------------------------------------
# Citations
# ---------------------------------------------------------------------------

class Citation(BaseModel):
    """Citation for a retrieved chunk."""

    source: str
    page: int | None = None
    excerpt: str
    relevance_score: float
    content_hash: str


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=5000)
    workspace_id: str = Field(default="irsb")
    max_results: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    question: str
    answer: str
    citations: list[Citation]
    workspace_id: str
    model_used: str
    provider: str
    latency_ms: float
    run_id: str
    timestamp: datetime


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------

class IndexRequest(BaseModel):
    paths: list[str]
    workspace_id: str = Field(default="irsb")
    force_reindex: bool = False


class IndexResult(BaseModel):
    workspace_id: str
    files_processed: int
    files_skipped: int
    total_chunks: int
    processing_time_ms: float
    document_sources: list[DocumentSource]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthStatus(BaseModel):
    status: str  # healthy | degraded | unhealthy
    mode: str
    llm_provider: str
    embed_provider: str
    vector_store_ready: bool
    documents_indexed: int
    corpus_repos: int
    uptime_seconds: float


# ---------------------------------------------------------------------------
# Ledger
# ---------------------------------------------------------------------------

class RunLedgerEntry(BaseModel):
    run_id: str
    workspace_id: str
    timestamp: datetime
    operation: str  # query | index | plan | research
    model_used: str
    provider: str
    document_hashes: list[str]
    excerpt_hashes: list[str]
    latency_ms: float
    success: bool
    error_message: str | None = None


# ---------------------------------------------------------------------------
# Builder-specific (Phase 1 stubs)
# ---------------------------------------------------------------------------

class PlanRequest(BaseModel):
    """Request builder agent to plan a feature."""

    feature: str = Field(..., min_length=1, max_length=10000)
    workspace_id: str = Field(default="irsb")


class PlanResponse(BaseModel):
    """Builder agent implementation plan."""

    feature: str
    plan: str
    files_to_modify: list[str]
    tests_to_add: list[str]
    citations: list[Citation]
    run_id: str
    timestamp: datetime


# ---------------------------------------------------------------------------
# Money-specific (Phase 2 stubs)
# ---------------------------------------------------------------------------

class ResearchRequest(BaseModel):
    """Request money agent to research a protocol."""

    protocol: str = Field(..., min_length=1)
    focus: str | None = None


class ResearchResponse(BaseModel):
    """Money agent research result."""

    protocol: str
    analysis: str
    irsb_fit_score: float = Field(ge=0.0, le=1.0)
    citations: list[Citation]
    run_id: str
    timestamp: datetime


class PipelineStage(StrEnum):
    IDENTIFIED = "identified"
    RESEARCHED = "researched"
    QUALIFIED = "qualified"
    OUTREACH_DRAFTED = "outreach_drafted"
    OUTREACH_SENT = "outreach_sent"
    RESPONDED = "responded"
    PILOT_STARTED = "pilot_started"
    CONVERTED = "converted"
    LOST = "lost"
