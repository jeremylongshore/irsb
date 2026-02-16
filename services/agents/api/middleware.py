"""
Verification middleware for IRSB Agents API.

Gates requests through the FormalAgentVerifier before they reach route handlers.
Extracts tool-call-like parameters from API requests and runs them through
Z3-based constraint checking.

Integration: added to FastAPI app via add_verification_middleware(app).
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from shared.core.verifier import (
    FormalAgentVerifier,
    ToolCall,
    VerificationResult,
)
from shared.core.verifier_config import VerifierConfig

logger = logging.getLogger(__name__)

# Maps API routes to the tool name used for constraint lookup.
# Only routes that accept user-influenced input need verification.
ROUTE_TOOL_MAP: dict[str, str] = {
    "/builder/query": "query",
    "/builder/plan": "query",
    "/builder/review": "query",
    "/index": "index_documents",
    "/money/research": "query",
    "/money/outreach": "query",
}


class VerificationMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that runs formal verification on inbound requests.

    For POST requests to mapped routes, extracts parameters from the JSON body
    and verifies them against IRSB constraints. Rejects requests that are
    PROVEN_UNSAFE with a 403 status code.
    """

    def __init__(self, app: Any, verifier: FormalAgentVerifier | None = None):
        super().__init__(app)
        self.verifier = verifier or FormalAgentVerifier()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Only verify POST requests to mapped routes
        route = request.url.path
        if request.method != "POST" or route not in ROUTE_TOOL_MAP:
            return await call_next(request)

        if not self.verifier.config.enabled:
            return await call_next(request)

        start = time.monotonic()
        tool_name = ROUTE_TOOL_MAP[route]

        # Read and cache request body (FastAPI consumes it once)
        body = await request.body()
        try:
            params = json.loads(body) if body else {}
        except json.JSONDecodeError:
            params = {}

        # Build a ToolCall from the request
        tool_call = ToolCall(
            tool_name=tool_name,
            parameters=params,
            raw_text=body.decode("utf-8", errors="replace")[:500],
        )

        report = self.verifier.verify(tool_call)
        elapsed = (time.monotonic() - start) * 1000

        # Add verification headers to response
        if report.result == VerificationResult.PROVEN_UNSAFE:
            logger.warning(
                "Request REJECTED by verifier: %s %s — %s",
                request.method,
                route,
                "; ".join(report.violations),
            )
            return Response(
                content=json.dumps({
                    "detail": "Formal verification failed",
                    "result": report.result.value,
                    "violations": report.violations,
                    "constraints_checked": report.constraints_checked,
                }),
                status_code=403,
                media_type="application/json",
                headers={
                    "X-Verification-Result": report.result.value,
                    "X-Verification-Time-Ms": f"{elapsed:.1f}",
                },
            )

        # Request passed verification — proceed with verification headers
        response = await call_next(request)
        response.headers["X-Verification-Result"] = report.result.value
        response.headers["X-Verification-Time-Ms"] = f"{elapsed:.1f}"

        return response


def add_verification_middleware(
    app: FastAPI,
    config: VerifierConfig | None = None,
) -> FormalAgentVerifier:
    """
    Add formal verification middleware to a FastAPI app.

    Returns the verifier instance for direct use in route handlers.
    """
    verifier = FormalAgentVerifier(config=config)
    app.add_middleware(VerificationMiddleware, verifier=verifier)

    logger.info(
        "Formal verification middleware enabled (timeout=%dms, safe_paths=%d, safe_hosts=%d)",
        verifier.config.solver_timeout_ms,
        len(verifier.config.safe_paths),
        len(verifier.config.safe_hosts),
    )

    return verifier
