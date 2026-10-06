/* 铜龙AI · 电商工作台（创作工作台 7 页）· 前端视图测试
 * 运行：node --test tests/ecom.test.js
 * 覆盖：导航/视图注册、7 页渲染结构、原型交互（卡片/chips/色板/开关/列表-画布切换）、共享通道。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
function src(file) { return fs.readFileSync(path.join(ROOT, "src/drama/ecom", file), "utf8"); }

const VIEW_FILES = ["ecom-home.js", "ecom-draw.js", "ecom-detail.js", "ecom-mainedit.js", "ecom-detailedit.js", "ecom-localize.js", "ecom-gallery.js"];
const ICON_IDS = ["home", "wand", "poster", "crop", "layers", "translate", "grid"];

function boot(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="ecomHomeView" class="view"></div>'
    + '<div id="ecomDrawView" class="view"></div>'
    + '<div id="ecomDetailView" class="view"></div>'
    + '<div id="ecomMainEditView" class="view"></div>'
    + '<div id="ecomDetailEditView" class="view"></div>'
    + '<div id="ecomLocalizeView" class="view"></div>'
    + '<div id="ecomGalleryView" class="view"></div>'
    + '<div id="toasts"></div></body></html>',
    { runScripts: "outside-only", url: "http://localhost/dian/" });
  const w = dom.window;
  w.__go = null;
  w.__toasts = [];
  w.XLX = {};
  w.XLX.util = {
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    toast: (m) => { w.__toasts.push(m); },
    fmtTime: (ts) => "T" + ts
  };
  w.XLX.ICONS = {};
  ICON_IDS.forEach(id => { w.XLX.ICONS[id] = '<path d="M1 1"/>'; });
  w.XLX.app = { go: (v) => { w.__go = v; } };
  w.XLX.drama = {};
  w.fetch = fetchImpl || (() => Promise.resolve({ ok: false, status: 404, json: async () => ({ ok: false }) }));
  w.eval(src("ecom-sprite.js"));
  w.eval(src("ecom.js"));
  VIEW_FILES.forEach(f => w.eval(src(f)));
  return { w, doc: w.document, EC: w.XLX.drama.ecom };
}

test("注册：导航 7 项、默认视图、视图容器齐备", () => {
  const { doc, EC } = boot();
  assert.equal(EC.NAV.length, 7, "导航 7 项");
  assert.deepEqual(EC.NAV.map(n => n.id),
    ["ecomHome", "ecomDraw", "ecomDetail", "ecomMainEdit", "ecomDetailEdit", "ecomLocalize", "ecomGallery"]);
  assert.equal(EC.VIEWS.length, 7, "视图键 7 个");
  assert.equal(EC.DEFAULT_VIEW, "ecomHome", "默认视图为工作台");
  assert.equal(EC.ZONE, "ecom", "分区键 ecom");
  EC.VIEWS.forEach(v => assert.ok(doc.getElementById(v + "View"), "存在容器 #" + v + "View"));
  assert.ok(EC.TITLES.ecomDraw, "顶栏标题已注册");
});

test("工作台：4 大入口 + 4 数据块 + 最近项目", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomHome");
  const el = doc.getElementById("ecomHomeView");
  assert.equal(el.querySelectorAll(".feature").length, 4, "4 个功能入口");
  assert.equal(el.querySelectorAll(".stat").length, 4, "4 个数据块");
  assert.match(el.querySelector(".page-head h1").textContent, /下午好|你好|早上好/, "问候语");
  assert.match(el.textContent, /AI 作图/, "含 AI 作图入口");
  assert.match(el.textContent, /跨境本地化/, "含跨境本地化入口");
  assert.ok(el.querySelector(".proj-grid, .proj-list, .project"), "最近项目区已渲染");
});

test("AI 作图：12 工具卡 + 灵感卡回填 prompt", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");
  assert.equal(el.querySelectorAll(".tool-card").length, 12, "12 个工具卡");
  assert.equal(el.querySelectorAll(".tool-card.on").length, 1, "默认选中 1 个工具");
  assert.equal(el.querySelectorAll(".insp-card").length, 6, "6 条灵感");
  assert.ok(el.querySelector(".prompt-box textarea"), "大白话输入框");
  assert.match(el.textContent, /Agent 模式/, "含 Agent 模式工具卡");

  const cards = el.querySelectorAll(".tool-card");
  cards[3].click();
  assert.equal(cards[3].classList.contains("on"), true, "点击工具卡选中");
  assert.equal(el.querySelectorAll(".tool-card.on").length, 1, "工具卡同组单选");

  const ta = el.querySelector("textarea");
  el.querySelector(".insp-card").click();
  assert.ok(ta.value.length > 0, "灵感卡回填 prompt");
});

test("AI 详情图：上传槽 + 要求框 + 风格 chips", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDetail");
  const el = doc.getElementById("ecomDetailView");
  assert.ok(el.querySelector(".dropzone"), "商品图上传槽");
  assert.ok(el.querySelector("textarea"), "补充要求文本框");
  assert.ok(el.querySelectorAll(".chip").length >= 4, "风格 chips");
  assert.ok(el.querySelector(".select"), "平台/语言选择器");
  assert.ok(el.querySelector(".gen-side"), "右侧空态说明");
});

test("主图编辑：列表/画布双模式切换 + 色板 + 开关", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomMainEdit");
  const el = doc.getElementById("ecomMainEditView");
  const seg = el.querySelector("[data-mode-group]");
  assert.ok(seg, "模式切换段");
  assert.equal(seg.querySelectorAll("button").length, 2, "列表/画布两个按钮");
  assert.equal(el.querySelector(".view-list").hidden, false, "默认列表可见");
  assert.equal(el.querySelector(".view-canvas").hidden, true, "默认画布隐藏");
  assert.ok(el.querySelectorAll(".module-row").length >= 4, "列表元素行");
  assert.ok(el.querySelector(".swatches .sw"), "色板");

  seg.querySelector('[data-mode="canvas"]').click();
  assert.equal(el.querySelector(".view-list").hidden, true, "切画布后列表隐藏");
  assert.equal(el.querySelector(".view-canvas").hidden, false, "切画布后画布可见");
  assert.ok(el.querySelector(".view-canvas .sq-el"), "画布元素已渲染");
});

test("详情页编辑：模块库 + 双模式", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDetailEdit");
  const el = doc.getElementById("ecomDetailEditView");
  assert.ok(el.querySelector("[data-mode-group]"), "模式切换段");
  assert.ok(el.querySelectorAll(".module-row").length >= 4, "模块行");
  assert.ok(el.querySelector(".view-canvas .ab-block"), "画布模块");
  el.querySelector('[data-mode="canvas"]').click();
  assert.equal(el.querySelector(".view-canvas").hidden, false, "切到画布");
});

test("跨境本地化：市场/语言 chips + 模特 + 配音开关 + 手机预览", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomLocalize");
  const el = doc.getElementById("ecomLocalizeView");
  assert.equal(el.querySelectorAll(".chips").length >= 2, true, "市场与语言两组 chips");
  assert.equal(el.querySelectorAll(".avchip").length, 4, "4 个模特族裔");
  assert.ok(el.querySelector(".switch"), "配音开关");
  assert.ok(el.querySelector(".phone"), "手机预览");

  const sw = el.querySelector(".switch");
  const before = sw.classList.contains("off");
  sw.click();
  assert.equal(sw.classList.contains("off"), !before, "开关可切换");
});

test("作品库：筛选 chips + 瀑布流 8 项 + 分页", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomGallery");
  const el = doc.getElementById("ecomGalleryView");
  assert.equal(el.querySelectorAll(".g-item").length, 8, "8 个作品");
  assert.ok(el.querySelectorAll(".chips .chip").length >= 4, "类型筛选");
  assert.ok(el.querySelector(".search"), "搜索框");
  assert.ok(el.querySelector(".pager"), "分页");
});

test("通道：api 走 /dian/api/ecom 且 go 委托 XLX.app", async () => {
  let seen = null;
  const { w, EC } = boot((url, opts) => {
    seen = { url, opts };
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, items: [] }) });
  });
  const j = await EC.api("GET", "/works");
  assert.equal(seen.url, "/dian/api/ecom/works", "接口前缀 /dian/api/ecom");
  assert.deepEqual(j, { ok: true, items: [] });
  EC.go("ecomDraw");
  assert.equal(w.__go, "ecomDraw", "go 委托给 app.go");
});

test("占位：未注册渲染器输出空态", () => {
  const { doc, w } = boot();
  w.document.body.insertAdjacentHTML("beforeend", '<div id="ecomGhostView" class="view"></div>');
  w.XLX.drama.ecom.render("ecomGhost");
  assert.match(doc.getElementById("ecomGhostView").textContent, /建设中/, "未注册视图显示空态");
});
