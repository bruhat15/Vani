"""
Vani Voice Pipeline — Phase 1 skeleton.

Chains: ASR → RAG (Phase 2) → LLM → TTS → audio output.

In Phase 1: RAG is a no-op stub. We wire ASR → LLM → TTS to verify
the full voice loop works end-to-end before adding retrieval.

Design rules:
  - No LiveKit imports here. This file is provider-agnostic.
  - All providers are injected via constructor (dependency injection).
  - This file IS the future vani-core SDK's main class.
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Callable, Awaitable

import numpy as np

from providers.asr.base import ASRProvider, TranscriptionResult
from providers.llm.base import LLMProvider, LLMMessage
from providers.tts.base import TTSProvider, AudioChunk
from providers.rag.base import RAGProvider

logger = logging.getLogger(__name__)

# Sentence boundary regex — handles English and Hindi (।)
_SENTENCE_BOUNDARY = re.compile(r'(?<=[.!?।\n])\s*')


@dataclass
class PipelineContext:
    """Context passed through a single voice turn."""
    notebook_id: str = ""
    user_id: str = ""
    session_id: str = ""
    turn_index: int = 0
    language: str = "en"

    # Populated as the turn progresses
    user_transcript: str = ""
    agent_response: str = ""
    citations: list[dict] = field(default_factory=list)
    retrieved_chunk_ids: list[int] = field(default_factory=list)

    # Latency tracking (milliseconds)
    t_asr_done: float = 0.0
    t_rag_done: float = 0.0
    t_llm_ttft: float = 0.0
    t_tts_first_chunk: float = 0.0
    t_turn_start: float = 0.0

    @property
    def ttfa_ms(self) -> float:
        """Time-to-first-audio from end of user speech."""
        if self.t_tts_first_chunk and self.t_asr_done:
            return (self.t_tts_first_chunk - self.t_asr_done) * 1000
        return 0.0


# Type aliases for callbacks
AudioOutputCallback = Callable[[AudioChunk], Awaitable[None]]
TranscriptCallback = Callable[[str, str], Awaitable[None]]   # (user_text, agent_text)
CitationCallback = Callable[[list[dict]], Awaitable[None]]


class VaniPipeline:
    """
    Core voice pipeline: ASR → RAG → LLM → TTS.

    Usage:
        pipeline = VaniPipeline(asr=..., llm=..., tts=...)
        await pipeline.initialize()
        await pipeline.process_turn(audio_frames, context, on_audio=..., on_transcript=...)
    """

    def __init__(
        self,
        asr: ASRProvider,
        llm: LLMProvider,
        tts: TTSProvider,
        rag: RAGProvider | None = None,      # None in Phase 1
        sentence_buffer_min_chars: int = 40,
    ):
        self.asr = asr
        self.llm = llm
        self.tts = tts
        self.rag = rag
        self.sentence_buffer_min_chars = sentence_buffer_min_chars

        # Conversation history (kept in memory, persisted externally by memory provider)
        self._history: list[LLMMessage] = []
        self._is_speaking = False   # True while agent is pushing TTS audio
        self._interrupt_event = asyncio.Event()

    async def initialize(self) -> None:
        """Initialize all providers. Call once before first turn."""
        logger.info("Initializing Vani pipeline...")
        await self.asr.initialize()
        await self.llm.initialize()
        await self.tts.initialize()
        if self.rag:
            await self.rag.initialize()
        logger.info("Pipeline ready.")

    async def shutdown(self) -> None:
        """Gracefully shut down all providers."""
        await self.asr.shutdown()
        await self.llm.shutdown()
        await self.tts.shutdown()
        if self.rag:
            await self.rag.shutdown()
        logger.info("Pipeline shut down.")

    def interrupt(self) -> None:
        """
        Signal the pipeline to stop current TTS playback (barge-in / interruption).
        Call this when VAD detects the user has started speaking again.
        """
        if self._is_speaking:
            logger.debug("Interrupt received — stopping TTS playback.")
            self._interrupt_event.set()

    async def process_turn(
        self,
        audio_frames: np.ndarray,
        context: PipelineContext,
        on_audio: AudioOutputCallback,
        on_transcript: TranscriptCallback | None = None,
        on_citations: CitationCallback | None = None,
    ) -> PipelineContext:
        """
        Process one complete voice turn: audio in → audio out.

        Args:
            audio_frames: Mono float32 PCM from user microphone
            context: Turn context (notebook_id, user_id, turn_index, etc.)
            on_audio: Async callback — called for each AudioChunk to push to LiveKit
            on_transcript: Optional callback with (user_text, agent_text) for UI display
            on_citations: Optional callback with retrieved citations for UI display

        Returns:
            Populated PipelineContext with transcript, response, and latency metrics
        """
        self._interrupt_event.clear()
        self._is_speaking = False
        context.t_turn_start = time.perf_counter()

        # ── Step 1: ASR ──────────────────────────────────────────────────
        logger.info("ASR: transcribing...")
        asr_result: TranscriptionResult = await self.asr.transcribe(audio_frames)
        context.t_asr_done = time.perf_counter()
        context.user_transcript = asr_result.text
        context.language = asr_result.language

        if not asr_result.text.strip():
            logger.warning("ASR returned empty transcript — skipping turn.")
            return context

        logger.info(f"ASR [{asr_result.language}]: '{asr_result.text}'")

        # ── Step 2: RAG retrieval (Phase 2 — no-op stub for Phase 1) ────
        rag_context_str = ""
        if self.rag and context.notebook_id:
            logger.info(f"RAG: retrieving for notebook {context.notebook_id}...")
            t_rag_start = time.perf_counter()
            rag_result = await self.rag.retrieve(
                query=asr_result.text,
                notebook_id=context.notebook_id,
            )
            context.t_rag_done = time.perf_counter()
            context.retrieved_chunk_ids = [
                c.chunk_index for c in rag_result.chunks
            ]
            rag_context_str = rag_result.as_context_string()
            logger.info(f"RAG: {len(rag_result.chunks)} chunks in "
                        f"{(context.t_rag_done - t_rag_start)*1000:.0f}ms")
        else:
            context.t_rag_done = context.t_asr_done  # no RAG cost in Phase 1

        # ── Step 3: Build LLM messages ───────────────────────────────────
        user_message_content = asr_result.text
        if rag_context_str:
            user_message_content = (
                f"Use ONLY these sources to answer:\n\n{rag_context_str}\n\n"
                f"Question: {asr_result.text}"
            )

        # Append to rolling history
        self._history.append(LLMMessage(role="user", content=user_message_content))
        # Keep history bounded
        if len(self._history) > 20:
            self._history = self._history[-20:]

        # Notify UI of user transcript immediately
        if on_transcript:
            await on_transcript(asr_result.text, "")

        # ── Step 4: LLM streaming → sentence buffer → TTS streaming ─────
        logger.info("LLM: streaming response...")
        agent_response = ""
        sentence_buffer = ""
        first_audio_sent = False
        t_llm_start = time.perf_counter()

        self._is_speaking = True
        try:
            async for chunk in self.llm.generate_stream(self._history):
                # Check for interrupt signal
                if self._interrupt_event.is_set():
                    logger.info("Barge-in detected — stopping response.")
                    break

                agent_response += chunk.token
                sentence_buffer += chunk.token

                # Measure TTFT on first token
                if not context.t_llm_ttft and chunk.token:
                    context.t_llm_ttft = time.perf_counter()
                    logger.debug(
                        f"LLM TTFT: {(context.t_llm_ttft - t_llm_start)*1000:.0f}ms"
                    )

                # Check if we have a complete sentence to synthesize
                if self._has_sentence_boundary(sentence_buffer):
                    sentences = self._split_sentences(sentence_buffer)
                    # Keep the incomplete last part in buffer
                    sentence_buffer = sentences[-1]
                    to_speak = " ".join(sentences[:-1]).strip()

                    if to_speak:
                        await self._speak_and_send(
                            text=to_speak,
                            language=context.language,
                            on_audio=on_audio,
                            context=context,
                            is_first=not first_audio_sent,
                        )
                        first_audio_sent = True

            # Flush remaining buffer
            if sentence_buffer.strip() and not self._interrupt_event.is_set():
                await self._speak_and_send(
                    text=sentence_buffer.strip(),
                    language=context.language,
                    on_audio=on_audio,
                    context=context,
                    is_first=not first_audio_sent,
                )

        finally:
            self._is_speaking = False

        # ── Step 5: Finalize context ─────────────────────────────────────
        context.agent_response = agent_response
        self._history.append(LLMMessage(role="assistant", content=agent_response))

        # Notify UI of agent response text
        if on_transcript:
            await on_transcript(asr_result.text, agent_response)

        logger.info(
            f"Turn complete | TTFA={context.ttfa_ms:.0f}ms | "
            f"response={len(agent_response)} chars"
        )
        return context

    async def _speak_and_send(
        self,
        text: str,
        language: str,
        on_audio: AudioOutputCallback,
        context: PipelineContext,
        is_first: bool = False,
    ) -> None:
        """Synthesize text and stream audio chunks to the output callback."""
        t_tts_start = time.perf_counter()
        async for audio_chunk in self.tts.synthesize_stream(text, language=language):
            if self._interrupt_event.is_set():
                break
            if is_first and not context.t_tts_first_chunk:
                context.t_tts_first_chunk = time.perf_counter()
                logger.info(f"TTFA: {context.ttfa_ms:.0f}ms")
            await on_audio(audio_chunk)

    def _has_sentence_boundary(self, text: str) -> bool:
        """Check if the text contains at least one sentence boundary."""
        return bool(_SENTENCE_BOUNDARY.search(text)) and len(text) >= self.sentence_buffer_min_chars

    def _split_sentences(self, text: str) -> list[str]:
        """Split text at sentence boundaries, keeping the last fragment."""
        parts = _SENTENCE_BOUNDARY.split(text)
        return [p for p in parts if p] or [text]

    def reset_history(self) -> None:
        """Clear conversation history (e.g. when starting a new session)."""
        self._history.clear()
