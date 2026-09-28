"""图片工坊处理器（设计稿 6.3 / HookShot 参照）。

当前为本地确定性处理器：按配方 / 处理器 / 平台规格为来源素材派生新的 edit 素材
（保留原素材），并记录处理方案。真实像素加工（抠图 / 白底 / 去重 / 尺寸）与 AI 生成
引擎（BYOK）以同一 ``derive`` 契约为准，可在后续接入时替换实现，上层无需改动。
"""

import hashlib

from . import store

# 配方：主图制作 + 详情页（设计稿 6.3 / HookShot 商品图设计工具）
RECIPES = {
    "white": {"label": "白底图", "roles": ["white"], "ops": ["cutout", "white_bg"]},
    "promo": {"label": "卖点图", "roles": ["promo"], "ops": ["copy"]},
    "detail": {"label": "细节图", "roles": ["detail"], "ops": ["crop"]},
    "size": {"label": "尺寸图", "roles": ["size"], "ops": ["scale"]},
    "scene": {"label": "使用场景图", "roles": ["scene"], "ops": ["bg_replace"]},
    "scene_render": {"label": "场景渲染图", "roles": ["scene_render"], "ops": ["bg_replace", "relight"]},
    "poster": {"label": "营销海报", "roles": ["poster"], "ops": ["copy"]},
    "suite": {"label": "商品套图", "roles": ["white", "promo", "detail", "size"], "ops": ["cutout"]},
    "detail_long": {"label": "详情长图", "roles": ["detail_long"], "ops": ["compose"]},
    "recreate": {"label": "图片复刻", "roles": ["recreate"], "ops": ["template"]},
}

# 处理器（设计稿 6.2 第 30 / 32 条）
PROCESSORS = {
    "cutout": "抠图",
    "white_bg": "白底",
    "bg_replace": "背景替换",
    "dedup": "去重（裁剪/调色/边框）",
    "scale": "尺寸比例",
    "copy": "文案图",
    "crop": "裁剪",
    "relight": "补光",
    "compose": "长图拼接",
    "template": "模板复刻",
}

# 分辨率对照表（设计稿 6.3 / HookShot：平台与分辨率 / 宽高比）
SIZE_TABLE = [
    {"id": "main_square", "label": "主图 · 1:1", "width": 800, "height": 800, "ratio": "1:1"},
    {"id": "main_3x4", "label": "主图 · 3:4", "width": 750, "height": 1000, "ratio": "3:4"},
    {"id": "detail_3x4", "label": "详情页 · 3:4", "width": 750, "height": 1000, "ratio": "3:4"},
    {"id": "detail_long", "label": "详情长图 · 1:2", "width": 750, "height": 1500, "ratio": "1:2"},
    {"id": "video_cover", "label": "视频封面 · 9:16", "width": 720, "height": 1280, "ratio": "9:16"},
]

PLATFORMS = ["douyin", "taobao", "pdd", "kuaishou", "tiktok"]


def _parse_size(size, spec_id=None):
    text = str(size or "").strip().lower().replace("×", "x").replace("*", "x")
    if "x" in text:
        parts = text.split("x")
        try:
            return int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            pass
    for spec in SIZE_TABLE:
        if spec["id"] == spec_id:
            return spec["width"], spec["height"]
    return 800, 800


def _base_media(owner, item):
    if item.get("ref_type") == "media":
        row = store.get("media", owner, item.get("ref_id", ""))
        return row
    product_id = item.get("ref_id", "")
    rows = store.list_rows("media", owner, where="product_id=?", params=(product_id,))
    if not rows:
        return None
    for row in rows:
        if row.get("role") == "main":
            return row
    return rows[0]


def derive(owner, item, recipe="", ops=None, size="", platform="", spec_id=""):
    """为一条任务项派生处理结果，返回输出素材列表（幂等）。"""
    base = _base_media(owner, item)
    if not base:
        return []
    recipe_def = RECIPES.get(recipe) or {"roles": [recipe or "edit"], "ops": ops or []}
    roles = recipe_def.get("roles") or [recipe or "edit"]
    op_list = list(ops or recipe_def.get("ops") or [])
    product_id = base.get("product_id") or item.get("ref_id", "")
    url = base.get("url") or base.get("source_url") or ""
    width, height = _parse_size(size, spec_id)
    outputs = []
    for role in roles:
        seed = "|".join(
            [base.get("id", ""), role, ",".join(op_list), "%dx%d" % (width, height), platform]
        )
        digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
        existing = store.find_media_by_hash(owner, digest)
        if existing:
            row = existing
        else:
            row = store.insert(
                "media",
                owner,
                {
                    "product_id": product_id,
                    "kind": "image",
                    "role": role,
                    "url": url,
                    "source_url": url,
                    "source_type": "edit",
                    "hash": digest,
                    "meta_json": {
                        "recipe": recipe,
                        "role": role,
                        "ops": op_list,
                        "size": "%dx%d" % (width, height),
                        "platform": platform,
                        "parent_media_id": base.get("id", ""),
                    },
                },
            )
        outputs.append(
            {
                "media_id": row.get("id", ""),
                "role": role,
                "recipe": recipe,
                "url": row.get("url", ""),
                "width": width,
                "height": height,
                "ops": op_list,
                "platform": platform,
            }
        )
    return outputs
