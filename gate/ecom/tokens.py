#!/usr/bin/python3
"""电商工作台 · 插件访问口令（浏览器扩展鉴权）。

Cookie 会话（``SameSite=Lax``）无法在扩展的跨站请求中携带，因此为浏览器扩展
提供独立口令：口令明文只在生成时返回一次，服务端仅存 ``sha256`` 摘要。

存储默认落在 ``DATA_DIR/ecom_tokens.json``，结构：

``{ "<sha256(token)>": {"owner", "prefix", "created_at", "note"} }``

约定：
- 每个 owner 同时只保留一个有效口令，重复生成即轮换（旧的立即失效）。
- 口令以 ``xlx_`` 前缀 + ``token_urlsafe(24)`` 组成，便于识别来源。
"""
import hashlib
import json
import os
import secrets
import threading
import time
from pathlib import Path

from ecom import store

_lock = threading.Lock()
PATH = Path(store.DATA_DIR) / "ecom_tokens.json"
PREFIX = "xlx_"


def configure(path):
    """把口令文件指向指定路径（测试或独立部署用）。"""
    global PATH
    PATH = Path(path)


def _digest(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def _load():
    try:
        with open(str(PATH), "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (IOError, OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _save(data):
    PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(PATH) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    os.replace(tmp, str(PATH))


def mint(owner, note=""):
    """为 owner 生成一个新口令，返回明文（仅本次可见）。"""
    owner = str(owner or "").strip()
    if not owner:
        raise ValueError("缺少 owner")
    token = PREFIX + secrets.token_urlsafe(24)
    record = {
        "owner": owner,
        "prefix": token[:8],
        "created_at": time.time(),
        "note": str(note or ""),
    }
    with _lock:
        data = _load()
        for key in [k for k, v in data.items() if v.get("owner") == owner]:
            data.pop(key, None)
        data[_digest(token)] = record
        _save(data)
    return token


def owner_of(token):
    """按口令明文反查 owner；无效返回 None。"""
    if not token:
        return None
    with _lock:
        record = _load().get(_digest(token))
    return (record or {}).get("owner") or None


def info(owner):
    """返回 owner 的口令状态（不含明文）；无口令返回 None。"""
    with _lock:
        data = _load()
    for record in data.values():
        if record.get("owner") == owner:
            return {
                "owner": owner,
                "prefix": record.get("prefix", ""),
                "created_at": record.get("created_at"),
                "note": record.get("note", ""),
            }
    return None


def revoke(owner):
    """撤销 owner 的全部口令，返回是否有删除。"""
    with _lock:
        data = _load()
        keys = [k for k, v in data.items() if v.get("owner") == owner]
        for key in keys:
            data.pop(key, None)
        if keys:
            _save(data)
    return bool(keys)
