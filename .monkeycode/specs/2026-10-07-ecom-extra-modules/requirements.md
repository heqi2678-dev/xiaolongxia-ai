# Requirements Document

## Introduction

本规格为「铜龙电商ai助手 · 电商工作台」补齐三块对标爱创AI（51aic）的能力缺口：**AI 工具箱**、**AI 视频**、**风格复刻**。现有电商工作台导航为 7 项（工作台、AI 作图、AI 详情图、主图编辑、详情页编辑、跨境本地化、作品库）；本规格在其上新增三个入口页，复用现有生成适配器与本地资产库，不重造生成底座。

## Glossary

- **电商工作台**：铜龙电商ai助手内 `/dian/` 的面向电商用户的创作分区，由 `src/drama/ecom/*` 实现。
- **AI 工具箱**：对已上传或已生成的图片执行基础编辑（裁剪、尺寸、水印、文字、边框、滤镜、马赛克、旋转翻转、色彩调节、涂鸦、扩图、尺码标注、素材合成）的页面。
- **AI 视频**：提供「图生视频」「视频复刻」「视频翻译」三种模式的页面。
- **风格复刻**：以一张参考图定义视觉风格，并将其应用到用户商品图、同时保留商品主体的页面。
- **作品**：用户通过任一模块产生的图片或视频记录。
- **作品库**：电商工作台内统一管理作品的页面（对应 51aic 的「资产」）。
- **适配器**：`src/drama/adapters/{image,video,tts,lipsync}.js` 提供的统一生成调用层。
- **工具**：AI 工具箱内的一个独立编辑动作。

## Requirements

### Requirement 1

**User Story:** AS 电商用户, I want 在电商工作台看到 AI 工具箱、AI 视频、风格复刻三个入口, so that 我能直接进入并使用这些能力。

#### Acceptance Criteria

1. THE 电商工作台 SHALL 在主导航中显示「AI 工具箱」「AI 视频」「风格复刻」三个入口。
2. WHEN 用户选择「AI 工具箱」入口, THE 电商工作台 SHALL 显示 AI 工具箱页面。
3. WHEN 用户选择「AI 视频」入口, THE 电商工作台 SHALL 显示 AI 视频页面。
4. WHEN 用户选择「风格复刻」入口, THE 电商工作台 SHALL 显示 风格复刻页面。
5. THE 电商工作台 SHALL 保持现有 7 个入口的键名与页面行为不变。

### Requirement 2

**User Story:** AS 电商用户, I want 对图片执行常见的基础编辑, so that 我无需外部软件即可微调素材。

#### Acceptance Criteria

1. THE AI 工具箱 SHALL 提供以下工具：扩图、尺寸裁剪、修改尺寸、尺码标注、加水印、加文字、加边框、滤镜、素材合成、打马赛克、翻转旋转、色彩调节、涂鸦。
2. WHEN 用户在 AI 工具箱选择一个工具并提交一张有效图片, THE AI 工具箱 SHALL 生成编辑后的图片。
3. WHILE AI 工具箱未收到有效图片, THE AI 工具箱 SHALL 使提交动作处于不可用状态。
4. IF 一次编辑请求失败, THE AI 工具箱 SHALL 显示失败提示并保留当前已选工具与已选图片。
5. WHEN AI 工具箱生成成功, THE AI 工具箱 SHALL 将结果保存为一条作品记录。

### Requirement 3

**User Story:** AS 电商用户, I want 通过三种模式生成商品短视频, so that 我能制作用于投放的视频素材。

#### Acceptance Criteria

1. THE AI 视频 SHALL 提供「图生视频」「视频复刻」「视频翻译」三种模式。
2. WHEN 用户上传一张图片并提交图生视频请求, THE AI 视频 SHALL 生成一段视频并以作品记录保存。
3. WHEN 用户上传一段参考视频与至少一张商品素材并提交视频复刻请求, THE AI 视频 SHALL 生成沿用参考视频运动风格的视频。
4. WHEN 用户上传一段视频并选择目标语言并提交视频翻译请求, THE AI 视频 SHALL 生成带目标语言字幕或配音的视频。
5. WHILE 视频生成任务进行中, THE AI 视频 SHALL 显示该任务的进行状态。
6. IF 一次视频生成请求失败, THE AI 视频 SHALL 显示失败提示并保留当前模式与已上传素材。

### Requirement 4

**User Story:** AS 电商用户, I want 用参考图统一定义商品图风格, so that 我的素材保持一致的视觉调性。

#### Acceptance Criteria

1. WHEN 用户上传一张风格参考图与至少一张商品图并提交风格复刻请求, THE 风格复刻 SHALL 生成保留商品主体形态且应用参考图风格的结果图。
2. IF 用户未上传风格参考图, THE 风格复刻 SHALL 阻止提交并提示需要风格参考图。
3. IF 用户未上传商品图, THE 风格复刻 SHALL 阻止提交并提示需要商品图。
4. WHEN 风格复刻生成成功, THE 风格复刻 SHALL 将结果保存为作品记录并标注来源为风格复刻。

### Requirement 5

**User Story:** AS 电商用户, I want 三个新模块的产物统一出现在作品库, so that 我能集中管理与复用。

#### Acceptance Criteria

1. WHEN 任一新增模块生成成功, THE 作品库 SHALL 新增对应的作品记录。
2. THE 作品库 SHALL 支持按「图片」「视频」两种类型筛选新增模块产物。
3. WHEN 用户在作品库对一个图片类作品选择编辑, THE 作品库 SHALL 打开 AI 工具箱并将该作品作为输入图。
4. THE 作品库 SHALL 沿用现有电商工作台的本地资产库命名空间。

### Requirement 6

**User Story:** AS 系统维护者, I want 新模块复用现有生成适配器与资产链路, so that 生成底座与数据模型保持一致。

#### Acceptance Criteria

1. THE AI 视频 SHALL 通过现有视频适配器调用视频生成能力。
2. THE 风格复刻 SHALL 通过现有图片适配器调用图片生成能力。
3. THE AI 工具箱 SHALL 对非生成型工具在浏览器端完成编辑，对生成型工具通过现有图片适配器调用图片生成能力。
4. THE 三个新增模块 SHALL 复用现有电商工作台的资产存取与作品记录接口。

### Requirement 7

**User Story:** AS 系统维护者, I want 新增模块不破坏现有电商与短剧能力, so that 现有用户与测试保持稳定。

#### Acceptance Criteria

1. WHEN 三个新增模块上线后, THE 电商工作台 SHALL 保持现有 7 个页面的既有行为。
2. WHEN 三个新增模块上线后, THE 短剧分区 SHALL 保持既有行为与既有测试结果。
3. THE 三个新增模块 SHALL 通过单元测试、端到端测试与网关测试。
