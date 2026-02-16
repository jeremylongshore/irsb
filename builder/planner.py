"""
Builder planner — takes a feature request, retrieves relevant code context via RAG,
and generates a structured implementation plan.
"""

from __future__ import annotations

import hashlib
import re
import time
import uuid
from datetime import datetime

from shared.core.models import Citation, PlanRequest, PlanResponse, QueryResponse
from shared.core.policy import PolicyRedactor
from shared.core.rag_pipeline import RAGPipeline

from .prompts import BUILDER_SYSTEM_PROMPT, PLAN_TEMPLATE


class BuilderPlanner:
    """Generates RAG-grounded implementation plans for IRSB features."""

    def __init__(self, pipeline: RAGPipeline):
        self.pipeline = pipeline
        self.policy = PolicyRedactor()

    def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate an implementation plan for a feature request.

        1. Retrieve relevant code context via RAG
        2. Build prompt with system instructions + context + feature
        3. Generate structured plan via LLM
        4. Extract file paths and test suggestions from the response
        """
        start = time.time()
        run_id = str(uuid.uuid4())

        # Step 1: Retrieve relevant context
        citations = self._retrieve_context(request.feature, request.workspace_id)

        # Step 2: Build safe context
        safe_context, excerpt_hashes = self.policy.redact_snippets(citations)

        # Step 3: Generate plan
        prompt = self._build_prompt(request.feature, safe_context)

        if not self.policy.validate_outbound_payload(prompt):
            raise ValueError("Policy violation: payload too large for safety mode")

        plan_text = self.pipeline.llm_provider.generate(prompt, temperature=0.3)

        # Step 4: Extract structured data from plan
        files_to_modify = self._extract_file_paths(plan_text)
        tests_to_add = self._extract_test_files(plan_text)

        # Truncate citation excerpts for response
        for cit in citations:
            cit.excerpt = cit.excerpt[:200]

        latency = (time.time() - start) * 1000

        response = PlanResponse(
            feature=request.feature,
            plan=plan_text,
            files_to_modify=files_to_modify,
            tests_to_add=tests_to_add,
            citations=citations,
            run_id=run_id,
            timestamp=datetime.now(),
        )

        # Record to ledger
        self.pipeline.ledger.record_query_run(
            _plan_to_query_response(response, self.pipeline, latency),
            excerpt_hashes,
        )

        return response

    def _retrieve_context(self, feature: str, workspace_id: str) -> list[Citation]:
        """Retrieve relevant code chunks for the feature request."""
        vectorstore = self.pipeline._get_vectorstore()
        if vectorstore is None:
            return []

        retriever = vectorstore.as_retriever(search_kwargs={"k": 8})
        docs = retriever.invoke(feature)

        citations: list[Citation] = []
        for i, doc in enumerate(docs):
            citations.append(
                Citation(
                    source=doc.metadata.get("source", "unknown"),
                    page=doc.metadata.get("page"),
                    excerpt=doc.page_content,
                    relevance_score=1.0 / (i + 1),
                    content_hash=hashlib.md5(doc.page_content.encode()).hexdigest(),
                )
            )
        return citations

    def _build_prompt(self, feature: str, context: str) -> str:
        """Build the planning prompt with system instructions and context."""
        return f"""{BUILDER_SYSTEM_PROMPT}

{PLAN_TEMPLATE.format(feature=feature, context=context)}"""

    @staticmethod
    def _extract_file_paths(plan_text: str) -> list[str]:
        """Extract file paths mentioned in the plan."""
        patterns = [
            r'`([a-zA-Z0-9_/.-]+\.[a-z]{1,4})`',  # backtick-wrapped paths
            r'(?:^|\s)((?:src|test|protocol|solver|watchtower|packages|apps)/[a-zA-Z0-9_/.-]+\.[a-z]{1,4})',  # bare paths
        ]
        paths: set[str] = set()
        for pattern in patterns:
            matches = re.findall(pattern, plan_text)
            for m in matches:
                # Filter out obvious non-paths
                if "/" in m and not m.startswith("http"):
                    paths.add(m)
        return sorted(paths)

    @staticmethod
    def _extract_test_files(plan_text: str) -> list[str]:
        """Extract test file references from the plan."""
        patterns = [
            r'`([a-zA-Z0-9_/.-]*(?:test|spec)[a-zA-Z0-9_/.-]*\.[a-z]{1,4})`',
            r'(?:^|\s)((?:test|tests)/[a-zA-Z0-9_/.-]+\.[a-z]{1,4})',
        ]
        tests: set[str] = set()
        for pattern in patterns:
            matches = re.findall(pattern, plan_text)
            for m in matches:
                if not m.startswith("http"):
                    tests.add(m)
        return sorted(tests)


def _plan_to_query_response(
    plan: PlanResponse, pipeline: RAGPipeline, latency_ms: float
) -> QueryResponse:
    """Convert PlanResponse to QueryResponse for ledger recording."""
    return QueryResponse(
        question=f"[PLAN] {plan.feature[:500]}",
        answer=plan.plan[:2000],
        citations=plan.citations,
        workspace_id=pipeline.workspace_id,
        model_used=pipeline.llm_provider.get_model_name(),
        provider=type(pipeline.llm_provider).__name__,
        latency_ms=latency_ms,
        run_id=plan.run_id,
        timestamp=plan.timestamp,
    )
