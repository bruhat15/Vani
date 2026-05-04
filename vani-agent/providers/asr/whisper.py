"""
Whisper ASR Provider — Phase 1 implementation.

Uses faster-whisper (CTranslate2 optimized) for fast, accurate English transcription.
Also supports multilingual detection — will be replaced by IndicConformer in Phase 3
for Hindi/Indic languages.
"""

import asyncio
import time
import logging
import re
from collections import Counter
from typing import AsyncIterator

import numpy as np

from .base import ASRProvider, TranscriptionResult

logger = logging.getLogger(__name__)


class WhisperASR(ASRProvider):
    """
    faster-whisper based ASR provider.
    Runs on CPU comfortably with 'base' or 'small' model size.
    """

    def __init__(self, model_size: str = "base", device: str = "cpu"):
        """
        Args:
            model_size: 'tiny', 'base', 'small', 'medium', 'large-v3'
                        Use 'base' for Phase 1 (fast, decent quality)
            device: 'cpu' or 'cuda'
        """
        self.model_size = model_size
        self.device = device
        self._model = None

    async def initialize(self) -> None:
        """Load faster-whisper model into memory."""
        from faster_whisper import WhisperModel

        logger.info(f"Loading Whisper model '{self.model_size}' on {self.device}...")
        # compute_type: int8 for CPU (memory-efficient), float16 for GPU
        compute_type = "int8" if self.device == "cpu" else "float16"
        self._model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=compute_type,
        )
        logger.info("Whisper model loaded.")

    async def transcribe(
        self, audio_frames: np.ndarray, sample_rate: int = 16000
    ) -> TranscriptionResult:
        """
        Transcribe a complete audio utterance.

        Audio must be float32 mono. Whisper expects 16kHz.
        If sample_rate != 16000, we resample.
        """
        if self._model is None:
            raise RuntimeError("WhisperASR not initialized. Call initialize() first.")

        # Resample if needed
        audio = self._ensure_16khz(audio_frames, sample_rate)

        t0 = time.perf_counter()

        # Run blocking CPU inference in a thread pool — never block the event loop
        def _run_whisper():
            segs, inf = self._model.transcribe(
                audio,
                beam_size=3,          # Reduced for lower latency (default is 5)
                language=None,        # Auto-detect language
                vad_filter=True,      # Filter out silence
                vad_parameters=dict(
                    min_silence_duration_ms=300,
                    speech_pad_ms=100,
                ),
            )
            return list(segs), inf   # materialise the lazy generator inside the thread

        segments, info = await asyncio.to_thread(_run_whisper)
        raw_text = " ".join(seg.text for seg in segments).strip()
        duration_ms = (time.perf_counter() - t0) * 1000

        # ── Hallucination filter ────────────────────────────────────────────
        # Whisper fills silence with repeated tokens (e.g. "Good. Good. Good.")
        # Reject transcripts where one word accounts for >40% of all words.
        text = self._filter_hallucination(raw_text)

        logger.debug(
            f"ASR: '{text}' | lang={info.language} "
            f"({info.language_probability:.2f}) | {duration_ms:.0f}ms"
        )

        return TranscriptionResult(
            text=text,
            language=info.language,
            confidence=info.language_probability,
            is_final=True,
            duration_ms=duration_ms,
        )

    async def transcribe_stream(
        self, audio_stream: AsyncIterator[np.ndarray], sample_rate: int = 16000
    ) -> AsyncIterator[TranscriptionResult]:
        """
        Streaming transcription — buffers audio and transcribes on VAD silence.

        NOTE: faster-whisper doesn't natively stream. We buffer chunks and
        transcribe when we detect a silence gap. True streaming ASR
        will come with IndicConformer in Phase 3.
        """
        buffer = []
        async for chunk in audio_stream:
            buffer.append(chunk)

        if buffer:
            full_audio = np.concatenate(buffer)
            result = await self.transcribe(full_audio, sample_rate)
            yield result

    def _filter_hallucination(self, text: str) -> str:
        """
        Detect and discard Whisper hallucinations.
        Returns empty string if the transcript looks hallucinated.
        """
        if not text:
            return text

        words = re.findall(r"\w+", text.lower())
        if len(words) < 3:
            return text  # Too short to judge

        most_common_word, most_common_count = Counter(words).most_common(1)[0]
        repetition_ratio = most_common_count / len(words)

        if repetition_ratio > 0.4:
            logger.warning(
                f"ASR hallucination detected ('{most_common_word}' x{most_common_count}/{len(words)}) "
                f"— discarding: '{text[:60]}'"
            )
            return ""

        return text

    def _ensure_16khz(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """Resample audio to 16kHz if necessary."""
        if sample_rate == 16000:
            return audio.astype(np.float32)
        try:
            import librosa
            return librosa.resample(
                audio.astype(np.float32), orig_sr=sample_rate, target_sr=16000
            )
        except ImportError:
            # Naive decimation if librosa not available — works for small ratios
            ratio = sample_rate // 16000
            return audio[::ratio].astype(np.float32)

    async def shutdown(self) -> None:
        self._model = None
        logger.info("WhisperASR shut down.")
