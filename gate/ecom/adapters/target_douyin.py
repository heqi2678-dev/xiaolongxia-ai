#!/usr/bin/python3
"""电商工作台 · 抖音小店目标平台适配器（设计稿 4.2 / 4.6）。

覆盖类目树、字段映射、发布、改价、上下架与商品列表。
真机走抖店开放平台，需要 appkey/secret 与店铺 access_token；
资质到位前可注入 ``transport`` 做契约测试与真机联调。

环境变量（应用级凭证，非 LLM key）：

- ``ECOM_DOUYIN_APPKEY`` / ``ECOM_DOUYIN_APPSECRET``  应用凭证
- ``ECOM_DOUYIN_BASE_URL``                            可选，默认抖店开放平台网关

注意：接口名、参数与签名规则以抖店开放平台文档为准，凭证到位后用真机冒烟校准。
"""
import hashlib
import json
import os
import time
import urllib.parse
import urllib.request

from ecom.adapters.base import TargetAdapter, require_auth
from ecom.registry import EcomError, AUTH_EXPIRED, UNKNOWN, normalize_error

DEFAULT_BASE_URL = "https://openapi-fxg.jinritemai.com"
API_CATEGORY = "category/getCascade"
API_PRODUCT_ADD = "product/addV2"
API_PRODUCT_EDIT = "product/editV2"
API_PRODUCT_LIST = "product/listV2"
API_PRICE_UPDATE = "product/updatePrice"
API_LISTING_UP = "product/up"
API_LISTING_DOWN = "product/down"


def doudian_sign(params, secret):
    """抖店网关签名：参数按名排序拼接 key+value，MD5(secret + 串 + secret) 小写十六进制。"""
    pieces = []
    for key in sorted(params):
        value = params[key]
        if value is None:
            continue
        pieces.append("%s%s" % (key, value))
    raw = (secret + "".join(pieces) + secret).encode("utf-8")
    return hashlib.md5(raw).hexdigest()


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
            raise EcomError("抖店返回非 JSON 响应", UNKNOWN, remote_code=body[:120])


class TargetDouyinAdapter(TargetAdapter):
    platform = "douyin"

    def __init__(
        self,
        appkey=None,
        secret=None,
        transport=None,
        base_url=None,
        limiter=None,
        category_keywords=None,
    ):
        self.appkey = appkey or os.environ.get("ECOM_DOUYIN_APPKEY", "")
        self.secret = secret or os.environ.get("ECOM_DOUYIN_APPSECRET", "")
        self.transport = transport or HttpTransport()
        self.base_url = (base_url or os.environ.get("ECOM_DOUYIN_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
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
        payload = self._call(API_CATEGORY, {}, shop_auth)
        tree = _pick_list(payload, ("categoryList", "categories", "data", "list"))
        self._tree_cache = [_map_category(node) for node in tree]
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
        data = {
            "name": product.get("title", ""),
            "pic": product.get("main_image") or (images[0] if images else ""),
            "market_price": int(round(float(product.get("price") or 0) * 100)),
            "discount_price": int(round(float(product.get("price") or 0) * 100)),
            "stock_num": int(product.get("stock") or 0),
            "category_leaf_id": category_id,
            "description": (product.get("detail") or {}).get("html", ""),
            "specs": skus,
            "images": images,
        }
        missing = []
        if not data["name"]:
            missing.append("name")
        if not data["category_leaf_id"]:
            missing.append("category_leaf_id")
        if not data["pic"]:
            missing.append("pic")
        if not skus:
            missing.append("skus")
        return {"data": data, "missing": missing}

    def publish(self, data, shop_auth):
        require_auth(shop_auth)
        if not (data or {}).get("category_leaf_id"):
            raise EcomError("缺少类目资质或类目未匹配", "category_rights")
        payload = self._call(API_PRODUCT_ADD, {"product": _dump(data)}, shop_auth)
        remote_id = _pick_value(payload, ("product_id", "productId", "id"))
        if not remote_id:
            raise EcomError("抖店发布未返回商品 id", UNKNOWN)
        return {"remote_id": str(remote_id)}

    def update_price(self, remote_id, price, shop_auth):
        require_auth(shop_auth)
        self._call(
            API_PRICE_UPDATE,
            {"product_id": str(remote_id), "price": int(round(float(price) * 100))},
            shop_auth,
        )

    def set_listing(self, remote_id, on, shop_auth):
        require_auth(shop_auth)
        api = API_LISTING_UP if on else API_LISTING_DOWN
        self._call(api, {"product_id": str(remote_id)}, shop_auth)

    def list_listings(self, shop_auth, cursor=None):
        require_auth(shop_auth)
        page = int(cursor or 0) + 1
        payload = self._call(API_PRODUCT_LIST, {"page": page, "size": 20}, shop_auth)
        items = _pick_list(payload, ("products", "items", "list", "data"))
        total = _pick_value(payload, ("total", "count")) or 0
        next_cursor = str(page) if page * 20 < int(total or 0) else None
        return {
            "items": [
                {"remote_id": str(_pick_value(i, ("product_id", "id"))), "on": True, "title": _pick_value(i, ("name", "title")) or ""}
                for i in items
            ],
            "cursor": next_cursor,
        }

    # ---- 请求与签名 ----

    def _call(self, api, params, shop_auth):
        if not self.appkey or not self.secret:
            raise EcomError("抖店应用凭证未配置（ECOM_DOUYIN_APPKEY/APPSECRET）", AUTH_EXPIRED)
        if self.limiter is not None:
            self.limiter.spend()
        token = (shop_auth or {}).get("access_token")
        if not token:
            raise EcomError("店铺授权失效或缺失", AUTH_EXPIRED)
        query = {
            "app_key": self.appkey,
            "method": api,
            "param_json": _dump(params or {}),
            "timestamp": str(int(time.time())),
            "access_token": token,
            "v": "2",
        }
        query["sign"] = doudian_sign(query, self.secret)
        url = "%s/%s" % (self.base_url, api)
        try:
            payload = self.transport.post(url, query)
        except Exception as exc:  # noqa: BLE001
            raise normalize_error(exc)
        return _unwrap(payload)


def _ctx_auth(ctx):
    return (ctx or {}).get("auth")


def _dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _unwrap(payload):
    if not isinstance(payload, dict):
        raise EcomError("抖店返回结构非法", UNKNOWN)
    code = payload.get("err_no", payload.get("code"))
    if code not in (None, 0, "0", 10000, "10000"):
        message = payload.get("message") or payload.get("msg") or "抖店接口错误"
        raise normalize_error(RuntimeError("%s (%s)" % (message, code)))
    return payload.get("data", payload)


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


def _map_category(node):
    children = node.get("children") or node.get("subCategoryList") or []
    return {
        "id": str(_pick_value(node, ("id", "categoryId", "leafId")) or ""),
        "name": _pick_value(node, ("name", "categoryName")) or "",
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
