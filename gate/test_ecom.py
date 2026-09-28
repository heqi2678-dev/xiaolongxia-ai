#!/usr/bin/python3
"""电商工作台 · 数据层、任务队列与适配器框架测试。

覆盖 `gate/ecom/store.py`、`gate/ecom/queue.py`、`gate/ecom/registry.py`、
`gate/ecom/adapters/`。

运行：cd gate && python3 -m unittest test_ecom
"""
import tempfile
import time
import unittest
from pathlib import Path

from ecom import queue, registry, store
from ecom.adapters import base, mock, source_1688


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        store.configure(Path(self.tmp.name) / "ecom.db")
        store.ensure()

    def tearDown(self):
        self.tmp.cleanup()

    def test_tables_created(self):
        with store.db() as conn:
            rows = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        names = {r["name"] for r in rows}
        for table in store.TABLES:
            self.assertIn(table, names)

    def test_product_upsert_dedup(self):
        first = store.upsert_product("u1", "1688", "888", {"title": "A", "price": 9.9})
        second = store.upsert_product("u1", "1688", "888", {"title": "B"})
        self.assertEqual(first["id"], second["id"], "同来源商品应去重更新")
        self.assertEqual(second["title"], "B")
        self.assertEqual(store.count("products", "u1"), 1)

    def test_owner_isolation(self):
        store.insert("products", "u1", {"title": "A"})
        store.insert("products", "u2", {"title": "B"})
        self.assertEqual(store.count("products", "u1"), 1)
        self.assertEqual(store.count("products", "u2"), 1)
        self.assertEqual(store.list_rows("products", "u1")[0]["title"], "A")

    def test_json_roundtrip(self):
        product = store.insert(
            "products",
            "u1",
            {"title": "x", "images_json": ["a", "b"], "attrs_json": {"c": 1}},
        )
        self.assertEqual(product["images_json"], ["a", "b"])
        self.assertEqual(product["attrs_json"], {"c": 1})
        self.assertEqual(product["tags_json"], [], "未提供的 JSON 列取默认值")

    def test_update_and_delete(self):
        product = store.insert("products", "u1", {"title": "x"})
        updated = store.update("products", "u1", product["id"], {"status": "ready"})
        self.assertEqual(updated["status"], "ready")
        self.assertGreaterEqual(updated["updated_at"], product["updated_at"])
        self.assertTrue(store.delete("products", "u1", product["id"]))
        self.assertIsNone(store.get("products", "u1", product["id"]))

    def test_replace_skus(self):
        product = store.insert("products", "u1", {"title": "x"})
        store.replace_skus(
            "u1", product["id"], [{"spec": "红", "price": 1}, {"spec": "蓝", "price": 2}]
        )
        self.assertEqual(len(store.list_skus("u1", product["id"])), 2)
        store.replace_skus("u1", product["id"], [{"spec": "绿"}])
        self.assertEqual(len(store.list_skus("u1", product["id"])), 1)

    def test_unknown_table_rejected(self):
        for call in (
            lambda: store.insert("no_such", "u1", {}),
            lambda: store.get("no_such", "u1", "x"),
            lambda: store.count("no_such", "u1"),
        ):
            with self.assertRaises(ValueError):
                call()

    def test_media_hash_and_stats(self):
        store.insert("media", "u1", {"kind": "image", "hash": "h1"})
        self.assertIsNotNone(store.find_media_by_hash("u1", "h1"))
        self.assertIsNone(store.find_media_by_hash("u1", "nope"))
        store.insert("tasks", "u1", {"kind": "collect", "status": "succeeded"})
        store.insert("tasks", "u1", {"kind": "collect", "status": "failed"})
        store.insert("tasks", "u1", {"kind": "collect", "status": "running"})
        store.insert("tasks", "u1", {"kind": "collect", "status": "partial"})
        summary = store.stats("u1")
        self.assertEqual(summary["media"], 1)
        self.assertEqual(summary["tasks_succeeded"], 1)
        self.assertEqual(summary["tasks_failed"], 1)
        self.assertEqual(summary["tasks_partial"], 1)
        self.assertEqual(summary["tasks_active"], 1)

    def test_latest_report(self):
        store.insert(
            "compliance_reports",
            "u1",
            {"product_id": "p1", "target_platform": "douyin", "verdict": "pass", "checked_at": 1},
        )
        store.insert(
            "compliance_reports",
            "u1",
            {"product_id": "p1", "target_platform": "douyin", "verdict": "block", "checked_at": 2},
        )
        report = store.latest_report("u1", "p1", "douyin")
        self.assertEqual(report["verdict"], "block", "取最近一次检测结论")

    def test_sku_and_price_rule_fields(self):
        product = store.insert("products", "u1", {"title": "x"})
        sku = store.replace_skus(
            "u1", product["id"], [{"spec": "红", "barcode": "690", "enabled": 0}]
        )[0]
        self.assertEqual(sku["barcode"], "690")
        self.assertEqual(sku["enabled"], 0)
        rule = store.insert(
            "price_rules", "u1", {"mode": "add", "base": "current", "round": "to9", "value": 3}
        )
        self.assertEqual(rule["base"], "current")
        self.assertEqual(rule["round"], "to9")

    def test_product_versions(self):
        product = store.insert("products", "u1", {"title": "初版"})
        store.insert(
            "product_versions",
            "u1",
            {"product_id": product["id"], "note": "改标题", "snapshot_json": {"title": "初版"}},
        )
        versions = store.list_rows(
            "product_versions", "u1", where="product_id=?", params=(product["id"],)
        )
        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]["snapshot_json"], {"title": "初版"})


class QueueTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        store.configure(Path(self.tmp.name) / "ecom.db")
        store.ensure()
        queue.stop()

    def tearDown(self):
        queue.stop()
        self.tmp.cleanup()

    def test_run_task_with_items(self):
        queue.register("t_ok", lambda task, item: {"seq": item["seq"]})
        task = queue.create_task(
            "u1", "t_ok", "采集", items=[{"ref_id": "a"}, {"ref_id": "b"}, {"ref_id": "c"}]
        )
        self.assertEqual(task["status"], "queued")
        done = queue.run_task("u1", task["id"])
        self.assertEqual(done["status"], "succeeded")
        self.assertEqual(done["done"], 3)
        self.assertEqual(done["progress"], 100)
        items = store.list_rows(
            "task_items", "u1", where="task_id=?", params=(task["id"],), order="seq ASC"
        )
        self.assertTrue(all(i["status"] == "done" for i in items))
        self.assertEqual(items[0]["result_json"], {"seq": 0})

    def test_atomic_claim(self):
        task = queue.create_task("u1", "t_noop", items=[{"ref_id": "a"}])
        self.assertTrue(queue.claim("u1", task["id"]))
        self.assertFalse(queue.claim("u1", task["id"]), "同一任务只能被领取一次")

    def test_partial_when_some_items_fail(self):
        def flaky(task, item):
            if item["seq"] == 1:
                raise RuntimeError("单条失败")
            return {"ok": True}

        queue.register("t_partial", flaky)
        task = queue.create_task("u1", "t_partial", items=[{"ref_id": "a"}, {"ref_id": "b"}])
        done = queue.run_task("u1", task["id"])
        self.assertEqual(done["status"], "partial")
        self.assertEqual(done["done"], 1)
        self.assertEqual(done["failed"], 1)

    def test_retry_only_failed_items(self):
        attempts = {}

        def once(task, item):
            seq = item["seq"]
            attempts[seq] = attempts.get(seq, 0) + 1
            if seq == 0 and attempts[seq] == 1:
                raise RuntimeError("首次失败")
            return {"ok": True}

        queue.register("t_retry", once)
        task = queue.create_task("u1", "t_retry", items=[{"ref_id": "a"}, {"ref_id": "b"}])
        first = queue.run_task("u1", task["id"])
        self.assertEqual(first["status"], "partial")
        self.assertEqual(attempts, {0: 1, 1: 1})
        resumed = queue.retry_failed("u1", task["id"])
        self.assertEqual(resumed["status"], "queued")
        self.assertEqual(resumed["failed"], 0)
        items = store.list_rows(
            "task_items", "u1", where="task_id=?", params=(task["id"],), order="seq ASC"
        )
        self.assertEqual([i["status"] for i in items], ["pending", "done"])
        final = queue.run_task("u1", task["id"])
        self.assertEqual(final["status"], "succeeded")
        self.assertEqual(attempts, {0: 2, 1: 1}, "只重试失败项，不重复已成功项")

    def test_handler_error_marks_failed(self):
        def boom(task, item):
            raise RuntimeError("平台接口超时")

        queue.register("t_bad", boom)
        task = queue.create_task("u1", "t_bad", items=[{"ref_id": "a"}, {"ref_id": "b"}])
        done = queue.run_task("u1", task["id"])
        self.assertEqual(done["status"], "failed")
        self.assertEqual(done["failed"], 2)
        items = store.list_rows("task_items", "u1", where="task_id=?", params=(task["id"],))
        self.assertTrue(all(i["status"] == "failed" for i in items))
        self.assertIn("超时", items[0]["error"])

    def test_task_level_handler_without_items(self):
        seen = []
        queue.register("t_level", lambda task, item: seen.append(item))
        task = queue.create_task("u1", "t_level", "同步店铺")
        done = queue.run_task("u1", task["id"])
        self.assertEqual(done["status"], "succeeded")
        self.assertEqual(done["progress"], 100)
        self.assertEqual(seen, [None], "无子项任务以 item=None 调用一次")

    def test_unregistered_kind_fails(self):
        task = queue.create_task("u1", "t_missing")
        done = queue.run_task("u1", task["id"])
        self.assertEqual(done["status"], "failed")
        self.assertIn("没有注册处理器", done["error"])

    def test_pause_and_resume(self):
        queue.register("t_pause", lambda task, item: {"ok": True})
        task = queue.create_task("u1", "t_pause", items=[{"ref_id": "a"}])
        queue.pause("u1", task["id"])
        self.assertEqual(queue.run_task("u1", task["id"])["status"], "paused")
        queue.resume("u1", task["id"])
        self.assertEqual(queue.run_task("u1", task["id"])["status"], "succeeded")

    def test_cancel(self):
        task = queue.create_task("u1", "t_cancel", items=[{"ref_id": "a"}])
        queue.cancel("u1", task["id"])
        self.assertEqual(queue.run_task("u1", task["id"])["status"], "canceled")

    def test_scheduled_promoted_when_due(self):
        task = queue.create_task(
            "u1",
            "collect",
            items=[{"ref_id": "a"}],
            params={"schedule": {"mode": "at", "at": time.time() + 3600}},
        )
        self.assertEqual(task["status"], "scheduled")
        self.assertIsNone(queue.next_due_task(), "未到执行时间不应派发")
        store.update("tasks", "u1", task["id"], {"params_json": {"schedule": {"mode": "at", "at": time.time() - 1}}})
        due = queue.next_due_task()
        self.assertEqual(due["id"], task["id"])
        self.assertEqual(due["status"], "queued")

    def test_pacing_daily_limit(self):
        store.insert("pacing", "u1", {"daily_limit": 1, "enabled": 1})
        queue.register("publish", lambda task, item: {"ok": True})
        first = queue.create_task("u1", "publish", items=[{"ref_id": "a"}])
        queue.run_task("u1", first["id"])
        second = queue.create_task("u1", "publish", items=[{"ref_id": "b"}])
        self.assertIsNone(queue.next_due_task(), "达到当日上限后不应再派发")
        self.assertEqual(store.get("tasks", "u1", second["id"])["status"], "queued")

    def test_pacing_run_after(self):
        task = queue.create_task(
            "u1", "collect", items=[{"ref_id": "a"}], params={"run_after": time.time() + 3600}
        )
        self.assertEqual(task["status"], "scheduled")
        self.assertIsNone(queue.next_due_task(), "未到执行时间不应派发")
        store.update("tasks", "u1", task["id"], {"params_json": {"run_after": time.time() - 1}})
        self.assertEqual(queue.next_due_task()["id"], task["id"])

    def test_pacing_window(self):
        hour = time.localtime().tm_hour
        blocked = [(hour + 1) % 24, (hour + 2) % 24]
        store.insert("pacing", "u1", {"windows_json": [blocked], "enabled": 1})
        task = queue.create_task("u1", "publish", items=[{"ref_id": "a"}])
        self.assertIsNone(queue.next_due_task(), "不在允许时段不应派发")
        self.assertTrue(queue.pacing_allows("u2", "publish")[0], "其他 owner 不受影响")
        self.assertEqual(store.get("tasks", "u1", task["id"])["status"], "queued")

    def test_worker_processes_queued(self):
        queue.register("t_worker", lambda task, item: {"ok": True})
        task = queue.create_task("u1", "t_worker", items=[{"ref_id": "a"}])
        queue.start(workers=1)
        deadline = time.time() + 5
        while time.time() < deadline:
            if store.get("tasks", "u1", task["id"])["status"] == "succeeded":
                break
            time.sleep(0.05)
        queue.stop()
        self.assertEqual(store.get("tasks", "u1", task["id"])["status"], "succeeded")


class AdapterTest(unittest.TestCase):
    """适配器框架：注册表、错误归一化、限流与统一契约（设计稿 4.5 / 4.6）。"""

    def test_registry_register_and_get(self):
        reg = registry.Registry()
        src = mock.MockSourceAdapter()
        tgt = mock.MockTargetAdapter()
        reg.register_source("mock", src)
        reg.register_target("mock", tgt)
        self.assertIs(reg.source("mock"), src)
        self.assertIs(reg.target("mock"), tgt)
        self.assertEqual(reg.sources(), ["mock"])
        self.assertEqual(reg.targets(), ["mock"])

    def test_registry_unknown_platform(self):
        reg = registry.Registry()
        with self.assertRaises(registry.EcomError) as ctx:
            reg.source("taobao")
        self.assertEqual(ctx.exception.code, registry.UNKNOWN)

    def test_registry_swap_implementation(self):
        reg = registry.Registry()
        first = mock.MockSourceAdapter()
        second = mock.MockSourceAdapter([mock.raw_product("x", "换实现")])
        reg.register_source("mock", first)
        reg.register_source("mock", second)
        self.assertIs(reg.source("mock"), second, "新增/替换平台实现不改应用层")

    def test_normalize_error_categories(self):
        cases = [
            ("category qualification missing", registry.CATEGORY_RIGHTS),
            ("命中违禁词", registry.FORBIDDEN_WORD),
            ("image size not allowed", registry.IMAGE_SIZE),
            ("sku 不完整", registry.SKU_INCOMPLETE),
            ("429 too many requests", registry.RATE_LIMITED),
            ("token expired 401", registry.AUTH_EXPIRED),
            ("connection timeout", registry.NETWORK),
            ("something odd", registry.UNKNOWN),
        ]
        for text, expected in cases:
            self.assertEqual(registry.normalize_error(Exception(text)).code, expected, text)

    def test_retryable_policy(self):
        self.assertTrue(registry.is_retryable(registry.EcomError("超时", registry.NETWORK)))
        self.assertTrue(registry.is_retryable(registry.EcomError("限流", registry.RATE_LIMITED)))
        self.assertFalse(registry.is_retryable(registry.EcomError("违禁词", registry.FORBIDDEN_WORD)))
        self.assertFalse(registry.is_retryable(registry.EcomError("授权失效", registry.AUTH_EXPIRED)))

    def test_error_as_dict(self):
        err = registry.EcomError("触发限流", registry.RATE_LIMITED, remote_code="429")
        payload = err.as_dict()
        self.assertEqual(payload["label"], "触发限流")
        self.assertTrue(payload["retryable"])
        self.assertEqual(payload["remote_code"], "429")

    def test_rate_limiter_qps_and_quota(self):
        now = {"t": 1000.0}
        limiter = registry.RateLimiter(qps=2, daily_limit=2, clock=lambda: now["t"])
        self.assertTrue(limiter.acquire()[0])
        limiter.spend()
        ok, reason = limiter.acquire()
        self.assertFalse(ok, "同一时刻 QPS 内不应放行第二次")
        self.assertIn("QPS", reason)
        now["t"] += 0.5
        self.assertTrue(limiter.acquire()[0], "半个周期后（qps=2）可再次调用")
        limiter.spend()
        now["t"] += 10
        ok, reason = limiter.acquire()
        self.assertFalse(ok, "达到日配额后应被拦截")
        self.assertIn("配额", reason)
        now["t"] += 86400
        self.assertTrue(limiter.acquire()[0], "跨日后配额重置")

    def test_rate_limiter_spend_raises(self):
        limiter = registry.RateLimiter(qps=1, clock=lambda: 500.0)
        limiter.spend()
        with self.assertRaises(registry.EcomError) as ctx:
            limiter.spend()
        self.assertEqual(ctx.exception.code, registry.RATE_LIMITED)

    def test_mock_source_contract(self):
        adapter = mock.MockSourceAdapter()
        product = base.assert_source_contract(adapter)
        self.assertEqual(product["source_id"], "sample-1")
        self.assertTrue(product["skus"])

    def test_mock_target_contract(self):
        adapter = mock.MockTargetAdapter()
        remote_id = base.assert_target_contract(adapter)
        self.assertIn(remote_id, adapter.published)
        self.assertEqual(adapter.published[remote_id]["price"], 88.0)

    def test_mock_target_requires_category(self):
        adapter = mock.MockTargetAdapter()
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"title": "无类目", "category_id": ""}, {"access_token": "t"})
        self.assertEqual(ctx.exception.code, registry.CATEGORY_RIGHTS)

    def test_mock_target_normalizes_publish_failure(self):
        adapter = mock.MockTargetAdapter(fail_publish="429 too many requests")
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"title": "x", "category_id": "100101"}, {"access_token": "t"})
        err = registry.normalize_error(ctx.exception)
        self.assertEqual(err.code, registry.RATE_LIMITED)
        self.assertTrue(err.retryable)

    def test_mock_target_auth_expired(self):
        adapter = mock.MockTargetAdapter()
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"title": "x", "category_id": "100101"}, {})
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_mock_target_listing_lifecycle(self):
        adapter = mock.MockTargetAdapter()
        auth = {"access_token": "t"}
        remote_id = adapter.publish({"title": "女装连衣裙", "category_id": "100101"}, auth)["remote_id"]
        adapter.set_listing(remote_id, False, auth)
        items = adapter.list_listings(auth)["items"]
        self.assertEqual(items[0]["remote_id"], remote_id)
        self.assertFalse(items[0]["on"])

    def test_adapter_consumed_by_queue(self):
        """应用层消费契约：任务处理器调用适配器，成功即落 task_items.result_json。"""

        def handler(task, item):
            adapter = registry.REGISTRY.target("mock")
            product = mock.raw_product(item["ref_id"], "女装连衣裙 A")
            mapped = adapter.map_fields(product, "100101")
            return adapter.publish(mapped["data"], {"access_token": "t"})

        registry.REGISTRY.register_target("mock", mock.MockTargetAdapter())
        queue.register("t_adapter", handler)
        task = queue.create_task("u1", "t_adapter", items=[{"ref_id": "a"}, {"ref_id": "b"}])
        result = queue.run_task("u1", task["id"])
        self.assertEqual(result["status"], "succeeded")
        items = store.list_rows("task_items", "u1", where="task_id=?", params=(task["id"],))
        self.assertTrue(all(it["result_json"]["remote_id"] for it in items))


class Source1688Test(unittest.TestCase):
    """1688 源适配器：签名、链接解析、字段映射、整店分页与错误归一化。"""

    OFFER = {
        "offerId": "123456",
        "subject": "女装连衣裙 碎花",
        "image": "https://img.example.com/1.jpg;https://img.example.com/2.jpg",
        "detailUrl": "https://detail.1688.com/offer/123456.html",
        "categoryName": "女装",
        "attributes": {"材质": "棉"},
        "skuInfos": [
            {"skuId": "s1", "price": "39.9", "amount": "5", "attributes": {"颜色": "红"}},
            {"skuId": "s2", "price": "45.0", "amount": "7", "attributes": {"颜色": "蓝"}},
        ],
    }

    class FakeTransport:
        def __init__(self, responses=None):
            self.calls = []
            self.responses = responses or {}

        def post(self, url, params):
            self.calls.append((url, dict(params)))
            for key, value in self.responses.items():
                if key in url:
                    return value(params) if callable(value) else value
            return {}

    def _adapter(self, responses=None):
        return source_1688.Source1688Adapter(
            appkey="app", secret="sec", access_token="tok", transport=self.FakeTransport(responses)
        )

    def test_extract_offer_id(self):
        self.assertEqual(source_1688.extract_offer_id("123456"), "123456")
        self.assertEqual(
            source_1688.extract_offer_id("https://detail.1688.com/offer/98765.html"), "98765"
        )
        self.assertEqual(
            source_1688.extract_offer_id("https://m.1688.com/detail.htm?offerId=5566"), "5566"
        )
        with self.assertRaises(registry.EcomError):
            source_1688.extract_offer_id("")

    def test_aop_signature_deterministic(self):
        sig1 = source_1688.aop_signature({"b": "2", "a": "1"}, "secret")
        sig2 = source_1688.aop_signature({"a": "1", "b": "2"}, "secret")
        self.assertEqual(sig1, sig2, "签名与参数顺序无关")
        self.assertEqual(sig1, sig1.upper())
        self.assertNotEqual(sig1, source_1688.aop_signature({"a": "1", "b": "2"}, "other"))

    def test_fetch_product_maps_raw_product(self):
        adapter = self._adapter({"alibaba.product.get": {"offer": self.OFFER}})
        product = adapter.fetch_product("https://detail.1688.com/offer/123456.html")
        base._check_product(product)
        self.assertEqual(product["source_id"], "123456")
        self.assertEqual(product["title"], "女装连衣裙 碎花")
        self.assertEqual(product["price"], 39.9, "取 SKU 最低价")
        self.assertEqual(product["stock"], 12, "SKU 库存合计")
        self.assertEqual(len(product["images"]), 2)
        self.assertEqual(product["skus"][0]["spec"], "颜色:红")
        self.assertEqual(product["attrs"], {"材质": "棉"})
        url, params = adapter.transport.calls[0]
        self.assertIn("alibaba.product.get", url)
        self.assertIn("app", url)
        self.assertEqual(params["offerId"], "123456")
        self.assertTrue(params["_aop_signature"])

    def test_fetch_shop_paginates(self):
        pages = {
            1: {"offerList": [dict(self.OFFER, offerId="1"), dict(self.OFFER, offerId="2")]},
            2: {"offerList": [dict(self.OFFER, offerId="3")]},
        }

        def responder(params):
            return pages[int(params["pageNo"])]

        adapter = self._adapter({"alibaba.offer.list": responder})
        products = list(adapter.fetch_shop("https://shop123.1688.com", {"limit": 2}))
        self.assertEqual([p["source_id"] for p in products], ["1", "2", "3"], "应按页拉全")
        self.assertEqual(len(adapter.transport.calls), 2, "第二页不足一页即结束")

    def test_missing_credentials(self):
        adapter = source_1688.Source1688Adapter(transport=self.FakeTransport())
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.fetch_product("123456")
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_error_response_normalized(self):
        adapter = self._adapter(
            {
                "alibaba.product.get": {
                    "error_response": {"code": "429", "msg": "too many requests"}
                }
            }
        )
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.fetch_product("123456")
        self.assertEqual(ctx.exception.code, registry.RATE_LIMITED)
        self.assertTrue(ctx.exception.retryable)

    def test_contract_selfcheck(self):
        adapter = self._adapter(
            {
                "alibaba.product.get": {"offer": self.OFFER},
                "alibaba.offer.list": {"offerList": [self.OFFER]},
            }
        )
        product = base.assert_source_contract(
            adapter, sample_id="123456", shop_url="https://shop123.1688.com"
        )
        self.assertTrue(product["skus"])


if __name__ == "__main__":
    unittest.main()
