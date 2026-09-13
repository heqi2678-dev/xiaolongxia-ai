# 设计文档：一键上线的图片支持

功能名：publish-images
更新日期：2026-09-13
文档类型：设计稿
关联：`../export-zip/design.md`（同源问题的导出侧修复）

## 一、背景与问题

含图片的项目点「一键上线」后，线上图片打不开；通过「导入文件」加入的文本文件（`.js`、`.txt` 等）也会损坏。

根因与导出问题是同一条链路：

1. `importFile()` 用 `FileReader.readAsDataURL()` 读取文件（`index.html:7258`），无论是图片还是文本，`content` 都存成 `data:...;base64,...` 字符串。
2. 前端 `publishOnline()` 用 `String(f.content || "")` 把内容发给 `/dian/api/publish`（`index.html:7200`）。对字符串而言这是恒等，所以 data URL 原样发出。
3. 服务端 `validate_publish_files()` 只要求 `content` 是字符串，`write_publish()` 一律 `write_text()` 落盘。

结果：`data:image/png;base64,...` 这段文字被写进 `a.png`，`data:text/javascript;base64,...` 被写进 `app.js`。受影响的是**所有导入的文件**，不只是图片。

## 二、目标与范围

### 目标

1. 上线后图片是真实图片，能正常显示。
2. 通过导入加入的文本文件上线后内容正确。
3. 不改扩展名白名单与限额数值，不改线上访问方式。

### 范围外

- 不改前端：现状已把 data URL 发往发布接口，服务端统一解码即可。
- 不改导出（已在 `export-zip` 修复）。

## 三、方案

### 3.1 前端

无需改动。`publishOnline()` 发送的 content 就是项目里的字符串；导入文件为 data URL，AI 生成的代码为普通文本。

### 3.2 服务端 `gate/server.py`

1. 新增 `decode_data_url(content)`：内容以 `data:` 开头时解析；base64 形式用 `base64.b64decode(body, validate=True)`，非 base64 形式用 `unquote_to_bytes(body)`；非法内容抛 `DataUrlError`；不是 data URL 返回 `None`。
2. `validate_publish_files()`：
   - data URL → 解码为 `bytes`，按**解码后的真实字节数**计入体积上限，标记 `binary=True`。
   - 普通字符串 → 维持原逻辑，按 UTF-8 文本计入体积，标记 `binary=False`。
   - 解码失败 → 返回「文件内容坏了，重新导入再试」。
3. `write_publish()`：`binary=True` 用 `write_bytes()`，否则 `write_text(..., encoding="utf-8")`。
4. 新增 `import base64`，并把 `unquote_to_bytes` 加入 `urllib.parse` 导入。

## 四、体积与限额

- 上线体积上限仍为 5 MB，改为按解码后的真实字节计算，不再按 base64 文本长度计算。
- nginx 侧 `client_max_body_size 16m`，5 MB 二进制编码成 base64 约 6.8 MB，请求体在限额内。

## 五、安全

- 扩展名白名单（`PUBLISH_EXTS`）不变，路径校验不变。
- 只有内容整体以 `data:` 开头才走解码；`index.html`、AI 生成的 `.js` 等以普通字符开头，仍按文本处理，不受影响。
- `base64.b64decode(..., validate=True)` 拒绝非法字符；解码异常一律拒绝，不落盘。
- 单条内容以 5 MB 上限约束解码规模。

## 六、验证

### 6.1 单元测试（本地导入模块）

- `decode_data_url`：base64 图片、base64 文本、非 base64 SVG、普通字符串、非法 base64 五种情况，前四种正确、第五种抛 `DataUrlError`。
- `validate_publish_files`：正常项目通过；坏 data URL 返回「文件内容坏了」；缺 `index.html` 返回「先做出网页」；非法扩展名返回「只上网页文件」。
- `write_publish`：图片按 bytes 落盘且与原始一致，文本按文本落盘。

### 6.2 HTTP 端到端（真实门卫 + nginx）

用一次性用户名（不碰任何真实站点）走真实 `/api/publish`，发布 `index.html` + PNG(data URL) + `app.js`(data URL)：

- 接口返回 `ok: true` 与上线地址。
- 经 nginx 读取 `a.png`：`Content-Type: image/png`、Content-Length 70、文件头 `89 50 4e 47`。
- `app.js` 内容与原文一致。
- 测试后清理该会话与测试目录，真实站点与 `zuopin` 目录未受影响。

## 七、影响面与回滚

- 影响文件：`gate/server.py`。
- 备份：`gate/server.py.bak.20260913_142243`。
- 生效方式：`systemctl restart xiaolongxia-gate.service`。
- 回滚：备份覆盖后重启。

## 八、已知遗留

前端对非字符串 content（如 `Blob`、`Uint8Array`）会得到 `String()` 的 `"[object Blob]"` 之类结果。当前所有导入路径都产出字符串，暂不触发；若将来引入二进制来源，再补前端归一化。

## 九、参考

- `index.html:7200` — `publishOnline()`
- `index.html:7258` — `importFile()` 用 `readAsDataURL` 存储
- `gate/server.py:186` — `decode_data_url()`
- `gate/server.py:206` — `validate_publish_files()`
- `gate/server.py:257` — `write_publish()`
- `gate/server.py:74` — `PUBLISH_EXTS` 白名单
- `gate/server.py:72` — `PUBLISH_MAX_BYTES`
