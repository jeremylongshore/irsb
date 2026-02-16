"""
Money Agent — research protocols, qualify leads, draft outreach.

Phase 2 MVP: research + outreach + pipeline endpoints.
No signing keys. No on-chain actions. Human reviews all outreach.
"""

from shared.core.models import ResearchRequest, ResearchResponse


class MoneyAgent:
    """Money agent orchestration."""

    def research(self, request: ResearchRequest) -> ResearchResponse:
        """Research a protocol for IRSB integration fit."""
        raise NotImplementedError("Money agent ships in Phase 2")

    def draft_outreach(self, target: str, context: str) -> str:
        """Generate personalized outreach draft. Human must review before sending."""
        raise NotImplementedError("Money agent ships in Phase 2")
