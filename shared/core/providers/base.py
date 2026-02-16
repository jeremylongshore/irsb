"""
Abstract base classes for LLM and embedding providers.
"""

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """LLM provider interface."""

    @abstractmethod
    def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """Generate text from a prompt."""
        ...

    @abstractmethod
    def generate_with_messages(
        self,
        messages: list[dict[str, str]],
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """Generate from chat messages."""
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...


class EmbeddingProvider(ABC):
    """Embedding provider interface."""

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        ...

    @abstractmethod
    def embed_query(self, text: str) -> list[float]:
        ...

    @abstractmethod
    def get_embedding_dimension(self) -> int:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...

    def _get_embeddings(self) -> Any:
        """Return a LangChain-compatible embeddings object (for Chroma integration)."""
        raise NotImplementedError
