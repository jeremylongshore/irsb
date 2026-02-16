"""
Builder reviewer — reviews code diffs for IRSB patterns, security, and test coverage.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from shared.core.rag_pipeline import RAGPipeline

from .prompts import BUILDER_SYSTEM_PROMPT, REVIEW_TEMPLATE


class ReviewRequest(BaseModel):
    """Request to review a code diff."""

    diff: str = Field(..., min_length=1, max_length=50000)
    file_path: str = Field(default="")
    context: str = Field(default="")
    workspace_id: str = Field(default="irsb")


class ReviewFinding(BaseModel):
    """A single finding from code review."""

    severity: str  # critical | warning | suggestion | praise
    category: str  # security | pattern | testing | performance | style
    message: str
    line_hint: str = ""


class ReviewResponse(BaseModel):
    """Code review result."""

    summary: str
    findings: list[ReviewFinding]
    tests_suggested: list[str]
    approved: bool
    run_id: str
    timestamp: datetime


_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "security": ("reentrancy", "overflow", "injection", "auth", "access", "key", "secret"),
    "testing": ("test", "coverage", "assert"),
    "performance": ("gas", "memory", "latency", "cache"),
    "pattern": ("pattern", "convention", "naming", "structure"),
}


def _detect_category(message: str) -> str:
    """Detect finding category from message keywords."""
    lower = message.lower()
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(w in lower for w in keywords):
            return cat
    return "style"


class BuilderReviewer:
    """Reviews code for IRSB pattern compliance, security, and test coverage."""

    def __init__(self, pipeline: RAGPipeline):
        self.pipeline = pipeline

    def review(self, request: ReviewRequest) -> ReviewResponse:
        """
        Review a code diff.

        1. Analyze diff for IRSB patterns
        2. Check for security issues
        3. Suggest missing tests
        4. Generate structured review
        """
        run_id = str(uuid.uuid4())

        prompt = self._build_prompt(request)
        raw_review = self.pipeline.llm_provider.generate(prompt, temperature=0.2)

        findings = self._parse_findings(raw_review)
        tests_suggested = self._extract_test_suggestions(raw_review)

        has_critical = any(f.severity == "critical" for f in findings)

        return ReviewResponse(
            summary=self._extract_summary(raw_review),
            findings=findings,
            tests_suggested=tests_suggested,
            approved=not has_critical,
            run_id=run_id,
            timestamp=datetime.now(),
        )

    def _build_prompt(self, request: ReviewRequest) -> str:
        context = request.context or "No additional context provided."
        return f"""{BUILDER_SYSTEM_PROMPT}

{REVIEW_TEMPLATE.format(
    diff=request.diff[:10000],
    file_path=request.file_path or "unknown",
    context=context,
)}"""

    @staticmethod
    def _parse_findings(raw_review: str) -> list[ReviewFinding]:
        """Parse structured findings from LLM output."""
        findings: list[ReviewFinding] = []
        lines = raw_review.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Match patterns like "CRITICAL:", "WARNING:", "SUGGESTION:", "PRAISE:"
            for severity in ("critical", "warning", "suggestion", "praise"):
                upper = severity.upper()
                if line.startswith(f"{upper}:") or line.startswith(f"**{upper}**:"):
                    message = line.split(":", 1)[1].strip() if ":" in line else line
                    category = _detect_category(message)

                    findings.append(ReviewFinding(
                        severity=severity,
                        category=category,
                        message=message,
                    ))
                    break

        # If no structured findings parsed, create a generic one from the summary
        if not findings:
            findings.append(ReviewFinding(
                severity="suggestion",
                category="style",
                message="Review completed. See summary for details.",
            ))

        return findings

    @staticmethod
    def _extract_test_suggestions(raw_review: str) -> list[str]:
        """Extract test suggestions from review text."""
        suggestions: list[str] = []
        in_test_section = False

        for line in raw_review.split("\n"):
            stripped = line.strip()
            if "test" in stripped.lower() and ("suggest" in stripped.lower() or "add" in stripped.lower() or "missing" in stripped.lower()):
                in_test_section = True
                continue
            if in_test_section and stripped.startswith(("-", "*", "•")):
                suggestions.append(stripped.lstrip("-*• "))
            elif in_test_section and not stripped:
                in_test_section = False

        return suggestions

    @staticmethod
    def _extract_summary(raw_review: str) -> str:
        """Extract or generate a summary from the review."""
        lines = raw_review.strip().split("\n")
        # Take the first non-empty paragraph as summary
        summary_lines: list[str] = []
        for line in lines:
            if not line.strip() and summary_lines:
                break
            if line.strip():
                summary_lines.append(line.strip())

        summary = " ".join(summary_lines)
        return summary[:500] if summary else "Review completed."
