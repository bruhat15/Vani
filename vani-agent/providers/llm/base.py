"""
LLM Provider — Abstract base class for language model inference.

Implementations:
  - GroqLLM (Phase 1): Cloud API, ~100-200ms TTFT, streaming
  - OllamaLLM (Phase 2): Local inference, ~500ms TTFT, privacy-first fallback
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class LLMMessage:
    """A single message in a conversation."""
    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMStreamChunk:
    """A single chunk from a streaming LLM response."""
    token: str
    finish_reason: str | None = None
    # Accumulated text up to this point (useful for sentence detection)
    accumulated_text: str = ""


@dataclass
class LLMResponse:
    """Complete LLM response (non-streaming)."""
    text: str
    model: str = ""
    usage_prompt_tokens: int = 0
    usage_completion_tokens: int = 0
    ttft_ms: float = 0.0  # Time to first token


class LLMProvider(ABC):
    """Abstract interface for language model providers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Prepare the provider for inference. Called once at startup."""
        ...

    @abstractmethod
    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        """
        Generate a complete response (non-streaming).

        Args:
            messages: Conversation history as a list of LLMMessage

        Returns:
            LLMResponse with full text
        """
        ...

    @abstractmethod
    async def generate_stream(self, messages: list[LLMMessage]) -> AsyncIterator[LLMStreamChunk]:
        """
        Generate a streaming response.

        Args:
            messages: Conversation history as a list of LLMMessage

        Yields:
            LLMStreamChunk with individual tokens as they arrive
        """
        ...
        yield  # pragma: no cover

    async def shutdown(self) -> None:
        """Release resources. Override if cleanup is needed."""
        pass
