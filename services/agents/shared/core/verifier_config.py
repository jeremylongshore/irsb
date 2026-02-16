"""
Configuration for the Formal Agent Verifier.
Loads constraint parameters from environment with IRSB-specific defaults.
"""

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class VerifierConfig:
    """Immutable verifier constraint configuration loaded from environment."""

    # Whether verification is enabled (fail-open when disabled)
    enabled: bool = True

    # Z3 solver timeout in milliseconds (fail-closed on timeout)
    solver_timeout_ms: int = 5000

    # --- FILE_ACCESS constraints ---

    # Directories the agent may read from (comma-separated)
    safe_paths: list[str] = field(default_factory=lambda: [
        "./corpus_repos",
        "./chroma_db",
        "/tmp",
    ])

    # Patterns that indicate sensitive files (never allow access)
    sensitive_patterns: list[str] = field(default_factory=lambda: [
        ".env",
        ".ssh",
        "credentials",
        "secrets",
        "private_key",
        ".git/config",
        "id_rsa",
        "id_ed25519",
        ".gnupg",
        "keystore",
    ])

    # --- COMMAND_EXEC constraints ---

    # Shell commands that are always blocked
    dangerous_commands: list[str] = field(default_factory=lambda: [
        r"rm\s+-rf\s+/",
        r"rm\s+-rf\s+\*",
        r"mkfs\.",
        r"dd\s+if=",
        r":\(\)\{.*\}",          # fork bomb
        r"curl.*\|\s*bash",
        r"wget.*\|\s*bash",
        r"sudo\s+rm",
        r"chmod\s+777",
        r"eval\s*\(",
        r"exec\s*\(",
    ])

    # Commands the agent is allowed to execute (base command only)
    allowed_commands: list[str] = field(default_factory=lambda: [
        "python",
        "pytest",
        "ruff",
        "mypy",
        "git",
        "ls",
        "cat",
        "grep",
        "find",
        "echo",
        "pip",
    ])

    # --- DATA_EXFIL constraints ---

    # Regex patterns that match secret material in outputs
    secret_patterns: list[str] = field(default_factory=lambda: [
        r"0x[a-fA-F0-9]{64}",                              # Ethereum private key
        r"AKIA[0-9A-Z]{16}",                                # AWS access key
        r"sk-[a-zA-Z0-9]{20,}",                             # OpenAI / Anthropic key
        r"ghp_[a-zA-Z0-9]{36}",                             # GitHub PAT
        r"xoxb-[0-9]{10,}-[a-zA-Z0-9]+",                    # Slack bot token
        r"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----",        # PEM private key
        r"gcloud_[a-zA-Z0-9_]{20,}",                        # GCP credential fragment
        r"AIza[0-9A-Za-z_-]{35}",                           # Google API key
    ])

    # --- NETWORK constraints ---

    # Hosts the agent may contact (exact match or suffix match)
    safe_hosts: list[str] = field(default_factory=lambda: [
        "rpc.sepolia.org",
        "api.github.com",
        "raw.githubusercontent.com",
        "ipfs.io",
        "gateway.pinata.cloud",
        "localhost",
        "127.0.0.1",
    ])

    # --- RESOURCE_LIMIT constraints ---

    # Maximum timeout for any single operation (seconds)
    max_timeout_seconds: int = 300

    # Maximum transaction value in wei (Phase 3 — 0.1 ETH default)
    max_tx_value_wei: int = 100_000_000_000_000_000

    # Maximum number of tool calls per request
    max_tool_calls_per_request: int = 10

    @classmethod
    def from_env(cls) -> "VerifierConfig":
        """Build config from environment variables with IRSB defaults."""
        # Create a default instance to get field defaults
        defaults = cls()

        def _split_csv(key: str, default: list[str]) -> list[str]:
            raw = os.getenv(key, "")
            return [s.strip() for s in raw.split(",") if s.strip()] if raw else default

        return cls(
            enabled=os.getenv("VERIFIER_ENABLED", "true").lower() == "true",
            solver_timeout_ms=int(os.getenv("VERIFIER_SOLVER_TIMEOUT_MS", "5000")),
            safe_paths=_split_csv("VERIFIER_SAFE_PATHS", defaults.safe_paths),
            sensitive_patterns=_split_csv(
                "VERIFIER_SENSITIVE_PATTERNS", defaults.sensitive_patterns
            ),
            dangerous_commands=_split_csv(
                "VERIFIER_DANGEROUS_COMMANDS", defaults.dangerous_commands
            ),
            allowed_commands=_split_csv(
                "VERIFIER_ALLOWED_COMMANDS", defaults.allowed_commands
            ),
            secret_patterns=_split_csv(
                "VERIFIER_SECRET_PATTERNS", defaults.secret_patterns
            ),
            safe_hosts=_split_csv("VERIFIER_SAFE_HOSTS", defaults.safe_hosts),
            max_timeout_seconds=int(os.getenv("VERIFIER_MAX_TIMEOUT_SECONDS", "300")),
            max_tx_value_wei=int(os.getenv("VERIFIER_MAX_TX_VALUE_WEI", "100000000000000000")),
            max_tool_calls_per_request=int(
                os.getenv("VERIFIER_MAX_TOOL_CALLS_PER_REQUEST", "10")
            ),
        )
