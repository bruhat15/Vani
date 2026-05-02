"""
RAG Provider — Abstract base class for Retrieval-Augmented Generation.

Implementations:
  - SupabasePgvectorRAG (Phase 2): Reuses existing pgvector setup
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class RetrievedChunk:
    """A single retrieved document chunk with metadata."""
    content: str
    source_id: str
    source_title: str
    source_type: str             # pdf, text, website, youtube, audio
    chunk_index: int = 0
    chunk_lines_from: int | None = None
    chunk_lines_to: int | None = None
    similarity_score: float = 0.0


@dataclass
class RAGResult:
    """Result of a RAG retrieval operation."""
    chunks: list[RetrievedChunk] = field(default_factory=list)
    query_text: str = ""
    notebook_id: str = ""
    retrieval_duration_ms: float = 0.0

    def as_context_string(self) -> str:
        """
        Format retrieved chunks as an LLM context string.
        Each chunk is prefixed with its source for citation tracking.
        """
        if not self.chunks:
            return "No relevant sources found."

        lines = []
        for i, chunk in enumerate(self.chunks, 1):
            lines.append(
                f"[Source {i}: {chunk.source_title} (id={chunk.source_id})]"
            )
            lines.append(chunk.content.strip())
            lines.append("")
        return "\n".join(lines)


class RAGProvider(ABC):
    """Abstract interface for retrieval-augmented generation providers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Prepare connections and warm up models. Called once at startup."""
        ...

    @abstractmethod
    async def retrieve(
        self,
        query: str,
        notebook_id: str,
        top_k: int = 5,
    ) -> RAGResult:
        """
        Retrieve the most relevant chunks for a query within a notebook.

        Args:
            query: User's question (plain text)
            notebook_id: UUID of the notebook to scope retrieval to
            top_k: Number of chunks to return

        Returns:
            RAGResult with retrieved chunks sorted by similarity
        """
        ...

    async def shutdown(self) -> None:
        """Release resources. Override if cleanup is needed."""
        pass
