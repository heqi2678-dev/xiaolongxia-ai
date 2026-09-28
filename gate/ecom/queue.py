#!/usr/bin/python3
"""电商工作台 · 任务队列与调度器。

状态机（对齐设计稿 7.1）：

- ``scheduled``  定时任务待触发（schedule.mode = at/recurring，或 params.run_after 在未来）
- ``queued``     已入队，等待 Worker 领取
- ``running``    执行中
- ``paused``     人工暂停
- ``succeeded``  全部成功
- ``partial``    部分成功（存在失败项，可重试）
- ``failed``     整体失败
- ``canceled``   人工取消（终端态，设计稿 7.6 支持取消的补充）

设计：
- 每个任务挂若干 ``task_items``，逐条执行；处理器按 ``kind`` 注册，单条返回结果字典或抛异常。
- 后台 Worker 轮询到期任务并原子领取（CAS），逐条推进。
- 定时：``params.schedule.at`` / ``params.schedule.window`` / ``params.run_after``。
- 分时：``publish`` 类任务受 ``pacing`` 表约束（每日上限 / 最小间隔 / 允许时段）。
- 重试：仅重置失败项（7.3 / 7.5），已成功项不重复执行。

handler 约定：``handler(task, item) -> dict``；``item`` 可能为 ``None``（无子项的任务级执行）。
"""
import threading
import time
from datetime import datetime

from ecom import store

_HANDLERS = {}
_workers = []
_stop = threading.Event()
POLL_SEC = 1.0

ACTIVE_STATES = ("scheduled", "queued", "running", "paused")
TERMINAL_STATES = ("succeeded", "partial", "failed", "canceled")


def register(kind, handler):
    """注册某类任务的处理函数。"""
    _HANDLERS[kind] = handler


def has_handler(kind):
    return kind in _HANDLERS


def _decode_task(row):
    return store._dec_row(store.SCHEMA["tasks"], row)


def _schedule(task):
    return (task.get("params_json") or {}).get("schedule") or {}


def _initial_status(params, now):
    """有未来执行时间或按计划执行的任务先落 scheduled，否则直接 queued。"""
    params = params or {}
    sch = params.get("schedule") or {}
    at = sch.get("at")
    run_after = params.get("run_after")
    if sch.get("mode") == "recurring":
        return "scheduled"
    if (at and at > now) or (run_after and run_after > now):
        return "scheduled"
    return "queued"


def create_task(owner, kind, title="", items=None, params=None):
    """落库一个待执行任务及其子项，返回任务字典。"""
    store.ensure()
    items = list(items or [])
    now = time.time()
    task = store.insert(
        "tasks",
        owner,
        {
            "kind": kind,
            "title": title,
            "status": _initial_status(params, now),
            "total": len(items),
            "params_json": params or {},
        },
    )
    for seq, item in enumerate(items):
        payload = dict(item or {})
        store.insert(
            "task_items",
            owner,
            {
                "task_id": task["id"],
                "seq": seq,
                "ref_type": payload.pop("ref_type", ""),
                "ref_id": payload.pop("ref_id", ""),
                "payload_json": payload,
            },
        )
    return store.get("tasks", owner, task["id"])


def claim(owner, task_id):
    """把 queued 任务原子置为 running；已被他人领取返回 False。"""
    with store.db() as conn:
        cur = conn.execute(
            "UPDATE tasks SET status='running', started_at=? "
            "WHERE id=? AND owner=? AND status='queued'",
            (time.time(), task_id, owner),
        )
        return cur.rowcount > 0


def cancel(owner, task_id):
    return store.update(
        "tasks", owner, task_id, {"status": "canceled", "finished_at": time.time()}
    )


def pause(owner, task_id):
    return store.update("tasks", owner, task_id, {"status": "paused"})


def resume(owner, task_id):
    task = store.get("tasks", owner, task_id)
    if not task or task["status"] != "paused":
        return task
    status = _initial_status(task.get("params_json"), time.time())
    return store.update("tasks", owner, task_id, {"status": status})


def retry_failed(owner, task_id):
    """仅把失败项重置为 pending 重新入队，已成功项不重复执行（7.3 / 7.5）。"""
    task = store.get("tasks", owner, task_id)
    if not task:
        raise KeyError("任务不存在: %s" % task_id)
    items = store.list_rows("task_items", owner, where="task_id=?", params=(task_id,))
    failed = [it for it in items if it["status"] == "failed"]
    if not failed:
        return task
    for item in failed:
        store.update(
            "task_items", owner, item["id"], {"status": "pending", "error": ""}
        )
    done = len([it for it in items if it["status"] == "done"])
    total = len(items)
    store.update(
        "tasks",
        owner,
        task_id,
        {
            "status": _initial_status(task.get("params_json"), time.time()),
            "done": done,
            "failed": 0,
            "progress": int(round(done * 100.0 / total)) if total else 0,
            "error": "",
            "finished_at": None,
        },
    )
    return store.get("tasks", owner, task_id)


def _bump(owner, task_id, done, failed, total):
    progress = int(round((done + failed) * 100.0 / total)) if total else 0
    store.update(
        "tasks", owner, task_id, {"done": done, "failed": failed, "progress": progress}
    )


def _finish(owner, task_id, done, failed, error=""):
    if failed == 0:
        status = "succeeded"
    elif done > 0:
        status = "partial"
    else:
        status = "failed"
    data = {"status": status, "finished_at": time.time()}
    if status == "succeeded":
        data["progress"] = 100
    if error:
        data["error"] = error
    store.update("tasks", owner, task_id, data)


def run_task(owner, task_id):
    """同步执行一个任务；仅在 queued/running 状态下推进。"""
    store.ensure()
    task = store.get("tasks", owner, task_id)
    if not task:
        raise KeyError("任务不存在: %s" % task_id)
    if task["status"] == "queued" and not claim(owner, task_id):
        return store.get("tasks", owner, task_id)
    task = store.get("tasks", owner, task_id)
    if task["status"] != "running":
        return task

    handler = _HANDLERS.get(task["kind"])
    if handler is None:
        _finish(owner, task_id, 0, 1, "没有注册处理器的任务类型: %s" % task["kind"])
        return store.get("tasks", owner, task_id)

    items = store.list_rows(
        "task_items", owner, where="task_id=?", params=(task_id,), order="seq ASC"
    )
    done = len([it for it in items if it["status"] == "done"])
    failed = 0
    if not items:
        error = ""
        try:
            handler(task, None)
            done = 1
        except Exception as exc:  # noqa: BLE001 - 统一收敛为任务失败
            failed = 1
            error = str(exc)
        _bump(owner, task_id, done, failed, 1)
        _finish(owner, task_id, done, failed, error)
        return store.get("tasks", owner, task_id)

    for item in items:
        if item["status"] == "done":
            continue  # 重试/续跑时跳过已成功项（7.3 不重复已成功项）
        current = store.get("tasks", owner, task_id)
        if current["status"] in ("canceled", "paused"):
            return current
        try:
            result = handler(task, item) or {}
            store.update(
                "task_items",
                owner,
                item["id"],
                {"status": "done", "result_json": result, "attempt": (item["attempt"] or 0) + 1},
            )
            done += 1
        except Exception as exc:  # noqa: BLE001
            store.update(
                "task_items",
                owner,
                item["id"],
                {"status": "failed", "error": str(exc), "attempt": (item["attempt"] or 0) + 1},
            )
            failed += 1
        _bump(owner, task_id, done, failed, len(items))

    _finish(owner, task_id, done, failed)
    return store.get("tasks", owner, task_id)


# ------------------------------- 调度 ------------------------------- #


def _hour_in_window(windows, hour):
    return any(len(w) == 2 and int(w[0]) <= hour < int(w[1]) for w in windows)


def _schedule_due(task, now=None):
    """定时任务是否到点。"""
    now = now or time.time()
    params = task.get("params_json") or {}
    sch = params.get("schedule") or {}
    at = sch.get("at")
    if at and now < at:
        return False
    run_after = params.get("run_after")
    if run_after and now < run_after:
        return False
    window = sch.get("window")
    if window and len(window) == 2:
        hour = datetime.fromtimestamp(now).hour
        if not (int(window[0]) <= hour < int(window[1])):
            return False
    return True


def _day_start(ts):
    dt = datetime.fromtimestamp(ts)
    return datetime(dt.year, dt.month, dt.day).timestamp()


def pacing_allows(owner, kind, now=None):
    """分时闸门：publish 类任务受 pacing 表约束，返回 (是否放行, 原因)。"""
    if kind != "publish":
        return True, ""
    now = now or time.time()
    for row in store.list_rows("pacing", owner, where="enabled=1"):
        limit = int(row.get("daily_limit") or 0)
        if limit:
            with store.db() as conn:
                n = conn.execute(
                    "SELECT COUNT(*) AS n FROM tasks WHERE owner=? AND kind='publish' "
                    "AND created_at>=? AND status IN ('running','succeeded','partial')",
                    (owner, _day_start(now)),
                ).fetchone()["n"]
            if n >= limit:
                return False, "已达当日铺货上限"
        interval = int(row.get("interval_sec") or 0)
        if interval:
            with store.db() as conn:
                last = conn.execute(
                    "SELECT MAX(finished_at) AS m FROM tasks WHERE owner=? AND kind='publish' "
                    "AND status IN ('running','succeeded','partial')",
                    (owner,),
                ).fetchone()["m"]
            if last and now - last < interval:
                return False, "距上次铺货不足最小间隔"
        windows = row.get("windows_json") or []
        if windows:
            hour = datetime.fromtimestamp(now).hour
            if not _hour_in_window(windows, hour):
                return False, "当前不在允许时段"
    return True, ""


def next_due_task(now=None):
    """取一个到点且放行的任务；到点的 scheduled 会先转 queued（供后台 Worker 用）。"""
    now = now or time.time()
    store.ensure()
    with store.db() as conn:
        rows = conn.execute(
            "SELECT * FROM tasks WHERE status IN ('queued','scheduled') "
            "ORDER BY created_at ASC LIMIT 50"
        ).fetchall()
    for row in rows:
        task = _decode_task(row)
        if task["status"] == "scheduled":
            if not _schedule_due(task, now):
                continue
            store.update("tasks", task["owner"], task["id"], {"status": "queued"})
            task["status"] = "queued"
        ok, _reason = pacing_allows(task["owner"], task["kind"], now)
        if ok:
            return task
    return None


def tick():
    """执行一个到点任务；没有则返回 None。同步入口，测试与 Worker 共用。"""
    task = next_due_task()
    if not task:
        return None
    return run_task(task["owner"], task["id"])


def _loop():
    while not _stop.is_set():
        try:
            if tick() is not None:
                continue
        except Exception:  # noqa: BLE001 - Worker 不应因单任务异常退出
            pass
        _stop.wait(POLL_SEC)


def start(workers=2):
    """启动后台 Worker 线程（幂等：已启动则不重复）。"""
    store.ensure()
    if _workers:
        return
    _stop.clear()
    for _ in range(max(1, int(workers))):
        th = threading.Thread(target=_loop, name="ecom-worker", daemon=True)
        th.start()
        _workers.append(th)


def stop():
    _stop.set()
    for th in _workers:
        th.join(timeout=2)
    _workers.clear()


def running():
    return len(_workers)
