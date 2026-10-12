#!/usr/bin/python3
"""铺货后端存储层：SQLite 的建表、连接与基础读写。

只依赖标准库 sqlite3。每次操作开一条连接（WAL 模式），避免多线程共用连接。
商品与发布任务的业务字段统一以 JSON 文本存 payload，便于模型演进。
"""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source_platform, source_item_id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  platform_item_id TEXT,
  payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status, created_at);
CREATE TABLE IF NOT EXISTS tokens (
  platform TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
"""


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id(prefix="p"):
    return "%s_%s" % (prefix, uuid.uuid4().hex[:12])


class Store:
    def __init__(self, db_path):
        self.db_path = str(db_path)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init(self):
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    # ---- 商品 ----
    def upsert_product(self, product):
        plat = product["source"]["platform"]
        item = product["source"]["itemId"]
        ts = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, created_at FROM products WHERE source_platform=? AND source_item_id=?",
                (plat, item),
            ).fetchone()
            if row:
                product["id"] = pid = row["id"]
                created = row["created_at"]
            else:
                pid = product["id"]
                created = ts
            conn.execute(
                "INSERT INTO products (id, source_platform, source_item_id, payload, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?)"
                " ON CONFLICT(id) DO UPDATE SET source_platform=excluded.source_platform,"
                " source_item_id=excluded.source_item_id, payload=excluded.payload, updated_at=excluded.updated_at",
                (
                    pid,
                    product["source"]["platform"],
                    product["source"]["itemId"],
                    json.dumps(product, ensure_ascii=False),
                    created,
                    ts,
                ),
            )
        product["createdAt"] = created
        product["updatedAt"] = ts
        return product

    def get_product(self, pid):
        with self._connect() as conn:
            row = conn.execute("SELECT payload FROM products WHERE id=?", (pid,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def find_product_by_source(self, platform, item_id):
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload FROM products WHERE source_platform=? AND source_item_id=?",
                (platform, item_id),
            ).fetchone()
        return json.loads(row["payload"]) if row else None

    def list_products(self, limit=100, offset=0, q=None, source=None):
        where = []
        args = []
        if q:
            where.append("payload LIKE ?")
            args.append("%" + q + "%")
        if source:
            where.append("source_platform = ?")
            args.append(source)
        clause = (" WHERE " + " AND ".join(where)) if where else ""
        sql = "SELECT payload FROM products%s ORDER BY updated_at DESC LIMIT ? OFFSET ?" % clause
        with self._connect() as conn:
            rows = conn.execute(sql, args + [limit, offset]).fetchall()
        return [json.loads(r["payload"]) for r in rows]

    def count_products(self, q=None, source=None):
        where = []
        args = []
        if q:
            where.append("payload LIKE ?")
            args.append("%" + q + "%")
        if source:
            where.append("source_platform = ?")
            args.append(source)
        clause = (" WHERE " + " AND ".join(where)) if where else ""
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM products%s" % clause, args).fetchone()
        return row["n"]

    def delete_product(self, pid):
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM products WHERE id=?", (pid,))
        return cur.rowcount > 0

    # ---- 任务 ----
    def insert_task(self, task):
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO tasks (id, product_id, platform, status, attempts, last_error,"
                " platform_item_id, payload, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    task["id"],
                    task["productId"],
                    task["platform"],
                    task["status"],
                    task.get("attempts", 0),
                    task.get("lastError"),
                    task.get("platformItemId"),
                    json.dumps(task.get("payload") or {}, ensure_ascii=False),
                    task["createdAt"],
                    task["updatedAt"],
                ),
            )
        return task

    def update_task(self, tid, **fields):
        if not fields:
            return None
        cols = []
        vals = []
        for k, v in fields.items():
            col = {
                "status": "status",
                "attempts": "attempts",
                "lastError": "last_error",
                "platformItemId": "platform_item_id",
            }.get(k)
            if col is None:
                continue
            if k == "lastError":
                cols.append("last_error=?")
                vals.append(v)
                continue
            cols.append("%s=?" % col)
            vals.append(v)
        cols.append("updated_at=?")
        vals.append(now_iso())
        vals.append(tid)
        with self._connect() as conn:
            conn.execute("UPDATE tasks SET %s WHERE id=?" % ",".join(cols), vals)
        return self.get_task(tid)

    def _task_row(self, row):
        return {
            "id": row["id"],
            "productId": row["product_id"],
            "platform": row["platform"],
            "status": row["status"],
            "attempts": row["attempts"],
            "lastError": row["last_error"],
            "platformItemId": row["platform_item_id"],
            "payload": json.loads(row["payload"]) if row["payload"] else {},
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def get_task(self, tid):
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        return self._task_row(row) if row else None

    def list_tasks(self, status=None, limit=100):
        with self._connect() as conn:
            if status:
                rows = conn.execute(
                    "SELECT * FROM tasks WHERE status=? ORDER BY created_at LIMIT ?",
                    (status, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
                ).fetchall()
        return [self._task_row(r) for r in rows]

    def next_pending_task(self):
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM tasks WHERE status='pending' ORDER BY created_at LIMIT 1"
            ).fetchone()
        return self._task_row(row) if row else None

    def count_pending(self):
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM tasks WHERE status='pending'").fetchone()
        return row["n"]

    def requeue_task(self, tid):
        with self._connect() as conn:
            row = conn.execute("SELECT status FROM tasks WHERE id=?", (tid,)).fetchone()
            if not row:
                return None
            conn.execute(
                "UPDATE tasks SET status='pending', last_error=NULL, updated_at=? WHERE id=?",
                (now_iso(), tid),
            )
        return self.get_task(tid)

    # ---- 授权令牌 ----
    def set_token(self, platform, payload):
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO tokens (platform, payload, updated_at) VALUES (?,?,?)"
                " ON CONFLICT(platform) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at",
                (platform, json.dumps(payload, ensure_ascii=False), now_iso()),
            )
        return payload

    def get_token(self, platform):
        with self._connect() as conn:
            row = conn.execute("SELECT payload FROM tokens WHERE platform=?", (platform,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def delete_token(self, platform):
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM tokens WHERE platform=?", (platform,))
        return cur.rowcount > 0

    def list_tokens(self):
        with self._connect() as conn:
            rows = conn.execute("SELECT platform, payload, updated_at FROM tokens").fetchall()
        return [
            {"platform": r["platform"], "token": json.loads(r["payload"]), "updatedAt": r["updated_at"]}
            for r in rows
        ]
