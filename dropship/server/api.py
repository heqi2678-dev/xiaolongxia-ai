#!/usr/bin/python3
"""铺货后端 HTTP 路由处理。

handle() 是纯分发函数：入参 (ctx, method, path, query, body, headers)，
出参 (status, payload)。不依赖具体 HTTP 框架，便于单测直接调用。
"""
import json
import re

from .models import normalize_product, validate_for_publish

ROUTES = [
    ("GET", re.compile(r"^/health$"), "health"),
    ("POST", re.compile(r"^/api/collect$"), "collect"),
    ("GET", re.compile(r"^/api/products$"), "list_products"),
    ("GET", re.compile(r"^/api/products/(?P<id>[^/]+)$"), "get_product"),
    ("PUT", re.compile(r"^/api/products/(?P<id>[^/]+)$"), "update_product"),
    ("DELETE", re.compile(r"^/api/products/(?P<id>[^/]+)$"), "delete_product"),
    ("POST", re.compile(r"^/api/products/(?P<id>[^/]+)/publish$"), "publish_one"),
    ("POST", re.compile(r"^/api/publish$"), "publish_batch"),
    ("GET", re.compile(r"^/api/tasks$"), "list_tasks"),
    ("GET", re.compile(r"^/api/tasks/(?P<id>[^/]+)$"), "get_task"),
    ("POST", re.compile(r"^/api/tasks/(?P<id>[^/]+)/retry$"), "retry_task"),
    ("POST", re.compile(r"^/api/images/localize$"), "localize_images"),
    ("GET", re.compile(r"^/api/images/(?P<name>[^/]+)$"), "image_file"),
    ("GET", re.compile(r"^/api/adapters/(?P<platform>[^/]+)/categories$"), "adapter_categories"),
    ("GET", re.compile(r"^/api/adapters/(?P<platform>[^/]+)/attributes$"), "adapter_attributes"),
    ("GET", re.compile(r"^/api/platforms$"), "platforms"),
    ("GET", re.compile(r"^/api/auth/(?P<platform>[^/]+)/authorize$"), "authorize"),
    ("GET", re.compile(r"^/api/auth/(?P<platform>[^/]+)/callback$"), "callback"),
    ("POST", re.compile(r"^/api/auth/(?P<platform>[^/]+)/revoke$"), "revoke"),
]

PUBLIC_PATHS = {"/health"}
PUBLIC_RE = [re.compile(r"^/api/auth/[^/]+/callback$")]


def _err(status, message):
    return status, {"error": message}


def _app_creds(ctx, platform):
    """应用级凭据（appKey/appSecret），从配置读取。"""
    return dict((ctx.cfg.get("app_creds") or {}).get(platform) or {})


def _oauth_redirect(ctx):
    return ctx.cfg.get("oauth_redirect") or ""


def _check_auth(ctx, path, headers):
    token = ctx.cfg.get("ext_token") or ""
    if not token or path in PUBLIC_PATHS:
        return True
    if any(r.match(path) for r in PUBLIC_RE):
        return True
    header = ""
    for k, v in (headers or {}).items():
        if k.lower() == "authorization":
            header = v
            break
    return header == "Bearer " + token


def handle(ctx, method, path, query, body, headers=None):
    if not _check_auth(ctx, path, headers):
        return _err(401, "未授权")
    for m, pattern, name in ROUTES:
        if m != method:
            continue
        match = pattern.match(path)
        if not match:
            continue
        fn = globals()["_h_" + name]
        return fn(ctx, query or {}, body or {}, match.groupdict())
    return _err(404, "未找到: %s" % path)


def _h_health(ctx, query, body, params):
    return 200, {"ok": True, "adapters": list(ctx.adapters), "pending": ctx.store.count_pending()}


def _h_collect(ctx, query, body, params):
    try:
        product = normalize_product(body)
    except ValueError as exc:
        return _err(400, str(exc))
    saved = ctx.store.upsert_product(product)
    return 200, {"product": saved}


def _h_list_products(ctx, query, body, params):
    limit = int(query.get("limit", 100))
    offset = int(query.get("offset", 0))
    q = query.get("q") or None
    source = query.get("source") or None
    return 200, {
        "products": ctx.store.list_products(limit=limit, offset=offset, q=q, source=source),
        "total": ctx.store.count_products(q=q, source=source),
    }


def _h_get_product(ctx, query, body, params):
    product = ctx.store.get_product(params["id"])
    if not product:
        return _err(404, "商品不存在")
    return 200, {"product": product}


def _h_update_product(ctx, query, body, params):
    product = ctx.store.get_product(params["id"])
    if not product:
        return _err(404, "商品不存在")
    merge_keys = ("images", "attributes", "category", "pricing")
    for key in ("title", "description", "sellingPoints", "images", "skus", "attributes", "category", "pricing"):
        if key not in body:
            continue
        value = body[key]
        # 嵌套对象做浅合并，避免只改一个子字段就清空其它字段（如改售价清掉成本/运费）
        if key in merge_keys and isinstance(value, dict) and isinstance(product.get(key), dict):
            merged = dict(product[key])
            merged.update(value)
            product[key] = merged
        else:
            product[key] = value
    saved = ctx.store.upsert_product(normalize_product(product))
    return 200, {"product": saved}


def _h_delete_product(ctx, query, body, params):
    ok = ctx.store.delete_product(params["id"])
    if not ok:
        return _err(404, "商品不存在")
    return 200, {"ok": True}


def _h_publish_one(ctx, query, body, params):
    platform = body.get("platform")
    if not platform:
        return _err(400, "缺少 platform")
    return _enqueue(ctx, [params["id"]], platform)


def _h_publish_batch(ctx, query, body, params):
    platform = body.get("platform")
    ids = body.get("productIds") or []
    if not platform:
        return _err(400, "缺少 platform")
    if not ids:
        return _err(400, "缺少 productIds")
    return _enqueue(ctx, ids, platform)


def _enqueue(ctx, ids, platform):
    tasks = []
    errors = []
    for pid in ids:
        try:
            tasks.append(ctx.queue.enqueue(pid, platform))
        except ValueError as exc:
            errors.append({"productId": pid, "error": str(exc)})
    return 200, {"tasks": tasks, "errors": errors}


def _h_list_tasks(ctx, query, body, params):
    status = query.get("status")
    return 200, {"tasks": ctx.store.list_tasks(status=status)}


def _h_get_task(ctx, query, body, params):
    task = ctx.store.get_task(params["id"])
    if not task:
        return _err(404, "任务不存在")
    return 200, {"task": task}


def _h_retry_task(ctx, query, body, params):
    task = ctx.store.requeue_task(params["id"])
    if not task:
        return _err(404, "任务不存在")
    return 200, {"task": task}


def _h_localize_images(ctx, query, body, params):
    pid = body.get("productId")
    product = ctx.store.get_product(pid)
    if not product:
        return _err(404, "商品不存在")
    changed = ctx.images.localize_product(product)
    if changed:
        ctx.store.upsert_product(product)
    return 200, {"ok": True, "changed": changed, "product": product}


def _h_image_file(ctx, query, body, params):
    data = ctx.images.read(params["name"])
    if data is None:
        return _err(404, "图片不存在")
    ext = params["name"].rsplit(".", 1)[-1].lower()
    ctype = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
             "webp": "image/webp", "gif": "image/gif"}.get(ext, "application/octet-stream")
    return 200, {"__bytes__": data, "contentType": ctype}


def _h_adapter_categories(ctx, query, body, params):
    adapter = ctx.adapters.get(params["platform"])
    if not adapter:
        return _err(404, "未知平台")
    creds = ctx.auth.ensure_valid(params["platform"], _app_creds(ctx, params["platform"])) or {}
    parent = int(query.get("parent", 0))
    return 200, {"categories": adapter.query_categories(creds=creds, parent_cid=parent)}


def _h_adapter_attributes(ctx, query, body, params):
    adapter = ctx.adapters.get(params["platform"])
    if not adapter:
        return _err(404, "未知平台")
    creds = ctx.auth.ensure_valid(params["platform"], _app_creds(ctx, params["platform"])) or {}
    return 200, {"attributes": adapter.query_attributes(creds=creds, cid=query.get("cid"))}


def _h_platforms(ctx, query, body, params):
    out = []
    for name, adapter in ctx.adapters.items():
        info = adapter.info()
        info["authorized"] = ctx.auth.is_authorized(name)
        out.append(info)
    return 200, {"platforms": out}


def _h_authorize(ctx, query, body, params):
    platform = params["platform"]
    if platform not in ctx.adapters:
        return _err(404, "未知平台")
    redirect = query.get("redirect") or _oauth_redirect(ctx)
    state = query.get("state") or "xlx"
    url = ctx.auth.authorize_url(platform, redirect, state, _app_creds(ctx, platform))
    return 200, {"authorizeUrl": url, "platform": platform}


def _h_callback(ctx, query, body, params):
    platform = params["platform"]
    code = query.get("code") or (body or {}).get("code")
    if not code:
        return _err(400, "缺少 code")
    redirect_uri = query.get("redirect_uri") or _oauth_redirect(ctx)
    token = ctx.auth.exchange_code(platform, code, redirect_uri, _app_creds(ctx, platform))
    return 200, {"ok": True, "platform": platform, "authorized": ctx.auth.is_authorized(platform)}


def _h_revoke(ctx, query, body, params):
    ok = ctx.auth.revoke(params["platform"])
    return 200, {"ok": ok}


def validate_product_for(ctx, pid, platform):
    product = ctx.store.get_product(pid)
    if not product:
        return ["商品不存在"]
    mapping = (product.get("category") or {}).get("target") or {}
    return validate_for_publish(product, mapping)
