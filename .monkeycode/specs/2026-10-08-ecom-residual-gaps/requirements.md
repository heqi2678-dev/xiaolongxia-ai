# 电商板块 vs 51aic 残留缺口补齐 · 需求文档

## 背景

上一批「电商对齐缺口补齐」已上线（提交 b1bfcbe）。二次全盘比对 51aic 后，仍有 6 项功能性缺口。本文档承载这 6 项残留缺口的规格，不修改已上线批次对应规格 `2026-10-08-ecom-parity-gap-fill`。

对齐基线为线上 51aic 对应页面（`51aic-video.html` / `51aic-videocopy.html` / `51aic-videotrans.html` / `51aic-image.html` / `51aic-tools.html` / `51aic-home.html`）。命名与取值原样对齐，本站品牌仍为「铜龙电商ai助手」。

## 术语

- 工作台：电商分区首页（视图 `ecomHome`）。
- AI 作图：视图 `ecomDraw`，12 个工作模式。
- 视频翻译：视图 `ecomVideoTranslate`。
- 视频复刻：视图 `ecomVideoCopy`。
- 图生视频：视图 `ecomVideoI2V`。
- AI 工具箱：视图 `ecomToolbox`，16 项工具。

## 需求

### R1 视频翻译 · 字幕位置详细设置

- When 用户点击「字幕位置 · 可点击进入详细设置」，the 系统 shall 打开字幕位置详细设置弹窗。
- The 弹窗 shall 提供九宫格位置点选，并提供实时预览。
- When 用户点击「确定」，the 系统 shall 将所选位置用于字幕烧制。
- When 用户点击「取消」，the 系统 shall 保持原位置。
- The 字幕烧制 shall 支持按归一化横纵坐标定位。

### R2 视频复刻 · 链接上传

- The 视频复刻原视频区 shall 提供链接输入与「载入」按钮。
- When 用户粘贴 http/https 视频链接并点击「载入」，the 系统 shall 拉取其作为参考视频并在预览区播放。
- If 链接不是 http/https，the 系统 shall 提示「请填写有效的视频链接」。

### R3 AI 作图 · 2K / 4K 清晰度

- The AI 作图清晰度 shall 提供「1K 标准 / 2K 高清 / 4K 超清」三档且均可选择。
- When 用户选择 2K 或 4K，the 系统 shall 以高清尺寸（按比例 ×1.5，上限 4096）请求图像服务。

### R4 AI 工具箱 · 试试样片

- The AI 工具箱 shall 提供「试试样片」入口。
- When 用户点击「试试样片」，the 系统 shall 加载内置样片到编辑画布，可立即套用工具。

### R5 图生视频 · 生成记录

- The 图生视频 shall 提供「生成记录」入口。
- When 用户点击「生成记录」，the 系统 shall 弹出弹窗，列出近 30 天生成的视频；点击可下载。
- If 无记录，the 系统 shall 显示空态提示。

### R6 工作台 · AI 作图快捷模式

- The 工作台 shall 提供「AI 作图 · 快捷模式」入口条。
- When 用户点击某个快捷模式，the 系统 shall 进入 AI 作图并预选该模式。

## 非功能需求

- 单测、e2e、网关测试须全绿。
- Service Worker 缓存版本须递增。
- 不新增后端依赖；仅扩展字幕合成的样式参数。
