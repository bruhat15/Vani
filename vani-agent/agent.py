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
from livekit.rtc.participant import PublishDataError

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
        case ASRBackend.GROQ_WHISPER:
            from providers.asr.groq_whisper import GroqWhisperASR
            asr = GroqWhisperASR(api_key=_config.groq_api_key)
            logger.info("Using Groq Whisper ASR (cloud, zero local RAM).")
        case ASRBackend.WHISPER:
            from providers.asr.whisper import WhisperASR
            asr = WhisperASR(model_size=_config.whisper_model_size)
        case _:
            logger.warning(f"Unknown ASR backend '{_config.asr_backend}', falling back to Groq Whisper")
            from providers.asr.groq_whisper import GroqWhisperASR
            asr = GroqWhisperASR(api_key=_config.groq_api_key)

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
        case TTSBackend.GOOGLE_TTS:
            if not _config.google_tts_api_key:
                logger.warning(
                    "GOOGLE_TTS_API_KEY not set — falling back to Kokoro TTS.\n"
                    "  Add GOOGLE_TTS_API_KEY to /opt/n8n/.env to enable Google TTS (~200ms TTFA)."
                )
                from providers.tts.kokoro import KokoroTTS
                tts = KokoroTTS(voice=_config.tts_voice)
            else:
                from providers.tts.google_tts import GoogleTTS
                tts = GoogleTTS(
                    api_key=_config.google_tts_api_key,
                    voice=_config.google_tts_voice,
                    sample_rate=_config.google_tts_sample_rate,
                )
                logger.info(f"Using Google Cloud TTS (voice={_config.google_tts_voice}).")
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

        # ── Silero VAD — neural end-of-speech detection ──────────────────
        # How Google/Apple/Amazon do it: a small neural model (~1MB) trained
        # to understand speech acoustics, not just audio energy. It can
        # distinguish a natural mid-sentence pause from actual silence.
        # Key params:
        #   min_silence_duration=1.2  → 1.2s of true silence = end of turn
        #   min_speech_duration=0.2   → ignore noise bursts < 200ms
        #   padding_duration=0.4      → include 400ms context before/after
        from livekit.plugins import silero as _silero
        from livekit.agents.vad import VADEventType

        vad = _silero.VAD.load(
            min_silence_duration=1.2,
            min_speech_duration=0.2,
            padding_duration=0.4,
        )
        vad_stream = vad.stream()
        logger.info("Silero VAD ready (min_silence=1.2s).")

        actual_sample_rate: int = 48000
        frame_inited = False

        async def _feed_vad():
            nonlocal actual_sample_rate, frame_inited
            async for evt in audio_stream:
                frame: rtc.AudioFrame = evt.frame
                if not frame_inited:
                    actual_sample_rate = frame.sample_rate
                    logger.info(f"Audio stream: sample_rate={actual_sample_rate}Hz")
                    frame_inited = True
                vad_stream.push_frame(frame)

        asyncio.ensure_future(_feed_vad())

        async for vad_event in vad_stream:
            if vad_event.type != VADEventType.END_OF_SPEECH:
                continue
            if not vad_event.frames:
                continue

            # Build float32 numpy array from the VAD-segmented frames
            sr = vad_event.frames[0].sample_rate
            audio_frames = np.concatenate([
                np.frombuffer(f.data, dtype=np.int16).astype(np.float32) / 32768.0
                for f in vad_event.frames
            ])

            # Skip clips under 1 second (too short for reliable ASR)
            if len(audio_frames) < sr * 1.0:
                logger.debug(f"Speech too short ({len(audio_frames)/sr*1000:.0f}ms) — skipping.")
                continue

            resolved_user_id = user_id or participant.identity
            context = PipelineContext(
                notebook_id=notebook_id,
                user_id=resolved_user_id,
                session_id=ctx.room.name,
                turn_index=turn_index,
            )
            turn_index += 1
            pipeline.interrupt()

            async def push_audio(chunk: AudioChunk):
                samples = chunk.samples.detach().cpu().numpy() if hasattr(chunk.samples, "detach") else np.asarray(chunk.samples)
                samples_int16 = (samples * 32767).astype(np.int16)
                lk_frame = rtc.AudioFrame(
                    data=samples_int16.tobytes(),
                    sample_rate=chunk.sample_rate,
                    num_channels=1,
                    samples_per_channel=len(samples_int16),
                )
                try:
                    await audio_source.capture_frame(lk_frame)
                except Exception:
                    pass

            async def send_transcript(user_text: str, agent_text: str):
                import json
                payload = json.dumps({"type": "transcript", "user": user_text, "agent": agent_text}).encode()
                try:
                    await ctx.room.local_participant.publish_data(payload, reliable=True)
                except PublishDataError:
                    pass
                except Exception as e:
                    logger.debug(f"Transcript send skipped: {e}")

            try:
                await pipeline.process_turn(
                    audio_frames=audio_frames,
                    context=context,
                    on_audio=push_audio,
                    on_transcript=send_transcript,
                    audio_sample_rate=sr,
                )
                logger.info(f"Turn {turn_index} done | TTFA={context.ttfa_ms:.0f}ms")
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
