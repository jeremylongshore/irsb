"""
Provider router — selects LLM and embedding providers based on config.
"""


from .config import AgentMode, Config, EmbedProviderType, LLMProviderType
from .providers.base import EmbeddingProvider, LLMProvider


class ProviderRouter:
    """Routes to correct LLM/Embedding providers based on env config."""

    @staticmethod
    def get_llm_provider(
        provider_name: str | None = None,
        mode: str | None = None,
    ) -> LLMProvider:
        name = provider_name or Config.NEXUS_LLM_PROVIDER.value
        m = mode or Config.NEXUS_MODE.value

        if m == AgentMode.LOCAL and name != LLMProviderType.OLLAMA.value:
            raise ValueError(f"LOCAL mode requires ollama, got: {name}")

        if name == LLMProviderType.OLLAMA.value:
            from .providers.ollama_provider import OllamaLLMProvider

            return OllamaLLMProvider()
        elif name == LLMProviderType.ANTHROPIC.value:
            from .providers.anthropic_provider import AnthropicLLMProvider

            return AnthropicLLMProvider()
        elif name == LLMProviderType.VERTEX.value:
            from .providers.vertex_provider import VertexLLMProvider

            return VertexLLMProvider()
        else:
            raise ValueError(f"Unknown LLM provider: {name}")

    @staticmethod
    def get_embedding_provider(
        provider_name: str | None = None,
        mode: str | None = None,
    ) -> EmbeddingProvider:
        name = provider_name or Config.NEXUS_EMBED_PROVIDER.value
        m = mode or Config.NEXUS_MODE.value

        if m == AgentMode.LOCAL and name != EmbedProviderType.OLLAMA.value:
            raise ValueError(f"LOCAL mode requires ollama embeddings, got: {name}")

        if name == EmbedProviderType.OLLAMA.value:
            from .providers.ollama_provider import OllamaEmbeddingProvider

            return OllamaEmbeddingProvider()
        elif name == EmbedProviderType.VERTEX.value:
            from .providers.vertex_provider import VertexEmbeddingProvider

            return VertexEmbeddingProvider()
        else:
            raise ValueError(f"Unknown embedding provider: {name}")

    @staticmethod
    def get_providers(
        llm_name: str | None = None,
        embed_name: str | None = None,
        mode: str | None = None,
    ) -> tuple[LLMProvider, EmbeddingProvider]:
        return (
            ProviderRouter.get_llm_provider(llm_name, mode),
            ProviderRouter.get_embedding_provider(embed_name, mode),
        )
