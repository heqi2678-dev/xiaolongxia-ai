/* 铜龙AI · 铺货板块 · 前端模块测试
 * 运行：node --test tests/dropship.test.js */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/drama/dropship.js"), "utf8");

function boot(fetchImpl, url) {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="toolsContent"></div><div id="toolPanel"></div><div id="toasts"></div></body></html>',
    { runScripts: "outside-only", url: url || "http://localhost/dian/" });
  const w = dom.window;
  w.calls = [];
  w.__toasts = [];
  w.XLX = { drama: {} };
  w.XLX.util = {
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    toast: (m, k) => { w.__toasts.push([m, k]); }
  };
  w.fetch = fetchImpl || ((url, opts) => {
    w.calls.push({ url: String(url), opts: opts || {} });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ products: [], platforms: [], tasks: [], adapters: ["mock"] }) });
  });
  w.eval(SRC);
  return { w, doc: w.document, DS: w.XLX.drama.dropship };
}

test("注册：命名空间与配置默认值", () => {
  const { DS } = boot();
  assert.ok(DS, "XLX.drama.dropship 已注册");
  assert.equal(DS.DEFAULT_BASE, "http://127.0.0.1:9150");
  assert.deepEqual(DS.getConfig(), {});
});

test("纯函数：normalizeBase 去尾斜杠、buildHeaders 带令牌", () => {
  const { DS } = boot();
  assert.equal(DS.normalizeBase("http://x:1/"), "http://x:1");
  assert.deepEqual(DS.buildHeaders({}), { "Content-Type": "application/json" });
  assert.deepEqual(DS.buildHeaders({ token: "t" }), { "Content-Type": "application/json", Authorization: "Bearer t" });
});

test("默认后端地址：线上页面自动指向站点 /dropship，本地回落 127.0.0.1", () => {
  const online = boot(null, "https://shop.example.com/dian/");
  assert.equal(online.DS.normalizeBase(""), "https://shop.example.com/dropship");
  const local = boot();
  assert.equal(local.DS.normalizeBase(""), "http://127.0.0.1:9150");
});

test("API：请求地址与鉴权头正确", async () => {
  const { w, DS } = boot();
  DS.setConfig({ backendUrl: "http://127.0.0.1:9150/", token: "abc" });
  await DS.API.health();
  await DS.API.listProducts();
  await DS.API.publish(["p1", "p2"], "taobao");
  assert.equal(w.calls[0].url, "http://127.0.0.1:9150/health");
  assert.equal(w.calls[1].url, "http://127.0.0.1:9150/api/products");
  assert.equal(w.calls[1].opts.headers.Authorization, "Bearer abc");
  assert.equal(w.calls[2].url, "http://127.0.0.1:9150/api/publish");
  assert.deepEqual(JSON.parse(w.calls[2].opts.body), { productIds: ["p1", "p2"], platform: "taobao" });
});

test("API：非 2xx 抛错并带后端错误信息", async () => {
  const { DS } = boot(() => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: "未授权" }) }));
  await assert.rejects(() => DS.API.listProducts(), /未授权/);
});

test("API：任务重试 / 图片归档 / 类目查询地址正确", async () => {
  const { w, DS } = boot();
  DS.setConfig({ backendUrl: "http://127.0.0.1:9150", token: "" });
  await DS.API.retryTask("t 1");
  await DS.API.localize("p1");
  await DS.API.categories("taobao");
  await DS.API.attributes("taobao", "50010850");
  assert.equal(w.calls[0].url, "http://127.0.0.1:9150/api/tasks/t%201/retry");
  assert.equal(w.calls[1].url, "http://127.0.0.1:9150/api/images/localize");
  assert.deepEqual(JSON.parse(w.calls[1].opts.body), { productId: "p1" });
  assert.equal(w.calls[2].url, "http://127.0.0.1:9150/api/adapters/taobao/categories");
  assert.equal(w.calls[3].url, "http://127.0.0.1:9150/api/adapters/taobao/attributes?cid=50010850");
});

test("API：授权链接与回调地址正确", async () => {
  const { w, DS } = boot();
  DS.setConfig({ backendUrl: "http://127.0.0.1:9150" });
  await DS.API.authorizeUrl("taobao");
  await DS.API.callback("taobao", "abc/def");
  assert.equal(w.calls[0].url, "http://127.0.0.1:9150/api/auth/taobao/authorize");
  assert.equal(w.calls[1].url, "http://127.0.0.1:9150/api/auth/taobao/callback?code=abc%2Fdef");
});

test("render：搜索框、编辑表单与失败任务重试按钮", async () => {
  const products = {
    total: 1,
    products: [{ id: "p1", title: "测试T恤", source: { platform: "1688", itemId: "1" }, images: { main: [{ url: "https://cbu01.alicdn.com/a.jpg" }] }, pricing: { price: 29.9 }, category: { target: {} } }]
  };
  const platforms = { platforms: [{ id: "mock", label: "本地模拟", authorized: true }] };
  const tasks = { tasks: [{ id: "t9", productId: "p1", platform: "mock", status: "failed", lastError: "类目缺失" }] };
  const { w, doc } = boot((url) => {
    w.calls.push({ url: String(url) });
    if (/\/api\/products/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => products });
    if (/\/api\/platforms/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => platforms });
    if (/\/api\/tasks/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => tasks });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  const panel = doc.getElementById("toolPanel");
  w.XLX.drama.dropship.render(panel);
  await new Promise(r => setTimeout(r, 0));
  assert.ok(doc.querySelector("#dpSearch"), "有搜索框");
  assert.ok(doc.querySelector("#dpSource"), "有来源筛选");
  assert.ok(doc.querySelector("[data-edit='p1']"), "有编辑按钮");
  assert.ok(doc.querySelector("[data-editbox='p1'] [data-f='catId']"), "编辑表单含类目字段");
  assert.ok(doc.querySelector("[data-del='p1']"), "有删除按钮");
  assert.ok(doc.querySelector("[data-retry='t9']"), "失败任务有重试按钮");
});

test("render：筛选条件拼接到列表请求", async () => {
  const { w, doc } = boot((url) => {
    w.calls.push({ url: String(url) });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ products: [], total: 0, platforms: [], tasks: [] }) });
  });
  const panel = doc.getElementById("toolPanel");
  w.XLX.drama.dropship.render(panel);
  await new Promise(r => setTimeout(r, 0));
  doc.getElementById("dpSearch").value = "T恤";
  doc.getElementById("dpSource").value = "1688";
  doc.getElementById("dpQuery").onclick();
  await new Promise(r => setTimeout(r, 0));
  const listCall = w.calls.map(c => c.url).filter(u => /\/api\/products\?/.test(u)).pop();
  assert.ok(/q=T%E6%81%A4/.test(listCall), "请求带 q");
  assert.ok(/source=1688/.test(listCall), "请求带 source");
});

test("保存设置后自动重新拉取货源库", async () => {
  const { w, doc } = boot((url) => {
    w.calls.push({ url: String(url) });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ products: [], total: 0, platforms: [], tasks: [] }) });
  });
  const panel = doc.getElementById("toolPanel");
  w.XLX.drama.dropship.render(panel);
  await new Promise(r => setTimeout(r, 0));
  const before = w.calls.filter(c => /\/api\/products/.test(c.url)).length;
  doc.getElementById("dpToken").value = "t";
  doc.getElementById("dpSave").onclick();
  await new Promise(r => setTimeout(r, 0));
  const after = w.calls.filter(c => /\/api\/products/.test(c.url)).length;
  assert.ok(after > before, "保存后重新拉取列表");
});

test("render：渲染配置条、平台授权与货源库", async () => {
  const products = {
    products: [{ id: "p1", title: "测试T恤", source: { platform: "1688", itemId: "1" }, images: { main: [{ url: "https://cbu01.alicdn.com/a.jpg" }] }, pricing: { price: 29.9 }, category: { target: { id: "50000000" } } }]
  };
  const platforms = { platforms: [{ id: "taobao", label: "淘宝/天猫", authorized: false }, { id: "mock", label: "本地模拟", authorized: true }] };
  const tasks = { tasks: [{ id: "t1", productId: "p1", platform: "mock", status: "success", platformItemId: "MOCK-1" }] };
  const { w, doc } = boot((url) => {
    w.calls.push({ url: String(url) });
    if (/\/api\/products/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => products });
    if (/\/api\/platforms/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => platforms });
    if (/\/api\/tasks/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => tasks });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  const panel = doc.getElementById("toolPanel");
  w.XLX.drama.dropship.render(panel);
  await new Promise(r => setTimeout(r, 0));
  assert.ok(doc.querySelector("#dpBase"), "有后端地址输入");
  assert.ok(doc.querySelector("[data-auth='taobao']"), "未授权平台给出授权入口");
  assert.ok(doc.querySelector(".dp-card"), "渲染货源卡片");
  assert.equal(doc.querySelector(".dp-card").dataset.id, "p1");
  assert.ok(doc.querySelector(".dp-st-success"), "渲染任务状态");
});
