"""
Anthropic Claude provider — cloud LLM via official SDK.
"""

import time
from typing import Any

from ..config import Config
from .base import LLMProvider


class AnthropicLLMProvider(LLMProvider):
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ):
        self.api_key = api_key or Config.ANTHROPIC_API_KEY
        self.model = model or Config.ANTHROPIC_MODEL
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY required")
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from anthropic import Anthropic

            self._client = Anthropic(api_key=self.api_key)
        return self._client

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
        max_tokens = max_tokens or 1024
        client = self._get_client()

        system = kwargs.pop("system", None)
        if not system and messages and messages[0]["role"] == "system":
            system = messages[0]["content"]
            messages = messages[1:]

        for attempt in range(3):
            try:
                resp = client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system or "",
                    messages=messages,
                    **kwargs,
                )
                return str(resp.content[0].text)
            except Exception as e:
                if "429" in str(e).lower() and attempt < 2:
                    time.sleep(2**attempt)
                    continue
                raise

        raise RuntimeError("Max retries exceeded")

    def get_model_name(self) -> str:
        return self.model

    def is_available(self) -> bool:
        return bool(self.api_key)
