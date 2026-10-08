# 电商板块 vs 51aic 最终收尾 · 任务清单

- [x] T1 视频翻译：结果预览区新增「点击开启声音」覆盖提示按钮（`data-unmute`，默认 hidden）
- [x] T2 视频翻译：绑定视频就绪/播放逻辑，静音时展示、点击后开声并隐藏
- [x] T3 `ecom-css.js`：新增 `.unmute-hint` 样式
- [x] T4 视频复刻：`h1` 改为「爆款视频复刻」
- [x] T5 视频复刻：副标题对齐 51aic 文案
- [x] T6 视频复刻：原视频槽与产品图槽 label 文案对齐 51aic
- [x] T7 `tests/ecom.test.js`：新增 `data-unmute` 与文案断言
- [x] T8 `sw.js`：缓存版本递增 v97 → v98
- [x] T9 本地三绿：单测 / E2E / 网关
- [x] T10 部署上线：tar 上传 → 远端测试 → md5 校验 → 重启 gate（如需）→ 提交并 push main
