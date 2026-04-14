import asyncio
import base64
import contextlib
import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import httpx
from pathlib import Path
from urllib.parse import quote

# Load .env file if present (local dev / Jetson deployment)
# Must happen BEFORE any module that reads os.getenv at import time (tts.py, audio_pipeline.py)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
except ImportError:
    pass

logging.basicConfig(level=logging.INFO)
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel
# TTS and audio pipeline — optional, degrade gracefully if deps not installed
try:
    from tts import synthesize as tts_synthesize, engine_name as tts_engine_name
    _tts_available = True
except Exception as _e:
    logger = logging.getLogger(__name__)
    logger.warning(f"TTS module unavailable: {_e}")
    _tts_available = False
    async def tts_synthesize(text): raise RuntimeError("TTS not available")
    def tts_engine_name(): return "unavailable"

try:
    from audio_pipeline import pipeline as audio_pipeline
    _pipeline_available = True
except Exception as _e:
    logging.getLogger(__name__).warning(f"Audio pipeline unavailable: {_e}")
    _pipeline_available = False
    class _DummyPipeline:
        state = "unavailable"
        def start(self, loop): pass
        def stop(self): pass
        # Phase 1 shims (no-ops)
        def reset_session_state(self): pass
        # Phase 2/3 session-aware API
        def attach_session(self, session_id, loop): return None   # no ctx in dummy mode
        def detach_session(self, session_id): pass
        def trigger_listen(self, session_id): return "ok"         # Phase 3: returns status
        def trigger_stop(self, session_id): pass
        def get_state_for(self, session_id): return "unavailable"
        def transcript_available_for(self, session_id): return False
        async def get_transcript_for(self, session_id): await asyncio.sleep(999); return None
    audio_pipeline = _DummyPipeline()

active_ta_sessions: dict = {}

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000)
    return f"{salt}${key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, key_hex = stored_hash.split('$')
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    # DB migration
    conn = get_db()
    lab_cols = [row[1] for row in conn.execute("PRAGMA table_info(labs)").fetchall()]
    if "widget_key" not in lab_cols:
        conn.execute("ALTER TABLE labs ADD COLUMN widget_key TEXT DEFAULT ''")
        conn.commit()
    mapping_cols = [row[1] for row in conn.execute("PRAGMA table_info(lab_circuit_mappings)").fetchall()]
    if mapping_cols and "image_path" not in mapping_cols:
        conn.execute("ALTER TABLE lab_circuit_mappings ADD COLUMN image_path TEXT DEFAULT ''")
        conn.commit()
    conn.close()
    # Wipe conversation history on every backend restart
    conn = get_db()
    conn.execute("UPDATE conversations SET messages = '[]', updated_at = CURRENT_TIMESTAMP")
    conn.commit()
    conn.close()
    # Start audio pipeline (no-op if deps not installed)
    loop = asyncio.get_event_loop()
    audio_pipeline.start(loop)
    logging.getLogger(__name__).info("Startup complete.")
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    audio_pipeline.stop()
    logging.getLogger(__name__).info("Shutdown complete.")

CIRCUIT_LLM_BASE_URL = os.getenv("CIRCUIT_LLM_BASE_URL", "http://127.0.0.1:8001")
DB_PATH = Path(__file__).parent / "students.db"
CIRCUIT_IMAGES_DIR = Path(__file__).parent / "circuit_images"
CIRCUIT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/api/circuit-images/files", StaticFiles(directory=str(CIRCUIT_IMAGES_DIR)), name="circuit-image-files")

DEFAULT_SETTINGS = {
    "ollama_url":           "http://localhost:11434/v1",
    "ollama_enabled":       "true",
    "openai_url":           "https://api.openai.com/v1",
    "openai_key":           "",
    "openai_enabled":       "false",
    "model_captions_on":    "gpt-oss:120b-cloud",
    "model_captions_off":   "qwen3:1.7b",
    "max_tokens_large":     "4096",
    "max_tokens_small":     "512",
    "tts_rate":             "1.05",
    "tts_pitch":            "1.0",
    "tts_voice":            "default",
    "tts_engine":           "piper",
    "app_name":             "Circuit AI",
    "app_course":           "ECEN 214",
    "whisper_model":        "small",
    "whisper_device":       "cpu",
    "energy_silence_rms":   "50",
    "silence_threshold_ms": "1000",
    "use_wake_word":        "false",
    "wake_word_keyword":    "Hey Circuit",
    "elevenlabs_api_key":   "",
    "elevenlabs_voice":     "21m00Tcm4TlvDq8ikWAM",
    "elevenlabs_model":     "eleven_turbo_v2",
    "sleep_minutes":        "15",
}

# DB settings that must also live in os.environ so that tts.py and audio_pipeline.py
# (which read via os.getenv) pick them up.  Injected at startup and on every save.
_SETTINGS_ENV_MAP = {
    "tts_engine":           "TTS_ENGINE",
    "tts_rate":             "TTS_RATE",
    "tts_pitch":            "TTS_PITCH",
    "elevenlabs_api_key":   "ELEVENLABS_API_KEY",
    "elevenlabs_voice":     "ELEVENLABS_VOICE",
    "elevenlabs_model":     "ELEVENLABS_MODEL",
    # These apply on next backend restart (pipeline loads models at startup)
    "whisper_model":        "WHISPER_MODEL",
    "whisper_device":       "WHISPER_DEVICE",
    "use_wake_word":        "USE_WAKE_WORD",
    # These are read dynamically at call-time in the pipeline (take effect immediately)
    "energy_silence_rms":   "ENERGY_SILENCE_RMS",
    "silence_threshold_ms": "SILENCE_THRESHOLD_MS",
}

def _apply_settings_to_env(d: dict):
    """Reflect a dict of DB settings into os.environ for modules that read via os.getenv."""
    for db_key, env_key in _SETTINGS_ENV_MAP.items():
        if db_key in d:
            os.environ[env_key] = str(d[db_key])

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_lab_scoped_conversations():
    conn = get_db()
    conv_cols = [row[1] for row in conn.execute("PRAGMA table_info(conversations)").fetchall()]

    if "lab_id" in conv_cols:
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_uin_lab ON conversations(uin, lab_id)")
        conn.commit()
        conn.close()
        return

    conn.execute("ALTER TABLE conversations RENAME TO conversations_legacy")
    conn.execute("""
        CREATE TABLE conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uin TEXT NOT NULL,
            lab_id INTEGER NOT NULL,
            messages TEXT NOT NULL DEFAULT '[]',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (uin, lab_id),
            FOREIGN KEY (uin) REFERENCES students(uin),
            FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
        );
    """)
    conn.execute("DROP TABLE conversations_legacy")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_uin_lab ON conversations(uin, lab_id)")
    conn.commit()
    conn.close()


def _image_url_for(relative_path: str) -> str:
    relative = str(relative_path or "").strip().replace("\\", "/")
    if not relative:
        return ""
    return f"/api/circuit-images/files/{quote(relative, safe='/')}"


def get_circuit_image_catalog():
    catalog = []
    if not CIRCUIT_IMAGES_DIR.exists():
        return catalog

    for path in sorted(CIRCUIT_IMAGES_DIR.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
            continue

        rel = path.relative_to(CIRCUIT_IMAGES_DIR).as_posix()
        parts = path.relative_to(CIRCUIT_IMAGES_DIR).parts
        catalog.append({
            "relative_path": rel,
            "filename": path.name,
            "stem": path.stem,
            "suffix": path.suffix.lower(),
            "lab_folder": parts[0] if parts else "",
            "parent_folder": path.parent.relative_to(CIRCUIT_IMAGES_DIR).as_posix() if path.parent != CIRCUIT_IMAGES_DIR else "",
            "url": _image_url_for(rel),
        })

    return catalog


def find_circuit_image_match(circuit_name: str, catalog=None):
    target = str(circuit_name or "").strip().lower()
    if not target:
        return None

    images = catalog if catalog is not None else get_circuit_image_catalog()
    exact = next((img for img in images if img["stem"].strip().lower() == target), None)
    if exact:
        return exact

    normalized_target = re.sub(r"[^a-z0-9]+", "", target)
    if not normalized_target:
        return None

    return next(
        (
            img for img in images
            if re.sub(r"[^a-z0-9]+", "", str(img.get("stem", "")).strip().lower()) == normalized_target
        ),
        None,
    )


def _find_catalog_match_for_image_path(image_path: str, catalog):
    relative = str(image_path or "").strip().replace("\\", "/")
    if not relative:
        return None

    exact = next((img for img in catalog if img["relative_path"] == relative), None)
    if exact:
        return exact

    filename = Path(relative).name.strip().lower()
    if filename:
        filename_match = next((img for img in catalog if str(img.get("filename", "")).strip().lower() == filename), None)
        if filename_match:
            return filename_match

    normalized_stem = re.sub(r"[^a-z0-9]+", "", Path(relative).stem.strip().lower())
    if not normalized_stem:
        return None

    return next(
        (
            img for img in catalog
            if re.sub(r"[^a-z0-9]+", "", str(img.get("stem", "")).strip().lower()) == normalized_stem
        ),
        None,
    )


def enrich_mapping_row(row, image_catalog=None):
    item = dict(row)
    raw_image_path = str(item.get("image_path", "") or "").strip().replace("\\", "/")
    catalog = image_catalog if image_catalog is not None else get_circuit_image_catalog()

    direct_match = _find_catalog_match_for_image_path(raw_image_path, catalog) if raw_image_path else None
    circuit_match = find_circuit_image_match(item.get("circuit_name", ""), catalog)
    matched = direct_match or circuit_match

    if raw_image_path:
        item["image_path"] = raw_image_path

    resolved = matched["relative_path"] if matched else ""
    item["resolved_image_path"] = resolved
    item["image_url"] = _image_url_for(resolved) if resolved else ""
    item["image_auto_matched"] = bool(circuit_match and not direct_match)
    item["image_missing"] = bool(raw_image_path and not direct_match and not resolved)
    return item

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'ADMIN',
            last_active TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS labs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            number INTEGER NOT NULL,
            name TEXT NOT NULL,
            due_date TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            widget_key TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id)
        );
        CREATE TABLE IF NOT EXISTS students (
            uin TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS course_students (
            course_id INTEGER NOT NULL,
            uin TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (course_id, uin),
            FOREIGN KEY (course_id) REFERENCES courses(id),
            FOREIGN KEY (uin) REFERENCES students(uin)
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uin TEXT NOT NULL,
            lab_id INTEGER NOT NULL,
            messages TEXT NOT NULL DEFAULT '[]',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (uin, lab_id),
            FOREIGN KEY (uin) REFERENCES students(uin),
            FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS lab_circuit_mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lab_id INTEGER NOT NULL,
            task_key TEXT NOT NULL DEFAULT '',
            task_label TEXT NOT NULL DEFAULT '',
            circuit_name TEXT NOT NULL,
            variation_label TEXT DEFAULT '',
            image_path TEXT DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_lab_circuit_mappings_lab_sort
            ON lab_circuit_mappings(lab_id, sort_order, id);
        INSERT OR IGNORE INTO students (uin, name) VALUES ('123456789', 'Alex Johnson');
        INSERT OR IGNORE INTO students (uin, name) VALUES ('987654321', 'Maria Garcia');
        INSERT OR IGNORE INTO students (uin, name) VALUES ('555000111', 'John Smith');
        INSERT OR IGNORE INTO students (uin, name) VALUES ('000000000', 'Test Student');
    """)
    existing_ta = conn.execute("SELECT id FROM tas WHERE email = 'admin@tamu.edu'").fetchone()
    if not existing_ta:
        conn.execute(
            "INSERT INTO tas (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
            ('admin@tamu.edu', 'Lab Admin', hash_password('circuit2025'), 'ADMIN')
        )
    for key, val in DEFAULT_SETTINGS.items():
        conn.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", (key, val))
    if not conn.execute("SELECT id FROM courses LIMIT 1").fetchone():
        conn.execute(
            "INSERT INTO courses (code, name, description) VALUES (?, ?, ?)",
            ('ECEN 214', 'Circuit Theory', 'Introduction to electrical circuits and measurements')
        )
        course_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute(
            "INSERT INTO labs (course_id, number, name, due_date, status, widget_key) VALUES (?, ?, ?, ?, ?, ?)",
            (course_id, 1, 'Introduction to Electrical Circuits and Measurements', '', 'active', 'ECEN214/Lab1')
        )
        for uin in ['123456789', '987654321', '555000111', '000000000']:
            conn.execute("INSERT OR IGNORE INTO course_students (course_id, uin) VALUES (?, ?)", (course_id, uin))
    conn.commit()
    conn.close()
    ensure_lab_scoped_conversations()

def get_setting(key: str) -> str:
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else DEFAULT_SETTINGS.get(key, "")

def make_ollama_client() -> AsyncOpenAI:
    return AsyncOpenAI(base_url=get_setting("ollama_url"), api_key="ollama")

init_db()

# Inject persisted settings into os.environ so tts.py / audio_pipeline.py see them
# immediately on first use — even before any PUT /api/settings call is made.
def _load_settings_into_env():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    conn.close()
    _apply_settings_to_env({r["key"]: r["value"] for r in rows})

_load_settings_into_env()


# ── TA AUTH ─────────────────────────────────────────────
class TALoginRequest(BaseModel):
    email: str
    password: str

class CallTARequest(BaseModel):
    student_uin: str | int | None = None
    student_name: str | None = None
    course_id: str | int | None = None
    course_name: str | None = None
    lab_id: str | int | None = None
    lab_name: str | None = None
    note: str | None = None


class WebsiteChatContextRequest(BaseModel):
    student_uin: str | int
    student_name: str | None = None
    course_name: str | None = None
    course_code: str | None = None
    lab_name: str | None = None
    lab_number: int | None = None


class WebsiteChatSyncMessage(BaseModel):
    role: str
    content: str


class WebsiteChatCreateRequest(WebsiteChatContextRequest):
    title: str | None = None


class WebsiteChatSyncRequest(WebsiteChatContextRequest):
    title: str | None = None
    messages: list[WebsiteChatSyncMessage]


class WebsiteUserLinkRequest(BaseModel):
    student_uin: str | int
    website_user_email: str | None = None
    website_user_id: str | None = None


def _website_base_url() -> str:
    return os.getenv("WEBSITE_BASE_URL", "").rstrip("/")


def _kiosk_bridge_headers() -> dict[str, str]:
    kiosk_call_secret = os.getenv("KIOSK_CALL_SECRET", "")
    if not kiosk_call_secret:
        raise HTTPException(status_code=503, detail="KIOSK_CALL_SECRET is not configured on the kiosk backend")
    return {"X-Kiosk-Secret": kiosk_call_secret}


def _normalize_context_value(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


async def _proxy_kiosk_bridge(method: str, path: str, *, params: dict | None = None, json_body: dict | None = None):
    website_base_url = _website_base_url()
    if not website_base_url:
        raise HTTPException(status_code=503, detail="WEBSITE_BASE_URL is not configured on the kiosk backend")
    headers = _kiosk_bridge_headers()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(method, f"{website_base_url}{path}", params=params, json=json_body, headers=headers)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the website backend from the kiosk")
    if resp.status_code >= 400:
        detail = None
        with contextlib.suppress(Exception):
            detail = resp.json().get("detail")
        raise HTTPException(status_code=resp.status_code, detail=detail or "Website chat bridge request failed")
    with contextlib.suppress(Exception):
        return resp.json()
    return None

@app.post("/api/ta/login")
async def ta_login(body: TALoginRequest):
    conn = get_db()
    ta = conn.execute("SELECT * FROM tas WHERE email = ?", (body.email.strip().lower(),)).fetchone()
    if not ta or not verify_password(body.password, ta["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    conn.execute("UPDATE tas SET last_active = CURRENT_TIMESTAMP WHERE id = ?", (ta["id"],))
    conn.commit()
    conn.close()
    token = secrets.token_hex(32)
    active_ta_sessions[token] = {"id": ta["id"], "email": ta["email"], "name": ta["name"], "role": ta["role"]}
    return {"token": token, "name": ta["name"], "email": ta["email"], "role": ta["role"]}

@app.post("/api/ta/logout")
async def ta_logout(body: dict):
    active_ta_sessions.pop(body.get("token", ""), None)
    return {"ok": True}

@app.get("/api/ta/verify")
async def ta_verify(token: str):
    session = active_ta_sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session

@app.post("/api/call-ta")
async def call_ta(body: CallTARequest):
    website_base_url = os.getenv("WEBSITE_BASE_URL", "").rstrip("/")
    kiosk_call_secret = os.getenv("KIOSK_CALL_SECRET", "")
    kiosk_id = os.getenv("KIOSK_ID", "jetson-kiosk")
    kiosk_label = os.getenv("KIOSK_LABEL", kiosk_id)

    if not website_base_url:
        raise HTTPException(status_code=503, detail="WEBSITE_BASE_URL is not configured on the kiosk backend")

    if not kiosk_call_secret:
        raise HTTPException(status_code=503, detail="KIOSK_CALL_SECRET is not configured on the kiosk backend")

    payload = {
        "kiosk_id": kiosk_id,
        "kiosk_label": kiosk_label,
        "student_uin": (body.student_uin or "").strip() or None,
        "student_name": (body.student_name or "").strip() or None,
        "course_id": (body.course_id or "").strip() or None,
        "course_name": (body.course_name or "").strip() or None,
        "lab_id": (str(body.lab_id).strip() if body.lab_id is not None else None) or None,
        "lab_name": (body.lab_name or "").strip() or None,
        "note": (body.note or "").strip() or None,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{website_base_url}/api/v1/help-requests/kiosk",
                json=payload,
                headers={"X-Kiosk-Secret": kiosk_call_secret},
            )

        if resp.status_code >= 400:
            detail = None
            with contextlib.suppress(Exception):
                detail = resp.json().get("detail")
            raise HTTPException(status_code=resp.status_code, detail=detail or "Failed to notify website admins")

        return resp.json()
    except HTTPException:
        raise
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the website backend from the kiosk")

@app.post("/api/website-chat-link")
async def website_chat_link_user(body: WebsiteUserLinkRequest):
    payload = {"student_uin": _normalize_context_value(body.student_uin) or ""}
    if body.website_user_email:
        payload["website_user_email"] = body.website_user_email.strip()
    if body.website_user_id:
        payload["website_user_id"] = body.website_user_id.strip()
    return await _proxy_kiosk_bridge("POST", "/api/v1/kiosk-chat-bridge/link-user", json_body=payload)


@app.get("/api/website-chats")
async def list_website_chats(student_uin: str, course_name: str | None = None, course_code: str | None = None, lab_name: str | None = None, lab_number: int | None = None):
    params = {"student_uin": student_uin}
    if course_name:
        params["course_name"] = course_name
    if course_code:
        params["course_code"] = course_code
    if lab_name:
        params["lab_name"] = lab_name
    if lab_number is not None:
        params["lab_number"] = str(lab_number)
    return await _proxy_kiosk_bridge("GET", "/api/v1/kiosk-chat-bridge/", params=params)


@app.get("/api/website-chats/{chat_id}")
async def get_website_chat(chat_id: str, student_uin: str, course_name: str | None = None, course_code: str | None = None, lab_name: str | None = None, lab_number: int | None = None):
    params = {"student_uin": student_uin}
    if course_name:
        params["course_name"] = course_name
    if course_code:
        params["course_code"] = course_code
    if lab_name:
        params["lab_name"] = lab_name
    if lab_number is not None:
        params["lab_number"] = str(lab_number)
    return await _proxy_kiosk_bridge("GET", f"/api/v1/kiosk-chat-bridge/{quote(chat_id)}", params=params)


@app.post("/api/website-chats/new")
async def create_website_chat(body: WebsiteChatCreateRequest):
    payload = {
        "student_uin": _normalize_context_value(body.student_uin) or "",
        "student_name": _normalize_context_value(body.student_name),
        "course_name": _normalize_context_value(body.course_name),
        "course_code": _normalize_context_value(body.course_code),
        "lab_name": _normalize_context_value(body.lab_name),
        "lab_number": body.lab_number,
        "title": _normalize_context_value(body.title),
    }
    return await _proxy_kiosk_bridge("POST", "/api/v1/kiosk-chat-bridge/new", json_body=payload)


@app.post("/api/website-chats/{chat_id}/sync")
async def sync_website_chat(chat_id: str, body: WebsiteChatSyncRequest):
    payload = {
        "student_uin": _normalize_context_value(body.student_uin) or "",
        "student_name": _normalize_context_value(body.student_name),
        "course_name": _normalize_context_value(body.course_name),
        "course_code": _normalize_context_value(body.course_code),
        "lab_name": _normalize_context_value(body.lab_name),
        "lab_number": body.lab_number,
        "title": _normalize_context_value(body.title),
        "messages": [
            {"role": (m.role or "").strip(), "content": (m.content or "").strip()}
            for m in (body.messages or []) if (m.content or "").strip()
        ],
    }
    return await _proxy_kiosk_bridge("POST", f"/api/v1/kiosk-chat-bridge/{quote(chat_id)}/sync", json_body=payload)


# ── USERS ────────────────────────────────────────────────
@app.get("/api/users")
async def list_users():
    conn = get_db()
    rows = conn.execute("SELECT id, email, name, role, last_active, created_at FROM tas ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

class CreateUserRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "USER"

@app.post("/api/users")
async def create_user(body: CreateUserRequest):
    conn = get_db()
    if conn.execute("SELECT id FROM tas WHERE email = ?", (body.email.strip().lower(),)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Email already exists")
    conn.execute(
        "INSERT INTO tas (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
        (body.email.strip().lower(), body.name.strip(), hash_password(body.password), body.role.upper())
    )
    conn.commit()
    uid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": uid, "email": body.email, "name": body.name, "role": body.role.upper()}

@app.patch("/api/users/{user_id}/role")
async def update_user_role(user_id: int, body: dict):
    role = body.get("role", "USER").upper()
    if role not in ("ADMIN", "USER"):
        raise HTTPException(status_code=400, detail="Role must be ADMIN or USER")
    conn = get_db()
    conn.execute("UPDATE tas SET role = ? WHERE id = ?", (role, user_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    conn = get_db()
    conn.execute("DELETE FROM tas WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

# ── COURSES ──────────────────────────────────────────────
@app.get("/api/courses")
async def list_courses():
    conn = get_db()
    courses = conn.execute("SELECT * FROM courses ORDER BY created_at DESC").fetchall()
    result = []
    for c in courses:
        lc = conn.execute("SELECT COUNT(*) as n FROM labs WHERE course_id = ?", (c["id"],)).fetchone()["n"]
        sc = conn.execute("SELECT COUNT(*) as n FROM course_students WHERE course_id = ?", (c["id"],)).fetchone()["n"]
        result.append({**dict(c), "lab_count": lc, "student_count": sc})
    conn.close()
    return result

class CreateCourseRequest(BaseModel):
    code: str
    name: str
    description: str = ""

@app.post("/api/courses")
async def create_course(body: CreateCourseRequest):
    conn = get_db()
    conn.execute("INSERT INTO courses (code, name, description) VALUES (?, ?, ?)",
                 (body.code.strip(), body.name.strip(), body.description.strip()))
    conn.commit()
    cid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": cid, "code": body.code, "name": body.name, "description": body.description, "lab_count": 0, "student_count": 0}

@app.patch("/api/courses/{course_id}")
async def update_course(course_id: int, body: dict):
    fields = {k: v for k, v in body.items() if k in ("code", "name", "description")}
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    conn = get_db()
    conn.execute(f"UPDATE courses SET {set_clause} WHERE id = ?", (*fields.values(), course_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/courses/{course_id}")
async def delete_course(course_id: int):
    conn = get_db()
    conn.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

# ── LABS ─────────────────────────────────────────────────
@app.get("/api/courses/{course_id}/labs")
async def list_labs(course_id: int):
    conn = get_db()
    rows = conn.execute("""
        SELECT
            l.*,
            COUNT(m.id) AS mapping_count
        FROM labs l
        LEFT JOIN lab_circuit_mappings m ON m.lab_id = l.id
        WHERE l.course_id = ?
        GROUP BY l.id
        ORDER BY l.number ASC
    """, (course_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def normalize_lab_circuit_mappings(mappings):
    normalized = []
    if mappings is None:
        return normalized
    if not isinstance(mappings, list):
        raise HTTPException(status_code=400, detail="mappings must be a list")

    for idx, item in enumerate(mappings):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"Mapping #{idx + 1} must be an object")

        task_key = str(item.get("task_key", "")).strip()
        task_label = str(item.get("task_label", "")).strip()
        circuit_name = str(item.get("circuit_name", "")).strip()
        variation_label = str(item.get("variation_label", "")).strip()
        image_path = str(item.get("image_path", "")).strip().replace("\\", "/")
        sort_order_raw = item.get("sort_order", idx)

        if not task_key and not task_label:
            raise HTTPException(status_code=400, detail=f"Mapping #{idx + 1} needs a task key or label")
        if not circuit_name:
            raise HTTPException(status_code=400, detail=f"Mapping #{idx + 1} is missing circuit_name")

        try:
            sort_order = int(sort_order_raw)
        except Exception:
            sort_order = idx

        normalized.append({
            "task_key": task_key,
            "task_label": task_label or task_key,
            "circuit_name": circuit_name,
            "variation_label": variation_label,
            "image_path": image_path,
            "sort_order": sort_order,
        })

    return normalized


@app.get("/api/circuit-images")
async def list_circuit_images():
    catalog = get_circuit_image_catalog()
    return {"count": len(catalog), "images": catalog}


@app.get("/api/labs/{lab_id}/circuit-mappings")
async def get_lab_circuit_mappings(lab_id: int):
    conn = get_db()
    lab = conn.execute("SELECT id, course_id, number, name FROM labs WHERE id = ?", (lab_id,)).fetchone()
    if not lab:
        conn.close()
        raise HTTPException(status_code=404, detail="Lab not found")

    rows = conn.execute("""
        SELECT id, lab_id, task_key, task_label, circuit_name, variation_label, image_path, sort_order, created_at
        FROM lab_circuit_mappings
        WHERE lab_id = ?
        ORDER BY sort_order ASC, id ASC
    """, (lab_id,)).fetchall()
    conn.close()

    catalog = get_circuit_image_catalog()
    return {
        "lab": dict(lab),
        "mappings": [enrich_mapping_row(r, catalog) for r in rows],
        "task_count": len({(r["task_key"] or "").strip() or (r["task_label"] or "").strip() for r in rows}),
    }


@app.put("/api/labs/{lab_id}/circuit-mappings")
async def replace_lab_circuit_mappings(lab_id: int, body: dict):
    mappings = normalize_lab_circuit_mappings((body or {}).get("mappings", []))

    conn = get_db()
    lab = conn.execute("SELECT id FROM labs WHERE id = ?", (lab_id,)).fetchone()
    if not lab:
        conn.close()
        raise HTTPException(status_code=404, detail="Lab not found")

    conn.execute("DELETE FROM lab_circuit_mappings WHERE lab_id = ?", (lab_id,))
    for idx, item in enumerate(mappings):
        conn.execute("""
            INSERT INTO lab_circuit_mappings (
                lab_id, task_key, task_label, circuit_name, variation_label, image_path, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            lab_id,
            item["task_key"],
            item["task_label"],
            item["circuit_name"],
            item["variation_label"],
            item["image_path"],
            idx,
        ))

    conn.commit()
    rows = conn.execute("""
        SELECT id, lab_id, task_key, task_label, circuit_name, variation_label, image_path, sort_order, created_at
        FROM lab_circuit_mappings
        WHERE lab_id = ?
        ORDER BY sort_order ASC, id ASC
    """, (lab_id,)).fetchall()
    conn.close()

    catalog = get_circuit_image_catalog()
    return {
        "ok": True,
        "lab_id": lab_id,
        "mapping_count": len(rows),
        "mappings": [enrich_mapping_row(r, catalog) for r in rows],
    }

class CreateLabRequest(BaseModel):
    number: int
    name: str
    due_date: str = ""
    status: str = "draft"
    widget_key: str = ""

@app.post("/api/courses/{course_id}/labs")
async def create_lab(course_id: int, body: CreateLabRequest):
    conn = get_db()
    conn.execute("INSERT INTO labs (course_id, number, name, due_date, status, widget_key) VALUES (?, ?, ?, ?, ?, ?)",
                 (course_id, body.number, body.name.strip(), body.due_date.strip(), body.status, body.widget_key.strip()))
    conn.commit()
    lid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": lid, "course_id": course_id, "number": body.number, "name": body.name, "due_date": body.due_date, "status": body.status, "widget_key": body.widget_key}

@app.patch("/api/labs/{lab_id}")
async def update_lab(lab_id: int, body: dict):
    fields = {k: v for k, v in body.items() if k in ("name", "number", "due_date", "status", "widget_key")}
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    conn = get_db()
    conn.execute(f"UPDATE labs SET {set_clause} WHERE id = ?", (*fields.values(), lab_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/labs/{lab_id}")
async def delete_lab(lab_id: int):
    conn = get_db()
    conn.execute("DELETE FROM labs WHERE id = ?", (lab_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

# ── COURSE STUDENTS ──────────────────────────────────────
@app.get("/api/courses/{course_id}/students")
async def list_course_students(course_id: int):
    conn = get_db()
    rows = conn.execute("""
        SELECT s.uin, s.name, s.created_at, cs.added_at
        FROM course_students cs JOIN students s ON s.uin = cs.uin
        WHERE cs.course_id = ? ORDER BY cs.added_at DESC
    """, (course_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/courses/{course_id}/students")
async def add_course_student(course_id: int, body: dict):
    uin = str(body.get("uin", "")).strip()
    name = body.get("name", "").strip()
    if not uin:
        raise HTTPException(status_code=400, detail="UIN required")
    conn = get_db()
    if not conn.execute("SELECT uin FROM students WHERE uin = ?", (uin,)).fetchone():
        if not name:
            conn.close()
            raise HTTPException(status_code=404, detail="UIN not found. Provide a name to create new student.")
        conn.execute("INSERT INTO students (uin, name) VALUES (?, ?)", (uin, name))
    if conn.execute("SELECT 1 FROM course_students WHERE course_id = ? AND uin = ?", (course_id, uin)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Student already enrolled")
    conn.execute("INSERT INTO course_students (course_id, uin) VALUES (?, ?)", (course_id, uin))
    conn.commit()
    student = conn.execute("SELECT * FROM students WHERE uin = ?", (uin,)).fetchone()
    conn.close()
    return {"uin": student["uin"], "name": student["name"]}

@app.delete("/api/courses/{course_id}/students/{uin}")
async def remove_course_student(course_id: int, uin: str):
    conn = get_db()
    conn.execute("DELETE FROM course_students WHERE course_id = ? AND uin = ?", (course_id, uin))
    conn.commit()
    conn.close()
    return {"ok": True}

# ── SETTINGS ─────────────────────────────────────────────
@app.get("/api/settings")
async def get_settings():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

@app.put("/api/settings")
async def update_settings(body: dict):
    conn = get_db()
    for key, value in body.items():
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value))
        )
    conn.commit()
    conn.close()
    # Propagate relevant settings into os.environ so modules that read via
    # os.getenv() (tts.py, audio_pipeline.py) pick up the new values immediately.
    _apply_settings_to_env(body)
    return {"ok": True}

# ── UIN ──────────────────────────────────────────────────
class UINRequest(BaseModel):
    uin: str
    lab_id: int


class SaveConversationRequest(BaseModel):
    uin: str
    lab_id: int
    messages: list = []


@app.post("/api/verify-uin")
async def verify_uin(body: UINRequest):
    conn = get_db()
    student = conn.execute("SELECT * FROM students WHERE uin = ?", (body.uin.strip(),)).fetchone()
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="UIN not found")

    lab = conn.execute("SELECT id FROM labs WHERE id = ?", (body.lab_id,)).fetchone()
    if not lab:
        conn.close()
        raise HTTPException(status_code=404, detail="Lab not found")

    convo = conn.execute(
        "SELECT * FROM conversations WHERE uin = ? AND lab_id = ?",
        (body.uin, body.lab_id),
    ).fetchone()

    if not convo:
        conn.execute(
            "INSERT INTO conversations (uin, lab_id, messages) VALUES (?, ?, '[]')",
            (body.uin, body.lab_id),
        )
        conn.commit()
        messages = []
    else:
        messages = json.loads(convo["messages"])

    conn.close()
    return {"uin": student["uin"], "name": student["name"], "messages": messages}


@app.post("/api/save-conversation")
async def save_conversation(body: SaveConversationRequest):
    conn = get_db()
    conn.execute(
        """
        INSERT INTO conversations (uin, lab_id, messages, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(uin, lab_id) DO UPDATE SET
            messages = excluded.messages,
            updated_at = CURRENT_TIMESTAMP
        """,
        (body.uin, body.lab_id, json.dumps(body.messages)),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

# ── LAB CONFIG ───────────────────────────────────────────
LAB_CONFIG_PATH = Path(__file__).parent / "lab_config.json"

@app.get("/api/lab")
async def get_lab():
    path = get_setting("lab_config_path") or str(LAB_CONFIG_PATH)
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Lab config not found at {path}")

# ── CIRCUIT PROXY ────────────────────────────────────────
async def circuit_get(path: str):
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(f"{CIRCUIT_LLM_BASE_URL}{path}")
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()

async def circuit_post(path: str, payload: dict):
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{CIRCUIT_LLM_BASE_URL}{path}", json=payload)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()

def build_circuit_analyzer_context(submission, result):
    return (
        "A deterministic circuit analyzer was run for this user message. "
        "Use its output as the primary grounding for your answer.\n\n"
        f"Analyzer submission:\n{json.dumps(submission, indent=2)}\n\n"
        f"Analyzer result:\n{json.dumps(result, indent=2)}"
    )

def build_circuit_chat_context(result):
    contexts = result.get("contexts") or []
    answer = str(result.get("answer") or "").strip()

    sections = [
        f"[{c.get('tag', 'Lab Manual')}]\n{c.get('content', '')}"
        for c in contexts
        if isinstance(c, dict)
    ]

    chunks = []
    if answer:
        chunks.append("Retrieved lab-manual answer:\n" + answer)
    if sections:
        chunks.append("Retrieved lab-manual context:\n" + "\n---\n".join(sections))

    if not chunks:
        return "Lab manual retrieval ran but found no matching context."
    return "Use the retrieved lab-manual output as the primary grounding.\n\n" + "\n\n".join(chunks)


async def get_lab_manual_grounding(question: str, lab_number: int | None = None, current_part: str | None = None) -> str | None:
    question_text = str(question or "").strip()
    if not question_text:
        return None

    if current_part:
        augmented_question = (
            f"Current lab part: {str(current_part).strip()}\n"
            f"Student question: {question_text}"
        )
    else:
        augmented_question = question_text

    path = f"/chat/{int(lab_number)}" if lab_number is not None else "/chat"
    payload = {"question": augmented_question}

    try:
        result = await circuit_post(path, payload)
    except HTTPException as exc:
        logging.getLogger(__name__).warning(
            "Lab-manual grounding request failed for %s: %s",
            path,
            exc.detail,
        )
        return None
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "Unexpected lab-manual grounding failure for %s: %s",
            path,
            exc,
        )
        return None

    grounding = build_circuit_chat_context(result)
    if not grounding or "found no matching context" in grounding.lower():
        return None
    return grounding

@app.get("/api/circuits")
async def get_circuits():
    return await circuit_get("/circuits")

@app.get("/api/circuits/{circuit_name}/nodes")
async def get_nodes(circuit_name: str):
    return await circuit_get(f"/circuits/{circuit_name}/nodes")

@app.post("/api/debug")
async def debug_circuit(payload: dict):
    payload = dict(payload or {})
    if not payload.get("source_currents"):
        payload.pop("source_currents", None)
    logging.getLogger(__name__).info("Normalized /api/debug payload: %s", json.dumps(payload))
    result = await circuit_post("/debug", payload)
    return {"result": result, "submission": payload, "context": build_circuit_analyzer_context(payload, result)}

@app.post("/api/circuit-chat")
async def circuit_chat(payload: dict):
    question = str(payload.get("question") or "").strip()
    current_part = payload.get("current_part")

    try:
        lab_number = int(payload.get("lab_number")) if payload.get("lab_number") not in (None, "", False) else None
    except (TypeError, ValueError):
        lab_number = None

    if current_part and question:
        outbound_question = f"Current lab part: {str(current_part).strip()}\nStudent question: {question}"
    else:
        outbound_question = question

    path = f"/chat/{lab_number}" if lab_number is not None else "/chat"
    result = await circuit_post(path, {"question": outbound_question})
    return {"result": result, "context": build_circuit_chat_context(result)}

# ── ADMIN UTILS ──────────────────────────────────────────
@app.post("/api/admin/reset-conversations")
async def admin_reset_conversations():
    conn = get_db()
    conn.execute("UPDATE conversations SET messages = '[]', updated_at = CURRENT_TIMESTAMP")
    conn.commit()
    conn.close()
    return {"ok": True}

# ── TTS ──────────────────────────────────────────────────────────────────────

@app.post("/api/tts")
async def text_to_speech(body: dict):
    """
    Synthesize speech from text.
    Returns base64-encoded audio + MIME type so the frontend can play it
    directly without a second request.
    """
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        normalized_text = normalize_for_speech(text)
        audio_bytes, mime_type = await tts_synthesize(normalized_text)
        return {
            "audio": base64.b64encode(audio_bytes).decode("utf-8"),
            "mime_type": mime_type,
            "engine": tts_engine_name(),
            "rate": float(get_setting("tts_rate") or 1.05),
            "pitch": float(get_setting("tts_pitch") or 1.0),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback
        logging.getLogger(__name__).error(f"TTS endpoint error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")


# ── STT status ────────────────────────────────────────────────────────────────

@app.get("/api/stt/status")
async def stt_status():
    """Returns current pipeline state for the frontend status indicator."""
    return {
        "state": audio_pipeline.state,
        "transcript_available": False,   # per-session in Phase 2; not meaningful globally
    }


# ── Audio WebSocket ───────────────────────────────────────────────────────────

@app.websocket("/ws/audio")
async def audio_websocket(websocket: WebSocket):
    await websocket.accept()
    _log = logging.getLogger(__name__)
    _log.info("Audio WS client connected")

    loop              = asyncio.get_event_loop()
    client_session_id = None   # set on init message; drives all pipeline calls
    session_attached  = False  # True once attach_session() has been called
    last_state        = None
    ctx               = None   # AudioSessionContext returned by attach_session()

    async def push_state():
        nonlocal last_state
        # get_state_for() returns IDLE for revoked / pre-init sessions — no leakage
        current = audio_pipeline.get_state_for(client_session_id)
        if current != last_state:
            msg = {"type": "state", "state": current}
            if client_session_id:
                msg["session_id"] = client_session_id
            await websocket.send_text(json.dumps(msg))
            last_state = current

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                msg = json.loads(raw)

                if msg.get("type") == "init":
                    sid = msg.get("session_id")
                    if sid and not session_attached:
                        client_session_id = sid
                        # attach_session() atomically revokes any prior session,
                        # creates a fresh per-session transcript + ctrl queue, and
                        # puts session_revoked on the old session's ctrl_queue
                        ctx = audio_pipeline.attach_session(client_session_id, loop)
                        session_attached = True
                        last_state = None   # force a state push on next tick
                        _log.info(f"Audio session attached: {client_session_id}")

                elif msg.get("type") == "listen":
                    # Phase 3: trigger_listen returns "ok" | "mic_busy" | "no_session"
                    result = audio_pipeline.trigger_listen(client_session_id)
                    if result == "mic_busy":
                        await websocket.send_text(json.dumps({
                            "type": "mic_busy",
                            "session_id": client_session_id,
                        }))

                elif msg.get("type") == "stop":
                    # Only the current active owner can stop recording
                    audio_pipeline.trigger_stop(client_session_id)

            except asyncio.TimeoutError:
                pass
            except WebSocketDisconnect:
                break
            except Exception as e:
                _log.warning(f"Audio WS message error: {e}")
                # Don't break — keep connection alive

            # ── Control events (session_revoked, etc.) ───────────────────────
            # ctx is the AudioSessionContext for this connection.  If another
            # client called attach_session() while we were alive, the pipeline
            # placed a session_revoked event on ctx.ctrl_queue.  Forward it to
            # the frontend and close this connection.
            if ctx is not None:
                try:
                    ctrl_event = ctx.ctrl_queue.get_nowait()
                    await websocket.send_text(json.dumps(ctrl_event))
                    if ctrl_event.get("type") == "session_revoked":
                        _log.info(
                            f"Session revoked — closing WS for {client_session_id}"
                        )
                        break   # exit main loop; finally block will detach
                except asyncio.QueueEmpty:
                    pass

            await push_state()

            # Both calls are session-scoped — results from another session never appear here
            if audio_pipeline.transcript_available_for(client_session_id):
                transcript = await audio_pipeline.get_transcript_for(client_session_id)
                if transcript:   # None if session was replaced between the two calls
                    out = {"type": "transcript", "text": transcript, "auto_send": True}
                    if client_session_id:
                        out["session_id"] = client_session_id
                    await websocket.send_text(json.dumps(out))

            await asyncio.sleep(0.05)

    except WebSocketDisconnect:
        _log.info(f"Audio WS disconnected: {client_session_id}")
    finally:
        # detach_session is idempotent and safe with None — no-op if already replaced
        if session_attached:
            audio_pipeline.detach_session(client_session_id)
            _log.info(f"Audio session detached on teardown: {client_session_id}")


# ── HELPERS ──────────────────────────────────────────────
def normalize_for_speech(text: str) -> str:
    """Prepare assistant text for TTS without changing visible chat text."""
    s = str(text or "").strip()
    if not s:
        return ""

    # Strip control tags / wrappers that should never be spoken.
    s = re.sub(r'<spoken>.*?</spoken>', ' ', s, flags=re.DOTALL)
    s = re.sub(r'<guide\s+section="[^"]*"\s*/?>', ' ', s)
    s = re.sub(r'<handoff\s+reason="[^"]*"\s*/?>', ' ', s)
    s = re.sub(r'\\\[(.*?)\\\]', r' \1 ', s)
    s = re.sub(r'\\\((.*?)\\\)', r' \1 ', s)
    s = s.replace('$$', ' ').replace('$', ' ')

    # Flatten common LaTeX into simple spoken English.
    s = re.sub(r'\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}', r' \1 over \2 ', s)
    s = re.sub(r'\\text\{([^{}]+)\}', r' \1 ', s)
    s = re.sub(r'\\cdot|\\times', ' times ', s)
    s = re.sub(r'\\approx', ' approximately ', s)
    s = re.sub(r'\\Rightarrow|\\to', ' then ', s)
    s = re.sub(r'\\Omega', ' ohms ', s)
    s = re.sub(r'\\quad|\\qquad|\\,|\\;|\\:', ' ', s)

    # Convert subscript-style notation like V_1 or V_{out} to speech-friendly text.
    s = re.sub(r'([A-Za-z])_\{([A-Za-z0-9]+)\}', r'\1 \2', s)
    s = re.sub(r'([A-Za-z])_([A-Za-z0-9]+)', r'\1 \2', s)

    # Remove leftover half-rendered LaTeX markers.
    s = s.replace('\\', ' ')
    s = s.replace('{', ' ').replace('}', ' ')

    s = s.replace('_', ' ')

    # Common circuit labels: V1 -> V 1, R2 -> R 2, N001 -> N 0 0 1
    s = re.sub(
        r'\b([VIRCLQDUNvirclqdun])\s*([0-9]{1,4})\b',
        lambda m: f"{m.group(1)} {' '.join(m.group(2))}",
        s,
    )
    s = re.sub(
        r'\b([VvIi])\s+([Nn])\s*([0-9]{1,4})\b',
        lambda m: f"{m.group(1)} {m.group(2)} {' '.join(m.group(3))}",
        s,
    )
    s = re.sub(r'\s+', ' ', s).strip(' ,;')
    return s

def extract_spoken(text: str):
    match = re.search(r'<spoken>(.*?)</spoken>', text, re.DOTALL)
    if match:
        return text[:match.start()].strip(), normalize_for_speech(match.group(1).strip())
    display = re.sub(r'<spoken>[\s\S]*$', '', text).strip()
    sentences = re.split(r'(?<=[.!?])\s+', display)
    fallback = ' '.join(sentences[:2])[:300].strip() or display[:200].strip()
    return display, normalize_for_speech(fallback)

def extract_guidance(text: str):
    match = re.search(r'<guide\s+section="([\w-]+)"\s*/?>', text)
    return match.group(1) if match else None

def extract_handoff(text: str):
    match = re.search(r'<handoff\s+reason="([^"]+)"\s*/?>', text)
    return match.group(1) if match else None

def clean_dashboard_tags(text: str):
    text = re.sub(r'<guide\s+section="[^"]*"\s*/?>', '', text)
    text = re.sub(r'<handoff\s+reason="[^"]*"\s*/?>', '', text)
    return text.strip()

# ── WEBSOCKET ────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    conversation_history = []
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "init":
                conversation_history = message.get("history", [])
                await websocket.send_text(json.dumps({"type": "ready"}))
                continue

            user_text          = message.get("text", "")
            circuit_context    = message.get("circuit_context", None)
            message_mode       = str(message.get("message_mode", "default") or "default").strip().lower()
            student_name       = message.get("student_name", "Student")
            captions_on        = message.get("captions_on", False)
            dashboard_context  = message.get("dashboard_context", None) or {}
            lab_context        = message.get("lab_context", None) or {}
            lab_number_raw     = lab_context.get("lab_number")
            current_part       = dashboard_context.get("current_part") or lab_context.get("current_part")

            try:
                lab_number = int(lab_number_raw) if lab_number_raw not in (None, "", False) else None
            except (TypeError, ValueError):
                lab_number = None

            is_circuit_message = message_mode == "circuit_analyzer"
            if is_circuit_message:
                request_history = [{"role": "user", "content": user_text}]
            else:
                conversation_history.append({"role": "user", "content": user_text})
                request_history = conversation_history

            client      = make_ollama_client()
            model_big   = get_setting("model_captions_on")
            model_small = get_setting("model_captions_off")
            lab_grounding = None
            if not is_circuit_message:
                lab_grounding = await get_lab_manual_grounding(
                    question=user_text,
                    lab_number=lab_number,
                    current_part=current_part,
                )

            if captions_on:
                sys_p = (
                    f"You are an expert circuit lab assistant for {student_name}. "
                    "Give a thorough, detailed, well-structured answer. "
                    "FORMATTING RULES:\n"
                    "- Use markdown: headers (##), bullet lists, bold, code blocks.\n"
                    "- GFM tables with | separators and header divider. Never <br> inside cells.\n"
                    "- Math: \\(...\\) inline, \\[...\\] display. Never $...$.\n"
                    "- No raw HTML tags.\n"
                    "- Use the retrieved lab-manual output when it is available, and do not contradict it.\n"
                )
                if lab_number is not None:
                    sys_p += f"\n\nCurrent lab number: {lab_number}."
                if current_part:
                    sys_p += f"\nCurrent lab part: {current_part}."
                if lab_grounding:
                    sys_p += f"\n\n{lab_grounding}"
                if circuit_context:
                    sys_p += f"\n\n{circuit_context}"
                if message_mode == "circuit_analyzer":
                    sys_p += (
                        "\n\nThis message came from the circuit analyzer submit flow. Treat it as a structured debug request, not a general chat question. "
                        "Only do these things: summarize the analyzer finding, explain the most likely cause, and give a short list of concrete verification steps. "
                        "Do not include lab report sections, report-writing advice, background theory, objectives, conclusions, or answers to prior conversation topics unless the current message explicitly asks for them. "
                        "Stay tightly scoped to the current circuit submission and its deterministic analyzer result."
                    )
                full = ""
                stream = await client.chat.completions.create(
                    model=model_big,
                    messages=[{"role": "system", "content": sys_p}] + request_history,
                    stream=True, max_tokens=(1200 if message_mode == 'circuit_analyzer' else int(get_setting('max_tokens_large') or 4096)),
                )
                async for chunk in stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        full += token
                        await websocket.send_text(json.dumps({"type": "token", "content": token}))
                display, spoken = extract_spoken(full)
                await websocket.send_text(json.dumps({"type": "done", "spoken_text": spoken, "display_text": display}))
                conversation_history.append({"role": "assistant", "content": display})
            else:
                sys_p = (
                    f"You are a friendly, conversational circuit lab assistant for {student_name}. "
                    "Keep answers short, clear, natural — like speaking out loud. "
                    "No markdown, no HTML, no LaTeX. 2-4 sentences max.\n\n"
                    "Use the retrieved lab-manual output when it is available, and do not contradict it.\n\n"
                    "DASHBOARD GUIDANCE:\n"
                    "If your answer references a specific dashboard section, add at the very end: <guide section=\"SECTION\"/>\n"
                    "Valid sections: objectives, parts, components, equations, images, calculator, notes\n"
                    "Only include this when you specifically reference that section's content.\n\n"
                    "HANDOFF:\n"
                    "If the question needs circuit analysis, complex calculations, or detailed typed input, "
                    "add at the very end: <handoff reason=\"REASON\"/>\n"
                    "Valid reasons: circuit_analysis, complex_input, detailed_explanation\n"
                    "When you include a handoff tag, still give a brief spoken answer."
                )
                if lab_number is not None:
                    sys_p += f"\n\nCurrent lab number: {lab_number}."
                if lab_grounding:
                    sys_p += f"\n\n{lab_grounding}"
                if circuit_context:
                    sys_p += f"\n\n{circuit_context}"
                if dashboard_context:
                    if current_part:
                        sys_p += f"\nThe student is currently working on: {current_part}."
                    if dashboard_context.get("mode") == "voice":
                        sys_p += (
                            "\nThe student is using voice mode on the lab dashboard. "
                            "Write for text-to-speech: never output LaTeX, backslashes, underscore notation, or symbol markup. "
                            "Say circuit labels in plain spoken text, for example V1 as 'V 1', R2 as 'R 2', V_out as 'V out', and N001 as 'N 0 0 1'."
                        )
                if message_mode == "circuit_analyzer":
                    sys_p += (
                        "\n\nThis message came from the circuit analyzer submit flow. Treat it as a structured debug request. "
                        "Only summarize the analyzer finding, explain the likely issue, and give the next checks. "
                        "Do not include lab report advice or continue prior unrelated topics unless explicitly asked in the current message."
                    )
                full = ""
                stream = await client.chat.completions.create(
                    model=model_small,
                    messages=[{"role": "system", "content": sys_p}] + request_history,
                    stream=True, max_tokens=(384 if message_mode == 'circuit_analyzer' else int(get_setting('max_tokens_small') or 512)),
                )
                async for chunk in stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        full += token
                        await websocket.send_text(json.dumps({"type": "token", "content": token}))
                guidance = extract_guidance(full)
                handoff = extract_handoff(full)
                clean = clean_dashboard_tags(full.strip())
                spoken_clean = normalize_for_speech(clean)
                await websocket.send_text(json.dumps({
                    "type": "done",
                    "spoken_text": spoken_clean,
                    "display_text": clean,
                    "guidance_section": guidance,
                    "handoff": handoff,
                }))
                conversation_history.append({"role": "assistant", "content": clean})

    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
