"""
ASR Provider — Abstract base class for Speech-to-Text.

Implementations:
  - WhisperASR (Phase 1): faster-whisper, good English, decent multilingual
  - IndicConformerASR (Phase 3): AI4Bharat, 22 Indian languages, < 15% WER Hindi
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator
import numpy as np


@dataclass
class TranscriptionResult:
    """Result from ASR processing."""
    text: str
    language: str = "en"
    confidence: float = 0.0
    is_final: bool = True
    duration_ms: float = 0.0


class ASRProvider(ABC):
    """Abstract interface for speech-to-text providers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Load model and prepare for inference. Called once at startup."""
        ...

    @abstractmethod
    async def transcribe(self, audio_frames: np.ndarray, sample_rate: int = 16000) -> TranscriptionResult:
        """
        Transcribe a complete utterance.

        Args:
            audio_frames: PCM audio as float32 numpy array, mono
            sample_rate: Audio sample rate in Hz

        Returns:
            TranscriptionResult with text, detected language, and confidence
        """
        ...

    @abstractmethod
    async def transcribe_stream(
        self, audio_stream: AsyncIterator[np.ndarray], sample_rate: int = 16000
    ) -> AsyncIterator[TranscriptionResult]:
        """
        Stream transcription with partial results.

        Args:
            audio_stream: Async iterator of PCM audio chunks
            sample_rate: Audio sample rate in Hz

        Yields:
            TranscriptionResult — partial results (is_final=False) and final result (is_final=True)
        """
        ...
        yield  # pragma: no cover — makes this a valid async generator

    async def shutdown(self) -> None:
        """Release resources. Override if cleanup is needed."""
        pass
