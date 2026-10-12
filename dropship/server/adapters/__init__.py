#!/usr/bin/python3
"""适配器注册表。自定义平台在此登记，发布队列按 name 查找。"""
from .base import PlatformAdapter, PublishResult  # noqa: F401
from .mock import MockAdapter
from .taobao import TaobaoAdapter


def build_adapters(dry_run=True):
    adapters = {
        "mock": MockAdapter(),
        "taobao": TaobaoAdapter(dry_run=dry_run),
    }
    return adapters


def register(adapters, adapter):
    adapters[adapter.name] = adapter
    return adapters
