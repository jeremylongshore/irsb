"""
Ollama provider — local LLM and embeddings via langchain-ollama.
"""

from typing import Any

from ..config import Config
from .base import EmbeddingProvider, LLMProvider


class OllamaLLMProvider(LLMProvider):
    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
    ):
        self.model = model or Config.OLLAMA_MODEL
        self.base_url = base_url or Config.OLLAMA_BASE_URL
        self._llm: Any = None

    def _get_llm(self) -> Any:
        if self._llm is None:
            from langchain_ollama import OllamaLLM

            self._llm = OllamaLLM(model=self.model, base_url=self.base_url)
        return self._llm

    def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        llm = self._get_llm()
        result: str = llm.invoke(prompt, temperature=temperature, **kwargs)
        return result

    def generate_with_messages(
        self,
        messages: list[dict[str, str]],
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        prompt = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
        return self.generate(prompt, max_tokens, temperature, **kwargs)

    def get_model_name(self) -> str:
        return self.model

    def is_available(self) -> bool:
        try:
            import httpx

            r = httpx.get(f"{self.base_url}/api/tags", timeout=3)
            return r.status_code == 200
        except Exception:
            return False


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
    ):
        self.model = model or Config.OLLAMA_MODEL
        self.base_url = base_url or Config.OLLAMA_BASE_URL
        self._embeddings: Any = None

    def _get_embeddings(self) -> Any:
        if self._embeddings is None:
            from langchain_ollama import OllamaEmbeddings

            self._embeddings = OllamaEmbeddings(model=self.model, base_url=self.base_url)
        return self._embeddings

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        result: list[list[float]] = self._get_embeddings().embed_documents(texts)
        return result

    def embed_query(self, text: str) -> list[float]:
        result: list[float] = self._get_embeddings().embed_query(text)
        return result

    def get_embedding_dimension(self) -> int:
        return 4096  # llama3 default

    def is_available(self) -> bool:
        try:
            import httpx

            r = httpx.get(f"{self.base_url}/api/tags", timeout=3)
            return r.status_code == 200
        except Exception:
            return False
