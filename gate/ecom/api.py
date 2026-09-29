#!/usr/bin/python3
"""电商工作台 · 后端 API 路由层（设计稿 8 · ``/dian/api/ecom/*``）。

设计为纯函数路由：``handle(method, path, owner, query, body) -> (status, payload)``，
不依赖 HTTP 框架，便于单测；由 ``gate/server.py`` 挂载到 ``/api/ecom/*``。

- ``owner`` 复用 gate 会话（登录账号名），全部数据按其作用域隔离。
- 成功返回 ``{"ok": true, ...}``；失败返回 ``{"ok": false, "error", "code"}``。
- 写操作落任务（``ecom.queue``），由处理器异步执行；合规检测默认同步执行。
"""
import os

from ecom import jobs, queue, registry, store, tokens
from ecom.registry import EcomError

INGEST_PLATFORMS = ("1688", "taobao", "douyin")

PRODUCT_PATCH_FIELDS = ("title", "subtitle", "category", "price", "stock", "main_image")
PRODUCT_JSON_FIELDS = {
    "images": "images_json",
    "detail": "detail_json",
    "attrs": "attrs_json",
    "tags": "tags_json",
}


def _error(message, code="bad_request"):
    return {"ok": False, "error": str(message), "code": code}


def _err(status, message, code="bad_request"):
    return status, _error(message, code)


def _ok(**data):
    payload = {"ok": True}
    payload.update(data)
    return 200, payload


def handle(method, path, owner, query=None, body=None):
    query = dict(query or {})
    body = body if isinstance(body, dict) else {}
    try:
        return _dispatch((method or "GET").upper(), _norm(path), owner, query, body)
    except EcomError as exc:
        code = exc.code
        status = 401 if code == "auth_expired" else 400
        return status, _error(str(exc), code)
    except KeyError as exc:
        return _err(404, exc.args[0] if exc.args else "资源不存在", "not_found")
    except (ValueError, TypeError) as exc:
        return _err(400, exc, "bad_request")


def _norm(path):
    path = (path or "/").split("?", 1)[0]
    if not path.startswith("/"):
        path = "/" + path
    return path.rstrip("/") or "/"


# ------------------------------- 分发 ------------------------------- #


def _dispatch(method, path, owner, query, body):
    parts = [p for p in path.split("/") if p]
    if not parts:
        return _err(404, "没有这个接口", "not_found")
    head, rest = parts[0], parts[1:]

    if head == "collect":
        if method == "POST" and not rest:
            return _collect_submit(owner, body)
        if method == "POST" and rest == ["ingest"]:
            return _collect_ingest(owner, body)
        if method == "GET" and len(rest) == 1:
            return _collect_progress(owner, rest[0])
    elif head == "plugin" and rest == ["token"]:
        if method == "POST":
            return _plugin_token_mint(owner, body)
        if method == "GET":
            return _plugin_token_status(owner)
        if method == "DELETE":
            return _plugin_token_revoke(owner)
    elif head == "products":
        if method == "GET" and not rest:
            return _products_list(owner, query)
        if method == "POST" and rest == ["batch"]:
            return _products_batch(owner, body)
        if len(rest) == 1 and method in ("PATCH", "POST"):
            return _product_edit(owner, rest[0], body)
        if len(rest) == 1 and method == "GET":
            return _product_detail(owner, rest[0])
    elif head == "assets":
        if not rest and method == "GET":
            return _assets_list(owner, query)
        if rest == ["recipes"] and method == "GET":
            return _assets_recipes()
        if rest == ["process"] and method == "POST":
            return _assets_process(owner, body)
    elif head == "generate" and not rest and method == "POST":
        return _generate(owner, body)
    elif head == "publish" and method == "POST":
        if not rest:
            return _publish_submit(owner, body)
        if rest == ["precheck"]:
            return _publish_precheck(owner, body)
    elif head == "price" and rest == ["adjust"] and method == "POST":
        return _price_adjust(owner, body)
    elif head == "listing" and rest == ["batch"] and method == "POST":
        return _listing_batch(owner, body)
    elif head == "compliance" and rest == ["check"] and method == "POST":
        return _compliance_check(owner, body)
    elif head == "shops":
        if not rest and method == "GET":
            return _shops_list(owner, query)
        if not rest and method == "POST":
            return _shop_create(owner, body)
        if rest == ["auth"] and method == "POST":
            return _shop_auth(owner, body)
        if len(rest) == 1 and method == "DELETE":
            return _shop_delete(owner, rest[0])
    elif head == "shop-groups":
        if not rest and method == "GET":
            return _shop_groups_list(owner)
        if not rest and method == "POST":
            return _shop_group_create(owner, body)
    elif head == "tasks":
        if not rest and method == "GET":
            return _tasks_list(owner, query)
        if len(rest) == 1 and method == "GET":
            return _task_detail(owner, rest[0])
        if len(rest) == 2 and rest[1] == "retry" and method == "POST":
            return _task_retry(owner, rest[0])
        if len(rest) == 2 and rest[1] == "pause" and method == "POST":
            return _task_pause(owner, rest[0])
    elif head == "stats" and not rest and method == "GET":
        return _ok(**store.stats(owner))
    return _err(404, "没有这个接口", "not_found")


# ------------------------------- 工具 ------------------------------- #


def _ids(body, key="ids"):
    raw = body.get(key) or []
    if isinstance(raw, str):
        raw = [raw]
    return [str(x) for x in raw if x]


def _page(query):
    page = int(query.get("page") or 1)
    size = int(query.get("page_size") or 20)
    return max(1, page), max(1, min(size, 100))


def _product_patch(patch):
    data = {}
    for name in PRODUCT_PATCH_FIELDS:
        if name in patch:
            data[name] = patch[name]
    for name, column in PRODUCT_JSON_FIELDS.items():
        if name in patch:
            data[column] = patch[name]
    if "status" in patch:
        data["status"] = patch["status"]
    return data


def _snapshot(owner, product_id, product, note):
    store.insert(
        "product_versions",
        owner,
        {"product_id": product_id, "note": note, "snapshot_json": product},
    )


def _create(owner, kind, title, items, params):
    if not items:
        raise ValueError("没有可执行的对象")
    return queue.create_task(owner, kind, title=title, items=items, params=params)


def _drop_schedule(params, body):
    if body.get("schedule"):
        params["schedule"] = body["schedule"]
    if body.get("run_after"):
        params["run_after"] = body["run_after"]
    return params


# ------------------------------- 采集 ------------------------------- #


def _collect_submit(owner, body):
    platform = body.get("platform") or "1688"
    mode = body.get("mode") or ("shop" if body.get("shop_url") else "product")
    items = []
    if mode == "shop" or body.get("shop_url"):
        shop_url = body.get("shop_url")
        if not shop_url:
            raise ValueError("整店采集需要 shop_url")
        items.append(
            {
                "ref_type": "shop",
                "ref_id": str(shop_url),
                "platform": platform,
                "opts": body.get("opts") or {},
            }
        )
    else:
        urls = body.get("urls") or ([body["url"]] if body.get("url") else [])
        if not urls:
            raise ValueError("采集需要 url 或 urls")
        for url in urls:
            items.append({"ref_type": "product", "ref_id": str(url), "platform": platform})
    params = _drop_schedule(
        {"platform": platform, "mode": mode, "opts": body.get("opts") or {}}, body
    )
    task = _create(owner, "collect", body.get("title") or "采集任务", items, params)
    return _ok(task=task, item_count=len(items))


def _collect_progress(owner, task_id):
    task = store.get("tasks", owner, task_id)
    if not task:
        return _err(404, "任务不存在", "not_found")
    items = store.list_rows(
        "task_items", owner, where="task_id=?", params=(task_id,), order="seq ASC"
    )
    return _ok(task=task, items=items)


def _ingest_max():
    try:
        return max(1, int(os.environ.get("INGEST_MAX_ITEMS") or 200))
    except (TypeError, ValueError):
        return 200


def _normalize_raw(raw):
    """校验并规整插件提交的单条 RawProduct。"""
    if not isinstance(raw, dict):
        raise ValueError("商品数据格式不正确")
    source_id = str(raw.get("source_id") or "").strip()
    title = str(raw.get("title") or "").strip()
    if not source_id:
        raise ValueError("缺少 source_id")
    if not title:
        raise ValueError("缺少 title")
    data = dict(raw)
    data["source_id"] = source_id
    data["title"] = title
    data["images"] = [str(u) for u in (raw.get("images") or []) if u]
    data["skus"] = [s for s in (raw.get("skus") or []) if isinstance(s, dict)]
    return data


def _collect_ingest(owner, body):
    """接收浏览器插件提交的商品数据，落库并异步转存图片（设计：插件采集）。"""
    platform = str(body.get("platform") or "1688").strip()
    if platform not in INGEST_PLATFORMS:
        raise ValueError("不支持的平台: %s" % platform)
    items = body.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("采集需要 items")
    limit = _ingest_max()
    if len(items) > limit:
        raise ValueError("单次采集最多 %d 条" % limit)

    results = []
    errors = []
    product_ids = []
    for index, raw in enumerate(items):
        source_id = str(raw.get("source_id") or "") if isinstance(raw, dict) else ""
        try:
            data = _normalize_raw(raw)
            product, skus, media_count = jobs.save_raw_product(owner, platform, data)
            results.append(
                {
                    "index": index,
                    "source_id": data["source_id"],
                    "product_id": product["id"],
                    "skus": skus,
                    "media": media_count,
                    "error": None,
                }
            )
            product_ids.append(product["id"])
        except (ValueError, TypeError, KeyError) as exc:
            errors.append({"index": index, "source_id": source_id, "error": str(exc)})
            results.append(
                {
                    "index": index,
                    "source_id": source_id,
                    "product_id": "",
                    "skus": 0,
                    "media": 0,
                    "error": str(exc),
                }
            )

    media_task_id = ""
    if product_ids:
        task = queue.create_task(
            owner,
            "media_fetch",
            title="图片转存",
            items=[
                {"ref_type": "product", "ref_id": pid, "platform": platform}
                for pid in product_ids
            ],
            params={"platform": platform},
        )
        media_task_id = task["id"]

    return _ok(
        platform=platform,
        count=len(items),
        saved=len(product_ids),
        failed=len(errors),
        results=results,
        errors=errors,
        media_task_id=media_task_id,
    )


# ------------------------------- 插件口令 ------------------------------- #


def _plugin_token_mint(owner, body):
    token = tokens.mint(owner, note=(body or {}).get("note") or "")
    info = tokens.info(owner) or {}
    info["active"] = True
    return _ok(token=token, **info)


def _plugin_token_status(owner):
    info = tokens.info(owner)
    if not info:
        return _ok(active=False)
    info["active"] = True
    return _ok(**info)


def _plugin_token_revoke(owner):
    return _ok(removed=tokens.revoke(owner))


# ------------------------------- 商品 ------------------------------- #


def _products_list(owner, query):
    page, size = _page(query)
    where, params = [], []
    if query.get("platform"):
        where.append("source_platform=?")
        params.append(query["platform"])
    if query.get("status"):
        where.append("status=?")
        params.append(query["status"])
    if query.get("keyword"):
        where.append("title LIKE ?")
        params.append("%%%s%%" % query["keyword"])
    clause = " AND ".join(where)
    total = store.count("products", owner, clause, tuple(params))
    order = "updated_at DESC"
    if query.get("sort") == "price":
        order = "price DESC"
    items = store.list_rows(
        "products",
        owner,
        where=clause,
        params=tuple(params),
        order=order,
        limit=size,
        offset=(page - 1) * size,
    )
    return _ok(items=items, total=total, page=page, page_size=size)


def _product_detail(owner, product_id):
    product = store.get("products", owner, product_id)
    if not product:
        return _err(404, "商品不存在", "not_found")
    return _ok(
        product=product,
        skus=store.list_skus(owner, product_id),
        media=store.list_media(owner, product_id),
        listings=store.list_listings(owner, product_id=product_id),
        report=store.latest_report(owner, product_id),
        versions=store.list_rows(
            "product_versions",
            owner,
            where="product_id=?",
            params=(product_id,),
            order="created_at DESC",
            limit=20,
        ),
    )


def _product_edit(owner, product_id, body):
    product = store.get("products", owner, product_id)
    if not product:
        return _err(404, "商品不存在", "not_found")
    _snapshot(owner, product_id, product, body.get("note") or "编辑")
    patch = _product_patch(body)
    if patch:
        store.update("products", owner, product_id, patch)
    if body.get("skus") is not None:
        store.replace_skus(owner, product_id, body["skus"])
    return _product_detail(owner, product_id)


def _products_batch(owner, body):
    ids = _ids(body)
    if not ids:
        raise ValueError("批量编辑需要 ids")
    patch = _product_patch(body.get("patch") or body)
    if not patch and body.get("skus") is None:
        raise ValueError("没有可更新的字段")
    updated = 0
    for product_id in ids:
        product = store.get("products", owner, product_id)
        if not product:
            continue
        _snapshot(owner, product_id, product, body.get("note") or "批量编辑")
        if patch:
            store.update("products", owner, product_id, patch)
        if body.get("skus") is not None:
            store.replace_skus(owner, product_id, body["skus"])
        updated += 1
    return _ok(updated=updated, ids=ids)


# ------------------------------- 素材 / 生成 ------------------------------- #


def _assets_list(owner, query):
    page, size = _page(query)
    where, params = [], []
    if query.get("kind"):
        where.append("kind=?")
        params.append(query["kind"])
    if query.get("product_id"):
        where.append("product_id=?")
        params.append(query["product_id"])
    if query.get("source"):
        where.append("source_type=?")
        params.append(query["source"])
    clause = " AND ".join(where)
    total = store.count("media", owner, clause, tuple(params))
    items = store.list_rows(
        "media",
        owner,
        where=clause,
        params=tuple(params),
        order="created_at DESC",
        limit=size,
        offset=(page - 1) * size,
    )
    return _ok(items=items, total=total, page=page, page_size=size)


def _assets_recipes():
    from ecom.imaging import PLATFORMS, PROCESSORS, RECIPES, SIZE_TABLE

    recipes = [
        {"id": rid, "label": r["label"], "roles": r.get("roles") or [], "ops": r.get("ops") or []}
        for rid, r in RECIPES.items()
    ]
    processors = [{"id": pid, "label": label} for pid, label in PROCESSORS.items()]
    return _ok(recipes=recipes, processors=processors, sizes=SIZE_TABLE, platforms=PLATFORMS)


def _assets_process(owner, body):
    media_ids = _ids(body, "media_ids")
    product_ids = _ids(body, "product_ids")
    items = [{"ref_type": "media", "ref_id": mid} for mid in media_ids]
    items += [{"ref_type": "product", "ref_id": pid} for pid in product_ids]
    params = _drop_schedule(
        {
            "recipe": body.get("recipe") or "",
            "ops": body.get("ops") or [],
            "size": body.get("size") or "",
            "spec_id": body.get("spec_id") or "",
            "platform": body.get("platform") or "",
        },
        body,
    )
    task = _create(owner, "assets", body.get("title") or "图片工坊批处理", items, params)
    if body.get("sync"):
        queue.run_task(owner, task["id"])
        task = store.get("tasks", owner, task["id"])
        rows = store.list_rows(
            "task_items", owner, where="task_id=?", params=(task["id"],)
        )
        outputs = []
        for row in rows:
            outputs.extend((row.get("result_json") or {}).get("outputs") or [])
        return _ok(task=task, item_count=len(items), outputs=outputs)
    return _ok(task=task, item_count=len(items))


def _generate(owner, body):
    product_ids = _ids(body, "product_ids")
    if not product_ids:
        raise ValueError("AI 生成需要 product_ids")
    types = body.get("types") or [body.get("type") or "main"]
    items = [
        {"ref_type": "product", "ref_id": pid, "type": t}
        for pid in product_ids
        for t in types
    ]
    params = _drop_schedule(
        {"engine": body.get("engine") or "", "reference": body.get("reference") or {}}, body
    )
    task = _create(owner, "generate", body.get("title") or "AI 素材生成", items, params)
    return _ok(task=task, item_count=len(items))


# ------------------------------- 铺货 ------------------------------- #


def _open_publish_keys(owner):
    keys = set()
    tasks = store.list_rows(
        "tasks",
        owner,
        where="kind='publish' AND status IN ('scheduled','queued','running','paused')",
    )
    for task in tasks:
        items = store.list_rows(
            "task_items", owner, where="task_id=?", params=(task["id"],)
        )
        for item in items:
            keys.add((item.get("ref_id", ""), (item.get("payload_json") or {}).get("shop_id", "")))
    return keys


def _precheck_product(owner, product, adapter, platform, strategy):
    from ecom.jobs import B_END_WORDS, check_compliance, compute_price

    out = []
    pid = product["id"]
    if adapter is not None:
        match = adapter.match_category(product)
        cid = match.get("category_id")
        if cid:
            out.append(
                {
                    "productId": pid,
                    "dimension": "category",
                    "level": "pass",
                    "message": "匹配类目 %s（置信度 %.2f）" % (cid, match.get("confidence", 0)),
                }
            )
        else:
            out.append(
                {
                    "productId": pid,
                    "dimension": "category",
                    "level": "fail",
                    "message": "未匹配到目标类目，需人工指定",
                }
            )
    title = product.get("title", "")
    b_words = [w for w in B_END_WORDS if w in title]
    if b_words:
        out.append(
            {
                "productId": pid,
                "dimension": "title",
                "level": "warn",
                "message": "标题含B端词：%s" % "、".join(b_words),
            }
        )
    else:
        out.append(
            {"productId": pid, "dimension": "title", "level": "pass", "message": "标题符合C端表述"}
        )
    if product.get("main_image") or product.get("images_json"):
        out.append(
            {"productId": pid, "dimension": "image", "level": "pass", "message": "主图齐备"}
        )
    else:
        out.append(
            {"productId": pid, "dimension": "image", "level": "fail", "message": "缺少主图"}
        )
    price = float(product.get("price") or 0)
    if price <= 0:
        out.append(
            {"productId": pid, "dimension": "price", "level": "fail", "message": "供货价为 0，无法定价"}
        )
    else:
        suggested = price
        if strategy.get("price_rule"):
            suggested = compute_price(price, strategy["price_rule"])
        out.append(
            {
                "productId": pid,
                "dimension": "price",
                "level": "pass",
                "message": "按公式生成售价 %s" % suggested,
            }
        )
    verdict, hits = check_compliance(title, str(product.get("detail_json") or ""))
    level = {"pass": "pass", "warn": "warn", "block": "fail"}[verdict]
    out.append(
        {
            "productId": pid,
            "dimension": "compliance",
            "level": level,
            "message": "合规命中：%s" % "、".join(h["word"] for h in hits) if hits else "合规通过",
        }
    )
    return out


def _publish_precheck(owner, body):
    product_ids = _ids(body, "product_ids") or _ids(body)
    if not product_ids:
        raise ValueError("铺货预检需要 product_ids")
    platform = body.get("platform") or "douyin"
    strategy = body.get("strategy") or {}
    adapter = registry.target(platform) if platform in registry.REGISTRY.targets() else None
    items = []
    for product_id in product_ids:
        product = store.get("products", owner, product_id)
        if not product:
            items.append(
                {
                    "productId": product_id,
                    "dimension": "product",
                    "level": "fail",
                    "message": "商品不存在",
                }
            )
            continue
        product = dict(product)
        product["skus"] = store.list_skus(owner, product_id)
        items.extend(_precheck_product(owner, product, adapter, platform, strategy))
    if any(i["level"] == "fail" for i in items):
        verdict = "fail"
    elif any(i["level"] == "warn" for i in items):
        verdict = "warn"
    else:
        verdict = "pass"
    return _ok(verdict=verdict, items=items, platform=platform)


def _publish_submit(owner, body):
    product_ids = _ids(body, "product_ids") or _ids(body)
    shop_ids = _ids(body, "shop_ids")
    if not product_ids:
        raise ValueError("铺货需要 product_ids")
    if not shop_ids:
        raise ValueError("铺货需要 shop_ids")
    platform = body.get("platform") or "douyin"
    open_keys = _open_publish_keys(owner)
    items, deduped = [], 0
    for product_id in product_ids:
        for shop_id in shop_ids:
            existing = store.find_listing(owner, platform, shop_id, product_id)
            if (existing and existing.get("remote_id")) or (product_id, shop_id) in open_keys:
                deduped += 1
                continue
            items.append(
                {
                    "ref_type": "product",
                    "ref_id": product_id,
                    "shop_id": shop_id,
                    "platform": platform,
                }
            )
    if not items:
        return _ok(task=None, item_count=0, deduped=deduped)
    params = _drop_schedule(
        {"platform": platform, "strategy": body.get("strategy") or {}}, body
    )
    task = queue.create_task(
        owner, "publish", title=body.get("title") or "一键铺货", items=items, params=params
    )
    return _ok(task=task, item_count=len(items), deduped=deduped)


# ------------------------------- 改价 / 上下架 ------------------------------- #


def _price_adjust(owner, body):
    product_ids = _ids(body, "product_ids") or _ids(body)
    if not product_ids:
        raise ValueError("改价需要 product_ids")
    scope = body.get("scope") or "products"
    platform = body.get("platform") or "douyin"
    rule = body.get("rule") or {}
    if body.get("rule_id"):
        rule = store.get("price_rules", owner, body["rule_id"]) or rule
    items = []
    if scope == "listings":
        shop_ids = _ids(body, "shop_ids")
        if not shop_ids:
            raise ValueError("对已上架商品改价需要 shop_ids")
        for product_id in product_ids:
            for shop_id in shop_ids:
                items.append(
                    {
                        "ref_type": "product",
                        "ref_id": product_id,
                        "shop_id": shop_id,
                        "platform": platform,
                    }
                )
    else:
        items = [{"ref_type": "product", "ref_id": pid} for pid in product_ids]
    params = _drop_schedule({"scope": scope, "rule": rule, "platform": platform}, body)
    task = queue.create_task(
        owner, "price_adjust", title=body.get("title") or "批量改价", items=items, params=params
    )
    return _ok(task=task, item_count=len(items))


def _listing_batch(owner, body):
    product_ids = _ids(body, "product_ids") or _ids(body)
    shop_ids = _ids(body, "shop_ids")
    if not product_ids:
        raise ValueError("上下架需要 product_ids")
    if not shop_ids:
        raise ValueError("上下架需要 shop_ids")
    on = bool(body.get("on", True))
    platform = body.get("platform") or "douyin"
    items = [
        {"ref_type": "product", "ref_id": pid, "shop_id": sid, "platform": platform}
        for pid in product_ids
        for sid in shop_ids
    ]
    params = _drop_schedule({"on": on, "platform": platform}, body)
    task = queue.create_task(
        owner, "listing", title=body.get("title") or "批量上下架", items=items, params=params
    )
    return _ok(task=task, item_count=len(items))


# ------------------------------- 合规 ------------------------------- #


def _compliance_check(owner, body):
    product_ids = _ids(body, "product_ids") or _ids(body)
    if not product_ids:
        raise ValueError("合规检测需要 product_ids")
    platform = body.get("platform") or ""
    items = [{"ref_type": "product", "ref_id": pid} for pid in product_ids]
    params = {"platform": platform}
    task = queue.create_task(
        owner, "compliance", title=body.get("title") or "合规检测", items=items, params=params
    )
    reports = []
    if not body.get("async"):
        queue.run_task(owner, task["id"])
        task = store.get("tasks", owner, task["id"])
        reports = [
            store.latest_report(owner, pid, platform or None) or {"product_id": pid}
            for pid in product_ids
        ]
    verdict = "pass"
    if any((r or {}).get("verdict") == "block" for r in reports):
        verdict = "block"
    elif any((r or {}).get("verdict") == "warn" for r in reports):
        verdict = "warn"
    return _ok(task=task, verdict=verdict, reports=reports)


# ------------------------------- 店铺 / 店群 ------------------------------- #


def _shops_list(owner, query):
    where, params = [], []
    if query.get("platform"):
        where.append("platform=?")
        params.append(query["platform"])
    if query.get("group_id"):
        where.append("group_id=?")
        params.append(query["group_id"])
    items = store.list_rows("shops", owner, where=" AND ".join(where), params=tuple(params))
    return _ok(items=items, total=len(items))


def _shop_create(owner, body):
    shop = store.insert(
        "shops",
        owner,
        {
            "group_id": body.get("group_id") or "",
            "platform": body.get("platform") or "douyin",
            "name": body.get("name") or "",
            "shop_id": body.get("shop_id") or "",
            "auth_status": body.get("auth_status") or "unauthorized",
            "auth_json": body.get("auth") or {},
        },
    )
    return _ok(shop=shop)


def _shop_delete(owner, shop_id):
    removed = store.delete("shops", owner, shop_id)
    if not removed:
        return _err(404, "店铺不存在", "not_found")
    return _ok(removed=True)


def _shop_auth(owner, body):
    auth = body.get("auth") or {}
    if body.get("access_token"):
        auth = dict(auth, access_token=body["access_token"])
    status = "normal" if auth.get("access_token") else "unauthorized"
    shop = store.get("shops", owner, body.get("id") or "") if body.get("id") else None
    if not shop and body.get("shop_id"):
        rows = store.list_rows(
            "shops", owner, where="shop_id=?", params=(body["shop_id"],), limit=1
        )
        shop = rows[0] if rows else None
    if not shop:
        shop = store.insert(
            "shops",
            owner,
            {
                "group_id": body.get("group_id") or "",
                "platform": body.get("platform") or "douyin",
                "name": body.get("name") or "",
                "shop_id": body.get("shop_id") or "",
                "auth_status": status,
                "auth_json": auth,
            },
        )
        return _ok(shop=shop)
    shop = store.update("shops", owner, shop["id"], {"auth_status": status, "auth_json": auth})
    return _ok(shop=shop)


def _shop_groups_list(owner):
    items = store.list_rows("shop_groups", owner)
    return _ok(items=items, total=len(items))


def _shop_group_create(owner, body):
    group = store.insert(
        "shop_groups",
        owner,
        {"name": body.get("name") or "", "remark": body.get("remark") or ""},
    )
    return _ok(group=group)


# ------------------------------- 任务 ------------------------------- #


def _tasks_list(owner, query):
    page, size = _page(query)
    where, params = [], []
    if query.get("kind"):
        where.append("kind=?")
        params.append(query["kind"])
    if query.get("status"):
        where.append("status=?")
        params.append(query["status"])
    clause = " AND ".join(where)
    total = store.count("tasks", owner, clause, tuple(params))
    items = store.list_rows(
        "tasks",
        owner,
        where=clause,
        params=tuple(params),
        limit=size,
        offset=(page - 1) * size,
    )
    return _ok(items=items, total=total, page=page, page_size=size)


def _task_detail(owner, task_id):
    task = store.get("tasks", owner, task_id)
    if not task:
        return _err(404, "任务不存在", "not_found")
    items = store.list_rows(
        "task_items", owner, where="task_id=?", params=(task_id,), order="seq ASC"
    )
    return _ok(task=task, items=items)


def _task_retry(owner, task_id):
    task = queue.retry_failed(owner, task_id)
    return _ok(task=task)


def _task_pause(owner, task_id):
    task = queue.pause(owner, task_id)
    if not task:
        return _err(404, "任务不存在", "not_found")
    return _ok(task=task)


__all__ = ["handle"]
