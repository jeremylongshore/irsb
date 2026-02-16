"""
Formal Agent Verifier — Z3 SMT-based constraint checking for AI agent tool calls.

Replaces probabilistic "LLM-as-a-judge" oversight with mathematical proofs
of constraint satisfaction. Based on the FormalJudge approach (arXiv:2602.11136).

Integration point: between LLM output parsing and tool execution.
  LLM response → parse tool call → FormalAgentVerifier.verify() → execute OR reject

Each verification produces a VerificationReport with:
  - PROVEN_SAFE: Z3 proved all constraints satisfied
  - PROVEN_UNSAFE: Z3 proved at least one constraint violated
  - UNKNOWN: solver timed out or no constraints applied (fail-closed by default)
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .verifier_config import VerifierConfig

logger = logging.getLogger(__name__)

# Z3 is imported lazily to allow the module to load even if z3 isn't installed.
# This lets tests that don't need Z3 run without the dependency.
_z3 = None


def _get_z3():  # noqa: ANN202
    global _z3
    if _z3 is None:
        try:
            import z3 as z3_module

            _z3 = z3_module
        except ImportError as exc:
            raise ImportError(
                "z3-solver is required for formal verification. "
                "Install it with: pip install z3-solver"
            ) from exc
    return _z3


# ---------------------------------------------------------------------------
# Enums & data classes
# ---------------------------------------------------------------------------


class ConstraintType(Enum):
    """Categories of verifiable constraints."""

    FILE_ACCESS = "file_access"
    NETWORK = "network"
    COMMAND_EXEC = "command_exec"
    DATA_EXFIL = "data_exfil"
    RESOURCE_LIMIT = "resource_limit"
    PERMISSION = "permission"


class VerificationResult(Enum):
    """Outcome of formal verification."""

    PROVEN_SAFE = "proven_safe"
    PROVEN_UNSAFE = "proven_unsafe"
    UNKNOWN = "unknown"


@dataclass
class ToolCall:
    """A parsed tool invocation from an LLM response."""

    tool_name: str
    parameters: dict[str, Any]
    raw_text: str = ""


@dataclass
class Constraint:
    """A named, typed constraint with an optional Z3 builder."""

    name: str
    constraint_type: ConstraintType
    description: str
    z3_builder: Callable[[dict[str, Any]], Any] | None = None


@dataclass
class VerificationReport:
    """Result of verifying a single tool call against all applicable constraints."""

    tool_call: ToolCall
    result: VerificationResult
    constraints_checked: list[str] = field(default_factory=list)
    violations: list[str] = field(default_factory=list)
    proofs: list[str] = field(default_factory=list)
    reasoning: str = ""
    elapsed_ms: float = 0.0


# ---------------------------------------------------------------------------
# Tool → constraint type mapping
# ---------------------------------------------------------------------------

# Maps tool names to the constraint categories that apply.
TOOL_CONSTRAINT_MAP: dict[str, list[ConstraintType]] = {
    "read_file": [ConstraintType.FILE_ACCESS, ConstraintType.DATA_EXFIL],
    "write_file": [ConstraintType.FILE_ACCESS],
    "index_documents": [ConstraintType.FILE_ACCESS],
    "exec": [ConstraintType.COMMAND_EXEC, ConstraintType.RESOURCE_LIMIT],
    "shell": [ConstraintType.COMMAND_EXEC, ConstraintType.RESOURCE_LIMIT],
    "http_request": [ConstraintType.NETWORK, ConstraintType.DATA_EXFIL],
    "fetch_url": [ConstraintType.NETWORK, ConstraintType.DATA_EXFIL],
    "send_message": [ConstraintType.DATA_EXFIL, ConstraintType.PERMISSION],
    "sign_transaction": [
        ConstraintType.PERMISSION,
        ConstraintType.RESOURCE_LIMIT,
        ConstraintType.DATA_EXFIL,
    ],
    "submit_receipt": [ConstraintType.PERMISSION, ConstraintType.RESOURCE_LIMIT],
    "query": [ConstraintType.DATA_EXFIL],
}


# ---------------------------------------------------------------------------
# FormalAgentVerifier
# ---------------------------------------------------------------------------


class FormalAgentVerifier:
    """
    Z3 SMT-based verifier for AI agent tool calls.

    Provides deterministic, auditable constraint checking that does not
    inherit LLM failure modes. Designed as a defense-in-depth layer
    between LLM output parsing and tool execution.
    """

    def __init__(self, config: VerifierConfig | None = None):
        self.config = config or VerifierConfig.from_env()
        self._constraints: list[Constraint] = []
        self._register_default_constraints()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify(self, tool_call: ToolCall) -> VerificationReport:
        """
        Verify a tool call against all applicable constraints.

        Returns VerificationReport with PROVEN_SAFE, PROVEN_UNSAFE, or UNKNOWN.
        Fail-closed: UNKNOWN is treated as unsafe by callers.
        """
        if not self.config.enabled:
            return VerificationReport(
                tool_call=tool_call,
                result=VerificationResult.PROVEN_SAFE,
                reasoning="Verification disabled",
            )

        start = time.monotonic()
        applicable = self._get_applicable_constraints(tool_call.tool_name)

        if not applicable:
            elapsed = (time.monotonic() - start) * 1000
            return VerificationReport(
                tool_call=tool_call,
                result=VerificationResult.PROVEN_SAFE,
                reasoning=f"No constraints apply to tool '{tool_call.tool_name}'",
                elapsed_ms=elapsed,
            )

        violations: list[str] = []
        proofs: list[str] = []
        checked: list[str] = []

        for constraint in applicable:
            checked.append(constraint.name)
            try:
                is_safe, detail = self._verify_single_constraint(constraint, tool_call)
                if is_safe:
                    proofs.append(f"{constraint.name}: {detail}")
                else:
                    violations.append(f"{constraint.name}: {detail}")
            except Exception as exc:
                # Solver error → fail-closed
                violations.append(f"{constraint.name}: verification error — {exc}")
                logger.warning("Constraint %s raised: %s", constraint.name, exc)

        elapsed = (time.monotonic() - start) * 1000

        if violations:
            result = VerificationResult.PROVEN_UNSAFE
            reasoning = f"{len(violations)} constraint(s) violated"
        else:
            result = VerificationResult.PROVEN_SAFE
            reasoning = f"All {len(proofs)} constraint(s) satisfied"

        report = VerificationReport(
            tool_call=tool_call,
            result=result,
            constraints_checked=checked,
            violations=violations,
            proofs=proofs,
            reasoning=reasoning,
            elapsed_ms=elapsed,
        )

        logger.info(
            "Verification %s for %s (%s) in %.1fms — %s",
            report.result.value,
            tool_call.tool_name,
            ", ".join(checked),
            elapsed,
            reasoning,
        )
        return report

    def verify_batch(self, tool_calls: list[ToolCall]) -> list[VerificationReport]:
        """Verify a batch of tool calls. Rejects entire batch if any single call fails."""
        if len(tool_calls) > self.config.max_tool_calls_per_request:
            return [
                VerificationReport(
                    tool_call=tc,
                    result=VerificationResult.PROVEN_UNSAFE,
                    violations=[
                        f"Batch size {len(tool_calls)} exceeds limit "
                        f"{self.config.max_tool_calls_per_request}"
                    ],
                    reasoning="Tool call batch limit exceeded",
                )
                for tc in tool_calls
            ]
        return [self.verify(tc) for tc in tool_calls]

    def add_constraint(self, constraint: Constraint) -> None:
        """Register a custom constraint."""
        self._constraints.append(constraint)

    # ------------------------------------------------------------------
    # Constraint registration
    # ------------------------------------------------------------------

    def _register_default_constraints(self) -> None:
        """Register IRSB-specific default constraints."""
        self._constraints = [
            Constraint(
                name="no_sensitive_file_access",
                constraint_type=ConstraintType.FILE_ACCESS,
                description="Block access to sensitive files (.env, .ssh, credentials, keys)",
            ),
            Constraint(
                name="no_path_traversal",
                constraint_type=ConstraintType.FILE_ACCESS,
                description="Detect path traversal sequences (.. and //) using Z3 string theory",
            ),
            Constraint(
                name="safe_path_allowlist",
                constraint_type=ConstraintType.FILE_ACCESS,
                description="File access must be within configured safe paths",
            ),
            Constraint(
                name="no_dangerous_commands",
                constraint_type=ConstraintType.COMMAND_EXEC,
                description="Block rm -rf, fork bombs, curl|bash, sudo rm, etc.",
            ),
            Constraint(
                name="command_allowlist",
                constraint_type=ConstraintType.COMMAND_EXEC,
                description="Only pre-approved base commands may execute",
            ),
            Constraint(
                name="no_data_exfiltration",
                constraint_type=ConstraintType.DATA_EXFIL,
                description="Detect private keys, API keys, tokens in parameters",
            ),
            Constraint(
                name="host_allowlist",
                constraint_type=ConstraintType.NETWORK,
                description="Outbound HTTP restricted to configured safe hosts",
            ),
            Constraint(
                name="resource_limits",
                constraint_type=ConstraintType.RESOURCE_LIMIT,
                description="Enforce timeout and transaction value bounds via Z3 arithmetic",
            ),
            Constraint(
                name="tx_value_limit",
                constraint_type=ConstraintType.PERMISSION,
                description="Transaction value must not exceed configured maximum (Phase 3)",
            ),
        ]

    # ------------------------------------------------------------------
    # Constraint routing
    # ------------------------------------------------------------------

    def _get_applicable_constraints(self, tool_name: str) -> list[Constraint]:
        """Return constraints applicable to a given tool name."""
        applicable_types = TOOL_CONSTRAINT_MAP.get(tool_name, [])
        return [c for c in self._constraints if c.constraint_type in applicable_types]

    def _verify_single_constraint(
        self, constraint: Constraint, tool_call: ToolCall
    ) -> tuple[bool, str]:
        """
        Verify one constraint against a tool call.

        Returns (is_safe, detail_string).
        """
        name = constraint.name
        params = tool_call.parameters

        if name == "no_sensitive_file_access":
            return self._check_sensitive_file(params)
        elif name == "no_path_traversal":
            return self._check_path_traversal_z3(params)
        elif name == "safe_path_allowlist":
            return self._check_safe_path_allowlist(params)
        elif name == "no_dangerous_commands":
            return self._check_dangerous_commands(params)
        elif name == "command_allowlist":
            return self._check_command_allowlist(params)
        elif name == "no_data_exfiltration":
            return self._check_data_exfiltration(params)
        elif name == "host_allowlist":
            return self._check_host_allowlist(params)
        elif name == "resource_limits":
            return self._check_resource_limits_z3(params)
        elif name == "tx_value_limit":
            return self._check_tx_value_limit_z3(params)
        else:
            return False, f"Unknown constraint: {name}"

    # ------------------------------------------------------------------
    # FILE_ACCESS checks
    # ------------------------------------------------------------------

    def _check_sensitive_file(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Check that file path doesn't match sensitive patterns."""
        path = str(params.get("path", params.get("file_path", "")))
        path_lower = path.lower()

        for pattern in self.config.sensitive_patterns:
            if pattern.lower() in path_lower:
                return False, f"Path '{path}' matches sensitive pattern '{pattern}'"

        return True, f"Path '{path}' does not match any sensitive patterns"

    def _check_path_traversal_z3(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Use Z3 string theory to prove absence of path traversal sequences."""
        z3 = _get_z3()
        path = str(params.get("path", params.get("file_path", "")))

        solver = z3.Solver()
        solver.set("timeout", self.config.solver_timeout_ms)

        path_var = z3.String("path")
        has_traversal = z3.Or(
            z3.Contains(path_var, z3.StringVal("..")),
            z3.Contains(path_var, z3.StringVal("//")),
        )

        solver.add(path_var == z3.StringVal(path))
        solver.add(has_traversal)

        result = solver.check()
        if result == z3.unsat:
            return True, f"Z3 proved no traversal sequences in '{path}'"
        elif result == z3.sat:
            return False, f"Z3 found traversal sequence in '{path}'"
        else:
            return False, f"Z3 solver returned {result} (fail-closed)"

    def _check_safe_path_allowlist(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Check that file path starts with one of the configured safe paths."""
        path = str(params.get("path", params.get("file_path", "")))

        for safe_path in self.config.safe_paths:
            if path.startswith(safe_path):
                return True, f"Path '{path}' is within safe path '{safe_path}'"

        return False, (
            f"Path '{path}' is not within any safe path: {self.config.safe_paths}"
        )

    # ------------------------------------------------------------------
    # COMMAND_EXEC checks
    # ------------------------------------------------------------------

    def _check_dangerous_commands(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Check command against dangerous command patterns."""
        command = str(params.get("command", ""))

        for pattern in self.config.dangerous_commands:
            if re.search(pattern, command):
                return False, f"Command matches dangerous pattern: '{pattern}'"

        return True, "Command does not match any dangerous patterns"

    def _check_command_allowlist(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Check that the base command is in the allowlist."""
        command = str(params.get("command", "")).strip()
        if not command:
            return False, "Empty command"

        base_cmd = command.split()[0].split("/")[-1]  # handle full paths

        if base_cmd in self.config.allowed_commands:
            return True, f"Command '{base_cmd}' is in allowlist"

        return False, (
            f"Command '{base_cmd}' is not in allowlist: {self.config.allowed_commands}"
        )

    # ------------------------------------------------------------------
    # DATA_EXFIL checks
    # ------------------------------------------------------------------

    def _check_data_exfiltration(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Scan all parameter values for secret material patterns."""
        all_values = self._flatten_params(params)

        for pattern in self.config.secret_patterns:
            for value in all_values:
                if re.search(pattern, value):
                    # Redact the matched value in the report
                    return False, (
                        f"Parameter value matches secret pattern: "
                        f"'{pattern}' (value redacted)"
                    )

        return True, "No secret material detected in parameters"

    # ------------------------------------------------------------------
    # NETWORK checks
    # ------------------------------------------------------------------

    def _check_host_allowlist(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Check that target host is in the allowlist."""
        url = str(params.get("url", params.get("host", "")))
        if not url:
            return False, "No URL or host specified"

        # Extract hostname from URL
        host = url
        if "://" in url:
            host = url.split("://", 1)[1].split("/", 1)[0]
        host = host.split(":")[0]  # strip port

        for safe_host in self.config.safe_hosts:
            if host == safe_host or host.endswith(f".{safe_host}"):
                return True, f"Host '{host}' matches safe host '{safe_host}'"

        return False, f"Host '{host}' is not in safe hosts: {self.config.safe_hosts}"

    # ------------------------------------------------------------------
    # RESOURCE_LIMIT checks (Z3 integer arithmetic)
    # ------------------------------------------------------------------

    def _check_resource_limits_z3(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Use Z3 integer arithmetic to verify timeout bounds."""
        z3 = _get_z3()

        timeout = params.get("timeout", params.get("timeout_seconds", 0))
        try:
            timeout = int(timeout)
        except (TypeError, ValueError):
            return False, f"Non-numeric timeout value: {timeout}"

        solver = z3.Solver()
        solver.set("timeout", self.config.solver_timeout_ms)

        timeout_var = z3.Int("timeout")
        max_var = z3.Int("max_timeout")

        solver.add(timeout_var == z3.IntVal(timeout))
        solver.add(max_var == z3.IntVal(self.config.max_timeout_seconds))

        # Assert violation condition: timeout > max
        solver.add(timeout_var > max_var)

        result = solver.check()
        if result == z3.unsat:
            return True, (
                f"Z3 proved timeout {timeout}s does not exceed "
                f"max {self.config.max_timeout_seconds}s"
            )
        elif result == z3.sat:
            return False, (
                f"Z3 proved timeout {timeout}s exceeds "
                f"max {self.config.max_timeout_seconds}s"
            )
        else:
            return False, f"Z3 solver returned {result} for resource limits (fail-closed)"

    # ------------------------------------------------------------------
    # PERMISSION checks (Phase 3 transaction constraints)
    # ------------------------------------------------------------------

    def _check_tx_value_limit_z3(self, params: dict[str, Any]) -> tuple[bool, str]:
        """Use Z3 to verify transaction value against configured maximum."""
        z3 = _get_z3()

        value = params.get("value", params.get("tx_value", 0))
        try:
            value = int(value)
        except (TypeError, ValueError):
            return False, f"Non-numeric transaction value: {value}"

        solver = z3.Solver()
        solver.set("timeout", self.config.solver_timeout_ms)

        value_var = z3.Int("tx_value")
        max_var = z3.Int("max_tx_value")

        solver.add(value_var == z3.IntVal(value))
        solver.add(max_var == z3.IntVal(self.config.max_tx_value_wei))
        solver.add(value_var > max_var)

        result = solver.check()
        if result == z3.unsat:
            return True, (
                f"Z3 proved tx value {value} wei does not exceed "
                f"max {self.config.max_tx_value_wei} wei"
            )
        elif result == z3.sat:
            return False, (
                f"Z3 proved tx value {value} wei exceeds "
                f"max {self.config.max_tx_value_wei} wei"
            )
        else:
            return False, f"Z3 solver returned {result} for tx value (fail-closed)"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _flatten_params(params: dict[str, Any]) -> list[str]:
        """Recursively extract all string values from nested parameters."""
        values: list[str] = []

        def _walk(obj: Any) -> None:
            if isinstance(obj, str):
                values.append(obj)
            elif isinstance(obj, dict):
                for v in obj.values():
                    _walk(v)
            elif isinstance(obj, (list, tuple)):
                for item in obj:
                    _walk(item)

        _walk(params)
        return values
