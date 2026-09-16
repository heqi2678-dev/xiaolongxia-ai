# -*- coding: utf-8 -*-
"""把 deck.py 渲染成 1080x1920 的图文分镜卡片，并输出字幕与旁白稿。"""
import os
import sys
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deck import DECK  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
W, H = 1080, 1920
M = 80
CW = W - M * 2

BG = (11, 14, 20)
PANEL = (22, 28, 41)
PANEL2 = (17, 22, 33)
BORDER = (35, 44, 64)
TEXT = (230, 235, 245)
TEXT2 = (154, 167, 189)
DIM = (110, 122, 143)
ACCENT = (255, 90, 60)
ACCENT2 = (255, 143, 90)
BLUE = (70, 130, 255)

FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

_cache = {}


def F(size):
    if size not in _cache:
        _cache[size] = ImageFont.truetype(FONT_PATH, size)
    return _cache[size]


def FM(size):
    key = ("m", size)
    if key not in _cache:
        _cache[key] = ImageFont.truetype(FONT_MONO, size)
    return _cache[key]


def text_w(d, s, font):
    return d.textlength(s, font=font)


def wrap(d, s, font, maxw):
    lines, cur = [], ""
    for ch in s:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        if text_w(d, cur + ch, font) <= maxw:
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    lines.append(cur)
    return [l for l in lines]


def draw_bold(d, xy, s, font, fill, bold=True, anchor=None):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)
    if bold:
        x, y = xy[0], xy[1]
        d.text((x + 1, y), s, font=font, fill=fill, anchor=anchor)
        d.text((x, y + 1), s, font=font, fill=fill, anchor=anchor)


def grad_rect(img, box, c1, c2, radius=0, horizontal=True):
    """在 img 上画一个线性渐变填充的圆角矩形。"""
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    g = Image.new("RGB", (w, 1) if horizontal else (1, h))
    px = g.load()
    n = w if horizontal else h
    for i in range(n):
        t = i / max(1, n - 1)
        col = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3))
        if horizontal:
            px[i, 0] = col
        else:
            px[0, i] = col
    g = g.resize((w, h))
    if radius > 0:
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
        img.paste(g, (x0, y0), mask)
    else:
        img.paste(g, (x0, y0))


def glow(base, cx, cy, rx, ry, color, alpha):
    small = (W // 4, H // 4)
    mask = Image.new("L", small, 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([cx / 4 - rx / 4, cy / 4 - ry / 4, cx / 4 + rx / 4, cy / 4 + ry / 4], fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(46)).resize((W, H), Image.BILINEAR)
    layer = Image.new("RGB", (W, H), color)
    base.paste(layer, (0, 0), mask)


def background():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=(int(11 + 5 * t), int(14 + 6 * t), int(20 + 10 * t)))
    glow(img, 120, 60, 1000, 900, ACCENT, 46)
    glow(img, 1010, 1880, 1100, 950, BLUE, 34)
    return img


BASE = background()


def header(img, d, kicker):
    grad_rect(img, (M, 74, M + 56, 130), ACCENT, ACCENT2, radius=16)
    d = ImageDraw.Draw(img)
    draw_bold(d, (M + 28, 102), "龙", F(30), (255, 255, 255), anchor="mm")
    draw_bold(d, (M + 76, 102), "小龙虾AI · AI 短剧工作台", F(30), TEXT2, bold=False, anchor="lm")
    if kicker:
        f = F(28)
        tw = text_w(d, kicker, f)
        x1 = W - M
        x0 = x1 - tw - 36
        d.rounded_rectangle([x0, 74, x1, 130], radius=28, fill=PANEL, outline=BORDER)
        draw_bold(d, (x0 + 18, 102), kicker, f, ACCENT2, bold=False, anchor="lm")


def footer(img, d, idx, total):
    note_y = H - 132
    d.line([(M, note_y - 26), (W - M, note_y - 26)], fill=(28, 35, 50))
    draw_bold(d, (M, note_y), "小龙虾AI · AI 短剧工作台使用教程", F(26), DIM, bold=False, anchor="lm")
    draw_bold(d, (W - M, note_y), "%d / %d" % (idx, total), F(26), DIM, bold=False, anchor="rm")
    bar_y = H - 74
    d.rounded_rectangle([M, bar_y, W - M, bar_y + 8], radius=4, fill=(30, 37, 53))
    gw = int(CW * idx / total)
    grad_rect(img, (M, bar_y, M + max(8, gw), bar_y + 8), ACCENT, ACCENT2, radius=4)


def title_block(img, d, s, y):
    if s.get("kicker"):
        draw_bold(d, (M, y), s["kicker"], F(34), ACCENT2, bold=False, anchor="lt")
        y += 58
    size = 70 if len(s["title"]) <= 12 else 60
    draw_bold(d, (M, y), s["title"], F(size), TEXT, anchor="lt")
    y += int(size * 1.34)
    grad_rect(img, (M, y, M + 132, y + 9), ACCENT, ACCENT2, radius=5)
    return y + 9 + 66


def bullet_dot(d, x, y, r=8):
    d.ellipse([x, y, x + r * 2, y + r * 2], fill=ACCENT)


def rows_geometry(d, s, size):
    """算出表格的列宽与每列换行结果。"""
    items = s["items"]
    head = s.get("head")
    ncol = len(head) if head else len(items[0])
    c0 = 236 if ncol > 2 else 260
    rest = (CW - c0 - 24 * (ncol - 1)) // max(1, ncol - 1)
    widths = [c0] + [rest] * (ncol - 1)
    pad = 26
    fb = F(size)
    plan = []
    for it in items:
        cells = [wrap(d, str(c), fb, widths[i] - pad * 2) for i, c in enumerate(it)]
        lines_n = max(len(c) for c in cells)
        blk = lines_n * int(size * 1.5) + 22
        plan.append((cells, blk))
    hplan = None
    if head:
        hcells = [wrap(d, str(c), F(size - 2), widths[i] - pad * 2) for i, c in enumerate(head)]
        hplan = (hcells, max(len(c) for c in hcells) * int(size * 1.5) + 20)
    return widths, pad, plan, hplan


def block(img, d, kind, items, y, avail, s=None):
    """按类型排版正文，返回结束 y。"""
    head = (s or {}).get("head")
    for size in range(42, 24, -2):
        fb = F(size)
        lh = int(size * 1.62)
        gap = 30 if kind != "qa" else 34
        total = 0
        plan = []
        if kind == "rows":
            widths, pad, plan, hplan = rows_geometry(d, s, size)
            total = sum(p[1] + 10 for p in plan) + (hplan[1] + 12 if hplan else 0)
        else:
            for it in items:
                if kind == "qa":
                    q, a = it
                    ql = wrap(d, q, F(size + 4), CW - 40)
                    al = wrap(d, a, fb, CW - 40)
                    blk = len(ql) * int((size + 4) * 1.5) + len(al) * int(size * 1.5) + 26
                    plan.append((ql, al, blk))
                    total += blk + gap
                else:
                    lines = wrap(d, it, fb, CW - 24)
                    blk = len(lines) * lh
                    plan.append((lines, None, blk))
                    total += blk + gap
        if total <= avail or size <= 26:
            break

    pad_top = min(max(0, (avail - total)) // 3, 190)
    y += pad_top

    if kind == "rows":
        widths, pad, plan, hplan = rows_geometry(d, s, size)
        if hplan:
            hcells, hh = hplan
            d.rounded_rectangle([M, y, W - M, y + hh], radius=14, fill=(28, 35, 51))
            cx = M
            for i, cell in enumerate(hcells):
                for j, ln in enumerate(cell):
                    draw_bold(d, (cx + pad, y + 10 + j * int(size * 1.5)), ln,
                              F(size - 2), ACCENT2 if i else DIM, anchor="lt")
                cx += widths[i] + 24
            y += hh + 12
        for k, (cells, blk) in enumerate(plan):
            bg = PANEL if k % 2 == 0 else PANEL2
            d.rounded_rectangle([M, y, W - M, y + blk], radius=16, fill=bg, outline=BORDER)
            grad_rect(img, (M, y + 10, M + 6, y + blk - 10), ACCENT, ACCENT2, radius=3)
            cx = M
            for i, cell in enumerate(cells):
                ty = y + 11
                for ln in cell:
                    draw_bold(d, (cx + pad, ty), ln, F(size),
                              ACCENT2 if i == 0 else TEXT, bold=(i == 0), anchor="lt")
                    ty += int(size * 1.5)
                cx += widths[i] + 24
            y += blk + 10
        return y

    for it in plan:
        a, b, blk = it
        if kind == "qa":
            d.rounded_rectangle([M, y, W - M, y + blk + 20], radius=20, fill=PANEL2, outline=BORDER)
            draw_bold(d, (M + 26, y + 20), "Q " + "".join(a), F(size + 4), ACCENT2, anchor="lt")
            ty = y + 20 + len(a) * int((size + 4) * 1.5) + 4
            for ln in b:
                draw_bold(d, (M + 26, ty), ln, F(size), TEXT, bold=False, anchor="lt")
                ty += int(size * 1.5)
            y += blk + 20 + 34
        else:
            lines = a
            bullet_dot(d, M + 2, y + int(size * 0.52))
            for i, ln in enumerate(lines):
                draw_bold(d, (M + 40, y), ln, F(size), TEXT, bold=False, anchor="lt")
                y += lh
            y += gap
    return y


def note_block(d, s, y):
    if not s.get("note"):
        return y
    f = F(32)
    lines = wrap(d, s["note"], f, CW - 60)
    h = len(lines) * int(32 * 1.6) + 36
    d.rounded_rectangle([M, y, W - M, y + h], radius=18, fill=(40, 24, 20), outline=(92, 46, 34))
    ty = y + 18
    for ln in lines:
        draw_bold(d, (M + 30, ty), ln, f, (255, 176, 140), bold=False, anchor="lt")
        ty += int(32 * 1.6)
    return y + h


def meta_block(d, s, y):
    if not s.get("meta"):
        return y
    f = F(34)
    for m in s["meta"]:
        draw_bold(d, (M, y), "· " + m, f, TEXT2, bold=False, anchor="lt")
        y += int(34 * 1.7)
    return y


def render_slide(s, idx, total, path):
    img = BASE.copy()
    d = ImageDraw.Draw(img)
    kind = s["kind"]
    header(img, d, s.get("kicker", ""))

    if kind == "cover":
        y = 560
        draw_bold(d, (M, y), "AI 短剧工作台", F(104), TEXT, anchor="lt")
        y += 190
        grad_rect(img, (M, y, M + 220, y + 12), ACCENT, ACCENT2, radius=6)
        y += 90
        draw_bold(d, (M, y), s["subtitle"], F(48), ACCENT2, anchor="lt")
        y += 130
        y = meta_block(d, s, y)
        y += 40
        note_block(d, s, min(y, H - 420))
    elif kind == "section":
        y = 700
        draw_bold(d, (M, y), "CHAPTER", FM(40), (70, 84, 108), bold=False, anchor="lt")
        y += 90
        draw_bold(d, (M, y), s["title"], F(96), TEXT, anchor="lt")
        y += 150
        grad_rect(img, (M, y, M + 220, y + 12), ACCENT, ACCENT2, radius=6)
        y += 100
        draw_bold(d, (M, y), s["subtitle"], F(44), TEXT2, bold=False, anchor="lt")
    elif kind == "end":
        y = 620
        draw_bold(d, (M, y), s["title"], F(96), TEXT, anchor="lt")
        y += 170
        grad_rect(img, (M, y, M + 220, y + 12), ACCENT, ACCENT2, radius=6)
        y += 96
        draw_bold(d, (M, y), s["subtitle"], F(44), ACCENT2, bold=False, anchor="lt")
        y += 150
        y = meta_block(d, s, y)
        y += 40
        note_block(d, s, min(y, H - 400))
    else:
        y = title_block(img, d, s, 250)
        d = ImageDraw.Draw(img)
        avail = (H - 210) - y - 60
        y = block(img, d, kind, s["items"], y, avail, s)
        if s.get("note"):
            note_block(d, s, y + 6)

    footer(img, d, idx, total)
    img.save(path, "PNG", optimize=True)


def narration(s):
    kind = s["kind"]
    out = []
    if kind in ("cover", "section", "end"):
        out.append(s["title"] + ("，" + s["subtitle"] if s.get("subtitle") else ""))
        out += list(s.get("meta") or [])
        if s.get("note"):
            out.append(s["note"])
        return out
    out.append(s["title"])
    for it in s["items"]:
        if kind == "qa":
            out.append(it[0] + " " + it[1])
        elif kind == "rows":
            out.append(str(it[0]) + "：" + str(it[1]))
        else:
            out.append(it)
    if s.get("note"):
        out.append(s["note"])
    return out


def secs(txt):
    return len(txt.replace(" ", ""))


def duration(s, narr):
    kind = s["kind"]
    if kind == "cover":
        return 6.0
    if kind == "section":
        return 4.0
    if kind == "end":
        return 8.0
    total = sum(secs(t) for t in narr)
    d = 2.6 + total / 7.6
    return max(4.0, min(17.0, round(d, 1)))


def fmt_t(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = len(DECK)
    durations, narrs = [], []
    for i, s in enumerate(DECK, 1):
        render_slide(s, i, total, os.path.join(OUT, "slide_%03d.png" % i))
        n = narration(s)
        narrs.append(n)
        durations.append(duration(s, n))
        print("rendered %02d/%d  %-38s %.1fs" % (i, total, s["title"], durations[-1]))

    # concat 清单
    with open(os.path.join(HERE, "slides.txt"), "w") as f:
        for i in range(1, total + 1):
            f.write("file '%s'\n" % os.path.join(OUT, "slide_%03d.png" % i))
            f.write("duration %.2f\n" % durations[i - 1])
        f.write("file '%s'\n" % os.path.join(OUT, "slide_%03d.png" % total))

    # 字幕 + 旁白稿
    t = 0.0
    srt, md = [], []
    md.append("# 旁白稿 · AI 短剧工作台使用教程\n")
    md.append("> 每页一段，可直接用于配音。总时长约 %.1f 分钟。\n" % (sum(durations) / 60))
    for i, s in enumerate(DECK):
        dur = durations[i]
        n = narrs[i]
        srt.append("%d" % (i + 1))
        srt.append("%s --> %s" % (fmt_t(t + 0.15), fmt_t(t + dur - 0.1)))
        srt.append("\n".join(n[:3]))
        srt.append("")
        md.append("\n## 第 %d 页 · %s（%.1fs）\n" % (i + 1, s["title"], dur))
        for line in n:
            md.append("- " + line)
        md.append("")
        t += dur
    with open(os.path.join(HERE, "字幕.srt"), "w") as f:
        f.write("\n".join(srt))
    with open(os.path.join(HERE, "旁白稿.md"), "w") as f:
        f.write("\n".join(md))

    with open(os.path.join(HERE, "meta.json"), "w") as f:
        json.dump({"count": total, "durations": durations, "total": sum(durations)}, f, indent=2)
    print("\n总计 %d 页，%.1f 秒（%.1f 分钟）" % (total, sum(durations), sum(durations) / 60))


if __name__ == "__main__":
    main()
