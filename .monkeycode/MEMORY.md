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
  - 前端（短剧工作台）测试：`node --test tests/drama.test.js`（Node v22 不接受目录参数 `node --test tests/`，须显式指定测试文件），测试台 `tests/drama-harness.js` 用最小 DOM/fetch 桩在 Node 里加载 `src/drama/*.js`，不触网。
  - 后端（店门）测试：`cd gate && python3 -m unittest test_gate`。
  - 前端脚本单文件语法校验：`node --check <file>`。
  - 真 DOM 端到端实测：`NODE_PATH="$(npm root -g)" node tests/drama-e2e.js`（本机 `npm root -g` 为 `/usr/lib/node_modules`），用 jsdom 提供真实 DOM/事件/localStorage，加载 `src/drama/*.js` 后按用户操作点按钮、填表单，全部网络打桩；依赖全局安装的 `jsdom`（`npm install -g jsdom`）。
  - jsdom 不做排版，测不出 overflow 裁切/滚动类布局缺陷；这类问题必须用真实浏览器布局审计：`AUDIT_USER=zhuren AUDIT_PASS=<口令> python3 tests/layout_audit.py http://127.0.0.1:9140`（依赖 chromium/chromium-driver/selenium，缺任一则打印 SKIP 退出 0）。脚本用 CDP `Emulation.setDeviceMetricsOverride` 做真实移动视口，逐视图检测「视图根 overflow:hidden 却内容溢出」与「元素被不可滚动的 hidden/clip 祖先裁剪」。检测器本身可用 `--self-test` 验证：注入 `.dw-wrap{overflow:hidden;height:220px}` 必须被检出，移除后必须恢复无告警。
   - **Blender 插件真机冒烟**（沙箱内，2026-09-23 建）：官方 `download.blender.org` 下载会卡在 0 字节，改用南京大学镜像 `https://mirror.nju.edu.cn/blender/blender-release/Blender4.5/blender-4.5.14-linux-x64.tar.xz`（约 360MB）；解压后先补运行库 `DEBIAN_FRONTEND=noninteractive apt-get install -y libgl1 libegl1 libice6 libsm6 libxfixes3 libxi6 libxrender1 libxkbcommon0 libxxf86vm1`，否则报 `libXrender.so.1` 等缺失；跑 `./blender-4.5.14-linux-x64/blender -b --factory-startup -noaudio --python <脚本>`。
   - headless 下 `bpy.ops.render.opengl` 必报 `Cannot use OpenGL render in background mode (no opengl context)`，故视口预览为空属正常，预览回传只在有 GUI/GPU 的机器上生效；GLB 导出与回传不依赖它。
   - 提交前建议同时跑：drama 前端测试 + drama 端到端 + 店门后端测试 + 对 `src/drama/*` 全部 `node --check` + 真实浏览器布局审计（服务在跑时）。

[Project Knowledge Summary]
- Date: 2026-09-16（2026-09-21 修订）
- Context: Discovered by Agent while 向 GitHub 推送本仓库
- Category: Environment Configuration
- Instructions:
  - 仓库远端为 `git@github.com:heqi2678-dev/xiaolongxia-ai.git`，本仓库历史直接在 `main` 上提交。
  - 推送 GitHub 可用仓库部署密钥 `/home/admin/.ssh/id_ed25519_xiaolongxia`（`github.com` 的 Host 配置写在 `/home/admin/.ssh/config`）。以 root 身份提交时 root 没有 GitHub 密钥与 ssh config，直接 `git push` 会 `Permission denied (publickey)`，需显式指定密钥：`GIT_SSH_COMMAND="ssh -i /home/admin/.ssh/id_ed25519_xiaolongxia -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git push origin main`。
  - `/root/.ssh/id_drama` 与 `/root/.ssh/config` 在 2026-09-21 已不存在，旧记录作废。

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
  - **前端不能直连**：该接口预检只放行 `X-Api-Resource-Id` 等头，**不放行 `X-Api-Key`**（唯一可用的鉴权头），浏览器会拦成 `Failed to fetch`；`X-Api-Access-Key`/`X-Api-App-Key`/`Authorization` 均报 `code 45000000`。
  - 语音统一走同源网关转发：前端口令 `POST /dian/api/drama/tts`（body `{key,resource,text,speaker,speed,format}`），`gate/server.py` 的函数 `drama_tts()` 代发火山并回传 `audio/mpeg`；上游错误转成 502 + `{"error":...}`。改协议只需改 `drama_tts()`，前端 `tts.js` 不必动。
  - 旧版 `/api/v1/tts`（`Bearer;<token>` + `app.appid/token/cluster`）已弃用，代码不要再走该协议。

[Project Knowledge Summary]
- Date: 2026-09-17
- Context: Discovered by Agent while 探测火山智能视觉（视觉智能开放平台）口型模型真实契约
- Category: Troubleshooting & Debugging
- Instructions:
  - 视觉智能接口：`POST https://visual.volcengineapi.com`，`service=cv`、`Version=2022-08-31`、`region=cn-north-1`（换版本报 `Could not find operation ...`）。签名头不在浏览器 CORS 白名单，统一走同源网关 `POST /dian/api/drama/visual` 由 `gate/server.py` 的 `volc_sign()` / `drama_visual()` 代签。
  - **口型正确 req_key 是 `jimeng_realman_avatar_picture_omni_v15`（OmniHuman1.5，主体识别为 `jimeng_realman_avatar_picture_create_role_omni_v15`）**；实测 `realman_avatar_picture_omni_v2` 恒报 `50430`（旧错值，与开通无关）、`jimeng_realman_avatar_picture_omni_v2` 报 `50400`、`realman_avatar_picture_v2` 提交得 `10000` 但 GetResult 报 `50215`。不存在的 req_key 报 `50200 req_key <x> not supported`。
  - 官方文档取数走 API 而非网页（网页需 JS）：库列表 `GET https://docs.volcengine.com/api/doc/getDocList?LibraryID=85621&lang=zh`，详情 `GET .../getDocDetail?DocumentID=<id>&lang=zh`，正文在 `Result.MDContent`。即梦数字人库 `85621`（`JimengAI`），视频生成文档 `1829013`、主体识别 `1828975`。
  - 错误码语义：`50200` 参数/req_key 不支持、`50215` 输入无效（多为音频超 60 秒）、`50400` 未开通/无权限、`50429` QPS 超限、`50430` 并发为 0 或已满（模型并发仅 1，撞上属常态，需退避重试）、`50220` 素材 URL 不可下载、`50500` 上游内部错误。响应成功码为 `10000`。
  - `CVSubmitTask` 返回 `data.task_id`；`CVGetResult` 返回 `data.status`（`not_found`/`processing`/`done`/`failed`）、成片 `data.video_url`（**仅 1 小时有效**）、失败原因 `data.resp_data`。
  - 本地素材必须先经网关 `POST /dian/api/drama/asset` 上传换公网地址（上游只收 http(s)，`data:` 会被拒）。

[Project Knowledge Summary]
- Date: 2026-09-21
- Context: Discovered by Agent while 用真实方舟 Key 验证整段模式（发现模型未开通）
- Category: Troubleshooting & Debugging
- Instructions:
  - **判断方舟模型是否已开通**：`POST /api/v3/contents/generations/tasks`，body 用 `{"model":"<id>","content":[]}`。返回 `404 ModelNotOpen` 表示未开通；返回 `400 InvalidParameter (content field cannot be empty)` 表示已开通。该方法利用「先校验开通、后校验参数」的顺序，且因参数非法不会创建计费任务。
  - 账号 `2131262660` 当前仅开通 `doubao-seedance-1-0-pro-250528` / `doubao-seedance-1-0-pro-fast-251015`；`doubao-seedance-2-5-260628` 与全部 2.0 变体均 `ModelNotOpen`（与 2.x 需余额/代金券 ≥ 200 元的门槛一致）。
  - Seedance 1.0 pro-fast 输入 9:16 时**不遵守 720p**，实际输出 704x1248 / 24fps；`duration` 只接受 5 / 10（传 15 报 `the specified duration is not supported`），链路验证时需把 `takeTarget` 降到 ≤10。
  - Seedance 1.0 **不支持参考生视频（r2v / reference_image）**，传参考图报 `task_type r2v does not support model ...`；当前实现遇到 1.0 时自动降级为首帧驱动（i2v），并把降级原因写到段/镜的 `notice`。
  - 整段模式的局段重绘依赖 2.5 的视频编辑能力，1.0 不具备，验证时跳过该项。
  - 账号已开通的文生图模型：`doubao-seedream-4-5-251128` / `doubao-seedream-5-0-260128` / `doubao-seedream-4-0-250828`，验证 1.0 视频链路时可用其生成定妆图。

[Project Knowledge Summary]
- Date: 2026-09-21
- Context: Discovered by Agent while 用 headless 浏览器实操前端工作台（验证逐镜模式 / 台词字幕 / UI 可用性）
- Category: Testing Methods
- Instructions:
  - **在本机（Debian 沙箱）跑浏览器 UI 实操**：`apt-get install -y -qq chromium fonts-noto-cjk`（bookworm 源，约 100MB 依赖，需数分钟），再 `npm install -g puppeteer-core`，用 `require($(npm root -g) + "/puppeteer-core")` 加载，`executablePath: "/usr/bin/chromium"`，args 加 `--no-sandbox --disable-dev-shm-usage --disable-gpu`。
  - 前端是纯静态站（`index.html` + `src/**`），沙箱内可直接起一个"静态 + `/dian` 反向代理到 9140"的小 http 服务来跑（代理到本地网关仅为占位，视频生成是从浏览器直连火山方舟，不依赖网关）。
  - **`XLX` 是顶层 `const`，不是 `window` 属性**：`typeof window.XLX === "undefined"`，但 `page.evaluate(() => XLX.xxx)` 与 `waitForFunction("typeof XLX !== 'undefined' && ...")` 都能正常取到。UI 自动化断言/等待一律用裸 `XLX`，别写成 `window.XLX`。
  - UI 关键选择器：导航 `.nav-item[data-view="settings"|"dramaHome"]`；设置卡片 `#ds-<kind>-provider/key/model` + 保存 `#dramaSave`；新建工程 `#dwHomeNewManual`（`blank()` 自带 1 镜）；剧种 `#dwGenre`、生成模式 `#dwShotMode`（选 realistic 后才出现）；加镜 `[data-railadd="1"]`；属性面板字段 `[data-if="prompt|line|duration|motion"]`（**绑定的是 `onchange`**，赋值后需 `dispatchEvent(new Event("change"))`）；生成按钮 `[data-iact="gen"]`；状态 `[data-status="<shotId>"]`。当前分镜 id 取 `XLX.drama.manual.state.cur`（新建后自动选中新镜，不是 `shots[0]`）。
  - **只验证"视频"链路时必须让 `shot.line` 留空**：`engine.generateShot` 在视频成功后串行调用 `synthShot`/`lipsyncShot`，TTS 未配 Key 会抛错，`catch` 把整镜标成 `failed`（视频其实已生成、URL 已在 `shot.videoUrl`），上报文案为「火山语音需要 API Key，请到「设置 → 短剧服务」填写」。
  - 沙箱/服务器上**没有**火山语音 API Key 与视觉智能 AccessKey（只有 `/tmp/ark.key`），因此配音 + 口型的真实链路仍需用户提供这两个凭据；台词→`字幕.srt` 的部分可离线验证。
  - 火山方舟**生成产物**（TOS 域名 `ark-content-generation-*.tos-*.volces.com`）的 GET **不带 CORS 头**，浏览器 `fetch` 会被 CORS 拦截，`project.cacheRemote()` 因此走 `catch` 分支回退为远端 URL（`<video>` 播放不受影响，但本地缓存与 24h 后过期问题依然存在）。这与"方舟 API 支持 CORS"是两回事，勿混。

[Project Knowledge Summary]
- Date: 2026-09-21（2026-09-22 修订）
- Context: Discovered by Agent while 校验线上部署是否已生效
- Category: Operations & Deployment
- Instructions:
  - 短剧工作台线上地址是 `http://47.108.14.206/dian/`：nginx `^~ /dian/` → `127.0.0.1:9140`（`gate/server.py`，`SHOP_DIR=/home/admin/work/xiaolongxia-ai`），`_shop_file()` 每次请求都 `read_bytes()` 读盘，**改前端静态文件（`index.html`、`src/**`）无需重启服务**。
  - 根路径 `/` → `127.0.0.1:9130` 的 `tonglong-ui`（另一个 app，目录 `/home/admin/work/tonglong-ui`，与本项目无关），需要登录：`curl /` 返回 401，`curl /dian/` 返回「铜龙电商 · 请进店」登录页。因此**未登录时无法用 curl 校验前端静态产物**（`/dian/src/...` 取不到），只能确认 `SHOP_DIR` 磁盘文件已更新。
  - 校验"本地改动是否已上线"时用内容比对而非本地 git 状态：本机 `/tmp/opencode/xiaolongxia-ai` 的 git 历史与线上仓库不一致（`git status` 不可作准），可靠做法是 `ssh` 取线上 `git ls-files -z | xargs -0 md5sum` 与本地 `md5sum` 逐文件比对，再把有差异的文件 `scp` 回线上提交。
   - Agent 环境（沙箱）工作副本为 `/workspace`：内容与线上逐文件一致（md5 相同），但其 git 为单 commit `c67274b`、无远端。Agent 环境已生成 `~/.ssh/id_ed25519` 并通过 `ssh-copy-id` 写入线上 root 的 `authorized_keys`，可直接 `ssh root@47.108.14.206`；部署路径为 改 `/workspace` → 同步线上 `/home/admin/work/xiaolongxia-ai` → 线上 `git` 提交推送。
   - 网关 `gate/server.py` 属后端，改动后需重启才生效：`systemctl restart xiaolongxia-gate.service`（服务单元名 `xiaolongxia-gate.service`，进程为 `/usr/bin/python3 /home/admin/work/xiaolongxia-ai/gate/server.py`）；前端静态文件（`index.html`、`src/**`）仍是覆盖即生效、无需重启。（2026-09-23 补记）
  - 小龙虾 LibTV 化总方案落档在 `.monkeycode/specs/2026-09-22-libtv-3layer/总方案.md`（三层：地基 / 工作台 / 3D-BOX，外加门外与贯穿线；管家页全程排除）。

[Project Knowledge Summary]
- Date: 2026-09-22
- Context: Discovered by Agent while 把管家（tonglong-ui）纳入 git 管理
- Category: Operations & Deployment
- Instructions:
  - 管家目录 `/home/admin/work/tonglong-ui`（线上）已 `git init`（分支 `main`，首提交 `7309752`，`.git` 约 900K）；`.gitignore` 已排除虚拟环境 `ocr311/`、`ocrvenv/`、`__pycache__/`、备份 `*.bak*`、运行时数据 `rooms/`、`inbox/`、`downloads/`、`pub/`、`safety/`、`*.jsonl`，以及凭据 `*.keys.json`、`brains.json`、`works.json`。
  - 管家服务由独立 venv 启动：`/home/admin/.hermes/hermes-agent/venv/bin/python3 -m uvicorn app:app --host 127.0.0.1 --port 9130`；改后端代码后需重启该进程（前端 `index.html` 静态改动无需重启）。
  - 该目录文件多为 `admin` 所有、部分 `root`，git 以 root 操作，已 `git config --global --add safe.directory`。
  - GitHub 远端已配：`git@github.com:heqi2678-dev/tonglong-ui.git`（私有）；推送用专用部署密钥 `/home/admin/.ssh/id_ed25519_tonglongui`（已在仓库 Deploy keys 中勾选 write access）：`GIT_SSH_COMMAND="ssh -i /home/admin/.ssh/id_ed25519_tonglongui -o IdentitiesOnly=yes" git push origin main`。该密钥只授权 `tonglong-ui` 仓库，与小龙虾的 `id_ed25519_xiaolongxia` 相互独立。
