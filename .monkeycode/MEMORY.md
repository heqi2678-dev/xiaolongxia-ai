# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-09-16
- Context: Discovered by Agent while 生成《AI短剧工作台使用教程》图文视频
- Category: Build Methods
- Instructions:
  - 教程视频源码在 `docs/tutorials/video/`：`deck.py` 定内容、`render.py` 出图与字幕、`build_video.py` 合成 mp4。
  - 重建：`python3 render.py && python3 build_video.py`；可用 `VCRF/VPRESET/VFPS/VSUFFIX` 覆盖码率与输出名（出小体积分享版：`VCRF=26 VPRESET=medium VFPS=25 VSUFFIX=lite`）。
  - 依赖：Python3 + Pillow（`pip3 install --break-system-packages pillow`）、`ffmpeg`、中文字体 `fonts-wqy-zenhei`（`render.py` 硬编码字体路径 `/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc`）。
  - 本机无中文 TTS（ffmpeg 只有英文 flite，无 espeak/festival），成片只能做无旁白版；配音走 `旁白稿.md` + `字幕.srt` 的人工/TTS 后期。
  - 每页时长由 `render.py` 按字数自动计算（`2.6 + 字数/7.6` 秒，夹在 4-17 秒），改文案后总时长会自动变。
  - 成片与卡片图不进 Git，交付包放在工作区 `/workspace/AI短剧工作台教程视频/`（含 mp4 + slides + 字幕 + 旁白稿 + 说明）。
  - 文件面板（工作区）读取大文件会失败，实测 36MB 的 mp4 提示「文件读取失败」；交付视频控制在 3MB 左右（`VZOOM=0 VTUNE=stillimage VCRF=28 VFPS=15`）才可正常读取。
  - 在线播放：`gate/server.py` 的 `STATIC_TYPES` 已支持 `.mp4/.webm`（`video/mp4`、`video/webm`），把视频放到 `SHOP_DIR` 根目录即可通过预览地址（如 `/tutorial-video.mp4`）登录后直接播放；该文件已加入 `.gitignore`。

[Project Knowledge Summary]
- Date: 2026-09-16
- Context: Discovered by Agent while 实测服务端合成（ffmpeg）链路
- Category: Operations & Deployment
- Instructions:
  - 服务端合成（`gate/server.py` 的 `drama_compose`）强依赖系统 `ffmpeg` 与中文字体，部署新机器时两者都要装。
  - 中文字体：`DEBIAN_FRONTEND=noninteractive apt-get install -y fonts-wqy-zenhei`，装完执行 `fc-cache -f`；`fc-list :lang=zh` 应能看到文泉驿。
  - `_drama_font()` 按固定路径优先匹配 `/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc`，用于烧入「AI 生成」角标；缺失时回退 DejaVuSans，中文角标会变方块。
  - 字幕走 libass，按字形回退到 fontconfig 匹配的中文字体（日志出现 `Glyph 0x... not found, selecting one more font` 属正常回退）。
  - 缺 ffmpeg 时 `drama_compose` 抛 `RuntimeError`，接口返回 501，前端应提示改用浏览器合成。

[Project Knowledge Summary]
- Date: 2026-09-16
- Context: Discovered by Agent while implementing and verifying the AI 短剧工作台 (src/drama/)
- Category: Testing Methods
- Instructions:
  - 前端（短剧工作台）测试：`node --test tests/drama.test.js`，测试台 `tests/drama-harness.js` 用最小 DOM/fetch 桩在 Node 里加载 `src/drama/*.js`，不触网。
  - 后端（店门）测试：`cd gate && python3 -m unittest test_gate`。
  - 前端脚本单文件语法校验：`node --check <file>`。
  - 真 DOM 端到端实测：`NODE_PATH=/usr/local/lib/node_modules node tests/drama-e2e.js`，用 jsdom 提供真实 DOM/事件/localStorage，加载 `src/drama/*.js` 后按用户操作点按钮、填表单，全部网络打桩；依赖全局安装的 `jsdom`（本机已装，`/usr/local/lib/node_modules`）。
  - jsdom 不做排版，测不出 overflow 裁切/滚动类布局缺陷；这类问题必须用真实浏览器布局审计：`AUDIT_USER=zhuren AUDIT_PASS=<口令> python3 tests/layout_audit.py http://127.0.0.1:9140`（依赖 chromium/chromium-driver/selenium，缺任一则打印 SKIP 退出 0）。脚本用 CDP `Emulation.setDeviceMetricsOverride` 做真实移动视口，逐视图检测「视图根 overflow:hidden 却内容溢出」与「元素被不可滚动的 hidden/clip 祖先裁剪」。检测器本身可用 `--self-test` 验证：注入 `.dw-wrap{overflow:hidden;height:220px}` 必须被检出，移除后必须恢复无告警。
  - 提交前建议同时跑：drama 前端测试 + drama 端到端 + 店门后端测试 + 对 `src/drama/*` 全部 `node --check` + 真实浏览器布局审计（服务在跑时）。

[Project Knowledge Summary]
- Date: 2026-09-16
- Context: Discovered by Agent while 向 GitHub 推送本仓库
- Category: Environment Configuration
- Instructions:
  - 仓库远端为 `git@github.com:heqi2678-dev/xiaolongxia-ai.git`，本仓库历史直接在 `main` 上提交。
   - 本开发环境推送 GitHub 使用专用密钥 `/root/.ssh/id_drama`，并通过 `/root/.ssh/config` 将 `github.com` 指向 `ssh.github.com:443`（22 端口不通时走 443）。

[Project Knowledge Summary]
- Date: 2026-09-17
- Context: Discovered by Agent while 接通火山方舟真实模型（Seedream 生图 / Seedance 生视频）做端到端冒烟
- Category: Environment Configuration
- Instructions:
  - 火山方舟模型 ID 必须使用带版本号的完整值（如 `doubao-seedream-4-5-251128`）；控制台模型广场展示的简称不能直接当 model 传，会报模型不存在。
  - API 基址 `https://ark.cn-beijing.volces.com/api/v3`；图像 `POST /images/generations`，视频 `POST /contents/generations/tasks` + `GET /contents/generations/tasks/{id}` 轮询（结果在 `content.video_url`）。
  - 火山方舟接口**支持浏览器跨域（CORS）**：OPTIONS 预检会回显 Origin 与请求头，因此前端可直连，无需自建代理。
  - Seedream 4.5 对输入/输出图有**最小像素限制 3,686,400（约 368.64 万）**，`768x1344` 这类小图会被拒；比例表统一升到 2K 档（9:16=1440x2560、16:9=2560x1440、1:1=2048x2048、3:4=1728x2304）。
  - Seedance **2.x 系列开通需账户余额/代金券 ≥ 200 元**（硬门槛，绕不过）；**1.0 系列无此门槛**，可直接开通并享有免费额度，做链路验证用 1.0。
  - Seedance 1.0 pro-fast 实测：5 秒 720p 竖屏约 24 秒完成、消耗约 10.4 万 tokens，输出 704x1248 / 24fps；免费额度 200 万 tokens。
  - Ark API Key 只存本地文件（如 `/tmp/opencode/xlx/.ark`，权限 600），不进仓库、不在聊天回显。

[Project Knowledge Summary]
- Date: 2026-09-17
- Context: Discovered by Agent while 接通火山语音新版 HTTP 单向流式合成（`/api/v3/tts/unidirectional`）
- Category: Environment Configuration
- Instructions:
  - 新版控制台必须先在「开通管理」**开通「语音合成2.0」**才能调用，否则返回 `code 45000030 requested resource not granted`；开通走免费试用额度。旧版控制台给 App 勾的「接入能力」不授权给新版 API Key，且新版授权按项目隔离。
  - 鉴权用 `X-Api-Key: <API Key>` + `X-Api-Resource-Id: seed-tts-2.0`，**不需要 App ID / Access Token**；用旧凭证会报 `code 3001` 或 `45000010`。
  - `seed-tts-2.0` 只能配 `*_uranus_bigtts` / `*_jupiter_bigtts` 音色（即控制台「Vivi 2.0/云舟 2.0/小天 2.0」等），配 1.0 的 `*_conversation_wvae_bigtts` 会报 `code 55000000 resource ID is mismatched with speaker related resource`。
  - 响应为 **HTTP Chunked 的 NDJSON**（每行一个 JSON）：音频分片在 `data`（base64，首片带 ID3、后续为裸 MP3 帧，逐片解码后拼接即为完整 MP3），`code 20000000` 为结束帧；**错误也以 HTTP 200 返回**，需按帧内 `code` 判断而非 HTTP 状态码。
  - 接口支持浏览器跨域（`access-control-allow-origin: *`，且允许 `X-Api-Resource-Id` 头），前端可直连。
  - 旧版 `/api/v1/tts`（`Bearer;<token>` + `app.appid/token/cluster`）已弃用，代码不要再走该协议。
