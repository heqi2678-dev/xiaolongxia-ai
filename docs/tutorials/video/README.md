# 教程视频（图文分镜版）

把 `AI短剧工作台使用教程.md` 转成竖屏 1080x1920 的图文讲解视频，共 41 页，约 7.5 分钟。
视频没有配音，靠屏幕文字讲解，适合零基础用户边看边操作。

## 目录内容

| 文件 | 用途 |
|---|---|
| `deck.py` | 41 页的内容定义（标题、要点、备注），改文案只改这里 |
| `render.py` | 用 Pillow 把内容渲染成 1080x1920 的 PNG，并生成 `字幕.srt` / `旁白稿.md` |
| `build_video.py` | 用 ffmpeg 把 PNG 合成 mp4（缓慢推近 + 首尾淡入淡出 + 静音音轨） |
| `字幕.srt` | 按页切分的字幕，可直接导入剪映或播放器 |
| `旁白稿.md` | 每页的文字稿，一句话一条，供后期配音使用 |
| `说明.txt` | 给使用者的交付说明 |

成片（`AI短剧工作台使用教程.mp4`）和 41 张卡片图体积较大，未进 Git，按下方命令本地重建即可。

## 重建步骤

依赖：Python3 + Pillow、ffmpeg、中文字体。

```bash
# 安装依赖（Debian/Ubuntu）
pip3 install --break-system-packages pillow
apt-get install -y ffmpeg fonts-wqy-zenhei
fc-cache -f
```

```bash
# 渲染卡片 + 生成字幕与旁白稿（输出到 out/）
python3 render.py

# 合成视频（默认 crf20/veryfast/30fps；可用环境变量覆盖）
python3 build_video.py

# 出更小的分享版（crf26/medium/25fps）
VCRF=26 VPRESET=medium VFPS=25 VSUFFIX=lite python3 build_video.py
```

可覆盖的环境变量：`VCRF`、`VPRESET`、`VFPS`、`VSUFFIX`（输出文件名与 clips 目录后缀）。

## 改内容

1. 编辑 `deck.py` 的 `DECK` 列表，新增/删除一页即可，`render.py` 会自动重算页码、总时长、字幕时间轴。
2. 页类型 `kind` 支持：`cover`、`section`、`list`、`steps`、`rows`（表格，可带 `head`）、`callout`、`qa`、`end`。
3. 重新跑 `python3 render.py && python3 build_video.py`。

## 时长是怎么定的

每页时长 = `2.6 + 本页总字数 / 7.6` 秒，夹在 4-17 秒之间；封面 6 秒、章节页 4 秒、结束页 8 秒。
改文案后总时长会自动变化，`render.py` 结束时会打印新的总时长。

## 关于配音

本机没有可用的中文 TTS（ffmpeg 只有英文 flite），所以成片无旁白。
需要配音版时：把 `旁白稿.md` 交给人录，或用火山 TTS 按 `字幕.srt` 的时间轴生成后替换静音音轨。
