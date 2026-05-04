"""
Vani Voice Agent — LiveKit entry point.

This is the ONLY file that imports LiveKit. All AI logic lives in pipeline.py
and the providers package — keeping them framework-agnostic and SDK-extractable.

How it works:
1. This process registers with the LiveKit server as a worker.
2. When a user joins a room (via the frontend), LiveKit dispatches a job here.
3. We create a VaniPipeline, subscribe to the user's audio track,
   run PCM frames through the pipeline, and push audio back into the room.
"""

import asyncio
import logging
import os
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentSession, JobContext, WorkerOptions, cli

from config import load_config, ASRBackend, LLMBackend, TTSBackend
from pipeline import VaniPipeline, PipelineContext, AudioChunk
from telemetry import init_telemetry

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vani.agent")

# ── Globals (loaded once, shared across job instances) ──────────────────────
_config = load_config()
init_telemetry(_config)
_pipeline: VaniPipeline | None = None


def _start_health_server() -> None:
    """Start a simple health endpoint for container checks."""
    port = int(os.getenv("HEALTH_PORT", "8080"))

    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"ok")
                return

            self.send_response(404)
            self.end_headers()

        def log_message(self, format, *args):
            return

    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Health server listening on 0.0.0.0:{port}")


async def _build_pipeline() -> VaniPipeline:
    """Instantiate and initialize the pipeline based on config."""
    # ASR provider
    match _config.asr_backend:
        case ASRBackend.WHISPER:
            from providers.asr.whisper import WhisperASR
            asr = WhisperASR(model_size=_config.whisper_model_size)
        case _:
            logger.warning(f"Unknown ASR backend '{_config.asr_backend}', falling back to Whisper")
            from providers.asr.whisper import WhisperASR
            asr = WhisperASR(model_size=_config.whisper_model_size)

    # LLM provider
    match _config.llm_backend:
        case LLMBackend.GROQ:
            from providers.llm.groq import GroqLLM
            llm = GroqLLM(api_key=_config.groq_api_key, model=_config.groq_model)
        case _:
            logger.warning(f"Unknown LLM backend '{_config.llm_backend}', falling back to Groq")
            from providers.llm.groq import GroqLLM
            llm = GroqLLM(api_key=_config.groq_api_key, model=_config.groq_model)

    # TTS provider
    match _config.tts_backend:
        case TTSBackend.KOKORO:
            from providers.tts.kokoro import KokoroTTS
            tts = KokoroTTS(voice=_config.tts_voice)
        case _:
            logger.warning(f"Unknown TTS backend '{_config.tts_backend}', falling back to Kokoro")
            from providers.tts.kokoro import KokoroTTS
            tts = KokoroTTS(voice=_config.tts_voice)

    pipeline = VaniPipeline(
        asr=asr,
        llm=llm,
        tts=tts,
        rag=None,   # Phase 2: swap in SupabasePgvectorRAG
        sentence_buffer_min_chars=_config.sentence_buffer_min_chars,
    )
    await pipeline.initialize()
    return pipeline


# ── LiveKit entrypoint — called once per job (one per room) ─────────────────

async def entrypoint(ctx: JobContext) -> None:
    """
    Main job handler. Called by LiveKit when a user joins a room.
    Each notebook voice session gets its own job context.
    """
    global _pipeline

    logger.info(f"New job: room={ctx.room.name}")

    # Extract metadata sent by the frontend when requesting the room token
    # The frontend can pass: { notebookId, userId }
    metadata = ctx.room.metadata or "{}"
    try:
        import json
        meta = json.loads(metadata)
    except Exception:
        meta = {}

    notebook_id = meta.get("notebookId", "") or ctx.room.name
    user_id = meta.get("userId", "")
    logger.info(f"Notebook: {notebook_id}, User: {user_id}")

    # Connect immediately so the room does not time out while models warm up.
    await ctx.connect()

    # Re-use a warm pipeline if available (reduces startup latency)
    if _pipeline is None:
        logger.info("Building pipeline (first job)...")
        _pipeline = await _build_pipeline()

    pipeline = _pipeline
    pipeline.reset_history()   # Fresh conversation per session

    # Create an audio source to push TTS audio into the room
    sample_rate = pipeline.tts.sample_rate
    audio_source = rtc.AudioSource(sample_rate=sample_rate, num_channels=1)
    audio_track = rtc.LocalAudioTrack.create_audio_track("vani-voice", audio_source)

    await ctx.room.local_participant.publish_track(
        audio_track,
        rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE),
    )
    logger.info("Agent audio track published.")

    # ── VAD-driven audio collection ──────────────────────────────────────
    # LiveKit Agents provides a built-in VAD+audio collection helper.
    # We accumulate audio frames until silence is detected, then run a turn.

    turn_index = 0

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Subscribed to audio from {participant.identity}")
            asyncio.ensure_future(
                _handle_audio_track(track, participant)
            )

    async def _subscribe_existing_audio_tracks() -> None:
        """Catch audio tracks that were published before event handlers were registered."""
        for participant in ctx.room.remote_participants.values():
            for publication in participant.track_publications.values():
                if publication.kind == rtc.TrackKind.KIND_AUDIO and publication.track is not None:
                    logger.info(f"Attaching to existing audio track from {participant.identity}")
                    asyncio.ensure_future(_handle_audio_track(publication.track, participant))

    async def _handle_audio_track(
        track: rtc.Track, participant: rtc.RemoteParticipant
    ):
        nonlocal turn_index
        audio_stream = rtc.AudioStream(track)
        buffer: list[np.ndarray] = []
        silence_threshold = 0.01       # RMS below this = silence
        silence_frames = 0
        silence_limit = 25             # ~500ms of silence at 20ms/frame = end of utterance

        async for event in audio_stream:
            frame: rtc.AudioFrame = event.frame
            # Convert to float32 numpy array
            pcm = np.frombuffer(frame.data, dtype=np.int16).astype(np.float32) / 32768.0

            rms = float(np.sqrt(np.mean(pcm ** 2)))

            if rms > silence_threshold:
                buffer.append(pcm)
                silence_frames = 0
            elif buffer:
                silence_frames += 1
                buffer.append(pcm)   # Include trailing silence for natural cut

                if silence_frames >= silence_limit:
                    # End of utterance — run a pipeline turn
                    audio_frames = np.concatenate(buffer)
                    buffer.clear()
                    silence_frames = 0

                    resolved_user_id = user_id or participant.identity
                    context = PipelineContext(
                        notebook_id=notebook_id,
                        user_id=resolved_user_id,
                        session_id=ctx.room.name,
                        turn_index=turn_index,
                    )
                    turn_index += 1

                    # Signal barge-in if user speaks while agent is talking
                    pipeline.interrupt()

                    async def push_audio(chunk: AudioChunk):
                        """Push a synthesized audio chunk into the room."""
                        # Resample if needed (LiveKit typically wants 48kHz)
                        samples = chunk.samples.detach().cpu().numpy() if hasattr(chunk.samples, "detach") else np.asarray(chunk.samples)
                        samples_int16 = (samples * 32767).astype(np.int16)
                        lk_frame = rtc.AudioFrame(
                            data=samples_int16.tobytes(),
                            sample_rate=chunk.sample_rate,
                            num_channels=1,
                            samples_per_channel=len(samples_int16),
                        )
                        await audio_source.capture_frame(lk_frame)

                    async def send_transcript(user_text: str, agent_text: str):
                        """Send transcript to frontend via data channel."""
                        import json
                        payload = json.dumps({
                            "type": "transcript",
                            "user": user_text,
                            "agent": agent_text,
                        }).encode()
                        await ctx.room.local_participant.publish_data(
                            payload, reliable=True
                        )

                    try:
                        await pipeline.process_turn(
                            audio_frames=audio_frames,
                            context=context,
                            on_audio=push_audio,
                            on_transcript=send_transcript,
                        )
                        logger.info(
                            f"Turn {turn_index} done | TTFA={context.ttfa_ms:.0f}ms"
                        )
                    except Exception as e:
                        logger.error(f"Pipeline error on turn {turn_index}: {e}", exc_info=True)

    # Keep the job alive until the room is empty
    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f"Participant left: {participant.identity}")
        if len(ctx.room.remote_participants) == 0:
            logger.info("Room empty — shutting down job.")
            asyncio.ensure_future(ctx.room.disconnect())

    logger.info("Agent ready and listening.")
    await _subscribe_existing_audio_tracks()
    await asyncio.sleep(float("inf"))   # Keep alive


# ── Worker registration ──────────────────────────────────────────────────────

if __name__ == "__main__":
    _start_health_server()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=_config.livekit_api_key,
            api_secret=_config.livekit_api_secret,
            ws_url=_config.livekit_url,
        )
    )
