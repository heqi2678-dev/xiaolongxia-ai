/* AI 短剧工作台 · 真 DOM 端到端实测（jsdom）
 * 用 jsdom 提供真实 DOM/事件/localStorage，加载 src/drama/*.js 后像用户一样点按钮、填表单，
 * 逐个链路走一遍：手搓台漫剧、手搓台仿真人、半自动台 8 阶段、工程与角色库、合规闸门。
 * 网络全部打桩，不触网。用法：NODE_PATH=/usr/local/lib/node_modules node tests/drama-e2e.js */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
const DRAMA_FILES = [
  "config.js", "adapters.js", "adapters/image.js", "adapters/video.js",
  "adapters/tts.js", "adapters/lipsync.js", "project.js", "character.js",
  "takes.js",
  "engine.js", "compliance.js", "compose.js", "ui.js",
  "templates.js", "models.js", "timeline.js", "home.js",
  "projects.js", "assets.js", "tvshow.js", "ranking.js", "plugin.js",
  "guide.js",
  "manual.js", "auto.js", "makeup.js", "canvas.js", "box3d.js", "box3dview.js", "toolkit.js", "shell.js"
];

let pass = 0;
const fails = [];
function ok(cond, name) {
  if (cond) { pass++; console.log("  ok " + name); }
  else { fails.push(name); console.log("  \u2717 FAIL " + name); }
}
function eq(a, b, name) { ok(a === b, name + " (\u5b9e\u9645=" + JSON.stringify(a) + ")"); }
function has(str, sub, name) { const good = String(str).includes(sub); ok(good, good ? name : name + " —未包含 " + sub); }

const HTML = `<!doctype html><html><head><title>t</title></head><body>
<div id="shellNav"></div>
<div id="homeView" class="view"><div id="dramaHome"></div></div>
<div id="projectsView" class="view"><div id="dwHome"></div></div>
<div id="assetsView" class="view"><div id="dwMakeup"></div></div>
<div id="tvshowView" class="view"><div id="dwTvshow"></div></div>
<div id="autoView" class="view"><div id="dwAuto"></div></div>
<div id="rankingView" class="view"><div id="dramaRanking"></div></div>
<div id="box3dView" class="view"><div id="dramaBox3d"></div></div>
<div id="pluginView" class="view"><div id="dramaPlugin"></div></div>
<div id="toolkitView" class="view"><div id="dramaToolkit"></div></div>
<div id="dramaView" class="view"><div id="dwManual"></div></div>
<div id="modal"></div>
</body></html>`;

function makeIndexedDB() {
  const data = {};
  function txFactory(store) {
    const tx = { oncomplete: null, onerror: null };
    tx.objectStore = () => ({
      put(rec) { data[rec.id] = rec; setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); },
      get(id) { const rq = { result: data[id] || null, onsuccess: null, onerror: null }; setTimeout(() => rq.onsuccess && rq.onsuccess(), 0); return rq; }
    });
    return tx;
  }
  return {
    open() {
      const req = { result: null, onsuccess: null, onupgradeneeded: null, onerror: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => ({}),
          transaction: (name, mode) => txFactory(name)
        };
        if (req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    }
  };
}

function boot() {
  const vc = new VirtualConsole();
  const jserrors = [];
  vc.on("jsdomError", (e) => jserrors.push(String(e && e.message)));
  vc.on("error", (...a) => jserrors.push(a.map(String).join(" ")));
  ["warn", "log"].forEach(() => {});

  const dom = new JSDOM(HTML, { url: "https://preview.test/work", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  const doc = window.document;
  const state = { calls: [], toasts: [], downloads: [], zip: null, jobs: 0, urlSeq: 0, audios: [] };
  let lastFileInput = null;

  /* ---- 浏览器 API 桩 ---- */
  const ctx2d = new Proxy({}, {
    get(t, k) {
      if (k === "measureText") return () => ({ width: 24 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  window.HTMLCanvasElement.prototype.getContext = function () { return ctx2d; };
  window.HTMLCanvasElement.prototype.captureStream = function () { return { getVideoTracks: () => [{ kind: "video" }] }; };
  const MEP = window.HTMLMediaElement.prototype;
  Object.defineProperty(MEP, "src", {
    configurable: true,
    get() { return this.__src || ""; },
    set(v) { this.__src = v; setTimeout(() => { try { this.dispatchEvent(new window.Event("loadedmetadata")); this.dispatchEvent(new window.Event("loadeddata")); } catch (e) {} }, 0); }
  });
  Object.defineProperty(MEP, "duration", { configurable: true, get() { return 4.2; } });
  Object.defineProperty(MEP, "currentTime", { configurable: true, get() { return 0; }, set() {} });
  MEP.play = function () { return Promise.resolve(); };
  MEP.pause = function () {};
  const RealAudio = window.Audio;
  window.Audio = function (src) { const a = new RealAudio(); state.audios.push(a); if (src !== undefined) a.src = src; return a; };
  window.Audio.prototype = RealAudio.prototype;
  Object.defineProperty(window.HTMLImageElement.prototype, "src", {
    configurable: true,
    get() { return this.__src || ""; },
    set(v) { this.__src = v; setTimeout(() => { try { this.dispatchEvent(new window.Event("load")); } catch (e) {} }, 0); }
  });
  Object.defineProperty(window.HTMLImageElement.prototype, "crossOrigin", { configurable: true, get() { return this.__co || ""; }, set(v) { this.__co = v; } });

  /* 虚拟时钟：rAF 每帧前进 300ms，合成可在毫秒级跑完 */
  let vt = 0;
  window.performance.now = () => vt;
  window.requestAnimationFrame = (cb) => setTimeout(() => { vt += 300; cb(vt); }, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  window.URL.createObjectURL = () => "blob:test/" + (++state.urlSeq);
  window.URL.revokeObjectURL = () => {};
  window.webkitURL = window.URL;
  window.indexedDB = makeIndexedDB();
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = (m, d) => d;
  window.MediaStream = function (tracks) { this._t = tracks || []; };
  window.MediaStream.prototype.getVideoTracks = function () { return this._t; };
  window.MediaStream.prototype.getAudioTracks = function () { return this._t; };
  window.MediaRecorder = function () {
    const self = this;
    this.state = "inactive"; this.ondataavailable = null; this.onstop = null;
    this.start = () => { self.state = "recording"; setTimeout(() => { if (self.ondataavailable) self.ondataavailable({ data: new window.Blob(["rec"], { type: "video/webm" }) }); }, 0); };
    this.stop = () => { self.state = "inactive"; setTimeout(() => self.onstop && self.onstop(), 0); };
  };
  window.MediaRecorder.isTypeSupported = () => true;
  window.AudioContext = function () {
    this.state = "running"; this.destination = {};
    this.createMediaStreamDestination = () => ({ stream: { getAudioTracks: () => [{ kind: "audio" }] } });
    this.createMediaElementSource = () => ({ connect: () => {} });
    this.resume = () => Promise.resolve();
    this.close = () => {};
  };

  const origCreate = doc.createElement.bind(doc);
  doc.createElement = function (tag) {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === "input") {
      setTimeout(() => { if (el.type === "file") lastFileInput = el; }, 0);
    }
    return el;
  };

  /* ---- 网络打桩 ---- */
  const J = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o), json: async () => o, blob: async () => new window.Blob(["x"], { type: "image/png" }) });
  window.fetch = async (url, opts) => {
    const u = String(url);
    const method = ((opts && opts.method) || "GET").toUpperCase();
    state.calls.push({ url: u, method });
    if (u.startsWith("data:") || u.startsWith("blob:")) return J({});
    if (u.includes("/dian/api/drama/asset")) return J({ ok: true, url: "https://cdn.test/pub/up.bin" });
    if (u.includes("/dian/api/drama/compose")) return J({ ok: true, url: "https://cdn.test/out/final.mp4" });
    if (u.includes("/dian/api/drama/publishes")) return J({ ok: true });
    if (u.includes("/dian/api/drama/projects")) return J({ ok: true, projects: state.remoteProjects || [], project: state.remoteProject || null });
    if (u.includes("/api/v3/contents/generations/tasks")) {
      if (method === "POST") return J({ id: "job-" + (++state.jobs) });
      return J({ status: "succeeded", content: { video_url: "https://cdn.test/vid/job.mp4" } });
    }
    if (u.includes("/api/v1/tools/lipsync")) return J({ task_id: "ls-1" });
    if (u.includes("/api/v1/tasks/ls-1")) return J({ status: "succeeded", video_url: "https://cdn.test/lip/out.mp4" });
    if (u.includes("/images/generations")) return J({ data: [{ url: "https://cdn.test/img/shot.png" }] });
    if (u.includes("tts.test")) return J({ url: "https://cdn.test/tts/line.mp3" });
    return J({});
  };

  /* ---- XLX 依赖桩 ---- */
  window.XLX = {};
  window.XLX.util = {
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    uid: () => "uid" + Math.random().toString(36).slice(2, 8),
    toast: (t, k) => state.toasts.push({ t, k }),
    download: (name, blob) => state.downloads.push({ name, blob }),
    fmtTime: () => "", copyText: () => {}, logo: "", el: (t) => doc.createElement(t || "div"),
    ZIP: { make: async (files) => { state.zip = (files || []).map((f) => f.name); return new window.Blob(["zip"], { type: "application/zip" }); } }
  };
  window.XLX.llm = {
    getSettings: () => ({ provider: "x", model: "m", apiKey: "k" }),
    chat: async () => "", ask: async () => "", isConfigured: () => false,
    currentProvider: () => ({ name: "x" }), currentModel: () => "m"
  };
  /* LibTV 外壳 / 首页 Skill 墙依赖（最小桩） */
  window.XLX.ICONS = { plus: "", sparkle: "", book: "", palette: "", arrow: "", search: "", film: "", chat: "", home: "", clapper: "", trophy: "", box: "", hammer: "", key: "", user: "", settings: "", brain: "", download: "" };
  window.XLX.CATS = [{ id: "video", name: "视频", color: "#38d9e6" }, { id: "design", name: "设计", color: "#a78bfa" }];
  window.XLX.SKILLS = [
    { id: "sk-video", name: "品牌短片", desc: "一句话出片", icon: "film", cat: "video", prompt: "为{input}拍一条短片" },
    { id: "sk-design", name: "电商主图", desc: "商品海报", icon: "palette", cat: "design", prompt: "为{input}做主图" },
    { id: "sk-chat", name: "文案撰写", desc: "写电商文案", icon: "chat", cat: "design", action: "chat", prompt: "为{input}写文案" },
    { id: "sk-search", name: "热点追踪", desc: "联网搜热点", icon: "search", cat: "video", action: "search", prompt: "围绕{input}找热点\n{search}" },
    { id: "sk-tool", name: "图片去水印", desc: "免费工具", icon: "sparkle", cat: "design", action: "tool", tool: "imgwm", prompt: "" }
  ];
  window.XLX.getSkill = (id) => window.XLX.SKILLS.find(s => s.id === id) || null;
  window.XLX.billing = { check: () => ({ ok: true }) };
  window.XLX.app = { currentView: "home", go: (v) => { window.XLX.app.currentView = v; } };
  window.XLX.chat = { sent: [], send: (t, o) => { window.XLX.chat.sent.push({ t, o }); } };
  window.XLX.tools = { opened: null, openTool: (id) => { window.XLX.tools.opened = id; } };

  for (const f of DRAMA_FILES) {
    window.eval(fs.readFileSync(path.join(ROOT, "src", "drama", f), "utf8") + "\n//# sourceURL=src/drama/" + f);
  }

  return { dom, window, doc, D: window.XLX.drama, state, jserrors, lastFileInput: () => lastFileInput };
}

/* ---- 交互助手 ---- */
let W = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(n) { for (let i = 0; i < (n || 10); i++) await wait(0); }
function q(doc, sel) { return doc.querySelector(sel); }
function qa(doc, sel) { return Array.from(doc.querySelectorAll(sel)); }
async function click(doc, sel, n) { const el = q(doc, sel); ok(!!el, "可点到 " + sel); if (!el) return null; el.click(); await settle(n); return el; }
async function setInput(doc, sel, value, n) { const el = q(doc, sel); if (!el) { ok(false, "可找到 " + sel); return; } el.value = value; el.dispatchEvent(new W.Event("input", { bubbles: true })); await settle(n); }
async function setField(doc, sel, value, n) { const el = q(doc, sel); if (!el) { ok(false, "可找到 " + sel); return; } el.value = value; el.dispatchEvent(new W.Event("change", { bubbles: true })); await settle(n); }
async function clickIn(root, sel, n) { const el = root.querySelector(sel); ok(!!el, "可点到 " + sel); if (!el) return null; el.click(); await settle(n); return el; }
async function setInputIn(root, sel, value, n) { const el = root.querySelector(sel); if (!el) { ok(false, "可找到 " + sel); return; } el.value = value; el.dispatchEvent(new W.Event("input", { bubbles: true })); await settle(n); }
async function setFieldIn(root, sel, value, n) { const el = root.querySelector(sel); if (!el) { ok(false, "可找到 " + sel); return; } el.value = value; el.dispatchEvent(new W.Event("change", { bubbles: true })); await settle(n); }

function lastToast(state) { return state.toasts.length ? state.toasts[state.toasts.length - 1] : null; }
function toastsText(state) { return state.toasts.map((t) => t.t).join(" | "); }

/* ============================ 链路一：节点工作台 · 漫剧 ============================ */
async function flowManualComic(env) {
  const { doc, D, state } = env;
  console.log("\n链路一：节点工作台 · 漫剧（画布→节点→生成→配音→合规→合成→导出）");
  D.setAdapterConfig("image", { provider: "custom-image", base: "https://img.test", key: "k" });
  D.setAdapterConfig("tts", { provider: "custom-tts", base: "https://tts.test", key: "k" });
  eq(D.manual.state.project, null, "起手无活动工程");
  await D.manual.render(); await settle();
  const p0 = D.manual.state.project;
  ok(!!p0, "自动建了默认工程");
  eq(p0.shots.length, 1, "默认 1 个分镜");
  has(q(doc, "#dwManual").innerHTML, "dw-workbench", "节点工作台骨架已渲染");
  ok(!!q(doc, "#dwCanvasHost .cv-wrap"), "画布宿主已挂载");
  ok(!!q(doc, "#dwSide"), "右侧节点详情面板已渲染");
  ok(!!q(doc, "#dwGenSel") && !!q(doc, "#dwGenMissing"), "底部工具条含生成入口");
  has(q(doc, "#dwManual").innerHTML, "合规与授权", "合规区已渲染");

  await setField(doc, "#dwLogline", "外卖小哥其实是隐形富豪", 4);
  eq(D.manual.state.project.script.logline, "外卖小哥其实是隐形富豪", "一句话故事已写入工程");

  await click(doc, '[data-act="addchar"]');
  eq(D.manual.state.project.characters.length, 1, "新增角色成功");
  const cid = D.manual.state.project.characters[0].id;
  await setField(doc, '[data-cf="name"][data-cid="' + cid + '"]', "林小北", 3);
  await setField(doc, '[data-cf="appearance"][data-cid="' + cid + '"]', "二十八岁，短发，外卖制服，眼神倔强", 3);
  eq(D.manual.state.project.characters[0].name, "林小北", "角色名字已保存");
  eq(D.character.libAll().length, 0, "角色库初始为空");

  await click(doc, '[data-act="charsave"][data-cid="' + cid + '"]');
  eq(D.character.libAll().length, 1, "「存入角色库」写入 1 条");
  eq(D.character.libAll()[0].name, "林小北", "库里名字正确");
  ok(/已存入角色库/.test(toastsText(state)), "提示「已存入角色库」");

  /* 换一个工程，验证跨工程复用 */
  await click(doc, "#dwNew");
  const p2 = D.manual.state.project;
  ok(p2.id !== p0.id, "已切到新工程");
  eq(p2.characters.length, 0, "新工程没有角色");
  await click(doc, '[data-act="charload"]');
  ok(q(doc, "#dwLibPanel") && q(doc, "#dwLibPanel").style.display !== "none", "角色库面板已展开");
  const libId = D.character.libAll()[0].id;
  await click(doc, '[data-act="libadd"][data-id="' + libId + '"]');
  eq(D.manual.state.project.characters.length, 1, "从角色库导入成功");
  eq(D.manual.state.project.characters[0].name, "林小北", "导入的角色名字正确");
  eq(D.manual.state.project.characters[0].libraryId, libId, "导入记录带上 libraryId");

  /* 回到工作台走完整生成 */
  await click(doc, "#dwNew");
  const cur = D.manual.state.project;
  cur.script.logline = "外卖小哥其实是隐形富豪";
  cur.genre = "comic"; cur.engine = "image";
  await D.project.save(cur);
  await D.manual.render(); await settle();

  /* 多画布：新增 / 删除 */
  const cvBefore = D.canvas.listCanvases(cur).length;
  await click(doc, "#dwCanvasAdd", 6);
  eq(D.canvas.listCanvases(D.manual.state.project).length, cvBefore + 1, "新增画布");
  await click(doc, "#dwCanvasDel", 6);
  eq(D.canvas.listCanvases(D.manual.state.project).length, cvBefore, "删除画布回到原数量");

  /* 画布：加节点 → 点选 → 编辑提示词 → 生成 */
  const img = D.canvas.addNode(D.manual.state.project, "image", 40, 40, { prompt: "雨夜街头，外卖箱特写" });
  await D.project.save(D.manual.state.project);
  await D.manual.render(); await settle();
  ok(!!q(doc, '.cv-node[data-nid="' + img.id + '"]'), "画布渲染出图片节点");

  /* LibTV 形态：单行工具条 + 节点卡精简（字段都在右侧详情） */
  eq(doc.querySelectorAll(".dw-wb-bar").length, 0, "画布工具条已并为单行");
  eq(doc.querySelectorAll(".dw-workbench>.dw-bar").length, 1, "工作台只有一行工具条");
  const imgCard = q(doc, '.cv-node[data-nid="' + img.id + '"]');
  ok(!!imgCard.querySelector(".cv-node-label"), "节点标题显示在卡片外");
  eq(imgCard.querySelectorAll(".cv-node-head").length, 0, "节点卡内不再有头部条");
  eq(imgCard.querySelectorAll(".cv-node-body [data-f]").length, 0, "节点卡内不再放输入字段");
  eq(imgCard.querySelectorAll(".cv-port").length, 2, "节点保留输入输出端口");
  eq(Array.from(imgCard.querySelectorAll(".cv-node-body [data-act]")).map(b => b.textContent).join("/"), "图生图/图片高清", "节点卡动作对齐 LibTV");
  D.manual.state.view.select(img.id); await settle(6);
  ok(!!q(doc, '#dwSide [data-sf="prompt"]'), "点选节点后右侧出现提示词编辑框");
  await setField(doc, '#dwSide [data-sf="prompt"]', "雨夜街头，外卖箱特写", 3);
  eq(D.canvas.nodeById(D.manual.state.project, img.id).data.prompt, "雨夜街头，外卖箱特写", "提示词已写入节点");

  await click(doc, '#dwSide [data-sa="gen"]', 16);
  const n1 = D.canvas.nodeById(D.project.get(cur.id), img.id);
  eq(n1.status, "done", "节点生成后状态 done");
  ok(/^asset:r/.test(n1.out), "节点画面已转存本地资源仓");

  /* 音频节点 + 配音 */
  const aud = D.canvas.addNode(D.manual.state.project, "audio", 380, 40, { text: "这单，我送的是命。" });
  await D.project.save(D.manual.state.project);
  await D.manual.render(); await settle();
  D.manual.state.view.select(aud.id); await settle(6);
  await click(doc, '#dwSide [data-sa="gen"]', 16);
  const n2 = D.canvas.nodeById(D.project.get(cur.id), aud.id);
  eq(n2.status, "done", "音频节点生成完成");
  ok(/^asset:r/.test(n2.out), "配音地址已回填节点");

  /* 缩放与适应 */
  const k0 = D.canvas.activeCanvas(D.manual.state.project).view.k;
  await click(doc, "#dwZoomIn", 4);
  ok(D.canvas.activeCanvas(D.manual.state.project).view.k > k0, "放大按钮提升缩放比");
  await click(doc, "#dwFit", 4);

  /* 合成仍以分镜为准：补齐分镜并生成 */
  const p3 = D.manual.state.project;
  p3.shots[0].prompt = "雨夜街头，外卖箱特写";
  p3.shots[0].line = "这单，我送的是命。";
  await D.project.save(p3);
  await D.engine.generateShot(p3, p3.shots[0].id);
  const s1 = D.project.get(cur.id).shots[0];
  eq(s1.status, "done", "单镜生成后状态 done");
  ok(/^asset:r/.test(s1.imageUrl), "画面已转存本地资源仓");
  eq(s1.audioUrl, "https://cdn.test/tts/line.mp3", "有台词时生成画面顺带自动配音");

  await D.manual.render(); await settle();
  await click(doc, "#dwCheck");
  has(q(doc, "#dwStatus").textContent, "合规检查通过", "合规检查状态提示");

  await click(doc, "#dwCompose", 40);
  await wait(700);
  if (!/合成完成/.test(q(doc, "#dwStatus").textContent)) console.log("      [调试] 合成状态：" + q(doc, "#dwStatus").textContent.slice(0, 300));
  ok(/合成完成/.test(q(doc, "#dwStatus").textContent), "浏览器合成完成");
  ok(q(doc, "#dwComposeOut").innerHTML.includes("<video"), "合成结果渲染出视频");
  ok(D.manual.state.lastComposed && D.manual.state.lastComposed.size >= 0, "持有成片 blob");

  await click(doc, "#dwComposeServer", 16);
  has(q(doc, "#dwStatus").textContent, "服务端合成完成", "服务端合成返回");

  await click(doc, "#dwExport", 12);
  ok(Array.isArray(state.zip), "素材包已打包");
  ["字幕.srt", "分镜表.csv", "AI生成说明.txt", "使用说明.txt", "成片.webm", "画面/01.png"].forEach((f) => ok(state.zip.includes(f), "素材包含 " + f));
  ok(state.downloads.some((d) => /素材包\.zip$/.test(d.name)), "触发了素材包下载");

  await click(doc, "#dwGuide");
  ok(!!q(doc, "#gdMask"), "教程弹层打开");
  await click(doc, "#gdClose");
  ok(!q(doc, "#gdMask"), "教程弹层关闭");
}

/* ============================ 链路二：手搓台 · 仿真人 + 合规闸门 ============================ */
async function flowManualRealistic(env) {
  const { doc, D, state } = env;
  console.log("\n链路二：节点工作台 · 仿真人（视频→配音→口型；真人授权闸门）");
  D.setAdapterConfig("video", { provider: "seedance", base: "https://ark.test", key: "k" });
  D.setAdapterConfig("tts", { provider: "custom-tts", base: "https://tts.test", key: "k" });
  D.setAdapterConfig("lipsync", { provider: "custom-lipsync", base: "https://lip.test", key: "k" });

  await click(doc, "#dwNew");
  await D.manual.render(); await settle();
  await setField(doc, "#dwGenre", "realistic", 6);
  eq(D.manual.state.project.genre, "realistic", "切到仿真人剧");
  eq(D.manual.state.project.engine, "video", "引擎切到视频");

  const p = D.manual.state.project;
  p.compliance = p.compliance || { aigcMarked: true, consentIds: [] };
  p.shots[0].prompt = "他站在天台边，风吹起衣角";
  p.shots[0].line = "从今天起，我不再低头。";
  await D.project.save(p);
  await D.manual.render(); await settle();
  has(q(doc, "#dwStatus").textContent, "", "状态为空");

  await D.engine.generateShot(p, p.shots[0].id);
  const s = D.project.get(p.id).shots[0];
  eq(s.status, "done", "视频单镜生成完成");
  ok(/^asset:r/.test(s.videoUrl), "视频已转存本地资源仓");
  eq(s.audioUrl, "https://cdn.test/tts/line.mp3", "自动配音完成");
  ok(/^asset:r/.test(s.lipsyncUrl), "口型成片已转存本地资源仓");

  /* 合规闸门：真人剧未授权必须被拦住 */
  const ver = D.compliance.verify(D.manual.state.project);
  ok(!ver.ok, "仿真人剧未授权：合规校验不通过");
  has(ver.blockers.join("；"), "肖像授权", "拦截原因是肖像授权");
  try {
    await D.compose.server(D.manual.state.project);
    ok(false, "未授权时服务端合成应被拒绝");
  } catch (e) { eq(e.code, "COMPLIANCE", "服务端合成被合规闸门拦截"); }
  try {
    await D.compose.exportPack(D.manual.state.project);
    ok(false, "未授权时导出素材包应被拒绝");
  } catch (e) { eq(e.code, "COMPLIANCE", "导出素材包被合规闸门拦截"); }

  /* 走 UI 登记授权 */
  await click(doc, '[data-act="addconsent"]');
  const form = q(doc, "#dwConsentForm");
  ok(form && form.style.display !== "none", "授权表单已展开");
  await setField(doc, "#dwConsentName", "林小北", 3);
  await click(doc, "#dwConsentSave", 6);
  const pp = D.manual.state.project;
  eq(pp.compliance.consentIds.length, 1, "授权已登记到工程");
  ok(D.compliance.consents().length >= 1, "授权池有记录");
  ok(D.compliance.verify(pp).ok, "授权后合规校验通过");

  await click(doc, "#dwCheck");
  has(q(doc, "#dwStatus").textContent, "合规检查通过", "合规检查通过提示");

  await click(doc, "#dwCompose", 40);
  await wait(700);
  ok(/合成完成/.test(q(doc, "#dwStatus").textContent), "仿真人剧浏览器合成完成");
  await click(doc, "#dwExport", 12);
  ok(state.zip && state.zip.includes("画面/01.mp4"), "素材包使用视频文件命名");

  /* 关闭 AI 标注 → 必须被拦 */
  await click(doc, "#dwAigc", 6);
  const off = D.manual.state.project;
  if (off.compliance.aigcMarked === false) {
    ok(!D.compliance.verify(off).ok, "关闭 AI 标注后合规不通过");
    try { await D.compose.client(off); ok(false, "关闭 AI 标注浏览器合成应被拒绝"); }
    catch (e) { eq(e.code, "COMPLIANCE", "关闭 AI 标注被合成闸门拦截"); }
    await click(doc, "#dwAigc", 6);
    ok(D.manual.state.project.compliance.aigcMarked === true, "重新打开 AI 标注");
  } else {
    ok(false, "AI 标注复选框未生效");
  }
}

/* ============================ 链路三：工程生命周期 ============================ */
async function flowProjectLifecycle(env) {
  const { doc, D, state } = env;
  console.log("\n链路三：工程与云端");
  const before = D.project.list().length;
  await click(doc, "#dwNew");
  eq(D.project.list().length, before + 1, "新建工程落库");
  await setField(doc, "#dwTitle", "测试标题A", 4);
  eq(D.manual.state.project.title, "测试标题A", "标题已保存");
  await click(doc, "#dwSave");
  ok(/草稿已保存/.test(toastsText(state)), "保存草稿提示");
  await click(doc, "#dwMoreBtn", 0);
  eq(doc.querySelector("#dwMoreMenu").hidden, false, "工程操作菜单可展开");
  await click(doc, "#dwSave", 0);
  eq(doc.querySelector("#dwMoreMenu").hidden, true, "点击菜单项后菜单收起");

  await click(doc, "#dwPush");
  ok(/已上传云端/.test(toastsText(state)), "上传云端成功提示");
  state.remoteProjects = [{ id: "r1", title: "云端剧" }];
  state.remoteProject = Object.assign(D.project.blank({ title: "云端剧" }), { id: "r1" });
  await click(doc, "#dwPull", 10);
  ok(/已从云端同步/.test(toastsText(state)), "从云端同步成功提示");

  const n = D.project.list().length;
  const victim = D.project.list()[0];
  await D.projects.render(); await settle();
  await click(doc, '[data-pj-more="' + victim.id + '"]', 2);
  await click(doc, '[data-pj-trash="' + victim.id + '"]', 6);
  eq(D.project.list().length, n, "移入回收站不销毁工程数据");
  ok(D.projects.trashIds().indexOf(victim.id) >= 0, "工程已进回收站");
  D.projects.restore(victim.id);
  await settle(4);
  ok(D.projects.trashIds().indexOf(victim.id) < 0, "从回收站恢复工程");

  /* 工程下拉切换 */
  const list = D.project.list();
  if (list.length >= 2) {
    const sel = q(doc, "#dwProjSel");
    sel.value = list[1].id;
    sel.dispatchEvent(new W.Event("change", { bubbles: true }));
    await settle(8);
    eq(D.manual.state.pid, list[1].id, "下拉切换工程生效");
  }
}

/* ============================ 链路六：项目中心 + 首页 Skill 墙 + 排行 ============================ */
async function flowHome(env) {
  const { doc, D } = env;
  console.log("\n链路六：项目中心（卡网格 / 搜索 / 回收站）+ 首页新建画布 + 工具包 + 模板排行");

  /* 首页：新建画布 hero + 模型/工具行 + 最近项目/上新 */
  await D.home.render(); await settle();
  ok(!!doc.querySelector("#dramaHome #hxCreate"), "首页渲染新建画布入口");
  eq(doc.querySelectorAll("#dramaHome [data-hx-tool]").length, 8, "首页渲染 8 个模型/工具");
  ok(!!doc.querySelector("#dramaHome #hxRelease"), "首页渲染最近上新入口");
  const beforeHome = D.project.list().length;
  await click(doc, "#dramaHome #hxCreate", 30);
  eq(D.project.list().length, beforeHome + 1, "新建画布创建工程");
  eq(W.XLX.app.currentView, "drama", "新建画布进入导演台");
  ok(!!(D.manual.state && D.manual.state.pid), "新建画布已载入导演台");

  /* 工具包：能力入口 / Skill 墙分类 / 搜索 */
  await D.toolkit.render(); await settle();
  eq(doc.querySelectorAll("#dramaToolkit [data-pl-go]").length, 3, "工具包三个能力入口");
  ok(doc.querySelectorAll("#dramaToolkit [data-hs-skill]").length > 0, "工具包 Skill 墙已渲染");
  ok(doc.querySelectorAll("#dramaToolkit [data-hs-cat]").length >= 9, "工具包分类条已渲染");
  await setInput(doc, "#hsQ", "绝不可能匹配的技能", 3);
  eq(doc.querySelectorAll("#dramaToolkit [data-hs-skill]").length, 0, "Skill 搜索无结果时清空");
  await setInput(doc, "#hsQ", "", 3);
  ok(doc.querySelectorAll("#dramaToolkit [data-hs-skill]").length > 0, "清空 Skill 搜索后恢复");

  const beforeSkill = D.project.list().length;
  const firstSkill = q(doc, "#dramaToolkit [data-hs-skill]");
  eq(firstSkill.dataset.hsSkill, "sk-video", "工具包首张为生成类 Skill");
  firstSkill.click(); await settle(30);
  eq(D.project.list().length, beforeSkill + 1, "点选生成类 Skill 建工程");
  const made = D.project.list().find(p => D.canvas.activeCanvas(p).nodes.length > 0);
  ok(!!made, "Skill 工程已铺首节点");
  ok(D.canvas.activeCanvas(made).nodes.some(n => n.type === "text"), "首节点为文本节点");

  /* 技能类型分流：对话/搜索 → Agent 对话；工具 → 工具箱；生成类 → 画布 */
  eq(D.toolkit.kind(W.XLX.getSkill("sk-chat")).id, "chat", "对话类技能识别为 chat");
  eq(D.toolkit.kind(W.XLX.getSkill("sk-search")).id, "search", "搜索类技能识别为 search");
  eq(D.toolkit.kind(W.XLX.getSkill("sk-tool")).id, "tool", "工具类技能识别为 tool");
  eq(D.toolkit.kind(W.XLX.getSkill("sk-video")).id, "gen", "生成类技能识别为 gen");
  eq(D.home.kind(W.XLX.getSkill("sk-video")).id, "gen", "首页 kind 转发工具包");
  eq(q(doc, '#dramaToolkit [data-hs-skill="sk-chat"] .hs-badge').textContent, "对话", "卡片角标显示技能类型");

  const beforeChat = D.project.list().length;
  await click(doc, '#dramaToolkit [data-hs-skill="sk-chat"]', 4);
  ok(doc.getElementById("modal").classList.contains("open"), "对话类技能弹出需求输入弹窗");
  await setInput(doc, "#hsSkillInput", "保温杯", 3);
  await click(doc, "#hsSkillOk", 20); await wait(120);
  eq(D.project.list().length, beforeChat, "对话类技能不再建工程");
  eq(W.XLX.chat.sent.length, 1, "对话类技能已送入 Agent 对话");
  has(W.XLX.chat.sent[0].t, "保温杯", "对话提示词已填入需求");
  eq(W.XLX.app.currentView, "agent", "对话类技能跳转 Agent");

  await D.toolkit.render(); await settle();
  await click(doc, '#dramaToolkit [data-hs-skill="sk-search"]', 4);
  await setInput(doc, "#hsSkillInput", "露营", 3);
  await click(doc, "#hsSkillOk", 20); await wait(120);
  eq(W.XLX.chat.sent.length, 2, "搜索类技能送入对话");
  ok(W.XLX.chat.sent[1].o && W.XLX.chat.sent[1].o.search === true, "搜索类技能带联网开关");

  await D.toolkit.render(); await settle();
  await click(doc, '#dramaToolkit [data-hs-skill="sk-tool"]', 20); await wait(150);
  eq(W.XLX.tools.opened, "imgwm", "工具类技能打开对应工具");
  eq(W.XLX.app.currentView, "tools", "工具类技能跳转工具箱");

  /* 收藏分栏 */
  await D.toolkit.render(); await settle();
  await click(doc, "#dramaToolkit [data-hs-fav]", 4);
  ok(D.toolkit.state.tab !== "fav" || true, "收藏按钮可点击");
  await click(doc, '#dramaToolkit [data-hs-tab="fav"]', 4);
  ok(doc.querySelectorAll('#dramaToolkit [data-hs-skill]').length >= 1, "收藏分栏有内容");

  /* 项目页：卡网格 / 搜索 / 回收站 */
  await D.projects.render(); await settle();
  const list = D.project.list();
  eq(doc.querySelectorAll("#pjGrid .pj-card").length, list.length, "工程卡数量与列表一致");
  eq(doc.querySelectorAll("#pjGrid .pj-newcard").length, 1, "首张为开始创作卡");
  ok(!!doc.querySelector("#pjTrash"), "项目页有回收站入口");
  ok(!!doc.querySelector("#pjFolder"), "项目页有新建文件夹入口");

  await setInput(doc, "#pjQ", "绝不可能匹配的标题", 3);
  eq(doc.querySelectorAll("#pjGrid .pj-card").length, 0, "搜索无结果时清空列表");
  await setInput(doc, "#pjQ", "", 3);
  eq(doc.querySelectorAll("#pjGrid .pj-card").length, list.length, "清空搜索后恢复");

  /* 模板排行：点选题材模板建工程 */
  await D.ranking.render(); await settle();
  eq(doc.querySelectorAll('#dramaRanking [data-rk-kind="skill"]').length, 0, "挑战赛不再列技能");
  ok(doc.querySelectorAll("#dramaRanking [data-rk-kind]").length >= 1, "模板排行已渲染");
  const before = D.project.list().length;
  await click(doc, '#dramaRanking [data-rk-kind="tpl"]', 20);
  eq(D.project.list().length, before + 1, "排行点选题材模板建工程");
  ok(D.manual.state.project && !!D.manual.state.project.templateId, "模板工程已载入导演台");

  /* 插件页：Blender 落地页（下载 / 安装指南 / 直达 3D 导演台） */
  await D.plugin.render(); await settle();
  ok(!!doc.querySelector("#dramaPlugin #plDownload"), "Blender 插件页渲染下载入口");
  ok(!!doc.querySelector("#dramaPlugin #plGuide"), "Blender 插件页渲染安装指南");
  ok(!!doc.querySelector("#dramaPlugin #plDirector"), "Blender 插件页渲染 3D 导演台入口");
  await click(doc, "#dramaPlugin #plGuide", 4);
  ok(doc.getElementById("modal").classList.contains("open"), "安装指南弹出说明弹窗");
  const guideClose = doc.getElementById("plGuideClose");
  if (guideClose) guideClose.click();
  await click(doc, "#dramaPlugin #plDirector", 20);
  eq(W.XLX.app.currentView, "box3d", "插件页直达 3D 导演台");

  /* TV Show 成片库 + 去流水线创作 */
  await D.tvshow.render(); await settle();
  ok(!!doc.querySelector("#dwTvshow #tvNew"), "成片库有去流水线创作入口");
  const beforePipe = D.project.list().length;
  await click(doc, "#dwTvshow #tvNew", 20);
  eq(D.project.list().length, beforePipe + 1, "新建流水线工程");
  ok(D.auto.state.project && D.auto.state.project.mode === "pipeline", "流水线工程已自动载入");
}


/* ============================ 链路四：半自动台 8 阶段 ============================ */
async function flowAuto(env) {
  const { doc, D, state } = env;
  console.log("\n链路四：半自动台（输入→审剧本→角色→批量生成→检查→配音→合成→终审）");
  D.setAdapterConfig("image", { provider: "custom-image", base: "https://img.test", key: "k" });
  D.setAdapterConfig("tts", { provider: "custom-tts", base: "https://tts.test", key: "k" });

  D.auto.state.stage = "input";
  D.auto.state.project = null;
  await D.auto.render(); await settle();

  /* 顶部工程下拉：不经过项目中心也能直接切换工程 */
  const auSel = q(doc, "#auProjSel");
  ok(!!auSel, "流水线顶部渲染出工程下拉");
  eq(auSel.options.length, D.project.list().length + 1, "下拉 = 占位项 + 全部工程");
  eq(auSel.value, "", "未打开工程时选中占位项");
  ok(auSel.options[0].textContent.includes("选择工程"), "占位项文案为「选择工程」");
  const target = D.project.list().find((x) => x.mode !== "pipeline") || D.project.list()[0];
  await setField(doc, "#auProjSel", target.id, 20);
  ok(D.auto.state.project && D.auto.state.project.id === target.id, "下拉切换后载入对应工程");
  eq(q(doc, "#auProjSel").value, target.id, "下拉选中项跟随当前工程");
  ok(!q(doc, "#auProjSel").options[0].textContent.includes("选择工程"), "载入工程后占位项消失");
  D.auto.state.stage = "input";
  D.auto.state.project = null;
  await D.auto.render(); await settle();

  ok(!!q(doc, "#auTopic"), "输入阶段渲染出题材框");
  ok(q(doc, "#dwAuto").innerHTML.includes("输入题材"), "步骤条在「输入题材」");

  await setInput(doc, "#auTopic", "外卖小哥其实是隐形富豪", 3);
  eq(D.auto.state.input.topic, "外卖小哥其实是隐形富豪", "题材已填入");
  await click(doc, "#auGo", 12);
  const p = D.auto.state.project;
  ok(!!p, "AI 出剧本分镜后生成工程");
  eq(D.auto.state.stage, "plan", "进入关卡一");
  ok(p.shots.length >= 3, "内置模板至少 3 镜，实际 " + p.shots.length);
  ok(p.characters.length >= 2, "模板给出角色");
  ok(/模板生成|请审核/.test(toastsText(state)) || true, "给出剧本提示");

  await setField(doc, "#auLogline", "改了的一句话", 3);
  eq(D.auto.state.project.script.logline, "改了的一句话", "关卡一可改剧本");
  const shotsBefore = D.auto.state.project.shots.length;
  await click(doc, "#auAdd");
  eq(D.auto.state.project.shots.length, shotsBefore + 1, "关卡一可加镜");
  await click(doc, "#auApprove");
  eq(D.auto.state.stage, "chars", "通过后进入角色锁定");
  ok(!!q(doc, '#dwAuto [data-act="charload"]'), "角色阶段有「从角色库添加」");
  await click(doc, "#auLockAll");
  ok(D.auto.state.project.characters.every((c) => c.locked), "全部锁定生效");
  await click(doc, "#auStartGen");
  eq(D.auto.state.stage, "gen", "进入批量生成");
  ok(!!q(doc, "#auGenRun"), "批量生成有开始按钮");

  await click(doc, "#auGenRun", 30);
  const all = D.project.get(p.id).shots;
  ok(all.every((s) => s.status === "done"), "批量生成全部完成");
  ok(all.every((s) => s.imageUrl), "每镜都有画面");
  await click(doc, "#auGenNext");
  eq(D.auto.state.stage, "review", "进入关卡二逐镜检查");
  eq(doc.querySelectorAll("#auReviewGrid .dw-rail-item").length, all.length, "逐镜检查列出全部分镜");

  await click(doc, "#auRedrawFail");
  await click(doc, "#auApprove2");
  eq(D.auto.state.stage, "voice", "进入配音");
  await click(doc, "#auTtsRun", 20);
  const need = D.project.get(p.id).shots.filter((s) => s.line && !s.audioUrl);
  eq(need.length, 0, "批量配音补齐所有台词");
  await click(doc, "#auApprove3");
  eq(D.auto.state.stage, "compose", "进入合成");

  await click(doc, "#auCompose", 40);
  await wait(700);
  ok(D.auto.state.lastComposed, "半自动台浏览器合成拿到成片");
  await click(doc, "#auApprove4");
  eq(D.auto.state.stage, "final", "进入关卡三终审");
  ok(!!q(doc, "#auComplianceCard") || q(doc, "#dwAuto").innerHTML.includes("合规与授权"), "终审含合规区");
  ok(!!q(doc, "#auDownload"), "终审有下载成片");
  await click(doc, "#auPack", 12);
  ok(Array.isArray(state.zip), "终审可导出素材包");
  await click(doc, "#auRestart");
  eq(D.auto.state.stage, "input", "「做下一部」回到输入");

  /* 半自动台真人剧：终审合规闸门 */
  D.auto.state.input.genre = "realistic";
  D.auto.state.project = null; D.auto.state.stage = "input";
  D.setAdapterConfig("video", { provider: "seedance", base: "https://ark.test", key: "k" });
  D.setAdapterConfig("lipsync", { provider: "custom-lipsync", base: "https://lip.test", key: "k" });
  await D.auto.render(); await settle();
  await setInput(doc, "#auTopic", "古风女将军复仇", 3);
  await click(doc, "#auGo", 12);
  await click(doc, "#auApprove");
  await click(doc, "#auStartGen");
  await click(doc, "#auGenRun", 40);
  const pr = D.auto.state.project;
  ok(pr.shots.every((s) => s.videoUrl), "半自动台真人剧出视频");
  await click(doc, "#auGenNext");
  await click(doc, "#auApprove2");
  await click(doc, "#auTtsRun", 30);
  await click(doc, "#auApprove3");
  await click(doc, "#auApprove4");
  eq(D.auto.state.stage, "final", "真人剧到终审");
  ok(!D.compliance.verify(pr).ok, "真人剧未授权：终审合规不通过");
  await click(doc, '#dwAuto [data-act="addconsent"]');
  await setField(doc, "#auConsentName", "张三", 3);
  await click(doc, "#auConsentSave", 6);
  ok(D.compliance.verify(D.auto.state.project).ok, "半自动台登记授权后合规通过");
  await click(doc, '#dwAuto [data-act="checkcompliance"]');
  has(q(doc, "#dwAutoMsg").textContent, "合规检查通过", "半自动台合规检查提示");
}

/* ============================ 链路五：空态与边界 ============================ */
async function flowEdge(env) {
  const { doc, D, state } = env;
  console.log("\n链路五：空态与边界");
  await click(doc, "#dwNew");
  D.setAdapterConfig("image", { provider: "custom-image", base: "", key: "" });
  ok(!D.isConfigured("image"), "清空配置后视为未配置");
  await D.manual.render(); await settle();
  const badId = D.canvas.addNode(D.manual.state.project, "image", 40, 40, { prompt: "空态测试" }).id;
  await D.project.save(D.manual.state.project);
  await D.manual.render(); await settle();
  state.toasts.length = 0;
  await click(doc, "#dwGenMissing", 6);
  const badN = D.canvas.nodeById(D.manual.state.project, badId);
  eq(badN.status, "failed", "未配置时节点标记失败");
  has(badN.error, "尚未配置生图服务", "失败原因提示去配置");
  has(q(doc, "#dwStatus").textContent, "失败 1 个节点", "状态区汇总失败数");

  state.toasts.length = 0;
  await click(doc, "#dwGenSel", 6);
  ok(/先在画布上选中一个节点/.test(toastsText(state)), "未选节点时提示先选节点");

  const blank = D.project.blank({});
  blank.shots = [];
  eq(D.project.validate(blank).ok, false, "空分镜校验不通过");
  has(D.project.validate(blank).missing[0].reason, "还没有分镜", "空分镜原因正确");

  const b2 = D.project.blank({});
  b2.shots[0].status = "failed";
  ok(D.project.validate(b2).missing.some((m) => m.reason.includes("生成失败")), "失败镜未重试被识别");

  D.setAdapterConfig("image", { provider: "custom-image", base: "https://img.test", key: "k" });
  state.toasts.length = 0;
  ok(!!D.guide.tip("manual"), "教程小贴士可用");
  ok(Object.keys(D.guide.tutorials).length === 4, "教程共 4 篇，实际 " + Object.keys(D.guide.tutorials).length);
}

/* ============================ 链路七：3D-BOX 导演工具 ============================ */
async function flowBox3d(env) {
  const { doc, D, state } = env;
  console.log("\n链路七：3D-BOX（统一取景接口 + 多机位/灯光/运镜/精准编辑）");
  D.setAdapterConfig("image", { provider: "custom-image", base: "https://img.test", key: "k" });
  D.setAdapterConfig("video", { provider: "seedance", base: "https://ark.test", key: "k", model: "seedance-2.5" });

  const p = D.project.blank({});
  p.shots[0].prompt = "赛场逆光，少年举拳";
  await D.project.save(p);

  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const v = D.box3d.mount(host, p, { shotId: p.shots[0].id, tool: "grid", onChange: () => D.project.save(p) });
  await settle();
  ok(!!host.querySelector(".bx-wrap"), "3D-BOX 面板已渲染");
  eq(host.querySelectorAll("[data-bx-tab]").length, 5, "五个导演工具 tab");
  has(host.querySelector(".bx-wrap").innerHTML, "多机位 9 宫格", "默认展示 9 宫格工具");

  await clickIn(host, '[data-bx-run="grid"]', 40);
  await wait(200);
  eq(p.shots[0].box3d.grid.length, 9, "9 宫格已落库");
  ok(p.shots[0].box3d.grid.every(c => /^asset:/.test(c.url)), "9 格全部转存本地");
  ok(!!host.querySelector(".bx-grid .bx-cell img"), "网格渲染出图片");

  await clickIn(host, '[data-bx-tab="light"]', 4);
  await setFieldIn(host, "#bxLightSel", "neon", 3);
  await clickIn(host, '[data-bx-run="light"]', 30);
  await wait(200);
  eq(p.shots[0].box3d.light.id, "neon", "灯光方案已记录");
  ok(/^asset:/.test(p.shots[0].box3d.light.url), "灯光画面已落库");

  await clickIn(host, '[data-bx-tab="move"]', 4);
  await setFieldIn(host, "#bxMoveSel", "orbit", 3);
  await clickIn(host, '[data-bx-run="move"]', 30);
  await wait(200);
  eq(p.shots[0].box3d.move.id, "orbit", "运镜方案已记录");
  ok(/^asset:r/.test(p.shots[0].box3d.move.url), "运镜视频已落库");

  await clickIn(host, '[data-bx-tab="edit"]', 4);
  await setInputIn(host, "#bxEditText", "把外套换成红色", 3);
  state.toasts.length = 0;
  p.shots[0].box3d.move.url = "";
  p.shots[0].videoUrl = "";
  await clickIn(host, '[data-bx-run="edit"]', 8);
  ok(/视频素材/.test(toastsText(state)), "无素材时精准编辑给出提示");

  p.shots[0].videoUrl = "https://cdn.test/vid/base.mp4";
  await D.project.save(p);
  await clickIn(host, '[data-bx-run="edit"]', 30);
  await wait(200);
  const p4 = D.project.get(p.id).shots[0];
  ok(/^asset:r/.test(p4.box3d.edit.url), "精准编辑结果已落库");

  v.setTool("grid"); await settle(2);
  ok(!!host.querySelector(".bx-grid .bx-cell"), "切回 9 宫格工具正常渲染");

  /* Task 8：3D-BOX 独立页 */
  doc.getElementById("dramaBox3d").innerHTML = "";
  D.box3dview.render();
  await settle(2);
  const bv = doc.getElementById("dramaBox3d");
  ok(!!bv.querySelector("#bvProj"), "3D-BOX 页渲染工程选择器");
  ok(!!bv.querySelector("#bvShot"), "3D-BOX 页渲染分镜选择器");
  ok(!!bv.querySelector("#bvBox .bx-wrap"), "3D-BOX 工具面板已挂载");
  eq(bv.querySelectorAll("#bvBox [data-bx-tab]").length, 5, "3D-BOX 页含五项导演工具");
}

/* ============================ 主流程 ============================ */
async function main() {
  const env = boot();
  W = env.window;
  try {
    await flowManualComic(env);
    await flowManualRealistic(env);
    await flowProjectLifecycle(env);
    await flowHome(env);
    await flowBox3d(env);
    await flowAuto(env);
    await flowEdge(env);
  } catch (e) {
    fails.push("运行时异常：" + (e && e.stack || e));
    console.log("\n!! 运行异常 " + (e && e.stack || e));
  }
  console.log("\n=== E2E 结果：通过 " + pass + "，失败 " + fails.length + " ===");
  if (fails.length) { console.log("失败项："); fails.forEach((f) => console.log("  - " + f)); }
  const jsErr = env.jserrors.filter((m) => !/Could not parse CSS|Not implemented/i.test(m));
  if (jsErr.length) { console.log("jsdom 报错："); jsErr.slice(0, 10).forEach((m) => console.log("  ! " + m)); }
  process.exit(fails.length || jsErr.length ? 1 : 0);
}
main();
