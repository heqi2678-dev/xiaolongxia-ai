#!/usr/bin/python3
import base64
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
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
        self.assertIn("铜龙电商 · 店说明书", data["shop"])
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

    def _drama_project(self, pid="x-proj-crud"):
        return {
            "id": pid,
            "title": "外卖小哥逆袭",
            "genre": "comic",
            "engine": "image",
            "script": {"logline": "小人物翻盘", "outline": "", "scenes": []},
            "characters": [
                {"id": "c1", "name": "阿强", "identity": "外卖员", "appearance": "短发", "refImages": [], "locked": True}
            ],
            "shots": [
                {"id": "s1", "seq": 1, "prompt": "街头奔跑", "line": "今天必须送到", "roleIds": ["c1"],
                 "duration": 5, "motion": "zoom-in", "imageUrl": "https://x/a.png",
                 "videoUrl": "", "audioUrl": "", "lipsyncUrl": "", "status": "done", "error": ""}
            ],
            "style": "cn-manhua",
            "subtitle": {"enabled": True, "font": "default", "color": "#fff", "stroke": "#000"},
            "bgm": "",
            "output": {"ratio": "9:16", "resolution": "1080p", "fps": 30},
            "compliance": {"aigcMarked": True, "consentIds": []},
            "createdAt": 1,
            "updatedAt": 1,
        }

    def test_drama_requires_login(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/drama/projects")
        self.assertEqual(code, 401)

    def test_drama_project_crud(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        pid = "x-proj-crud"
        code, body, _ = self.req(opener, "/api/drama/projects", method="POST", json_body={"project": self._drama_project(pid)})
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(body.decode("utf-8"))["ok"])
        code, body, _ = self.req(opener, "/api/drama/projects")
        self.assertEqual(code, 200)
        ids = [p["id"] for p in json.loads(body.decode("utf-8"))["projects"]]
        self.assertIn(pid, ids)
        code, body, _ = self.req(opener, "/api/drama/projects/" + pid)
        self.assertEqual(code, 200)
        got = json.loads(body.decode("utf-8"))["project"]
        self.assertEqual(got["title"], "外卖小哥逆袭")
        self.assertEqual(len(got["shots"]), 1)
        self.assertEqual(got["shots"][0]["line"], "今天必须送到")
        code, body, _ = self.req(opener, "/api/drama/projects/delete", method="POST", json_body={"id": pid})
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(body.decode("utf-8"))["deleted"])
        code, _, _ = self.req(opener, "/api/drama/projects/" + pid)
        self.assertEqual(code, 404)

    def test_drama_project_isolation(self):
        owner_opener, _ = self.opener()
        self.req(owner_opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
        friend_opener, _ = self.opener()
        self.req(friend_opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        pid = "x-proj-private"
        code, _, _ = self.req(friend_opener, "/api/drama/projects", method="POST", json_body={"project": self._drama_project(pid)})
        self.assertEqual(code, 200)
        code, _, _ = self.req(owner_opener, "/api/drama/projects/" + pid)
        self.assertEqual(code, 404)
        code, body, _ = self.req(owner_opener, "/api/drama/projects/delete", method="POST", json_body={"id": pid})
        self.assertEqual(code, 200)
        self.assertFalse(json.loads(body.decode("utf-8"))["deleted"])
        code, body, _ = self.req(owner_opener, "/api/drama/projects", method="POST", json_body={"project": self._drama_project(pid)})
        self.assertEqual(code, 400)

    def test_drama_project_rejects_bad_payload(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, _, _ = self.req(opener, "/api/drama/projects", method="POST", json_body={"nope": 1})
        self.assertEqual(code, 400)
        bad = self._drama_project("y" * 200)
        code, _, _ = self.req(opener, "/api/drama/projects", method="POST", json_body={"project": bad})
        self.assertEqual(code, 400)

    def test_blender_token_scenes_import_download(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/drama/blender/token", method="POST")
        self.assertEqual(code, 401)
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        pid = "x-proj-blender"
        self.req(opener, "/api/drama/projects", method="POST", json_body={"project": self._drama_project(pid)})
        code, body, _ = self.req(opener, "/api/drama/blender/token", method="POST")
        self.assertEqual(code, 200)
        token = json.loads(body.decode("utf-8"))["token"]
        auth = {"Authorization": "Bearer " + token}
        code, body, headers = self.req(opener, "/api/drama/blender/download", headers=auth)
        self.assertEqual(code, 200)
        self.assertEqual(headers.get("Content-Type"), "application/zip")
        self.assertIn(b"xlx_blender/__init__.py", body)
        code, body, _ = self.req(opener, "/api/drama/blender/projects", headers=auth)
        self.assertEqual(code, 200)
        self.assertIn(pid, [p["id"] for p in json.loads(body.decode("utf-8"))["projects"]])
        code, body, _ = self.req(opener, "/api/drama/blender/scenes?projectId=" + pid, headers=auth)
        self.assertEqual(code, 200)
        scenes = json.loads(body.decode("utf-8"))["scenes"]
        self.assertEqual(len(scenes), 1)
        self.assertEqual(scenes[0]["prompt"], "街头奔跑")
        code, body, _ = self.req(
            opener,
            "/api/drama/blender/import",
            method="POST",
            data=b"glTF\x02\x00\x00\x00",
            headers={
                "Content-Type": "model/gltf-binary",
                "X-XLX-Project": urllib.parse.quote(pid),
                "X-XLX-Name": urllib.parse.quote("机甲白模"),
                "Authorization": "Bearer " + token,
            },
        )
        self.assertEqual(code, 200)
        out = json.loads(body.decode("utf-8"))
        self.assertTrue(out["ok"])
        self.assertTrue(out["url"].startswith("http"))
        self.assertTrue(out["url"].endswith(".glb"))
        code, body, _ = self.req(opener, "/api/drama/blender/scenes?projectId=" + pid, headers=auth)
        white = json.loads(body.decode("utf-8"))["whiteModel"]
        self.assertEqual(white["name"], "机甲白模")
        self.assertEqual(white["url"], out["url"])
        anon, _ = self.opener()
        code, _, _ = self.req(
            anon,
            "/api/drama/blender/import",
            method="POST",
            data=b"glTF\x02\x00\x00\x00",
            headers={"Content-Type": "model/gltf-binary", "X-XLX-Project": pid},
        )
        self.assertEqual(code, 401)
        self.req(opener, "/api/drama/projects/delete", method="POST", json_body={"id": pid})

    def test_drama_publishes_record(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        rec = {
            "id": "pub-test-1",
            "projectId": "x-proj-crud",
            "title": "外卖小哥逆袭",
            "meta": {"generator": "铜龙电商 AI 短剧工作台", "aigc": True},
            "consentIds": ["consent-test-1"],
            "at": 1700000000,
        }
        code, body, _ = self.req(opener, "/api/drama/publishes", method="POST", json_body={"record": rec})
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(body.decode("utf-8"))["ok"])
        code, body, _ = self.req(opener, "/api/drama/publishes")
        self.assertEqual(code, 200)
        items = json.loads(body.decode("utf-8"))["publishes"]
        mine = [p for p in items if p["id"] == "pub-test-1"]
        self.assertEqual(len(mine), 1)
        self.assertTrue(mine[0]["markedAigc"])
        self.assertEqual(mine[0]["meta"]["aigc"], True)

    def test_drama_compose_rejects_empty(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        project = self._drama_project("x-proj-empty")
        project["shots"] = []
        code, body, _ = self.req(opener, "/api/drama/compose", method="POST", json_body={"project": project})
        self.assertIn(code, (400, 501))
        self.assertFalse(json.loads(body.decode("utf-8"))["ok"])

    def _mock_compose_ff(self, captured):
        import types

        def fake_download(url, dest):
            dest.write_bytes(b"x")
            return dest

        def fake_ff(args, timeout=None):
            captured.append(list(args))
            Path(args[-1]).write_bytes(b"v")
            return types.SimpleNamespace(returncode=0, stdout=b"")

        self.addCleanup(self._restore(self.gate, "_download_asset", self.gate._download_asset))
        self.addCleanup(self._restore(self.gate, "_ff_run", self.gate._ff_run))
        self.addCleanup(self._restore(self.gate.shutil, "which", self.gate.shutil.which))
        self.addCleanup(self._restore(self.gate, "_drama_font", self.gate._drama_font))
        self.gate._download_asset = fake_download
        self.gate._ff_run = fake_ff
        self.gate.shutil.which = lambda name: "/usr/bin/" + name
        self.gate._drama_font = lambda: ""

    @staticmethod
    def _restore(obj, name, old):
        return lambda: setattr(obj, name, old)

    def test_drama_compose_normalizes_audio_for_concat(self):
        captured = []
        self._mock_compose_ff(captured)
        project = {
            "id": "x-comp",
            "output": {"ratio": "9:16", "fps": 30},
            "shots": [
                {"duration": 3, "imageUrl": "http://x.test/a.jpg", "audioUrl": "http://x.test/a.mp3", "line": "一"},
                {"duration": 4, "videoUrl": "http://x.test/b.mp4", "line": "二"},
            ],
        }
        out = self.gate.drama_compose("liyu", project)
        self.assertTrue(out["file"].endswith(".mp4"))
        per_shot = [c for c in captured if "-c:a" in c and c[c.index("-c:a") + 1] == "aac"]
        self.assertEqual(len(per_shot), 2)
        for cmd in per_shot:
            self.assertIn("44100", cmd)
            self.assertIn("-ac", cmd)


    def test_drama_out_rejects_bad_name(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, _, _ = self.req(opener, "/api/drama/out/evil.exe")
        self.assertEqual(code, 400)

    def test_shop_serves_mp4_inline(self):
        shop = Path(self.tmpdir.name) / "shop-video"
        shop.mkdir(exist_ok=True)
        payload = b"\x00\x00\x00\x18ftypmp42" + b"0" * 64
        (shop / "tutorial-video.mp4").write_bytes(payload)
        old = self.gate.SHOP_DIR
        self.gate.SHOP_DIR = shop
        try:
            opener, _ = self.opener()
            self.req(opener, "/api/login", method="POST", json_body={"username": "zhuren", "password": "owner-pass"})
            code, body, hdrs = self.req(opener, "/tutorial-video.mp4")
        finally:
            self.gate.SHOP_DIR = old
        self.assertEqual(code, 200)
        self.assertEqual(hdrs.get("Content-Type"), "video/mp4")
        self.assertEqual(body, payload)

    def test_shop_video_requires_login(self):
        opener, _ = self.opener()
        code, body, _ = self.req(opener, "/tutorial-video.mp4")
        self.assertEqual(code, 200)
        self.assertIn(b"login", body.lower() + b"login")

    def _mock_urlopen(self, payload, status=200):
        captured = {}

        class FakeResp:
            def __init__(self, data):
                self._data = data

            def read(self, *args):
                return self._data

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        def fake(req, timeout=None):
            captured["url"] = req.full_url
            captured["headers"] = {k.lower(): v for k, v in req.header_items()}
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return FakeResp(payload.encode("utf-8"))

        old = self.gate.urllib.request.urlopen
        self.gate.urllib.request.urlopen = fake
        self.addCleanup(lambda: setattr(self.gate.urllib.request, "urlopen", old))
        return captured

    def test_drama_tts_maps_speech_rate_and_joins_ndjson_frames(self):
        frames = "\n".join([
            json.dumps({"code": 0, "data": base64.b64encode(b"abc").decode()}),
            json.dumps({"code": 0, "data": base64.b64encode(b"def").decode()}),
            json.dumps({"code": 20000000, "message": "OK"}),
        ])
        captured = self._mock_urlopen(frames)
        out = self.gate.drama_tts("tok", "seed-tts-2.0", "你好", "zh_female_vv_uranus_bigtts", 1.5)
        self.assertEqual(out, b"abcdef")
        self.assertEqual(captured["url"], self.gate.VOLC_TTS_URL)
        self.assertEqual(captured["headers"]["x-api-key"], "tok")
        self.assertEqual(captured["headers"]["x-api-resource-id"], "seed-tts-2.0")
        params = captured["body"]["req_params"]
        self.assertEqual(params["text"], "你好")
        self.assertEqual(params["speaker"], "zh_female_vv_uranus_bigtts")
        self.assertEqual(params["audio_params"]["format"], "mp3")
        self.assertEqual(params["audio_params"]["sample_rate"], 24000)
        self.assertEqual(params["audio_params"]["speech_rate"], 50)

    def test_drama_tts_defaults_resource_and_omits_speech_rate(self):
        captured = self._mock_urlopen(json.dumps({"code": 0, "data": base64.b64encode(b"x").decode()}))
        out = self.gate.drama_tts("tok", "", "你好", "v", 1)
        self.assertEqual(out, b"x")
        self.assertEqual(captured["headers"]["x-api-resource-id"], "seed-tts-2.0")
        self.assertNotIn("speech_rate", captured["body"]["req_params"]["audio_params"])

    def test_drama_tts_surfaces_upstream_error(self):
        frames = json.dumps({"code": 55000000, "message": "resource ID is mismatched"})
        self._mock_urlopen(frames)
        with self.assertRaises(RuntimeError) as ctx:
            self.gate.drama_tts("tok", "seed-tts-1.0", "你好", "bad", 1)
        self.assertIn("mismatched", str(ctx.exception))

    def test_drama_tts_requires_key_and_text(self):
        with self.assertRaises(ValueError):
            self.gate.drama_tts("", "seed-tts-2.0", "你好", "v")
        with self.assertRaises(ValueError):
            self.gate.drama_tts("tok", "seed-tts-2.0", "", "v")

    def test_drama_tts_endpoint_serves_audio(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        frames = (json.dumps({"code": 0, "data": base64.b64encode(b"MP3DATA").decode()})
                  + "\n" + json.dumps({"code": 20000000}))
        captured = self._mock_urlopen(frames)
        code, body, hdrs = self.req(opener, "/api/drama/tts", method="POST", json_body={
            "key": "tok", "resource": "seed-tts-2.0", "text": "你好",
            "speaker": "zh_female_vv_uranus_bigtts", "speed": 1,
        })
        self.assertEqual(code, 200)
        self.assertEqual(hdrs.get("Content-Type"), "audio/mpeg")
        self.assertEqual(body, b"MP3DATA")
        self.assertEqual(captured["body"]["req_params"]["speaker"], "zh_female_vv_uranus_bigtts")

    def test_drama_tts_endpoint_guards(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/drama/tts", method="POST", json_body={"text": "你好"})
        self.assertEqual(code, 401)
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/drama/tts", method="POST", json_body={"text": "你好", "speaker": "v"})
        self.assertEqual(code, 400)
        self.assertFalse(json.loads(body.decode("utf-8"))["ok"])

    def test_volc_sign_matches_reference_vector(self):
        from datetime import datetime, timezone
        url, headers, payload = self.gate.volc_sign(
            "AKTEST", "SKTEST", "CVSubmitTask",
            {"req_key": "lipsync", "video_url": "http://x/v.mp4", "audio_url": "http://x/a.mp3"},
            now=datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone.utc),
        )
        self.assertEqual(url, "https://visual.volcengineapi.com/?Action=CVSubmitTask&Version=2022-08-31")
        self.assertEqual(headers["X-Date"], "20240102T030405Z")
        self.assertEqual(
            headers["X-Content-Sha256"],
            "09d0f4bbd5d24fb1c2b405fa27e7413aa00b6947e6197b15b7aa330f3c044737",
        )
        self.assertEqual(
            headers["Authorization"],
            "HMAC-SHA256 Credential=AKTEST/20240102/cn-north-1/cv/request, "
            "SignedHeaders=content-type;host;x-content-sha256;x-date, "
            "Signature=1b61463bd9cd2e3a6fbae6f368faa581c78a8c27f1da8cff57d196c40bca5275",
        )
        self.assertEqual(
            json.loads(payload.decode("utf-8")),
            {"req_key": "lipsync", "video_url": "http://x/v.mp4", "audio_url": "http://x/a.mp3"},
        )

    def test_volc_sign_with_token_adds_signed_header(self):
        url, headers, payload = self.gate.volc_sign(
            "AKTEST", "SKTEST", "CVSubmitTask", {"req_key": "x"}, token="TOK123",
        )
        self.assertEqual(headers["X-Security-Token"], "TOK123")
        self.assertIn(
            "SignedHeaders=content-type;host;x-content-sha256;x-date;x-security-token",
            headers["Authorization"],
        )
        _, plain, _ = self.gate.volc_sign("AKTEST", "SKTEST", "CVSubmitTask", {"req_key": "x"})
        self.assertNotEqual(headers["Authorization"], plain["Authorization"])

    def test_volc_sign_requires_credentials_and_action(self):
        with self.assertRaises(ValueError):
            self.gate.volc_sign("", "SK", "CVSubmitTask", {})
        with self.assertRaises(ValueError):
            self.gate.volc_sign("AK", "", "CVSubmitTask", {})
        with self.assertRaises(ValueError):
            self.gate.volc_sign("AK", "SK", "", {})

    def test_drama_visual_posts_signed_body_and_returns_data(self):
        captured = self._mock_urlopen(json.dumps({"Result": {"task_id": "t1"}, "ResponseMetadata": {}}))
        data = self.gate.drama_visual("AK", "SK", "CVSubmitTask", {"req_key": "lipsync"})
        self.assertEqual(data["Result"]["task_id"], "t1")
        self.assertEqual(captured["url"], "https://visual.volcengineapi.com/?Action=CVSubmitTask&Version=2022-08-31")
        self.assertEqual(captured["headers"]["x-date"][:8].isdigit(), True)
        self.assertTrue(captured["headers"]["authorization"].startswith("HMAC-SHA256 Credential=AK/"))
        self.assertEqual(captured["body"], {"req_key": "lipsync"})

    def test_drama_visual_surfaces_upstream_error(self):
        self._mock_urlopen(json.dumps({
            "ResponseMetadata": {"Error": {"Code": "InvalidAccessKey", "Message": "signature mismatch"}},
        }))
        with self.assertRaises(RuntimeError) as ctx:
            self.gate.drama_visual("AK", "SK", "CVSubmitTask", {})
        self.assertIn("signature mismatch", str(ctx.exception))

    def test_drama_visual_endpoint_returns_data(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        self._mock_urlopen(json.dumps({"Result": {"video_url": "http://x/out.mp4"}, "ResponseMetadata": {}}))
        code, body, _ = self.req(opener, "/api/drama/visual", method="POST", json_body={
            "key": "AK", "secret": "SK", "action": "CVSubmitTask", "body": {"req_key": "lipsync"},
        })
        self.assertEqual(code, 200)
        obj = json.loads(body.decode("utf-8"))
        self.assertTrue(obj["ok"])
        self.assertEqual(obj["data"]["Result"]["video_url"], "http://x/out.mp4")

    def test_drama_visual_endpoint_guards(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/drama/visual", method="POST", json_body={"action": "CVSubmitTask"})
        self.assertEqual(code, 401)
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/drama/visual", method="POST", json_body={})
        self.assertEqual(code, 400)
        code, body, _ = self.req(opener, "/api/drama/visual", method="POST", json_body={"action": "CVSubmitTask"})
        self.assertEqual(code, 400)
        self.assertIn("AccessKey", json.loads(body.decode("utf-8"))["error"])

    def test_drama_asset_upload_then_public_read_without_login(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/drama/asset", method="POST",
                              data=b"MP3RAW", headers={"Content-Type": "audio/mpeg"})
        self.assertEqual(code, 401)
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/drama/asset", method="POST",
                                 data=b"MP3RAW", headers={"Content-Type": "audio/mpeg"})
        self.assertEqual(code, 200)
        obj = json.loads(body.decode("utf-8"))
        self.assertTrue(obj["ok"])
        self.assertRegex(obj["name"], r"^[A-Za-z0-9_-]{16,64}\.mp3$")
        self.assertTrue(obj["url"].endswith("/dian/pub/" + obj["name"]))
        with urllib.request.urlopen(obj["url"], timeout=5) as res:
            self.assertEqual(res.getcode(), 200)
            self.assertEqual(res.read(), b"MP3RAW")
            self.assertEqual(res.headers.get("Content-Type"), "audio/mpeg")

    def test_drama_asset_rejects_bad_type_and_empty(self):
        opener, _ = self.opener()
        self.req(opener, "/api/login", method="POST", json_body={"username": "liyu", "password": "friend-pass"})
        code, body, _ = self.req(opener, "/api/drama/asset", method="POST",
                                 data=b"X", headers={"Content-Type": "application/json"})
        self.assertEqual(code, 400)
        self.assertIn("图片/音频/视频", json.loads(body.decode("utf-8"))["error"])
        code, body, _ = self.req(opener, "/api/drama/asset", method="POST",
                                 data=b"", headers={"Content-Type": "audio/mpeg"})
        self.assertEqual(code, 400)
        self.assertIn("为空", json.loads(body.decode("utf-8"))["error"])

    def test_drama_pub_missing_file_is_404(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/pub/" + "a" * 32 + ".mp3")
        self.assertEqual(code, 404)


    def test_drama_srt_bilingual(self):
        gate = self.gate
        shots = [
            {"seq": 1, "line": "你好", "lineEn": "Hello", "duration": 3},
            {"seq": 2, "line": "再见", "lineEn": "Bye", "duration": 2},
        ]
        mono = gate._drama_srt(shots)
        self.assertIn("你好", mono)
        self.assertNotIn("Hello", mono)
        bi = gate._drama_srt(shots, True)
        self.assertIn("你好\nHello", bi)
        self.assertIn("再见\nBye", bi)
        only_en = gate._drama_srt([{"seq": 1, "lineEn": "Solo", "duration": 3}], True)
        self.assertIn("Solo", only_en)


if __name__ == "__main__":
    unittest.main()
