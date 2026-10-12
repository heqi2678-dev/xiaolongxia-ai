#!/usr/bin/python3
"""平台适配器抽象。

每个平台把「统一商品模型 + 类目映射」翻译成平台字段，再调用官方 API 上架。
新增自定义平台时继承 PlatformAdapter 并注册即可，无需改动发布队列。
"""
from abc import ABC, abstractmethod


class PublishResult:
    def __init__(self, ok, status, platform_item_id=None, error=None, raw=None):
        self.ok = ok
        self.status = status
        self.platform_item_id = platform_item_id
        self.error = error
        self.raw = raw or {}

    def as_dict(self):
        return {
            "ok": self.ok,
            "status": self.status,
            "platformItemId": self.platform_item_id,
            "error": self.error,
        }


class PlatformAdapter(ABC):
    #: 平台标识，与授权令牌 store 的 key 一致
    name = "base"
    label = "通用"
    #: 需要用户手动完成、无法自动化的环节提示
    requires_manual_review = False

    @abstractmethod
    def map_fields(self, product, mapping=None):
        """统一模型 → 平台字段。"""

    @abstractmethod
    def publish(self, product, mapping, creds):
        """带店铺授权调用官方 API 上架。返回 PublishResult。"""

    def category_schema(self):
        """平台类目树/属性定义，供前端映射面板使用。"""
        return {"categories": [], "requiredAttributes": []}

    def query_categories(self, creds=None, parent_cid=0):
        return []

    def query_attributes(self, creds=None, cid=None):
        return []

    def info(self):
        return {
            "id": self.name,
            "label": self.label,
            "requiresManualReview": self.requires_manual_review,
        }
