#!/usr/bin/python3
"""电商工作台 · 适配器基类与统一契约自检。

新增平台只需继承 :class:`SourceAdapter` / :class:`TargetAdapter` 并注册，
应用层不改动（设计稿 4.6 约束）。:func:`assert_source_contract` /
:func:`assert_target_contract` 供契约测试对任意实现（含 mock）做一致性校验。
"""
from ecom.registry import EcomError, UNKNOWN

# 归一化字段：RawProduct / CategoryNode 的最小必备键
RAW_PRODUCT_KEYS = ("source_id", "title", "price", "stock", "images", "skus")
CATEGORY_KEYS = ("id", "name")


class SourceAdapter:
    """源平台适配器基类（采集商品/整店）。"""

    platform = ""

    def fetch_product(self, url_or_id, ctx=None):
        """抓取单个商品，返回 RawProduct（dict）。"""
        raise NotImplementedError

    def fetch_shop(self, shop_url, opts=None, ctx=None):
        """抓取整店商品，返回可迭代的 RawProduct 序列。"""
        raise NotImplementedError


class TargetAdapter:
    """目标平台适配器基类（类目、字段映射、发布、改价、上下架）。"""

    platform = ""

    def fetch_category_tree(self, ctx=None):
        raise NotImplementedError

    def match_category(self, product):
        raise NotImplementedError

    def map_fields(self, product, category_id):
        raise NotImplementedError

    def publish(self, data, shop_auth):
        raise NotImplementedError

    def update_price(self, remote_id, price, shop_auth):
        raise NotImplementedError

    def set_listing(self, remote_id, on, shop_auth):
        raise NotImplementedError

    def list_listings(self, shop_auth, cursor=None):
        raise NotImplementedError


def assert_source_contract(adapter, sample_id="sample-1", shop_url=None, shop_opts=None):
    """校验源适配器是否满足统一契约，返回样例 RawProduct。"""
    if not isinstance(adapter, SourceAdapter):
        raise AssertionError("不是 SourceAdapter: %r" % (adapter,))
    ctx = _mock_ctx()
    product = adapter.fetch_product(sample_id, ctx)
    _check_product(product)
    shop = list(
        adapter.fetch_shop(shop_url or "https://shop.example.com", shop_opts or {"limit": 2}, ctx)
    )
    if not shop:
        raise AssertionError("fetch_shop 应至少返回一个商品")
    for item in shop:
        _check_product(item)
    return product


def assert_target_contract(adapter, product=None):
    """校验目标适配器是否满足统一契约，返回发布后的 remote_id。"""
    if not isinstance(adapter, TargetAdapter):
        raise AssertionError("不是 TargetAdapter: %r" % (adapter,))
    ctx = _mock_ctx()
    tree = adapter.fetch_category_tree(ctx)
    if not isinstance(tree, list) or not tree:
        raise AssertionError("fetch_category_tree 应返回非空列表")
    for node in tree:
        for key in CATEGORY_KEYS:
            if key not in node:
                raise AssertionError("类目节点缺少字段 %s: %r" % (key, node))
    product = product or {"title": "女装连衣裙", "price": 59.0, "category_id": "100101"}
    match = adapter.match_category(product)
    if "category_id" not in match or "confidence" not in match:
        raise AssertionError("match_category 应返回 {category_id, confidence}")
    mapped = adapter.map_fields(product, match["category_id"])
    if "data" not in mapped or "missing" not in mapped:
        raise AssertionError("map_fields 应返回 {data, missing}")
    shop_auth = {"access_token": "mock-token", "shop_id": "s1"}
    published = adapter.publish(mapped["data"], shop_auth)
    if "remote_id" not in published:
        raise AssertionError("publish 应返回 {remote_id}")
    remote_id = published["remote_id"]
    adapter.update_price(remote_id, 88.0, shop_auth)
    adapter.set_listing(remote_id, True, shop_auth)
    listing = adapter.list_listings(shop_auth)
    if "items" not in listing or "cursor" not in listing:
        raise AssertionError("list_listings 应返回 {items, cursor}")
    return remote_id


def _check_product(product):
    if not isinstance(product, dict):
        raise AssertionError("RawProduct 应为 dict: %r" % (product,))
    for key in RAW_PRODUCT_KEYS:
        if key not in product:
            raise AssertionError("RawProduct 缺少字段 %s: %r" % (key, product))
    if not isinstance(product["skus"], list):
        raise AssertionError("RawProduct.skus 应为列表")
    if not isinstance(product["images"], list):
        raise AssertionError("RawProduct.images 应为列表")


def _mock_ctx():
    return {"platform": "mock", "owner": "contract", "auth": {}}


def require_auth(shop_auth):
    """目标适配器通用授权校验：缺失即抛归一化的授权失效错误。"""
    from ecom.registry import AUTH_EXPIRED

    if not shop_auth or not shop_auth.get("access_token"):
        raise EcomError("店铺授权失效或缺失", AUTH_EXPIRED)
    return shop_auth


__all__ = [
    "SourceAdapter",
    "TargetAdapter",
    "assert_source_contract",
    "assert_target_contract",
    "require_auth",
    "RAW_PRODUCT_KEYS",
    "UNKNOWN",
]
