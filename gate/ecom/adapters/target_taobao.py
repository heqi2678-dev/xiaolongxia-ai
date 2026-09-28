#!/usr/bin/python3
"""电商工作台 · 淘宝目标平台适配器（设计稿 4.2 / 4.6）。

覆盖类目树、字段映射、发布、改价、上下架与商品列表。
真机走淘宝开放平台（TOP），需要 appkey/secret 与店铺 session(access_token)；
资质到位前可注入 ``transport`` 做契约测试与真机联调。

环境变量（应用级凭证，非 LLM key）：

- ``ECOM_TAOBAO_APPKEY`` / ``ECOM_TAOBAO_APPSECRET``  应用凭证
- ``ECOM_TAOBAO_BASE_URL``                            可选，默认 TOP 网关

注意：接口名、参数与签名规则以淘宝开放平台文档为准，凭证到位后用真机冒烟校准
（重点：图片空间上传、类目属性 prop 与发货地址 location）。
"""
import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

from ecom.adapters.base import TargetAdapter, require_auth
from ecom.registry import EcomError, AUTH_EXPIRED, UNKNOWN, normalize_error

DEFAULT_BASE_URL = "https://eco.taobao.com/router/rest"
# 卖家可发布类目（含授权叶子），比全量类目树更适合铺货
API_CATEGORY = "taobao.itemcats.authorize.get"
API_ITEM_ADD = "taobao.item.add"
API_ITEM_UPDATE = "taobao.item.update"
API_ITEM_LISTING = "taobao.item.update.listing"
API_ITEM_DELISTING = "taobao.item.update.delisting"
API_ITEM_ONSALE = "taobao.items.onsale.get"

PAGE_SIZE = 20


def top_sign(params, secret, sign_method="md5"):
    """淘宝开放平台签名：参数按名排序拼接 key+value。

    - ``md5``：MD5(secret + 串 + secret)，大写十六进制
    - ``hmac``：HMAC-MD5(secret, 串)，大写十六进制
    """
    pieces = []
    for key in sorted(params):
        value = params[key]
        if value is None:
            continue
        pieces.append("%s%s" % (key, value))
    joined = "".join(pieces).encode("utf-8")
    if sign_method == "hmac":
        digest = hmac.new(secret.encode("utf-8"), joined, hashlib.md5).hexdigest()
    else:
        digest = hashlib.md5((secret + "".join(pieces) + secret).encode("utf-8")).hexdigest()
    return digest.upper()


class HttpTransport:
    """基于标准库的默认传输层；测试可注入替身。"""

    def __init__(self, timeout=15):
        self.timeout = timeout

    def post(self, url, params):
        data = urllib.parse.urlencode(params).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            raise normalize_error(exc)
        try:
            return json.loads(body)
        except ValueError:
            raise EcomError("淘宝返回非 JSON 响应", UNKNOWN, remote_code=body[:120])


class TargetTaobaoAdapter(TargetAdapter):
    platform = "taobao"

    def __init__(
        self,
        appkey=None,
        secret=None,
        transport=None,
        base_url=None,
        limiter=None,
        category_keywords=None,
    ):
        self.appkey = appkey or os.environ.get("ECOM_TAOBAO_APPKEY", "")
        self.secret = secret or os.environ.get("ECOM_TAOBAO_APPSECRET", "")
        self.transport = transport or HttpTransport()
        self.base_url = (base_url or os.environ.get("ECOM_TAOBAO_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.limiter = limiter
        # 关键词 -> 类目名，用于 match_category 的兜底匹配
        self.category_keywords = category_keywords or {
            "连衣裙": "女装",
            "女": "女装",
            "T恤": "男装",
            "男": "男装",
        }
        self._tree_cache = None

    # ---- 统一契约 ----

    def fetch_category_tree(self, ctx=None):
        shop_auth = (ctx or {}).get("shop_auth") or _ctx_auth(ctx) or {}
        if not shop_auth.get("access_token"):
            shop_auth = {"access_token": "app-only"}
        payload = self._call(
            API_CATEGORY,
            {"parent_cid": 0, "fields": "cid,parent_cid,name,is_parent"},
            shop_auth,
        )
        flat = _pick_list(payload, ("item_cats", "itemCats", "item_cat", "data", "list"))
        self._tree_cache = _build_tree(flat)
        return self._tree_cache

    def match_category(self, product):
        title = (product or {}).get("title", "")
        tree = self._tree_cache or []
        for keyword, name in self.category_keywords.items():
            if keyword in title:
                found = _find_category(tree, name)
                if found:
                    return {"category_id": found, "confidence": 0.85}
        if tree:
            first = _first_leaf(tree[0])
            return {"category_id": first, "confidence": 0.3}
        return {"category_id": "", "confidence": 0.0}

    def map_fields(self, product, category_id):
        product = product or {}
        images = list(product.get("images") or [])
        skus = list(product.get("skus") or [])
        price = float(product.get("price") or 0)
        data = {
            "title": product.get("title", ""),
            "cid": category_id,
            "price": "%.2f" % price,
            "num": int(product.get("stock") or 0),
            "stuff_status": "new",
            "pic_path": product.get("main_image") or (images[0] if images else ""),
            "images": images,
            "desc": (product.get("detail") or {}).get("html", ""),
            "skus": skus,
        }
        missing = []
        if not data["title"]:
            missing.append("title")
        if not data["cid"]:
            missing.append("cid")
        if not data["pic_path"]:
            missing.append("pic_path")
        if not skus:
            missing.append("skus")
        return {"data": data, "missing": missing}

    def publish(self, data, shop_auth):
        require_auth(shop_auth)
        if not (data or {}).get("cid"):
            raise EcomError("缺少类目资质或类目未匹配", "category_rights")
        params = {k: v for k, v in (data or {}).items() if k not in ("images", "skus")}
        payload = self._call(API_ITEM_ADD, params, shop_auth)
        item = payload.get("item") if isinstance(payload, dict) else None
        remote_id = _pick_value(item or payload, ("num_iid", "numIid", "id"))
        if not remote_id:
            raise EcomError("淘宝发布未返回商品 id", UNKNOWN)
        return {"remote_id": str(remote_id)}

    def update_price(self, remote_id, price, shop_auth):
        require_auth(shop_auth)
        self._call(
            API_ITEM_UPDATE,
            {"num_iid": str(remote_id), "price": "%.2f" % float(price)},
            shop_auth,
        )

    def set_listing(self, remote_id, on, shop_auth):
        require_auth(shop_auth)
        api = API_ITEM_LISTING if on else API_ITEM_DELISTING
        self._call(api, {"num_iid": str(remote_id)}, shop_auth)

    def list_listings(self, shop_auth, cursor=None):
        require_auth(shop_auth)
        page = int(cursor or 0) + 1
        payload = self._call(
            API_ITEM_ONSALE,
            {"fields": "num_iid,title,price,num", "page_no": page, "page_size": PAGE_SIZE},
            shop_auth,
        )
        block = payload.get("items") if isinstance(payload, dict) else None
        items = _pick_list(block or payload, ("item", "items", "list", "data"))
        total = _pick_value(payload, ("total_results", "totalResults", "total")) if isinstance(payload, dict) else None
        if total is None and isinstance(block, dict):
            total = _pick_value(block, ("total_results", "totalResults", "total"))
        next_cursor = str(page) if total and page * PAGE_SIZE < int(total) else None
        return {
            "items": [
                {
                    "remote_id": str(_pick_value(i, ("num_iid", "numIid", "id"))),
                    "on": True,
                    "title": _pick_value(i, ("title", "name")) or "",
                }
                for i in items
            ],
            "cursor": next_cursor,
        }

    # ---- 请求与签名 ----

    def _call(self, api, params, shop_auth):
        if not self.appkey or not self.secret:
            raise EcomError("淘宝应用凭证未配置（ECOM_TAOBAO_APPKEY/APPSECRET）", AUTH_EXPIRED)
        if self.limiter is not None:
            self.limiter.spend()
        token = (shop_auth or {}).get("access_token")
        if not token:
            raise EcomError("店铺授权失效或缺失", AUTH_EXPIRED)
        query = {
            "app_key": self.appkey,
            "method": api,
            "session": token,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "format": "json",
            "v": "2.0",
            "sign_method": "md5",
        }
        for key, value in (params or {}).items():
            if value is None:
                continue
            query[key] = value if isinstance(value, str) else _dump(value)
        query["sign"] = top_sign(query, self.secret)
        try:
            payload = self.transport.post(self.base_url, query)
        except Exception as exc:  # noqa: BLE001
            raise normalize_error(exc)
        return _unwrap(payload)


def _ctx_auth(ctx):
    return (ctx or {}).get("auth")


def _dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _unwrap(payload):
    if not isinstance(payload, dict):
        raise EcomError("淘宝返回结构非法", UNKNOWN)
    error = payload.get("error_response")
    if isinstance(error, dict):
        message = error.get("sub_msg") or error.get("msg") or "淘宝接口错误"
        code = error.get("sub_code") or error.get("code")
        raise normalize_error(RuntimeError("%s (%s)" % (message, code)))
    for key, value in payload.items():
        if key.endswith("_response"):
            return value
    return payload


def _pick_value(source, keys):
    if not isinstance(source, dict):
        return None
    for key in keys:
        value = source.get(key)
        if value not in (None, ""):
            return value
    return None


def _pick_list(payload, keys):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = _pick_list(value, keys)
            if nested:
                return nested
    return []


def _build_tree(flat):
    """把 TOP 的扁平类目列表（parent_cid）还原成嵌套树。"""
    nodes = {}
    roots = []
    for raw in flat or []:
        cid = str(_pick_value(raw, ("cid", "id", "categoryId")) or "")
        if not cid:
            continue
        nodes[cid] = {
            "id": cid,
            "name": _pick_value(raw, ("name", "categoryName")) or "",
            "leaf": True,
            "children": [],
            "_parent": str(_pick_value(raw, ("parent_cid", "parentCid")) or "0"),
        }
    for cid, node in nodes.items():
        parent = node.pop("_parent", "0")
        if parent in ("0", "", "None") or parent not in nodes:
            roots.append(node)
        else:
            nodes[parent]["children"].append(node)
    for node in nodes.values():
        node["leaf"] = not node["children"]
    return roots


def _map_category(node):
    children = node.get("children") or []
    return {
        "id": str(node.get("id") or ""),
        "name": node.get("name") or "",
        "leaf": not children,
        "children": [_map_category(child) for child in children],
    }


def _find_category(tree, name):
    for node in tree:
        if node["name"] == name:
            return _first_leaf(node)
        found = _find_category(node.get("children") or [], name)
        if found:
            return found
    return ""


def _first_leaf(node):
    children = node.get("children") or []
    if not children:
        return node["id"]
    return _first_leaf(children[0])
