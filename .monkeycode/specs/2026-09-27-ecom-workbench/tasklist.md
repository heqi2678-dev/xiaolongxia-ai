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
- [ ] 7. 商品库 + 素材库 UI `ecom-products.js`
- [ ] 8. 一键铺货向导 `ecom-publish.js`
- [ ] 9. 图片工坊 `ecom-image.js` + `POST /assets/process`（参照 HookShot，见 `hookshot-reference.md`）
  - 主图制作：白底图、卖点图、细节图、尺寸图、使用场景图、场景渲染图、营销海报、商品套图
  - 详情页：详情长图生成、图片复刻（选长图模板）
  - 操作流：上传 → 配方/模板 → 平台与分辨率/宽高比（分辨率对照表）→ 批量提交 → 预览/下载
  - 素材沉淀「我的素材」、任务落「任务中心」
  - 短视频带货制作归二期「AI 创作」（`ecom-ai`），参照 HookShot `/video-agent`
- [ ] 10. 批量改价 `ecom-publish.js` + `/price/adjust`
- [ ] 11. 任务中心 UI `ecom-tasks.js`
- [ ] 12. 合规检测 `ecom-compliance.js` + `/compliance/check`
- [ ] 13. 测试收口（`tests/ecom.test.js`、`tests/ecom-e2e.js`、`gate/test_ecom.py`）

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
- [ ] 图片工坊参照物 hookshot：仓库/文档/截图来源（当前工作区与服务器均未找到该参照物）
