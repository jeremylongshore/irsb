"""Tests for API server endpoints."""

import pytest
from fastapi.testclient import TestClient

from api.server import app


@pytest.fixture
def client():
    return TestClient(app)


def test_root(client):
    """Root endpoint returns service info."""
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "IRSB Agents API"
    assert "builder" in data["agents"]
    assert "money" in data["agents"]


def test_health(client):
    """Health endpoint returns status."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("healthy", "degraded")
    assert "llm_provider" in data


def test_builder_plan_requires_body(client):
    """Builder plan requires a request body with 'feature' field."""
    resp = client.post("/builder/plan", json={})
    assert resp.status_code == 422  # validation error — missing 'feature'


def test_builder_review_requires_body(client):
    """Builder review requires a request body with 'diff' field."""
    resp = client.post("/builder/review", json={})
    assert resp.status_code == 422


def test_builder_chain_status(client):
    """Builder chain status endpoint returns connection info."""
    resp = client.get("/builder/chain/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "connected" in data


def test_builder_chain_bad_query_type(client):
    """Builder chain rejects unknown query type."""
    resp = client.get("/builder/chain/unknown")
    assert resp.status_code == 400


def test_builder_chain_invalid_hex_id(client):
    """Builder chain returns 400 for invalid hex id."""
    resp = client.get("/builder/chain/solver?id=not_valid_hex")
    assert resp.status_code == 400
    assert "Invalid" in resp.json()["detail"]


def test_money_research_returns_501(client):
    """Money research returns 501 (Phase 2 stub)."""
    resp = client.post("/money/research")
    assert resp.status_code == 501


def test_money_outreach_returns_501(client):
    """Money outreach returns 501 (Phase 2 stub)."""
    resp = client.post("/money/outreach")
    assert resp.status_code == 501


def test_money_pipeline_returns_501(client):
    """Money pipeline returns 501 (Phase 2 stub)."""
    resp = client.get("/money/pipeline")
    assert resp.status_code == 501


def test_runs_endpoint(client):
    """Runs endpoint returns audit data."""
    resp = client.get("/runs")
    assert resp.status_code == 200
    data = resp.json()
    assert "index_runs" in data
    assert "query_runs" in data


def test_run_not_found(client):
    """Getting nonexistent run returns 404."""
    resp = client.get("/runs/nonexistent")
    assert resp.status_code == 404
