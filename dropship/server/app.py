#!/usr/bin/python3
"""铺货后端服务入口。

组织 AppContext（配置/存储/适配器/授权/队列）并起一个标准库 HTTP 服务，
同时后台线程消费发布队列。可独立运行：python3 -m dropship.server.app
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

try:
    from http.server import ThreadingHTTPServer
except ImportError:  # Python 3.6 无 ThreadingHTTPServer
    import socketserver

    class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
        daemon_threads = True

from . import api
from .adapters import build_adapters
from .auth import AuthCenter
from .config import load_config, ensure_dirs
from .db import Store
from .queue import PublishQueue
from .storage import ImageStore


class AppContext:
    def __init__(self, cfg):
        self.cfg = ensure_dirs(cfg)
        self.store = Store(cfg["db_path"])
        self.adapters = build_adapters(dry_run=cfg.get("dry_run", True))
        self.auth = AuthCenter(self.store, dry_run=cfg.get("dry_run", True))
        self.images = ImageStore(cfg["images_dir"])
        self.queue = PublishQueue(
            self.store,
            self.adapters,
            self.auth,
            max_retries=cfg.get("max_retries", 3),
            rate_per_min=cfg.get("rate_per_min", 30),
            app_creds=cfg.get("app_creds"),
        )


def make_handler(ctx):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "XlxDropship/0.1"

        def _read_body(self):
            length = int(self.headers.get("Content-Length") or 0)
            if not length:
                return {}
            raw = self.rfile.read(length)
            try:
                return json.loads(raw.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return {}

        def _respond(self, status, payload):
            if isinstance(payload, dict) and "__bytes__" in payload:
                body = payload["__bytes__"]
                ctype = payload.get("contentType", "application/octet-stream")
            else:
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                ctype = "application/json; charset=utf-8"
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _dispatch(self, method):
            parsed = urlparse(self.path)
            query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            body = self._read_body() if method in ("POST", "PUT") else {}
            headers = {k: v for k, v in self.headers.items()}
            try:
                status, payload = api.handle(ctx, method, parsed.path, query, body, headers)
            except Exception as exc:  # 兜底，避免线程崩溃
                status, payload = 500, {"error": "内部错误: %s" % exc}
            self._respond(status, payload)

        def do_GET(self):
            self._dispatch("GET")

        def do_POST(self):
            self._dispatch("POST")

        def do_PUT(self):
            self._dispatch("PUT")

        def do_DELETE(self):
            self._dispatch("DELETE")

        def log_message(self, fmt, *args):
            return

    return Handler


def create_server(ctx, host="127.0.0.1", port=9150):
    server = ThreadingHTTPServer((host, port), make_handler(ctx))
    return server


def start_worker(ctx, stop_event, idle=1.0):
    thread = threading.Thread(target=ctx.queue.run_forever, args=(stop_event, idle), daemon=True)
    thread.start()
    return thread


def main():
    cfg = load_config()
    ctx = AppContext(cfg)
    stop_event = threading.Event()
    start_worker(ctx, stop_event)
    server = create_server(ctx, cfg["host"], cfg["port"])
    print("dropship gate on http://%s:%s" % (cfg["host"], cfg["port"]))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        server.server_close()


if __name__ == "__main__":
    main()
