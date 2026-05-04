"""
Google Cloud Text-to-Speech Provider — Phase 2 TTS upgrade.

Replaces Kokoro (CPU, 10-20s per response) with Google Cloud TTS Neural2:
  - ~150-300ms per sentence synthesis call
  - No local RAM footprint — runs on Google's hardware
  - 1 million characters/month FREE on Neural2 voices (GCP free tier)
  - Uses simple REST API key — no service account JSON needed

Setup (one-time, 2 minutes):
  1. Go to GCP Console → APIs & Services → Enable "Cloud Text-to-Speech API"
  2. Go to APIs & Services → Credentials → Create API Key
  3. Restrict key to "Cloud Text-to-Speech API"
  4. Add to /opt/n8n/.env: GOOGLE_TTS_API_KEY=your_key_here

Voice options (en-US-Neural2-*):
  A=male, C=female, D=male, E=female, F=female, G=male, H=female, I=male, J=male
  en-US-Neural2-F  ← default (warm female, good for a tutor)
"""

import base64
import logging
import time
from typing import AsyncIterator

import httpx
import numpy as np

from .base import TTSProvider, AudioChunk

logger = logging.getLogger(__name__)

_GCP_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"


class GoogleTTS(TTSProvider):
    """
    Google Cloud TTS via REST API.
    Uses Neural2 voices — production quality, low latency, generous free tier.
    """

    def __init__(
        self,
        api_key: str,
        voice: str = "en-US-Neural2-F",
        sample_rate: int = 24000,
    ):
        if not api_key:
            raise ValueError(
                "GOOGLE_TTS_API_KEY is not set. "
                "See providers/tts/google_tts.py for setup instructions."
            )
        self.api_key = api_key
        self.voice = voice          # e.g. "en-US-Neural2-F"
        self._sample_rate = sample_rate
        self._client: httpx.AsyncClient | None = None

    async def initialize(self) -> None:
        """Create persistent HTTP client (connection pooling = lower latency)."""
        self._client = httpx.AsyncClient(timeout=10.0)
        logger.info(f"GoogleTTS initialized (voice={self.voice}, {self._sample_rate}Hz).")

    async def synthesize(self, text: str, language: str = "en") -> np.ndarray:
        """Synthesize full text in one API call."""
        audio_bytes = await self._call_api(text)
        return self._bytes_to_float32(audio_bytes)

    async def synthesize_stream(
        self, text: str, language: str = "en"
    ) -> AsyncIterator[AudioChunk]:
        """
        Synthesize text in one API call and yield as a single AudioChunk.
        The pipeline already handles sentence-level chunking (sentence_buffer_min_chars),
        so each call to this method receives one sentence at a time.
        Combined latency: Groq Whisper (~300ms) + Groq LLM first sentence (~500ms)
        + Google TTS (~200ms) = ~1s TTFA.
        """
        t0 = time.perf_counter()
        audio_bytes = await self._call_api(text)
        audio = self._bytes_to_float32(audio_bytes)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.debug(f"GoogleTTS: '{text[:40]}...' → {elapsed_ms:.0f}ms, {len(audio)} samples")

        yield AudioChunk(
            samples=audio,
            sample_rate=self._sample_rate,
            is_final=True,
        )

    async def _call_api(self, text: str) -> bytes:
        """POST to Google TTS REST API. Returns raw PCM bytes (LINEAR16)."""
        if not self._client:
            self._client = httpx.AsyncClient(timeout=10.0)

        # Strip text of chars that confuse TTS
        text = text.strip()
        if not text:
            return b""

        lang_code = self.voice[:5]   # "en-US-Neural2-F" → "en-US"

        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": lang_code,
                "name": self.voice,
            },
            "audioConfig": {
                "audioEncoding": "LINEAR16",   # Raw 16-bit PCM, no WAV header
                "sampleRateHertz": self._sample_rate,
                "speakingRate": 1.0,
                "pitch": 0.0,
            },
        }

        try:
            response = await self._client.post(
                _GCP_TTS_URL,
                json=payload,
                params={"key": self.api_key},
            )
            response.raise_for_status()
            data = response.json()
            return base64.b64decode(data["audioContent"])
        except httpx.HTTPStatusError as e:
            logger.error(
                f"GoogleTTS API error {e.response.status_code}: "
                f"{e.response.text[:200]}"
            )
            return b""
        except Exception as e:
            logger.error(f"GoogleTTS error: {e}")
            return b""

    def _bytes_to_float32(self, pcm_bytes: bytes) -> np.ndarray:
        """Convert LINEAR16 bytes → float32 numpy array."""
        if not pcm_bytes:
            return np.array([], dtype=np.float32)
        pcm_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
        return pcm_int16.astype(np.float32) / 32768.0

    @property
    def sample_rate(self) -> int:
        return self._sample_rate

    async def shutdown(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
        logger.info("GoogleTTS shut down.")
