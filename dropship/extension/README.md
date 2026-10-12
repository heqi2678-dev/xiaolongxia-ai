# 铜龙铺货采集器（浏览器扩展）

在 1688 商品详情页一键采集商品（标题 / 主图 / 详情图 / SKU / 价格 / 货号 / 供应商 / 阶梯价），
支持采集预览勾选与列表页批量采集，回传到铜龙铺货后端。
下载 API 普通开发者拿不到，所以读货这一侧走浏览器扩展读取用户当前打开的页面。

## 目录

- `manifest.json` — MV3 清单（1688 详情页 + 列表页匹配、后端 host 权限）
- `src/collector.js` — 采集核心，纯函数，浏览器与 node 测试台共用
- `src/content.js` / `content.css` — 详情页悬浮按钮 + 懒加载滚动 + 采集预览面板
- `src/list.js` — 列表页 / 收藏夹批量采集按钮
- `src/background.js` — Service Worker，保存后端地址/令牌并 POST 到后端
- `src/popup.html` / `popup.js` — 配置后端地址与令牌、测试连接、采集当前页、批量采集
- `test/collector.test.js` — `collector.js` 的 node 单测

## 本地加载

1. 打开 `chrome://extensions`，开启「开发者模式」
2. 点「加载已解压的扩展程序」，选择本目录 `dropship/extension`
3. 点扩展图标，填铺货后端地址（默认 `http://127.0.0.1:9150`）与令牌，保存并测试连接

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
| `applySelection(product, sel)` | 按预览面板勾选裁剪字段与图片 |
| `extractOffer({url, html})` | 汇总为统一原始商品结构 |

> 价格与 SKU 页面结构随 1688 频繁变动，当前为通用抽取 + 保守兜底；后续可在
> `extractOffer` 内补充按需字段。系统要求采集后必须经「AI 加工 + 平台映射」再上架。
