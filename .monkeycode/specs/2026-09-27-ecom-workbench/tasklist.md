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
- [ ] 3. 任务队列与调度器 `gate/ecom/queue.py`（状态机 + Worker + 定时/分时）
- [ ] 4. 适配器框架 `gate/ecom/registry.py` + `adapters/base.py` + `adapters/mock.py`（统一契约 + 注册表 + 限流 + 错误归一化）
- [ ] 5. 1688 源适配器 `adapters/source_1688.py`（单商品 + 整店）
- [ ] 6. 抖音小店目标适配器 `adapters/target_douyin.py`（类目树/字段映射/发布/改价/上下架）
- [ ] 7. 商品库 + 素材库 UI `ecom-products.js`
- [ ] 8. 一键铺货向导 `ecom-publish.js`
- [ ] 9. 图片工坊基础 `ecom-image.js` + `POST /assets/process`
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
