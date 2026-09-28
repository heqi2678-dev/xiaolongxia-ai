/* 铜龙电商 · 前端视图测试（首页 / 采集下载）
 * 运行：node --test tests/ecom.test.js
 * 覆盖：首页能力入口与概览、采集表单与轮询、结果表渲染、共享通道与状态文案。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
function src(file) { return fs.readFileSync(path.join(ROOT, "src/drama/ecom", file), "utf8"); }

const ICON_IDS = ["home", "download", "cart", "palette", "image", "sparkle", "send", "scan", "shopping", "clock"];

function boot(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="ecomHomeView" class="view"></div>'
    + '<div id="ecomCollectView" class="view"></div>'
    + '<div id="toasts"></div></body></html>',
    { runScripts: "outside-only", url: "http://localhost/dian/" });
  const w = dom.window;
  w.__go = null;
  w.__toasts = [];
  w.__timers = [];
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
  w.setTimeout = (fn) => { w.__timers.push(fn); return w.__timers.length; };
  w.clearTimeout = () => {};
  w.fetch = fetchImpl;
  w.eval(src("ecom.js"));
  w.eval(src("ecom-home.js"));
  w.eval(src("ecom-collect.js"));
  return { w, doc: w.document, EC: w.XLX.drama.ecom };
}

function flush() { return new Promise(r => setTimeout(r, 0)); }

function jsonFetch(routes) {
  return function (url, opts) {
    const method = (opts && opts.method) || "GET";
    const clean = String(url).replace("/dian/api/ecom", "");
    for (const r of routes) {
      if (r.method === method && (typeof r.match === "function" ? r.match(clean, opts) : clean.indexOf(r.match) === 0)) {
        const body = typeof r.json === "function" ? r.json(clean, opts) : r.json;
        return Promise.resolve({ ok: r.status !== 400, status: r.status || 200, json: async () => body });
      }
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({ ok: false, error: "no route" }) });
  };
}

test("首页：渲染五个能力入口与概览数据", async () => {
  const routes = [
    { method: "GET", match: "/stats", json: { ok: true, products: 7, media: 3, shops: 2, listings: 5 } },
    { method: "GET", match: "/shops", json: { ok: true, items: [{ id: "s1", name: "店A" }] } },
    { method: "GET", match: "/tasks", json: { ok: true, items: [
      { id: "t1", kind: "collect", title: "采集任务", status: "running", progress: 40, done: 2, failed: 0, total: 5, created_at: 100 },
      { id: "t2", kind: "publish", title: "铺货任务", status: "succeeded", progress: 100, done: 3, failed: 0, total: 3, created_at: 90 }
    ] } }
  ];
  const { w, doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomHome");
  await flush();

  assert.equal(doc.querySelectorAll(".ecom-card").length, 5, "五个能力卡");
  assert.deepEqual(Array.from(doc.querySelectorAll(".ecom-card-t")).map(n => n.textContent),
    ["采集下载", "图片工坊", "AI 创作", "搬家铺货", "合规检测"]);
  assert.deepEqual(Array.from(doc.querySelectorAll(".ecom-tile-v")).map(n => n.textContent), ["7", "3", "2", "5"]);
  assert.match(doc.querySelector("#ecomHomeTodo").textContent, /采集任务/);
  assert.match(doc.querySelector("#ecomHomeRecent").textContent, /铺货任务/);

  doc.querySelector('.ecom-card[data-view="ecomImage"]').click();
  assert.equal(w.__go, "ecomImage", "能力卡跳转对应视图");
});

test("首页：无任务时给出引导空态", async () => {
  const routes = [
    { method: "GET", match: "/stats", json: { ok: true } },
    { method: "GET", match: "/shops", json: { ok: true, items: [] } },
    { method: "GET", match: "/tasks", json: { ok: true, items: [] } }
  ];
  const { doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomHome");
  await flush();
  assert.match(doc.querySelector("#ecomHomeTodo").textContent, /暂无待办/);
  assert.match(doc.querySelector("#ecomHomeRecent").textContent, /绑定店铺/);
});

test("采集：提交链接采集并轮询到完成", async () => {
  let collectStatus = "running";
  const routes = [
    { method: "POST", match: "/collect", json: (p, opts) => {
      const body = JSON.parse(opts.body);
      assert.equal(body.mode, "product");
      assert.equal(body.platform, "1688");
      assert.equal(body.urls.length, 2, "按换行/逗号拆分链接");
      return { ok: true, task: { id: "t9", status: "queued", total: 2, done: 0, failed: 0, progress: 0, title: "采集任务" }, item_count: 2 };
    } },
    { method: "GET", match: "/collect/t9", json: () => ({
      ok: true,
      task: { id: "t9", status: collectStatus, progress: collectStatus === "running" ? 50 : 100, done: collectStatus === "running" ? 1 : 2, failed: 0, total: 2, title: "采集任务" },
      items: collectStatus === "running"
        ? [{ seq: 1, ref_type: "product", ref_id: "https://detail.1688.com/offer/1.html", status: "done", result_json: { product_id: "p1", skus: 1, media: 2 } }]
        : [
          { seq: 1, ref_type: "product", ref_id: "https://detail.1688.com/offer/1.html", status: "done", result_json: { product_id: "p1", skus: 1, media: 2 } },
          { seq: 2, ref_type: "product", ref_id: "https://detail.1688.com/offer/2.html", status: "done", result_json: { product_id: "p2", skus: 0, media: 1 } }
        ]
    }) },
    { method: "GET", match: "/tasks", json: { ok: true, items: [] } }
  ];
  const { w, doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomCollect");

  doc.querySelector("#ecomCollectUrls").value = "https://detail.1688.com/offer/1.html\nhttps://detail.1688.com/offer/2.html";
  doc.querySelector("#ecomCollectSubmit").click();
  await flush();
  await flush();

  let prog = doc.querySelector("#ecomCollectProgress");
  assert.match(prog.textContent, /采集进度/);
  assert.match(prog.textContent, /成功 1/);
  assert.equal(w.__timers.length, 1, "running 状态安排下一次轮询");

  collectStatus = "succeeded";
  w.__timers.shift()();
  await flush();
  await flush();

  const table = doc.querySelector("#ecomCollectResults");
  assert.match(table.textContent, /商品 p1/);
  assert.match(table.textContent, /商品 p2/);
  assert.match(table.textContent, /已完成/);
});

test("采集：整店模式提交 shop_url，结果展示采集件数", async () => {
  const routes = [
    { method: "POST", match: "/collect", json: (p, opts) => {
      const body = JSON.parse(opts.body);
      assert.equal(body.mode, "shop");
      assert.equal(body.shop_url, "https://shop.1688.com/");
      assert.equal(body.urls, undefined);
      return { ok: true, task: { id: "t3", status: "queued", total: 1, done: 0, failed: 0, progress: 0 }, item_count: 1 };
    } },
    { method: "GET", match: "/collect/t3", json: { ok: true, task: { id: "t3", status: "succeeded", progress: 100, done: 1, failed: 0, total: 1 }, items: [
      { seq: 1, ref_type: "shop", ref_id: "https://shop.1688.com/", status: "done", result_json: { collected: 12 } }
    ] } },
    { method: "GET", match: "/tasks", json: { ok: true, items: [] } }
  ];
  const { w, doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomCollect");
  doc.querySelector('[data-mode="shop"]').click();
  assert.equal(doc.querySelector("#ecomCollectShopField").style.display, "");
  doc.querySelector("#ecomCollectShop").value = "https://shop.1688.com/";
  doc.querySelector("#ecomCollectSubmit").click();
  await flush();
  await flush();
  assert.match(doc.querySelector("#ecomCollectResults").textContent, /采集 12 件/);
});

test("共享通道：api 抛错带 code，状态与平台文案映射", async () => {
  const routes = [{ method: "GET", match: "/nope", status: 400, json: { ok: false, error: "没有这个接口", code: "bad_request" } }];
  const { EC } = boot(jsonFetch(routes));
  let err = null;
  try { await EC.api("GET", "/nope"); } catch (e) { err = e; }
  assert.ok(err, "错误请求应抛出");
  assert.equal(err.message, "没有这个接口");
  assert.equal(err.code, "bad_request");

  assert.equal(EC.statusText("partial"), "部分完成");
  assert.equal(EC.kindText("price_adjust"), "改价");
  assert.equal(EC.platformText("douyin"), "抖音小店");
  assert.equal(EC.isTerminal("succeeded"), true);
  assert.equal(EC.isTerminal("running"), false);
  EC.setSelection("products", ["a", "a", "b"]);
  assert.deepEqual(EC.getSelection("products"), ["a", "b"]);
  EC.toggleSelection("products", "a");
  assert.deepEqual(EC.getSelection("products"), ["b"]);
});
