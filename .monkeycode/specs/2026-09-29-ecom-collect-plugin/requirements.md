# Requirements Document

## Introduction

本需求以浏览器插件（Chrome / Edge，Manifest V3）作为 1688 货源的采集入口，替代已无法开通的 1688 官方开放平台采集链路。

背景：用户为自用型卖家，1688 开放平台对自用账号的 API 权限已确认无法开通（所有解决方案角色均「角色不符」，服务商门槛无法满足）。因此采集改为「在用户已登录的浏览器中读取 1688 页面」，插件把页面商品读成统一数据后提交到小龙虾后端落库，后续铺货复用现有商品库与目标平台适配器。

本方案不再要求 1688 应用凭证；目标平台（淘宝）铺货链路维持现有官方接口 `target_taobao.py`。

## Glossary

- **插件（Extension）**：运行在 Chrome / Edge 的浏览器扩展，负责读取页面并提交数据。
- **小龙虾（Workbench）**：本项目前端（`/dian/`）+ 网关后端（`gate/ecom/`）。
- **RawProduct**：适配器统一商品数据结构，字段见设计稿 4.6（`source_id`/`title`/`price`/`skus`/`images`/`detail` 等）。
- **采集（Collect）**：从 1688 页面读取商品并组装为 RawProduct 的过程。
- **落库（Ingest）**：把小龙虾收到的 RawProduct 写入商品库、SKU 与素材库（复用 `jobs.save_raw_product`）。
- **商品详情页**：URL 形如 `https://detail.1688.com/offer/<offerId>.html`。
- **列表页**：1688 店铺页、搜索结果页、类目页等含多个商品卡片的页面。
- **owner**：商品与任务的数据归属主体，沿用现有按 owner 隔离规则。

## Requirements

### Requirement 1 · 插件安装与站点识别

**User Story:** 作为卖家，我希望在浏览器装一个扩展就能采集 1688 商品，以便不依赖 1688 开放平台。

#### Acceptance Criteria

1. The Extension SHALL 以 Manifest V3 格式发布，并支持 Chrome 与 Edge 的「加载已解压的扩展程序」方式安装。
2. WHEN 用户打开 1688 商品详情页，the Extension SHALL 在页面固定位置显示采集入口。
3. WHEN 用户打开 1688 列表页，the Extension SHALL 在页面固定位置显示批量采集入口。
4. WHEN 用户打开非 1688 页面，the Extension SHALL 隐藏采集入口。

### Requirement 2 · 单商品采集

**User Story:** 作为卖家，我希望在商品详情页一键采集这个商品，以便把它放进小龙虾商品库。

#### Acceptance Criteria

1. WHEN 用户点击单商品采集入口，the Extension SHALL 从当前页面读取商品标题、价格区间、SKU 列表、主图与详情图。
2. WHEN 读取完成，the Extension SHALL 组装为 RawProduct 并提交到小龙虾采集接口。
3. WHEN 小龙虾接受该商品，the Extension SHALL 展示「已入库」状态与商品明细入口。
4. IF 小龙虾返回错误，the Extension SHALL 展示可读的错误原因。

### Requirement 3 · 批量采集

**User Story:** 作为卖家，我希望在一页里批量采集多个商品，以便快速把一个店铺或搜索结果搬进商品库。

#### Acceptance Criteria

1. WHEN 用户在列表页点击批量采集入口，the Extension SHALL 读取当前页所有商品卡片的商品链接。
2. WHILE 批量采集进行中，the Extension SHALL 在列表上逐条标记「已采集 / 采集失败」状态。
3. WHEN 当前页采集完成，the Extension SHALL 汇总成功数与失败数。
4. WHEN 用户切换列表页，the Extension SHALL 允许对新一页继续批量采集。

### Requirement 4 · 采集入库接口

**User Story:** 作为小龙虾，我希望有一个不带 1688 凭证也能写入商品的接口，以便接收插件提交的数据。

#### Acceptance Criteria

1. The 小龙虾 SHALL 提供 `POST /api/ecom/collect/ingest` 接口，接收一个或多个 RawProduct 与平台标识。
2. WHEN 提交的 `source_id` 已存在于商品库，the 小龙虾 SHALL 更新该商品记录并保留其 id。
3. WHEN 提交的 `source_id` 不存在，the 小龙虾 SHALL 新建商品记录并把状态置为 `collected`。
4. The 小龙虾 SHALL 把商品主图与详情图写入素材库，并按图片 URL 哈希去重。
5. IF 提交数据缺少 `source_id` 或 `title`，the 小龙虾 SHALL 返回明确错误且不落任何记录。
6. The 小龙虾 SHALL 对采集接口校验 `owner` 身份。

### Requirement 5 · 图片获取与转存

**User Story:** 作为卖家，我希望采集到的图片在铺货时能被目标平台取到，以便上架不出现空图。

#### Acceptance Criteria

1. The Extension SHALL 读取商品图片的原始地址并提交给小龙虾。
2. WHEN 小龙虾收到商品图片地址，the 小龙虾 SHALL 带正确来源头代理下载图片并缓存到本地。
3. The 小龙虾 SHALL 为缓存的图片提供稳定可访问地址，供目标平台拉取。
4. IF 图片代理下载失败，the 小龙虾 SHALL 记录失败图片地址并保留商品其余字段。

### Requirement 6 · 采集配置与身份

**User Story:** 作为卖家，我希望插件连到我自己的小龙虾并带上身份，以便数据只进我的账号。

#### Acceptance Criteria

1. The Extension SHALL 提供配置项填写小龙虾站点地址与访问口令。
2. WHEN 配置为空，the Extension SHALL 阻止提交并提示先完成配置。
3. The Extension SHALL 在每次提交时携带访问口令，供小龙虾识别 owner。
4. WHEN 访问口令失效，the 小龙虾 SHALL 返回鉴权错误，the Extension SHALL 提示重新配置。

### Requirement 7 · 与现有铺货链路衔接

**User Story:** 作为卖家，我希望插件采来的商品和原来一样能铺货，以便不改变我的操作习惯。

#### Acceptance Criteria

1. WHEN 采集入库成功，the 商品 SHALL 出现在现有「商品库」列表。
2. The 商品 SHALL 支持进入现有「一键铺货向导」并执行预检与发布。
3. The 商品 SHALL 支持现有批量改价、批量上下架与合规检测。

### Requirement 8 · 合规与安全

**User Story:** 作为卖家，我希望采集只动我自己看得到的页面，以便账号安全。

#### Acceptance Criteria

1. The Extension SHALL 仅读取用户当前浏览页面中已渲染的商品数据。
2. The Extension SHALL 使用用户已登录的浏览器会话，不代填账号密码。
3. WHEN 页面数据不完整，the Extension SHALL 跳过缺失字段而不伪造数据。
4. The 小龙虾 SHALL 仅把采集数据写入请求对应的 owner。

### Requirement 9 · 采集状态与重试

**User Story:** 作为卖家，我希望看到采集进度并在失败时重来，以便不漏商品。

#### Acceptance Criteria

1. The Extension SHALL 在批量采集中展示总条数、成功数与失败数。
2. The Extension SHALL 对失败条目提供「重试」操作。
3. IF 网络请求失败，the Extension SHALL 对同一商品重试至多 3 次。

## 已确认决策（2026-09-29）

1. **铺货端形态**：铺货继续走现有淘宝开放平台接口（`target_taobao.py`）；插件本期只负责采集。用户需另建淘宝自用型应用获取 appkey。
2. **采集范围**：单商品 + 当前列表页批量；不自动翻页整店全量。
3. **图片方案**：小龙虾后端带来源头代理下载并缓存，对外提供稳定地址；插件只提交原始图片 URL。
