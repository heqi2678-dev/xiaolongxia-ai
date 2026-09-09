#!/usr/bin/python3
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

os.environ["GATE_HOST"] = "127.0.0.1"
os.environ["GATE_PORT"] = "0"

HERE = Path(__file__).resolve().parent
SHOP = HERE.parent


class GateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmpdir = tempfile.TemporaryDirectory()
        os.environ["DATA_DIR"] = cls.tmpdir.name
        os.environ["SHOP_DIR"] = str(SHOP)
        os.environ["ROOM_ROOT"] = str(Path(cls.tmpdir.name) / "rooms")
        os.environ["PUBLISH_ROOT"] = str(Path(cls.tmpdir.name) / "zuopin")
        os.environ["PUBLISH_BASE"] = "http://47.108.14.206/zuopin"
        import importlib
        import server as gate_server
        importlib.reload(gate_server)
        cls.gate = gate_server
        gate_server.DATA_DIR = Path(cls.tmpdir.name)
        gate_server.SHOP_DIR = SHOP
        gate_server.ROOM_ROOT = Path(os.environ["ROOM_ROOT"])
        gate_server.PUBLISH_ROOT = Path(os.environ["PUBLISH_ROOT"])
        gate_server.ensure_data()
        gate_server.upsert_user("zhuren", "owner-pass", role="owner")
        gate_server.upsert_user("liyu", "friend-pass", role="friend")
        cls.httpd = gate_server.ThreadingHTTPServer(("127.0.0.1", 0), gate_server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.base = "http://127.0.0.1:%s" % cls.port
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.tmpdir.cleanup()

    def opener(self):
        jar = CookieJar()
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar

    def req(self, opener, path, method="GET", data=None, json_body=None, headers=None):
        body = None
        hdrs = headers or {}
        if json_body is not None:
            body = json.dumps(json_body).encode("utf-8")
            hdrs["Content-Type"] = "application/json"
        elif data is not None:
            body = data
        if not path.startswith("/dian"):
            path = "/dian" + path
        request = urllib.request.Request(self.base + path, data=body, headers=hdrs, method=method)
        try:
            with opener.open(request, timeout=5) as res:
                return res.getcode(), res.read(), dict(res.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), dict(e.headers)

    def test_anonymous_sees_login(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/")
        self.assertEqual(code, 200)
        self.assertIn("请输入账号".encode("utf-8"), body)
        self.assertIn("去注册".encode("utf-8"), body)
        code, body, _ = self.req(opener, "/index.html")
        self.assertIn("请输入账号".encode("utf-8"), body)

    def test_wrong_password(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "nope"})
        self.assertEqual(code, 401)
        self.assertIn("账号或口令不对", json.loads(body.decode("utf-8"))["error"])

    def test_owner_login_and_room_inject(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertEqual(data["role"], "owner")
        code, html, _ = self.req(opener, "/")
        self.assertEqual(code, 200)
        text = html.decode("utf-8")
        compact = text.replace(" ", "")
        self.assertTrue('__xlxUser={"name":"zhuren"' in compact or "__xlxUser={\"name\":\"zhuren\"" in text)
        self.assertIn("/dian/gate-inject.js", text)
        code, js, _ = self.req(opener, "/gate-inject.js")
        self.assertEqual(code, 200)
        js_text = js.decode("utf-8")
        self.assertIn('prefix = "u_" + user.name', js_text)
        self.assertIn("邀请码", js_text)
        self.assertNotIn("开号", js_text)

    def test_unknown_user_rejected(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "stranger", "password": "x"})
        self.assertEqual(code, 401)

    def test_friend_needs_own_account(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertEqual(data["role"], "friend")
        self.assertEqual(data["name"], "liyu")
        self.assertFalse(data.get("canEditShop"))
        code, html, _ = self.req(opener, "/")
        self.assertIn("liyu", html.decode("utf-8"))

    def test_unknown_name_rejected_even_with_any_pass(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "理与海", "password": "friend-pass"})
        self.assertEqual(code, 401)

    def test_owner_can_create_friend(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
        code, body, _ = self.req(opener, "/api/users", method="POST", json_body={"username": "xiaohai", "password": "abcd"})
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertEqual(data["name"], "xiaohai")
        self.assertEqual(data["role"], "friend")
        friend, _ = self.opener()
        code, body, _ = self.req(friend, "/api/login", method="POST", json_body={"username": "xiaohai", "password": "abcd"})
        self.assertEqual(code, 200)

    def test_friend_cannot_create_user(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, _, _ = self.req(opener, "/api/users", method="POST", json_body={"username": "hacker", "password": "abcd"})
        self.assertEqual(code, 403)

    def test_reserved_name_rejected(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "admin", "password": "friend-pass"})
        self.assertEqual(code, 401)

    def test_friend_quota_101st_rejected(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        self.assertEqual(code, 200)
        last = None
        for i in range(100):
            code, body, _ = self.req(opener, "/api/quota/consume", method="POST", json_body={})
            self.assertEqual(code, 200, "fail at %s: %s" % (i + 1, body))
            last = json.loads(body.decode("utf-8"))
        self.assertEqual(last["used"], 100)
        code, body, _ = self.req(opener, "/api/quota/consume", method="POST", json_body={})
        self.assertEqual(code, 429)
        self.assertFalse(json.loads(body.decode("utf-8"))["ok"])

    def test_owner_quota_always_ok(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
        for _ in range(3):
            code, body, _ = self.req(opener, "/api/quota/consume", method="POST", json_body={})
            self.assertEqual(code, 200)
            self.assertTrue(json.loads(body.decode("utf-8"))["ok"])

    def test_logout_returns_login(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
        code, _, _ = self.req(opener, "/api/logout", method="POST", json_body={})
        self.assertEqual(code, 200)
        code, body, _ = self.req(opener, "/")
        self.assertIn("请输入账号".encode("utf-8"), body)

    def test_register_wrong_invite(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/api/register", method="POST", json_body={
            "username": "newone", "password": "abcd", "password2": "abcd", "invite": "WRONG"
        })
        self.assertEqual(code, 401)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "邀请码不对")

    def test_register_success_and_login(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/api/register", method="POST", json_body={
            "username": "haike", "password": "abcd", "password2": "abcd", "invite": self.gate.current_invite()
        })
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertEqual(data["name"], "haike")
        self.assertEqual(data["role"], "friend")
        self.assertFalse(data.get("canEditShop"))
        code, html, _ = self.req(opener, "/")
        self.assertIn("haike", html.decode("utf-8"))
        other, _ = self.opener()
        code, _, _ = self.req(other, "/api/login", method="POST", json_body={"username": "haike", "password": "abcd"})
        self.assertEqual(code, 200)

    def test_register_taken_and_mismatch_and_reserved(self):
        opener, _ = self.opener()
        invite = self.gate.current_invite()
        code, body, _ = self.req(opener, "/api/register", method="POST", json_body={
            "username": "liyu", "password": "abcd", "password2": "abcd", "invite": invite
        })
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "换一个账号")
        code, body, _ = self.req(opener, "/api/register", method="POST", json_body={
            "username": "fresh", "password": "abcd", "password2": "abce", "invite": invite
        })
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "两次口令不一致")
        code, body, _ = self.req(opener, "/api/register", method="POST", json_body={
            "username": "admin", "password": "abcd", "password2": "abcd", "invite": invite
        })
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "名字不合规")

    def test_friend_cannot_see_invite(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, _, _ = self.req(opener, "/api/invite")
        self.assertEqual(code, 403)
        code, _, _ = self.req(opener, "/api/invite/rotate", method="POST", json_body={})
        self.assertEqual(code, 403)

    def test_owner_invite_and_rotate(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
        code, body, _ = self.req(opener, "/api/invite")
        self.assertEqual(code, 200)
        old = json.loads(body.decode("utf-8"))["code"]
        self.assertTrue(old)
        code, body, _ = self.req(opener, "/api/invite/rotate", method="POST", json_body={})
        self.assertEqual(code, 200)
        new = json.loads(body.decode("utf-8"))["code"]
        self.assertTrue(new)
        self.assertNotEqual(old, new)
        guest, _ = self.opener()
        code, _, _ = self.req(guest, "/api/register", method="POST", json_body={
            "username": "afterold", "password": "abcd", "password2": "abcd", "invite": old
        })
        self.assertEqual(code, 401)
        code, _, _ = self.req(guest, "/api/register", method="POST", json_body={
            "username": "afternew", "password": "abcd", "password2": "abcd", "invite": new
        })
        self.assertEqual(code, 200)

    def test_publish_requires_login(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/publish", method="POST", json_body={
            "files": [{"name": "index.html", "content": "<h1>hi</h1>"}]
        })
        self.assertEqual(code, 401)

    def test_publish_success_and_overwrite(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/publish", method="POST", json_body={
            "files": [
                {"name": "index.html", "content": "<h1>v1</h1>"},
                {"name": "style.css", "content": "body{color:red}"},
            ]
        })
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertTrue(data["ok"])
        self.assertIn("/zuopin/liyu/", data["url"])
        dest = self.gate.PUBLISH_ROOT / "liyu"
        self.assertEqual((dest / "index.html").read_text(encoding="utf-8"), "<h1>v1</h1>")
        self.assertTrue((dest / "style.css").exists())
        code, _, _ = self.req(opener, "/api/publish", method="POST", json_body={
            "files": [{"name": "index.html", "content": "<h1>v2</h1>"}]
        })
        self.assertEqual(code, 200)
        self.assertEqual((dest / "index.html").read_text(encoding="utf-8"), "<h1>v2</h1>")
        self.assertFalse((dest / "style.css").exists())

    def test_publish_rejects_bad_files(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/publish", method="POST", json_body={
            "files": [{"name": "app.js", "content": "1"}]
        })
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "先做出网页")
        code, body, _ = self.req(opener, "/api/publish", method="POST", json_body={
            "files": [{"name": "../index.html", "content": "x"}]
        })
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "去掉路径字符")
        too_many = [{"name": "index.html", "content": "<h1>x</h1>"}]
        too_many.extend({"name": "f%s.css" % i, "content": "a"} for i in range(30))
        code, body, _ = self.req(opener, "/api/publish", method="POST", json_body={"files": too_many})
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(body.decode("utf-8"))["error"], "文件太多，最多 30 个")
        other = self.gate.PUBLISH_ROOT / "zhuren" / "index.html"
        other.parent.mkdir(parents=True, exist_ok=True)
        other.write_text("owner", encoding="utf-8")
        self.req(opener, "/api/publish", method="POST", json_body={
            "files": [{"name": "index.html", "content": "<h1>liyu</h1>"}]
        })
        self.assertEqual(other.read_text(encoding="utf-8"), "owner")

    def test_clerk_models_requires_login(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/clerk/models")
        self.assertEqual(code, 401)

    def test_clerk_models_lists_brains(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/clerk/models")
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        ids = [b["id"] for b in data["brains"]]
        self.assertEqual(ids, ["deepseek", "qwen", "doubao", "custom"])

    def test_clerk_chat_forwards_brain(self):
        from http.server import BaseHTTPRequestHandler, HTTPServer
        captured = {}

        class MockClerk(BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):
                return

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                captured["body"] = json.loads(self.rfile.read(n).decode("utf-8"))
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                self.wfile.write(b'data: {"t":"say","s":"ok"}\n\n')

        mock = HTTPServer(("127.0.0.1", 0), MockClerk)
        port = mock.server_address[1]
        th = threading.Thread(target=mock.handle_request)
        th.daemon = True
        th.start()
        old = self.gate.CLERK_URL
        self.gate.CLERK_URL = "http://127.0.0.1:%s/api/chat" % port
        try:
            opener, _ = self.opener()
            self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
            code, body, _ = self.req(opener, "/api/clerk/chat", method="POST", json_body={
                "message": "hi",
                "api_key": "sk-friend",
                "brain": "qwen",
                "model": "qwen-plus",
                "custom_base": "",
            })
            self.assertEqual(code, 200)
            self.assertEqual(captured["body"]["brain"], "qwen")
            self.assertEqual(captured["body"]["model"], "qwen-plus")
            self.assertEqual(captured["body"]["api_key"], "sk-friend")
            self.assertEqual(captured["body"]["role"], "friend")
            self.assertIn("/rooms/liyu", captured["body"]["workspace"].replace("\\", "/"))
        finally:
            self.gate.CLERK_URL = old
            th.join(timeout=2)

    def test_shuoming_requires_login(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/shuoming")
        self.assertEqual(code, 401)

    def test_friend_sees_shop_and_own_room_guide(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/shuoming")
        self.assertEqual(code, 200)
        data = json.loads(body.decode("utf-8"))
        self.assertTrue(data["ok"])
        self.assertIn("小龙虾店说明书", data["shop"])
        self.assertIn("liyu 的房间说明书", data["mine"])
        other = self.gate.ROOM_ROOT / "haike" / "shuoming" / "guide.md"
        other.parent.mkdir(parents=True, exist_ok=True)
        other.write_text("secret-haike", encoding="utf-8")
        code, body, _ = self.req(opener, "/api/shuoming")
        data = json.loads(body.decode("utf-8"))
        self.assertNotIn("secret-haike", data["mine"])

    def test_new_room_gets_guide(self):
        room = self.gate.ensure_room("liyu")
        self.assertTrue((room / "shuoming" / "guide.md").exists())


if __name__ == "__main__":
    unittest.main()
