"""
Vani Voice Agent — Configuration

All settings are loaded from environment variables.
Provider selection and model paths are configured here.
"""

from pydantic import BaseModel, Field
from enum import Enum
import os
from dotenv import load_dotenv

load_dotenv()


class ASRBackend(str, Enum):
    WHISPER = "whisper"
    INDIC_CONFORMER = "indic_conformer"


class LLMBackend(str, Enum):
    GROQ = "groq"
    OLLAMA = "ollama"


class TTSBackend(str, Enum):
    KOKORO = "kokoro"
    INDIC_F5 = "indic_f5"


class VaniConfig(BaseModel):
    """Central configuration for the Vani voice agent."""

    # --- LiveKit ---
    livekit_url: str = Field(default_factory=lambda: os.getenv("LIVEKIT_URL", "ws://localhost:7880"))
    livekit_api_key: str = Field(default_factory=lambda: os.getenv("LIVEKIT_API_KEY", ""))
    livekit_api_secret: str = Field(default_factory=lambda: os.getenv("LIVEKIT_API_SECRET", ""))

    # --- Provider selection ---
    asr_backend: ASRBackend = Field(default_factory=lambda: ASRBackend(os.getenv("ASR_BACKEND", "whisper")))
    llm_backend: LLMBackend = Field(default_factory=lambda: LLMBackend(os.getenv("LLM_BACKEND", "groq")))
    tts_backend: TTSBackend = Field(default_factory=lambda: TTSBackend(os.getenv("TTS_BACKEND", "kokoro")))

    # --- ASR settings ---
    whisper_model_size: str = Field(default_factory=lambda: os.getenv("WHISPER_MODEL_SIZE", "base"))
    indic_conformer_model_path: str = Field(
        default_factory=lambda: os.getenv("INDIC_CONFORMER_MODEL_PATH", "./models/indic-conformer")
    )

    # --- LLM settings ---
    groq_api_key: str = Field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    groq_model: str = Field(default_factory=lambda: os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))
    ollama_base_url: str = Field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    ollama_model: str = Field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "mistral"))

    # --- TTS settings ---
    kokoro_model_path: str = Field(default_factory=lambda: os.getenv("KOKORO_MODEL_PATH", "./models/kokoro"))
    indic_f5_model_path: str = Field(
        default_factory=lambda: os.getenv("INDIC_F5_MODEL_PATH", "./models/indic-f5")
    )
    tts_voice: str = Field(default_factory=lambda: os.getenv("TTS_VOICE", "af_heart"))
    tts_sample_rate: int = Field(default_factory=lambda: int(os.getenv("TTS_SAMPLE_RATE", "24000")))

    # --- RAG / Supabase ---
    supabase_url: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    supabase_service_role_key: str = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    rag_top_k: int = Field(default_factory=lambda: int(os.getenv("RAG_TOP_K", "5")))
    embedding_model: str = Field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "nomic-embed-text"))

    # --- Voice pipeline ---
    sentence_buffer_min_chars: int = Field(
        default_factory=lambda: int(os.getenv("SENTENCE_BUFFER_MIN_CHARS", "40"))
    )
    max_conversation_history_turns: int = Field(
        default_factory=lambda: int(os.getenv("MAX_CONVERSATION_HISTORY_TURNS", "10"))
    )

    # --- Telemetry ---
    otel_enabled: bool = Field(default_factory=lambda: os.getenv("OTEL_ENABLED", "false").lower() == "true")
    otel_exporter_endpoint: str = Field(
        default_factory=lambda: os.getenv("OTEL_EXPORTER_ENDPOINT", "http://localhost:4317")
    )


def load_config() -> VaniConfig:
    """Load and return the global config."""
    return VaniConfig()
