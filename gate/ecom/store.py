#!/usr/bin/python3
"""电商工作台 · 数据层（SQLite 建表 + DAO）。

与 gate/server.py 的 drama.db 分离，默认落在 ``DATA_DIR/ecom.db``，
可用环境变量 ``ECOM_DB`` 或 :func:`configure` 指向别处（测试用）。

约定：
- 每张业务表都以 ``owner`` 作用域隔离，DAO 全部显式带 owner 条件。
- JSON 列在写入时接受 Python 对象并自动 ``json.dumps``，读取时自动 ``json.loads``。
- ``id`` 由 :func:`new_id` 生成（可带业务前缀），调用方也可自带 id。
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", "/home/admin/work/xiaolongxia-gate-data"))
DB_PATH = Path(os.environ.get("ECOM_DB", str(DATA_DIR / "ecom.db")))

_lock = threading.Lock()
_ready = False

_J = "TEXT NOT NULL DEFAULT '{}'"
_A = "TEXT NOT NULL DEFAULT '[]'"


def _col(name, decl):
    return (name, decl)


# 表结构定义：cols 为有序列，json 列出需编解码的列，ts 列出自动写入时间戳的列。
SCHEMA = {
    "shop_groups": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("name", "TEXT NOT NULL DEFAULT ''"),
            _col("remark", "TEXT NOT NULL DEFAULT ''"),
            _col("created_at", "REAL NOT NULL"),
        ],
        "json": [],
        "ts": ["created_at"],
    },
    "shops": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("group_id", "TEXT NOT NULL DEFAULT ''"),
            _col("platform", "TEXT NOT NULL DEFAULT 'douyin'"),
            _col("name", "TEXT NOT NULL DEFAULT ''"),
            _col("shop_id", "TEXT NOT NULL DEFAULT ''"),
            _col("auth_status", "TEXT NOT NULL DEFAULT 'unauthorized'"),
            _col("auth_json", _J),
            _col("created_at", "REAL NOT NULL"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": ["auth_json"],
        "ts": ["created_at", "updated_at"],
    },
    "products": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("source_platform", "TEXT NOT NULL DEFAULT '1688'"),
            _col("source_id", "TEXT NOT NULL DEFAULT ''"),
            _col("source_url", "TEXT NOT NULL DEFAULT ''"),
            _col("title", "TEXT NOT NULL DEFAULT ''"),
            _col("subtitle", "TEXT NOT NULL DEFAULT ''"),
            _col("category", "TEXT NOT NULL DEFAULT ''"),
            _col("price", "REAL NOT NULL DEFAULT 0"),
            _col("stock", "INTEGER NOT NULL DEFAULT 0"),
            _col("main_image", "TEXT NOT NULL DEFAULT ''"),
            _col("images_json", _A),
            _col("detail_json", _J),
            _col("attrs_json", _J),
            _col("status", "TEXT NOT NULL DEFAULT 'collected'"),
            _col("tags_json", _A),
            _col("created_at", "REAL NOT NULL"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": ["images_json", "detail_json", "attrs_json", "tags_json"],
        "ts": ["created_at", "updated_at"],
    },
    "skus": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("product_id", "TEXT NOT NULL"),
            _col("spec", "TEXT NOT NULL DEFAULT ''"),
            _col("source_sku_id", "TEXT NOT NULL DEFAULT ''"),
            _col("price", "REAL NOT NULL DEFAULT 0"),
            _col("stock", "INTEGER NOT NULL DEFAULT 0"),
            _col("barcode", "TEXT NOT NULL DEFAULT ''"),
            _col("image", "TEXT NOT NULL DEFAULT ''"),
            _col("attrs_json", _J),
            _col("enabled", "INTEGER NOT NULL DEFAULT 1"),
        ],
        "json": ["attrs_json"],
        "ts": [],
    },
    "media": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("product_id", "TEXT NOT NULL DEFAULT ''"),
            _col("kind", "TEXT NOT NULL DEFAULT 'image'"),
            _col("role", "TEXT NOT NULL DEFAULT ''"),
            _col("url", "TEXT NOT NULL DEFAULT ''"),
            _col("local_path", "TEXT NOT NULL DEFAULT ''"),
            _col("source_url", "TEXT NOT NULL DEFAULT ''"),
            _col("source_type", "TEXT NOT NULL DEFAULT 'collected'"),
            _col("hash", "TEXT NOT NULL DEFAULT ''"),
            _col("meta_json", _J),
            _col("created_at", "REAL NOT NULL"),
        ],
        "json": ["meta_json"],
        "ts": ["created_at"],
    },
    "mappings": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("platform", "TEXT NOT NULL DEFAULT 'douyin'"),
            _col("source_category", "TEXT NOT NULL DEFAULT ''"),
            _col("target_category", "TEXT NOT NULL DEFAULT ''"),
            _col("target_category_id", "TEXT NOT NULL DEFAULT ''"),
            _col("rules_json", _J),
            _col("created_at", "REAL NOT NULL"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": ["rules_json"],
        "ts": ["created_at", "updated_at"],
    },
    "listings": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("platform", "TEXT NOT NULL DEFAULT 'douyin'"),
            _col("shop_id", "TEXT NOT NULL DEFAULT ''"),
            _col("product_id", "TEXT NOT NULL DEFAULT ''"),
            _col("remote_id", "TEXT NOT NULL DEFAULT ''"),
            _col("status", "TEXT NOT NULL DEFAULT 'on'"),
            _col("price", "REAL NOT NULL DEFAULT 0"),
            _col("error", "TEXT NOT NULL DEFAULT ''"),
            _col("created_at", "REAL NOT NULL"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": [],
        "ts": ["created_at", "updated_at"],
    },
    "price_rules": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("name", "TEXT NOT NULL DEFAULT ''"),
            _col("scope_json", _J),
            _col("mode", "TEXT NOT NULL DEFAULT 'ratio'"),
            _col("base", "TEXT NOT NULL DEFAULT 'cost'"),
            _col("value", "REAL NOT NULL DEFAULT 0"),
            _col("round", "TEXT NOT NULL DEFAULT 'none'"),
            _col("min_price", "REAL NOT NULL DEFAULT 0"),
            _col("enabled", "INTEGER NOT NULL DEFAULT 1"),
            _col("created_at", "REAL NOT NULL"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": ["scope_json"],
        "ts": ["created_at", "updated_at"],
    },
    "pacing": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("scope_json", _J),
            _col("daily_limit", "INTEGER NOT NULL DEFAULT 0"),
            _col("interval_sec", "INTEGER NOT NULL DEFAULT 0"),
            _col("windows_json", _A),
            _col("enabled", "INTEGER NOT NULL DEFAULT 1"),
            _col("created_at", "REAL NOT NULL"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": ["scope_json", "windows_json"],
        "ts": ["created_at", "updated_at"],
    },
    "tasks": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("kind", "TEXT NOT NULL DEFAULT ''"),
            _col("title", "TEXT NOT NULL DEFAULT ''"),
            _col("status", "TEXT NOT NULL DEFAULT 'queued'"),
            _col("progress", "INTEGER NOT NULL DEFAULT 0"),
            _col("total", "INTEGER NOT NULL DEFAULT 0"),
            _col("done", "INTEGER NOT NULL DEFAULT 0"),
            _col("failed", "INTEGER NOT NULL DEFAULT 0"),
            _col("params_json", _J),
            _col("result_json", _J),
            _col("error", "TEXT NOT NULL DEFAULT ''"),
            _col("created_at", "REAL NOT NULL"),
            _col("started_at", "REAL"),
            _col("finished_at", "REAL"),
        ],
        "json": ["params_json", "result_json"],
        "ts": ["created_at"],
    },
    "task_items": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("task_id", "TEXT NOT NULL"),
            _col("seq", "INTEGER NOT NULL DEFAULT 0"),
            _col("ref_type", "TEXT NOT NULL DEFAULT ''"),
            _col("ref_id", "TEXT NOT NULL DEFAULT ''"),
            _col("status", "TEXT NOT NULL DEFAULT 'pending'"),
            _col("attempt", "INTEGER NOT NULL DEFAULT 0"),
            _col("payload_json", _J),
            _col("result_json", _J),
            _col("error", "TEXT NOT NULL DEFAULT ''"),
            _col("updated_at", "REAL NOT NULL"),
        ],
        "json": ["payload_json", "result_json"],
        "ts": ["updated_at"],
    },
    "compliance_reports": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("product_id", "TEXT NOT NULL DEFAULT ''"),
            _col("target_platform", "TEXT NOT NULL DEFAULT ''"),
            _col("verdict", "TEXT NOT NULL DEFAULT 'pass'"),
            _col("hits_json", _A),
            _col("checked_at", "REAL NOT NULL"),
        ],
        "json": ["hits_json"],
        "ts": ["checked_at"],
    },
    "product_versions": {
        "cols": [
            _col("id", "TEXT PRIMARY KEY"),
            _col("owner", "TEXT NOT NULL"),
            _col("product_id", "TEXT NOT NULL"),
            _col("note", "TEXT NOT NULL DEFAULT ''"),
            _col("snapshot_json", _J),
            _col("created_at", "REAL NOT NULL"),
        ],
        "json": ["snapshot_json"],
        "ts": ["created_at"],
    },
}

TABLES = tuple(SCHEMA.keys())

INDEXES = [
    ("idx_ecom_shops_owner", "shops(owner, platform)"),
    ("idx_ecom_shops_group", "shops(owner, group_id)"),
    ("idx_ecom_products_owner", "products(owner, status, updated_at)"),
    ("idx_ecom_products_source", "products(owner, source_platform, source_id)"),
    ("idx_ecom_skus_product", "skus(owner, product_id)"),
    ("idx_ecom_media_owner", "media(owner, product_id, kind)"),
    ("idx_ecom_media_hash", "media(owner, hash)"),
    ("idx_ecom_mappings_owner", "mappings(owner, platform, source_category)"),
    ("idx_ecom_listings_key", "listings(owner, platform, shop_id, product_id)"),
    ("idx_ecom_tasks_owner", "tasks(owner, status, created_at)"),
    ("idx_ecom_task_items_task", "task_items(owner, task_id, seq)"),
    ("idx_ecom_reports_owner", "compliance_reports(owner, product_id)"),
    ("idx_ecom_versions_product", "product_versions(owner, product_id)"),
]


def configure(path):
    """把数据库指向指定路径（测试或独立部署用），并重置初始化标记。"""
    global DB_PATH, _ready
    DB_PATH = Path(path)
    _ready = False


def new_id(prefix=""):
    return (prefix + "_" if prefix else "") + uuid.uuid4().hex[:12]


def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db():
    conn = _conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def ensure():
    """建表与索引，幂等。"""
    global _ready
    with _lock:
        if _ready:
            return
        ddl = []
        for table, meta in SCHEMA.items():
            cols = ", ".join("%s %s" % (n, d) for n, d in meta["cols"])
            ddl.append("CREATE TABLE IF NOT EXISTS %s (%s)" % (table, cols))
        for name, spec in INDEXES:
            ddl.append("CREATE INDEX IF NOT EXISTS %s ON %s" % (name, spec))
        with db() as conn:
            conn.executescript(";\n".join(ddl))
        _ready = True


def _meta(table):
    if table not in SCHEMA:
        raise ValueError("未知数据表: %s" % table)
    return SCHEMA[table]


def _names(meta):
    return [n for n, _ in meta["cols"]]


def _enc(meta, name, value):
    if name in meta["json"] and not isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    return value


def _dec_row(meta, row):
    if row is None:
        return None
    data = dict(row)
    for name in meta["json"]:
        if name not in data:
            continue
        raw = data.get(name)
        if isinstance(raw, str):
            try:
                data[name] = json.loads(raw)
            except ValueError:
                data[name] = None
    return data


def insert(table, owner, data=None):
    """插入一行，返回落库后的字典。owner 强制带入，id/时间戳缺省自动补。"""
    meta = _meta(table)
    data = dict(data or {})
    names = _names(meta)
    now = time.time()
    vals = {}
    for name in names:
        if name == "id":
            vals[name] = data.get("id") or new_id(table)
        elif name == "owner":
            vals[name] = owner
        elif name in data:
            vals[name] = _enc(meta, name, data[name])
        elif name in meta["ts"]:
            vals[name] = now
    cols = list(vals.keys())
    sql = "INSERT INTO %s (%s) VALUES (%s)" % (
        table,
        ", ".join(cols),
        ", ".join(["?"] * len(cols)),
    )
    with db() as conn:
        conn.execute(sql, [vals[c] for c in cols])
    return get(table, owner, vals["id"])


def get(table, owner, rid):
    meta = _meta(table)
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM %s WHERE id=? AND owner=?" % table, (rid, owner)
        ).fetchone()
    return _dec_row(meta, row)


def list_rows(table, owner, where="", params=(), order="", limit=None, offset=None):
    meta = _meta(table)
    names = _names(meta)
    if not order:
        order = "created_at DESC" if "created_at" in names else "rowid DESC"
    sql = "SELECT * FROM %s WHERE owner=?" % table
    args = [owner]
    if where:
        sql += " AND (" + where + ")"
        args.extend(params)
    sql += " ORDER BY " + order
    if limit:
        sql += " LIMIT %d" % int(limit)
        if offset:
            sql += " OFFSET %d" % int(offset)
    with db() as conn:
        rows = conn.execute(sql, args).fetchall()
    return [_dec_row(meta, r) for r in rows]


def update(table, owner, rid, data):
    meta = _meta(table)
    data = dict(data or {})
    now = time.time()
    sets = []
    args = []
    for name in _names(meta):
        if name in ("id", "owner", "created_at"):
            continue
        if name in data:
            sets.append("%s=?" % name)
            args.append(_enc(meta, name, data[name]))
    if "updated_at" in meta["ts"]:
        sets.append("updated_at=?")
        args.append(now)
    if not sets:
        return get(table, owner, rid)
    args.extend([rid, owner])
    with db() as conn:
        conn.execute(
            "UPDATE %s SET %s WHERE id=? AND owner=?" % (table, ", ".join(sets)),
            args,
        )
    return get(table, owner, rid)


def delete(table, owner, rid):
    _meta(table)
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM %s WHERE id=? AND owner=?" % table, (rid, owner)
        )
        return cur.rowcount > 0


def count(table, owner, where="", params=()):
    _meta(table)
    sql = "SELECT COUNT(*) AS n FROM %s WHERE owner=?" % table
    args = [owner]
    if where:
        sql += " AND (" + where + ")"
        args.extend(params)
    with db() as conn:
        return int(conn.execute(sql, args).fetchone()["n"])


# --------------------------- 业务便捷 DAO --------------------------- #


def find_product_by_source(owner, source_platform, source_id):
    rows = list_rows(
        "products",
        owner,
        where="source_platform=? AND source_id=?",
        params=(source_platform, source_id),
        limit=1,
    )
    return rows[0] if rows else None


def upsert_product(owner, source_platform, source_id, data):
    """按 (来源平台, 来源 id) 去重落库：存在则更新，否则插入。"""
    existing = find_product_by_source(owner, source_platform, source_id) if source_id else None
    payload = dict(data or {})
    payload.setdefault("source_platform", source_platform)
    payload.setdefault("source_id", source_id)
    if existing:
        return update("products", owner, existing["id"], payload)
    return insert("products", owner, payload)


def replace_skus(owner, product_id, skus):
    """整体替换某商品的 SKU 列表。"""
    with db() as conn:
        conn.execute(
            "DELETE FROM skus WHERE owner=? AND product_id=?", (owner, product_id)
        )
    out = []
    for i, sku in enumerate(skus or []):
        payload = dict(sku or {})
        payload.setdefault("product_id", product_id)
        payload.setdefault("spec", payload.get("spec", ""))
        out.append(insert("skus", owner, payload))
    return out


def list_skus(owner, product_id):
    return list_rows(
        "skus",
        owner,
        where="product_id=?",
        params=(product_id,),
        order="rowid ASC",
    )


def list_media(owner, product_id=None, kind=None):
    clauses = []
    params = []
    if product_id:
        clauses.append("product_id=?")
        params.append(product_id)
    if kind:
        clauses.append("kind=?")
        params.append(kind)
    return list_rows("media", owner, where=" AND ".join(clauses), params=tuple(params))


def find_media_by_hash(owner, digest):
    if not digest:
        return None
    rows = list_rows("media", owner, where="hash=?", params=(digest,), limit=1)
    return rows[0] if rows else None


def find_listing(owner, platform, shop_id, product_id):
    """按「商品 × 店铺」键取铺货绑定，用于幂等判断（设计稿 7.3 第 59/64 条）。"""
    rows = list_rows(
        "listings",
        owner,
        where="platform=? AND shop_id=? AND product_id=?",
        params=(platform, shop_id, product_id),
        limit=1,
    )
    return rows[0] if rows else None


def upsert_listing(owner, platform, shop_id, product_id, data):
    """存在则更新，否则按「商品 × 店铺」键插入一条铺货绑定。"""
    existing = find_listing(owner, platform, shop_id, product_id)
    payload = dict(data or {})
    payload.update(
        {"platform": platform, "shop_id": shop_id, "product_id": product_id}
    )
    if existing:
        return update("listings", owner, existing["id"], payload)
    return insert("listings", owner, payload)


def list_listings(owner, product_id=None, shop_id=None, platform=None):
    clauses = []
    params = []
    for col, value in (("product_id", product_id), ("shop_id", shop_id), ("platform", platform)):
        if value:
            clauses.append("%s=?" % col)
            params.append(value)
    return list_rows("listings", owner, where=" AND ".join(clauses), params=tuple(params))


def latest_report(owner, product_id, target_platform=None):
    clauses = ["product_id=?"]
    params = [product_id]
    if target_platform:
        clauses.append("target_platform=?")
        params.append(target_platform)
    rows = list_rows(
        "compliance_reports",
        owner,
        where=" AND ".join(clauses),
        params=tuple(params),
        order="checked_at DESC",
        limit=1,
    )
    return rows[0] if rows else None


def stats(owner):
    """首页概览用的计数：商品、素材、店铺、任务（按状态）。"""
    return {
        "products": count("products", owner),
        "media": count("media", owner),
        "shops": count("shops", owner),
        "shop_groups": count("shop_groups", owner),
        "listings": count("listings", owner),
        "tasks_active": count(
            "tasks", owner, "status IN ('scheduled','queued','running','paused')"
        ),
        "tasks_succeeded": count("tasks", owner, "status='succeeded'"),
        "tasks_partial": count("tasks", owner, "status='partial'"),
        "tasks_failed": count("tasks", owner, "status='failed'"),
    }
