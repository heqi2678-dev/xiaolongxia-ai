# 电商工作台 · 实施任务清单（tasklist）

来源：`落点清单与一期拆解.md` + `电商工作台-整体布局与设计.md`。
规则：一次做一项，测试全绿再勾选并提交；提交前跑单测 + e2e + 网关。

## 一期 MVP

- [x] 1. 分区骨架与切换器（前端结构）
  - [x] 1.1 新建 `src/drama/ecom/ecom.js`（分区注册、导航、切换）
  - [x] 1.2 新建 `src/drama/ecom/ecom-css.js`（分区样式）
  - [x] 1.3 `shell.js` NAV 支持分区归属 + 切换器渲染
  - [x] 1.4 `index.html` 追加 10 个 ecom 视图键、容器、脚本注册、顶栏文案、移动导航按分区取项
  - [x] 1.5 10 个视图占位空态
  - [x] 1.6 e2e 断言可分区分切换
- [x] 2. 后端数据层 `gate/ecom/store.py`（建表 + DAO：products/skus/media/shops/shop_groups/tasks/task_items/mappings/price_rules/pacing/compliance_reports）
- [x] 3. 任务队列与调度器 `gate/ecom/queue.py`（状态机 + Worker + 定时/分时）
  - 状态机对齐设计稿 7.1：`scheduled → queued → running → paused / succeeded / partial / failed`（取消为 `canceled`）
  - 定时（`schedule.at` / `run_after` / `schedule.window`）与分时（`pacing` 日限 / 间隔 / 时段）
  - 重试仅重置失败项，已成功项不重复执行（7.3 / 7.5）
- [x] 4. 适配器框架 `gate/ecom/registry.py` + `adapters/base.py` + `adapters/mock.py`（统一契约 + 注册表 + 限流 + 错误归一化）
  - `registry.py`：`Registry` 可注入注册/取用、`EcomError` 归一化（8 类 + 可重试判定）、`RateLimiter`（QPS + 日配额）
  - `adapters/base.py`：`SourceAdapter`/`TargetAdapter` 基类 + `assert_source_contract`/`assert_target_contract` 契约自检
  - `adapters/mock.py`：确定性 mock 源/目标适配器，可注入失败验证错误归一化
- [x] 5. 1688 源适配器 `adapters/source_1688.py`（单商品 + 整店）
  - AOP 签名、offerId 解析、商品/SKU/主图/详情映射、整店分页、错误归一化
  - 凭证走 `ECOM_1688_*` 环境变量；transport 可注入，真机待 appkey 冒烟
- [x] 6. 抖音小店目标适配器 `adapters/target_douyin.py`（类目树/字段映射/发布/改价/上下架）
  - 类目级联树、关键词匹配取叶子、价格转分、发布/改价/上下架/列表、签名与限流接入
  - 凭证走 `ECOM_DOUYIN_*`，店铺 token 经 `shop_auth`；真机待资质，接口名与签名待冒烟校准
- [x] 7. 电商后端 API 路由层 `gate/ecom/api.py` + `server.py` 挂载（设计稿 8 · `/dian/api/ecom/*`）
  - `/collect`、`/collect/{taskId}`、`/products`、`/products/{id}`（GET/PATCH）、`/products/batch`、`/assets/process`
  - `/generate`、`/publish/precheck`、`/publish`、`/price/adjust`、`/listing/batch`、`/compliance/check`
  - `/shops`、`/shops/{id}`、`/shops/auth`、`/shop-groups`、`/tasks`、`/tasks/{id}`、`/tasks/{id}/retry`、`/tasks/{id}/pause`、`/stats`
  - 纯函数路由 `handle(method, path, owner, query, body) -> (status, payload)`，同源 JSON，错误 `{error, code}`；owner 复用 gate 会话
  - `gate/ecom/jobs.py` 注册 collect/publish/price_adjust/listing/assets/generate/compliance 处理器，并安装 mock（真机按 `ECOM_1688_*`/`ECOM_DOUYIN_*` 凭证注册）
  - `store.py` 增 `listings` 表（商品 × 店铺 → remote_id，铺货幂等）；`server.py` 增 do_PATCH/do_DELETE 与 `/api/ecom/*` 挂载
- [x] 8. 首页 + 采集视图 `ecom-home.js`、`ecom-collect.js`（`/collect`、`/collect/{taskId}`）
  - 首页：五个能力卡（采集/图片工坊/AI 创作/搬家铺货/合规）、四个概览数字（商品/素材/店铺/已上架）、待办任务、最近采集铺货（读 `/stats`+`/shops`+`/tasks`）
  - 采集下载：链接采集 / 整店采集切换、源平台选择、提交 collect 任务、进度轮询、采集结果表、失败项重试、最近采集
  - `ecom.js` 增共享通道与状态：`api`/`toast`/`go`/`fmtTime`、分区级选择集 `STATE`/`setSelection`/`toggleSelection`、任务与平台文案映射
  - 测试：`tests/ecom.test.js`（5 项）、e2e 链路七扩至电商首页+采集视图
- [x] 9. 商品库 + 素材库 UI `ecom-products.js`（`/products`、`/products/{id}`、`/products/batch`）
  - 商品库：关键词/来源/状态/排序筛选、分页列表、全选清空、批量编辑（类目/状态/标签）、详情面板（基本信息编辑、SKU 增删改、素材预览、合规结论、版本记录）
  - 素材库：类型/来源/关联商品筛选、素材网格（缩略图/尺寸/来源/关联商品）、选择集带入图片工坊批处理
  - 后端补齐：`GET /assets`（按 kind/product_id/source 筛选分页）、商品详情响应增 `versions`
  - 测试：`tests/ecom.test.js` 扩到 8 项、e2e 链路七扩至商品库与素材库、`test_ecom` 增 2 项
- [x] 10. 一键铺货向导 `ecom-publish.js`（`/publish/precheck`、`/publish`、`/listing/batch`）
  - 五步向导：选品（商品筛选/选择集带入）→ 选店（授权校验/店群标签）→ 策略（类目/标题前后缀/价格公式/上架节奏）→ 预检（类目/标题/主图/价格/合规四维结论）→ 提交（商品×店铺去重回执）
  - 上架节奏：立即 / 定时（schedule.mode=at）/ 分时（schedule.mode=recurring + window）
  - 批量上下架页签（`/listing/batch`）与铺货记录页签（`/tasks?kind=publish`）
  - 测试：`tests/ecom.test.js` 增 1 项、e2e 扩铺货向导全流程
- [x] 11. 图片工坊 `ecom-image.js` + `POST /assets/process`（参照 HookShot，见 `hookshot-reference.md`）
  - 主图制作：白底图、卖点图、细节图、尺寸图、使用场景图、场景渲染图、营销海报、商品套图
  - 详情页：详情长图生成、图片复刻（选长图模板）
  - 操作流：上传 → 配方/模板 → 平台与分辨率/宽高比（分辨率对照表）→ 批量提交 → 预览/下载
  - 素材沉淀「我的素材」、任务落「任务中心」
  - 后端 `gate/ecom/imaging.py`：配方/处理器/分辨率对照表；`assets_handler` 派生 `edit` 素材（按来源+配方+尺寸哈希幂等）；`POST /assets/process` 支持 `sync` 内联返回；`GET /assets/recipes` 下发配方表
  - 短视频带货制作归二期「AI 创作」（`ecom-ai`），参照 HookShot `/video-agent`
  - 测试：`gate/test_ecom.py` 增 4 项、`tests/ecom.test.js` 增 1 项、e2e 扩图片工坊全流程
- [x] 12. 批量改价 `ecom-publish.js` + `/price/adjust`
  - 页签：批量改价（商品库价格 / 已上架价格两种范围，后者需选店铺）
  - 公式：固定加价 / 按比例 + 尾数规则（不处理/向上/向下/尾数 .9）+ 最低售价
  - 节奏：立即 / 定时（schedule.mode=at）/ 分时（schedule.mode=recurring + window）
  - 测试：`tests/ecom.test.js` 增 1 项、e2e 扩改价页签与任务号回显
- [x] 13. 任务中心 UI `ecom-tasks.js`（`/tasks`、`/tasks/{id}`、`/tasks/{id}/retry`、`/tasks/{id}/pause`）
  - 类型/状态过滤 + 分页；任务进度条与状态徽标
  - 详情面板：逐项明细（对象 / 状态 / 尝试次数 / 错误）+ 失败重试 + 执行中暂停
  - 测试：`tests/ecom.test.js` 增 1 项、e2e 扩任务中心列表/明细/重试
- [x] 14. 店铺与授权 `ecom-shops.js`（`/shops`、`/shops/{id}`、`/shops/auth`、`/shop-groups`）
  - 分组列表 + 新建分组；店铺列表（平台 / 分组 / 授权状态徽标）按分组筛选
  - 接入店铺表单；粘贴 access_token 提交授权；删除店铺
  - 测试：`tests/ecom.test.js` 增 1 项、e2e 扩店铺/分组/授权面板
- [x] 15. 合规检测 `ecom-compliance.js` + `/compliance/check`
  - 目标平台选择、同步/异步运行；verdict 汇总（通过/警告/拦截）
  - 报告按商品展示命中词（违禁词/品牌词/B 端词），可跳任务中心
  - 测试：`tests/ecom.test.js` 增 1 项、e2e 扩检测运行与命中明细
- [x] 16. 测试收口（`tests/ecom.test.js`、`tests/drama-e2e.js`、`gate/test_ecom.py`）
  - 前端单测：电商视图 15 项（含「10 视图均可渲染 + 导航/标题对齐」收口用例），全量 `tests/*.test.js` 214 项
  - e2e：`tests/drama-e2e.js` 链路七覆盖 10 视图（含 AI 创作占位），全量 363 项
  - 网关单测：`gate/test_ecom.py` 107 项 + `gate/test_gate.py` 56 项
  - 注：电商 e2e 已并入 `tests/drama-e2e.js`（未单独新建 `tests/ecom-e2e.js`）

## 二期（暂缓）

- [ ] 淘宝/拼多多源采集
- [x] 淘宝指向铺货（2026-09-28 提前完成，见下）
- [ ] 拼多多/快手指向铺货
- [ ] AI 创作接入
- [ ] 店群聚合增强

### 淘宝目标适配器（提前落地）

用户实际经营淘宝，故把二期的淘宝铺货提前到一期完成：

- `gate/ecom/adapters/target_taobao.py`：淘宝开放平台（TOP）适配器，覆盖类目树（`taobao.itemcats.authorize.get`，扁平列表按 `parent_cid` 还原为树）、字段映射、发布（`taobao.item.add`）、改价（`taobao.item.update`，价格用元、两位小数）、上下架（`taobao.item.update.listing`/`delisting`）、在售列表（`taobao.items.onsale.get`）。
- 签名 `top_sign`：TOP md5（`MD5(secret+串+secret)` 大写），另支持 `hmac`。
- 注册：`jobs.ensure_adapters()` 检测到 `ECOM_TAOBAO_APPKEY` 即注册 `taobao` 目标平台。
- 测试：`gate/test_ecom.py::TaobaoTargetTest` 12 项（含契约自检与错误归一化）；真机契约自检由 `base.assert_target_contract` 覆盖。
- 前端无需改动（平台键 `taobao` 已在 `ecom.js`/`ecom-shops.js`/`ecom-compliance.js` 中就位）。
- 待真机校准：图片空间上传（`pic_path` 外链 vs `taobao.picture.upload`）、类目属性 `prop`、发货地址 `location`。

## 待确认（开工前拍板）

- [x] 切换器形态（顶部 Tab / 侧栏下拉）→ 定为侧栏品牌下方分区切换器（短剧/电商两枚按钮）
- [x] 电商数据归属（仅 owner / 按房间）→ 定为仅按 owner 隔离（维持现状，13 表均带 owner 列）
- [x] 后端形态（并入 gate / 独立服务）→ 定为并入 gate（`gate/ecom/` 包 + `/api/ecom/*`，随 `xiaolongxia-gate.service` 启停）
- [x] 平台 appkey 到位时间（决定适配器先 mock 还是真机）→ 用户自行对接；mock 始终可用，真机按凭证存在与否自动启用（操作指引见下）
- [x] 图片工坊参照物 hookshot：`https://www.hkshot.com/`（HookShot 霍客引擎，路由与工具清单见 `hookshot-reference.md`）

## 真机对接指引（1688 / 淘宝 / 抖店）

目标：拿到 appkey/secret 后，让适配器从 mock 切到真机，无需改代码。

### 1. 需要的凭证（按平台配置，未申请的可留空）

| 平台 | 变量 | 说明 |
|------|------|------|
| 1688（采集源） | `ECOM_1688_APPKEY` | 开放平台应用 AppKey |
| 1688 | `ECOM_1688_APPSECRET` | 应用 AppSecret（签名用） |
| 1688 | `ECOM_1688_ACCESS_TOKEN` | 店铺/用户授权令牌 |
| 淘宝（铺货目标） | `ECOM_TAOBAO_APPKEY` | 淘宝开放平台 AppKey |
| 淘宝 | `ECOM_TAOBAO_APPSECRET` | 淘宝 AppSecret（签名用） |
| 抖音小店（可选） | `ECOM_DOUYIN_APPKEY` | 抖店应用 AppKey |
| 抖音小店 | `ECOM_DOUYIN_APPSECRET` | 抖店应用 AppSecret |
| 各平台 | `ECOM_*_BASE_URL`（可选） | 默认官方网关，一般不用改 |

### 2. 申请入口

- 1688 开放平台：注册企业开发者 → 创建应用 → 申请「商品/店铺」API 权限 → 审核通过后拿到 AppKey/AppSecret。
- 淘宝开放平台：以淘宝卖家账号 + 营业执照创建应用 → 申请「商品发布/商品管理/类目」权限 → 拿到 AppKey/AppSecret。
- 抖音开放平台（抖店）：入驻抖店 → 创建自用型应用 → 申请「商品/订单/物流」等权限 → 拿到 AppKey/AppSecret。

### 3. 配置到服务（已预置，只需填一个文件）

服务器上只需编辑一个文件：

```bash
sudo nano /home/admin/work/xiaolongxia-gate-data/ecom.env
```

把等号后面填上你的值（没申请到的平台可留空）：

```bash
ECOM_1688_APPKEY=你的1688应用Key
ECOM_1688_APPSECRET=你的1688应用密钥
ECOM_1688_ACCESS_TOKEN=你的1688授权令牌
ECOM_TAOBAO_APPKEY=你的淘宝应用Key
ECOM_TAOBAO_APPSECRET=你的淘宝应用密钥
```

保存后重启服务（systemd 已通过 drop-in 自动加载该文件）：

```bash
sudo systemctl restart xiaolongxia-gate.service
sudo systemctl status xiaolongxia-gate.service
```

### 4. 验证是否启用真机（一条命令）

```bash
cd /home/admin/work/xiaolongxia-ai/gate
python3 -m ecom.smoke_cli
```

输出会打印每个变量「已配置 / 未配置」以及「真机已启用: 1688, taobao」。带商品/类目冒烟：

```bash
python3 -m ecom.smoke_cli --offer https://detail.1688.com/offer/替换为真实offerId.html
python3 -m ecom.smoke_cli --taobao
```

`jobs.ensure_adapters()` 按凭证存在与否注册：只要 `ECOM_1688_APPKEY` / `ECOM_TAOBAO_APPKEY` / `ECOM_DOUYIN_APPKEY` 存在，对应平台适配器即自动启用，未配置的平台继续走 mock。

### 5. 校准点（真机链路已知待校准）

- 1688 AOP 签名拼接顺序与请求头格式；
- 淘宝 `pic_path` 外链 vs 图片空间上传、类目属性 `prop`、发货地址 `location`；
- 抖店接口名、参数名与价格单位（分/元）、类目树层级；
- 各平台限流阈值（QPS / 日配额）与错误码映射到现有 8 类错误。

真机接口名与签名规则待冒烟时按官方文档校准；校准只改 `gate/ecom/adapters/` 下的适配器文件，API 层与前端无需改动。
