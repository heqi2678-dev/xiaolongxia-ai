#!/usr/bin/env python3
"""商品抠图 worker：由 gate 以独立 Python 3.11 venv 解释器调起（rembg）。

用法：matting_worker.py <输入图片> <输出PNG>
环境变量：
  MATTING_MODEL  模型名，默认 u2netp（轻量，适合内存紧张的服务器；可换 u2net / isnet-general-use / u2net_human_seg / birefnet-general）
  MATTING_MAX    推理前长边上限，默认 1600（超大图先缩放再抠图，避免内存爆掉；输出仍保持原分辨率，仅蒙版被放大）
  MATTING_ALPHA  "1"/"true"/"yes" 时启用 alpha matting（发丝级边缘，较慢）
  MATTING_FG / MATTING_BG / MATTING_ERODE  alpha matting 阈值
成功打印 {"ok": true} 并以 0 退出；失败打印 {"ok": false, "error": ...} 并以非 0 退出。
"""
import json
import os
import sys


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "用法：matting_worker.py <in> <out>"}, ensure_ascii=False))
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    try:
        from PIL import Image
        from rembg import remove, new_session
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": "缺少 rembg/Pillow：%s" % exc}, ensure_ascii=False))
        return 3
    try:
        session = new_session(os.environ.get("MATTING_MODEL", "u2netp"))
        alpha = os.environ.get("MATTING_ALPHA", "").lower() in ("1", "true", "yes")
        kwargs = {"session": session, "alpha_matting": alpha}
        if alpha:
            kwargs.update({
                "alpha_matting_foreground_threshold": int(os.environ.get("MATTING_FG", "240")),
                "alpha_matting_background_threshold": int(os.environ.get("MATTING_BG", "10")),
                "alpha_matting_erode_size": int(os.environ.get("MATTING_ERODE", "10")),
            })
        orig = Image.open(src)
        orig.load()
        orig = orig.convert("RGB")
        max_side = int(os.environ.get("MATTING_MAX", "1600") or "1600")
        small = orig
        if max_side > 0 and max(orig.size) > max_side:
            scale = max_side / float(max(orig.size))
            small = orig.resize((max(1, round(orig.width * scale)), max(1, round(orig.height * scale))), Image.LANCZOS)
        cut = remove(small, **kwargs)
        mask = cut.getchannel("A")
        if small.size != orig.size:
            mask = mask.resize(orig.size, Image.LANCZOS)
        out = orig.convert("RGBA")
        out.putalpha(mask)
        out.save(dst, "PNG")
        print(json.dumps({"ok": True}))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": "抠图失败：%s" % exc}, ensure_ascii=False))
        return 4


if __name__ == "__main__":
    sys.exit(main())
