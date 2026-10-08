# 电商板块 vs 51aic A+B 对齐 · 技术设计

## 总览

本次为「就地对齐」：在既有 13 页实现上修改常量、模板字符串与少量交互，不新增视图、不新增后端接口、不引入第三方库。所有改动限定在 `src/drama/ecom/` 与测试文件 `tests/ecom.test.js`。保持各页键名、`EC.gen` / `EC.store` / `EC.ui` 原语与导航结构不变。

## 设计原则

1. 差的地方改：文案、取值、默认值、缺失分组原样对齐 51aic。
2. 好的地方不动：本站独有的入口、统计、导出长图、OCR/STT 兜底等保留。
3. 复用原语：弹层统一走 `EC.ui.menu` 或既有 `dcPop`；弹窗走 `EC.ui.modal`；上传走 `EC.ui.pickFiles` + `EC.store.addFile`。
4. 集中常量：能进 `EC.const` 的取值集中管理，便于测试断言。

## 分模块设计

### AI 作图 `ecom-draw.js`

- `QUALITIES` 改为 `["1K", "2K", "4K"]`，默认 `"1K"`；`hires` 判断改为 `st.quality !== "1K"`。
- 底栏发送区文案改为 `5/张`；比例胶囊显示 `st.ratio + " · " + st.quality`。
- Agent 占位、灵感副标题、结果区标题按 R1 文案替换。
- `slotHTML` 增加「本地上传 / 我的资产」两个入口：`[data-local-up]` 触发 `pickFiles`；`[data-asset-pick]` 打开资产选择弹窗。
- 资产选择弹窗：`EC.store.list({kind:["image","upload"]})` 列表，点击后 `push` 到 `st.files`（或详情槽），复用 `renderUploads`。
- 新增 CSS 类 `.slot-src` / `.slot-src-btn` / `.asset-pick-grid`（写入 `ecom-css.js`）。

### AI 详情图 `ecom-detail.js`

- `RATIO_DEF` 改 `"3:4 竖版"`；`COUNT_DEF` 改 `"1 张"`。
- 面板标题「产品素材」→「产品图」；`SLOTS[0].title` 由「主商品图」→「产品图」。
- 生成按钮 `disabled` 初值由 `renderThumbs` 依据 `slots.main.length` 设置；点击时若禁用则提示。
- 快捷提示词去掉 `+` 前缀与 `on` 预选。
- 将 `sku` / `detail` 两个槽包进 `补充参考素材（选传）` 折叠分组（`<details>` 或自定义折叠头 + 容器）：主槽独立显示，SKU/细节在分组内。
- 主槽内补格式说明「支持JPG，JPEG，PNG，WEBP」与「产品图片上传建议」帮助（`?` 图标 + 点击弹窗，内容为两条建议 + 样图）。

### 视频 `ecom-video-i2v.js` / `ecom-video-copy.js`

- 常量新增 `DURATION_LABELS = [{label:"5秒",v:5,credits:150},{label:"10秒",v:10,credits:200},{label:"15秒",v:15,credits:260}]`（图生视频）与复刻对应取值；默认 `10秒`。
- 通道弹层：`CHANNEL_INFO`（图标、描述、稳定性标签、积分）。点击「选择通道」胶囊 → `dcPop` 风格弹层；选择后更新胶囊文案并记录 `el.__i2v.channel`。
- 图生视频比例顺序与默认按 R5 调整；语言触发标签默认「简体中文」。
- 脚本帮写按钮文案改「AI优质帮写视频脚本」。
- 生成参数中的时长从标签解析数值（`parseInt`），保持 `EC.gen.video` 入参不变。
- 视频复刻说明支持 `avi/mpg`。

### 视频翻译 `ecom-video-translate.js`

- 配音音色：开关 → `select`「自动匹配音色」，点击 `EC.ui.menu` 给候选音色（默认自动匹配）。
- 原声处理开关行文案改「原声处理 / 去除背景音乐」。
- 目标语言默认清空，占位「请选择目标语言」；`run()` 中若未选则提示。
- 时长第二项文案改「与原视频时长一致」。
- 字号/行间距：将三档胶囊替换/补充为步进器（`− value +`），默认 64 / 1.2，范围 32–128 / 1.0–2.0；`run()` 读取数值换算为 `size`/`lineHeight`。
- 主按钮文案改「生成视频」。

### 风格复刻 `ecom-style.js`

- 面板标题「素材与要求」→「创建」；参考图标签「参考设计图」、商品图标签「产品图」。
- 上传按钮「添加」→「本地上传」。
- 清晰度默认「1K 标准」，胶囊改为带后缀：比例 `1:1 正方形` 等，清晰度 `1K 标准 / 2K 高清 / 4K 超清`；`run()` 解析数值。
- 主按钮「开始生成」→「生成」。
- `MAX_STYLE`/`MAX_PRODUCT` 保持。

### AI 工具箱 `ecom-toolbox.js`

- 页头标题改「电商修图，一站搞定」，副标题改为能力综述；增加「上传图片」页头动作。
- 每张工具卡增加内联「上传图片」小按钮（`[data-tool-upload]`），点击直接上传并 `loadSrc`。

### 作品库 `ecom-gallery.js`

- 增加配额显示（`已用 n / 上限 100`）与「下载全部」。
- 增加日期范围筛选胶囊（近 7 天 / 近 30 天 / 全部），过滤 `createdAt`。

## 测试

- 更新 `tests/ecom.test.js` 中受影响的断言（清晰度 1K/2K/4K、详情默认值、按钮文案、新增入口存在性等）。
- 新增断言：AI 作图资产来源入口、详情折叠分组、视频时长默认、翻译步进器、工具箱页头与内联上传、作品库日期筛选。

## 风险与回滚

- 纯前端静态改动，覆盖文件即生效；回滚以线上 tag/commit 为准。
- SW 缓存版本递增，避免旧缓存。
- 不改后端，gate 测试预期不变。
