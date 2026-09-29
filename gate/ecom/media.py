#!/usr/bin/python3
"""电商工作台 · 图片代理转存。

1688 图片有防盗链，目标平台直接引用常取不到图。这里由小龙虾后端带上正确
来源头把图片下载到本地缓存，并把素材地址改写为小龙虾的公开地址，供目标平台
（淘宝）拉取。

要点：
- ``cache_image`` 只接受 http(s) 且解析后不落内网 / 回环 / 保留网段的地址（SSRF 防护）。
- 落盘按内容 sha1 命名，先写 ``.tmp`` 再原子替换，避免半截文件。
- ``serve`` 供网关的公开路由调用，不需要登录（目标平台服务器来取）。
"""
import hashlib
import ipaddress
import os
import re
import socket
import urllib.parse
import urllib.request
from pathlib import Path

from ecom import store

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

MEDIA_DIR = Path(store.DATA_DIR) / "media"
PUBLIC_BASE = os.environ.get("ECOM_PUBLIC_BASE", "http://47.108.14.206").rstrip("/")
TIMEOUT = int(os.environ.get("MEDIA_TIMEOUT", "20"))
MAX_BYTES = int(os.environ.get("MEDIA_MAX_BYTES", str(10 * 1024 * 1024)))

REFERERS = {
    "1688": "https://detail.1688.com/",
    "taobao": "https://item.taobao.com/",
}

CTYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
}
EXT_CTYPE = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
}
ALLOWED_EXT = set(EXT_CTYPE.keys())


def configure(media_dir=None, base=None):
    """测试或独立部署时指向别处。"""
    global MEDIA_DIR, PUBLIC_BASE
    if media_dir is not None:
        MEDIA_DIR = Path(media_dir)
    if base is not None:
        PUBLIC_BASE = str(base).rstrip("/")


def public_url(media_id):
    return "%s/dian/api/ecom/media/%s" % (PUBLIC_BASE, media_id)


def referer_for(platform):
    return REFERERS.get(str(platform or "").strip().lower(), "")


def is_safe_url(url):
    """仅放行 http(s) 且解析结果不含内网 / 回环 / 保留地址的 URL。"""
    try:
        parsed = urllib.parse.urlparse(str(url or ""))
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except (socket.gaierror, UnicodeError, ValueError):
        return False
    if not infos:
        return False
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        ):
            return False
    return True


def _safe_name(owner):
    return re.sub(r"[^\w\u4e00-\u9fff-]", "_", str(owner or "guest"))[:40] or "guest"


def _ext(ctype, url):
    if ctype in CTYPE_EXT:
        return CTYPE_EXT[ctype]
    suffix = Path(urllib.parse.urlparse(str(url or "")).path).suffix.lower()
    if suffix == ".jpeg":
        return ".jpg"
    if suffix in ALLOWED_EXT:
        return suffix
    return ".img"


def _ctype_from_path(path):
    return EXT_CTYPE.get(Path(path).suffix.lower(), "application/octet-stream")


def _download(url, platform=""):
    headers = {"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"}
    referer = referer_for(platform)
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=TIMEOUT) as resp:
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        body = resp.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("图片超过体积上限")
    if not body:
        raise ValueError("图片内容为空")
    return body, ctype


def _write(path, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(body)
    os.replace(tmp, str(path))


def find_media(media_id):
    """按 id 跨 owner 取一条素材（公开路由用，id 全局唯一）。"""
    with store.db() as conn:
        row = conn.execute(
            "SELECT * FROM media WHERE id=?", (media_id,)
        ).fetchone()
    return store._dec_row(store.SCHEMA["media"], row)


def serve(media_id):
    """读取已缓存的图片，返回 ``(content_type, bytes)``；不存在返回 None。"""
    row = find_media(media_id)
    if not row:
        return None
    path = row.get("local_path") or ""
    if not path or not Path(path).is_file():
        return None
    with open(path, "rb") as fh:
        body = fh.read()
    return _ctype_from_path(path), body


def cache_image(owner, row, platform=""):
    """下载并缓存单张图片，成功则把素材地址改写为本地公开地址。"""
    media_id = row.get("id") or ""
    url = row.get("source_url") or row.get("url") or ""
    if not url:
        return {"media_id": media_id, "skipped": True, "error": "无图片地址"}
    local_path = row.get("local_path") or ""
    if local_path and Path(local_path).is_file():
        return {"media_id": media_id, "skipped": True, "local_path": local_path}
    if not is_safe_url(url):
        return {"media_id": media_id, "url": url, "error": "不安全的图片地址"}
    try:
        body, ctype = _download(url, platform)
    except Exception as exc:  # noqa: BLE001 - 单图失败不影响其它图片
        return {"media_id": media_id, "url": url, "error": str(exc)}
    digest = hashlib.sha1(body).hexdigest()
    path = MEDIA_DIR / _safe_name(owner) / (digest + _ext(ctype, url))
    _write(path, body)
    local_url = public_url(media_id)
    meta = dict(row.get("meta_json") or {})
    meta["content_hash"] = digest
    store.update(
        "media",
        owner,
        media_id,
        {
            "local_path": str(path),
            "url": local_url,
            "source_url": url,
            "meta_json": meta,
        },
    )
    return {
        "media_id": media_id,
        "local_path": str(path),
        "url": local_url,
        "bytes": len(body),
    }


def refresh_product_images(owner, product_id):
    """把商品的图片地址改写为素材当前地址（主图优先，保持原顺序）。"""
    product = store.get("products", owner, product_id)
    if not product:
        return None
    rows = [r for r in store.list_media(owner, product_id, kind="image") if r.get("url")]
    ordered = []
    seen = set()
    for row in rows:
        url = row.get("url")
        if url in seen:
            continue
        seen.add(url)
        ordered.append(row)
    source_main = product.get("main_image") or ""
    main = ""
    for row in ordered:
        if row.get("source_url") == source_main or row.get("url") == source_main:
            main = row.get("url")
            break
    urls = [row.get("url") for row in ordered]
    if not main and urls:
        main = urls[0]
    if main:
        urls = [main] + [u for u in urls if u != main]
    store.update(
        "products", owner, product_id, {"main_image": main, "images_json": urls}
    )
    return {"product_id": product_id, "main_image": main, "images": urls}


def cache_product_media(owner, product_id, platform=""):
    """把一个商品的素材图片全部转存，并刷新商品图片地址。"""
    rows = store.list_media(owner, product_id, kind="image")
    results = [cache_image(owner, row, platform) for row in rows]
    failed = [r for r in results if r.get("error")]
    refresh_product_images(owner, product_id)
    return {
        "product_id": product_id,
        "total": len(rows),
        "ok": len(results) - len(failed),
        "failed": len(failed),
        "results": results,
    }
