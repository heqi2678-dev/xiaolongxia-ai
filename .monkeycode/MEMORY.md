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
- Context: Discovered by Agent while implementing and verifying the AI 短剧工作台 (src/drama/)
- Category: Testing Methods
- Instructions:
  - 前端（短剧工作台）测试：`node --test tests/drama.test.js`，测试台 `tests/drama-harness.js` 用最小 DOM/fetch 桩在 Node 里加载 `src/drama/*.js`，不触网。
  - 后端（店门）测试：`cd gate && python3 -m unittest test_gate`。
  - 前端脚本单文件语法校验：`node --check <file>`。
  - 提交前建议同时跑：drama 前端测试 + 店门后端测试 + 对 `src/drama/*` 全部 `node --check`。

[Project Knowledge Summary]
- Date: 2026-09-16
- Context: Discovered by Agent while 向 GitHub 推送本仓库
- Category: Environment Configuration
- Instructions:
  - 仓库远端为 `git@github.com:heqi2678-dev/xiaolongxia-ai.git`，本仓库历史直接在 `main` 上提交。
  - 本开发环境推送 GitHub 使用专用密钥 `/root/.ssh/id_drama`，并通过 `/root/.ssh/config` 将 `github.com` 指向 `ssh.github.com:443`（22 端口不通时走 443）。
