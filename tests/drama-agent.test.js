/* 短剧 Agent 测试
 * 运行：node --test tests/drama-agent.test.js
 * 覆盖：独立注册与存储、LibTV 首页结构、技能卡网格与点击、画布指令直连、想法落成画布工程。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/drama/dramaagent.js"), "utf8");

const SKILLS = [
  { id: "storyboard", name: "分镜脚本", desc: "专业分镜表格一键出", cat: "video", icon: "film", action: "gen" },
  { id: "dubbing", name: "多角色配音", desc: "不同音色演绎台词", cat: "video", icon: "mic", action: "gen" },
  { id: "poster-copy", name: "海报文案", desc: "活动主视觉文案", cat: "design", icon: "palette" },
  { id: "ecom-copy", name: "电商文案", desc: "商品卖点详情文案", cat: "ecom", icon: "cart", action: "chat" },
  { id: "weekly-report", name: "周报", desc: "把记录整理成周报", cat: "office", icon: "report", action: "chat" },
  { id: "code-gen", name: "代码生成", desc: "按需求写代码", cat: "dev", icon: "code", action: "chat" }
];

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><div id="dramaAgentView" class="view">'
    + '<div id="dramaAgent"></div></div><div id="modal"></div><div id="toasts"></div></body></html>',
    { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.AbortController = global.AbortController;

  const toasts = [];
  const goCalls = [];
  w.XLX = {};
  w.XLX.ICONS = {
    user: '<circle/>', plus: "", arrow: "", stop: "", film: "", chat: "", grid: "", trend: "",
    trophy: "", sparkle: "", book: "", palette: "", search: "", play: "", mic: "", cart: "", report: "", code: ""
  };
  w.XLX.util = {
    esc: (s) => String(s == null ? "" : s),
    toast: (m, t) => toasts.push({ m, t }),
    fmtTime: () => "10-09 10:00",
    logo: "",
    mdStream: (el) => { el.dataset.buf = ""; },
    appendDelta: (el, t) => { el.dataset.buf = (el.dataset.buf || "") + t; el.innerHTML = el.dataset.buf; },
    finalizeDelta: (el) => { el.innerHTML = el.dataset.buf || ""; },
    renderFull: (el, t) => { el.dataset.buf = t; el.innerHTML = t; }
  };
  w.XLX.llm = opts.llm || { isConfigured: () => false, chat: async () => "" };
  w.XLX.SKILLS = opts.skills || SKILLS;
  w.XLX.CATS = opts.cats || [];
  w.XLX.app = opts.app || { go: (v) => goCalls.push(v) };
  w.XLX.getSkill = (id) => (opts.skills || SKILLS).find((s) => s.id === id) || null;
  w.XLX.drama = opts.drama || {};

  w.eval(SRC);
  return { w, doc: w.document, D: w.XLX.drama.dramaAgent, toasts, goCalls };
}

test("短剧 Agent：独立注册，收藏与用量使用独立存储键", () => {
  const { w, D } = boot();
  assert.ok(D, "注册 XLX.drama.dramaAgent");
  assert.equal(D.K_FAV, "xlx_drama_agent_fav");
  assert.equal(D.K_USED, "xlx_drama_agent_used");
  assert.notEqual(D.K_FAV, "xlx_conversations", "与通用对话历史隔离");
});

test("短剧 Agent：渲染 LibTV 首页结构，且不含左侧对话列表", () => {
  const { doc, D } = boot();
  D.render();
  const host = doc.getElementById("dramaAgent");
  assert.ok(host.querySelector(".da-wrap"), "首页外壳");
  assert.ok(host.querySelector(".da-hero"), "大标题 hero");
  assert.match(host.querySelector(".da-hero-t").textContent, /说个想法/, "LibTV 标题文案");
  assert.ok(host.querySelector("#daInput"), "想法输入框");
  assert.ok(host.querySelector("#daSend"), "发送按钮");
  assert.equal(host.querySelectorAll("[data-da-tab]").length, 3, "Skill/收藏/我的 三个 tab");
  assert.ok(host.querySelectorAll("[data-da-cat]").length >= 9, "分类 pills >= 9");
  assert.ok(host.querySelector("#daGrid .da-card"), "技能卡网格");
  assert.equal(host.querySelector(".da-side"), null, "已去掉左侧对话列表");
  assert.equal(host.querySelector(".da-list"), null, "已去掉对话列表");
});

test("短剧 Agent：收藏切换持久化到独立键", () => {
  const { w, doc, D } = boot();
  D.render();
  const fav = doc.querySelector("#dramaAgent [data-da-fav]");
  fav.onclick({ stopPropagation() {} });
  const list = JSON.parse(w.localStorage.getItem("xlx_drama_agent_fav") || "[]");
  assert.equal(list.length, 1, "收藏写入 xlx_drama_agent_fav");
  assert.equal(w.localStorage.getItem("xlx_conversations"), null, "不污染通用对话存储");
});

test("短剧 Agent：点技能卡交给工具包引擎分流", () => {
  let opened = null;
  const drama = { toolkit: { openSkill: (s) => { opened = s.id; } } };
  const { doc, D } = boot({ drama });
  D.render();
  const card = doc.querySelector('#dramaAgent [data-da-skill="storyboard"]');
  assert.ok(card, "渲染出 skill 卡");
  card.onclick();
  assert.equal(opened, "storyboard", "点击交给 D.toolkit.openSkill");
});

test("短剧 Agent：画布指令直连 agent，不建工程", async () => {
  let handled = 0, refreshed = 0, created = 0;
  const drama = {
    agent: { canHandle: () => true, handle: async () => { handled++; return { reply: "已添加雨夜镜头", changed: true }; } },
    manual: { refreshCanvas: () => { refreshed++; }, load: async () => {} },
    project: { blank: () => { created++; return { id: "p1" }; }, save: async () => {} },
    canvas: { addNode: () => {} }
  };
  const { D, toasts } = boot({ drama });
  D.render();
  await D.send("加一个 5 秒的雨夜镜头");
  assert.equal(handled, 1, "命中画布指令直接交给 agent");
  assert.equal(refreshed, 1, "画布变更后刷新");
  assert.equal(created, 0, "画布指令不新建工程");
  assert.ok(toasts.some((t) => /雨夜镜头/.test(t.m)), "反馈操作结果");
});

test("短剧 Agent：非指令想法落成画布工程并进入画布", async () => {
  let added = null, saved = 0, loaded = 0, went = [];
  const drama = {
    agent: { canHandle: () => false },
    project: { blank: (o) => ({ id: "p9", title: o.title }), save: async () => { saved++; } },
    canvas: { addNode: (p, kind, x, y, o) => { added = { pid: p.id, kind, o }; } },
    manual: { load: async () => { loaded++; } }
  };
  const { D } = boot({ drama, app: { go: (v) => went.push(v) } });
  D.render();
  await D.send("一个外卖员穿越到古代当皇帝");
  assert.ok(added && added.kind === "text", "把想法作为灵感文本节点落画布");
  assert.match(added.o.text, /外卖员/, "节点带上原始想法");
  assert.equal(saved, 1, "保存工程");
  assert.equal(loaded, 1, "载入工程到画布");
  assert.ok(went.indexOf("drama") >= 0, "跳转到短剧画布");
});
