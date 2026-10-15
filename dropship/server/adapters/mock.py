#!/usr/bin/python3
"""Mock 适配器：不联网，用于本地开发、联调与单元测试。"""
import uuid

from .base import PlatformAdapter, PublishResult
from ..models import selling_price


class MockAdapter(PlatformAdapter):
    name = "mock"
    label = "本地模拟"

    def map_fields(self, product, mapping=None):
        return {
            "outer_id": product["source"]["itemId"],
            "title": product.get("title"),
            "num": sum(s.get("stock", 0) for s in product.get("skus", [])),
            "price": selling_price(product),
            "images": [i["url"] for i in product["images"]["main"]],
        }

    def publish(self, product, mapping, creds):
        return PublishResult(
            ok=True,
            status="success",
            platform_item_id="MOCK-%s" % uuid.uuid4().hex[:8],
        )
