#!/usr/bin/python3
"""电商工作台 · 数据层、任务队列与适配器框架测试。

覆盖 `gate/ecom/store.py`、`gate/ecom/queue.py`、`gate/ecom/registry.py`、
`gate/ecom/adapters/`。

运行：cd gate && python3 -m unittest test_ecom
"""
import hashlib
import os
import tempfile
import time
import unittest
from pathlib import Path

# 测试绝不能碰默认 DATA_DIR（服务器上是生产目录）：先指向临时目录再导入 ecom。
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="ecom-test-")

from ecom import api, jobs, media, queue, registry, store, tokens
from ecom.adapters import base, mock, source_1688, target_douyin, target_taobao


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


class DouyinTargetTest(unittest.TestCase):
    """抖音小店目标适配器：类目树、字段映射、发布/改价/上下架与错误归一化。"""

    CATEGORY = {
        "code": 10000,
        "data": {
            "categoryList": [
                {
                    "id": 1,
                    "name": "服饰",
                    "children": [
                        {
                            "id": 11,
                            "name": "女装",
                            "children": [{"id": 111, "name": "连衣裙"}],
                        },
                        {
                            "id": 12,
                            "name": "男装",
                            "children": [{"id": 121, "name": "T恤"}],
                        },
                    ],
                }
            ]
        },
    }
    OK = {"code": 10000, "data": {"product_id": "9001"}}

    class FakeTransport:
        def __init__(self, responses=None):
            self.calls = []
            self.responses = responses or {}

        def post(self, url, params):
            self.calls.append((url, dict(params)))
            for key, value in self.responses.items():
                if key in url:
                    return value(params) if callable(value) else value
            return {"code": 10000, "data": {}}

    def _adapter(self, responses=None):
        return target_douyin.TargetDouyinAdapter(
            appkey="app", secret="sec", transport=self.FakeTransport(responses)
        )

    def _default(self):
        return self._adapter(
            {
                "category/getCascade": self.CATEGORY,
                "product/addV2": self.OK,
                "product/listV2": {
                    "code": 10000,
                    "data": {"products": [{"product_id": "1", "name": "连衣裙"}], "total": 1},
                },
            }
        )

    def test_sign_deterministic(self):
        sig = target_douyin.doudian_sign({"b": "2", "a": "1"}, "secret")
        self.assertEqual(sig, target_douyin.doudian_sign({"a": "1", "b": "2"}, "secret"))
        self.assertEqual(len(sig), 32)
        self.assertNotEqual(sig, target_douyin.doudian_sign({"a": "1", "b": "2"}, "other"))

    def test_fetch_category_tree(self):
        adapter = self._default()
        tree = adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(tree[0]["name"], "服饰")
        self.assertEqual(tree[0]["children"][0]["name"], "女装")
        self.assertFalse(tree[0]["children"][0]["children"][0].get("children"))

    def test_match_category(self):
        adapter = self._default()
        adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        match = adapter.match_category({"title": "女装连衣裙 碎花"})
        self.assertEqual(match["category_id"], "111", "命中关键词取叶子类目")
        self.assertGreater(match["confidence"], 0)

    def test_map_fields(self):
        adapter = self._default()
        mapped = adapter.map_fields(
            {
                "title": "连衣裙",
                "price": 59.9,
                "stock": 30,
                "main_image": "https://img/1.jpg",
                "images": ["https://img/1.jpg"],
                "skus": [{"spec": "红"}],
                "detail": {"html": "<p>x</p>"},
            },
            "111",
        )
        self.assertEqual(mapped["missing"], [])
        self.assertEqual(mapped["data"]["market_price"], 5990, "价格转分")
        self.assertEqual(mapped["data"]["category_leaf_id"], "111")
        empty = adapter.map_fields({}, "")
        self.assertIn("name", empty["missing"])
        self.assertIn("skus", empty["missing"])

    def test_publish_update_listing(self):
        adapter = self._default()
        auth = {"access_token": "t"}
        data = {"name": "连衣裙", "category_leaf_id": "111", "pic": "https://img/1.jpg"}
        published = adapter.publish(data, auth)
        self.assertEqual(published["remote_id"], "9001")
        adapter.update_price("9001", 88.0, auth)
        adapter.set_listing("9001", False, auth)
        url, params = adapter.transport.calls[-1]
        self.assertIn("product/down", url)
        self.assertEqual(params["access_token"], "t")
        self.assertTrue(params["sign"])
        price_call = [c for c in adapter.transport.calls if "updatePrice" in c[0]][0][1]
        self.assertEqual(price_call["param_json"], '{"product_id":"9001","price":8800}')

    def test_list_listings(self):
        adapter = self._default()
        result = adapter.list_listings({"access_token": "t"})
        self.assertEqual(result["items"][0]["remote_id"], "1")
        self.assertIsNone(result["cursor"])

    def test_missing_app_credentials(self):
        adapter = target_douyin.TargetDouyinAdapter(transport=self.FakeTransport())
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_missing_shop_auth(self):
        adapter = self._default()
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"name": "x", "category_leaf_id": "111"}, {})
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_error_response_normalized(self):
        adapter = self._adapter(
            {"product/addV2": {"code": 40004, "message": "category qualification missing"}}
        )
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"name": "x", "category_leaf_id": "111"}, {"access_token": "t"})
        self.assertEqual(ctx.exception.code, registry.CATEGORY_RIGHTS)
        self.assertFalse(ctx.exception.retryable)

    def test_rate_limited_by_limiter(self):
        adapter = self._default()
        adapter.limiter = registry.RateLimiter(qps=1, clock=lambda: 1000.0)
        adapter.limiter.spend()
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(ctx.exception.code, registry.RATE_LIMITED)

    def test_rate_limiter_counting(self):
        adapter = self._default()
        adapter.limiter = registry.RateLimiter(qps=100, clock=lambda: 1000.0)
        adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(adapter.limiter.snapshot()["used"], 1)

    def test_contract_selfcheck(self):
        adapter = self._default()
        remote_id = base.assert_target_contract(adapter)
        self.assertEqual(remote_id, "9001")


class TaobaoTargetTest(unittest.TestCase):
    """淘宝目标适配器：扁平类目还原为树、字段映射、发布/改价/上下架与错误归一化。"""

    CATEGORY = {
        "itemcats_authorize_get_response": {
            "item_cats": {
                "item_cat": [
                    {"cid": 1, "parent_cid": 0, "name": "服饰", "is_parent": True},
                    {"cid": 11, "parent_cid": 1, "name": "女装", "is_parent": True},
                    {"cid": 111, "parent_cid": 11, "name": "连衣裙", "is_parent": False},
                    {"cid": 12, "parent_cid": 1, "name": "男装", "is_parent": True},
                    {"cid": 121, "parent_cid": 12, "name": "T恤", "is_parent": False},
                ]
            }
        }
    }
    ADD_OK = {"item_add_response": {"item": {"num_iid": 9001}}}
    ONSALE = {
        "items_onsale_get_response": {
            "items": {"item": [{"num_iid": 1, "title": "连衣裙", "price": "59.00", "num": 10}]},
            "total_results": 1,
        }
    }

    class FakeTransport:
        """单网关 POST：按 params['method'] 分派响应。"""

        def __init__(self, responses=None):
            self.calls = []
            self.responses = responses or {}

        def post(self, url, params):
            self.calls.append((url, dict(params)))
            method = params.get("method")
            for key, value in self.responses.items():
                if key == method:
                    return value(params) if callable(value) else value
            return {"itemcats_authorize_get_response": {"item_cats": {"item_cat": []}}}

    def _adapter(self, responses=None):
        return target_taobao.TargetTaobaoAdapter(
            appkey="app", secret="sec", transport=self.FakeTransport(responses)
        )

    def _default(self):
        return self._adapter(
            {
                "taobao.itemcats.authorize.get": self.CATEGORY,
                "taobao.item.add": self.ADD_OK,
                "taobao.items.onsale.get": self.ONSALE,
            }
        )

    def test_sign_deterministic(self):
        sig = target_taobao.top_sign({"b": "2", "a": "1"}, "secret")
        self.assertEqual(sig, target_taobao.top_sign({"a": "1", "b": "2"}, "secret"))
        self.assertEqual(len(sig), 32)
        self.assertEqual(sig, sig.upper(), "TOP md5 签名应为大写")
        self.assertNotEqual(sig, target_taobao.top_sign({"a": "1", "b": "2"}, "other"))
        self.assertNotEqual(sig, target_taobao.top_sign({"a": "1", "b": "2"}, "secret", "hmac"))

    def test_fetch_category_tree_builds_nesting(self):
        adapter = self._default()
        tree = adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(tree[0]["name"], "服饰")
        self.assertFalse(tree[0]["leaf"], "有子类目应为非叶子")
        self.assertEqual(tree[0]["children"][0]["name"], "女装")
        leaf = tree[0]["children"][0]["children"][0]
        self.assertEqual(leaf["name"], "连衣裙")
        self.assertTrue(leaf["leaf"])

    def test_match_category(self):
        adapter = self._default()
        adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        match = adapter.match_category({"title": "女装连衣裙 碎花"})
        self.assertEqual(match["category_id"], "111", "命中关键词取叶子类目")
        self.assertGreater(match["confidence"], 0)

    def test_map_fields(self):
        adapter = self._default()
        mapped = adapter.map_fields(
            {
                "title": "连衣裙",
                "price": 59.9,
                "stock": 30,
                "main_image": "https://img/1.jpg",
                "images": ["https://img/1.jpg"],
                "skus": [{"spec": "红"}],
                "detail": {"html": "<p>x</p>"},
            },
            "111",
        )
        self.assertEqual(mapped["missing"], [])
        self.assertEqual(mapped["data"]["price"], "59.90", "淘宝价格用元、保留两位")
        self.assertEqual(mapped["data"]["cid"], "111")
        self.assertEqual(mapped["data"]["num"], 30)
        empty = adapter.map_fields({}, "")
        self.assertIn("title", empty["missing"])
        self.assertIn("cid", empty["missing"])
        self.assertIn("skus", empty["missing"])

    def test_publish_update_listing(self):
        adapter = self._default()
        auth = {"access_token": "t"}
        data = {"title": "连衣裙", "cid": "111", "price": "59.90", "num": 30, "pic_path": "https://img/1.jpg"}
        published = adapter.publish(data, auth)
        self.assertEqual(published["remote_id"], "9001")
        adapter.update_price("9001", 88.0, auth)
        adapter.set_listing("9001", False, auth)
        url, params = adapter.transport.calls[-1]
        self.assertEqual(params["method"], "taobao.item.update.delisting")
        self.assertEqual(params["session"], "t")
        self.assertTrue(params["sign"])
        price_call = [c for c in adapter.transport.calls if c[1]["method"] == "taobao.item.update"][0][1]
        self.assertEqual(price_call["price"], "88.00")
        self.assertEqual(price_call["num_iid"], "9001")

    def test_list_listings(self):
        adapter = self._default()
        result = adapter.list_listings({"access_token": "t"})
        self.assertEqual(result["items"][0]["remote_id"], "1")
        self.assertIsNone(result["cursor"])

    def test_missing_app_credentials(self):
        adapter = target_taobao.TargetTaobaoAdapter(transport=self.FakeTransport())
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_missing_shop_auth(self):
        adapter = self._default()
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"title": "x", "cid": "111"}, {})
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_error_response_normalized(self):
        adapter = self._adapter(
            {
                "taobao.item.add": {
                    "error_response": {
                        "code": 15,
                        "sub_code": "isv.invalid-category",
                        "msg": "Remote service error",
                        "sub_msg": "category qualification missing",
                    }
                }
            }
        )
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.publish({"title": "x", "cid": "111"}, {"access_token": "t"})
        self.assertEqual(ctx.exception.code, registry.CATEGORY_RIGHTS)
        self.assertFalse(ctx.exception.retryable)

    def test_rate_limited_by_limiter(self):
        adapter = self._default()
        adapter.limiter = registry.RateLimiter(qps=1, clock=lambda: 1000.0)
        adapter.limiter.spend()
        with self.assertRaises(registry.EcomError) as ctx:
            adapter.fetch_category_tree({"shop_auth": {"access_token": "t"}})
        self.assertEqual(ctx.exception.code, registry.RATE_LIMITED)

    def test_contract_selfcheck(self):
        adapter = self._default()
        remote_id = base.assert_target_contract(adapter)
        self.assertEqual(remote_id, "9001")


class EcomApiTest(unittest.TestCase):
    owner = "api-user"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        store.configure(Path(self.tmp.name) / "ecom.db")
        store.ensure()
        registry.reset()
        jobs.install()

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, method, path, owner=None, **kw):
        return api.handle(method, path, owner or self.owner, **kw)

    def collect_one(self, source_id="10001"):
        status, payload = self.call(
            "POST", "/collect", body={"platform": "mock", "urls": [source_id]}
        )
        self.assertEqual(status, 200)
        queue.run_task(self.owner, payload["task"]["id"])
        _, listing = self.call("GET", "/products")
        return listing["items"][0]["id"]

    def authorized_shop(self, shop_id="s1"):
        shop = self.call("POST", "/shops", body={"platform": "mock", "name": "店", "shop_id": shop_id})[1]["shop"]
        shop = self.call("POST", "/shops/auth", body={"id": shop["id"], "access_token": "tok"})[1]["shop"]
        return shop

    def test_stats_default(self):
        status, payload = self.call("GET", "/stats")
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["products"], 0)

    def test_unknown_route_and_missing_product(self):
        self.assertEqual(self.call("GET", "/nope")[0], 404)
        self.assertEqual(self.call("GET", "/products/missing")[0], 404)
        self.assertEqual(self.call("GET", "/collect/missing")[0], 404)
        payload = self.call("GET", "/nope")[1]
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["code"], "not_found")

    def test_collect_saves_product_skus_media(self):
        product_id = self.collect_one()
        product = self.call("GET", "/products/%s" % product_id)[1]
        self.assertEqual(product["product"]["title"], "女装连衣裙 碎花")
        self.assertEqual(len(product["skus"]), 2)
        self.assertGreaterEqual(len(product["media"]), 2)
        self.assertEqual(self.call("GET", "/products", query={"keyword": "连衣裙"})[1]["total"], 1)

    def test_collect_validates_input(self):
        self.assertEqual(self.call("POST", "/collect", body={})[0], 400)
        self.assertEqual(self.call("POST", "/collect", body={"mode": "shop"})[0], 400)

    def test_collect_shop_mode_counts(self):
        payload = self.call(
            "POST", "/collect", body={"platform": "mock", "shop_url": "https://shop.example.com", "mode": "shop"}
        )[1]
        queue.run_task(self.owner, payload["task"]["id"])
        task = self.call("GET", "/tasks/%s" % payload["task"]["id"])[1]["task"]
        self.assertEqual(task["status"], "succeeded")
        self.assertEqual(self.call("GET", "/products")[1]["total"], 3)

    def test_scheduled_task_status(self):
        future = time.time() + 3600
        payload = self.call(
            "POST", "/collect", body={"platform": "mock", "urls": ["10002"], "schedule": {"mode": "at", "at": future}}
        )[1]
        self.assertEqual(payload["task"]["status"], "scheduled")

    def test_products_pagination_bounds(self):
        for i in range(3):
            store.insert("products", self.owner, {"title": "商品%d" % i})
        payload = self.call("GET", "/products", query={"page": "1", "page_size": "500"})[1]
        self.assertEqual(payload["page_size"], 100)
        self.assertEqual(payload["total"], 3)

    def test_product_edit_and_batch_snapshot(self):
        product_id = self.collect_one()
        edited = self.call("PATCH", "/products/%s" % product_id, body={"title": "新标题", "price": 12.5})[1]
        self.assertEqual(edited["product"]["title"], "新标题")
        self.assertEqual(edited["product"]["price"], 12.5)
        versions = store.list_rows("product_versions", self.owner, where="product_id=?", params=(product_id,))
        self.assertEqual(len(versions), 1)
        batch = self.call("POST", "/products/batch", body={"ids": [product_id], "patch": {"subtitle": "批发"}})[1]
        self.assertEqual(batch["updated"], 1)
        self.assertEqual(store.get("products", self.owner, product_id)["subtitle"], "批发")

    def test_products_batch_requires_payload(self):
        product_id = self.collect_one()
        self.assertEqual(self.call("POST", "/products/batch", body={"ids": []})[0], 400)
        self.assertEqual(self.call("POST", "/products/batch", body={"ids": [product_id]})[0], 400)

    def test_shop_crud_and_auth(self):
        shop = self.call("POST", "/shops", body={"platform": "mock", "name": "A", "shop_id": "s1"})[1]["shop"]
        self.assertEqual(shop["auth_status"], "unauthorized")
        authed = self.call("POST", "/shops/auth", body={"id": shop["id"], "access_token": "tok"})[1]["shop"]
        self.assertEqual(authed["auth_status"], "normal")
        self.assertEqual(self.call("GET", "/shops")[1]["total"], 1)
        self.assertEqual(self.call("DELETE", "/shops/%s" % shop["id"])[1]["removed"], True)
        self.assertEqual(self.call("DELETE", "/shops/%s" % shop["id"])[0], 404)

    def test_shop_auth_creates_when_missing(self):
        shop = self.call(
            "POST", "/shops/auth", body={"name": "新店", "shop_id": "s9", "access_token": "tok"}
        )[1]["shop"]
        self.assertEqual(shop["auth_status"], "normal")

    def test_shop_groups(self):
        self.assertEqual(self.call("POST", "/shop-groups", body={"name": "女装群"})[0], 200)
        self.assertEqual(self.call("GET", "/shop-groups")[1]["total"], 1)

    def test_publish_flow_idempotent(self):
        product_id = self.collect_one()
        shop = self.authorized_shop()
        payload = self.call(
            "POST",
            "/publish",
            body={
                "product_ids": [product_id],
                "shop_ids": [shop["id"]],
                "platform": "mock",
                "strategy": {"price_rule": {"mode": "ratio", "value": 1.5}},
            },
        )[1]
        self.assertEqual(payload["item_count"], 1)
        queue.run_task(self.owner, payload["task"]["id"])
        detail = self.call("GET", "/products/%s" % product_id)[1]
        self.assertEqual(len(detail["listings"]), 1)
        self.assertTrue(detail["listings"][0]["remote_id"].startswith("mock-"))
        self.assertEqual(detail["listings"][0]["price"], 88.5)
        again = self.call(
            "POST",
            "/publish",
            body={"product_ids": [product_id], "shop_ids": [shop["id"]], "platform": "mock"},
        )[1]
        self.assertEqual(again["deduped"], 1)
        self.assertEqual(again["item_count"], 0)

    def test_publish_requires_shop_and_products(self):
        self.assertEqual(self.call("POST", "/publish", body={"product_ids": ["x"]})[0], 400)
        self.assertEqual(self.call("POST", "/publish", body={"shop_ids": ["s"]})[0], 400)

    def test_publish_fails_without_auth(self):
        product_id = self.collect_one()
        shop = self.call("POST", "/shops", body={"platform": "mock", "shop_id": "s2"})[1]["shop"]
        payload = self.call(
            "POST",
            "/publish",
            body={"product_ids": [product_id], "shop_ids": [shop["id"]], "platform": "mock"},
        )[1]
        task = queue.run_task(self.owner, payload["task"]["id"])
        self.assertEqual(task["status"], "failed")
        detail = self.call("GET", "/tasks/%s" % payload["task"]["id"])[1]
        self.assertEqual(detail["items"][0]["status"], "failed")
        self.assertIn("授权", detail["items"][0]["error"])

    def test_price_adjust_listings(self):
        product_id = self.collect_one()
        shop = self.authorized_shop()
        pub = self.call(
            "POST",
            "/publish",
            body={"product_ids": [product_id], "shop_ids": [shop["id"]], "platform": "mock"},
        )[1]
        queue.run_task(self.owner, pub["task"]["id"])
        task = self.call(
            "POST",
            "/price/adjust",
            body={
                "product_ids": [product_id],
                "scope": "listings",
                "shop_ids": [shop["id"]],
                "platform": "mock",
                "rule": {"mode": "fixed", "value": 10, "round": "end9"},
            },
        )[1]
        queue.run_task(self.owner, task["task"]["id"])
        listing = self.call("GET", "/products/%s" % product_id)[1]["listings"][0]
        self.assertEqual(listing["price"], 69.9)

    def test_price_adjust_products_scope(self):
        product_id = self.collect_one()
        task = self.call(
            "POST",
            "/price/adjust",
            body={"product_ids": [product_id], "rule": {"mode": "fixed", "value": 1.1}},
        )[1]
        queue.run_task(self.owner, task["task"]["id"])
        self.assertEqual(store.get("products", self.owner, product_id)["price"], 60.1)

    def test_listing_batch_toggles(self):
        product_id = self.collect_one()
        shop = self.authorized_shop()
        pub = self.call(
            "POST",
            "/publish",
            body={"product_ids": [product_id], "shop_ids": [shop["id"]], "platform": "mock"},
        )[1]
        queue.run_task(self.owner, pub["task"]["id"])
        task = self.call(
            "POST",
            "/listing/batch",
            body={"product_ids": [product_id], "shop_ids": [shop["id"]], "platform": "mock", "on": False},
        )[1]
        queue.run_task(self.owner, task["task"]["id"])
        self.assertEqual(self.call("GET", "/products/%s" % product_id)[1]["listings"][0]["status"], "off")

    def test_compliance_check_sync(self):
        product_id = self.collect_one()
        self.call("PATCH", "/products/%s" % product_id, body={"title": "厂家直供 连衣裙"})
        payload = self.call("POST", "/compliance/check", body={"product_ids": [product_id]})[1]
        self.assertEqual(payload["verdict"], "warn")
        self.assertEqual(payload["reports"][0]["verdict"], "warn")
        self.call("PATCH", "/products/%s" % product_id, body={"title": "国家级 最佳 连衣裙"})
        blocked = self.call("POST", "/compliance/check", body={"product_ids": [product_id]})[1]
        self.assertEqual(blocked["verdict"], "block")

    def test_publish_precheck_dimensions(self):
        product_id = self.collect_one()
        payload = self.call(
            "POST", "/publish/precheck", body={"product_ids": [product_id], "platform": "mock"}
        )[1]
        self.assertEqual(payload["verdict"], "pass")
        dims = {i["dimension"]: i for i in payload["items"]}
        self.assertEqual(set(dims), {"category", "title", "image", "price", "compliance"})
        self.call("PATCH", "/products/%s" % product_id, body={"title": "厂家直供 连衣裙"})
        warned = self.call(
            "POST", "/publish/precheck", body={"product_ids": [product_id], "platform": "mock"}
        )[1]
        self.assertEqual(warned["verdict"], "warn")
        self.call("PATCH", "/products/%s" % product_id, body={"main_image": "", "images": []})
        failed = self.call(
            "POST", "/publish/precheck", body={"product_ids": [product_id], "platform": "mock"}
        )[1]
        self.assertEqual(failed["verdict"], "fail")

    def test_tasks_list_detail_retry_pause(self):
        product_id = self.collect_one()
        payload = self.call("GET", "/tasks")[1]
        self.assertEqual(payload["total"], 1)
        task_id = payload["items"][0]["id"]
        detail = self.call("GET", "/tasks/%s" % task_id)[1]
        self.assertEqual(detail["task"]["kind"], "collect")
        self.assertEqual(len(detail["items"]), 1)
        self.assertEqual(self.call("POST", "/tasks/%s/pause" % task_id)[1]["task"]["status"], "paused")
        self.assertEqual(self.call("POST", "/tasks/%s/retry" % task_id)[0], 200)
        self.assertEqual(self.call("POST", "/tasks/missing/pause")[0], 404)

    def test_assets_and_generate_tasks(self):
        product_id = self.collect_one()
        assets = self.call(
            "POST", "/assets/process", body={"product_ids": [product_id], "recipe": "白底", "ops": ["matte"]}
        )[1]
        queue.run_task(self.owner, assets["task"]["id"])
        self.assertEqual(self.call("GET", "/tasks/%s" % assets["task"]["id"])[1]["task"]["status"], "succeeded")
        gen = self.call("POST", "/generate", body={"product_ids": [product_id], "types": ["main", "scene"]})[1]
        self.assertEqual(gen["item_count"], 2)

    def test_assets_requires_target(self):
        self.assertEqual(self.call("POST", "/assets/process", body={})[0], 400)
        self.assertEqual(self.call("POST", "/generate", body={})[0], 400)

    def test_product_detail_returns_versions(self):
        product_id = self.collect_one()
        self.call("PATCH", "/products/%s" % product_id, body={"title": "改名后"})
        detail = self.call("GET", "/products/%s" % product_id)[1]
        self.assertEqual(detail["product"]["title"], "改名后")
        self.assertGreaterEqual(len(detail["versions"]), 1)
        self.assertEqual(detail["versions"][0]["note"], "编辑")

    def test_assets_list_filters(self):
        product_id = self.collect_one()
        all_media = self.call("GET", "/assets")[1]
        self.assertGreaterEqual(all_media["total"], 2)
        self.assertEqual(len(all_media["items"]), all_media["total"])
        by_product = self.call("GET", "/assets", query={"product_id": product_id})[1]
        self.assertEqual(by_product["total"], all_media["total"])
        images = self.call("GET", "/assets", query={"kind": "image"})[1]
        self.assertEqual(images["total"], all_media["total"])
        self.assertEqual(self.call("GET", "/assets", query={"kind": "video"})[1]["total"], 0)
        self.assertEqual(self.call("GET", "/assets", query={"source": "collected"})[1]["total"], all_media["total"])
        bounded = self.call("GET", "/assets", query={"page_size": "1"})[1]
        self.assertEqual(bounded["page_size"], 1)
        self.assertEqual(len(bounded["items"]), 1)

    def test_assets_recipes_catalog(self):
        status, payload = self.call("GET", "/assets/recipes")
        self.assertEqual(status, 200)
        recipe_ids = [r["id"] for r in payload["recipes"]]
        self.assertIn("white", recipe_ids)
        self.assertIn("suite", recipe_ids)
        self.assertTrue(any(p["id"] == "cutout" for p in payload["processors"]))
        self.assertTrue(any(s["id"] == "main_square" for s in payload["sizes"]))
        self.assertIn("douyin", payload["platforms"])

    def test_assets_process_sync_derives_media(self):
        product_id = self.collect_one()
        before = self.call("GET", "/assets", query={"source": "collected"})[1]["total"]
        payload = self.call(
            "POST",
            "/assets/process",
            body={
                "product_ids": [product_id],
                "recipe": "white",
                "ops": ["cutout", "white_bg"],
                "size": "800x800",
                "platform": "douyin",
                "sync": True,
            },
        )[1]
        self.assertEqual(payload["task"]["status"], "succeeded")
        self.assertEqual(len(payload["outputs"]), 1)
        out = payload["outputs"][0]
        self.assertEqual(out["role"], "white")
        self.assertEqual((out["width"], out["height"]), (800, 800))
        edited = self.call("GET", "/assets", query={"source": "edit"})[1]
        self.assertEqual(edited["total"], 1)
        self.assertGreater(self.call("GET", "/assets")[1]["total"], before)

    def test_assets_process_is_idempotent(self):
        product_id = self.collect_one()
        body = {
            "product_ids": [product_id],
            "recipe": "suite",
            "size": "750x1000",
            "platform": "douyin",
            "sync": True,
        }
        first = self.call("POST", "/assets/process", body=body)[1]["outputs"]
        second = self.call("POST", "/assets/process", body=body)[1]["outputs"]
        self.assertEqual(len(first), 4)
        self.assertEqual([o["media_id"] for o in first], [o["media_id"] for o in second])
        self.assertEqual(self.call("GET", "/assets", query={"source": "edit"})[1]["total"], 4)

    def test_assets_process_media_source(self):
        self.collect_one()
        media = self.call("GET", "/assets", query={"source": "collected"})[1]["items"][0]
        payload = self.call(
            "POST",
            "/assets/process",
            body={"media_ids": [media["id"]], "recipe": "poster", "sync": True},
        )[1]
        self.assertEqual(payload["outputs"][0]["role"], "poster")

    def test_owner_isolation(self):
        self.collect_one()
        self.assertEqual(self.call("GET", "/products", owner="other")[1]["total"], 0)

    def test_unregistered_platform_fails_task(self):
        payload = self.call(
            "POST", "/collect", body={"platform": "not-registered", "urls": ["10001"]}
        )[1]
        task = queue.run_task(self.owner, payload["task"]["id"])
        self.assertEqual(task["status"], "failed")
        detail = self.call("GET", "/tasks/%s" % payload["task"]["id"])[1]
        self.assertIn("未注册", detail["items"][0]["error"])


class PluginCollectTest(unittest.TestCase):
    """插件采集：口令、collect/ingest、图片转存与 SSRF 防护。"""

    owner = "plugin-user"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        store.configure(Path(self.tmp.name) / "ecom.db")
        store.ensure()
        registry.reset()
        jobs.install()
        # install() 会按 store.DATA_DIR 重设口令/媒体路径，必须放在它之后
        tokens.configure(Path(self.tmp.name) / "ecom_tokens.json")
        media.configure(media_dir=Path(self.tmp.name) / "media", base="http://test.local")

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, method, path, owner=None, **kw):
        return api.handle(method, path, owner or self.owner, **kw)

    def raw_item(self, source_id="10001", **over):
        item = {
            "source_id": source_id,
            "source_url": "https://detail.1688.com/offer/%s.html" % source_id,
            "title": "插件采集 连衣裙",
            "price": 12.5,
            "main_image": "https://cbu01.alicdn.com/img/a.jpg",
            "images": ["https://cbu01.alicdn.com/img/a.jpg"],
            "skus": [{"spec": "红色", "price": 12.5, "stock": 5}],
        }
        item.update(over)
        return item

    def test_token_lifecycle(self):
        self.assertIsNone(tokens.info(self.owner))
        token = tokens.mint(self.owner, note="测试")
        self.assertTrue(token.startswith("xlx_"))
        self.assertEqual(tokens.owner_of(token), self.owner)
        self.assertIsNone(tokens.owner_of("xlx_bad"))
        info = tokens.info(self.owner)
        self.assertEqual(info["owner"], self.owner)
        self.assertEqual(info["prefix"], token[:8])
        # 重复 mint 覆盖旧口令
        second = tokens.mint(self.owner)
        self.assertIsNone(tokens.owner_of(token))
        self.assertEqual(tokens.owner_of(second), self.owner)
        # 撤销后失效
        self.assertTrue(tokens.revoke(self.owner))
        self.assertFalse(tokens.revoke(self.owner))
        self.assertIsNone(tokens.owner_of(second))

    def test_plugin_token_api(self):
        status, payload = self.call("POST", "/plugin/token", body={"note": ""})
        self.assertEqual(status, 200)
        self.assertTrue(payload["token"].startswith("xlx_"))
        self.assertTrue(payload["active"])
        status, payload = self.call("GET", "/plugin/token")
        self.assertTrue(payload["active"])
        self.assertNotIn("token", payload, "状态接口不得回明文")
        status, payload = self.call("DELETE", "/plugin/token")
        self.assertTrue(payload["removed"])
        self.assertFalse(self.call("GET", "/plugin/token")[1]["active"])

    def test_ingest_saves_and_enqueues_media(self):
        token = tokens.mint(self.owner)
        self.assertIsNotNone(tokens.owner_of(token))
        status, payload = self.call(
            "POST", "/collect/ingest",
            body={"platform": "1688", "items": [self.raw_item(), self.raw_item("10002")]},
        )
        self.assertEqual(status, 200)
        self.assertEqual((payload["count"], payload["saved"], payload["failed"]), (2, 2, 0))
        self.assertTrue(payload["media_task_id"], "入库后应入队图片转存任务")
        task = self.call("GET", "/tasks/%s" % payload["media_task_id"])[1]["task"]
        self.assertEqual(task["kind"], "media_fetch")
        listing = self.call("GET", "/products", query={"platform": "1688"})[1]
        self.assertEqual(listing["total"], 2)

    def test_ingest_partial_failure_keeps_good_items(self):
        status, payload = self.call(
            "POST", "/collect/ingest",
            body={
                "platform": "1688",
                "items": [
                    self.raw_item(),
                    {"source_id": "", "title": "缺 id"},
                    {"source_id": "10003", "title": ""},
                    "not-a-dict",
                ],
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual((payload["saved"], payload["failed"]), (1, 3))
        self.assertEqual(len(payload["errors"]), 3)
        self.assertEqual(self.call("GET", "/products")[1]["total"], 1, "坏条目不落库")

    def test_ingest_idempotent(self):
        item = self.raw_item()
        first = self.call("POST", "/collect/ingest", body={"platform": "1688", "items": [item]})[1]
        second = self.call("POST", "/collect/ingest", body={"platform": "1688", "items": [dict(item, title="改标题")]})[1]
        self.assertEqual(first["results"][0]["product_id"], second["results"][0]["product_id"])
        self.assertEqual(self.call("GET", "/products")[1]["total"], 1)

    def test_ingest_validates(self):
        self.assertEqual(self.call("POST", "/collect/ingest", body={})[0], 400)
        self.assertEqual(self.call("POST", "/collect/ingest", body={"platform": "1688"})[0], 400)
        self.assertEqual(
            self.call("POST", "/collect/ingest", body={"platform": "pdd", "items": [self.raw_item()]})[0], 400
        )
        self.assertEqual(
            self.call(
                "POST", "/collect/ingest",
                body={"platform": "1688", "items": [self.raw_item(i) for i in range(201)]},
            )[0], 400,
        )

    def test_media_ssrf_guard(self):
        for bad in [
            "http://127.0.0.1/x.jpg",
            "http://localhost/x.jpg",
            "http://192.168.1.1/x.jpg",
            "http://10.0.0.1/x.jpg",
            "file:///etc/passwd",
            "ftp://example.com/x.jpg",
            "http://[fd00::1]/x.jpg",
            "not a url",
        ]:
            self.assertFalse(media.is_safe_url(bad), bad)

    def test_media_cache_and_public_route_shape(self):
        product = store.insert(
            "products", self.owner,
            {"title": "图", "main_image": "https://cbu01.alicdn.com/img/a.jpg"},
        )
        row = store.insert(
            "media", self.owner,
            {
                "product_id": product["id"],
                "kind": "image",
                "url": "https://cbu01.alicdn.com/img/a.jpg",
                "source_url": "https://cbu01.alicdn.com/img/a.jpg",
                "source_type": "main",
            },
        )
        # 不安全地址直接拒绝且不落盘
        bad = media.cache_image(self.owner, dict(row, source_url="http://127.0.0.1/a.jpg"))
        self.assertIn("error", bad)
        # 本地文件缓存 + 公开地址改写
        body = b"fake-jpeg-bytes"
        digest = hashlib.sha1(body).hexdigest()
        path = media.MEDIA_DIR / self.owner / (digest + ".jpg")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        got = media.serve(row["id"])
        self.assertIsNone(got, "local_path 未写时应 404")
        store.update(
            "media", self.owner, row["id"],
            {"local_path": str(path), "url": media.public_url(row["id"])},
        )
        ctype, data = media.serve(row["id"])
        self.assertEqual(ctype, "image/jpeg")
        self.assertEqual(data, body)
        self.assertEqual(media.public_url(row["id"]), "http://test.local/dian/api/ecom/media/%s" % row["id"])
        result = media.cache_product_media(self.owner, product["id"], "1688")
        self.assertEqual(result["ok"], 1, "已缓存文件应跳过下载")
        refreshed = store.get("products", self.owner, product["id"])
        self.assertEqual(refreshed["main_image"], media.public_url(row["id"]))

    def test_media_fetch_handler_runs(self):
        product = store.insert("products", self.owner, {"title": "任务"})
        payload = self.call(
            "POST", "/collect/ingest",
            body={"platform": "1688", "items": [self.raw_item()]},
        )[1]
        pid = payload["results"][0]["product_id"]
        task = queue.run_task(self.owner, payload["media_task_id"])
        self.assertEqual(task["status"], "succeeded")
        self.assertGreaterEqual(task["done"], 1)
        self.assertTrue(store.get("products", self.owner, pid)["id"])


class JobsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        store.configure(Path(self.tmp.name) / "ecom.db")
        store.ensure()

    def tearDown(self):
        self.tmp.cleanup()

    def test_compute_price_modes(self):
        self.assertEqual(jobs.compute_price(50, {"mode": "fixed", "value": 10}), 60.0)
        self.assertEqual(jobs.compute_price(50, {"mode": "ratio", "value": 1.5}), 75.0)
        self.assertEqual(jobs.compute_price(50, {"mode": "fixed", "value": 5, "round": "up"}), 55.0)
        self.assertEqual(jobs.compute_price(50, {"mode": "fixed", "value": 10, "round": "end9"}), 60.9)
        self.assertEqual(jobs.compute_price(50, {"mode": "fixed", "value": -80, "min_price": 19.9}), 19.9)

    def test_title_rules_and_b_end_words(self):
        self.assertEqual(jobs.apply_title_rules("厂家直供 连衣裙", {}), "品质优选 连衣裙")
        self.assertEqual(
            jobs.apply_title_rules("连衣裙", {"prefix": "【新款】", "suffix": " 包邮"}),
            "【新款】连衣裙 包邮",
        )
        self.assertEqual(jobs.apply_title_rules("一件代发 批发", {"map": {"批发": "热卖"}}), "急速发货 热卖")

    def test_check_compliance_levels(self):
        verdict, hits = jobs.check_compliance("普通连衣裙")
        self.assertEqual(verdict, "pass")
        self.assertEqual(hits, [])
        verdict, _ = jobs.check_compliance("nike 连衣裙")
        self.assertEqual(verdict, "block")
        verdict, _ = jobs.check_compliance("厂家直供 连衣裙")
        self.assertEqual(verdict, "warn")

    def test_shop_auth_requires_token(self):
        owner = "j1"
        shop = store.insert(
            "shops", owner, {"name": "x", "shop_id": "s1", "auth_status": "expired"}
        )
        with self.assertRaises(registry.EcomError) as ctx:
            jobs._shop_auth(owner, shop["id"])
        self.assertEqual(ctx.exception.code, registry.AUTH_EXPIRED)

    def test_ensure_adapters_registers_mock(self):
        registry.reset()
        jobs.ensure_adapters()
        self.assertIn("mock", registry.REGISTRY.sources())
        self.assertIn("mock", registry.REGISTRY.targets())

    def test_ensure_adapters_registers_taobao_with_credentials(self):
        registry.reset()
        os.environ["ECOM_TAOBAO_APPKEY"] = "app"
        os.environ["ECOM_TAOBAO_APPSECRET"] = "sec"
        try:
            jobs.ensure_adapters()
        finally:
            os.environ.pop("ECOM_TAOBAO_APPKEY", None)
            os.environ.pop("ECOM_TAOBAO_APPSECRET", None)
        self.assertIn("taobao", registry.REGISTRY.targets())
        self.assertEqual(registry.target("taobao").platform, "taobao")


if __name__ == "__main__":
    unittest.main()
