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
- [ ] 15. 合规检测 `ecom-compliance.js` + `/compliance/check`
- [ ] 16. 测试收口（`tests/ecom.test.js`、`tests/ecom-e2e.js`、`gate/test_ecom.py`）

## 二期（暂缓）

- [ ] 淘宝/拼多多源采集
- [ ] 淘宝/拼多多/快手指向铺货
- [ ] AI 创作接入
- [ ] 店群聚合增强

## 待确认（开工前拍板）

- [x] 切换器形态（顶部 Tab / 侧栏下拉）→ 定为侧栏品牌下方分区切换器（短剧/电商两枚按钮）
- [ ] 电商数据归属（仅 owner / 按房间）
- [ ] 后端形态（并入 gate / 独立服务）
- [ ] 平台 appkey 到位时间（决定适配器先 mock 还是真机）
- [x] 图片工坊参照物 hookshot：`https://www.hkshot.com/`（HookShot 霍客引擎，路由与工具清单见 `hookshot-reference.md`）
