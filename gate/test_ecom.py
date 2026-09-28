#!/usr/bin/python3
"""电商工作台 · 数据层测试（gate/ecom/store.py）。

运行：cd gate && python3 -m unittest test_ecom
"""
import tempfile
import unittest
from pathlib import Path

from ecom import store


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
        store.insert("tasks", "u1", {"kind": "collect", "status": "done"})
        store.insert("tasks", "u1", {"kind": "collect", "status": "failed"})
        store.insert("tasks", "u1", {"kind": "collect", "status": "running"})
        summary = store.stats("u1")
        self.assertEqual(summary["media"], 1)
        self.assertEqual(summary["tasks_done"], 1)
        self.assertEqual(summary["tasks_failed"], 1)
        self.assertEqual(summary["tasks_pending"], 1)

    def test_latest_report(self):
        store.insert(
            "compliance_reports",
            "u1",
            {"product_id": "p1", "target_platform": "douyin", "risk_level": "pass", "checked_at": 1},
        )
        store.insert(
            "compliance_reports",
            "u1",
            {"product_id": "p1", "target_platform": "douyin", "risk_level": "block", "checked_at": 2},
        )
        report = store.latest_report("u1", "p1", "douyin")
        self.assertEqual(report["risk_level"], "block", "取最近一次检测结论")


if __name__ == "__main__":
    unittest.main()
