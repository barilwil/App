"""
TTS Engine — Piper (local) or ElevenLabs (API)

Switch via environment variable:
    TTS_ENGINE=piper        (default)
    TTS_ENGINE=elevenlabs

Piper:
    Expects piper binary at PIPER_BIN (default: ./piper/piper)
    Expects voice model at PIPER_MODEL (default: ./piper/en_US-ryan-medium.onnx)
    Install: https://github.com/rhasspy/piper/releases — grab the ARM64 build for Jetson

ElevenLabs:
    Requires ELEVENLABS_API_KEY in environment or .env file
    Uses streaming API for lower latency
    Default voice: Rachel (professional, clear)
"""

import asyncio
import logging
import os
import subprocess
from pathlib import Path

# Load .env explicitly so this module works even if imported before main.py loads it
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(_env_path, override=True)
except ImportError:
    pass

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
# Read at call time via functions so .env values are always current

def _piper_bin():
    raw = os.getenv("PIPER_BIN", str(Path(__file__).resolve().parent / "piper" / "piper"))
    # Resolve relative to backend/ directory, not CWD
    p = Path(raw)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent / p
    return str(p.resolve())

def _piper_model():
    raw = os.getenv("PIPER_MODEL", str(Path(__file__).resolve().parent / "piper" / "en_US-amy-medium.onnx"))
    # Resolve relative to backend/ directory, not CWD
    p = Path(raw)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent / p
    return str(p.resolve())

def _piper_speaker():
    return os.getenv("PIPER_SPEAKER", "")

def _tts_rate():
    # Read from DB settings via env (set by main.py at startup) or fallback
    return float(os.getenv("TTS_RATE", "1.05"))

def _tts_pitch():
    return float(os.getenv("TTS_PITCH", "1.0"))

def _tts_engine():
    return os.getenv("TTS_ENGINE", "piper").lower()

ELEVENLABS_API_KEY = property(lambda: os.getenv("ELEVENLABS_API_KEY", ""))
ELEVENLABS_VOICE   = "21m00Tcm4TlvDq8ikWAM"
ELEVENLABS_MODEL   = "eleven_turbo_v2"

# ── Piper ─────────────────────────────────────────────────────────────────────

async def _synth_piper(text: str) -> bytes:
    """
    Run Piper as a subprocess: stdin = text, stdout = raw PCM (16-bit, 22050Hz mono).
    Returns WAV bytes ready to send to the browser.
    """
    piper_bin   = _piper_bin()
    piper_model = _piper_model()
    speaker     = _piper_speaker()

    if not Path(piper_bin).exists():
        raise FileNotFoundError(
            f"Piper binary not found at {piper_bin}. "
            "Download from https://github.com/rhasspy/piper/releases "
            "and place at backend/piper/piper.exe (Windows) or backend/piper/piper (Linux)"
        )
    if not Path(piper_model).exists():
        raise FileNotFoundError(
            f"Piper model not found at {piper_model}. "
            "Download from https://huggingface.co/rhasspy/piper-voices "
            f"and place at {piper_model}"
        )

    cmd = [piper_bin, "--model", piper_model, "--output_raw"]
    if speaker:
        cmd += ["--speaker", speaker]

    # On Windows, Piper ships espeak-ng-data inside its own folder.
    # We must set ESPEAK_DATA_PATH so it doesn't look for /usr/share/espeak-ng-data
    piper_dir = str(Path(piper_bin).parent)
    env = os.environ.copy()
    env["ESPEAK_DATA_PATH"] = piper_dir

    loop = asyncio.get_event_loop()

    def _run():
        result = subprocess.run(
            cmd,
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
            env=env,
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors='replace')
            logger.error(f"Piper stderr: {err}")
            raise RuntimeError(f"Piper failed (code {result.returncode}): {err}")
        return result.stdout

    raw_pcm = await loop.run_in_executor(None, _run)
    return _pcm_to_wav(raw_pcm, sample_rate=22050, channels=1, sample_width=2)


def _pcm_to_wav(pcm: bytes, sample_rate: int, channels: int, sample_width: int) -> bytes:
    """Wrap raw PCM bytes in a minimal WAV container."""
    import struct
    data_len   = len(pcm)
    header_len = 44
    total_len  = header_len + data_len - 8
    byte_rate  = sample_rate * channels * sample_width
    block_align = channels * sample_width

    wav = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", total_len, b"WAVE",
        b"fmt ", 16,
        1,                  # PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        sample_width * 8,   # bits per sample
        b"data", data_len,
    )
    return wav + pcm


# ── ElevenLabs ────────────────────────────────────────────────────────────────

async def _synth_elevenlabs(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    voice   = os.getenv("ELEVENLABS_VOICE", ELEVENLABS_VOICE)
    model   = os.getenv("ELEVENLABS_MODEL", ELEVENLABS_MODEL)

    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY not set in .env")

    import httpx
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/stream"
    headers = {"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"}
    payload = {
        "text": text, "model_id": model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs API error {resp.status_code}: {resp.text}")
        return resp.content


async def synthesize(text: str) -> tuple[bytes, str]:
    text = text.strip()
    if not text:
        return b"", "audio/wav"

    engine = _tts_engine()
    if engine == "elevenlabs":
        logger.info(f"TTS [ElevenLabs] {text[:60]}")
        return await _synth_elevenlabs(text), "audio/mpeg"
    else:
        resolved_model = _piper_model()
        logger.info(f"TTS [Piper] model={resolved_model} exists={Path(resolved_model).exists()} — {text[:60]}")
        return await _synth_piper(text), "audio/wav"


def engine_name() -> str:
    return _tts_engine()
