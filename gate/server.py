#!/usr/bin/python3
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import socketserver
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = os.environ.get("GATE_HOST", "127.0.0.1")
PORT = int(os.environ.get("GATE_PORT", "9140"))
SHOP_DIR = Path(os.environ.get("SHOP_DIR", "/home/admin/work/xiaolongxia-ai"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/home/admin/work/xiaolongxia-gate-data"))
ROOM_ROOT = Path(os.environ.get("ROOM_ROOT", "/home/admin/work/rooms"))
PUBLISH_ROOT = Path(os.environ.get("PUBLISH_ROOT", "/home/admin/work/zuopin"))
PUBLISH_BASE = os.environ.get("PUBLISH_BASE", "http://47.108.14.206/zuopin")
CLERK_URL = os.environ.get("CLERK_URL", "http://127.0.0.1:9130/api/chat")
GATE_DIR = Path(__file__).resolve().parent
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
    ".woff2": "font/woff2",
    ".bin": "application/octet-stream",
    ".onnx": "application/octet-stream",
}

_lock = threading.Lock()


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
        encoded = content.encode("utf-8")
        total += len(encoded)
        if total > PUBLISH_MAX_BYTES:
            return None, "体积太大，缩小后再上"
        out.append({"name": name, "content": content})
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
            (tmp / item["name"]).write_text(item["content"], encoding="utf-8")
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
            "这是 %s 的工作间。写的代码放这里，碰不到小龙虾店面。\n" % name,
            encoding="utf-8",
        )
    return room


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
        me = self._current()
        if not me:
            if path.startswith("/api/"):
                self._json(401, {"ok": False, "error": "未登录"})
                return
            self._login_page()
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
        payload = json.dumps(
            {
                "message": msg,
                "user": me["name"],
                "role": role,
                "workspace": workspace,
                "api_key": str(obj.get("api_key") or ""),
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
