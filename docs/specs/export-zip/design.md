# 设计文档：作品导出成压缩包

功能名：export-zip
更新日期：2026-09-13
文档类型：设计稿
对应需求：`requirements.md`

## 一、背景与问题

在软件工坊里把含图片的项目导出成 ZIP 时，解压出来的图片打不开：扩展名是 `.png` / `.jpg`，内容却是一段文本。

复现路径：

1. 进入「软件工坊」，用「导入文件」加入一张图片。
2. 打开「打包」页，点「下载软件包 ZIP」。
3. 解压压缩包，用看图软件打开该图片，提示文件损坏。

该问题在需求稿里表述为「图片等二进制文件会从压缩包消失」。经排查，图片并未从压缩包消失，而是被当作文本写入，导致文件内容损坏。本文档按排查后的真实结论设计修复方案。

## 二、排查过程与根因

### 2.1 图片在项目里以文本形式存储

`importFile()` 用 `FileReader.readAsDataURL()` 读取文件（`index.html:7258`），把结果（`data:image/png;base64,....` 这样的字符串）存进 `files[].content`。也就是说，图片在项目数据里本就是一段文本，而不是二进制。

同时 `importFile()` 里有一段判断：

```js
if (isImg(file.name)) {
  files.push({ name: file.name, content: reader.result });
} else {
  files.push({ name: file.name, content: reader.result });
}
```

两个分支完全相同，是一处未完成的实现。原意应当是：图片走二进制、文本走文本，但只写了壳。

### 2.2 打包时把字符串一律当文本编码

`ZIP.make()` 原来按下面这段把内容转字节（旧 `index.html:1191`）：

```js
const raw = f.content;
const data = raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw)
  : raw instanceof Blob ? null
  : enc.encode(String(raw));
if (data === null) continue;
```

对 data URL 这种字符串，会走最后一支 `enc.encode(String(raw))`：把 `data:image/png;base64,...` 这段文字按 UTF-8 编码写进 `logo.png`。解压出来就是一个内容为文本、扩展名为 `.png` 的坏文件。

### 2.3 另一处隐患：Blob 被静默跳过

同一段里 `raw instanceof Blob ? null`，配合 `if (data === null) continue;`，会把 Blob 内容无声丢弃。当前工坊的导入链路只产生字符串，所以这条路走不到；但「商品图片打包」等旁路已经会把 `Uint8Array`（`fetchArrayBuffer` 的返回值，`index.html:4275`）传进来，说明二进制内容迟早会出现。这是潜在缺陷，不是本次坏图的直接原因。

### 2.4 根因结论

坏图的直接原因：**导入图片存成 data URL 文本，打包时又被当成文本写入，PNG/JPEG 从未被还原成字节。**

## 三、设计目标与范围

### 目标

1. 导出含图片的项目时，压缩包里的图片是真实可打开的图片。
2. 二进制内容（`Uint8Array` / `ArrayBuffer` / `Blob`）都按原始字节写入，不再静默丢弃。
3. 不改动压缩包格式、不改动下载方式、不引入外部依赖。
4. 调用方行为与提示保持一致。

### 范围外

- **一键上线路径**（`publishOnline()` → `/dian/api/publish`）同样把图片当文本发送（`index.html:7202`），服务端 `gate/server.py` 的 `validate_publish_files()` 也要求 `content` 必须是字符串、`write_publish()` 按文本写出。此项已另立设计稿修复，见 `../publish-images/design.md`。
- 不改 `PUBLISH_EXTS` 与上线限额。
- 不引入压缩算法（仍为只存储不压缩）。

## 四、方案

### 4.1 新增内容规范化函数 `ZIP._bytes(raw)`

在 `XLX.util.ZIP` 内新增一个异步函数，把各种内容统一转成字节：

```js
async _bytes(raw) {
  if (raw == null) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (raw instanceof Blob) return new Uint8Array(await raw.arrayBuffer());
  if (typeof raw === "string" && /^data:[^,]*;base64,/i.test(raw)) {
    const bin = atob(raw.slice(raw.indexOf(",") + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof raw === "string" && /^data:/i.test(raw)) {
    return new TextEncoder().encode(decodeURIComponent(raw.slice(raw.indexOf(",") + 1)));
  }
  return new TextEncoder().encode(String(raw));
}
```

处理顺序与理由：

1. `null` / `undefined` → 返回 `null`，由调用处决定跳过。
2. `Uint8Array` / `ArrayBuffer` → 直接取字节，覆盖「抓取图片」等既有二进制来源。
3. `Blob` → 异步读成字节，消除原先的静默丢弃。
4. `data:...;base64,` 字符串 → `atob` 解码回真实二进制。这是本次坏图的修复点。
5. 其它 `data:`（非 base64） → 按百分号解码后转字节。
6. 普通字符串 → UTF-8 编码，行为与原来一致。

`atob`、`TextEncoder`、`Blob.arrayBuffer()` 都是浏览器内置能力，符合「零依赖、离线可用」的需求。

### 4.2 `ZIP.make()` 改为异步

因为 `Blob.arrayBuffer()` 是异步的，`make()` 需要 `await this._bytes(f.content)`，函数改为 `async`，返回 `Promise<Blob>`。循环体其余逻辑（CRC32、文件头、中央目录）不变。

```js
async make(files) {
  const enc = new TextEncoder();
  ...
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = await this._bytes(f.content);
    if (data === null) continue;
    ...
  }
}
```

### 4.3 调用点调整

`make()` 变异步后，所有调用点必须 `await`。共 6 处：

| 位置 | 场景 | 调整 |
| --- | --- | --- |
| `index.html:4267` | 商品图片打包（本就在 `async` 回调内） | 加 `await` |
| `index.html:4518` | 视频去水印工具包 | 回调改 `async`，加 `await` |
| `index.html:4972` | 视频转文案工具包 | 回调改 `async`，加 `await` |
| `index.html:7153` | `downloadZip()` | 函数改 `async`，加 `await` |
| `index.html:7188` | 打包页「下载软件包 ZIP」按钮 | 回调改 `async`，加 `await` |
| `index.html:8047` | 本地服务器版打包 | 函数改 `async`，加 `await` |

`downloadZip()` 改为异步后，其唯一调用处在项目卡片的「下载 ZIP」按钮（`index.html:3440`），一并改为 `async` 并 `await`，保证「软件包已打包：<名字>」提示仍显示正确的文件名。

### 4.4 兼容性

- ZIP 字节格式不变，仍是标准 ZIP（本地文件头 + 中央目录 + 结尾记录），任何解压工具可开。
- 文件下载、命名、UI 文案均不变。
- `make()` 由同步变异步，属于内部接口变更；已覆盖全部调用点，无对外暴露。

## 五、行为变化

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| 含导入图片的项目导出 | `.png` 内是 base64 文本，图片损坏 | `.png` 内是真实图片字节，可正常打开 |
| 内容为 `Blob` | 静默跳过 | 按字节写入 |
| 内容为 `Uint8Array` / `ArrayBuffer` | 已正确 | 保持正确 |
| 空字符串文件 | 写入 0 字节文件 | 写入 0 字节文件（不变） |
| 普通文本文件 | 正常 | 正常（不变） |

## 六、验证

### 6.1 语法校验

抽出 `index.html` 全部 20 个内联 `<script>` 段，逐个 `node --check`，全部通过。

### 6.2 功能测试（Node 环境，直接复用页面内的 `ZIP` 对象）

构造 4 个文件打成一个 ZIP，再解压核对：

- `index.html`：文本，核对内容一致。
- `logo.png`：内容为 1×1 PNG 的 data URL，核对解压后字节与原始 PNG 完全一致，文件头为 `89 50 4e 47`。
- `blob.bin`：内容为 `Blob([01 02 03 ff])`，核对解压后字节为 `01 02 03 ff`。
- `empty.txt`：空字符串，核对为 0 字节且未丢失。

结果：全部通过。其中 `logo.png` 解压后 70 字节，与原始 PNG 逐字节相同。

### 6.3 上线校验

上传后比对本地与服务器 `index.html` 的 SHA-256，一致（`03fbbca0...`）。

## 七、影响面与回滚

- 影响文件：仅 `index.html`。
- 上线前备份：`index.html.bak.20260913_141209`。
- 页面由门卫按请求实时读盘，替换即生效，无需重启服务。
- Service Worker 对 `index.html` 采用网络优先策略，在线用户刷新即拿到新页。
- 回滚方式：用备份覆盖 `index.html` 即可。

## 八、相关修复

「一键上线」的同类问题已单独修复，见 `../publish-images/design.md`：上线路径由服务端识别 `data:` URL 并解码为二进制落盘，体积上限改为按真实字节计算。

## 九、参考

- `index.html:1186` — 新增 `ZIP._bytes()` 内容规范化
- `index.html:1202` — `ZIP.make()` 改为异步并调用 `_bytes`
- `index.html:1155` — `XLX.util.download()` 下载实现
- `index.html:4275` — `fetchArrayBuffer()` 返回 `Uint8Array`
- `index.html:6894` — `isImg()` 判断
- `index.html:7145` — `downloadZip()`
- `index.html:7258` — `importFile()` 用 `readAsDataURL` 存图片
- `index.html:8040` — `downloadServerZip()`
- `gate/server.py:181` — `validate_publish_files()`（上线遗留）
- `gate/server.py:222` — `write_publish()`（上线遗留）
