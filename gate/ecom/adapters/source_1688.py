#!/usr/bin/python3
"""电商工作台 · 1688 源平台适配器（设计稿 4.1 / 4.6）。

采集 1688 商品详情、SKU、主图与详情，映射为统一 RawProduct。
真实链路走阿里巴巴开放平台（AOP），需要 appkey/secret/access_token；
资质到位前可注入 ``transport`` 做契约测试与真机联调。

环境变量（应用级凭证，非 LLM key）：

- ``ECOM_1688_APPKEY`` / ``ECOM_1688_APPSECRET``  应用凭证
- ``ECOM_1688_ACCESS_TOKEN``                        店铺/用户授权令牌
- ``ECOM_1688_BASE_URL``                            可选，默认 AOP 网关

注意：AOP 网关路径与签名规则以开放平台文档为准，凭证到位后用真机冒烟校准。
"""
import hashlib
import hmac
import json
import os
import urllib.parse
import urllib.request

from ecom.adapters.base import SourceAdapter
from ecom.registry import EcomError, AUTH_EXPIRED, UNKNOWN, normalize_error

DEFAULT_BASE_URL = "https://gw.open.1688.com/openapi/param2/1"
# 商品详情（可用时由开放平台分配的 api 名替代）
API_OFFER_GET = "com.alibaba.product/alibaba.product.get"
API_SHOP_LIST = "com.alibaba.product/alibaba.offer.list"


def aop_signature(params, secret):
    """AOP 网关签名：按参数名排序拼接 key+value，HMAC-SHA1 后大写十六进制。"""
    pieces = []
    for key in sorted(params):
        value = params[key]
        if value is None:
            continue
        pieces.append("%s%s" % (key, value))
    raw = "".join(pieces).encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), raw, hashlib.sha1).hexdigest()
    return digest.upper()


def extract_offer_id(url_or_id):
    """从商品链接或裸 id 中取出 1688 offerId。"""
    text = str(url_or_id or "").strip()
    if not text:
        raise EcomError("缺少 1688 商品 id 或链接", UNKNOWN)
    if text.isdigit():
        return text
    parsed = urllib.parse.urlparse(text if "://" in text else "https://" + text)
    query = urllib.parse.parse_qs(parsed.query)
    for key in ("offerId", "offerid", "id"):
        if query.get(key):
            return query[key][0]
    # 形如 /offer/123456.html
    for part in parsed.path.split("/"):
        name = part.split(".")[0]
        if name.isdigit():
            return name
    if text.isdigit():
        return text
    raise EcomError("无法从链接中解析 1688 offerId: %s" % text, UNKNOWN)


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
            raise EcomError("1688 返回非 JSON 响应", UNKNOWN, remote_code=body[:120])


class Source1688Adapter(SourceAdapter):
    platform = "1688"

    def __init__(
        self,
        appkey=None,
        secret=None,
        access_token=None,
        transport=None,
        base_url=None,
    ):
        self.appkey = appkey or os.environ.get("ECOM_1688_APPKEY", "")
        self.secret = secret or os.environ.get("ECOM_1688_APPSECRET", "")
        self.access_token = access_token or os.environ.get("ECOM_1688_ACCESS_TOKEN", "")
        self.transport = transport or HttpTransport()
        self.base_url = (base_url or os.environ.get("ECOM_1688_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")

    # ---- 统一契约 ----

    def fetch_product(self, url_or_id, ctx=None):
        offer_id = extract_offer_id(url_or_id)
        payload = self._call(
            API_OFFER_GET,
            {"offerId": offer_id, "webSite": "1688"},
            ctx,
        )
        offer = _pick_offer(payload)
        if not offer:
            raise EcomError("1688 未返回商品数据: %s" % offer_id, UNKNOWN)
        return map_offer(offer)

    def fetch_shop(self, shop_url, opts=None, ctx=None):
        opts = opts or {}
        page = int(opts.get("page") or 1)
        page_size = int(opts.get("page_size") or opts.get("limit") or 20)
        max_pages = int(opts.get("max_pages") or 50)
        member_id = opts.get("member_id") or _extract_member_id(shop_url)
        while page <= max_pages:
            payload = self._call(
                API_SHOP_LIST,
                {
                    "memberId": member_id,
                    "pageNo": page,
                    "pageSize": page_size,
                    "webSite": "1688",
                },
                ctx,
            )
            offers = _pick_offer_list(payload)
            if not offers:
                break
            for offer in offers:
                yield map_offer(offer)
            if len(offers) < page_size:
                break
            page += 1

    # ---- 请求与签名 ----

    def _call(self, api, params, ctx=None):
        if not self.appkey or not self.secret:
            raise EcomError("1688 应用凭证未配置（ECOM_1688_APPKEY/APPSECRET）", AUTH_EXPIRED)
        token = self.access_token or _ctx_token(ctx)
        if not token:
            raise EcomError("1688 授权令牌缺失，请先完成店铺授权", AUTH_EXPIRED)
        query = {
            "_aop_signature": None,
            "access_token": token,
        }
        query.update({k: v for k, v in (params or {}).items() if v is not None})
        query["_aop_signature"] = aop_signature(query, self.secret)
        url = "%s/%s/%s" % (self.base_url, api, self.appkey)
        try:
            payload = self.transport.post(url, query)
        except Exception as exc:  # noqa: BLE001
            raise normalize_error(exc)
        return _unwrap(payload)


def _ctx_token(ctx):
    return ((ctx or {}).get("auth") or {}).get("access_token", "")


def _unwrap(payload):
    """剥离 AOP 返回的错误包裹，业务错误归一化。"""
    if not isinstance(payload, dict):
        raise EcomError("1688 返回结构非法", UNKNOWN)
    error = payload.get("error_response") or payload.get("errorResponse")
    if error:
        code = str(error.get("code") or error.get("errorCode") or "")
        message = error.get("msg") or error.get("message") or "1688 接口错误"
        raise normalize_error(RuntimeError("%s (%s)" % (message, code)))
    return payload


def _pick_offer(payload):
    if not isinstance(payload, dict):
        return None
    for key in ("offer", "productInfo", "result", "data"):
        value = payload.get(key)
        if isinstance(value, dict):
            nested = _pick_offer(value)
            return nested or value
    return None


def _pick_offer_list(payload):
    if not isinstance(payload, dict):
        return []
    for key in ("offerList", "offers", "products", "result", "data", "list"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = _pick_offer_list(value)
            if nested:
                return nested
    return []


def _extract_member_id(shop_url):
    text = str(shop_url or "")
    parsed = urllib.parse.urlparse(text if "://" in text else "https://" + text)
    query = urllib.parse.parse_qs(parsed.query)
    for key in ("memberId", "memberid", "sellerId"):
        if query.get(key):
            return query[key][0]
    host = parsed.netloc
    if host.startswith("shop") and host.endswith(".1688.com"):
        return host[4:].split(".")[0]
    raise EcomError("无法解析 1688 店铺 memberId: %s" % text, UNKNOWN)


def map_offer(offer):
    """把 1688 商品结构映射为统一 RawProduct。"""
    offer_id = str(_first(offer, "offerId", "offer_id", "productId", "id") or "")
    images = _images(offer)
    price, stock, skus = _skus(offer)
    return {
        "source_id": offer_id,
        "source_url": _first(offer, "detailUrl", "offerUrl", "url")
        or ("https://detail.1688.com/offer/%s.html" % offer_id),
        "title": _first(offer, "subject", "title", "name") or "",
        "subtitle": _first(offer, "subTitle", "subtitle") or "",
        "category": _category(offer),
        "price": price,
        "stock": stock,
        "main_image": images[0] if images else "",
        "images": images,
        "detail": {"html": _first(offer, "detail", "description", "detailHtml") or ""},
        "skus": skus,
        "attrs": _attrs(offer),
    }


def _first(source, *keys):
    for key in keys:
        if isinstance(source, dict) and source.get(key) not in (None, ""):
            return source[key]
    return None


def _images(offer):
    images = []
    raw = _first(offer, "image", "images", "mainImages")
    if isinstance(raw, str):
        images = [p.strip() for p in raw.split(";") if p.strip()]
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                images.append(item)
            elif isinstance(item, dict):
                url = _first(item, "fullPathImageURI", "url", "imageURI")
                if url:
                    images.append(url)
    single = _first(offer, "mainImage", "imageUrl")
    if single and single not in images:
        images.insert(0, single)
    return images


def _skus(offer):
    raw = _first(offer, "skuInfos", "skus", "skuList") or []
    skus = []
    prices = []
    stock = 0
    for index, item in enumerate(raw, start=1):
        price = float(_first(item, "price", "discountPrice", "consignPrice") or 0)
        qty = int(_first(item, "amount", "stock", "canBookCount") or 0)
        prices.append(price)
        stock += qty
        attrs = _first(item, "attributes", "specAttrs", "skuAttributes") or {}
        skus.append(
            {
                "source_sku_id": str(_first(item, "skuId", "specId", "id") or index),
                "spec": _spec_text(attrs),
                "price": price,
                "stock": qty,
                "barcode": str(_first(item, "cargoNumber", "barcode") or ""),
                "image": _first(item, "skuImage", "image", "imageUrl") or "",
                "enabled": 1,
            }
        )
    if not skus:
        price_range = _first(offer, "priceRange", "saleInfo")
        price = float(_first(offer, "price", "consignPrice") or 0)
        if not price and isinstance(price_range, dict):
            price = float(_first(price_range, "price", "minPrice") or 0)
        stock = int(_first(offer, "amount", "stock", "saleQuantity") or 0)
        prices = [price]
    main_price = min(prices) if prices else 0.0
    return main_price, stock, skus


def _spec_text(attrs):
    if isinstance(attrs, dict):
        return " ".join("%s:%s" % (k, v) for k, v in attrs.items())
    if isinstance(attrs, list):
        return " ".join(str(_first(a, "attributeName", "name") or "") + ":" + str(_first(a, "attributeValue", "value") or "") for a in attrs)
    return ""


def _category(offer):
    category = _first(offer, "categoryName", "category")
    if isinstance(category, dict):
        return str(_first(category, "name", "categoryName") or "")
    return str(category or "")


def _attrs(offer):
    attrs = _first(offer, "attributes", "productAttributes", "attrs")
    if isinstance(attrs, dict):
        return attrs
    result = {}
    if isinstance(attrs, list):
        for item in attrs:
            name = _first(item, "attributeName", "name")
            value = _first(item, "attributeValue", "value")
            if name:
                result[str(name)] = value
    return result
