/* AI 短剧工作台 · LibTV 外壳测试
 * 运行：node --test tests/shell.test.js
 * 覆盖设计「Correctness Properties」5（导航一致）与 6（视图可挂载 / 路由回退），
 * 以及外壳导航定义、选中态唯一、钥匙/模型状态统计与降级。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
const SHELL_SRC = fs.readFileSync(path.join(ROOT, "src/drama/shell.js"), "utf8");

/* 从 index.html 中提取 XLX.app 路由闭包源码（不含 DOMContentLoaded 注册） */
function appSource() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf("XLX.app = (function () {");
  const end = html.indexOf('document.addEventListener("DOMContentLoaded", XLX.app.init);');
  assert.ok(start > -1 && end > start, "在 index.html 中定位 XLX.app 路由脚本");
  return html.slice(start, end);
}

function bootShell(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="shellNav"></div>'
    + '<div id="shellStatus"></div>'
    + '<div id="shellTop"></div>'
    + '</body></html>', { runScripts: "outside-only" });
  const w = dom.window;
  w.scrollTo = () => {};
  w.XLX = {};
  w.XLX.ICONS = {};
  w.XLX.app = { currentView: opts.currentView || "home", go(v) { w.XLX.app.currentView = v; } };
  w.XLX.vendorKeys = opts.vendorKeys || { all: () => [], isConfigured: () => false };
  w.XLX.catalog = opts.catalog || { KINDS: [], all: () => [] };
  w.XLX.drama = opts.drama || {};
  w.eval(SHELL_SRC);
  return { w, doc: w.document, shell: w.XLX.dramaShell };
}

function bootApp() {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="pageTitle"></div><div id="pageSub"></div><div id="providerPill"></div>'
    + '<div id="mobileNav"></div><div id="newChatBtn"></div>'
    + '<div id="sidebar"></div><div id="sidebarMask"></div>'
    + '<div id="dramaHome"></div><div id="agentView" class="view"></div>'
    + '</body></html>', { runScripts: "outside-only" });
  const w = dom.window;
  w.scrollTo = () => {};
  w.XLX = {};
  w.XLX.ICONS = {};
  w.XLX.llm = { currentProvider: () => ({ name: "测试平台" }), currentModel: () => "test-model" };
  w.XLX.dramaShell = { NAV: [], setActive: () => {} };
  w.XLX.drama = {};
  w.eval(appSource());
  return { w, app: w.XLX.app };
}

test("外壳：主导航与账号菜单定义稳定", () => {
  const { shell } = bootShell();
  assert.deepEqual(shell.NAV.map(x => x.id), [
    "newProject", "agent", "home", "projects", "assets", "tvshow", "ranking", "box3d", "plugin"
  ]);
  assert.equal(shell.NAV.filter(x => x.primary).length, 1, "只有一个主按钮");
  assert.equal(shell.NAV[0].primary, true);
  assert.deepEqual(shell.ACCOUNT.map(x => x.id), ["settings", "memory", "download"]);
  assert.equal(shell.NAV.find(x => x.id === "settings"), undefined, "设置不在主导航");
});

test("外壳：挂载渲染主按钮、导航项、状态条与账号区", () => {
  const { doc, shell } = bootShell();
  shell.mount();
  assert.ok(doc.querySelector("#shellCreate"), "渲染新建项目主按钮");
  const items = doc.querySelectorAll(".shell-nav-item");
  assert.equal(items.length, shell.NAV.length - 1, "主按钮不计入导航项");
  assert.deepEqual(Array.from(items).map(el => el.getAttribute("data-view")),
    shell.NAV.filter(x => !x.primary).map(x => x.id));
  assert.ok(doc.querySelector("#shellStatus #shellKeyText"), "渲染钥匙状态");
  assert.ok(doc.querySelector("#shellStatus #shellModelText"), "渲染模型状态");
  assert.ok(doc.querySelector("#shellTop #shellAccountBtn"), "渲染账号入口");
  assert.equal(doc.querySelectorAll("#shellTop .shell-menu-item").length, shell.ACCOUNT.length);
});

test("外壳：选中态唯一，未知视图不误选", () => {
  const { doc, shell } = bootShell();
  shell.mount();
  shell.setActive("projects");
  let active = doc.querySelectorAll(".shell-nav-item.active");
  assert.equal(active.length, 1);
  assert.equal(active[0].getAttribute("data-view"), "projects");

  shell.setActive("box3d");
  active = doc.querySelectorAll(".shell-nav-item.active");
  assert.equal(active.length, 1, "切换后旧选中态被清除");
  assert.equal(active[0].getAttribute("data-view"), "box3d");

  shell.setActive("不存在的视图");
  assert.equal(doc.querySelectorAll(".shell-nav-item.active").length, 0);
});

test("外壳：挂载默认按当前视图选中", () => {
  const { doc, shell } = bootShell({ currentView: "assets" });
  shell.mount();
  const active = doc.querySelector(".shell-nav-item.active");
  assert.ok(active);
  assert.equal(active.getAttribute("data-view"), "assets");
});

test("外壳：钥匙与模型状态统计正确", () => {
  const vendors = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const { shell } = bootShell({
    vendorKeys: { all: () => vendors, isConfigured: id => id !== "c" },
    catalog: { KINDS: ["image", "video"], all: k => (k === "image" ? [1, 2, 3] : [1]) }
  });
  const s = shell.status();
  assert.equal(s.keys, 2);
  assert.equal(s.totalKeys, 3);
  assert.equal(s.models, 4);
  assert.equal(s.keyText, "钥匙 2/3");
  assert.equal(s.modelText, "模型 4");
});

test("外壳：状态读取失败时降级为 0，不抛出", () => {
  const boom = () => { throw new Error("boom"); };
  const { shell } = bootShell({
    vendorKeys: { all: boom, isConfigured: boom },
    catalog: { KINDS: ["x"], all: boom }
  });
  const s = shell.status();
  assert.equal(s.keyText, "钥匙 0/0");
  assert.equal(s.modelText, "模型 0");
});

test("外壳：refresh 只更新状态文本，不重建导航", () => {
  let configured = 0;
  const vendors = [{ id: "a" }, { id: "b" }];
  const { doc, shell } = bootShell({
    vendorKeys: { all: () => vendors, isConfigured: id => (id === "a" ? configured >= 1 : configured >= 2) },
    catalog: { KINDS: ["image"], all: () => [1, 2] }
  });
  shell.mount();
  const menuRef = doc.querySelector("#shellTop .shell-menu-item");
  assert.equal(doc.querySelector("#shellKeyText").textContent, "钥匙 0/2");

  configured = 2;
  shell.refresh();
  assert.equal(doc.querySelector("#shellKeyText").textContent, "钥匙 2/2");
  assert.equal(doc.querySelector("#shellModelText").textContent, "模型 2");
  assert.equal(doc.querySelector("#shellTop .shell-menu-item"), menuRef, "账号区 DOM 未被重建");
});

test("路由：未知视图回退首页，合法视图正常切换", () => {
  const { app } = bootApp();
  app.go("projects");
  assert.equal(app.currentView, "projects");
  app.go("does-not-exist");
  assert.equal(app.currentView, "home", "未知视图回退首页");
  assert.ok(app.VIEWS.includes("box3d"));
});

test("路由：旧视图标识按兼容表映射", () => {
  const { app } = bootApp();
  app.go("chat");
  assert.equal(app.currentView, "agent");
  app.go("makeup");
  assert.equal(app.currentView, "assets");
  app.go("dramaHome");
  assert.equal(app.currentView, "projects");
});
