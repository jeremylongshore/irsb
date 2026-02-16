"""
Policy enforcement for hybrid safety mode.
Documents stay local; only truncated snippets go to cloud LLMs.
"""

import hashlib

from .config import Config
from .models import Citation


class PolicyRedactor:
    """Enforces hybrid safety: truncate snippets, hash for audit."""

    def __init__(
        self,
        hybrid_safe_mode: bool | None = None,
        max_snippet_length: int | None = None,
    ):
        self.hybrid_safe_mode = (
            hybrid_safe_mode if hybrid_safe_mode is not None else Config.HYBRID_SAFE_MODE
        )
        self.max_snippet_length = (
            max_snippet_length if max_snippet_length is not None else Config.MAX_SNIPPET_LENGTH
        )

    def redact_snippets(self, citations: list[Citation]) -> tuple[str, list[str]]:
        """
        Build safe context from citations.

        Returns:
            (combined_context, list of excerpt SHA-256 hashes)
        """
        snippets: list[str] = []
        hashes: list[str] = []

        for cit in citations:
            h = hashlib.sha256(cit.excerpt.encode()).hexdigest()
            hashes.append(h)

            excerpt = cit.excerpt
            if self.hybrid_safe_mode and len(excerpt) > self.max_snippet_length:
                excerpt = excerpt[: self.max_snippet_length] + "..."

            source_tag = f"[Source: {cit.source}"
            if cit.page:
                source_tag += f", Page {cit.page}"
            source_tag += "]"

            snippets.append(f"{source_tag}\n{excerpt}")

        combined = "\n\n---\n\n".join(snippets)

        if self.hybrid_safe_mode:
            # Per-citation overhead: source tag (~50 chars) + separator (~7 chars)
            overhead_per_citation = 60
            n = max(len(citations), 1)
            max_total = (self.max_snippet_length + overhead_per_citation) * n
            if len(combined) > max_total:
                combined = combined[:max_total] + "\n\n[Context truncated for safety]"

        return combined, hashes

    def validate_outbound_payload(self, payload: str) -> bool:
        if self.hybrid_safe_mode:
            if len(payload) > self.max_snippet_length * 10:
                return False
        return True
