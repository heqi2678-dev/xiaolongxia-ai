#!/usr/bin/python3
"""电商工作台 · 数据层与任务队列测试（gate/ecom/store.py、gate/ecom/queue.py）。

运行：cd gate && python3 -m unittest test_ecom
"""
import tempfile
import time
import unittest
from pathlib import Path

from ecom import queue, store


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


if __name__ == "__main__":
    unittest.main()
