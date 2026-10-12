#!/usr/bin/python3
"""图片存储：把采集到的商品图落到本地，供上游保档与后续上传平台图片空间。

远端图床（1688 的 cbu01.alicdn.com 等）链接可能失效，归档一份本地副本更稳。
默认用内容哈希命名，天然去重。
"""
import hashlib
import mimetypes
import urllib.request
from pathlib import Path

EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


class ImageStore:
    def __init__(self, images_dir, fetch=None, public_base="/api/images"):
        self.dir = Path(images_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.public_base = public_base.rstrip("/")
        self._fetch = fetch or self._http_fetch

    @staticmethod
    def _http_fetch(url, timeout=15):
        req = urllib.request.Request(url, headers={"User-Agent": "xlx-dropship/0.1"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), resp.headers.get("Content-Type", "")

    def put_bytes(self, data, content_type=""):
        digest = hashlib.sha1(data).hexdigest()
        ext = EXT_BY_TYPE.get((content_type or "").split(";")[0].strip(), "")
        if not ext:
            ext = mimetypes.guess_extension((content_type or "").split(";")[0].strip() or "image/jpeg") or ".jpg"
        name = digest + ext
        path = self.dir / name
        if not path.exists():
            path.write_bytes(data)
        return {"name": name, "url": "%s/%s" % (self.public_base, name), "size": len(data)}

    def fetch_and_store(self, url):
        data, ctype = self._fetch(url)
        if not data:
            raise ValueError("图片为空: %s" % url)
        return self.put_bytes(data, ctype)

    def resolve(self, name):
        """把文件名解析为本地路径；拒绝路径穿越，只允许 images_dir 下的文件。"""
        safe = Path(name).name
        path = self.dir / safe
        if not path.exists() or not path.is_file():
            return None
        return path

    def read(self, name):
        path = self.resolve(name)
        return path.read_bytes() if path else None

    def localize_product(self, product):
        """把商品的主图/详情图归档到本地，并把 image 字段指向本地地址。"""
        changed = False
        groups = product.get("images") or {}
        for key in ("main", "detail", "white"):
            items = groups.get(key) or []
            for i, item in enumerate(items):
                if not isinstance(item, dict):
                    item = {"url": item}
                    items[i] = item
                url = item.get("url")
                if not url or item.get("local"):
                    continue
                try:
                    stored = self.fetch_and_store(url)
                except Exception:
                    continue
                item["remote"] = url
                item["local"] = stored["url"]
                if not item.get("url"):
                    item["url"] = stored["url"]
                changed = True
        return changed
