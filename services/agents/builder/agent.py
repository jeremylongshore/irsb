"""
Builder Agent — answers IRSB questions grounded in code, produces implementation plans.

Phase 1 MVP: query + plan + review endpoints.
Phase 3: on-chain writes (receipts, disputes, reputation).
"""

from shared.core.models import PlanRequest, PlanResponse, QueryRequest, QueryResponse
from shared.core.rag_pipeline import RAGPipeline

from .planner import BuilderPlanner
from .reviewer import BuilderReviewer, ReviewRequest, ReviewResponse


class BuilderAgent:
    """Builder agent orchestration."""

    def __init__(self, pipeline: RAGPipeline | None = None):
        self.pipeline = pipeline or RAGPipeline(workspace_id="irsb")
        self.planner = BuilderPlanner(self.pipeline)
        self.reviewer = BuilderReviewer(self.pipeline)

    def query(self, request: QueryRequest) -> QueryResponse:
        """Answer an IRSB question grounded in the codebase."""
        return self.pipeline.query(request)

    def plan(self, request: PlanRequest) -> PlanResponse:
        """Generate implementation plan for a feature request."""
        return self.planner.plan(request)

    def review(self, request: ReviewRequest) -> ReviewResponse:
        """Review a code diff for IRSB patterns, security, and test coverage."""
        return self.reviewer.review(request)
