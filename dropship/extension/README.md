# 铜龙铺货采集器（浏览器扩展）

在 1688 商品详情页一键采集商品（标题 / 主图 / 详情图 / SKU / 价格 / 货号 / 供应商 / 阶梯价），
支持采集预览勾选与列表页批量采集，回传到铜龙铺货后端。
采集时自动归纳：装饰性素材（图标 `-tps-`/`.svg`、广告 `gg_dtc`、服务标 `cms/upload`、`/tfs/`、
视频封面 `tbvideo`、评价图 `-rate`）直接不采集；
**主图/详情图优先读取页面内嵌 JSON**（`gallery.fields.mainImage` 为权威主图、`offerImgList` 为主图+规格图全集），
拿不到 JSON 才退回 DOM 启发式（按卖家 uid 剔除「推荐/相关商品」缩略图，前 5 张归主图）；
**详情描述长图**单独从页面 `detailUrl`（`itemcdn.tmall.com/1688offer/icoss*`）二次拉取，解析 `offer_details.content` 里的 `<img src>` 得到，
拉取失败才退回 `offerImgList` 去掉主图的部分兜底；
SKU 图从页面 JSON 的 `skuModel.skuProps[].value[].imageUrl` / `skuImage` 等字段抽取，单列**SKU 图**组并归到各 SKU；
预览面板三组（主图 / SKU 图 / 详情图）均可勾选保留；同一张图既是 SKU 图又是详情图时两处都保留；价格归纳为基础价 + 阶梯价。
下载 API 普通开发者拿不到，所以读货这一侧走浏览器扩展读取用户当前打开的页面。

> 淘宝店铺**无法申请开放平台自研应用**（自研准入仅面向天猫），因此淘宝上架不走官方 API，
> 改由本扩展在淘宝/天猫「发布宝贝」页**辅助填表**（见下）。

## 目录

- `manifest.json` — MV3 清单（1688 详情页 + 列表页匹配、淘宝发布页匹配、后端 host 权限）
- `src/collector.js` — 采集核心，纯函数，浏览器与 node 测试台共用
- `src/content.js` / `content.css` — 详情页悬浮按钮 + 懒加载滚动 + 采集预览面板
- `src/list.js` — 列表页 / 收藏夹批量采集按钮
- `src/publisher.js` — 淘宝发布助手核心，纯函数（字段计划 / 描述文本 / 图片解析）
- `src/publish.js` — 淘宝/天猫发布页注入面板：从铺货库选商品 → 辅助填表
- `src/background.js` — Service Worker，保存后端地址/令牌、POST 采集、拉取货源库、代理取图
- `src/popup.html` / `popup.js` — 配置后端地址与令牌、测试连接、采集当前页、批量采集
- `test/collector.test.js` — `collector.js` 的 node 单测
- `test/publisher.test.js` — `publisher.js` 的 node 单测

## 本地加载

1. 打开 `chrome://extensions`，开启「开发者模式」
2. 点「加载已解压的扩展程序」，选择本目录 `dropship/extension`
3. 点扩展图标，填铺货后端地址（默认 `http://47.108.14.206/dropship`，本机开发可改 `http://127.0.0.1:9150`）与令牌，保存并测试连接

## 采集流程

1. 打开任意 1688 商品详情页（`detail.1688.com/offer/*`）
2. 点右下角「采集到铜龙铺货」，或点扩展图标里的「采集当前页」
3. content 脚本先滚动触发懒加载，再取整页 HTML，交给 `XLXCollector.extractOffer` 解析
4. 弹出**采集预览面板**，勾选要保留的字段与图片，确认后经 background `POST {后端}/api/collect` 入库
5. 列表页 / 收藏夹可点悬浮按钮或扩展里的「批量采集本页商品」，逐条抓取详情页并回传

## 采集核心接口（`XLXCollector`）

| 函数 | 作用 |
| --- | --- |
| `extractOfferId(url)` | 从详情页 URL 取商品 ID |
| `normalizeImageUrl(url)` | 去缩略图后缀、补全协议，换原图 |
| `isAllowedImage(url)` | 白名单图床校验 |
| `collectImages(html)` | 归一、去重、保序地抽取页面图片 |
| `extractTitle/Price/Description(html)` | 抽取标题 / 价格 / 详情 |
| `extractItemNo/Supplier(html)` | 抽取货号 / 供应商 |
| `extractLadderPrices(html)` | 抽取阶梯价 `[{minQty, price}]` |
| `extractSpecs(html)` / `buildSkus(...)` | 抽取颜色/尺码并生成规格组合 |
| `extractBatchLinks(html)` | 列表页提取商品链接（去重、补协议） |
| `extractStructuredGallery(html)` | 从内嵌 JSON 取主图/规格图（`mainImage`/`offerImgList`） |
| `extractDetailUrl(html)` | 取详情描述长图地址 `detailUrl` |
| `extractDetailImages(text)` | 从 `offer_details.content` 解析详情长图并过滤装饰素材 |
| `applySelection(product, sel)` | 按预览面板勾选裁剪字段与图片 |
| `extractOffer({url, html})` | 汇总为统一原始商品结构 |

> 价格与 SKU 页面结构随 1688 频繁变动，当前为通用抽取 + 保守兜底；后续可在
> `extractOffer` 内补充按需字段。系统要求采集后必须经「AI 加工 + 平台映射」再上架。

## 淘宝发布助手（辅助填表）

淘宝 C 店拿不到自研应用授权，官方 API 通道关闭，改走发布页辅助：

1. 先在铺货后端「加工 / 映射」好商品（标题、价格、SKU、主图齐备）
2. 打开淘宝/天猫**发布宝贝**页，右下角出现「从铺货库填入」按钮
3. 点开面板，搜索并选商品，点「填入」→ 脚本尽力填入标题 / 一口价 / 库存
4. 面板同时给出：已填/未找到字段、`复制全部字段`/`复制描述`、SKU 列表、主图下载入口
5. 主图与富文本描述因淘宝发布页是复杂 SPA，仍需人工上传（脚本不能可靠代填）

`fillTargets` 用「宝贝标题 / 一口价 / 库存」等文案关键词在页面上定位输入框；
若淘宝改版导致定位失败，面板会提示改用「复制全部字段」手工粘贴。

### 发布助手核心接口（`XLXPublisher`）

| 函数 | 作用 |
| --- | --- |
| `joinUrl(base, path)` | 把后端相对图片地址拼成可访问地址 |
| `resolveImage(item, base)` | 取图片可下载地址（优先本地归档） |
| `mainImages(product, base)` | 解析去重主图列表 |
| `totalStock(product)` / `listPrice(product)` | 汇总库存 / 取发布价 |
| `skuSummary(product)` | 规格摘要 `[{label, price, stock}]` |
| `buildFieldPlan(product, base)` | 汇总为发布页字段计划 |
| `fillTargets(plan)` | 需自动填入的字段 + 定位关键词 |
| `describeProduct(product, base)` | 生成可粘贴的整段文本 |
