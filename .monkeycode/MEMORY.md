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
  - 真 DOM 端到端实测：`NODE_PATH=/usr/local/lib/node_modules node tests/drama-e2e.js`，用 jsdom 提供真实 DOM/事件/localStorage，加载 `src/drama/*.js` 后按用户操作点按钮、填表单，全部网络打桩；依赖全局安装的 `jsdom`（本机已装，`/usr/local/lib/node_modules`）。本机无 chromium/firefox，浏览器实测用此脚本替代。
  - 提交前建议同时跑：drama 前端测试 + drama 端到端 + 店门后端测试 + 对 `src/drama/*` 全部 `node --check`。

[Project Knowledge Summary]
- Date: 2026-09-16
- Context: Discovered by Agent while 向 GitHub 推送本仓库
- Category: Environment Configuration
- Instructions:
  - 仓库远端为 `git@github.com:heqi2678-dev/xiaolongxia-ai.git`，本仓库历史直接在 `main` 上提交。
  - 本开发环境推送 GitHub 使用专用密钥 `/root/.ssh/id_drama`，并通过 `/root/.ssh/config` 将 `github.com` 指向 `ssh.github.com:443`（22 端口不通时走 443）。
