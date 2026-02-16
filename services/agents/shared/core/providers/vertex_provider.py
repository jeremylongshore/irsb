"""
Vertex AI Gemini provider — cloud LLM and embeddings.
"""

import time
from typing import Any

from ..config import Config
from .base import EmbeddingProvider, LLMProvider


class VertexLLMProvider(LLMProvider):
    def __init__(
        self,
        project: str | None = None,
        region: str | None = None,
        model: str | None = None,
    ):
        self.project = project or Config.GOOGLE_CLOUD_PROJECT
        self.region = region or Config.GOOGLE_CLOUD_REGION
        self.model = model or Config.VERTEX_MODEL
        if not self.project:
            raise ValueError("GOOGLE_CLOUD_PROJECT required")
        self._initialized = False

    def _init_vertex(self) -> None:
        if not self._initialized:
            from google.cloud import aiplatform

            aiplatform.init(project=self.project, location=self.region)
            self._initialized = True

    def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        return self.generate_with_messages(
            [{"role": "user", "content": prompt}],
            max_tokens=max_tokens or 1024,
            temperature=temperature,
            **kwargs,
        )

    def generate_with_messages(
        self,
        messages: list[dict[str, str]],
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        self._init_vertex()
        from vertexai.generative_models import GenerationConfig, GenerativeModel

        system_instruction = None
        content_parts = []
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                content_parts.append(msg["content"])

        gen_config = GenerationConfig(
            max_output_tokens=max_tokens or 1024,
            temperature=temperature,
        )

        model = GenerativeModel(
            self.model,
            system_instruction=system_instruction if system_instruction else None,
        )

        for attempt in range(3):
            try:
                resp = model.generate_content(
                    "\n\n".join(content_parts),
                    generation_config=gen_config,
                )
                return str(resp.text)
            except Exception as e:
                if "429" in str(e).lower() and attempt < 2:
                    time.sleep(2**attempt)
                    continue
                raise

        raise RuntimeError("Max retries exceeded")

    def get_model_name(self) -> str:
        return self.model

    def is_available(self) -> bool:
        return bool(self.project)


class VertexEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        project: str | None = None,
        region: str | None = None,
        model: str = "textembedding-gecko@003",
    ):
        self.project = project or Config.GOOGLE_CLOUD_PROJECT
        self.region = region or Config.GOOGLE_CLOUD_REGION
        self.model = model
        if not self.project:
            raise ValueError("GOOGLE_CLOUD_PROJECT required")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        from google.cloud import aiplatform

        aiplatform.init(project=self.project, location=self.region)
        from vertexai.language_models import TextEmbeddingModel

        model = TextEmbeddingModel.from_pretrained(self.model)
        embeddings = model.get_embeddings(texts)
        return [e.values for e in embeddings]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]

    def get_embedding_dimension(self) -> int:
        return 768

    def is_available(self) -> bool:
        return bool(self.project)
