#!/usr/bin/python3
"""电商工作台 · Mock 适配器（契约测试与非真机联调用）。

实现设计稿 4.6 的统一契约，供测试通过
:func:`ecom.adapters.base.assert_source_contract` /
:func:`ecom.adapters.base.assert_target_contract` 校验；
真机适配器只替换实现、不改应用层。
"""
from ecom.adapters.base import SourceAdapter, TargetAdapter, require_auth
from ecom.registry import (
    EcomError,
    CATEGORY_RIGHTS,
    FORBIDDEN_WORD,
    normalize_error,
)


def _sku(i, price):
    return {
        "source_sku_id": "sku-%d" % i,
        "spec": "规格%d" % i,
        "price": price,
        "stock": 100 + i,
        "barcode": "69000000000%d" % i,
        "image": "https://img.example.com/%d.jpg" % i,
        "enabled": 1,
    }


def raw_product(source_id, title="样例商品", price=59.0):
    """构造一个符合 RawProduct 契约的商品字典。"""
    return {
        "source_id": str(source_id),
        "source_url": "https://detail.1688.com/offer/%s.html" % source_id,
        "title": title,
        "subtitle": "一件代发",
        "category": "女装/连衣裙",
        "price": price,
        "stock": 200,
        "main_image": "https://img.example.com/%s-main.jpg" % source_id,
        "images": ["https://img.example.com/%s-1.jpg" % source_id],
        "detail": {"html": "<p>详情</p>"},
        "skus": [_sku(1, price), _sku(2, price + 5)],
        "attrs": {"材质": "棉"},
    }


class MockSourceAdapter(SourceAdapter):
    """确定性源适配器：不访问网络，便于契约与端到端测试。"""

    platform = "mock"

    def __init__(self, products=None):
        self._products = list(products) if products is not None else [
            raw_product("10001", "女装连衣裙 碎花"),
            raw_product("10002", "纯棉短袖T恤"),
            raw_product("10003", "牛仔裤 直筒"),
        ]

    def fetch_product(self, url_or_id, ctx=None):
        sid = str(url_or_id)
        for product in self._products:
            if product["source_id"] == sid:
                return dict(product)
        return raw_product(sid)

    def fetch_shop(self, shop_url, opts=None, ctx=None):
        limit = int((opts or {}).get("limit") or len(self._products))
        for product in self._products[:limit]:
            yield dict(product)


class MockTargetAdapter(TargetAdapter):
    """确定性目标适配器：内存态发布，可注入失败用于错误归一化测试。"""

    platform = "mock"

    CATEGORY_TREE = [
        {
            "id": "1001",
            "name": "服饰",
            "children": [
                {"id": "100101", "name": "女装", "leaf": True},
                {"id": "100102", "name": "男装", "leaf": True},
            ],
        },
        {
            "id": "1002",
            "name": "家居",
            "children": [{"id": "100201", "name": "日用", "leaf": True}],
        },
    ]

    def __init__(self, fail_publish=None):
        # fail_publish 可为 EcomError 实例、错误类别字符串或异常
        self._fail_publish = fail_publish
        self.published = {}
        self._seq = 0

    def fetch_category_tree(self, ctx=None):
        return [dict(node) for node in self.CATEGORY_TREE]

    def match_category(self, product):
        title = (product or {}).get("title", "")
        if "女" in title or "连衣裙" in title:
            return {"category_id": "100101", "confidence": 0.92}
        if "男" in title or "T恤" in title:
            return {"category_id": "100102", "confidence": 0.8}
        return {"category_id": "", "confidence": 0.0}

    def map_fields(self, product, category_id):
        product = product or {}
        data = {
            "title": product.get("title", ""),
            "price": float(product.get("price") or 0),
            "stock": int(product.get("stock") or 0),
            "images": list(product.get("images") or []),
            "category_id": category_id,
            "skus": list(product.get("skus") or []),
        }
        missing = []
        if not data["title"]:
            missing.append("title")
        if not data["category_id"]:
            missing.append("category_id")
        if not data["skus"]:
            missing.append("skus")
        if not data["images"]:
            missing.append("images")
        return {"data": data, "missing": missing}

    def publish(self, data, shop_auth):
        require_auth(shop_auth)
        self._raise_if_failed()
        if not (data or {}).get("category_id"):
            raise EcomError("缺少类目资质或类目未匹配", CATEGORY_RIGHTS)
        if "违禁" in (data or {}).get("title", ""):
            raise EcomError("标题命中违禁词", FORBIDDEN_WORD)
        self._seq += 1
        remote_id = "mock-%d" % self._seq
        self.published[remote_id] = dict(data, on=True)
        return {"remote_id": remote_id}

    def update_price(self, remote_id, price, shop_auth):
        require_auth(shop_auth)
        self._raise_if_failed()
        self._require_remote(remote_id)
        self.published[remote_id]["price"] = float(price)

    def set_listing(self, remote_id, on, shop_auth):
        require_auth(shop_auth)
        self._raise_if_failed()
        self._require_remote(remote_id)
        self.published[remote_id]["on"] = bool(on)

    def list_listings(self, shop_auth, cursor=None):
        require_auth(shop_auth)
        items = [
            {"remote_id": rid, "on": value.get("on", True), "title": value.get("title", "")}
            for rid, value in self.published.items()
        ]
        return {"items": items, "cursor": None}

    def _raise_if_failed(self):
        if not self._fail_publish:
            return
        if isinstance(self._fail_publish, Exception):
            raise self._fail_publish
        raise normalize_error(Exception(str(self._fail_publish)))

    def _require_remote(self, remote_id):
        if remote_id not in self.published:
            raise EcomError("远端商品不存在: %s" % remote_id, "unknown")
