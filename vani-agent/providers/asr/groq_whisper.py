"""
Groq Whisper ASR Provider — Phase 2 ASR upgrade.

Replaces local faster-whisper (CPU, 700MB RAM, 3-5s latency) with
Groq's hosted whisper-large-v3-turbo:
  - ~300ms transcription latency (10× faster than CPU Whisper base)
  - Zero local memory footprint — model runs on Groq's hardware
  - Better accuracy — large-v3-turbo vs base model
  - Cost: ~$0.04/hr of audio — negligible for dev/testing

Same GROQ_API_KEY as the LLM — no new credentials needed.
"""

import io
import logging
import re
import struct
import time
from collections import Counter
from typing import AsyncIterator

import numpy as np

from .base import ASRProvider, TranscriptionResult

logger = logging.getLogger(__name__)


class GroqWhisperASR(ASRProvider):
    """
    Groq-hosted Whisper ASR via API.
    Model: whisper-large-v3-turbo (fast + accurate; best Groq audio option)
    """

    def __init__(self, api_key: str, model: str = "whisper-large-v3-turbo"):
        self.api_key = api_key
        self.model = model
        self._client = None

    async def initialize(self) -> None:
        """Create the async Groq client."""
        from groq import AsyncGroq
        self._client = AsyncGroq(api_key=self.api_key)
        logger.info(f"GroqWhisperASR initialized (model={self.model}).")

    async def transcribe(
        self, audio_frames: np.ndarray, sample_rate: int = 48000
    ) -> TranscriptionResult:
        """
        Transcribe audio via Groq Whisper API.

        Args:
            audio_frames: float32 mono PCM audio
            sample_rate: actual sample rate from LiveKit (typically 48000 from Chrome)
        """
        if self._client is None:
            raise RuntimeError("GroqWhisperASR not initialized. Call initialize() first.")

        # Resample to 16kHz — Whisper API requirement
        audio_16k = self._ensure_16khz(audio_frames, sample_rate)

        # Encode as WAV bytes (no disk I/O — in-memory only)
        wav_bytes = self._to_wav_bytes(audio_16k, sample_rate=16000)

        t0 = time.perf_counter()
        try:
            # Groq audio API accepts a (filename, file_bytes, content_type) tuple
            response = await self._client.audio.transcriptions.create(
                model=self.model,
                file=("utterance.wav", wav_bytes, "audio/wav"),
                language="en",          # Force English — faster, more accurate
                response_format="text",
            )
            # response is a plain string when response_format="text"
            raw_text = (response or "").strip()
        except Exception as e:
            logger.warning(f"GroqWhisperASR API error: {e}")
            raw_text = ""

        duration_ms = (time.perf_counter() - t0) * 1000

        # Apply same hallucination filter as local Whisper
        text = self._filter_hallucination(raw_text)

        if text:
            logger.debug(f"GroqWhisperASR: '{text}' | {duration_ms:.0f}ms")

        return TranscriptionResult(
            text=text,
            language="en",
            confidence=1.0,   # Groq API doesn't return confidence scores
            is_final=True,
            duration_ms=duration_ms,
        )

    async def transcribe_stream(
        self, audio_stream: AsyncIterator[np.ndarray], sample_rate: int = 48000
    ) -> AsyncIterator[TranscriptionResult]:
        """Buffer and transcribe (Groq Whisper is not a streaming API)."""
        buffer = []
        async for chunk in audio_stream:
            buffer.append(chunk)
        if buffer:
            full_audio = np.concatenate(buffer)
            result = await self.transcribe(full_audio, sample_rate)
            yield result

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _to_wav_bytes(self, audio: np.ndarray, sample_rate: int) -> bytes:
        """Encode float32 mono numpy array as 16-bit PCM WAV (no external deps)."""
        pcm_int16 = (audio * 32767).clip(-32768, 32767).astype(np.int16)
        data = pcm_int16.tobytes()

        num_channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8
        data_size = len(data)

        header = struct.pack(
            "<4sI4s4sIHHIIHH4sI",
            b"RIFF", 36 + data_size, b"WAVE",
            b"fmt ", 16,
            1,             # PCM format
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b"data", data_size,
        )
        return header + data

    def _ensure_16khz(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """Resample to 16kHz if necessary."""
        if sample_rate == 16000:
            return audio.astype(np.float32)
        try:
            import librosa
            return librosa.resample(
                audio.astype(np.float32), orig_sr=sample_rate, target_sr=16000
            )
        except ImportError:
            # Naive decimation if librosa not available
            ratio = sample_rate // 16000
            return audio[::ratio].astype(np.float32)

    def _filter_hallucination(self, text: str) -> str:
        """Discard Whisper hallucinations (repeated tokens)."""
        if not text:
            return text
        words = re.findall(r"\w+", text.lower())
        if len(words) < 3:
            return text
        most_common_word, most_common_count = Counter(words).most_common(1)[0]
        if most_common_count / len(words) > 0.4:
            logger.warning(
                f"ASR hallucination detected ('{most_common_word}' "
                f"x{most_common_count}/{len(words)}) — discarding: '{text[:60]}'"
            )
            return ""
        return text

    async def shutdown(self) -> None:
        self._client = None
        logger.info("GroqWhisperASR shut down.")
