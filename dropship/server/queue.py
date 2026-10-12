#!/usr/bin/python3
"""发布任务队列：串行消费 pending 任务，做限频与失败重试。

队列只负责调度与状态流转；具体上架由平台适配器完成，便于单测中注入 mock。
"""
import time
from collections import deque
from datetime import datetime, timezone

from .db import new_id, now_iso
from .models import validate_for_publish


class PublishQueue:
    def __init__(self, store, adapters, auth, max_retries=3, rate_per_min=30, clock=time.monotonic, sleep=time.sleep, app_creds=None):
        self.store = store
        self.adapters = adapters
        self.auth = auth
        self.max_retries = max_retries
        self.rate_per_min = rate_per_min
        self._clock = clock
        self._sleep = sleep
        self.app_creds = app_creds or {}
        self._hits = {}

    def _creds(self, platform):
        """店铺令牌（含自动刷新）+ 应用级凭据（appKey/appSecret）。"""
        token = self.auth.ensure_valid(platform, self.app_creds.get(platform))
        creds = dict(self.app_creds.get(platform) or {})
        if token:
            creds.update(token)
            creds.setdefault("accessToken", token.get("accessToken"))
        return creds

    def enqueue(self, product_id, platform):
        if platform not in self.adapters:
            raise ValueError("未知平台: %s" % platform)
        product = self.store.get_product(product_id)
        if not product:
            raise ValueError("商品不存在: %s" % product_id)
        ts = now_iso()
        task = {
            "id": new_id("t"),
            "productId": product_id,
            "platform": platform,
            "status": "pending",
            "attempts": 0,
            "createdAt": ts,
            "updatedAt": ts,
        }
        self.store.insert_task(task)
        return self.store.get_task(task["id"])

    def _respect_rate_limit(self, platform):
        if self.rate_per_min <= 0:
            return
        window = 60.0
        now = self._clock()
        dq = self._hits.setdefault(platform, deque())
        while dq and now - dq[0] > window:
            dq.popleft()
        if len(dq) >= self.rate_per_min:
            wait = window - (now - dq[0]) + 0.001
            if wait > 0:
                self._sleep(wait)
            now = self._clock()
            while dq and now - dq[0] > window:
                dq.popleft()
        dq.append(now)

    def worker_once(self):
        task = self.store.next_pending_task()
        if not task:
            return None
        self.store.update_task(task["id"], status="running")
        product = self.store.get_product(task["productId"])
        adapter = self.adapters[task["platform"]]
        if not product:
            return self.store.update_task(
                task["id"], status="failed", lastError="商品缺失", attempts=task["attempts"] + 1
            )
        mapping = (product.get("category") or {}).get("target") or {}
        errors = validate_for_publish(product, mapping)
        if errors:
            return self.store.update_task(
                task["id"],
                status="failed",
                lastError="; ".join(errors),
                attempts=task["attempts"] + 1,
            )
        creds = self._creds(task["platform"])
        self._respect_rate_limit(task["platform"])
        result = adapter.publish(product, mapping, creds)
        attempts = task["attempts"] + 1
        if result.ok:
            self.store.update_task(
                task["id"],
                status=result.status,
                attempts=attempts,
                platformItemId=result.platform_item_id,
                lastError=None,
            )
            self._record_publish(product, task["platform"], result)
        else:
            status = "pending" if attempts < self.max_retries else "failed"
            self.store.update_task(
                task["id"], status=status, attempts=attempts, lastError=result.error
            )
        return self.store.get_task(task["id"])

    def drain(self, limit=1000):
        done = 0
        while done < limit:
            t = self.worker_once()
            if not t:
                break
            if t["status"] == "pending":
                break
            done += 1
        return done

    def run_forever(self, stop_event=None, idle=1.0):
        while not (stop_event and stop_event.is_set()):
            task = self.worker_once()
            if not task or task["status"] == "pending":
                if stop_event and stop_event.wait(idle):
                    break
                if not stop_event:
                    self._sleep(idle)

    def _record_publish(self, product, platform, result):
        entry = {
            "platform": platform,
            "status": result.status,
            "platformItemId": result.platform_item_id,
            "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }
        records = [r for r in (product.get("publish") or []) if r.get("platform") != platform]
        records.append(entry)
        product["publish"] = records
        self.store.upsert_product(product)
