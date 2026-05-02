"""
Memory Provider — Abstract base class for conversation memory.

Implementations:
  - SupabaseMemory (Phase 2): Reads/writes voice_turns and voice_sessions tables
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TurnRecord:
    """A single conversation turn stored in memory."""
    session_id: str
    turn_index: int
    user_transcript: str
    agent_response: str
    citations: list[dict] = field(default_factory=list)
    retrieved_chunk_ids: list[int] = field(default_factory=list)

    # Latency metrics (populated after the turn completes)
    latency_asr_ms: int = 0
    latency_rag_ms: int = 0
    latency_llm_ttft_ms: int = 0
    latency_tts_ms: int = 0
    latency_total_ttfa_ms: int = 0

    # Model info
    asr_model: str = ""
    llm_model: str = ""
    tts_model: str = ""
    language_detected: str = "en"


@dataclass
class SessionRecord:
    """A voice session (one per notebook per connection)."""
    id: str
    notebook_id: str
    user_id: str
    total_turns: int = 0


class MemoryProvider(ABC):
    """Abstract interface for conversation memory providers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Prepare connections. Called once at startup."""
        ...

    @abstractmethod
    async def create_session(self, notebook_id: str, user_id: str) -> SessionRecord:
        """
        Create a new voice session.

        Returns:
            SessionRecord with the generated session ID
        """
        ...

    @abstractmethod
    async def load_history(
        self, session_id: str, last_n_turns: int = 10
    ) -> list[TurnRecord]:
        """
        Load the last N turns from a session for LLM context.

        Args:
            session_id: UUID of the voice session
            last_n_turns: Number of most recent turns to load

        Returns:
            List of TurnRecord ordered oldest first
        """
        ...

    @abstractmethod
    async def save_turn(self, turn: TurnRecord) -> None:
        """
        Persist a completed turn to storage.

        Args:
            turn: TurnRecord with all fields populated
        """
        ...

    @abstractmethod
    async def update_session_activity(self, session_id: str, total_turns: int) -> None:
        """Update last_active_at and turn count on the session."""
        ...

    async def shutdown(self) -> None:
        """Release resources. Override if cleanup is needed."""
        pass
