"""
Configuration for IRSB Agents.
Env-based with sensible local-first defaults.
"""

import os
from enum import StrEnum
from pathlib import Path


class AgentMode(StrEnum):
    LOCAL = "local"
    CLOUD = "cloud"
    HYBRID = "hybrid"


class LLMProviderType(StrEnum):
    OLLAMA = "ollama"
    ANTHROPIC = "anthropic"
    VERTEX = "vertex"


class EmbedProviderType(StrEnum):
    OLLAMA = "ollama"
    VERTEX = "vertex"


class Config:
    """Central configuration — reads from env with local-first defaults."""

    # Mode
    NEXUS_MODE: AgentMode = AgentMode(os.getenv("NEXUS_MODE", "local"))

    # Providers
    NEXUS_LLM_PROVIDER: LLMProviderType = LLMProviderType(
        os.getenv("NEXUS_LLM_PROVIDER", "ollama")
    )
    NEXUS_EMBED_PROVIDER: EmbedProviderType = EmbedProviderType(
        os.getenv("NEXUS_EMBED_PROVIDER", "ollama")
    )

    # Ollama
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    # Anthropic
    ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

    # Vertex AI
    GOOGLE_CLOUD_PROJECT: str | None = os.getenv("GOOGLE_CLOUD_PROJECT")
    GOOGLE_CLOUD_REGION: str = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
    VERTEX_MODEL: str = os.getenv("VERTEX_MODEL", "gemini-2.0-flash")

    # Ethereum
    SEPOLIA_RPC_URL: str = os.getenv("SEPOLIA_RPC_URL", "https://rpc.sepolia.org")

    # Document processing
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1500"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))

    # Storage
    CHROMA_DB_PATH: str = os.getenv("CHROMA_DB_PATH", "./chroma_db")
    LEDGER_DB_PATH: str = os.getenv("LEDGER_DB_PATH", "./irsb_ledger.db")

    # Corpus
    CORPUS_DIR: str = os.getenv("CORPUS_DIR", "./corpus_repos")

    # API
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    # Safety
    HYBRID_SAFE_MODE: bool = os.getenv("HYBRID_SAFE_MODE", "true").lower() == "true"
    MAX_SNIPPET_LENGTH: int = int(os.getenv("MAX_SNIPPET_LENGTH", "4000"))

    @classmethod
    def validate(cls) -> None:
        """Validate config, fail fast on missing required keys."""
        if cls.NEXUS_MODE in (AgentMode.CLOUD, AgentMode.HYBRID):
            if cls.NEXUS_LLM_PROVIDER == LLMProviderType.ANTHROPIC and not cls.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY required for Anthropic provider")
            if cls.NEXUS_LLM_PROVIDER == LLMProviderType.VERTEX and not cls.GOOGLE_CLOUD_PROJECT:
                raise ValueError("GOOGLE_CLOUD_PROJECT required for Vertex provider")

        if cls.CHUNK_OVERLAP >= cls.CHUNK_SIZE:
            raise ValueError("CHUNK_OVERLAP must be less than CHUNK_SIZE")

        Path(cls.CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)

    @classmethod
    def summary(cls) -> dict:
        return {
            "mode": cls.NEXUS_MODE.value,
            "llm_provider": cls.NEXUS_LLM_PROVIDER.value,
            "embed_provider": cls.NEXUS_EMBED_PROVIDER.value,
            "chunk_size": cls.CHUNK_SIZE,
            "hybrid_safe_mode": cls.HYBRID_SAFE_MODE,
        }
