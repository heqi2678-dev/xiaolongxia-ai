#!/usr/bin/python3
"""电商工作台 · 适配器注册表、错误归一化与按平台限流。

对齐设计稿 4.3 / 4.5 / 4.6：

- 源/目标适配器按平台 key 注册，应用层只依赖契约、不依赖实现（新增平台零改应用层）。
- 错误归一化：把平台错误码/文案映射为可读类别，并标注是否可自动重试
  （网络类可退避重试，业务类不自动重试）。
- 按平台限流：QPS（最小间隔）与日调用配额。

统一契约（4.6，实现见 ``ecom.adapters``）：

源平台适配器::

    fetch_product(url_or_id, ctx) -> RawProduct
    fetch_shop(shop_url, opts, ctx) -> Iterable[RawProduct]

目标平台适配器::

    fetch_category_tree(ctx) -> list[CategoryNode]
    match_category(product) -> {"category_id": str, "confidence": float}
    map_fields(product, category_id) -> {"data": dict, "missing": list}
    publish(data, shop_auth) -> {"remote_id": str}
    update_price(remote_id, price, shop_auth) -> None
    set_listing(remote_id, on, shop_auth) -> None
    list_listings(shop_auth, cursor=None) -> {"items": list, "cursor": str|None}
"""
import threading
import time

# 归一化错误类别（设计稿 4.5 列举的可读类别）
CATEGORY_RIGHTS = "category_rights"  # 类目资质缺失
FORBIDDEN_WORD = "forbidden_word"  # 违禁词
IMAGE_SIZE = "image_size"  # 图片尺寸不符
SKU_INCOMPLETE = "sku_incomplete"  # SKU 不完整
RATE_LIMITED = "rate_limited"  # 限流
AUTH_EXPIRED = "auth_expired"  # 授权失效
NETWORK = "network"  # 网络错误
UNKNOWN = "unknown"  # 未归类（业务类，不自动重试）

# 可自动重试的类别（4.3 第 18/19 条）
RETRYABLE = frozenset({NETWORK, RATE_LIMITED})

ERROR_LABELS = {
    CATEGORY_RIGHTS: "类目资质缺失",
    FORBIDDEN_WORD: "违禁词",
    IMAGE_SIZE: "图片尺寸不符",
    SKU_INCOMPLETE: "SKU 不完整",
    RATE_LIMITED: "触发限流",
    AUTH_EXPIRED: "授权失效",
    NETWORK: "网络异常",
    UNKNOWN: "未知错误",
}

# 关键词 -> 类别。命中即归类，顺序即优先级。
_CODE_MAP = (
    (("category", "qualification", "资质", "类目"), CATEGORY_RIGHTS),
    (("forbidden", "sensitive", "违禁", "违规词", "敏感词"), FORBIDDEN_WORD),
    (("image", "resolution", "尺寸", "分辨率"), IMAGE_SIZE),
    (("sku", "库存", "规格"), SKU_INCOMPLETE),
    (("rate", "limit", "429", "qps", "too many", "限流"), RATE_LIMITED),
    (("auth", "token", "401", "403", "授权", "登录"), AUTH_EXPIRED),
    (("timeout", "network", "connection", "refused", "502", "503", "504", "网络"), NETWORK),
)


class EcomError(Exception):
    """适配器统一异常：带归一化类别与是否可重试，便于队列按类型退避重试。"""

    def __init__(self, message, code=UNKNOWN, retryable=None, remote_code=""):
        super().__init__(message)
        self.code = code
        self.remote_code = remote_code
        self.retryable = (code in RETRYABLE) if retryable is None else bool(retryable)

    def as_dict(self):
        return {
            "code": self.code,
            "label": ERROR_LABELS.get(self.code, self.code),
            "message": str(self),
            "retryable": self.retryable,
            "remote_code": self.remote_code,
        }


def normalize_error(exc):
    """把任意异常归一化为 :class:`EcomError`。"""
    if isinstance(exc, EcomError):
        return exc
    remote = getattr(exc, "remote_code", "") or getattr(exc, "code", "")
    text = ("%s" % exc).lower()
    for keys, category in _CODE_MAP:
        if any(k in text for k in keys):
            return EcomError(str(exc), category, remote_code=str(remote))
    return EcomError(str(exc), UNKNOWN, remote_code=str(remote))


def is_retryable(exc):
    return normalize_error(exc).retryable


class RateLimiter:
    """按平台的 QPS + 日配额限流器（进程内计数，时钟可注入便于测试）。"""

    def __init__(self, qps=0, daily_limit=0, clock=time.time):
        self.qps = float(qps or 0)
        self.daily_limit = int(daily_limit or 0)
        self._clock = clock
        self._last = 0.0
        self._day = None
        self._count = 0
        self._lock = threading.Lock()

    def _min_interval(self):
        return 1.0 / self.qps if self.qps > 0 else 0.0

    def _reset_if_new_day(self, now):
        day = int(now // 86400)
        if day != self._day:
            self._day = day
            self._count = 0

    def acquire(self):
        """只判断能否发起一次调用，不计数。返回 (是否放行, 原因)。"""
        now = self._clock()
        with self._lock:
            self._reset_if_new_day(now)
            if self.daily_limit and self._count >= self.daily_limit:
                return False, "已达当日调用配额"
            interval = self._min_interval()
            if interval and self._last and now - self._last < interval:
                return False, "调用过于频繁（QPS 限流）"
            return True, ""

    def spend(self):
        """计数一次调用；被限流时抛 :class:`EcomError`。"""
        ok, reason = self.acquire()
        if not ok:
            raise EcomError(reason, RATE_LIMITED)
        now = self._clock()
        with self._lock:
            self._reset_if_new_day(now)
            self._last = now
            self._count += 1
        return True

    def snapshot(self):
        with self._lock:
            return {"qps": self.qps, "daily_limit": self.daily_limit, "used": self._count}


class Registry:
    """适配器注册表。适配器以实例或工厂可注入方式登记，便于用 mock 做契约测试。"""

    def __init__(self):
        self._sources = {}
        self._targets = {}
        self._limiters = {}
        self._lock = threading.Lock()

    # ---- 注册与获取 ----

    def register_source(self, platform, adapter):
        _check_platform(platform)
        with self._lock:
            self._sources[platform] = adapter
        return adapter

    def register_target(self, platform, adapter):
        _check_platform(platform)
        with self._lock:
            self._targets[platform] = adapter
        return adapter

    def source(self, platform):
        try:
            return self._sources[platform]
        except KeyError:
            raise EcomError("未注册的源平台: %s" % platform, UNKNOWN)

    def target(self, platform):
        try:
            return self._targets[platform]
        except KeyError:
            raise EcomError("未注册的目标平台: %s" % platform, UNKNOWN)

    def sources(self):
        return sorted(self._sources)

    def targets(self):
        return sorted(self._targets)

    def unregister(self, platform):
        with self._lock:
            self._sources.pop(platform, None)
            self._targets.pop(platform, None)

    # ---- 限流 ----

    def set_limiter(self, platform, limiter):
        with self._lock:
            self._limiters[platform] = limiter
        return limiter

    def limiter(self, platform):
        with self._lock:
            if platform not in self._limiters:
                self._limiters[platform] = RateLimiter()
            return self._limiters[platform]


def _check_platform(platform):
    if not platform or not isinstance(platform, str):
        raise ValueError("平台 key 必须为非空字符串")


# 进程级默认注册表；应用层通过 ``registry.source(...)`` / ``registry.target(...)`` 取用。
REGISTRY = Registry()


def register_source(platform, adapter):
    return REGISTRY.register_source(platform, adapter)


def register_target(platform, adapter):
    return REGISTRY.register_target(platform, adapter)


def source(platform):
    return REGISTRY.source(platform)


def target(platform):
    return REGISTRY.target(platform)


def reset():
    """清空默认注册表（测试用）。"""
    global REGISTRY
    REGISTRY = Registry()
    return REGISTRY
