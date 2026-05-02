"""
TTS Provider — Abstract base class for Text-to-Speech.

Implementations:
  - KokoroTTS (Phase 1): Fast, English, Apache 2.0
  - IndicF5TTS (Phase 3): AI4Bharat, 11 Indian languages, near-human prosody
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator
import numpy as np


@dataclass
class AudioChunk:
    """A chunk of synthesized audio."""
    samples: np.ndarray      # float32 PCM, mono
    sample_rate: int         # e.g. 24000
    is_final: bool = False   # True on the last chunk of an utterance


class TTSProvider(ABC):
    """Abstract interface for text-to-speech providers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Load model and prepare for inference. Called once at startup."""
        ...

    @abstractmethod
    async def synthesize(self, text: str, language: str = "en") -> np.ndarray:
        """
        Synthesize complete audio for a text string.

        Args:
            text: Text to speak
            language: BCP-47 language code ('en', 'hi', etc.)

        Returns:
            float32 PCM audio array at self.sample_rate
        """
        ...

    @abstractmethod
    async def synthesize_stream(
        self, text: str, language: str = "en"
    ) -> AsyncIterator[AudioChunk]:
        """
        Streaming synthesis — yields audio chunks as they are generated.
        Useful for sentence-level pipelining with LLM streaming.

        Args:
            text: Text to speak (a complete sentence)
            language: BCP-47 language code

        Yields:
            AudioChunk with PCM samples
        """
        ...
        yield  # pragma: no cover

    @property
    @abstractmethod
    def sample_rate(self) -> int:
        """Output sample rate of this provider."""
        ...

    async def shutdown(self) -> None:
        """Release resources. Override if cleanup is needed."""
        pass
