"""Tests for shared.core.config."""

import pytest

from shared.core.config import AgentMode, Config, EmbedProviderType, LLMProviderType


def test_config_defaults():
    """Config has sensible local-first defaults."""
    assert Config.NEXUS_MODE == AgentMode.LOCAL
    assert Config.NEXUS_LLM_PROVIDER == LLMProviderType.OLLAMA
    assert Config.NEXUS_EMBED_PROVIDER == EmbedProviderType.OLLAMA
    assert Config.CHUNK_SIZE == 1500
    assert Config.CHUNK_OVERLAP == 200
    assert Config.HYBRID_SAFE_MODE is True


def test_config_summary():
    """Summary returns expected keys."""
    s = Config.summary()
    assert "mode" in s
    assert "llm_provider" in s
    assert "embed_provider" in s
    assert s["mode"] == "local"


def test_config_validate_chunk_overlap():
    """Validation catches bad chunk settings."""
    original = Config.CHUNK_OVERLAP
    try:
        Config.CHUNK_OVERLAP = Config.CHUNK_SIZE + 1
        with pytest.raises(ValueError, match="CHUNK_OVERLAP"):
            Config.validate()
    finally:
        Config.CHUNK_OVERLAP = original
