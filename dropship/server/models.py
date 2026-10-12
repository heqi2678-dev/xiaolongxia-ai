#!/usr/bin/python3
"""统一商品数据模型：采集到的原始数据 → 规范化商品。

采集端（浏览器扩展）与上架端（各平台适配器）都围绕这一份结构协作：
采集只填 source / title / images / skus 等原始字段，加工与映射阶段再补齐
category.target、pricing 与 attributes。
"""
from .db import now_iso, new_id

CURRENCY = "CNY"

DEFAULT_SPEC = {"color": "", "size": ""}


def _as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [x for x in v if x]
    return [v]


def _clean_images(items):
    out = []
    seen = set()
    for it in _as_list(items):
        url = it.get("url") if isinstance(it, dict) else it
        if not url or not isinstance(url, str):
            continue
        if url in seen:
            continue
        seen.add(url)
        rec = {"url": url}
        if isinstance(it, dict):
            for k in ("width", "height", "type"):
                if it.get(k) is not None:
                    rec[k] = it[k]
        out.append(rec)
    return out


def _clean_skus(items):
    out = []
    for i, it in enumerate(_as_list(items)):
        it = it if isinstance(it, dict) else {}
        specs = it.get("specs")
        if not isinstance(specs, dict):
            specs = dict(DEFAULT_SPEC)
        rec = {
            "skuId": str(it.get("skuId") or ("sku-%d" % (i + 1))),
            "specs": {str(k): str(v) for k, v in specs.items()},
            "price": _num(it.get("price")),
            "stock": _int(it.get("stock"), 0),
            "image": it.get("image") or "",
            "barcode": it.get("barcode") or "",
        }
        if it.get("weight") is not None:
            rec["weight"] = _num(it.get("weight"))
        out.append(rec)
    return out


def _num(v, default=0.0):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return default


def _int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def normalize_product(raw):
    """把采集原始数据补齐成统一商品模型。缺关键字段时抛 ValueError。"""
    if not isinstance(raw, dict):
        raise ValueError("商品数据必须是对象")
    src = raw.get("source") or {}
    platform = (src.get("platform") or "1688").strip()
    item_id = str(src.get("itemId") or "").strip()
    if not item_id:
        raise ValueError("缺少 source.itemId")
    images = raw.get("images") or {}
    product = {
        "id": raw.get("id") or new_id("p"),
        "source": {
            "platform": platform,
            "itemId": item_id,
            "url": src.get("url") or "",
            "shop": src.get("shop") or "",
            "supplier": src.get("supplier") or "",
            "collectedAt": src.get("collectedAt") or now_iso(),
        },
        "title": (raw.get("title") or "").strip()[:120],
        "description": raw.get("description") or "",
        "sellingPoints": _as_list(raw.get("sellingPoints")),
        "images": {
            "main": _clean_images(images.get("main")),
            "detail": _clean_images(images.get("detail")),
            "white": _clean_images(images.get("white")),
        },
        "skus": _clean_skus(raw.get("skus")),
        "attributes": raw.get("attributes") or {},
        "category": {
            "sourcePath": _as_list((raw.get("category") or {}).get("sourcePath")),
            "target": (raw.get("category") or {}).get("target") or {},
        },
        "pricing": {
            "cost": _num((raw.get("pricing") or {}).get("cost")),
            "price": _num((raw.get("pricing") or {}).get("price")),
            "markup": _num((raw.get("pricing") or {}).get("markup")),
            "currency": (raw.get("pricing") or {}).get("currency") or CURRENCY,
        },
        "publish": raw.get("publish") or [],
        "createdAt": raw.get("createdAt") or now_iso(),
        "updatedAt": now_iso(),
    }
    if not product["images"]["main"]:
        raise ValueError("缺少主图 images.main")
    return product


def validate_for_publish(product, mapping):
    """上架前校验：映射是否齐备、必填字段是否缺失。返回错误列表（空即通过）。"""
    errors = []
    if not product.get("title"):
        errors.append("缺标题")
    if not product["images"]["main"]:
        errors.append("缺主图")
    if not product.get("skus"):
        errors.append("缺 SKU")
    target = (product.get("category") or {}).get("target") or {}
    if not target.get("id"):
        errors.append("未完成平台类目映射")
    if mapping and mapping.get("requiredAttributes"):
        for key in mapping["requiredAttributes"]:
            if key not in (product.get("attributes") or {}):
                errors.append("缺平台必填属性: %s" % key)
    return errors
