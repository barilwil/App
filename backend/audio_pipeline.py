"""
Audio Pipeline — PTT (Push-to-Talk) + VAD + STT

Windows dev mode:
    Trigger  : mic button in UI sends {"type": "listen"} to /ws/audio
    VAD      : energy-based RMS silence detection (no torch needed)
    STT      : faster-whisper small int8 on CPU

Jetson prod mode (swap via env vars):
    Trigger  : openWakeWord "Hey Circuit" (no account needed)
    VAD      : Silero VAD
    STT      : faster-whisper small int8 on CUDA

To enable wake word on Jetson:
    Set USE_WAKE_WORD=true in .env
    pip install openwakeword torch torchaudio
    Place model at: backend/wake_word/hey_circuit.tflite
    (train at: https://openWakeWord — no account required)

Session isolation model (Phase 3)
──────────────────────────────────
One global worker thread runs indefinitely and owns the microphone.  Session
ownership is a separate concern: at any point at most one "active session" holds
a (session_id, generation) token.  All visible state (IDLE / LISTENING /
TRANSCRIBING) lives inside the AudioSessionContext — there is no shared _state
field.  This means:

  • A stale _transcribe() finally block can never reset a new session's state —
    it validates the (session_id, generation) snap before touching any state.
  • get_state_for() reads directly from the context's .state field; revoked /
    pre-init callers always receive IDLE.
  • When attach_session() revokes a prior session it puts a {"type":
    "session_revoked"} message on that session's ctrl_queue so the WebSocket
    handler can forward it to the frontend and close cleanly.
  • trigger_listen() returns "mic_busy" when called by a non-owner, allowing
    the WebSocket handler to immediately notify the client.

Key invariants:
  • attach_session() increments the global generation counter and revokes the
    previous owner atomically under _session_lock.
  • trigger_listen/stop only work for the current active session owner.
  • _transcribe() snapshots (session_id, generation) at PTT trigger time and
    re-validates before queue.put() — mismatch → discard.
  • Each session has its own asyncio.Queue (transcript) and ctrl_queue (control
    events); old queues are abandoned on revoke.
"""

import asyncio
import logging
import os
import threading
import time
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
except ImportError:
    pass

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SAMPLE_RATE     = 16000
CHUNK_SAMPLES   = 512           # ~32 ms per chunk
MAX_UTTERANCE_S = 15

# These two are read at call-time so admin changes in Settings take effect
# immediately without a backend restart.
def _energy_silence_rms() -> float:
    return float(os.getenv("ENERGY_SILENCE_RMS", "50"))

def _silence_threshold_ms() -> int:
    return int(os.getenv("SILENCE_THRESHOLD_MS", "600"))

WHISPER_MODEL   = os.getenv("WHISPER_MODEL",   "small")
WHISPER_DEVICE  = os.getenv("WHISPER_DEVICE",  "cpu")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")

USE_WAKE_WORD       = os.getenv("USE_WAKE_WORD",   "false").lower() == "true"
WAKE_WORD_MODEL     = os.getenv("WAKE_WORD_MODEL",  str(Path(__file__).resolve().parent / "wake_word" / "hey_circuit.tflite"))
WAKE_WORD_THRESHOLD = float(os.getenv("WAKE_WORD_THRESHOLD", "0.5"))

USE_SILERO_VAD = os.getenv("USE_SILERO_VAD", "false").lower() == "true"
VAD_THRESHOLD  = float(os.getenv("VAD_THRESHOLD", "0.5"))

AUDIO_DEVICE_INDEX = None
if os.getenv("AUDIO_DEVICE_INDEX"):
    AUDIO_DEVICE_INDEX = int(os.getenv("AUDIO_DEVICE_INDEX"))

WHISPER_PROMPT = (
    "Thevenin, Norton, MOSFET, op-amp, breadboard, oscilloscope, multimeter, "
    "voltage divider, Kirchhoff, impedance, capacitor, inductor, resistor, "
    "ECEN, circuit, waveform, frequency, amplitude, phase shift"
)


# ── Session context ───────────────────────────────────────────────────────────

@dataclass
class AudioSessionContext:
    """
    Per-session state container.  Created by attach_session(), revoked on
    detach or takeover.

    Fields
    ──────
    queue      — transcript strings delivered here by _transcribe()
    ctrl_queue — control events: {"type": "session_revoked"} or {"type": "mic_busy"}
    state      — session-visible pipeline state (IDLE / LISTENING / TRANSCRIBING)
                 written only by the worker thread under _session_lock so the
                 WS handler always reads a consistent value
    active     — False once this session is revoked; all worker callbacks abort
    """
    session_id: str
    generation: int
    queue:      asyncio.Queue
    ctrl_queue: asyncio.Queue
    loop:       asyncio.AbstractEventLoop
    active:     bool = True
    state:      str  = "idle"   # PipelineState.IDLE — avoid circular ref at class def time


class PipelineState:
    IDLE         = "idle"
    LISTENING    = "listening"
    TRANSCRIBING = "transcribing"
    UNAVAILABLE  = "unavailable"


# ── Pipeline ──────────────────────────────────────────────────────────────────

class AudioPipeline:
    def __init__(self):
        # Worker thread control
        self._thread: Optional[threading.Thread] = None
        self._stop_event           = threading.Event()   # shuts down worker
        self._listen_event         = threading.Event()   # PTT trigger
        self._stop_recording_event = threading.Event()   # abort current recording

        # Session ownership — all fields guarded by _session_lock
        self._session_lock = threading.Lock()
        self._active_session: Optional[AudioSessionContext] = None
        self._generation = 0                             # monotonically increasing
        # Snapshot of (session_id, generation) captured at PTT trigger time;
        # threaded worker reads this to know which session owns the utterance.
        self._pending_snap: Optional[Tuple[str, int]] = None

        # Hardware-level unavailability flag (set once on model-load failure)
        self._unavailable: bool = False

        # Models (loaded once in worker thread)
        self._whisper    = None
        self._oww        = None
        self._vad_model  = None

    # ── State helpers ─────────────────────────────────────────────────────────

    @property
    def state(self) -> str:
        """Global state for /api/stt/status — reads from the active session context."""
        if self._unavailable:
            return PipelineState.UNAVAILABLE
        with self._session_lock:
            active = self._active_session
            if active is not None and active.active:
                return active.state
        return PipelineState.IDLE

    def _mark_unavailable(self):
        """Hardware initialisation failed — pipeline cannot function."""
        self._unavailable = True
        logger.info("Pipeline state -> unavailable")

    def _set_state_for_snap(self, s: str, snap: Tuple[str, int]) -> bool:
        """
        Update the owning session's state only when snap still owns the active
        session.  Prevents LISTENING / TRANSCRIBING leaking into a new session.
        Returns True if updated.

        Called from the worker thread — operates under _session_lock for the
        read-then-write so that no intervening attach_session() can slip through.
        """
        with self._session_lock:
            active = self._active_session
            owns = (
                active is not None and active.active and
                active.session_id == snap[0] and active.generation == snap[1]
            )
            if owns:
                active.state = s
                logger.info(f"Session state -> {s} ({snap[0]} gen {snap[1]})")
                return True
        logger.debug(f"State update to '{s}' suppressed — snap {snap} no longer owns pipeline")
        return False

    # ── Session lifecycle (called from async WS handler) ─────────────────────

    def attach_session(
        self, session_id: str, loop: asyncio.AbstractEventLoop
    ) -> AudioSessionContext:
        """
        Register a new audio session as the exclusive active owner.
        Revokes any existing session atomically — any in-flight transcript from
        the old session will fail the generation check and be discarded.

        If a prior session exists its ctrl_queue receives a session_revoked event
        so its WebSocket handler can forward the notification and close cleanly.

        Must be called from within the event loop thread (i.e. from the async WS
        handler) so that put_nowait on the old session's ctrl_queue is event-loop-
        safe.
        """
        with self._session_lock:
            self._generation += 1
            gen = self._generation

            if self._active_session is not None:
                old = self._active_session
                old.active = False
                logger.info(
                    f"Session revoked: {old.session_id} gen {old.generation} "
                    f"→ replaced by {session_id} gen {gen}"
                )
                # Notify old session's handler — safe because we're on the event loop
                try:
                    old.ctrl_queue.put_nowait({
                        "type": "session_revoked",
                        "session_id": old.session_id,
                    })
                except asyncio.QueueFull:
                    logger.warning(f"ctrl_queue full for revoked session {old.session_id}")

            # Interrupt any active recording so the old utterance stops ASAP
            self._stop_recording_event.set()
            self._listen_event.clear()
            self._pending_snap = None

            ctx = AudioSessionContext(
                session_id=session_id,
                generation=gen,
                queue=asyncio.Queue(),
                ctrl_queue=asyncio.Queue(),
                loop=loop,
                active=True,
                state=PipelineState.IDLE,
            )
            self._active_session = ctx

        logger.info(f"Audio session attached: {session_id} gen {gen}")
        return ctx

    def detach_session(self, session_id: Optional[str]):
        """
        Detach session from pipeline ownership.  Safe to call multiple times,
        with None, or after the session has already been replaced by a newer one.
        """
        if session_id is None:
            return
        with self._session_lock:
            active = self._active_session
            if active is None:
                logger.debug(f"detach_session({session_id}) — no active session, no-op")
                return
            if active.session_id != session_id:
                logger.info(
                    f"detach_session({session_id}) — already replaced by "
                    f"{active.session_id}, no-op"
                )
                return
            active.active = False
            self._active_session = None
            self._stop_recording_event.set()
            self._listen_event.clear()
            self._pending_snap = None

        logger.info(f"Audio session detached: {session_id} — pipeline idle, no owner")

    # ── Session-owned commands ────────────────────────────────────────────────

    def trigger_listen(self, session_id: Optional[str]) -> str:
        """
        Start recording — only honoured from the current active session owner.
        Returns:
          "ok"        — command accepted
          "mic_busy"  — a different session owns the pipeline
          "no_session" — session_id is None or pipeline has no active owner
        """
        if session_id is None:
            return "no_session"
        with self._session_lock:
            active = self._active_session
            if active is None or not active.active or active.session_id != session_id:
                logger.warning(f"trigger_listen from non-owner '{session_id}' — mic_busy")
                return "mic_busy"
            # Snapshot ownership at trigger time so the worker can validate later
            self._pending_snap = (active.session_id, active.generation)

        logger.info(f"trigger_listen: session {session_id}")
        self._listen_event.set()
        return "ok"

    def trigger_stop(self, session_id: Optional[str]):
        """Abort recording — only honoured from the current active session owner."""
        if session_id is None:
            return
        with self._session_lock:
            active = self._active_session
            if active is None or not active.active or active.session_id != session_id:
                logger.warning(f"trigger_stop from non-owner '{session_id}' — ignored")
                return

        logger.info(f"trigger_stop: session {session_id}")
        self._listen_event.clear()
        self._stop_recording_event.set()

    # ── Session-aware reads (called from async WS handler) ───────────────────

    def get_state_for(self, session_id: Optional[str]) -> str:
        """
        Return real pipeline state for the active owner; IDLE for everyone else.
        Old / revoked sessions always see IDLE — no state leakage.
        """
        if self._unavailable:
            return PipelineState.UNAVAILABLE
        if session_id is None:
            return PipelineState.IDLE
        with self._session_lock:
            active = self._active_session
            if (
                active is not None and active.active and
                active.session_id == session_id
            ):
                return active.state
        return PipelineState.IDLE

    def transcript_available_for(self, session_id: Optional[str]) -> bool:
        """True only if the active session has a queued transcript waiting."""
        if session_id is None:
            return False
        with self._session_lock:
            active = self._active_session
            if active is None or not active.active or active.session_id != session_id:
                return False
            return not active.queue.empty()

    async def get_transcript_for(self, session_id: Optional[str]) -> Optional[str]:
        """
        Read one transcript from the session's own queue.
        Returns None if the session is no longer the active owner (race-safe).
        """
        if session_id is None:
            return None
        with self._session_lock:
            active = self._active_session
            if active is None or not active.active or active.session_id != session_id:
                return None
            queue = active.queue
        # Lock released before I/O — use get_nowait since caller already confirmed non-empty
        try:
            return queue.get_nowait()
        except Exception:
            return None

    # ── Phase 1 shim (kept for safety; no-op in Phase 3) ─────────────────────

    def reset_session_state(self):
        """Deprecated Phase 1 shim — attach/detach are the real API now."""
        pass

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_models(self):
        missing = []

        logger.info(f"Loading faster-whisper {WHISPER_MODEL} ({WHISPER_COMPUTE}) on {WHISPER_DEVICE}...")
        try:
            from faster_whisper import WhisperModel
            self._whisper = WhisperModel(
                WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE
            )
            logger.info("faster-whisper loaded")
        except ImportError:
            missing.append("faster-whisper  ->  pip install faster-whisper")
        except Exception as e:
            missing.append(f"faster-whisper: {e}")

        if USE_WAKE_WORD:
            logger.info("Loading openWakeWord...")
            try:
                from openwakeword.model import Model as OWWModel
                ww_path = Path(WAKE_WORD_MODEL)
                if ww_path.exists():
                    self._oww = OWWModel(
                        wakeword_models=[str(ww_path)],
                        inference_framework="tflite",
                    )
                    logger.info(f"openWakeWord loaded: {WAKE_WORD_MODEL}")
                else:
                    logger.warning(
                        f"Wake word model not found at {WAKE_WORD_MODEL}. "
                        "Falling back to PTT mode."
                    )
            except ImportError:
                logger.warning("openwakeword not installed — falling back to PTT mode")
            except Exception as e:
                logger.warning(f"openWakeWord failed ({e}) — falling back to PTT mode")

        if USE_SILERO_VAD:
            try:
                import torch
                self._vad_model, _ = torch.hub.load(
                    "snakers4/silero-vad", "silero_vad",
                    force_reload=False, onnx=False
                )
                logger.info("Silero VAD loaded")
            except Exception as e:
                logger.warning(f"Silero VAD unavailable ({e}) — using energy-based VAD")

        if missing:
            logger.warning(
                "Audio pipeline DISABLED — missing deps:\n"
                + "\n".join(f"  * {m}" for m in missing)
            )
            raise RuntimeError(str(missing))

    # ── VAD ───────────────────────────────────────────────────────────────────

    def _is_speech(self, chunk: np.ndarray) -> bool:
        if self._vad_model is not None:
            import torch
            return self._vad_model(
                torch.from_numpy(chunk).float(), SAMPLE_RATE
            ).item() >= VAD_THRESHOLD
        rms = np.sqrt(np.mean(chunk.astype(np.float32) ** 2))
        return rms > _energy_silence_rms()

    def _rms(self, chunk: np.ndarray) -> float:
        return float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2)))

    # ── Core worker loop ──────────────────────────────────────────────────────

    def _run(self, loop: asyncio.AbstractEventLoop):
        try:
            self._load_models()
        except Exception:
            self._mark_unavailable()
            return

        try:
            import pyaudio
        except ImportError:
            logger.error("pyaudio not installed — pip install pyaudio")
            self._mark_unavailable()
            return

        pa     = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SAMPLES,
            input_device_index=AUDIO_DEVICE_INDEX,
        )

        wake_word_mode = USE_WAKE_WORD and self._oww is not None
        if wake_word_mode:
            logger.info("Audio pipeline running in WAKE WORD mode — say 'Hey Circuit'")
        else:
            logger.info("Audio pipeline running in PTT mode — mic button to activate")

        # No global state to set here — each session starts with IDLE in its context.

        try:
            while not self._stop_event.is_set():
                if wake_word_mode:
                    self._wait_for_wake_word(stream)
                else:
                    self._wait_for_ptt()

                if self._stop_event.is_set():
                    break

                # Read ownership snapshot set at trigger time (under lock, safe)
                with self._session_lock:
                    snap = self._pending_snap

                audio = self._capture_utterance(stream, snap)
                if audio is not None and snap is not None:
                    self._transcribe(audio, snap)
                elif snap is not None:
                    # No usable audio — stop pressed before speech, pre-speech
                    # silence timeout, or session revoked mid-capture.
                    # _transcribe() was never called so its finally block never ran;
                    # manually reset the session's visible state to IDLE here.
                    self._set_state_for_snap(PipelineState.IDLE, snap)

        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()
            logger.info("Audio pipeline stopped.")

    def _wait_for_ptt(self):
        """Block until the active session presses the mic button (PTT mode)."""
        self._listen_event.clear()
        self._stop_recording_event.clear()
        while not self._stop_event.is_set():
            if self._listen_event.wait(timeout=0.1):
                return

    def _wait_for_wake_word(self, stream):
        """Block until openWakeWord detects 'Hey Circuit'."""
        oww_chunk = 1280  # 80 ms at 16 kHz
        while not self._stop_event.is_set():
            raw   = stream.read(oww_chunk, exception_on_overflow=False)
            chunk = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
            pred  = self._oww.predict(chunk)
            for _, conf in pred.items():
                if conf >= WAKE_WORD_THRESHOLD:
                    logger.info("Wake word detected!")
                    # Snapshot the current active session as the utterance owner
                    with self._session_lock:
                        active = self._active_session
                        if active and active.active:
                            self._pending_snap = (active.session_id, active.generation)
                            logger.info(
                                f"Wake word: snapped session {active.session_id} "
                                f"gen {active.generation}"
                            )
                        else:
                            self._pending_snap = None
                            logger.info("Wake word: no active session owner — snap cleared")
                    return

    def _capture_utterance(
        self, stream, snap: Optional[Tuple[str, int]]
    ) -> Optional[np.ndarray]:
        """
        Record audio until silence or max length.
        Sets LISTENING state only for the owning session (snap).
        """
        if snap:
            self._set_state_for_snap(PipelineState.LISTENING, snap)

        ms_per_chunk   = (CHUNK_SAMPLES / SAMPLE_RATE) * 1000
        # Read thresholds at utterance-start so admin changes take effect on the next
        # button press without requiring a backend restart.
        energy_rms     = _energy_silence_rms()
        silence_chunks = int(_silence_threshold_ms() / ms_per_chunk)
        max_chunks     = int(MAX_UTTERANCE_S * 1000 / ms_per_chunk)
        pre_max        = int(3000 / ms_per_chunk)

        buffer, silence_count, speech_started, pre_count = [], 0, False, 0

        while not self._stop_event.is_set():
            if self._stop_recording_event.is_set():
                logger.debug("Recording stopped (stop event or session revoke)")
                break

            raw    = stream.read(CHUNK_SAMPLES, exception_on_overflow=False)
            chunk  = np.frombuffer(raw, dtype=np.int16)
            rms    = self._rms(chunk)
            speech = rms > energy_rms

            if pre_count % 10 == 0:
                logger.info(
                    f"RMS={rms:.0f} threshold={energy_rms:.0f} "
                    f"speech={speech} started={speech_started}"
                )

            if not speech_started:
                pre_count += 1
                if speech:
                    speech_started = True
                    buffer.append(chunk)
                elif pre_count >= pre_max:
                    logger.debug("No speech detected after trigger")
                    return None
            else:
                buffer.append(chunk)
                silence_count = 0 if speech else silence_count + 1
                if len(buffer) >= max_chunks or silence_count >= silence_chunks:
                    break

        return np.concatenate(buffer) if buffer else None

    def _transcribe(self, audio: np.ndarray, snap: Tuple[str, int]):
        """
        Transcribe audio and deliver the result to the owning session's queue.

        The snap = (session_id, generation) was captured at PTT-trigger time.
        Before enqueuing we re-validate it against the current active owner.
        If the session was replaced in the meantime the transcript is discarded —
        it will NEVER reach a different session's queue.

        The finally block resets state ONLY on the session identified by snap —
        it never touches a new session's state, eliminating the Phase 2 IDLE-stomp
        race condition.
        """
        # Mark TRANSCRIBING only for the owning session
        self._set_state_for_snap(PipelineState.TRANSCRIBING, snap)
        start = time.time()
        try:
            f32 = audio.astype(np.float32) / 32768.0
            segs, _ = self._whisper.transcribe(
                f32,
                language="en",
                initial_prompt=WHISPER_PROMPT,
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
            )
            text = " ".join(s.text.strip() for s in segs).strip()

            if text:
                # ── Ownership check — the critical gate ──────────────────────
                with self._session_lock:
                    active = self._active_session
                    still_owner = (
                        active is not None and active.active and
                        active.session_id == snap[0] and
                        active.generation == snap[1]
                    )
                    if still_owner:
                        target_queue = active.queue
                        target_loop  = active.loop
                    else:
                        target_queue = None
                # ─────────────────────────────────────────────────────────────

                if still_owner:
                    logger.info(
                        f"Transcript ({time.time()-start:.2f}s) → "
                        f"session {snap[0]} gen {snap[1]}: {text}"
                    )
                    asyncio.run_coroutine_threadsafe(target_queue.put(text), target_loop)
                else:
                    logger.warning(
                        f"Transcript DISCARDED — session {snap[0]} gen {snap[1]} "
                        f"was replaced before result was ready "
                        f"({time.time()-start:.2f}s elapsed)"
                    )
            else:
                logger.debug("Empty transcript — discarded")

        except Exception as e:
            logger.error(f"Transcription error: {e}")
        finally:
            # Reset state to IDLE on the session that owned this utterance.
            # Only update if that exact session is still active AND still in
            # TRANSCRIBING — this prevents stomping a new session's LISTENING.
            with self._session_lock:
                active = self._active_session
                if (
                    active is not None and active.active and
                    active.session_id == snap[0] and active.generation == snap[1] and
                    active.state == PipelineState.TRANSCRIBING
                ):
                    active.state = PipelineState.IDLE
                    logger.info(
                        f"Session state -> idle (post-transcribe "
                        f"{snap[0]} gen {snap[1]})"
                    )

    # ── Public lifecycle ──────────────────────────────────────────────────────

    def start(self, loop: asyncio.AbstractEventLoop):
        if self._thread and self._thread.is_alive():
            return
        # No global queue created here — each session gets its own in attach_session()
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run, args=(loop,),
            daemon=True, name="audio-pipeline"
        )
        self._thread.start()
        logger.info("Audio pipeline thread started")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5.0)


pipeline = AudioPipeline()
