"""
Kokoro TTS Provider — Phase 1 implementation.

Kokoro is a fast, lightweight, high-quality English TTS model (Apache 2.0).
It runs efficiently on CPU and produces natural-sounding speech.
Used in Phase 1 and as the English fallback in Phase 3.

Install: pip install kokoro soundfile
Model download happens automatically on first use.
"""

import logging
import re
import time
from typing import AsyncIterator

import numpy as np

from .base import TTSProvider, AudioChunk

logger = logging.getLogger(__name__)

# Sentence boundary patterns
_SENTENCE_END = re.compile(r'(?<=[.!?।])\s+')


class KokoroTTS(TTSProvider):
    """
    Kokoro TTS — fast CPU-friendly English TTS.
    Voice: 'af_heart' (warm, natural female voice — good for a tutor)
    """

    def __init__(self, voice: str = "af_heart", speed: float = 1.0):
        """
        Args:
            voice: Kokoro voice identifier. Options: af_heart, af_bella, am_adam, etc.
            speed: Playback speed multiplier (1.0 = normal)
        """
        self.voice = voice
        self.speed = speed
        self._pipeline = None
        self._sample_rate = 24000

    async def initialize(self) -> None:
        """Load Kokoro pipeline."""
        from kokoro import KPipeline

        logger.info(f"Loading Kokoro TTS (voice={self.voice})...")
        # lang_code='a' for American English
        self._pipeline = KPipeline(lang_code="a")
        logger.info("Kokoro TTS loaded.")

    async def synthesize(self, text: str, language: str = "en") -> np.ndarray:
        """Synthesize complete audio for a text string."""
        if self._pipeline is None:
            raise RuntimeError("KokoroTTS not initialized.")

        t0 = time.perf_counter()
        audio_parts = []

        # Kokoro returns a generator of (graphemes, phonemes, audio) tuples
        for _, _, audio in self._pipeline(text, voice=self.voice, speed=self.speed):
            audio_parts.append(audio)

        result = np.concatenate(audio_parts) if audio_parts else np.array([], dtype=np.float32)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.debug(f"KokoroTTS: synthesized {len(text)} chars in {elapsed_ms:.0f}ms")

        return result

    async def synthesize_stream(
        self, text: str, language: str = "en"
    ) -> AsyncIterator[AudioChunk]:
        """
        Streaming synthesis — yields audio per Kokoro segment.
        Kokoro naturally segments text, so each segment is yielded as soon
        as it's ready, enabling low perceived latency.
        """
        if self._pipeline is None:
            raise RuntimeError("KokoroTTS not initialized.")

        segments = list(self._pipeline(text, voice=self.voice, speed=self.speed))

        for i, (_, _, audio) in enumerate(segments):
            is_final = i == len(segments) - 1
            yield AudioChunk(
                samples=audio,
                sample_rate=self._sample_rate,
                is_final=is_final,
            )

    @property
    def sample_rate(self) -> int:
        return self._sample_rate

    async def shutdown(self) -> None:
        self._pipeline = None
        logger.info("KokoroTTS shut down.")
