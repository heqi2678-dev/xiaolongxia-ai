# 电商板块 vs 51aic 残留缺口补齐 · 设计文档

## 概述

在现有 13 页电商工作台上补齐 6 项残留缺口，复用既有的 `EC.gen` / `EC.store` / `EC.ui` / adapters 与常量，不改变导航结构与各页键名。

## 变更清单

| 需求 | 文件 | 变更 |
| --- | --- | --- |
| R1 | `src/drama/ecom/ecom-video-translate.js` | 字幕位置详细设置入口 + 弹窗；`style` 增加 `x`/`y` |
| R1 | `gate/server.py` | `drama_subtitle` 支持 `style.x` / `style.y` 归一化定位 |
| R2 | `src/drama/ecom/ecom-video-copy.js` | 原视频区链接输入 + 载入 |
| R3 | `src/drama/ecom/ecom-draw.js` | 清除 2K/4K 禁用；`gen.image` 透传 `hires` |
| R4 | `src/drama/ecom/ecom-toolbox.js` | 「试试样片」入口，加载内置样片 |
| R5 | `src/drama/ecom/ecom-video-i2v.js` | 「生成记录」入口 + 弹窗（复用 `.hist-*` 样式） |
| R6 | `src/drama/ecom/ecom-home.js` / `ecom-draw.js` / `ecom.js` | 快捷模式条 + `EC.openDraw(mode)` |
| 通用 | `src/drama/ecom/ecom-css.js` | 新增弹窗、快捷条、位置预览样式 |
| 通用 | `sw.js` | 缓存版本递增 |

## 详细设计

### R1 字幕位置详细设置

- 在 `data-subbox` 内、字号上方增加按钮：
  `<button class="btn btn-ghost sub-pos-entry" data-subpos-open>字幕位置 · 可点击进入详细设置</button>`。
- 弹窗 `subPosDialog(el)`：
  - 3×3 位置网格（9 个点，`data-px` / `data-py` 取 0 / 0.5 / 1）。
  - 预览区按比例放置一个示意字幕块，随点选移动。
  - 底部「取消 / 确定」；确定写入 `el.__vt.subXY = {x, y}`。
- `run()` 构造 `subStyle` 时，若 `el.__vt.subXY` 存在则附加 `x` / `y`；否则保持 `pos` 逻辑。
- 点击 `subpos` 芯片时清除 `subXY`，回到三档位置语义。
- 后端 `drama_subtitle`：当 `style.x` 与 `style.y` 均存在时，用
  `x=(w-text_w)*X`、`y=(h-text_h)*Y` 定位；否则沿用 `pos` + `margin`。

### R2 视频复刻链接上传

- 原视频 dropzone 下方加 `.ref-row`（`input[data-link]` + `button[data-link-load]`）。
- 点击「载入」：校验 `^https?://`，`EC.store.addFromUrl(link,{kind:"upload",name:"链接视频"})`，写入 `el.__vc.video` 并更新 `[data-ref-player]` 与空态。

### R3 2K / 4K 清晰度

- `ratioPop` 与清晰度 `menu` 去掉 `is-disabled` 与「即将开放」拦截，三档皆可选。
- `doGenerate` 传 `hires: st.quality !== "1K 标准"`，由 `adapters/image.js` 的 `hiresRatio`/`hiresSize` 生效。

### R4 试试样片

- 顶部 page-head 增加按钮 `data-try`「试试样片」。
- 点击加载内置样片 `assets/ecom/pot.jpg`：`EC.store.addFromUrl` 后 `loadSrc(el, asset)`，与手动上传同一路径。

### R5 图生视频生成记录

- page-head 增加 `data-history`「生成记录」按钮。
- `showHistory(el)`：`EC.store.list()` 过滤 `kind === "video"`，按 `meta.mode === "i2v"`，取近 30 天，弹 `EC.ui.modal`（复用 `.hist-grid` / `.hist-item` / `.ed-empty`），点击下载。

### R6 工作台快捷模式

- `ecom.js` 增加 `EC.pending` 与 `EC.openDraw(mode)`：写 `pending.drawMode` 后 `go("ecomDraw")`。
- `ecom-home.js` 在 hero 与 feature-grid 之间加 `.mode-strip`，卡片带 `data-draw-mode`；点击调用 `EC.openDraw(mode)`。
- `ecom-draw.js` `register` 读取并消费 `EC.pending.drawMode`，若有则 `selectMode`。

## 兼容性

- 各页 `register` 保留既有 DOM 契约与 `data-*` 钩子；新增元素不改变既有选择器数量（`.feature` 仍为 10）。
- 新增样式均作用域在 `.ecom-ui` / `.subpos-*`，不污染其他分区。
