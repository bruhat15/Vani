"""
Groq LLM Provider — Phase 1 implementation.

Groq's inference API delivers ~100-200ms TTFT on Llama/Mistral models
via their custom LPU hardware. This is the primary LLM for Phase 1 & 2.

You already have a Groq API key in your gcp-n8n-ops.md.
"""

import time
import logging
from typing import AsyncIterator

from .base import LLMProvider, LLMMessage, LLMStreamChunk, LLMResponse

logger = logging.getLogger(__name__)


# Voice-optimised system prompt. Concise answers suit spoken output.
# Phase 1: No RAG — LLM answers from general knowledge.
# Phase 2: Will prepend retrieved source chunks to user messages.
VOICE_SYSTEM_PROMPT = """You are Vani, a friendly and knowledgeable personal tutor. \
You help users learn and understand topics by answering questions conversationally.

Rules:
- Give clear, accurate answers from your knowledge. Be helpful.
- Keep answers concise: 2-4 sentences max. Your output will be spoken aloud.
- Do not use bullet points, markdown, or special formatting — plain speech only.
- If you genuinely don't know something, say so briefly.
- Respond in the same language the user asked in (English or Hindi)."""



class GroqLLM(LLMProvider):
    """
    Groq API LLM provider with streaming support.
    Model: llama-3.3-70b-versatile (good balance of quality and speed)
    """

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        self.api_key = api_key
        self.model = model
        self._client = None

    async def initialize(self) -> None:
        """Create the async Groq client."""
        from groq import AsyncGroq

        self._client = AsyncGroq(api_key=self.api_key)
        logger.info(f"GroqLLM initialized with model '{self.model}'.")

    def _build_messages(self, messages: list[LLMMessage]) -> list[dict]:
        """Convert our LLMMessage list to Groq's format."""
        groq_messages = []

        # Inject system prompt if not already present
        if not messages or messages[0].role != "system":
            groq_messages.append({"role": "system", "content": VOICE_SYSTEM_PROMPT})

        for msg in messages:
            groq_messages.append({"role": msg.role, "content": msg.content})

        return groq_messages

    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        """Non-streaming generation (used for testing or fallback)."""
        if self._client is None:
            raise RuntimeError("GroqLLM not initialized.")

        t0 = time.perf_counter()
        response = await self._client.chat.completions.create(
            model=self.model,
            messages=self._build_messages(messages),
            temperature=0.5,
            max_tokens=120,      # ~2-3 spoken sentences. 300 caused 10-13s TTS synthesis.
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        text = response.choices[0].message.content or ""

        logger.debug(f"GroqLLM non-stream: {len(text)} chars in {elapsed_ms:.0f}ms")

        return LLMResponse(
            text=text,
            model=self.model,
            usage_prompt_tokens=response.usage.prompt_tokens,
            usage_completion_tokens=response.usage.completion_tokens,
            ttft_ms=elapsed_ms,  # Approximate for non-streaming
        )

    async def generate_stream(
        self, messages: list[LLMMessage]
    ) -> AsyncIterator[LLMStreamChunk]:
        """
        Streaming generation — yields tokens as they arrive from Groq.
        This enables the sentence-buffer → TTS pipeline to start
        synthesizing audio before the full response is complete.
        """
        if self._client is None:
            raise RuntimeError("GroqLLM not initialized.")

        accumulated = ""
        t0 = time.perf_counter()
        first_token = True

        stream = await self._client.chat.completions.create(
            model=self.model,
            messages=self._build_messages(messages),
            temperature=0.5,
            max_tokens=300,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta is None:
                continue

            if first_token:
                ttft_ms = (time.perf_counter() - t0) * 1000
                logger.debug(f"GroqLLM TTFT: {ttft_ms:.0f}ms")
                first_token = False

            accumulated += delta
            finish_reason = chunk.choices[0].finish_reason

            yield LLMStreamChunk(
                token=delta,
                finish_reason=finish_reason,
                accumulated_text=accumulated,
            )

    async def shutdown(self) -> None:
        self._client = None
        logger.info("GroqLLM shut down.")
