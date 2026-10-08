# 电商板块 vs 51aic 最终收尾 · 设计文档

## 概述

两项小范围收尾，均在既有视图内做展示与交互增强，不新增视图、接口或依赖。

## R1 视频翻译 · 点击开启声音

- 文件：`src/drama/ecom/ecom-video-translate.js`。
- 在 `.stage`（`data-stage`）内、`<video data-player>` 之后新增一个覆盖式按钮：
  `<button type="button" data-unmute hidden ...>点击开启声音</button>`。
- 触发逻辑：视频源就绪（`loadeddata` / `play`）后，若 `player.muted === true`，移除 `hidden` 展示提示。
- 点击处理：`player.muted = false; player.volume = 1;`，并隐藏提示。
- 样式：在 `ecom-css.js` 追加 `.ecom-ui .stage .unmute-hint`（居中、半透明底、圆角、白色文字、`z-index` 高于视频）。
- 不做自动播放策略绕过；仅提示用户手动开声，符合浏览器策略。

## R2 视频复刻 · 文案对齐

- 文件：`src/drama/ecom/ecom-video-copy.js`。
- `HTML` 模板：
  - `<h1>` 由「视频复刻」改为「爆款视频复刻」。
  - 副标题 `<p>` 改为 51aic 文案。
  - 原视频槽 `<label>` 文案改为「上传原视频（MP4 / MOV / MKV / AVI / MPG，≤100MB）」。
  - 产品图槽 `<label>` 文案改为「上传产品图（JPG / PNG / WEBP，≤10MB）」。
- 不动 `data-*` 选择器与内部逻辑，保证测试与流程不受影响。

## 测试

- `tests/ecom.test.js`：新增断言：
  - 视频翻译：存在 `[data-unmute]`，且默认 `hidden`。
  - 视频复刻：`h1` 文案为「爆款视频复刻」；含「上传原视频」「上传产品图」文案。
- E2E 流程不变（选择器未变）。

## 缓存

- `sw.js` 版本递增（v97 → v98）。
