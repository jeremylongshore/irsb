"""Tests for shared.core.models."""

from datetime import datetime

from shared.core.models import (
    Citation,
    DocumentSource,
    HealthStatus,
    IndexResult,
    PipelineStage,
    QueryRequest,
)


def test_query_request_defaults():
    req = QueryRequest(question="How does IntentReceiptHub work?")
    assert req.workspace_id == "irsb"
    assert req.max_results == 5


def test_citation_model():
    cit = Citation(
        source="protocol/src/IntentReceiptHub.sol",
        excerpt="function submitReceipt...",
        relevance_score=0.95,
        content_hash="abc123",
    )
    assert cit.page is None
    assert cit.source.endswith(".sol")


def test_health_status():
    h = HealthStatus(
        status="healthy",
        mode="local",
        llm_provider="ollama",
        embed_provider="ollama",
        vector_store_ready=True,
        documents_indexed=500,
        corpus_repos=4,
        uptime_seconds=120.0,
    )
    assert h.status == "healthy"


def test_pipeline_stages():
    """Pipeline stages cover the full lead lifecycle."""
    stages = [s.value for s in PipelineStage]
    assert "identified" in stages
    assert "converted" in stages
    assert "lost" in stages
    assert len(stages) == 9


def test_index_result():
    result = IndexResult(
        workspace_id="irsb",
        files_processed=10,
        files_skipped=2,
        total_chunks=100,
        processing_time_ms=500.0,
        document_sources=[
            DocumentSource(
                file_path="/tmp/test.sol",
                file_hash="abc",
                file_mtime=1000.0,
                indexed_at=datetime.now(),
            )
        ],
    )
    assert result.files_processed == 10
    assert len(result.document_sources) == 1
