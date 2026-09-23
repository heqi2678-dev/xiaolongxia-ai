#!/usr/bin/python3
import base64
import hashlib
import hmac
import html as html_mod
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import socketserver
import sqlite3
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote_to_bytes, urlparse

HOST = os.environ.get("GATE_HOST", "127.0.0.1")
PORT = int(os.environ.get("GATE_PORT", "9140"))
SHOP_DIR = Path(os.environ.get("SHOP_DIR", "/home/admin/work/xiaolongxia-ai"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/home/admin/work/xiaolongxia-gate-data"))
ROOM_ROOT = Path(os.environ.get("ROOM_ROOT", "/home/admin/work/rooms"))
PUBLISH_ROOT = Path(os.environ.get("PUBLISH_ROOT", "/home/admin/work/zuopin"))
PUBLISH_BASE = os.environ.get("PUBLISH_BASE", "http://47.108.14.206/zuopin")
CLERK_URL = os.environ.get("CLERK_URL", "http://127.0.0.1:9130/api/chat")
GATE_DIR = Path(__file__).resolve().parent
ALLOWED_BRAINS = set(["deepseek", "qwen", "doubao", "custom"])
CLERK_BRAINS = [
    {
        "id": "deepseek",
        "label": "DeepSeek",
        "hint": "现在在用的大脑",
        "base": "https://api.deepseek.com/v1",
        "models": [
            {"id": "deepseek-v4-pro", "label": "聪明", "hint": "想得细，费高"},
            {"id": "deepseek-v4-flash", "label": "省钱快", "hint": "回复快，费低"},
        ],
    },
    {
        "id": "qwen",
        "label": "千问",
        "hint": "阿里云百炼 Key",
        "base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "models": [
            {"id": "qwen-plus", "label": "Plus", "hint": "日常够用"},
            {"id": "qwen-turbo", "label": "Turbo", "hint": "更快更省"},
            {"id": "qwen-max", "label": "Max", "hint": "更聪明，费高"},
            {"id": "qwen3-coder-plus", "label": "Coder", "hint": "改代码"},
        ],
    },
    {
        "id": "doubao",
        "label": "豆包",
        "hint": "火山方舟。模型名填控制台里的接入点 ID",
        "base": "https://ark.cn-beijing.volces.com/api/v3",
        "models": [
            {"id": "doubao-seed-1-6-250615", "label": "Seed 1.6", "hint": "可改成接入点 ID"},
        ],
    },
    {
        "id": "custom",
        "label": "自定义",
        "hint": "自己填地址、模型名和钥匙",
        "base": "",
        "models": [],
    },
]
PUBLISH_MAX_FILES = 30
PUBLISH_MAX_BYTES = 5 * 1024 * 1024
PUBLISH_NAME_OK = re.compile(r"^[\w\u4e00-\u9fff-]{1,80}\.[A-Za-z0-9]{1,8}$")
PUBLISH_EXTS = set([
    ".html", ".htm", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".svg", ".ico", ".woff", ".woff2", ".ttf", ".json", ".txt", ".md",
])
COOKIE_NAME = "xlx_sid"
SESSION_DAYS = 7
FRIEND_DAILY_LIMIT = 100
TZ = timezone(timedelta(hours=8))
RESERVED_NAMES = set(["zhuren", "admin", "tonglong", "owner", "root", "guest"])
NAME_OK = re.compile(r"^[\w\u4e00-\u9fff-]{1,20}$")

STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff2": "font/woff2",
    ".bin": "application/octet-stream",
    ".onnx": "application/octet-stream",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
}

DRAMA_PUBLIC_BASE = os.environ.get("DRAMA_PUBLIC_BASE", "").rstrip("/")
DRAMA_PUB_DIR = DATA_DIR / "pub"
DRAMA_PUB_EXT = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav",
    "audio/mp4": ".m4a", "audio/aac": ".aac", "video/mp4": ".mp4",
}
DRAMA_PUB_NAME = re.compile(r"^[A-Za-z0-9_-]{16,64}\.(mp4|mp3|wav|m4a|aac|jpg|jpeg|png|webp)$")
# 火山数字人只接受公网 URL，单文件上限 200MB 与服务端合成保持一致
DRAMA_PUB_MAX = 200 * 1024 * 1024

_lock = threading.Lock()

# ---------- 联网搜索：服务端抓取必应/360（国内可直连，绕开浏览器 CORS） ----------

_TAG_RE = re.compile(r"<[^>]+>")
_FETCH_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _strip_tags(s):
    return re.sub(r"\s+", " ", html_mod.unescape(_TAG_RE.sub("", s or ""))).strip()


def _http_get_text(url, timeout=12, limit=4 * 1024 * 1024):
    req = urllib.request.Request(
        url, headers={"User-Agent": _FETCH_UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(limit + 1)
        if len(raw) > limit:
            raise ValueError("响应过大")
        charset = resp.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def scrape_bing(q, limit=8):
    url = "https://cn.bing.com/search?q=" + urllib.parse.quote(q) + "&ensearch=0"
    page = _http_get_text(url)
    out = []
    for block in page.split('<li class="b_algo"')[1:]:
        a = re.search(r'<h2[^>]*>\s*<a[^>]*?href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not a:
            continue
        u = html_mod.unescape(a.group(1))
        title = _strip_tags(a.group(2))
        p = re.search(r"<p[^>]*>(.*?)</p>", block, re.S)
        snippet = _strip_tags(p.group(1)) if p else ""
        if title and u.startswith("http"):
            out.append({"title": title, "url": u, "snippet": snippet, "source": "bing"})
        if len(out) >= limit:
            break
    return out


def scrape_360(q, limit=8):
    url = "https://www.so.com/s?q=" + urllib.parse.quote(q)
    page = _http_get_text(url)
    out = []
    for block in page.split('<li class="res-list"')[1:]:
        a = re.search(r'<h3[^>]*>.*?<a\b[^>]*?href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not a:
            continue
        md = re.search(r'data-mdurl="([^"]+)"', block)
        u = html_mod.unescape(md.group(1) if md else a.group(1))
        title = _strip_tags(a.group(2))
        p = re.search(r'<p class="res-desc"[^>]*>(.*?)</p>', block, re.S)
        snippet = _strip_tags(p.group(1)) if p else ""
        if title and u.startswith("http"):
            out.append({"title": title, "url": u, "snippet": snippet, "source": "so360"})
        if len(out) >= limit:
            break
    return out


class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def now():
    return datetime.now(TZ)


def today_key():
    return now().strftime("%Y-%m-%d")


INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_invite_code():
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))


def ensure_data():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ROOM_ROOT.mkdir(parents=True, exist_ok=True)
    PUBLISH_ROOT.mkdir(parents=True, exist_ok=True)
    DRAMA_PUB_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("users.json", "sessions.json", "quota.json", "friend.json"):
        p = DATA_DIR / name
        if not p.exists():
            p.write_text("{}\n", encoding="utf-8")
    ensure_invite()


def ensure_invite():
    with _lock:
        data = load_json("invite.json")
        code = str(data.get("code") or "").strip()
        if code:
            return code
        code = new_invite_code()
        save_json(
            "invite.json",
            {"code": code, "updatedAt": now().isoformat()},
        )
        return code


def current_invite():
    ensure_invite()
    with _lock:
        data = load_json("invite.json")
        return str(data.get("code") or "").strip()


def rotate_invite():
    with _lock:
        code = new_invite_code()
        save_json(
            "invite.json",
            {"code": code, "updatedAt": now().isoformat()},
        )
        return code


def invite_ok(given):
    got = str(given or "").strip().upper()
    cur = current_invite().upper()
    if not got or not cur:
        return False
    if len(got) != len(cur):
        return False
    return hmac.compare_digest(got, cur)


def publish_slug(name):
    if not name or not NAME_OK.match(name):
        return None
    return name


class DataUrlError(Exception):
    pass


def decode_data_url(content):
    """把 data:...;base64,... 或 data:...,... 解析成 bytes。

    不是 data URL 时返回 None；是 data URL 但内容坏了则抛 DataUrlError。
    """
    if not isinstance(content, str) or not content.startswith("data:"):
        return None
    comma = content.find(",")
    if comma < 0:
        raise DataUrlError()
    meta = content[:comma]
    body = content[comma + 1:]
    try:
        if ";base64" in meta.lower():
            return base64.b64decode(body, validate=True)
        return unquote_to_bytes(body)
    except Exception:
        raise DataUrlError()


def validate_publish_files(raw_files):
    if not isinstance(raw_files, list) or not raw_files:
        return None, "请先做出网页"
    if len(raw_files) > PUBLISH_MAX_FILES:
        return None, "文件太多，最多 30 个"
    out = []
    total = 0
    has_index = False
    seen = set()
    for item in raw_files:
        if not isinstance(item, dict):
            return None, "文件格式不对"
        name = str(item.get("name") or "").strip()
        content = item.get("content")
        if content is None:
            content = ""
        if not isinstance(content, str):
            return None, "文件内容读不懂"
        if not PUBLISH_NAME_OK.match(name):
            return None, "去掉路径字符"
        low = name.lower()
        ext = ""
        if "." in low:
            ext = "." + low.rsplit(".", 1)[1]
        if ext not in PUBLISH_EXTS:
            return None, "只上网页文件"
        if low in seen:
            continue
        seen.add(low)
        if low in ("index.html", "index.htm"):
            has_index = True
        try:
            binary = decode_data_url(content)
        except DataUrlError:
            return None, "文件内容坏了，重新导入再试"
        if binary is not None:
            total += len(binary)
            if total > PUBLISH_MAX_BYTES:
                return None, "体积太大，缩小后再上"
            out.append({"name": name, "content": binary, "binary": True})
        else:
            encoded = content.encode("utf-8")
            total += len(encoded)
            if total > PUBLISH_MAX_BYTES:
                return None, "体积太大，缩小后再上"
            out.append({"name": name, "content": content, "binary": False})
    if not has_index:
        return None, "先做出网页"
    return out, None


def write_publish(name, files):
    dest = PUBLISH_ROOT / name
    tmp = PUBLISH_ROOT / (".tmp-" + name + "-" + secrets.token_hex(4))
    old = PUBLISH_ROOT / (".old-" + name + "-" + secrets.token_hex(4))
    PUBLISH_ROOT.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True)
    try:
        for item in files:
            target = tmp / item["name"]
            if item.get("binary"):
                target.write_bytes(item["content"])
            else:
                target.write_text(item["content"], encoding="utf-8")
        if dest.exists():
            dest.rename(old)
        tmp.rename(dest)
        if old.exists():
            shutil.rmtree(old)
    except Exception:
        if tmp.exists():
            shutil.rmtree(tmp)
        if old.exists() and not dest.exists():
            old.rename(dest)
        raise
    return dest


def ensure_room(name):
    if not valid_friend_name(name) and name != "zhuren":
        return None
    room = ROOM_ROOT / name
    room.mkdir(parents=True, exist_ok=True)
    readme = room / "README.md"
    if not readme.exists():
        readme.write_text(
            "这是 %s 的工作间。写的代码放这里，碰不到铜龙电商店面。\n" % name,
            encoding="utf-8",
        )
    guide_dir = room / "shuoming"
    guide_dir.mkdir(parents=True, exist_ok=True)
    guide = guide_dir / "guide.md"
    if not guide.exists():
        guide.write_text(
            "# %s 的房间说明书\n\n"
            "这是你自己的工作间。指挥店员时，活只落在这里。\n\n"
            "- 闲聊：用你自己的钥匙\n"
            "- 指挥店员：打开开关，可换大脑；钥匙填在「大脑设置」\n"
            "- 问用法：店员会先查官方说明再答\n"
            "- 网页做好后可点「一键上线」\n" % name,
            encoding="utf-8",
        )
    return room


def read_guide(path):
    try:
        if path.is_file():
            return path.read_text(encoding="utf-8")
    except OSError:
        pass
    return ""


def load_json(name):
    p = DATA_DIR / name
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def save_json(name, data):
    p = DATA_DIR / name
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(p)


# ============ AI 短剧：工程存储（SQLite） ============
DRAMA_MAX_PROJECTS = 300
DRAMA_MAX_BYTES = 3 * 1024 * 1024
_drama_lock = threading.Lock()
_drama_ready = False


def _drama_db_path():
    return DATA_DIR / "drama.db"


def _drama_conn():
    conn = sqlite3.connect(str(_drama_db_path()), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def ensure_drama():
    global _drama_ready
    ensure_data()
    with _drama_lock:
        conn = _drama_conn()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    owner TEXT NOT NULL,
                    title TEXT NOT NULL DEFAULT '',
                    genre TEXT NOT NULL DEFAULT 'comic',
                    engine TEXT NOT NULL DEFAULT 'image',
                    status TEXT NOT NULL DEFAULT 'draft',
                    data_json TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner, updated_at);
                CREATE TABLE IF NOT EXISTS characters (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL DEFAULT '',
                    identity TEXT NOT NULL DEFAULT '',
                    appearance TEXT NOT NULL DEFAULT '',
                    ref_images_json TEXT NOT NULL DEFAULT '[]',
                    locked INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
                CREATE TABLE IF NOT EXISTS shots (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    seq INTEGER NOT NULL DEFAULT 0,
                    prompt TEXT NOT NULL DEFAULT '',
                    line TEXT NOT NULL DEFAULT '',
                    duration REAL NOT NULL DEFAULT 0,
                    motion TEXT NOT NULL DEFAULT '',
                    image_url TEXT NOT NULL DEFAULT '',
                    video_url TEXT NOT NULL DEFAULT '',
                    audio_url TEXT NOT NULL DEFAULT '',
                    lipsync_url TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending'
                );
                CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(project_id, seq);
                CREATE TABLE IF NOT EXISTS assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    shot_id TEXT NOT NULL DEFAULT '',
                    kind TEXT NOT NULL DEFAULT '',
                    url TEXT NOT NULL DEFAULT '',
                    local_path TEXT NOT NULL DEFAULT '',
                    meta_json TEXT NOT NULL DEFAULT '{}',
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
                CREATE TABLE IF NOT EXISTS consents (
                    id TEXT PRIMARY KEY,
                    owner TEXT NOT NULL,
                    subject TEXT NOT NULL DEFAULT '',
                    scope TEXT NOT NULL DEFAULT '',
                    confirmed_at REAL NOT NULL,
                    ip_hash TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS idx_consents_owner ON consents(owner);
                CREATE TABLE IF NOT EXISTS publishes (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL DEFAULT '',
                    owner TEXT NOT NULL,
                    output_url TEXT NOT NULL DEFAULT '',
                    meta_json TEXT NOT NULL DEFAULT '{}',
                    marked_aigc INTEGER NOT NULL DEFAULT 1,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_publishes_owner ON publishes(owner, created_at);
                CREATE TABLE IF NOT EXISTS usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    owner TEXT NOT NULL,
                    day TEXT NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    limit_count INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(owner, day)
                );
                """
            )
            conn.commit()
            _drama_ready = True
        finally:
            conn.close()


def drama_save(owner, project):
    ensure_drama()
    if not isinstance(project, dict):
        raise ValueError("工程格式不对")
    pid = str(project.get("id") or "").strip()
    if not pid or len(pid) > 64:
        raise ValueError("工程 ID 不合规")
    payload = json.dumps(project, ensure_ascii=False)
    if len(payload.encode("utf-8")) > DRAMA_MAX_BYTES:
        raise ValueError("工程太大，请减少分镜或素材链接")
    shots = project.get("shots") if isinstance(project.get("shots"), list) else []
    chars = project.get("characters") if isinstance(project.get("characters"), list) else []
    now_ts = time.time()
    done = sum(1 for s in shots if isinstance(s, dict) and s.get("status") == "done")
    status = "done" if shots and done == len(shots) else "draft"
    with _drama_lock:
        conn = _drama_conn()
        try:
            row = conn.execute(
                "SELECT owner, created_at FROM projects WHERE id = ?", (pid,)
            ).fetchone()
            if row and row["owner"] != owner:
                raise ValueError("这不是你的工程")
            if not row:
                count = conn.execute(
                    "SELECT COUNT(*) AS c FROM projects WHERE owner = ?", (owner,)
                ).fetchone()["c"]
                if count >= DRAMA_MAX_PROJECTS:
                    raise ValueError("工程数量已达上限")
            created = row["created_at"] if row else now_ts
            conn.execute(
                """INSERT INTO projects(id, owner, title, genre, engine, status, data_json, created_at, updated_at)
                   VALUES(?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                     title=excluded.title, genre=excluded.genre, engine=excluded.engine,
                     status=excluded.status, data_json=excluded.data_json, updated_at=excluded.updated_at""",
                (
                    pid,
                    owner,
                    str(project.get("title") or "")[:120],
                    str(project.get("genre") or "comic"),
                    str(project.get("engine") or "image"),
                    status,
                    payload,
                    created,
                    now_ts,
                ),
            )
            conn.execute("DELETE FROM characters WHERE project_id = ?", (pid,))
            for c in chars:
                if not isinstance(c, dict) or not c.get("id"):
                    continue
                refs = json.dumps(c.get("refImages") or [], ensure_ascii=False)
                conn.execute(
                    "INSERT OR REPLACE INTO characters(id, project_id, name, identity, appearance, ref_images_json, locked) VALUES(?,?,?,?,?,?,?)",
                    (
                        str(c.get("id")),
                        pid,
                        str(c.get("name") or ""),
                        str(c.get("identity") or ""),
                        str(c.get("appearance") or ""),
                        refs,
                        1 if c.get("locked") else 0,
                    ),
                )
            conn.execute("DELETE FROM shots WHERE project_id = ?", (pid,))
            for s in shots:
                if not isinstance(s, dict) or not s.get("id"):
                    continue
                conn.execute(
                    "INSERT OR REPLACE INTO shots(id, project_id, seq, prompt, line, duration, motion, image_url, video_url, audio_url, lipsync_url, status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        str(s.get("id")),
                        pid,
                        int(s.get("seq") or 0),
                        str(s.get("prompt") or ""),
                        str(s.get("line") or ""),
                        float(s.get("duration") or 0),
                        str(s.get("motion") or ""),
                        str(s.get("imageUrl") or ""),
                        str(s.get("videoUrl") or ""),
                        str(s.get("audioUrl") or ""),
                        str(s.get("lipsyncUrl") or ""),
                        str(s.get("status") or "pending"),
                    ),
                )
            conn.commit()
        finally:
            conn.close()
    return {"id": pid, "updatedAt": now_ts, "status": status}


def drama_list(owner):
    ensure_drama()
    with _drama_lock:
        conn = _drama_conn()
        try:
            rows = conn.execute(
                "SELECT id, title, genre, engine, status, updated_at FROM projects WHERE owner = ? ORDER BY updated_at DESC LIMIT 200",
                (owner,),
            ).fetchall()
        finally:
            conn.close()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "genre": r["genre"],
            "engine": r["engine"],
            "status": r["status"],
            "updatedAt": r["updated_at"],
        }
        for r in rows
    ]


def drama_get(owner, pid):
    ensure_drama()
    with _drama_lock:
        conn = _drama_conn()
        try:
            row = conn.execute(
                "SELECT data_json FROM projects WHERE id = ? AND owner = ?", (pid, owner)
            ).fetchone()
        finally:
            conn.close()
    if not row:
        return None
    try:
        return json.loads(row["data_json"])
    except json.JSONDecodeError:
        return None


def drama_delete(owner, pid):
    ensure_drama()
    with _drama_lock:
        conn = _drama_conn()
        try:
            cur = conn.execute(
                "DELETE FROM projects WHERE id = ? AND owner = ?", (pid, owner)
            )
            conn.execute("DELETE FROM characters WHERE project_id = ?", (pid,))
            conn.execute("DELETE FROM shots WHERE project_id = ?", (pid,))
            conn.execute("DELETE FROM assets WHERE project_id = ?", (pid,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def drama_add_publish(owner, record, ip_hash=""):
    ensure_drama()
    record = record or {}
    rid = str(record.get("id") or ("pub" + secrets.token_hex(6)))[:64]
    meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
    with _drama_lock:
        conn = _drama_conn()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO publishes(id, project_id, owner, output_url, meta_json, marked_aigc, created_at) VALUES(?,?,?,?,?,?,?)",
                (
                    rid,
                    str(record.get("projectId") or ""),
                    owner,
                    str(record.get("outputUrl") or ""),
                    json.dumps(meta, ensure_ascii=False),
                    0 if record.get("markedAigc") is False else 1,
                    float(record.get("at") or time.time()),
                ),
            )
            consent_ids = record.get("consentIds") or []
            now_ts = time.time()
            for cid in consent_ids:
                if not cid:
                    continue
                conn.execute(
                    "INSERT OR REPLACE INTO consents(id, owner, subject, scope, confirmed_at, ip_hash) VALUES(?,?,?,?,?,?)",
                    (
                        str(cid)[:64],
                        owner,
                        str(record.get("title") or "")[:120],
                        "AI 短剧肖像授权",
                        now_ts,
                        ip_hash,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
    return {"id": rid}


def drama_list_publishes(owner):
    ensure_drama()
    with _drama_lock:
        conn = _drama_conn()
        try:
            rows = conn.execute(
                "SELECT id, project_id, output_url, meta_json, marked_aigc, created_at FROM publishes WHERE owner = ? ORDER BY created_at DESC LIMIT 200",
                (owner,),
            ).fetchall()
        finally:
            conn.close()
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta_json"])
        except json.JSONDecodeError:
            meta = {}
        out.append(
            {
                "id": r["id"],
                "projectId": r["project_id"],
                "outputUrl": r["output_url"],
                "meta": meta,
                "markedAigc": bool(r["marked_aigc"]),
                "createdAt": r["created_at"],
            }
        )
    return out


DRAMA_FFMPEG = os.environ.get("DRAMA_FFMPEG", "ffmpeg")
DRAMA_COMPOSE_TIMEOUT = int(os.environ.get("DRAMA_COMPOSE_TIMEOUT", "900"))
DRAMA_ASSET_MAX = 200 * 1024 * 1024


def _drama_dims(ratio):
    return {
        "9:16": (720, 1280),
        "16:9": (1280, 720),
        "1:1": (720, 720),
        "3:4": (720, 960),
        "4:3": (960, 720),
    }.get(str(ratio or "9:16"), (720, 1280))


def _drama_out_dir(owner):
    safe = re.sub(r"[^\w\u4e00-\u9fff-]", "_", str(owner or "guest"))[:40] or "guest"
    d = ROOM_ROOT / safe / "drama-out"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _download_asset(url, dest):
    url = str(url or "").strip()
    if not url:
        raise ValueError("素材地址为空")
    if url.startswith("data:"):
        raw = decode_data_url(url)
    elif url.startswith("http://") or url.startswith("https://"):
        req = urllib.request.Request(url, headers={"User-Agent": "xiaolongxia-drama/1"})
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read(DRAMA_ASSET_MAX + 1)
        if len(raw) > DRAMA_ASSET_MAX:
            raise ValueError("素材超过 200MB")
    else:
        raise ValueError("不支持的素材地址")
    dest.write_bytes(raw)
    return dest


def _ff_run(args, timeout=DRAMA_COMPOSE_TIMEOUT):
    return subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
    )


def _drama_font():
    for p in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(p).is_file():
            return p
    if shutil.which("fc-match"):
        try:
            out = subprocess.run(
                ["fc-match", "-f", "%{file}", "sans:lang=zh"],
                stdout=subprocess.PIPE, timeout=10,
            ).stdout.decode("utf-8", "ignore").strip()
            if out and Path(out).is_file():
                return out
        except Exception:
            pass
    return ""


def _drama_srt(shots, bilingual=False):
    def fmt(sec):
        ms = int(round((sec - int(sec)) * 1000))
        s = int(sec) % 60
        m = (int(sec) // 60) % 60
        h = int(sec) // 3600
        return "%02d:%02d:%02d,%03d" % (h, m, s, ms)

    lines = []
    t = 0.0
    for sh in shots:
        dur = max(1.0, float(sh.get("duration") or 3))
        text = str(sh.get("line") or "").strip()
        text_en = str(sh.get("lineEn") or "").strip() if bilingual else ""
        body = "\n".join([x for x in (text, text_en) if x])
        if body:
            lines.append("%d\n%s --> %s\n%s\n" % (len(lines) + 1, fmt(t), fmt(t + dur), body))
        t += dur
    return "\n".join(lines)


VOLC_TTS_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"


def drama_tts(api_key, resource, text, speaker, speed=1.0, fmt=None, sample_rate=None):
    api_key = str(api_key or "").strip()
    resource = str(resource or "").strip() or "seed-tts-2.0"
    text = str(text or "").strip()
    speaker = str(speaker or "").strip()
    if not api_key:
        raise ValueError("缺少语音 API Key，请先到设置里填好")
    if not text:
        raise ValueError("没有可配音的台词")
    if not speaker:
        raise ValueError("没有选择音色")
    audio = {
        "format": str(fmt or "mp3").strip() or "mp3",
        "sample_rate": int(sample_rate or 24000),
    }
    try:
        sp = float(speed)
        if abs(sp - 1.0) > 1e-6:
            audio["speech_rate"] = max(-50, min(100, int(round((sp - 1) * 100))))
    except (TypeError, ValueError):
        pass
    payload = {
        "user": {"uid": "xlx-drama"},
        "req_params": {"text": text, "speaker": speaker, "audio_params": audio},
    }
    req = urllib.request.Request(
        VOLC_TTS_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Api-Key": api_key,
            "X-Api-Resource-Id": resource,
        },
        method="POST",
    )
    raw = ""
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
    except urllib.error.URLError as exc:
        raise RuntimeError("连不上语音服务，请检查网络：" + str(exc.reason))
    chunks = []
    err = ""
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            frame = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(frame, dict):
            continue
        header = frame.get("header")
        if isinstance(header, dict) and header.get("code") not in (0, None):
            err = str(header.get("message") or ("code %s" % header.get("code")))
        code = frame.get("code")
        if isinstance(code, int) and code not in (0, 20000000):
            err = str(frame.get("message") or ("code %s" % code))
            continue
        data = frame.get("data")
        if data:
            chunks.append(data)
    if not chunks:
        raise RuntimeError("语音合成未返回音频：" + (err or "无数据"))
    out = bytearray()
    for chunk in chunks:
        try:
            out += base64.b64decode(chunk)
        except Exception:
            continue
    if not out:
        raise RuntimeError("语音合成音频解码失败")
    return bytes(out)


VOLC_VISUAL_HOST = "visual.volcengineapi.com"
VOLC_VISUAL_REGION = "cn-north-1"
VOLC_VISUAL_SERVICE = "cv"
VOLC_VISUAL_VERSION = "2022-08-31"


def _volc_sha256(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _volc_hmac(key, msg):
    if isinstance(msg, str):
        msg = msg.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).digest()


def _volc_quote(value):
    return urllib.parse.quote(str(value), safe="-_.~")


def volc_sign(ak, sk, action, body_obj, region=None, service=None,
              version=None, host=None, now=None, token=None):
    """火山引擎签名 v4（visual.volcengineapi.com）。

    传入 token（临时凭证 / STS）时会附加 X-Security-Token 并纳入签名。
    返回 (url, headers, payload)，其中 headers 已含 Authorization。
    """
    ak = str(ak or "").strip()
    sk = str(sk or "").strip()
    if not ak or not sk:
        raise ValueError("缺少火山 AccessKey ID / Secret AccessKey，请先到设置里填好")
    action = str(action or "").strip()
    if not action:
        raise ValueError("缺少口型接口 Action")
    token = str(token or "").strip()
    host = str(host or VOLC_VISUAL_HOST).strip()
    region = str(region or VOLC_VISUAL_REGION).strip()
    service = str(service or VOLC_VISUAL_SERVICE).strip()
    version = str(version or VOLC_VISUAL_VERSION).strip()
    now = now or datetime.now(timezone.utc)
    x_date = now.strftime("%Y%m%dT%H%M%SZ")
    short_date = now.strftime("%Y%m%d")

    payload = json.dumps(body_obj or {}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    payload_hash = _volc_sha256(payload)

    query = [("Action", action), ("Version", version)]
    canonical_query = "&".join(
        "%s=%s" % (_volc_quote(k), _volc_quote(v)) for k, v in sorted(query)
    )
    header_lines = [
        "content-type:application/json",
        "host:%s" % host,
        "x-content-sha256:%s" % payload_hash,
        "x-date:%s" % x_date,
    ]
    signed_names = ["content-type", "host", "x-content-sha256", "x-date"]
    if token:
        header_lines.append("x-security-token:%s" % token)
        signed_names.append("x-security-token")
    header_lines.sort()
    signed_names.sort()
    canonical_headers = "\n".join(header_lines) + "\n"
    signed_headers = ";".join(signed_names)
    canonical_request = "\n".join([
        "POST", "/", canonical_query, canonical_headers, signed_headers, payload_hash,
    ])
    credential_scope = "%s/%s/%s/request" % (short_date, region, service)
    string_to_sign = "\n".join([
        "HMAC-SHA256", x_date, credential_scope, _volc_sha256(canonical_request),
    ])
    k_date = _volc_hmac(sk.encode("utf-8"), short_date)
    k_region = _volc_hmac(k_date, region)
    k_service = _volc_hmac(k_region, service)
    k_signing = _volc_hmac(k_service, "request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (
        "HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
        % (ak, credential_scope, signed_headers, signature)
    )
    url = "https://%s/?%s" % (host, canonical_query)
    headers = {
        "Content-Type": "application/json",
        "Host": host,
        "X-Date": x_date,
        "X-Content-Sha256": payload_hash,
        "Authorization": authorization,
    }
    if token:
        headers["X-Security-Token"] = token
    return url, headers, payload


def drama_visual(ak, sk, action, body, region=None, service=None,
                 version=None, timeout=60, token=None):
    """调用火山智能视觉接口，返回解析后的 JSON。"""
    body = body if isinstance(body, dict) else {}
    url, headers, payload = volc_sign(
        ak, sk, action, body, region=region, service=service, version=version, token=token
    )
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    raw = ""
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
    except urllib.error.URLError as exc:
        raise RuntimeError("连不上火山智能视觉，请检查网络：" + str(exc.reason))
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError("火山智能视觉返回异常：" + raw[:160])
    if isinstance(data, dict) and data.get("ResponseMetadata", {}).get("Error"):
        err = data["ResponseMetadata"]["Error"]
        msg = err.get("Message") or err.get("Code") or "调用失败"
        raise RuntimeError("火山智能视觉报错：" + str(msg))
    return data


def drama_compose(owner, project):
    if not shutil.which(DRAMA_FFMPEG):
        raise RuntimeError("服务器未安装 ffmpeg，请改用浏览器合成")
    shots = [s for s in (project.get("shots") or []) if isinstance(s, dict)]
    if not shots:
        raise ValueError("没有分镜")
    w, h = _drama_dims((project.get("output") or {}).get("ratio"))
    fps = int((project.get("output") or {}).get("fps") or 30)
    out_dir = _drama_out_dir(owner)
    work = out_dir / ("job" + secrets.token_hex(6))
    work.mkdir(parents=True, exist_ok=True)
    pid = re.sub(r"[^\w-]", "", str(project.get("id") or "drama"))[:40] or "drama"
    clips = []
    try:
        for i, sh in enumerate(shots):
            dur = max(1.0, float(sh.get("duration") or 3))
            window = None
            try:
                if sh.get("srcStart") is not None and sh.get("srcEnd") is not None:
                    s0 = float(sh.get("srcStart"))
                    s1 = float(sh.get("srcEnd"))
                    if s1 > s0 and s0 >= 0:
                        window = (s0, s1 - s0)
                        dur = max(1.0, float(window[1]))
            except (TypeError, ValueError):
                window = None
            src = sh.get("lipsyncUrl") or sh.get("videoUrl") or sh.get("imageUrl")
            if not src:
                raise ValueError("第 %d 镜没有可用画面" % (i + 1))
            ext = "mp4" if str(src).lower().split("?")[0].endswith((".mp4", ".mov", ".webm")) else "png"
            if str(src).startswith("data:video") or str(src).startswith("data:image/webp"):
                pass
            media = work / ("src%02d.%s" % (i, ext))
            _download_asset(src, media)
            audio = work / ("a%02d.mp3" % i)
            has_audio = False
            if sh.get("audioUrl"):
                try:
                    _download_asset(sh["audioUrl"], audio)
                    has_audio = True
                except ValueError:
                    has_audio = False
            clip = work / ("c%02d.mp4" % i)
            if media.suffix.lower() in (".mp4", ".mov", ".webm"):
                base = [DRAMA_FFMPEG, "-y"]
                if window:
                    base += ["-ss", "%.3f" % window[0]]
                base += ["-i", str(media)]
            else:
                base = [DRAMA_FFMPEG, "-y", "-loop", "1", "-t", "%.2f" % dur, "-i", str(media)]
            if has_audio:
                base += ["-i", str(audio)]
            else:
                base += ["-f", "lavfi", "-t", "%.2f" % dur, "-i", "anullsrc=r=44100:cl=stereo"]
            vf = (
                "scale=%d:%d:force_original_aspect_ratio=decrease,"
                "pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=%d,format=yuv420p"
                % (w, h, w, h, fps)
            )
            cmd = base + [
                "-vf", vf,
                "-t", "%.2f" % dur,
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                "-shortest", "-movflags", "+faststart",
                str(clip),
            ]
            r = _ff_run(cmd)
            if r.returncode != 0 or not clip.is_file():
                raise RuntimeError("第 %d 镜合成失败" % (i + 1))
            clips.append(clip)

        listfile = work / "list.txt"
        listfile.write_text(
            "".join("file '%s'\n" % c.name for c in clips), encoding="utf-8"
        )
        merged = work / "merged.mp4"
        r = _ff_run(
            [DRAMA_FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
             "-c", "copy", str(merged)]
        )
        if r.returncode != 0 or not merged.is_file():
            raise RuntimeError("拼接失败")

        final = out_dir / (pid + "-" + secrets.token_hex(3) + ".mp4")
        font = _drama_font()
        filters = []
        srt = _drama_srt(shots, bool((project.get("subtitle") or {}).get("bilingual")))
        if srt:
            srt_file = work / "sub.srt"
            srt_file.write_text(srt, encoding="utf-8")
            filters.append(
                "subtitles='%s':force_style='FontSize=16,PrimaryColour=&H00FFFFFF,"
                "OutlineColour=&H80000000,BorderStyle=1,Outline=2'" % str(srt_file).replace(":", "\\:")
            )
        if font:
            filters.append(
                "drawtext=fontfile='%s':text='AI 生成':fontcolor=white@0.85:"
                "fontsize=%d:box=1:boxcolor=black@0.45:boxborderw=6:"
                "x=w-tw-%d:y=h-th-%d" % (font.replace(":", "\\:"), max(16, h // 40), w // 40, h // 40)
            )
        if filters:
            r = _ff_run(
                [DRAMA_FFMPEG, "-y", "-i", str(merged), "-vf", ",".join(filters),
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                 "-c:a", "copy", "-movflags", "+faststart", str(final)]
            )
            if r.returncode != 0 or not final.is_file():
                shutil.copyfile(str(merged), str(final))
        else:
            shutil.copyfile(str(merged), str(final))
        return {
            "file": final.name,
            "url": "/dian/api/drama/out/" + final.name,
            "shots": len(shots),
        }
    finally:
        shutil.rmtree(str(work), ignore_errors=True)


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000
    )
    return salt, digest.hex()


def check_password(password, salt, hashed):
    if not salt or not hashed:
        return False
    _salt, got = hash_password(password, salt)
    return hmac.compare_digest(got, hashed)


def cookie_header(sid, clear=False):
    cookie = SimpleCookie()
    cookie[COOKIE_NAME] = "" if clear else sid
    morsel = cookie[COOKIE_NAME]
    morsel["path"] = "/dian/"
    morsel["httponly"] = True
    if clear:
        morsel["max-age"] = "0"
        morsel["expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
    else:
        morsel["max-age"] = str(SESSION_DAYS * 24 * 3600)
    return cookie.output(header="").strip() + "; SameSite=Lax"


def public_user(name, rec, quota):
    role = rec.get("role", "friend")
    if role == "owner":
        limit = 0
        used = 0
    else:
        limit = int(rec.get("limit", FRIEND_DAILY_LIMIT))
        used = int(quota.get(today_key(), {}).get(name, 0))
    workspace = str(SHOP_DIR) if role == "owner" else str(ROOM_ROOT / name)
    return {
        "ok": True,
        "name": name,
        "role": role,
        "used": used,
        "limit": limit,
        "workspace": workspace,
        "canEditShop": role == "owner",
        "canClerk": True,
    }


def upsert_user(name, password, role="friend", limit=FRIEND_DAILY_LIMIT):
    ensure_data()
    with _lock:
        users = load_json("users.json")
        salt, hashed = hash_password(password)
        rec = {"role": role, "salt": salt, "hash": hashed}
        if role != "owner":
            rec["limit"] = int(limit)
        users[name] = rec
        save_json("users.json", users)
        return rec


def set_friend_password(password):
    ensure_data()
    with _lock:
        salt, hashed = hash_password(password)
        save_json("friend.json", {"salt": salt, "hash": hashed})


def valid_friend_name(name):
    if not name or not NAME_OK.match(name):
        return False
    if name.lower() in RESERVED_NAMES:
        return False
    return True


class Handler(BaseHTTPRequestHandler):
    server_version = "xiaolongxia-gate/1"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (now().isoformat(), fmt % args), flush=True)

    def _send(self, code, body, content_type="text/html; charset=utf-8", extra=None, raw=False):
        if not raw and not isinstance(body, bytes):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        extra = extra or []
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code, obj, extra=None):
        self._send(
            code,
            json.dumps(obj, ensure_ascii=False),
            "application/json; charset=utf-8",
            extra,
        )

    def _login_page(self, code=200, extra=None):
        html = (GATE_DIR / "login.html").read_text(encoding="utf-8")
        self._send(code, html, extra=extra)

    def _read_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return b""
        return self.rfile.read(n)

    def _sid(self):
        raw = self.headers.get("Cookie") or ""
        cookie = SimpleCookie()
        try:
            cookie.load(raw)
        except Exception:
            return ""
        if COOKIE_NAME not in cookie:
            return ""
        return cookie[COOKIE_NAME].value

    def _current(self):
        sid = self._sid()
        if not sid:
            return None
        with _lock:
            sessions = load_json("sessions.json")
            rec = sessions.get(sid)
            if not rec:
                return None
            try:
                exp = float(rec.get("exp") or 0)
            except (TypeError, ValueError):
                exp = 0
            if exp < time.time():
                sessions.pop(sid, None)
                save_json("sessions.json", sessions)
                return None
            users = load_json("users.json")
            name = rec.get("name")
            user = users.get(name)
            if not user:
                role = rec.get("role") or "friend"
                if role == "owner":
                    return None
                user = {"role": "friend", "limit": FRIEND_DAILY_LIMIT}
            return {"sid": sid, "name": name, "user": user}

    def _safe_shop_path(self, rel):
        rel = rel.lstrip("/")
        if not rel:
            rel = "index.html"
        parts = rel.split("/")
        if ".." in parts:
            return None
        target = (SHOP_DIR / rel).resolve()
        try:
            target.relative_to(SHOP_DIR.resolve())
        except ValueError:
            return None
        return target

    def _inject_index(self, html, me):
        user_json = json.dumps(
            {"name": me["name"], "role": me["user"].get("role", "friend")},
            ensure_ascii=False,
        )
        inject = (
            "<script>window.__xlxUser=" + user_json + ";</script>"
            '<script src="/dian/gate-inject.js"></script>'
        )
        marker = "<head>"
        i = html.lower().find(marker)
        if i >= 0:
            at = i + len(marker)
            return html[:at] + inject + html[at:]
        return inject + html

    def _shop_file(self, rel, me):
        path = self._safe_shop_path(rel)
        if path is None:
            self._send(404, "not found")
            return
        if path.is_dir():
            path = path / "index.html"
        if not path.is_file():
            self._send(404, "not found")
            return
        data = path.read_bytes()
        ctype = STATIC_TYPES.get(path.suffix.lower(), "application/octet-stream")
        extra = [("X-Accel-Buffering", "no")]
        if path.name == "index.html":
            html = data.decode("utf-8")
            html = self._inject_index(html, me)
            html = html.replace(
                'navigator.serviceWorker.register("./sw.js").catch(() => {});',
                'if (!window.__xlxSkipSW) navigator.serviceWorker.register("./sw.js").catch(() => {});',
            )
            self._send(200, html, "text/html; charset=utf-8", extra)
            return
        self._send(200, data, ctype, extra, raw=True)

    def _route(self):
        parsed = urlparse(self.path)
        path = parsed.path or "/"
        if path.startswith("/dian"):
            path = path[5:] or "/"
        if not path.startswith("/"):
            path = "/" + path
        return path

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = self._route()
        if path == "/api/me":
            me = self._current()
            if not me:
                self._json(401, {"ok": False, "error": "未登录"})
                return
            with _lock:
                quota = load_json("quota.json")
            self._json(200, public_user(me["name"], me["user"], quota))
            return
        if path == "/api/invite":
            self._handle_get_invite()
            return
        if path == "/api/clerk/models":
            self._handle_clerk_models()
            return
        if path == "/api/shuoming":
            self._handle_shuoming()
            return
        if path in ("/", "/index.html", "/login", "/login.html"):
            me = self._current()
            if not me:
                self._login_page()
                return
            self._shop_file("index.html", me)
            return
        if path == "/gate-inject.js":
            me = self._current()
            if not me:
                self._send(401, "unauthorized")
                return
            js = (GATE_DIR / "inject.js").read_text(encoding="utf-8")
            self._send(200, js, "application/javascript; charset=utf-8")
            return
        if path.startswith("/pub/"):
            self._handle_drama_pub(path[len("/pub/"):])
            return
        me = self._current()
        if not me:
            if path.startswith("/api/"):
                self._json(401, {"ok": False, "error": "未登录"})
                return
            self._login_page()
            return
        if path == "/api/search":
            self._handle_search()
            return
        if path == "/api/fetch":
            self._handle_fetch()
            return
        if path == "/api/drama/projects":
            self._handle_drama_projects_list()
            return
        if path.startswith("/api/drama/projects/"):
            self._handle_drama_project_get(path[len("/api/drama/projects/"):])
            return
        if path == "/api/drama/publishes":
            self._handle_drama_publishes_list()
            return
        if path.startswith("/api/drama/out/"):
            self._handle_drama_out(path[len("/api/drama/out/"):])
            return
        if path.startswith("/api/"):
            self._json(404, {"ok": False, "error": "没有这个接口"})
            return
        self._shop_file(path.lstrip("/"), me)

    def do_POST(self):
        path = self._route()
        if path in ("/login", "/api/login"):
            self._handle_login()
            return
        if path == "/api/register":
            self._handle_register()
            return
        if path == "/api/invite/rotate":
            self._handle_rotate_invite()
            return
        if path == "/api/logout":
            sid = self._sid()
            extra = [("Set-Cookie", cookie_header("", clear=True))]
            if sid:
                with _lock:
                    sessions = load_json("sessions.json")
                    sessions.pop(sid, None)
                    save_json("sessions.json", sessions)
            self._json(200, {"ok": True}, extra)
            return
        if path == "/api/quota/consume":
            self._handle_consume()
            return
        if path == "/api/users":
            self._handle_create_user()
            return
        if path == "/api/clerk/chat":
            self._handle_clerk_chat()
            return
        if path == "/api/clerk/new":
            self._handle_clerk_new()
            return
        if path == "/api/publish":
            self._handle_publish()
            return
        if path == "/api/drama/projects":
            self._handle_drama_project_save()
            return
        if path == "/api/drama/projects/delete":
            self._handle_drama_project_delete()
            return
        if path == "/api/drama/publishes":
            self._handle_drama_publish()
            return
        if path == "/api/drama/compose":
            self._handle_drama_compose()
            return
        if path == "/api/drama/tts":
            self._handle_drama_tts()
            return
        if path == "/api/drama/visual":
            self._handle_drama_visual()
            return
        if path == "/api/drama/asset":
            self._handle_drama_asset()
            return
        self._json(404, {"ok": False, "error": "没有这个接口"})

    def _handle_consume(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        with _lock:
            users = load_json("users.json")
            rec = users.get(me["name"]) or {}
            quota = load_json("quota.json")
            day = today_key()
            day_map = quota.setdefault(day, {})
            if rec.get("role") == "owner":
                out = public_user(me["name"], rec, quota)
                self._json(200, out)
                return
            limit = int(rec.get("limit", FRIEND_DAILY_LIMIT))
            used = int(day_map.get(me["name"], 0))
            if used >= limit:
                self._json(
                    429,
                    {
                        "ok": False,
                        "error": "今日次数已用完，明日再来或联系主人",
                        "used": used,
                        "limit": limit,
                    },
                )
                return
            day_map[me["name"]] = used + 1
            save_json("quota.json", quota)
            self._json(200, public_user(me["name"], rec, quota))

    def _issue_session(self, username, rec):
        sid = secrets.token_urlsafe(32)
        with _lock:
            sessions = load_json("sessions.json")
            sessions[sid] = {
                "name": username,
                "role": rec.get("role", "friend"),
                "exp": time.time() + SESSION_DAYS * 24 * 3600,
            }
            save_json("sessions.json", sessions)
            quota = load_json("quota.json")
        extra = [("Set-Cookie", cookie_header(sid))]
        return extra, public_user(username, rec, quota)

    def _handle_get_invite(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        if me["user"].get("role") != "owner":
            self._json(403, {"ok": False, "error": "只有主人能看邀请码"})
            return
        self._json(200, {"ok": True, "code": current_invite()})

    def _handle_rotate_invite(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        if me["user"].get("role") != "owner":
            self._json(403, {"ok": False, "error": "只有主人能换邀请码"})
            return
        self._json(200, {"ok": True, "code": rotate_invite()})

    def _handle_register(self):
        if self._current():
            self._json(400, {"ok": False, "error": "已登录，请先退出"})
            return
        raw = self._read_body()
        try:
            obj = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            obj = {}
        name = str(obj.get("username") or "").strip()
        password = str(obj.get("password") or "")
        password2 = str(obj.get("password2") or "")
        invite = str(obj.get("invite") or "")
        if not invite_ok(invite):
            self._json(401, {"ok": False, "error": "邀请码不对"})
            return
        if not valid_friend_name(name):
            self._json(400, {"ok": False, "error": "名字不合规"})
            return
        if len(password) < 4:
            self._json(400, {"ok": False, "error": "口令太短"})
            return
        if password != password2:
            self._json(400, {"ok": False, "error": "两次口令不一致"})
            return
        with _lock:
            users = load_json("users.json")
            if name in users:
                self._json(400, {"ok": False, "error": "换一个账号"})
                return
        rec = upsert_user(name, password, role="friend", limit=FRIEND_DAILY_LIMIT)
        ensure_room(name)
        extra, out = self._issue_session(name, rec)
        self._json(200, out, extra)

    def _drama_me(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return None
        return me

    def _drama_body(self):
        raw = self._read_body()
        if len(raw) > DRAMA_MAX_BYTES + 1024 * 1024:
            return None
        try:
            obj = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return None
        return obj if isinstance(obj, dict) else None

    def _handle_drama_projects_list(self):
        me = self._drama_me()
        if not me:
            return
        try:
            self._json(200, {"ok": True, "projects": drama_list(me["name"])})
        except Exception:
            self._json(500, {"ok": False, "error": "读取工程列表失败"})

    def _handle_drama_project_get(self, pid):
        me = self._drama_me()
        if not me:
            return
        project = drama_get(me["name"], unquote_to_bytes(pid).decode("utf-8", "ignore"))
        if not project:
            self._json(404, {"ok": False, "error": "找不到这个工程"})
            return
        self._json(200, {"ok": True, "project": project})

    def _handle_drama_project_save(self):
        me = self._drama_me()
        if not me:
            return
        obj = self._drama_body()
        if not obj or not isinstance(obj.get("project"), dict):
            self._json(400, {"ok": False, "error": "工程内容读不懂"})
            return
        try:
            out = drama_save(me["name"], obj["project"])
        except ValueError as exc:
            self._json(400, {"ok": False, "error": str(exc)})
            return
        except Exception:
            self._json(500, {"ok": False, "error": "保存失败，稍后再试"})
            return
        self._json(200, {"ok": True, "saved": out})

    def _handle_drama_project_delete(self):
        me = self._drama_me()
        if not me:
            return
        obj = self._drama_body() or {}
        pid = str(obj.get("id") or "").strip()
        if not pid:
            self._json(400, {"ok": False, "error": "缺少工程 ID"})
            return
        try:
            ok = drama_delete(me["name"], pid)
        except Exception:
            self._json(500, {"ok": False, "error": "删除失败"})
            return
        self._json(200, {"ok": True, "deleted": bool(ok)})

    def _handle_drama_publishes_list(self):
        me = self._drama_me()
        if not me:
            return
        try:
            self._json(200, {"ok": True, "publishes": drama_list_publishes(me["name"])})
        except Exception:
            self._json(500, {"ok": False, "error": "读取发布记录失败"})

    def _handle_drama_publish(self):
        me = self._drama_me()
        if not me:
            return
        obj = self._drama_body()
        if not obj or not isinstance(obj.get("record"), dict):
            self._json(400, {"ok": False, "error": "记录读不懂"})
            return
        ip = self.client_address[0] if self.client_address else ""
        ip_hash = hashlib.sha256(("xlx" + ip).encode("utf-8")).hexdigest()[:32]
        try:
            out = drama_add_publish(me["name"], obj["record"], ip_hash)
        except Exception:
            self._json(500, {"ok": False, "error": "留档失败"})
            return
        self._json(200, {"ok": True, "publish": out})

    def _handle_drama_compose(self):
        me = self._drama_me()
        if not me:
            return
        obj = self._drama_body()
        if not obj or not isinstance(obj.get("project"), dict):
            self._json(400, {"ok": False, "error": "工程内容读不懂"})
            return
        try:
            out = drama_compose(me["name"], obj["project"])
        except ValueError as exc:
            self._json(400, {"ok": False, "error": str(exc)})
            return
        except RuntimeError as exc:
            self._json(501, {"ok": False, "error": str(exc)})
            return
        except subprocess.TimeoutExpired:
            self._json(504, {"ok": False, "error": "合成超时，请减少镜头或用浏览器合成"})
            return
        except Exception:
            self._json(500, {"ok": False, "error": "合成失败，请稍后再试"})
            return
        self._json(200, {"ok": True, "output": out})

    def _handle_drama_tts(self):
        me = self._drama_me()
        if not me:
            return
        obj = self._drama_body()
        if not obj:
            self._json(400, {"ok": False, "error": "请求读不懂"})
            return
        try:
            audio = drama_tts(
                obj.get("key"),
                obj.get("resource"),
                obj.get("text"),
                obj.get("speaker"),
                obj.get("speed"),
                obj.get("format"),
                obj.get("sampleRate"),
            )
        except ValueError as exc:
            self._json(400, {"ok": False, "error": str(exc)})
            return
        except RuntimeError as exc:
            self._json(502, {"ok": False, "error": str(exc)})
            return
        except Exception:
            self._json(502, {"ok": False, "error": "语音合成失败，请检查 Key 与网络"})
            return
        self._send(200, audio, "audio/mpeg", raw=True)

    def _handle_drama_visual(self):
        me = self._drama_me()
        if not me:
            return
        obj = self._drama_body()
        if not obj:
            self._json(400, {"ok": False, "error": "请求读不懂"})
            return
        try:
            data = drama_visual(
                obj.get("key"),
                obj.get("secret"),
                obj.get("action"),
                obj.get("body"),
                obj.get("region"),
                obj.get("service"),
                obj.get("version"),
                token=obj.get("token"),
            )
        except ValueError as exc:
            self._json(400, {"ok": False, "error": str(exc)})
            return
        except RuntimeError as exc:
            self._json(502, {"ok": False, "error": str(exc)})
            return
        except Exception:
            self._json(502, {"ok": False, "error": "火山智能视觉调用失败，请检查 Key 与网络"})
            return
        self._json(200, {"ok": True, "data": data})

    # ---------- 火山数字人只收公网 URL：/dian/pub/<token>.<ext> 免登录只读 ----------
    def _public_base(self):
        if DRAMA_PUBLIC_BASE:
            return DRAMA_PUBLIC_BASE
        host = (self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "")
        host = host.split(",")[0].strip()
        if not host:
            return ""
        proto = (self.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip()
        if not proto:
            local = host.split(":")[0]
            proto = "http" if local in ("localhost", "0.0.0.0") or local.startswith("127.") else "https"
        return proto + "://" + host

    def _handle_drama_pub(self, name):
        name = unquote_to_bytes(name).decode("utf-8", "ignore")
        if not DRAMA_PUB_NAME.match(name or ""):
            self._json(404, {"ok": False, "error": "找不到素材"})
            return
        target = (DRAMA_PUB_DIR / name).resolve()
        try:
            target.relative_to(DRAMA_PUB_DIR.resolve())
        except ValueError:
            self._json(404, {"ok": False, "error": "找不到素材"})
            return
        if not target.is_file():
            self._json(404, {"ok": False, "error": "找不到素材"})
            return
        self._send(
            200,
            target.read_bytes(),
            STATIC_TYPES.get(target.suffix.lower(), "application/octet-stream"),
            raw=True,
        )

    def _handle_drama_asset(self):
        me = self._drama_me()
        if not me:
            return
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        ext = DRAMA_PUB_EXT.get(ctype)
        if not ext:
            self._json(400, {"ok": False, "error": "只支持图片/音频/视频素材"})
            return
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            self._json(400, {"ok": False, "error": "素材为空"})
            return
        if n > DRAMA_PUB_MAX:
            self._json(400, {"ok": False, "error": "素材超过 200MB"})
            return
        base = self._public_base()
        if not base:
            self._json(400, {"ok": False, "error": "拿不到公网地址，请配置 DRAMA_PUBLIC_BASE"})
            return
        raw = self.rfile.read(n)
        name = secrets.token_hex(16) + ext
        DRAMA_PUB_DIR.mkdir(parents=True, exist_ok=True)
        (DRAMA_PUB_DIR / name).write_bytes(raw)
        self._json(200, {"ok": True, "url": base + "/dian/pub/" + name, "name": name})

    def _handle_drama_out(self, name):
        me = self._drama_me()
        if not me:
            return
        name = unquote_to_bytes(name).decode("utf-8", "ignore")
        if not re.match(r"^[A-Za-z0-9_-]+\.(mp4|webm)$", name or ""):
            self._json(400, {"ok": False, "error": "文件名不合规"})
            return
        target = (_drama_out_dir(me["name"]) / name).resolve()
        try:
            target.relative_to(_drama_out_dir(me["name"]).resolve())
        except ValueError:
            self._json(400, {"ok": False, "error": "路径不合规"})
            return
        if not target.is_file():
            self._json(404, {"ok": False, "error": "找不到成片"})
            return
        data = target.read_bytes()
        self._send(
            200,
            data,
            "video/mp4" if target.suffix == ".mp4" else "video/webm",
            [("Content-Disposition", 'attachment; filename="' + name + '"')],
            raw=True,
        )

    def _handle_publish(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        slug = publish_slug(me["name"])
        if not slug:
            self._json(400, {"ok": False, "error": "账号不能用来上线"})
            return
        raw = self._read_body()
        try:
            obj = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "内容读不懂"})
            return
        files, err = validate_publish_files(obj.get("files"))
        if err:
            self._json(400, {"ok": False, "error": err})
            return
        try:
            write_publish(slug, files)
        except Exception:
            self._json(500, {"ok": False, "error": "稍后再试"})
            return
        url = PUBLISH_BASE.rstrip("/") + "/" + slug + "/"
        self._json(200, {"ok": True, "url": url, "name": slug})

    def _handle_create_user(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        if me["user"].get("role") != "owner":
            self._json(403, {"ok": False, "error": "只有主人能开号"})
            return
        raw = self._read_body()
        try:
            obj = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            obj = {}
        name = str(obj.get("username") or "").strip()
        password = str(obj.get("password") or "")
        if not valid_friend_name(name):
            self._json(400, {"ok": False, "error": "名字不合规"})
            return
        if len(password) < 4:
            self._json(400, {"ok": False, "error": "口令太短"})
            return
        rec = upsert_user(name, password, role="friend", limit=FRIEND_DAILY_LIMIT)
        ensure_room(name)
        with _lock:
            quota = load_json("quota.json")
        self._json(200, public_user(name, rec, quota))

    def _handle_clerk_models(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        self._json(200, {"ok": True, "brains": CLERK_BRAINS})

    def _handle_shuoming(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        shop = read_guide(SHOP_DIR / "shuoming" / "guide.md")
        mine = ""
        role = me["user"].get("role", "friend")
        if role != "owner":
            room = ensure_room(me["name"])
            if room:
                mine = read_guide(room / "shuoming" / "guide.md")
        self._json(200, {"ok": True, "shop": shop, "mine": mine})

    def _fetch_target_ok(self, url):
        """校验抓取目标：仅 http/https，且不得指向内网/本机（防 SSRF）。"""
        try:
            u = urlparse(url)
        except Exception:
            return False
        if u.scheme not in ("http", "https") or not u.hostname:
            return False
        port = u.port or (443 if u.scheme == "https" else 80)
        try:
            infos = socket.getaddrinfo(u.hostname, port, proto=socket.IPPROTO_TCP)
        except Exception:
            return False
        for info in infos:
            try:
                addr = ipaddress.ip_address(info[4][0])
            except ValueError:
                return False
            if (addr.is_private or addr.is_loopback or addr.is_link_local
                    or addr.is_reserved or addr.is_multicast or addr.is_unspecified):
                return False
        return True

    def _handle_fetch(self):
        """同源抓取代理：服务端取回目标页面文本，绕开浏览器 CORS 限制。"""
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        qs = parse_qs(urlparse(self.path).query)
        target = (qs.get("url") or [""])[0].strip()
        if not target:
            self._json(400, {"ok": False, "error": "缺少 url 参数"})
            return
        if not self._fetch_target_ok(target):
            self._json(400, {"ok": False, "error": "该链接不允许抓取"})
            return
        req = urllib.request.Request(
            target,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept": "*/*",
            },
        )
        limit = 12 * 1024 * 1024
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                ctype = resp.headers.get("Content-Type") or "application/octet-stream"
                raw = resp.read(limit + 1)
                if len(raw) > limit:
                    self._send(502, "目标文件过大")
                    return
        except Exception as e:
            self._send(502, "抓取失败：" + str(e)[:120])
            return
        # 原样回传字节并保留 Content-Type：图片等二进制资源也能正确下载
        self._send(200, raw, ctype, raw=True)

    def _handle_search(self):
        """同源聚合搜索：服务端抓取必应/360，返回统一 JSON 给前端。"""
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        qs = parse_qs(urlparse(self.path).query)
        q = (qs.get("q") or [""])[0].strip()
        if not q:
            self._json(400, {"ok": False, "error": "缺少 q 参数"})
            return
        engines = [e for e in (qs.get("engines") or [""])[0].split(",") if e]
        if not engines:
            engines = ["bing", "so360"]
        results, sources = [], []
        if "bing" in engines:
            try:
                r = scrape_bing(q, 8)
                if r:
                    results += r
                    sources.append("bing")
            except Exception:
                pass
        if "so360" in engines and len(results) < 12:
            try:
                r = scrape_360(q, 8)
                if r:
                    results += r
                    sources.append("so360")
            except Exception:
                pass
        self._json(200, {"ok": True, "q": q, "results": results[:12], "sources": sources})

    def _handle_clerk_new(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        payload = json.dumps({"user": me["name"]}).encode("utf-8")
        req = urllib.request.Request(
            CLERK_URL.replace("/api/chat", "/api/new"),
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                body = res.read()
            self._send(200, body, "application/json; charset=utf-8", raw=True)
        except Exception:
            self._json(502, {"ok": False, "error": "店员暂时没回上"})

    def _handle_clerk_chat(self):
        me = self._current()
        if not me:
            self._json(401, {"ok": False, "error": "未登录"})
            return
        raw = self._read_body()
        try:
            obj = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "内容读不懂"})
            return
        msg = str(obj.get("message") or "").strip()
        if not msg:
            self._json(400, {"ok": False, "error": "请输入内容"})
            return
        role = me["user"].get("role", "friend")
        if role == "owner":
            workspace = str(SHOP_DIR)
        else:
            room = ensure_room(me["name"])
            workspace = str(room)
        brain = str(obj.get("brain") or "").strip()
        if brain and brain not in ALLOWED_BRAINS:
            brain = "deepseek"
        model = str(obj.get("model") or "").strip()[:80]
        custom_base = str(obj.get("custom_base") or "").strip()[:200]
        payload = json.dumps(
            {
                "message": msg,
                "user": me["name"],
                "role": role,
                "workspace": workspace,
                "api_key": str(obj.get("api_key") or ""),
                "brain": brain,
                "model": model,
                "custom_base": custom_base,
            },
            ensure_ascii=False,
        ).encode("utf-8")
        req = urllib.request.Request(
            CLERK_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            method="POST",
        )
        try:
            res = urllib.request.urlopen(req, timeout=620)
        except urllib.error.HTTPError as e:
            body = e.read()
            self._send(e.code, body, "application/json; charset=utf-8", raw=True)
            return
        except Exception:
            self._json(502, {"ok": False, "error": "店员暂时没回上"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            while True:
                chunk = res.read(1024)
                if not chunk:
                    break
                self.wfile.write(chunk)
                try:
                    self.wfile.flush()
                except Exception:
                    break
        finally:
            try:
                res.close()
            except Exception:
                pass

    def _handle_login(self):
        raw = self._read_body()
        username = ""
        password = ""
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype == "application/json":
            try:
                obj = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                obj = {}
            username = str(obj.get("username") or "").strip()
            password = str(obj.get("password") or "")
        else:
            form = parse_qs(raw.decode("utf-8", "replace"), keep_blank_values=True)
            username = (form.get("username") or [""])[0].strip()
            password = (form.get("password") or [""])[0]
        with _lock:
            users = load_json("users.json")
            rec = users.get(username)
            ok = False
            if rec:
                ok = check_password(password, rec.get("salt", ""), rec.get("hash", ""))
            if not ok or rec is None:
                if ctype == "application/json":
                    self._json(401, {"ok": False, "error": "账号或口令不对"})
                else:
                    self._login_page(401)
                return
            sid = secrets.token_urlsafe(32)
            sessions = load_json("sessions.json")
            sessions[sid] = {
                "name": username,
                "role": rec.get("role", "friend"),
                "exp": time.time() + SESSION_DAYS * 24 * 3600,
            }
            save_json("sessions.json", sessions)
            extra = [("Set-Cookie", cookie_header(sid))]
            quota = load_json("quota.json")
        if ctype == "application/json":
            out = public_user(username, rec, quota)
            self._json(200, out, extra)
            return
        self.send_response(302)
        self.send_header("Location", "/dian/")
        self.send_header("Set-Cookie", cookie_header(sid))
        self.send_header("Content-Length", "0")
        self.end_headers()


def main():
    ensure_data()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print("xiaolongxia-gate listening on %s:%s" % (HOST, PORT), flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
