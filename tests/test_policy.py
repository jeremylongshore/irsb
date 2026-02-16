"""Tests for shared.core.policy."""

from shared.core.models import Citation
from shared.core.policy import PolicyRedactor


def test_redact_truncates_long_snippets():
    """Safe mode truncates snippets beyond max length."""
    redactor = PolicyRedactor(hybrid_safe_mode=True, max_snippet_length=200)
    citations = [
        Citation(
            source="test.sol",
            excerpt="A" * 500,
            relevance_score=1.0,
            content_hash="abc",
        )
    ]
    context, hashes = redactor.redact_snippets(citations)
    # Excerpt truncated to 200 chars + "..."
    assert len(context) < 500
    assert "..." in context
    assert len(hashes) == 1


def test_redact_preserves_short_snippets():
    """Short snippets pass through unchanged."""
    redactor = PolicyRedactor(hybrid_safe_mode=True, max_snippet_length=500)
    citations = [
        Citation(
            source="test.sol",
            excerpt="short snippet",
            relevance_score=1.0,
            content_hash="abc",
        )
    ]
    context, hashes = redactor.redact_snippets(citations)
    assert "short snippet" in context


def test_validate_outbound_rejects_huge_payload():
    """Outbound validation rejects oversized payloads."""
    redactor = PolicyRedactor(hybrid_safe_mode=True, max_snippet_length=100)
    assert redactor.validate_outbound_payload("small") is True
    assert redactor.validate_outbound_payload("X" * 10000) is False


def test_safe_mode_off_no_truncation():
    """With safe mode off, no truncation happens."""
    redactor = PolicyRedactor(hybrid_safe_mode=False, max_snippet_length=50)
    citations = [
        Citation(
            source="test.sol",
            excerpt="A" * 200,
            relevance_score=1.0,
            content_hash="abc",
        )
    ]
    context, _ = redactor.redact_snippets(citations)
    assert "..." not in context


def test_excerpt_hashes_are_sha256():
    """Excerpt hashes are proper SHA-256."""
    redactor = PolicyRedactor()
    citations = [
        Citation(
            source="test.sol",
            excerpt="hello world",
            relevance_score=1.0,
            content_hash="abc",
        )
    ]
    _, hashes = redactor.redact_snippets(citations)
    assert len(hashes[0]) == 64  # SHA-256 hex digest
