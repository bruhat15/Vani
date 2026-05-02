"""
Vani Voice Agent — Provider abstract base classes.

Every AI component (ASR, LLM, TTS, RAG, Memory) is behind an abstract interface.
This enables:
1. Swapping implementations without touching the pipeline
2. Easy testing with mock providers
3. Clean extraction to vani-core SDK (Option C)

IMPORTANT: No LiveKit imports in this package. Framework coupling stays in agent.py only.
"""
