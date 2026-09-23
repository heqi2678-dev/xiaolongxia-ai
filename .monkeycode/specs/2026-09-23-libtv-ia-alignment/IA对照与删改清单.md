# 完全 LibTV 化 · 信息架构对照与删改清单

基准：libtv.ai 实站（2026-09-23 抓取）。目标：短剧侧完全对齐 LibTV；LibTV 没有的短剧遗留物删除；非短剧模块（工具包、软件工坊、工具箱、记忆、下载）不动。

## 一、LibTV 实站信息架构（已核实）

左侧导航（自上而下）：

1. 新建项目（青底黑字主按钮）
2. LibTV Agent
3. 首页
4. 项目
5. 资产
6. TV Show（角标：全网爆款）
7. 创作者挑战赛（角标：王者大赛）
8. ——分隔线——
9. LibTV 3D-BOX
10. Blender 插件（副标题：LibTV Plugin）
11. 版本更新记录

首页分区：

- 顶部商业横幅（双节礼遇 / 会员 / 积分）
- 新建画布创作（大虚线卡）+ 模型工具行（9 项）：Minimax H3 Max / Wan 3.0 / Seedance 2.5 / 视频生成 / 图片生成 / 音频生成 / 剧本生成 / 智能剪辑 / 更多功能
- 最近上新（Skill 卡，带「独家」胶囊）：剧本原创与改编 / 导演执导 / 角色造型室 / 创意片头 / 王者荣耀联名投稿活动（进行中）
- TV Show 预览：全部 / 全网百万赞作品「去 TV Show 看看」

账号区：顶部右侧（我的 / 账号与设置）。

## 二、逐项落点与处置

| LibTV | 实站细节 | 小龙虾现状 | 处置 |
|---|---|---|---|
| 新建项目 | 主按钮 | `shell.js:6` `shellCreate` → `projects.newProject` | 保留，已对齐 |
| Agent | LibTV Agent | `shell.js:7` label「铜龙电商 Agent」 | 保留，已对齐 |
| 首页 | 见首页分区 | `home.js`：hero + 工具行(8) + 最近项目 + 最近上新(1) | 部分对齐，见下 |
| 项目 | 工程网格 | `projects.js` | 保留，已对齐 |
| 资产 | 角色/主体/场景/风格资产 | `assets.js` 委托 `makeup`（三视图/场景卡/多参考） | 保留；分类条待补（见问题 4） |
| TV Show | 全网爆款成片库 | `tvshow.js` | 保留，已对齐 |
| 创作者挑战赛 | 王者大赛 | `ranking.js`，label 已对齐 | 保留 |
| 3D-BOX | LibTV 3D-BOX | `box3dview.js` 五工具面板 | 保留，已对齐 |
| Blender 插件 | 插件下载落地页 | `plugin.js` 现聚合「软件工坊/工具箱/客户端下载」 | 重新定位：改为 Blender 插件页；三入口移出（见问题 5） |
| 版本更新记录 | 更新日志 | 无 | 新增（见问题 3） |
| 首页·模型工具行 | 9 项，含「更多功能」 | `home.js:8` TOOLS 8 项，文案简化（视频/图片/音频） | 补「更多功能」，文案对齐「…生成」 |
| 首页·最近上新 | 5 张独家 Skill 卡 + 活动 | `home.js:114` 仅 1 张「全网爆款成片库」 | 重做为 5 张卡，绑 Skill 引擎 |
| 首页·商业横幅 | 会员/积分/礼遇 | 无（`shell.js` 顶部「钥匙 x/y + 模型 N」胶囊） | 状态胶囊上移首页顶部（非商业） |
| 账号区 | 我的/账号与设置 | `shell.js:20` ACCOUNT=设置/记忆习惯/下载客户端 | 保留非短剧项 |

## 三、短剧遗留物（LibTV 无）——待删清单

| # | 对象 | 证据 | 说明 | 风险 |
|---|---|---|---|---|
| D1 | 画布「故事板」双视图 | `manual.js:143-145` 开关、`manual.js:186` `applyMode`、`manual.js:196` 挂载 `D.storyboard`、`src/drama/storyboard.js`(168行) | LibTV 只有节点画布，无故事板列表视图。item 3 刚做，建议移除视图形态，脚本生成能力改由 Skill 承担后删模块 | 中（需确认） |
| D2 | `auto` 流水线工作台 | `src/drama/auto.js`(622行)、`index.html:4446`、被 `tvshow.js:81`/`projects.js:288` 打开 pipeline 工程 | LibTV 无步骤式流水线页，能力应由画布 + 智能剪辑承担。下线后需把 pipeline 工程转为画布打开 | 高（改动面大） |
| D3 | `timeline.js` 时间轴 | `src/drama/timeline.js`(154行)；`rg` 显示除自身 `D.timeline` 定义外无任何引用 | 已无视图接线，死代码 | 低 |
| D4 | `guide.js` 新手引导 | `src/drama/guide.js`(264行)；入口 `auto.js:127`、`manual.js:658`、`settings.js:157` | LibTV 无独立引导浮层 | 低 |
| D5 | 首页旧「全网爆款成片库」单卡 | `home.js:114-121` | 被新 5 卡替换 | 低 |
| D6 | Agent 空态失效建议卡 | `index.html:4544-4554`（含「生成分镜脚本」指向 storyboard） | 非短剧，但失效项要清；其余属 agent 空态，保留 | 低 |
| D7 | 品牌命名 | 全仓「铜龙电商」，LibTV 对应「LibTV」 | 短剧工作台品牌名待定 | 待定 |

非短剧、**保留不动**：`studio.js`(软件工坊)、`tools`(工具箱)、`memory`、`download`、`toolkit.js`(工具包)、Agent 对话、`compliance.js`(合规，LibTV 亦有)、`takes.js`(Take/分段引擎，被 engine/compose/project 依赖)、`character.js`/`makeup.js`/`engine.js` 等核心链路。

## 四、待确认问题

1. D1 故事板双视图是否移除（LibTV 纯节点画布）？
2. D2 `auto` 流水线页是否下线，pipeline 工程统一转画布打开？
3. 「版本更新记录」是否需要？数据源可用 git log 或静态 changelog。
4. 资产页是否需要补 LibTV 式分类（角色 / 主体 / 场景 / 风格）？
5. Blender 插件页是否改为纯插件落地页，把软件工坊/工具箱/客户端下载移回账号菜单或工具包？
6. 品牌名统一为「铜龙电商」还是改回短剧向命名？

确认以上后按批次开工，每批测试全绿再回推提交。

## 五、决策与落实进度（2026-09-23）

用户拍板：D1 移除、D2 下线、Q3 新增（静态 changelog）、Q4 补齐、Q5 保持现状（用户认为插件页已对齐 LibTV）、Q6 统一「铜龙电商」。

已完成（单测 188 全绿 / e2e 271 全绿）：

- D1 故事板双视图：`manual.js` 已移除模式开关、`applyMode/setMode/#dwStoryHost/#dwModeSw` 与故事板分支；`storyboard.js` 及 `storyboard.test.js` 已删除。
- D2 `auto` 流水线页：`auto.js` 已删除；`index.html` 路由/视图/脚本标签移除 `auto`；`tvshow.js` 改为「有出片产物」筛成片库 + 「去画布创作」，打开走画布；`projects.js` 打开工程统一进导演台；`settings.js` 去掉「看教程」按钮与半自动台文案。
- D3 `timeline.js` 已删；`code` 引用清零；`drama.test.js` 时间轴用例改测 `project.effDuration`。
- D4 `guide.js` 已删；`manual.js`/`settings.js`/`auto.js` 入口清零。
- D5 首页「最近上新」重做为独家 Skill 卡（`D.skill.all()`，默认 `director-shots`/`script-studio`/`title-intro`）；工具行补第 9 项「更多功能」（跳工具包），文案对齐「…生成」；新增成片库横幅。
- Q3 新增 `src/drama/changelog.js` + 导航「版本更新记录」+ `index.html` 视图。
- Q4 资产页分类条：造型室 TABS 改为 角色 / 主体 / 场景 / 风格，新增「风格」画风预设面板（写 `project.style`）。

保留不动：软件工坊、工具箱、记忆、下载、工具包、Agent 对话、合规、Take 引擎与核心链路。Blender 插件页按用户意见保持现状。

## 六、模型卡绑定（2026-09-23 追加）

首页模型工具卡原先从写死的 `TOOLS` 渲染，点击只建对应类型节点、不写工程模型字段，出片仍走全局默认模型。现改为：

- 模型卡数据源改为 `config.js` 的 `IMAGE_PROVIDERS` / `VIDEO_PROVIDERS`（`D.adapterList(kind)`），跳过 `custom-*`，免费兜底 provider 无模型时也出卡；与固定工具卡（音频 / 剧本 / 剪辑 / 更多功能）拼成同一行。
- 点击模型卡：新建工程写 `project.imageModel` / `project.videoModel`，并 `D.setAdapterConfig(kind, {provider, model})` 切换该类型短剧服务，使 engine / canvas / box3d 生成链路按所选模型出片。
- 已知限制：短剧服务是全局单配置（`settings.adapters[kind]`），切模型即全局切换，暂不支持按工程隔离 provider；跨工程并行使用不同厂商模型需后续把 provider 下沉到工程。
- 测试：e2e 新增模型卡绑定断言；单测 188 / e2e 280 全绿。

