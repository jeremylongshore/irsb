"""Tests for shared.core.router."""

import pytest

from shared.core.providers.ollama_provider import OllamaEmbeddingProvider, OllamaLLMProvider
from shared.core.router import ProviderRouter


def test_get_ollama_llm_provider():
    """Router returns Ollama LLM provider by default."""
    provider = ProviderRouter.get_llm_provider("ollama", "local")
    assert isinstance(provider, OllamaLLMProvider)


def test_get_ollama_embed_provider():
    """Router returns Ollama embedding provider by default."""
    provider = ProviderRouter.get_embedding_provider("ollama", "local")
    assert isinstance(provider, OllamaEmbeddingProvider)


def test_local_mode_rejects_cloud_llm():
    """LOCAL mode rejects non-Ollama LLM providers."""
    with pytest.raises(ValueError, match="LOCAL mode requires ollama"):
        ProviderRouter.get_llm_provider("anthropic", "local")


def test_local_mode_rejects_cloud_embed():
    """LOCAL mode rejects non-Ollama embedding providers."""
    with pytest.raises(ValueError, match="LOCAL mode requires ollama"):
        ProviderRouter.get_embedding_provider("vertex", "local")


def test_unknown_provider_raises():
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        ProviderRouter.get_llm_provider("fake_provider", "cloud")


def test_get_providers_returns_tuple():
    """get_providers returns (LLM, Embed) tuple."""
    llm, embed = ProviderRouter.get_providers("ollama", "ollama", "local")
    assert isinstance(llm, OllamaLLMProvider)
    assert isinstance(embed, OllamaEmbeddingProvider)
