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
        import importlib
        import server as gate_server
        importlib.reload(gate_server)
        cls.gate = gate_server
        gate_server.DATA_DIR = Path(cls.tmpdir.name)
        gate_server.SHOP_DIR = SHOP
        gate_server.ensure_data()
        gate_server.upsert_user("zhuren", "owner-pass", role="owner")
        gate_server.upsert_user("friendA", "friend-pass", role="friend", limit=100)
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
        self.assertIn('prefix = "u_" + user.name', js.decode("utf-8"))

    def test_unknown_user_rejected(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "stranger", "password": "x"})
        self.assertEqual(code, 401)

    def test_friend_quota_101st_rejected(self):
        opener, _ = self.opener()
        code, _, _ = self.req(opener, "/api/login", method="POST", json_body={"username": "friendA", "password": "friend-pass"})
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


if __name__ == "__main__":
    unittest.main()
