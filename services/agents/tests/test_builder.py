"""Tests for Builder Agent: planner, reviewer, and agent orchestration."""

from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from builder.planner import BuilderPlanner
from builder.prompts import BUILDER_SYSTEM_PROMPT, PLAN_TEMPLATE, REVIEW_TEMPLATE
from builder.reviewer import (
    BuilderReviewer,
    ReviewRequest,
    ReviewResponse,
)
from shared.core.models import PlanRequest, PlanResponse

# ---------------------------------------------------------------------------
# Prompt tests
# ---------------------------------------------------------------------------


def test_builder_system_prompt_contains_key_concepts():
    """System prompt references core IRSB concepts."""
    for concept in (
        "IntentReceiptHub",
        "SolverRegistry",
        "DisputeModule",
        "WalletDelegate",
        "ERC-8004",
        "EIP-7702",
    ):
        assert concept in BUILDER_SYSTEM_PROMPT, f"Missing concept: {concept}"


def test_plan_template_has_placeholders():
    """Plan template has {feature} and {context} placeholders."""
    assert "{feature}" in PLAN_TEMPLATE
    assert "{context}" in PLAN_TEMPLATE


def test_review_template_has_placeholders():
    """Review template has required placeholders."""
    assert "{diff}" in REVIEW_TEMPLATE
    assert "{file_path}" in REVIEW_TEMPLATE
    assert "{context}" in REVIEW_TEMPLATE


# ---------------------------------------------------------------------------
# Planner tests
# ---------------------------------------------------------------------------


class TestBuilderPlanner:
    """Tests for BuilderPlanner."""

    def _make_planner(self, llm_response: str = "Plan text") -> BuilderPlanner:
        """Create a planner with mocked pipeline."""
        mock_pipeline = MagicMock()
        mock_pipeline.llm_provider = MagicMock()
        mock_pipeline.llm_provider.generate.return_value = llm_response
        mock_pipeline.llm_provider.get_model_name.return_value = "test-model"
        mock_pipeline.workspace_id = "irsb"
        mock_pipeline.ledger = MagicMock()
        mock_pipeline._get_vectorstore.return_value = None
        return BuilderPlanner(mock_pipeline)

    def test_extract_file_paths_backtick(self):
        """Extract backtick-wrapped file paths from plan text."""
        text = "Modify `src/hub.sol` and `test/hub.test.ts` for the change."
        paths = BuilderPlanner._extract_file_paths(text)
        assert "src/hub.sol" in paths
        assert "test/hub.test.ts" in paths

    def test_extract_file_paths_bare(self):
        """Extract bare paths starting with known prefixes."""
        text = "Update protocol/src/IntentReceiptHub.sol and solver/src/main.ts"
        paths = BuilderPlanner._extract_file_paths(text)
        assert "protocol/src/IntentReceiptHub.sol" in paths
        assert "solver/src/main.ts" in paths

    def test_extract_file_paths_ignores_urls(self):
        """HTTP URLs should not be extracted as file paths."""
        text = "See `https://example.com/foo.ts` for details."
        paths = BuilderPlanner._extract_file_paths(text)
        assert not any("https" in p for p in paths)

    def test_extract_test_files(self):
        """Extract test file references from plan text."""
        text = "Add `test/hub.test.ts` and `src/utils.spec.ts` with new cases."
        tests = BuilderPlanner._extract_test_files(text)
        assert "test/hub.test.ts" in tests
        assert "src/utils.spec.ts" in tests

    def test_plan_returns_plan_response(self):
        """Planner returns a structured PlanResponse."""
        planner = self._make_planner(
            "Modify `src/hub.sol` and add `test/hub.test.ts`.\nDone."
        )
        request = PlanRequest(feature="Add a BondHealthRule")
        response = planner.plan(request)

        assert isinstance(response, PlanResponse)
        assert response.feature == "Add a BondHealthRule"
        assert "src/hub.sol" in response.files_to_modify
        assert "test/hub.test.ts" in response.tests_to_add
        assert response.run_id  # non-empty
        assert response.timestamp

    def test_plan_with_empty_vectorstore(self):
        """Planner works when no vectorstore is available (empty corpus)."""
        planner = self._make_planner("No context available. Basic plan here.")
        request = PlanRequest(feature="Add something")
        response = planner.plan(request)
        assert response.citations == []


# ---------------------------------------------------------------------------
# Reviewer tests
# ---------------------------------------------------------------------------


class TestBuilderReviewer:
    """Tests for BuilderReviewer."""

    def _make_reviewer(self, llm_response: str = "SUGGESTION: looks good") -> BuilderReviewer:
        """Create a reviewer with mocked pipeline."""
        mock_pipeline = MagicMock()
        mock_pipeline.llm_provider = MagicMock()
        mock_pipeline.llm_provider.generate.return_value = llm_response
        return BuilderReviewer(mock_pipeline)

    def test_parse_critical_finding(self):
        """Parse CRITICAL severity findings."""
        raw = "CRITICAL: Reentrancy vulnerability in withdraw function"
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 1
        assert findings[0].severity == "critical"
        assert findings[0].category == "security"

    def test_parse_warning_finding(self):
        """Parse WARNING severity findings."""
        raw = "WARNING: Missing test coverage for edge case"
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 1
        assert findings[0].severity == "warning"
        assert findings[0].category == "testing"

    def test_parse_suggestion_finding(self):
        """Parse SUGGESTION severity findings."""
        raw = "SUGGESTION: Consider using gas-efficient pattern"
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 1
        assert findings[0].severity == "suggestion"
        assert findings[0].category == "performance"

    def test_parse_praise_finding(self):
        """Parse PRAISE severity findings."""
        raw = "PRAISE: Great test coverage"
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 1
        assert findings[0].severity == "praise"
        assert findings[0].category == "testing"

    def test_parse_bold_format(self):
        """Parse bold-wrapped severity prefixes like **CRITICAL**:."""
        raw = "**CRITICAL**: Access control bypass in admin function"
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 1
        assert findings[0].severity == "critical"
        assert findings[0].category == "security"

    def test_parse_multiple_findings(self):
        """Parse multiple findings from multi-line output."""
        raw = (
            "CRITICAL: Reentrancy in withdraw\n"
            "WARNING: Missing test for edge case\n"
            "SUGGESTION: Use naming convention for events\n"
            "PRAISE: Good use of access control\n"
        )
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 4
        severities = [f.severity for f in findings]
        assert "critical" in severities
        assert "warning" in severities
        assert "suggestion" in severities
        assert "praise" in severities

    def test_fallback_finding_when_no_structured_output(self):
        """Falls back to generic finding when LLM output has no structure."""
        raw = "This code looks fine overall, no major issues."
        findings = BuilderReviewer._parse_findings(raw)
        assert len(findings) == 1
        assert findings[0].severity == "suggestion"
        assert "See summary" in findings[0].message

    def test_extract_test_suggestions(self):
        """Extract test suggestions from review text."""
        raw = (
            "Missing test suggestions:\n"
            "- Test the revert case for invalid input\n"
            "- Test the happy path with valid receipt\n"
            "\n"
            "Overall the code is solid."
        )
        suggestions = BuilderReviewer._extract_test_suggestions(raw)
        assert len(suggestions) == 2
        assert "revert case" in suggestions[0]

    def test_extract_summary(self):
        """Extract summary from the first paragraph."""
        raw = "This diff adds a new rule to the watchtower.\nIt follows existing patterns.\n\nCRITICAL: None"
        summary = BuilderReviewer._extract_summary(raw)
        assert "new rule" in summary

    def test_review_returns_response(self):
        """Full review flow returns ReviewResponse."""
        reviewer = self._make_reviewer(
            "Good code overall.\n\nSUGGESTION: Add more tests\nPRAISE: Clean structure"
        )
        request = ReviewRequest(
            diff="+ function foo() { return 1; }",
            file_path="src/foo.sol",
        )
        response = reviewer.review(request)

        assert isinstance(response, ReviewResponse)
        assert response.approved is True  # no CRITICAL findings
        assert len(response.findings) >= 1
        assert response.run_id
        assert response.timestamp

    def test_review_not_approved_on_critical(self):
        """Review is not approved when CRITICAL findings exist."""
        reviewer = self._make_reviewer(
            "CRITICAL: Reentrancy vulnerability found"
        )
        request = ReviewRequest(diff="+ // bad code")
        response = reviewer.review(request)
        assert response.approved is False

    def test_review_request_validation(self):
        """ReviewRequest validates diff length."""
        with pytest.raises(ValidationError):
            ReviewRequest(diff="")  # min_length=1


# ---------------------------------------------------------------------------
# Agent orchestration tests
# ---------------------------------------------------------------------------


class TestBuilderAgent:
    """Tests for BuilderAgent orchestration."""

    def test_agent_has_planner_and_reviewer(self):
        """BuilderAgent initializes planner and reviewer."""
        from builder.agent import BuilderAgent

        mock_pipeline = MagicMock()
        mock_pipeline.llm_provider = MagicMock()
        agent = BuilderAgent(pipeline=mock_pipeline)

        assert agent.planner is not None
        assert agent.reviewer is not None
        assert isinstance(agent.planner, BuilderPlanner)
        assert isinstance(agent.reviewer, BuilderReviewer)
