#!/usr/bin/python3
"""淘宝/天猫适配器（自用型应用）。

走淘宝开放平台 TOP 网关。签名、请求装配、multipart 组装都是纯函数，便于单测；
未配置授权（access_token）或处于 dry_run 时不真正发起网络请求。
真实调用时通过注入 http / http_bytes 便于测试与将来替换。
"""
import hashlib
import json
import time
import urllib.parse
import urllib.request

from .base import PlatformAdapter, PublishResult
from ..models import selling_price

TOP_GATEWAY = "https://eco.taobao.com/router/rest"


class TopError(Exception):
    def __init__(self, code, msg):
        super().__init__("%s: %s" % (code, msg))
        self.code = code
        self.msg = msg


def top_sign(params, secret):
    """TOP 签名：把除 sign 外参数按 key 排序，拼成 k1v1k2v2... 前后加 secret，MD5 大写。"""
    parts = []
    for key in sorted(params):
        if key == "sign" or params[key] in (None, ""):
            continue
        parts.append("%s%s" % (key, params[key]))
    raw = secret + "".join(parts) + secret
    return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()


def build_top_params(creds, method, biz=None):
    params = {
        "app_key": creds.get("appKey", ""),
        "method": method,
        "format": "json",
        "v": "2.0",
        "sign_method": "md5",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if creds.get("accessToken"):
        params["session"] = creds["accessToken"]
    for k, v in (biz or {}).items():
        if v is None or v == "":
            continue
        params[k] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    params["sign"] = top_sign(params, creds.get("appSecret", ""))
    return params


def _http_post(gateway, params):
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(gateway, data=data)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _http_bytes(gateway, params, files):
    content_type, body = build_multipart(params, files)
    req = urllib.request.Request(gateway, data=body, headers={"Content-Type": content_type})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_multipart(fields, files):
    """组装 multipart/form-data。files 为 [(field, filename, content_type, bytes)]。"""
    boundary = "----xlxDropship" + hashlib.md5(str(time.time()).encode()).hexdigest()[:16]
    crlf = b"\r\n"
    parts = []
    for key, value in fields.items():
        parts.append(("--" + boundary).encode())
        parts.append(('Content-Disposition: form-data; name="%s"' % key).encode())
        parts.append(b"")
        parts.append(str(value).encode("utf-8"))
    for field, filename, ctype, content in files:
        parts.append(("--" + boundary).encode())
        parts.append(('Content-Disposition: form-data; name="%s"; filename="%s"' % (field, filename)).encode())
        parts.append(("Content-Type: %s" % (ctype or "application/octet-stream")).encode())
        parts.append(b"")
        parts.append(content)
    parts.append(("--" + boundary + "--").encode())
    parts.append(b"")
    body = crlf.join(parts)
    return "multipart/form-data; boundary=%s" % boundary, body


class TaobaoAdapter(PlatformAdapter):
    name = "taobao"
    label = "淘宝/天猫"

    def __init__(self, dry_run=True, gateway=TOP_GATEWAY, http=None, http_bytes=None):
        self.dry_run = dry_run
        self.gateway = gateway
        self._http = http or _http_post
        self._http_bytes = http_bytes or _http_bytes

    def _request(self, creds, method, biz):
        params = build_top_params(creds, method, biz)
        body = self._http(self.gateway, params)
        err = body.get("error_response")
        if err:
            raise TopError(err.get("code"), err.get("msg") or err.get("sub_msg") or str(err))
        return body

    # ---- 类目 / 属性查询 ----
    def query_categories(self, creds=None, parent_cid=0):
        creds = creds or {}
        if self.dry_run or not creds.get("accessToken"):
            return []
        body = self._request(creds, "taobao.itemcats.get", {
            "parent_cid": parent_cid,
            "fields": "cid,parent_cid,name,is_parent,status,sort_order",
        })
        cats = ((body.get("itemcats_get_response") or {}).get("item_cats") or {}).get("item_cat") or []
        return [{"id": str(c.get("cid")), "parentId": str(c.get("parent_cid")), "name": c.get("name"),
                 "isParent": bool(c.get("is_parent"))} for c in cats]

    def query_attributes(self, creds=None, cid=None):
        creds = creds or {}
        if self.dry_run or not creds.get("accessToken") or not cid:
            return []
        body = self._request(creds, "taobao.itemprops.get", {"cid": cid})
        props = ((body.get("itemprops_get_response") or {}).get("item_props") or {}).get("item_prop") or []
        return [{"id": str(p.get("pid")), "name": p.get("name"), "isKey": bool(p.get("is_key_prop")),
                 "isSale": bool(p.get("is_sale_prop"))} for p in props]

    # ---- 图片空间 ----
    def upload_picture(self, data, creds, filename="upload.jpg", ctype="image/jpeg"):
        if self.dry_run or not (creds or {}).get("accessToken"):
            return {"url": "", "pictureId": "", "dryRun": True}
        params = build_top_params(creds, "taobao.picture.upload", {})
        result = self._http_bytes(self.gateway, params, [("img", filename, ctype, data)])
        err = result.get("error_response")
        if err:
            raise TopError(err.get("code"), err.get("msg") or str(err))
        pic = ((result.get("picture_upload_response") or {}).get("picture")) or {}
        return {"url": pic.get("url"), "pictureId": str(pic.get("picture_id") or ""), "dryRun": False}

    # ---- 字段映射与发布 ----
    def map_fields(self, product, mapping=None):
        mapping = mapping or {}
        cat_id = ((product.get("category") or {}).get("target") or {}).get("id")
        default_price = selling_price(product)
        sku_lines = []
        for s in product.get("skus", []):
            specs = s.get("specs") or {}
            entry = {"price": s.get("price") or default_price, "quantity": s.get("stock", 0)}
            if specs.get("color"):
                entry["prop"] = entry.get("prop") or {}
                entry["prop"]["颜色"] = specs["color"]
            if specs.get("size"):
                entry["prop"] = entry.get("prop") or {}
                entry["prop"]["尺码"] = specs["size"]
            sku_lines.append(entry)
        return {
            "title": product.get("title"),
            "cid": cat_id,
            "outer_id": (product.get("source") or {}).get("itemId"),
            "desc": product.get("description") or "",
            "num": sum(s.get("stock", 0) for s in product.get("skus", [])),
            "price": default_price,
            "sku": sku_lines,
            "images": [self._image_url(i) for i in product.get("images", {}).get("main", [])],
            "attributes": product.get("attributes") or {},
            "mapping": mapping,
        }

    @staticmethod
    def _image_url(item):
        if isinstance(item, dict):
            return item.get("local") or item.get("url") or ""
        return item

    def publish(self, product, mapping, creds):
        fields = self.map_fields(product, mapping)
        target = (product.get("category") or {}).get("target") or {}
        if not target.get("id"):
            return PublishResult(False, "failed", error="未完成平台类目映射")
        creds = creds or {}
        if self.dry_run or not creds.get("accessToken"):
            return PublishResult(
                ok=True, status="dry_run",
                raw={"mapped": fields, "reason": "dry_run" if self.dry_run else "no_token"},
            )
        biz = {
            "title": fields["title"], "cid": fields["cid"], "num": fields["num"],
            "price": fields["price"], "outer_id": fields["outer_id"], "desc": fields["desc"],
        }
        try:
            body = self._request(creds, creds.get("method", "taobao.item.add"), biz)
        except TopError as exc:
            return PublishResult(False, "failed", error=str(exc))
        except Exception as exc:
            return PublishResult(False, "failed", error="TOP 调用失败: %s" % exc)
        item = ((body.get("item_add_response") or {}).get("item")) or {}
        return PublishResult(True, "success", platform_item_id=item.get("num_iid"), raw=body)
