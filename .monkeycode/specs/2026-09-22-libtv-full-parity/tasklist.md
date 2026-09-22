# 需求实施计划 · 小龙虾完全 LibTV 化

- [x] 1. 画布数据层：多画布与旧数据迁移
   - 在 `src/drama/canvas.js`（现有 `NODE_TYPES`/`ensure`/`addNode` 等）之上补齐多画布接口
   - 对应需求 8、需求 9、需求 14

  - [x] 1.1 在 `src/drama/canvas.js` 实现多画布接口
     - 新增 `listCanvases(p)`、`activeCanvas(p)`、`addCanvas(p, name)`、`removeCanvas(p, cid)`、`renameCanvas(p, cid, name)`、`setActiveCanvas(p, cid)`
     - `ensure(p)` 改为规范化当前画布；`removeCanvas` 在仅剩一张时抛错阻止
     - 参考设计「Components and Interfaces · 4. canvas.js」

  - [x] 1.2 在 `src/drama/project.js` 把工程规范化改为多画布
     - 将 `p.canvas` 单画布结构改为 `p.canvases[]` + `p.activeCanvasId`
     - 保持 `xlx_drama_projects` 存储键与 `all/writeAll/list/get/save` 接口不变
     - 参考设计「Data Models」与 `project.js` 现有规范化逻辑

  - [x] 1.3 实现 `migrate(p)` 旧数据迁移
     - 单画布 → 多画布：把 `p.canvas` 包成 `画布 1` 并写入 `canvases`，删除 `p.canvas`
     - 分镜 → 节点：目标画布无节点且 `p.shots.length` 时，为每个分镜生成文本 + 图片节点并连边，有视频素材时追加视频节点，按网格坐标铺开
     - 保证幂等：已有多画布或已有节点时不重复执行
     - 参考需求 14.2、14.3 与设计 D5

  - [x]* 1.4 编写多画布与迁移单元测试
     - 新增 `tests/canvas-multi.test.js`：增删改切、画布隔离、最后一张保护（设计属性 2、3）
     - 新增 `tests/project-migrate.test.js`：单画布迁移、分镜转节点、重复迁移幂等（设计属性 1、4）
     - 校验设计「Correctness Properties」1、2、3、4
     - 落地：`tests/canvas-multi.test.js` 6 例（默认一张/自动命名、重命名与按 id 查询、删除与最后一张保护、删活动画布后 id 有效、画布隔离、activeCanvasId 悬空回落），对应属性 3；`tests/project-migrate.test.js` 6 例（旧单画布包装、分镜转节点、无内容不建节点、重复迁移幂等、分镜/角色/场景/box3d 数据无损、非对象入参原样返回），对应属性 1、2

- [x] 2. 检查点 - 多画布与迁移测试通过
  - 运行 `node --test tests/*.test.js`，确保所有测试通过,如有疑问请询问用户
  - 结果：单测 126/126 通过；`tests/adapters-http.test.js` 需 `NODE_PATH="$(npm root -g)"`，按约定命令运行 12/12 通过

- [x] 3. 画布节点类型与节点动作扩展
   - 在 `NODE_TYPES` 增加节点类型与动作声明
   - 对应需求 8.4、需求 8.5、需求 10

  - [x] 3.1 在 `src/drama/canvas.js` 追加节点类型
     - 新增 `lipsync`（口型，in `["video","audio"]`，out `video`）与 `asset`（资产，out `image`）
     - 为各类型补 `actions` 声明，至少含 `redraw` 与 `hires`
     - 参考设计「Components and Interfaces · 4. canvas.js」节点类型表

  - [x] 3.2 接线节点动作执行
     - `redraw` 复用既有图片/视频生成链路，`hires` 走高清处理链路
     - 失败时写回 `node.status="failed"` 与 `node.error`，不清空既有素材
     - 参考需求 10.3、设计「Error Handling」
     - 落地：`NODE_TYPES[t].actions` + `actionNode(p,nid,action)`；`hires` 经 `adapters.js` 的 `hiresRatio/hiresSize` 放大尺寸（上限 4096），视频强制 1080p；新增 `lipsync` 生成分支与 `asset` 节点（`bind` 引用资产）
     - 偏差：设计表 `lipsync.multi` 由 false 改为 true（口型需同时接视频与人声两个入边），已同步 design.md

  - [x]* 3.3 扩展画布单元测试
     - 在 `tests/canvas.test.js` 覆盖新节点类型连线规则与动作声明
     - 校验设计属性 4（连线合法）
     - 落地：`tests/canvas.test.js` 覆盖七类节点与 `redraw`/`hires` 动作声明；`tests/canvas-multi.test.js` 覆盖多画布下节点与视图隔离；连线合法性（属性 4）另由 `tests/drama-e2e.js` 的连边断言交叉校验

- [x] 4. LibTV 外壳与路由
   - 重建左侧导航、顶部状态条与视图路由
   - 对应需求 1、需求 2、需求 3

  - [x] 4.1 新建 `src/drama/shell.js`
     - 实现 `NAV` 导航定义（新建项目 / Agent / 首页 / 项目 / 资产 / TV Show / 模板排行 / 3D-BOX / 插件）
     - 实现 `mount(container)`、`setActive(id)`、`status()`
     - `status()` 读取钥匙库与模型目录，渲染「钥匙 x/y + 模型 N」，点击跳设置页
     - 参考需求 1.2、1.3、2.1、2.2、2.3
     - 落地：`XLX.dramaShell`（别名 `XLX.shell`），`mount` 渲染侧栏导航、顶部 `#shellStatus` 状态胶囊与 `#shellTop` 账号菜单；`status().keyText/modelText` 走 `XLX.vendorKeys` 与 `XLX.catalog.KINDS`，读取失败降级为 0 不阻塞

  - [x] 4.2 改造 `index.html` 外壳与路由
     - 更新主题变量为 LibTV 深色工作室风（底色 `#161616`、面板 `#1e1e1e`、主色 `#22d3ee`、青底黑字胶囊主按钮）
     - 调整两栏骨架为导航 240px + 内容区，新增各新视图容器 id
     - 更新 `VIEWS`（`index.html:4315`）与 `names` 元数据表，`go(view)` 调用 `shell.setActive`，未知视图回退首页
     - 不呈现底部礼遇卡
     - 参考需求 1.1、1.4、1.6、设计「Components and Interfaces · 2/3」
     - 落地：`VIEWS=["agent","home","projects","assets","tvshow","ranking","box3d","plugin","studio","tools","memory","download","settings","drama"]`；新增 `COMPAT`（chat→agent、market→home、dramaHome→projects、makeup→assets、auto→tvshow）与 `VIEW_EL`（agent 复用 `agentView`）；容器 `homeView/projectsView/assetsView/tvshowView/rankingView/box3dView/pluginView` 就位；删除底部礼遇卡（原 side-foot/dl-btn）
     - 过渡接线：`projects`→`home.js`、`assets`→`makeup.js`、`tvshow`→`auto.js` 复用现有模块；`home/ranking/box3d/plugin` 暂为空态占位，待任务 6/8 落地

  - [x] 4.3 把设置 / 记忆 / 下载收进顶部账户菜单
     - 主导航移除这三项，账户菜单提供入口并复用原视图
     - 参考需求 2.4
     - 落地：`#shellTop` 账号胶囊 + 下拉（设置 / 记忆习惯 / 下载客户端），三视图容器与渲染器原样保留

  - [x] 4.4 实现小屏抽屉导航
     - 视口小于 900px 时导航收起为可展开抽屉
     - 参考需求 1.5
     - 落地：沿用既有 `@media(max-width:900px)` 侧栏抽屉与 `#menuBtn/#sidebarMask`，底部导航项更新为 Agent/首页/项目/资产/插件

  - [x]* 4.5 编写外壳测试
     - 新增 `tests/shell.test.js`：导航项集合、选中态唯一、未知视图回退
     - 校验设计属性 5、6
     - 落地：`tests/shell.test.js` 9 例（NAV/ACCOUNT 定义、挂载渲染主按钮与导航项、选中态唯一与未知清除、默认按当前视图选中、钥匙/模型统计、读取失败降级为 0、refresh 只改文本不重建 DOM、未知视图回退首页、旧标识 COMPAT 映射）；路由用例从 `index.html` 提取 `XLX.app` 闭包实测

- [x] 5. 检查点 - 外壳与路由测试通过
  - 运行 `node --test tests/*.test.js`，确保所有测试通过,如有疑问请询问用户
  - 结果：单测 126/126（连跑 15 次无抖动）；契约 12/12；e2e 215/215 通过
  - 附带修复：`canvas.js` `normalizeCanvas` 原每次归一化都刷新 `updatedAt`，导致 `project.migrate` 幂等断言随毫秒抖动（历史偶发失败）；改为仅缺失时补时间戳，写操作各自更新时间

- [x] 6. 视图拆分与新建
   - 按 LibTV 导航拆分与新建各页视图
   - 对应需求 4、需求 5、需求 6、需求 7、需求 12、需求 13

  - [x] 6.1 新建 `src/drama/projects.js`（项目页）
     - 从 `home.js` 抽出工程网格，补顶部工具行、回收站、新建文件夹、工程卡画布数
     - 首张卡为「开始创作」，空态展示新建卡
     - 参考需求 6.1 至 6.8

  - [x] 6.2 重写 `src/drama/home.js`（首页 Skill 墙）
     - 居中标题 + 灵感输入框（含图标与发送按钮）+ 分栏（推荐 / 收藏 / 我的）+ 分类条 + 搜索框
     - 三列 Skill 卡：缩略图、视频/图片角标、标题、描述、作者（缺省「小龙虾官方」）
     - 分类映射技能清单 `cat` 字段；提交灵感或点选 Skill 时建工程 + 按 Skill 铺首节点 + 发起生成
     - 参考需求 5.1 至 5.7 与设计 D3、D7

  - [x] 6.3 新建 `src/drama/assets.js`（资产页）
     - 承载原造型室三视图 / 场景卡 / 多参考，资产卡片网格 + 类型筛选
     - 支持画布节点引用所选资产作为参考
     - 参考需求 7.1 至 7.3

  - [x] 6.4 新建 `src/drama/tvshow.js`（成片库）
     - 成片卡片网格（封面 / 标题 / 时间），空态给「去流水线创作」入口
     - 参考需求 12.1、12.2

  - [x] 6.5 新建 `src/drama/ranking.js`（模板排行）
     - 排行榜列表（名次 / 标题 / 来源），数据取技能清单与 `templates.js`
     - 点击排行项以该项启动创作并进入画布
     - 参考需求 12.3 至 12.5

  - [x] 6.6 新建 `src/drama/plugin.js`（插件页）
     - 聚合软件工坊 / 工具箱 / 客户端下载三个入口，复用原能力与存储键
     - 参考需求 13.1 至 13.3

  - [x] 6.7 把 Agent 视图接入外壳
     - 原对话引擎容器归入 `agent` 视图，保留消息流、模型切换、清空与软件操作卡片
     - 原技能市场数据迁移至首页 Skill 墙
     - 参考需求 4.1 至 4.3、需求 14.4、14.5

  - 落地说明：`projects.js`（工具行含返回/搜索/回收站/新建文件夹、文件夹分组、工程卡画布数与首张新建卡、`data-pj-*` 事件）、`home.js`（居中标题+灵感输入+推荐/收藏/我的+9 项分类条+搜索+三列 Skill 卡）、`assets.js`（委托 `D.makeup`）、`tvshow.js`（成片库 + 去流水线创作）、`ranking.js`（技能与题材模板排行，点选即建工程）、`plugin.js`（软件工坊/工具箱/客户端下载三入口）均已新建并接入 `index.html` 的 `renderView`；`shell.js` 的 `#shellCreate` 改调 `D.projects.newProject()`。
  - 落地说明（视图容器调整）：原 `auto` 视图无独立容器，与 `tvshow` 共用 `#dwAuto`，两模块互相覆盖。新增 `autoView`（`#dwAuto`）承载流水线工作台，`tvshowView` 改用 `#dwTvshow` 承载成片库；`VIEWS` 补 `auto`，`COMPAT.auto` 改为恒等。
  - 验证：单测 126/126、契约 12/12、e2e 232/232；jsdom（HTTP origin，含真实脚本顺序）冒烟：首页/项目/资产/成片库/排行/插件渲染无报错，`shellCreate`→建工程进画布，点选 Skill→建工程+文本/图片节点+连线，`tvNew`→`autoView` 载入流水线。

- [x] 7. 画布工作台改造
   - 把 `src/drama/manual.js` 从三态导演台改为 LibTV 画布宿主
   - 对应需求 8、需求 9、需求 10

  - [x] 7.1 移除故事板范式，重建画布宿主骨架
     - 删除 `mode` 三态与分镜列表 / 时间轴 / 属性面板三栏布局
     - 新骨架：顶栏 + 画布 + 右侧详情面板 + 底部浮动工具条
     - 参考需求 8.1 至 8.3、设计 D5 与「Components and Interfaces · 5」

  - [x] 7.2 实现顶栏
     - 左侧工程下拉、画布下拉（多画布）、缩放控件、面板开关；右侧分享、历史、状态条
     - 参考需求 8.2、9.1、9.4、9.5、需求 2.4

  - [x] 7.3 详情面板承载逐镜精修字段
     - 覆盖提示词、台词、运镜、时长、入点、出点
     - 参考需求 10.1

  - [x] 7.4 视频节点内容区逐帧与入出点
     - 播放、暂停、逐帧前后、入出点设置
     - 参考需求 10.2

  - [x] 7.5 节点「尝试」动作区与画布工具条
     - 渲染 `redraw`/`hires` 动作；工具条提供添加节点、生成、合成导出
     - 参考需求 8.5、8.7、10.5

- [x] 8. 3D-BOX 独立页
   - 把 `box3d.js` 提为导航独立页并解决上下文
   - 对应需求 11

  - [x] 8.1 实现 3D-BOX 页面壳与工程选择器
     - 页内自选工程，呈现多机位 / 大师运镜 / 灯光相机 / 多角度 / 精准编辑五项工具
     - 参考需求 11.1、11.2 与设计 D6

  - [x] 8.2 结果写回工程
     - 3D-BOX 产出写入所选工程，可回画布查看
     - 参考需求 11.3

- [x] 9. 检查点 - 全量回归
  - 运行 `node --test tests/*.test.js`、`NODE_PATH="$(npm root -g)" node --test tests/adapters-http.test.js`、`NODE_PATH="$(npm root -g)" node tests/drama-e2e.js`、`cd gate && python3 -m unittest test_gate`，确保所有测试通过,如有疑问请询问用户
  - 结果：单测 159/159、契约 12/12、e2e 241/241、gate 52/52 全通过；新增 `tests/dom-env.js` 统一解析 jsdom（本地依赖缺失时回退全局安装目录），上述命令无需 `NODE_PATH` 亦可直接运行

- [x] 10. 端到端联调与旧数据兼容
   - 覆盖新导航与主链路，验证旧工程不丢数据
   - 对应需求 14

  - [x] 10.1 更新 `tests/drama-e2e.js`
     - 覆盖 首页→新建→画布→出片 主链路与旧工程迁移后打开
     - 参考需求 14.1 至 14.3

  - [x] 10.2 迁移旧对话 / 软件工坊 / 工具箱数据并验证
     - 校验旧存储键在新入口下正常呈现
     - 参考需求 14.4、14.5
