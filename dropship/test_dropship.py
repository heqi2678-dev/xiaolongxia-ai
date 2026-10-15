#!/usr/bin/python3
"""铺货后端单元测试。不联网、不依赖外部服务。"""
import hashlib
import json
import tempfile
import time
import unittest
from pathlib import Path

from dropship.server import api
from dropship.server.adapters.mock import MockAdapter
from dropship.server.adapters.taobao import TaobaoAdapter, TopError, build_multipart, build_top_params, top_sign
from dropship.server.app import AppContext
from dropship.server.auth import AuthCenter
from dropship.server.db import Store
from dropship.server.models import normalize_product, selling_price, validate_for_publish
from dropship.server.queue import PublishQueue
from dropship.server.storage import ImageStore


def sample_raw():
    return {
        "source": {"platform": "1688", "itemId": "123456", "url": "https://detail.1688.com/offer/123456.html", "shop": "测试店铺"},
        "title": "纯棉短袖T恤 夏季新款",
        "description": "<p>测试描述</p>",
        "images": {
            "main": ["https://cbu01.alicdn.com/a.jpg", "https://cbu01.alicdn.com/a.jpg", "https://cbu01.alicdn.com/b.jpg"],
            "detail": ["https://cbu01.alicdn.com/d.jpg"],
        },
        "skus": [
            {"skuId": "s1", "specs": {"color": "白色", "size": "M"}, "price": 19.9, "stock": 100},
        ],
        "category": {"sourcePath": ["女装", "T恤"]},
        "pricing": {"cost": 12.5, "price": 29.9},
    }


class Ctx:
    def __init__(self, ctx):
        self.app = ctx

    def call(self, method, path, body=None, query=None, headers=None):
        return api.handle(self.app, method, path, query or {}, body or {}, headers or {})


def make_ctx(**overrides):
    tmp = tempfile.mkdtemp()
    cfg = {
        "data_dir": tmp,
        "db_path": str(Path(tmp) / "t.sqlite3"),
        "images_dir": str(Path(tmp) / "img"),
        "ext_token": "",
        "rate_per_min": 0,
        "max_retries": 3,
        "dry_run": True,
    }
    cfg.update(overrides)
    return AppContext(cfg)


class ModelTests(unittest.TestCase):
    def test_normalize_dedup_images_and_defaults(self):
        p = normalize_product(sample_raw())
        self.assertEqual(p["source"]["platform"], "1688")
        self.assertEqual(len(p["images"]["main"]), 2)
        self.assertEqual(p["skus"][0]["stock"], 100)
        self.assertEqual(p["pricing"]["currency"], "CNY")

    def test_normalize_requires_item_and_images(self):
        raw = sample_raw()
        raw["source"].pop("itemId")
        with self.assertRaises(ValueError):
            normalize_product(raw)
        raw = sample_raw()
        raw["images"]["main"] = []
        with self.assertRaises(ValueError):
            normalize_product(raw)

    def test_normalize_keeps_list_price_and_shipping(self):
        raw = sample_raw()
        raw["pricing"] = {"cost": 12.5, "price": 12.5, "listPrice": 29.9, "shipping": 6.0}
        p = normalize_product(raw)
        self.assertEqual(p["pricing"]["listPrice"], 29.9)
        self.assertEqual(p["pricing"]["shipping"], 6.0)

    def test_selling_price_prefers_list_price(self):
        raw = sample_raw()
        raw["pricing"] = {"cost": 12.5, "price": 12.5, "listPrice": 29.9}
        self.assertEqual(selling_price(normalize_product(raw)), 29.9)
        raw["pricing"] = {"cost": 12.5, "price": 12.5}
        self.assertEqual(selling_price(normalize_product(raw)), 12.5)

    def test_validate_requires_category_mapping(self):
        p = normalize_product(sample_raw())
        errors = validate_for_publish(p, {})
        self.assertTrue(any("类目" in e for e in errors))
        p["category"]["target"] = {"id": "50000000", "path": ["女装"]}
        self.assertEqual(validate_for_publish(p, {}), [])


class SignTests(unittest.TestCase):
    def test_top_sign_is_stable_and_uppercase(self):
        params = {"a": "1", "b": "2", "method": "taobao.item.add"}
        sig = top_sign(params, "secret")
        self.assertEqual(sig, top_sign(params, "secret"))
        self.assertEqual(sig, sig.upper())
        self.assertNotEqual(sig, top_sign(params, "other"))


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = Store(str(Path(self.tmp) / "s.sqlite3"))

    def test_upsert_product_is_idempotent_by_source(self):
        p = normalize_product(sample_raw())
        self.store.upsert_product(p)
        p2 = normalize_product(sample_raw())
        self.store.upsert_product(p2)
        self.assertEqual(len(self.store.list_products()), 1)
        self.assertIsNotNone(self.store.find_product_by_source("1688", "123456"))

    def test_token_roundtrip(self):
        self.store.set_token("taobao", {"accessToken": "x"})
        self.assertEqual(self.store.get_token("taobao")["accessToken"], "x")
        self.assertTrue(self.store.delete_token("taobao"))
        self.assertIsNone(self.store.get_token("taobao"))


class AuthTests(unittest.TestCase):
    def test_authorize_url_taobao(self):
        auth = AuthCenter(Store(str(Path(tempfile.mkdtemp()) / "a.sqlite3")))
        url = auth.authorize_url("taobao", "https://cb", "st", {"appKey": "k"})
        self.assertIn("oauth.taobao.com", url)
        self.assertIn("client_id=k", url)

    def test_dry_exchange_sets_token(self):
        auth = AuthCenter(Store(str(Path(tempfile.mkdtemp()) / "a.sqlite3")), dry_run=True)
        auth.exchange_code("taobao", "abc123", "https://cb")
        self.assertTrue(auth.is_authorized("taobao"))


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.ctx = Ctx(make_ctx())

    def seeded(self):
        saved = self.ctx.call("POST", "/api/collect", sample_raw())[1]["product"]
        return saved

    def test_enqueue_and_publish_mock_success(self):
        saved = self.seeded()
        saved["category"]["target"] = {"id": "50000000"}
        self.ctx.app.store.upsert_product(normalize_product(saved))
        task = self.ctx.app.queue.enqueue(saved["id"], "mock")
        self.assertEqual(task["status"], "pending")
        done = self.ctx.app.queue.worker_once()
        self.assertEqual(done["status"], "success")
        self.assertTrue(done["platformItemId"].startswith("MOCK-"))
        product = self.ctx.app.store.get_product(saved["id"])
        self.assertEqual(product["publish"][0]["status"], "success")

    def test_publish_failed_validation_stays_failed(self):
        saved = self.seeded()
        task = self.ctx.app.queue.enqueue(saved["id"], "mock")
        done = self.ctx.app.queue.worker_once()
        self.assertEqual(done["status"], "failed")
        self.assertIn("类目", done["lastError"])

    def test_enqueue_unknown_platform(self):
        saved = self.seeded()
        with self.assertRaises(ValueError):
            self.ctx.app.queue.enqueue(saved["id"], "nope")


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.ctx = Ctx(make_ctx())

    def test_health(self):
        status, payload = self.ctx.call("GET", "/health")
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertIn("taobao", payload["adapters"])

    def test_collect_and_list_and_publish_flow(self):
        status, payload = self.ctx.call("POST", "/api/collect", sample_raw())
        self.assertEqual(status, 200)
        pid = payload["product"]["id"]
        status, payload = self.ctx.call("GET", "/api/products")
        self.assertEqual(len(payload["products"]), 1)
        status, payload = self.ctx.call("PUT", "/api/products/%s" % pid, {"title": "改后标题", "category": {"target": {"id": "1"}}})
        self.assertEqual(payload["product"]["title"], "改后标题")
        status, payload = self.ctx.call("POST", "/api/publish", {"platform": "mock", "productIds": [pid]})
        self.assertEqual(status, 200)
        self.assertEqual(len(payload["tasks"]), 1)
        self.ctx.app.queue.worker_once()
        status, payload = self.ctx.call("GET", "/api/tasks")
        self.assertEqual(payload["tasks"][0]["status"], "success")

    def test_put_merges_nested_pricing_and_category(self):
        _, payload = self.ctx.call("POST", "/api/collect", sample_raw())
        pid = payload["product"]["id"]
        _, payload = self.ctx.call("PUT", "/api/products/%s" % pid, {"pricing": {"listPrice": 39.9}})
        pricing = payload["product"]["pricing"]
        self.assertEqual(pricing["listPrice"], 39.9)
        self.assertEqual(pricing["cost"], 12.5)
        _, payload = self.ctx.call("PUT", "/api/products/%s" % pid, {"category": {"target": {"id": "1"}}})
        self.assertEqual(payload["product"]["category"]["target"]["id"], "1")
        self.assertEqual(payload["product"]["category"]["sourcePath"], ["女装", "T恤"])

    def test_not_found(self):
        status, _ = self.ctx.call("GET", "/api/products/missing")
        self.assertEqual(status, 404)

    def test_auth_required_when_token_set(self):
        ctx = Ctx(make_ctx(ext_token="secret"))
        status, _ = ctx.call("GET", "/api/products")
        self.assertEqual(status, 401)
        status, _ = ctx.call("GET", "/api/products", headers={"Authorization": "Bearer secret"})
        self.assertEqual(status, 200)

    def test_platforms_reports_auth_state(self):
        status, payload = self.ctx.call("GET", "/api/platforms")
        by_id = {p["id"]: p for p in payload["platforms"]}
        self.assertFalse(by_id["taobao"]["authorized"])

    def test_product_search_and_filter(self):
        self.ctx.call("POST", "/api/collect", sample_raw())
        raw2 = sample_raw()
        raw2["source"]["itemId"] = "999"
        raw2["title"] = "男士牛仔裤"
        self.ctx.call("POST", "/api/collect", raw2)
        _, payload = self.ctx.call("GET", "/api/products", query={"q": "牛仔裤"})
        self.assertEqual(payload["total"], 1)
        self.assertEqual(len(payload["products"]), 1)
        _, payload = self.ctx.call("GET", "/api/products", query={"source": "1688"})
        self.assertEqual(payload["total"], 2)

    def test_retry_task_requeues(self):
        _, payload = self.ctx.call("POST", "/api/collect", sample_raw())
        pid = payload["product"]["id"]
        self.ctx.call("PUT", "/api/products/%s" % pid, {"category": {"target": {"id": "1"}}})
        _, payload = self.ctx.call("POST", "/api/publish", {"platform": "mock", "productIds": [pid]})
        tid = payload["tasks"][0]["id"]
        self.ctx.app.queue.worker_once()
        _, payload = self.ctx.call("GET", "/api/tasks/%s" % tid)
        self.assertEqual(payload["task"]["status"], "success")
        status, payload = self.ctx.call("POST", "/api/tasks/%s/retry" % tid)
        self.assertEqual(status, 200)
        self.assertEqual(payload["task"]["status"], "pending")
        status, _ = self.ctx.call("POST", "/api/tasks/missing/retry")
        self.assertEqual(status, 404)

    def test_localize_and_serve_image(self):
        self.ctx.app.images._fetch = lambda url: (b"LOCAL-BYTES", "image/png")
        _, payload = self.ctx.call("POST", "/api/collect", sample_raw())
        pid = payload["product"]["id"]
        status, payload = self.ctx.call("POST", "/api/images/localize", {"productId": pid})
        self.assertEqual(status, 200)
        self.assertTrue(payload["changed"])
        item = payload["product"]["images"]["main"][0]
        name = item["local"].rsplit("/", 1)[-1]
        status, payload = self.ctx.call("GET", "/api/images/%s" % name)
        self.assertEqual(status, 200)
        self.assertEqual(payload["__bytes__"], b"LOCAL-BYTES")
        status, _ = self.ctx.call("GET", "/api/images/nope.png")
        self.assertEqual(status, 404)

    def test_adapter_categories_endpoint(self):
        status, payload = self.ctx.call("GET", "/api/adapters/mock/categories")
        self.assertEqual(status, 200)
        self.assertEqual(payload["categories"], [])
        status, _ = self.ctx.call("GET", "/api/adapters/nope/categories")
        self.assertEqual(status, 404)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = ImageStore(
            str(Path(self.tmp) / "img"),
            fetch=lambda url: (b"BINARY-PNG", "image/png"),
        )

    def test_put_bytes_dedup(self):
        a = self.store.put_bytes(b"hello", "image/jpeg")
        b = self.store.put_bytes(b"hello", "image/jpeg")
        self.assertEqual(a["name"], b["name"])
        self.assertTrue(a["name"].endswith(".jpg"))
        self.assertEqual(len(list((Path(self.tmp) / "img").iterdir())), 1)

    def test_resolve_rejects_traversal_and_missing(self):
        self.store.put_bytes(b"x", "image/png")
        self.assertIsNone(self.store.resolve("../secret"))
        self.assertIsNone(self.store.resolve("nope.png"))

    def test_localize_product_rewrites_images(self):
        product = {"images": {"main": ["https://x/a.png"], "detail": []}}
        self.assertTrue(self.store.localize_product(product))
        item = product["images"]["main"][0]
        self.assertEqual(item["remote"], "https://x/a.png")
        self.assertTrue(item["local"].startswith("/api/images/"))
        self.assertTrue(self.store.read(item["local"].rsplit("/", 1)[-1]) == b"BINARY-PNG")

    def test_localize_is_idempotent(self):
        product = {"images": {"main": ["https://x/a.png"]}}
        self.store.localize_product(product)
        self.assertFalse(self.store.localize_product(product))


class TopHelperTests(unittest.TestCase):
    def test_top_sign_matches_manual_md5(self):
        expected = hashlib.md5(b"seca1b2sec").hexdigest().upper()
        self.assertEqual(top_sign({"a": "1", "b": "2"}, "sec"), expected)

    def test_build_top_params_session_and_biz(self):
        creds = {"appKey": "k", "appSecret": "s", "accessToken": "tok"}
        params = build_top_params(creds, "taobao.item.add", {"num": 5, "nested": {"x": 1}, "skip": ""})
        self.assertEqual(params["app_key"], "k")
        self.assertEqual(params["session"], "tok")
        self.assertEqual(params["num"], "5")
        self.assertEqual(params["nested"], '{"x": 1}')
        self.assertNotIn("skip", params)
        unsigned = {k: v for k, v in params.items() if k != "sign"}
        self.assertEqual(params["sign"], top_sign(unsigned, "s"))

    def test_build_multipart(self):
        ctype, body = build_multipart({"method": "x"}, [("img", "a.jpg", "image/jpeg", b"DATA")])
        self.assertIn("multipart/form-data; boundary=", ctype)
        self.assertIn(b'name="img"; filename="a.jpg"', body)
        self.assertIn(b"DATA", body)
        self.assertTrue(body.rstrip().endswith(b"--"))


class TaobaoAdapterTests(unittest.TestCase):
    def _adapter(self):
        self.calls = []
        self.responses = []

        def http(gateway, params):
            self.calls.append(("post", params))
            return self.responses.pop(0)

        def http_bytes(gateway, params, files):
            self.calls.append(("bytes", params, files))
            return self.responses.pop(0)

        return TaobaoAdapter(dry_run=False, http=http, http_bytes=http_bytes)

    def _creds(self):
        return {"accessToken": "t", "appKey": "k", "appSecret": "s"}

    def test_query_categories_parses(self):
        adapter = self._adapter()
        self.responses = [{"itemcats_get_response": {"item_cats": {"item_cat": [
            {"cid": 16, "parent_cid": 0, "name": "女装", "is_parent": True}]}}}]
        cats = adapter.query_categories(creds=self._creds())
        self.assertEqual(cats, [{"id": "16", "parentId": "0", "name": "女装", "isParent": True}])

    def test_query_categories_dry_run_returns_empty(self):
        self.assertEqual(TaobaoAdapter(dry_run=True).query_categories(creds=self._creds()), [])

    def test_upload_picture(self):
        adapter = self._adapter()
        self.responses = [{"picture_upload_response": {"picture": {"url": "http://p/1.jpg", "picture_id": 9}}}]
        out = adapter.upload_picture(b"IMG", self._creds())
        self.assertEqual(out["url"], "http://p/1.jpg")
        self.assertEqual(out["pictureId"], "9")
        kind, params, files = self.calls[0]
        self.assertEqual(kind, "bytes")
        self.assertEqual(files[0][0], "img")
        self.assertEqual(params["method"], "taobao.picture.upload")

    def test_publish_requires_category_mapping(self):
        adapter = TaobaoAdapter(dry_run=False)
        res = adapter.publish({"category": {}}, {}, self._creds())
        self.assertFalse(res.ok)
        self.assertIn("类目", res.error)

    def test_publish_success(self):
        adapter = self._adapter()
        self.responses = [{"item_add_response": {"item": {"num_iid": 88}}}]
        product = normalize_product(sample_raw())
        product["category"]["target"] = {"id": "16"}
        res = adapter.publish(product, {}, self._creds())
        self.assertTrue(res.ok)
        self.assertEqual(res.platform_item_id, 88)

    def test_publish_top_error(self):
        adapter = self._adapter()
        self.responses = [{"error_response": {"code": 15, "msg": "已被下架"}}]
        product = normalize_product(sample_raw())
        product["category"]["target"] = {"id": "16"}
        res = adapter.publish(product, {}, self._creds())
        self.assertFalse(res.ok)
        self.assertIn("已被下架", res.error)

    def test_publish_dry_run(self):
        adapter = TaobaoAdapter(dry_run=True)
        product = normalize_product(sample_raw())
        product["category"]["target"] = {"id": "16"}
        res = adapter.publish(product, {}, {})
        self.assertEqual(res.status, "dry_run")


class AuthRefreshTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.store = Store(str(Path(tmp) / "t.sqlite3"))
        self.auth = AuthCenter(self.store, dry_run=True)

    def test_ensure_valid_refreshes_when_expiring(self):
        self.auth.save_token("taobao", {"accessToken": "old", "expiresAt": int(time.time()) + 10})
        token = self.auth.ensure_valid("taobao")
        self.assertEqual(token["accessToken"], "old")
        self.assertGreater(token["expiresAt"] - int(time.time()), 100)

    def test_ensure_valid_keeps_fresh_token(self):
        future = int(time.time()) + 7200
        self.auth.save_token("taobao", {"accessToken": "fresh", "expiresAt": future})
        token = self.auth.ensure_valid("taobao")
        self.assertEqual(token["expiresAt"], future)

    def test_ensure_valid_without_token(self):
        self.assertIsNone(self.auth.ensure_valid("taobao"))

    def test_refresh_requires_token(self):
        with self.assertRaises(ValueError):
            self.auth.refresh("taobao")


if __name__ == "__main__":
    unittest.main()
