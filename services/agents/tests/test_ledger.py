"""Tests for shared.core.ledger."""

import os
import tempfile
from datetime import datetime

from shared.core.ledger import RunLedger
from shared.core.models import Citation, DocumentSource, IndexResult, QueryResponse


def _make_ledger() -> RunLedger:
    """Create a ledger with a temp database."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return RunLedger(db_path=path)


def test_record_and_list_index_run():
    ledger = _make_ledger()
    result = IndexResult(
        workspace_id="test",
        files_processed=5,
        files_skipped=1,
        total_chunks=50,
        processing_time_ms=100.0,
        document_sources=[
            DocumentSource(
                file_path="/tmp/test.sol",
                file_hash="abc",
                file_mtime=1000.0,
                indexed_at=datetime.now(),
            )
        ],
    )
    run_id = ledger.record_index_run(result, "OllamaEmbeddingProvider")
    assert run_id.startswith("idx_test_")

    runs = ledger.list_runs(workspace_id="test", run_type="index")
    assert len(runs["index_runs"]) == 1


def test_record_and_list_query_run():
    ledger = _make_ledger()
    response = QueryResponse(
        question="What is IRSB?",
        answer="IRSB is...",
        citations=[
            Citation(
                source="test.md",
                excerpt="IRSB stands for...",
                relevance_score=1.0,
                content_hash="xyz",
            )
        ],
        workspace_id="test",
        model_used="llama3",
        provider="OllamaLLMProvider",
        latency_ms=200.0,
        run_id="q_001",
        timestamp=datetime.now(),
    )
    run_id = ledger.record_query_run(response, ["hash1", "hash2"])
    assert run_id == "q_001"

    runs = ledger.list_runs(run_type="query")
    assert len(runs["query_runs"]) == 1


def test_get_run_not_found():
    ledger = _make_ledger()
    assert ledger.get_run("nonexistent") is None


def test_get_run_found():
    ledger = _make_ledger()
    response = QueryResponse(
        question="test",
        answer="answer",
        citations=[],
        workspace_id="test",
        model_used="llama3",
        provider="Ollama",
        latency_ms=10.0,
        run_id="findme",
        timestamp=datetime.now(),
    )
    ledger.record_query_run(response)
    found = ledger.get_run("findme")
    assert found is not None
    assert found["run_id"] == "findme"
