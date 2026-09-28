#!/usr/bin/python3
"""电商工作台 · 任务处理器与适配器安装。

把 ``api.py`` 落库的任务真正跑起来（设计稿 6.2 / 6.5 / 6.6 / 6.7 / 6.10）：

- ``collect``       调源适配器采集单商品或整店，写入商品库 / SKU / 素材库
- ``publish``       调目标适配器匹配类目、映射字段、发布，落 listings 绑定（幂等）
- ``price_adjust``  按改价规则算新价，作用到商品源价或指定店铺已上架商品
- ``listing``       批量上下架，作用到 listings 绑定的远端 id
- ``assets``        图片工坊批处理：产出处理方案（真处理器在 Task 11 接入）
- ``generate``      AI 素材生成：产出生成方案（生成引擎在 Task 11 / 二期接入）
- ``compliance``    违禁词 / 品牌词 / B 端词 / 重复铺货检测，写 compliance_reports

适配器安装：mock 始终注册（便于非真机联调），1688 / 抖音仅当检测到凭证时注册。
"""
import hashlib
import math
import os

from ecom import queue, registry, store
from ecom.adapters import mock
from ecom.registry import EcomError, AUTH_EXPIRED, UNKNOWN

# B 端词：铺货到 C 端平台前需改写（设计稿 6.5 第 39 条）
B_END_WORDS = (
    "厂家直供", "源头工厂", "一件代发", "支持一件代发", "工厂直销",
    "批发", "拿货", "供货", "档口", "现货批发", "量大从优",
)

# B 端词 -> C 端场景词（标题规则默认词库，可被策略覆盖）
DEFAULT_TITLE_MAP = {
    "厂家直供": "品质优选",
    "源头工厂": "源头好货",
    "一件代发": "急速发货",
    "支持一件代发": "急速发货",
    "工厂直销": "品质优选",
    "批发": "",
    "拿货": "",
    "供货": "",
    "档口": "",
    "现货批发": "",
    "量大从优": "",
}

# 品牌词样例（侵权检测用，真机应接平台品牌库，届时替换）
BRAND_WORDS = ("nike", "adidas", "disney", "gucci", "chanel", "apple", "华为", "小米")

# 违禁词样例（真机应接平台违禁词库）
FORBIDDEN_WORDS = ("国家级", "最高级", "最佳", "第一品牌", "绝无仅有", "百分百有效")

ROUND_MODES = ("none", "up", "down", "end9")


def compute_price(price, rule):
    """按改价规则算新价（设计稿 6.6：固定加价 / 百分比 / 尾数 / 区间夹取）。"""
    rule = rule or {}
    base = float(price or 0)
    mode = rule.get("mode") or "fixed"
    value = float(rule.get("value") or 0)
    if mode in ("ratio", "percent"):
        new = base * value
    elif mode in ("fixed", "add"):
        new = base + value
    else:
        new = base
    rounding = rule.get("round") or "none"
    if rounding == "up":
        new = math.ceil(new)
    elif rounding == "down":
        new = math.floor(new)
    elif rounding == "end9":
        new = math.floor(new) + 0.9
    min_price = float(rule.get("min_price") or 0)
    if min_price and new < min_price:
        new = min_price
    return round(new, 2)


def apply_title_rules(title, rule):
    """按标题规则做 B 端词改写与前后缀（设计稿 6.5 第 39 条）。"""
    rule = rule or {}
    text = title or ""
    mapping = dict(DEFAULT_TITLE_MAP)
    mapping.update(rule.get("map") or {})
    for src, dst in mapping.items():
        text = text.replace(src, dst)
    prefix = rule.get("prefix") or ""
    suffix = rule.get("suffix") or ""
    text = "%s%s%s" % (prefix, text, suffix)
    return text.strip()


def _hit_words(text, words):
    low = (text or "").lower()
    return [w for w in words if w.lower() in low]


def check_compliance(title, detail=""):
    """合规检测：返回 (verdict, hits)。命中违禁/品牌 -> block，命中 B 端词 -> warn。"""
    text = "%s %s" % (title or "", detail or "")
    hits = []
    for word in _hit_words(text, FORBIDDEN_WORDS):
        hits.append({"type": "forbidden", "word": word, "level": "block"})
    for word in _hit_words(text, BRAND_WORDS):
        hits.append({"type": "brand", "word": word, "level": "block"})
    for word in _hit_words(text, B_END_WORDS):
        hits.append({"type": "b_end", "word": word, "level": "warn"})
    if any(h["level"] == "block" for h in hits):
        return "block", hits
    if hits:
        return "warn", hits
    return "pass", hits


# ------------------------------- 采集 ------------------------------- #


def _product_fields(raw):
    return {
        "source_url": raw.get("source_url", ""),
        "title": raw.get("title", ""),
        "subtitle": raw.get("subtitle", ""),
        "category": raw.get("category", ""),
        "price": float(raw.get("price") or 0),
        "stock": int(raw.get("stock") or 0),
        "main_image": raw.get("main_image", ""),
        "images_json": list(raw.get("images") or []),
        "detail_json": raw.get("detail") or {},
        "attrs_json": raw.get("attrs") or {},
        "status": "collected",
    }


def _save_media(owner, product_id, urls, role="gallery"):
    saved = 0
    for url in urls or []:
        if not url:
            continue
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
        if store.find_media_by_hash(owner, digest):
            continue
        store.insert(
            "media",
            owner,
            {
                "product_id": product_id,
                "kind": "image",
                "role": role,
                "url": url,
                "source_url": url,
                "source_type": "collected",
                "hash": digest,
                "meta_json": {"product_id": product_id},
            },
        )
        saved += 1
    return saved


def save_raw_product(owner, platform, raw):
    """把一个 RawProduct 落商品库 + SKU + 素材库，返回商品字典。"""
    product = store.upsert_product(
        owner, platform, raw.get("source_id", ""), _product_fields(raw)
    )
    store.replace_skus(owner, product["id"], raw.get("skus") or [])
    images = list(raw.get("images") or [])
    main = raw.get("main_image")
    if main and main not in images:
        images.insert(0, main)
    _save_media(owner, product["id"], images, role="main" if main else "gallery")
    return product, len(raw.get("skus") or []), len(images)


def collect_handler(task, item):
    owner = task["owner"]
    params = task.get("params_json") or {}
    payload = item.get("payload_json") or {}
    platform = payload.get("platform") or params.get("platform") or "1688"
    adapter = registry.source(platform)
    ctx = {"platform": platform, "owner": owner, "auth": {}}
    if item.get("ref_type") == "shop":
        opts = payload.get("opts") or {}
        count = 0
        for raw in adapter.fetch_shop(item.get("ref_id", ""), opts, ctx):
            save_raw_product(owner, platform, raw)
            count += 1
        return {"platform": platform, "collected": count}
    raw = adapter.fetch_product(item.get("ref_id", ""), ctx)
    product, skus, media = save_raw_product(owner, platform, raw)
    return {
        "platform": platform,
        "product_id": product["id"],
        "source_id": product.get("source_id", ""),
        "skus": skus,
        "media": media,
    }


# ------------------------------- 铺货 ------------------------------- #


def _shop_auth(owner, shop_id):
    shop = store.get("shops", owner, shop_id)
    if not shop:
        raise EcomError("店铺不存在: %s" % shop_id, UNKNOWN)
    auth = shop.get("auth_json") or {}
    if shop.get("auth_status") != "normal" or not auth.get("access_token"):
        raise EcomError("店铺授权失效或未授权: %s" % shop_id, AUTH_EXPIRED)
    return shop, auth


def _product_with_skus(owner, product_id):
    product = store.get("products", owner, product_id)
    if not product:
        raise EcomError("商品不存在: %s" % product_id, UNKNOWN)
    product = dict(product)
    product["skus"] = store.list_skus(owner, product_id)
    return product


def publish_handler(task, item):
    owner = task["owner"]
    params = task.get("params_json") or {}
    payload = item.get("payload_json") or {}
    platform = payload.get("platform") or params.get("platform") or "douyin"
    strategy = params.get("strategy") or {}
    product_id = item.get("ref_id", "")
    shop_id = payload.get("shop_id", "")

    existing = store.find_listing(owner, platform, shop_id, product_id)
    if existing and existing.get("remote_id"):
        return {"remote_id": existing["remote_id"], "shop_id": shop_id, "skipped": True}

    shop, auth = _shop_auth(owner, shop_id)
    adapter = registry.target(platform)
    product = _product_with_skus(owner, product_id)

    category_id = payload.get("category_id") or strategy.get("category_id")
    if not category_id:
        category_id = adapter.match_category(product).get("category_id")
    mapped = adapter.map_fields(product, category_id)
    data = dict(mapped.get("data") or {})
    data["title"] = apply_title_rules(data.get("title", ""), strategy.get("title"))
    price = data.get("price")
    if strategy.get("price_rule"):
        price = compute_price(price, strategy["price_rule"])
    if price is not None:
        data["price"] = price

    published = adapter.publish(data, auth)
    remote_id = published.get("remote_id", "")
    store.upsert_listing(
        owner,
        platform,
        shop_id,
        product_id,
        {"remote_id": remote_id, "status": "on", "price": float(price or 0)},
    )
    store.update("products", owner, product_id, {"status": "published"})
    return {
        "remote_id": remote_id,
        "shop_id": shop_id,
        "shop_name": shop.get("name", ""),
        "category_id": category_id,
    }


# ------------------------------- 改价 / 上下架 ------------------------------- #


def price_adjust_handler(task, item):
    owner = task["owner"]
    params = task.get("params_json") or {}
    payload = item.get("payload_json") or {}
    rule = params.get("rule") or {}
    product_id = item.get("ref_id", "")

    if params.get("scope") == "listings":
        platform = payload.get("platform") or params.get("platform") or "douyin"
        shop_id = payload.get("shop_id", "")
        listing = store.find_listing(owner, platform, shop_id, product_id)
        if not listing or not listing.get("remote_id"):
            return {"product_id": product_id, "shop_id": shop_id, "skipped": True}
        _shop, auth = _shop_auth(owner, shop_id)
        new_price = compute_price(listing.get("price"), rule)
        registry.target(platform).update_price(listing["remote_id"], new_price, auth)
        store.update("listings", owner, listing["id"], {"price": new_price})
        return {"product_id": product_id, "shop_id": shop_id, "price": new_price}

    product = store.get("products", owner, product_id)
    if not product:
        raise EcomError("商品不存在: %s" % product_id, UNKNOWN)
    new_price = compute_price(product.get("price"), rule)
    store.update("products", owner, product_id, {"price": new_price})
    return {"product_id": product_id, "price": new_price}


def listing_handler(task, item):
    owner = task["owner"]
    params = task.get("params_json") or {}
    payload = item.get("payload_json") or {}
    platform = payload.get("platform") or params.get("platform") or "douyin"
    shop_id = payload.get("shop_id", "")
    product_id = item.get("ref_id", "")
    on = bool(params.get("on", True))

    listing = store.find_listing(owner, platform, shop_id, product_id)
    if not listing or not listing.get("remote_id"):
        return {"product_id": product_id, "shop_id": shop_id, "skipped": True}
    _shop, auth = _shop_auth(owner, shop_id)
    registry.target(platform).set_listing(listing["remote_id"], on, auth)
    store.update("listings", owner, listing["id"], {"status": "on" if on else "off"})
    return {"product_id": product_id, "shop_id": shop_id, "on": on}


# ------------------------------- 素材 / 生成 ------------------------------- #


def assets_handler(task, item):
    """图片工坊批处理：当前产出处理方案，真处理器（抠图/白底/去重等）在 Task 11 接入。"""
    params = task.get("params_json") or {}
    return {
        "media_id": item.get("ref_id", ""),
        "recipe": params.get("recipe") or "",
        "ops": params.get("ops") or [],
        "size": params.get("size") or "",
        "processor": "pending",
    }


def generate_handler(task, item):
    """AI 素材生成：当前产出生成方案，生成引擎（BYOK）在 Task 11 / 二期接入。"""
    params = task.get("params_json") or {}
    payload = item.get("payload_json") or {}
    return {
        "product_id": item.get("ref_id", ""),
        "type": payload.get("type") or params.get("type") or "main",
        "engine": params.get("engine") or "pending",
    }


# ------------------------------- 合规 ------------------------------- #


def compliance_handler(task, item):
    owner = task["owner"]
    params = task.get("params_json") or {}
    platform = params.get("platform") or ""
    product_id = item.get("ref_id", "")
    product = _product_with_skus(owner, product_id)
    verdict, hits = check_compliance(
        product.get("title", ""), str(product.get("detail_json") or "")
    )
    same_title = store.list_rows(
        "products",
        owner,
        where="title=? AND id<>?",
        params=(product.get("title", ""), product_id),
        limit=1,
    )
    if same_title:
        hits.append(
            {"type": "duplicate", "word": product.get("title", ""), "level": "warn"}
        )
        if verdict == "pass":
            verdict = "warn"
    store.insert(
        "compliance_reports",
        owner,
        {
            "product_id": product_id,
            "target_platform": platform,
            "verdict": verdict,
            "hits_json": hits,
        },
    )
    return {"product_id": product_id, "verdict": verdict, "hits": hits}


# ------------------------------- 安装 ------------------------------- #

_HANDLERS = {
    "collect": collect_handler,
    "publish": publish_handler,
    "price_adjust": price_adjust_handler,
    "listing": listing_handler,
    "assets": assets_handler,
    "generate": generate_handler,
    "compliance": compliance_handler,
}


def ensure_adapters():
    """注册适配器：mock 始终可用；真机平台按凭证存在与否注册。"""
    registry.register_source("mock", mock.MockSourceAdapter())
    registry.register_target("mock", mock.MockTargetAdapter())
    if os.environ.get("ECOM_1688_APPKEY"):
        from ecom.adapters import source_1688

        registry.register_source("1688", source_1688.Source1688Adapter())
    if os.environ.get("ECOM_DOUYIN_APPKEY"):
        from ecom.adapters import target_douyin

        registry.register_target("douyin", target_douyin.TargetDouyinAdapter())


def install():
    """注册全部任务处理器并安装适配器（幂等）。"""
    store.ensure()
    ensure_adapters()
    for kind, handler in _HANDLERS.items():
        queue.register(kind, handler)
    return sorted(_HANDLERS)
