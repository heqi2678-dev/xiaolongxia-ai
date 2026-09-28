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
    + '<div id="ecomProductsView" class="view"></div>'
    + '<div id="ecomAssetsView" class="view"></div>'
    + '<div id="ecomImageView" class="view"></div>'
    + '<div id="ecomPublishView" class="view"></div>'
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
  w.eval(src("ecom-products.js"));
  w.eval(src("ecom-publish.js"));
  w.eval(src("ecom-image.js"));
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

test("商品库：列表渲染、批量编辑、翻页", async () => {
  const batchBodies = [];
  const routes = [
    { method: "GET", match: "/products", json: { ok: true, total: 2, page: 1, page_size: 20, items: [
      { id: "p1", title: "连衣裙", source_platform: "1688", price: 59.8, stock: 12, status: "collected", updated_at: 100, main_image: "" },
      { id: "p2", title: "T恤", source_platform: "mock", price: 19.9, stock: 3, status: "listed", updated_at: 90, main_image: "" }
    ] } },
    { method: "POST", match: "/products/batch", json: (p, opts) => {
      batchBodies.push(JSON.parse(opts.body));
      return { ok: true, updated: 2 };
    } }
  ];
  const { doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomProducts");
  await flush();

  const table = doc.querySelector("#ecomProductTable");
  assert.match(table.textContent, /连衣裙/);
  assert.match(table.textContent, /已上架/);
  assert.equal(table.querySelectorAll("tr[data-id]").length, 2);

  doc.querySelector("[data-select-all]").click();
  assert.match(doc.querySelector("#ecomBatchCount").textContent, /已选 2 件/);
  doc.querySelector("#ecomBatchCategory").value = "女装";
  doc.querySelector("#ecomBatchStatus").value = "pending";
  doc.querySelector("#ecomBatchApply").click();
  await flush();
  assert.equal(batchBodies.length, 1, "提交批量编辑");
  assert.deepEqual(batchBodies[0].ids.sort(), ["p1", "p2"]);
  assert.equal(batchBodies[0].patch.category, "女装");
  assert.equal(batchBodies[0].patch.status, "pending");
});

test("商品库：详情面板展示 SKU 与版本记录，可保存 SKU", async () => {
  const patched = [];
  const detail = (price) => ({ ok: true,
    product: { id: "p1", title: "连衣裙", category: "女装", price: 59.8, stock: 12, source_platform: "1688", source_url: "https://detail.1688.com/offer/1.html", main_image: "" },
    skus: [{ id: "k1", spec: "红色", price: price, stock: 5, barcode: "111", enabled: 1 }],
    media: [], listings: [], report: null,
    versions: [{ id: "v1", note: "编辑", created_at: 50 }] });
  const routes = [
    { method: "GET", match: (clean) => clean.indexOf("/products?") === 0, json: { ok: true, total: 1, page: 1, page_size: 20, items: [
      { id: "p1", title: "连衣裙", source_platform: "1688", price: 59.8, stock: 12, status: "collected", updated_at: 100, main_image: "" }
    ] } },
    { method: "GET", match: "/products/p1", json: detail(10) },
    { method: "PATCH", match: "/products/p1", json: (p, opts) => {
      const body = JSON.parse(opts.body);
      patched.push(body);
      return detail(body.skus ? body.skus[0].price : 10);
    } }
  ];
  const { doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomProducts");
  await flush();

  doc.querySelector("[data-detail]").click();
  await flush();
  const panel = doc.querySelector("#ecomProductDetail");
  assert.match(panel.textContent, /商品详情/);
  assert.match(panel.textContent, /编辑/, "展示版本记录");
  assert.equal(panel.querySelector("#ecomEditTitle").value, "连衣裙");
  const skuRow = panel.querySelector('tr[data-sku="k1"]');
  assert.ok(skuRow, "渲染 SKU 行");
  assert.equal(skuRow.querySelector('[data-k="spec"]').value, "红色");

  skuRow.querySelector('[data-k="price"]').value = "12.5";
  panel.querySelector("[data-save-skus]").click();
  await flush();
  assert.equal(patched.length, 1);
  assert.equal(patched[0].skus.length, 1);
  assert.equal(patched[0].skus[0].price, 12.5);
  assert.equal(patched[0].note, "SKU 编辑");
});

test("素材库：筛选参数、选择后带入图片工坊", async () => {
  const urls = [];
  const routes = [
    { method: "GET", match: "/assets", json: (clean) => {
      urls.push(clean);
      return { ok: true, total: 1, page: 1, page_size: 20, items: [
        { id: "m1", kind: "image", source_type: "collected", product_id: "p1", url: "", meta_json: { width: 800, height: 800 }, created_at: 10 }
      ] };
    } }
  ];
  const { w, doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomAssets");
  await flush();

  assert.equal(doc.querySelectorAll(".ecom-asset").length, 1);
  assert.match(doc.querySelector(".ecom-asset").textContent, /商品 p1/);
  assert.match(doc.querySelector(".ecom-asset").textContent, /800×800/);

  doc.querySelector("#ecomAssetKind").value = "video";
  doc.querySelector("#ecomAssetSearch").click();
  await flush();
  assert.ok(urls.some(u => u.indexOf("kind=video") >= 0), "筛选参数进入请求");

  doc.querySelector("[data-select-all]").click();
  doc.querySelector("[data-to-image]").click();
  assert.deepEqual(EC.getSelection("media"), ["m1"]);
  assert.equal(w.__go, "ecomImage");
});

test("搬家铺货：向导五步走完并提交，策略进入请求体", async () => {
  const precheckBodies = [];
  const publishBodies = [];
  const routes = [
    { method: "GET", match: "/products", json: { ok: true, total: 1, page: 1, page_size: 50, items: [
      { id: "p1", title: "连衣裙", source_platform: "1688", price: 59, stock: 5, status: "collected", updated_at: 100, main_image: "" }
    ] } },
    { method: "GET", match: "/shops", json: { ok: true, items: [
      { id: "s1", name: "店A", platform: "douyin", auth_status: "normal", group_id: "g1" }
    ] } },
    { method: "GET", match: "/shop-groups", json: { ok: true, items: [{ id: "g1", name: "一组" }] } },
    { method: "POST", match: "/publish/precheck", json: (p, opts) => {
      precheckBodies.push(JSON.parse(opts.body));
      return { ok: true, verdict: "pass", items: [{ productId: "p1", dimension: "title", level: "pass", message: "标题符合C端表述" }] };
    } },
    { method: "POST", match: "/publish", json: (p, opts) => {
      publishBodies.push(JSON.parse(opts.body));
      return { ok: true, task: { id: "tp9", status: "queued" }, item_count: 1, deduped: 0 };
    } },
    { method: "GET", match: "/tasks", json: { ok: true, items: [] } }
  ];
  const { w, doc, EC } = boot(jsonFetch(routes));
  await EC.render("ecomPublish");
  await flush();
  await flush();

  assert.equal(doc.querySelectorAll("[data-step]").length, 5, "五步向导");
  const pck = doc.querySelector("[data-pid]");
  pck.checked = true;
  pck.dispatchEvent(new w.Event("change"));
  doc.querySelector("[data-next]").click();
  await flush();

  assert.ok(doc.querySelector("[data-sid]"), "第二步展示店铺");
  const sck = doc.querySelector("[data-sid]");
  sck.checked = true;
  sck.dispatchEvent(new w.Event("change"));
  doc.querySelector("[data-next]").click();

  assert.equal(doc.querySelector("#ecomPublishPlatform").value, "douyin");
  doc.querySelector("#ecomPriceValue").value = "30";
  doc.querySelector("#ecomPriceValue").dispatchEvent(new w.Event("change"));
  doc.querySelector("[data-next]").click();

  doc.querySelector("#ecomPrecheckRun").click();
  await flush();
  assert.match(doc.querySelector("#ecomStepBody").textContent, /标题符合C端表述/);

  doc.querySelector("[data-next]").click();
  doc.querySelector("#ecomPublishSubmit").click();
  await flush();

  assert.equal(precheckBodies.length, 1);
  assert.deepEqual(precheckBodies[0].product_ids, ["p1"]);
  assert.equal(publishBodies.length, 1);
  assert.deepEqual(publishBodies[0].shop_ids, ["s1"]);
  assert.equal(publishBodies[0].strategy.price_rule.value, 30);
  assert.match(doc.querySelector("#ecomStepBody").textContent, /tp9/);
  assert.match(doc.querySelector("#ecomStepBody").textContent, /去任务中心/);
});

test("搬家铺货：批量改价按范围与公式提交", async () => {
  const bodies = [];
  const routes = [
    { method: "GET", match: "/products", json: { ok: true, total: 1, page: 1, page_size: 50, items: [
      { id: "p1", title: "连衣裙", source_platform: "1688", price: 59, stock: 5, status: "collected", updated_at: 100, main_image: "" }
    ] } },
    { method: "GET", match: "/shops", json: { ok: true, items: [
      { id: "s1", name: "店A", platform: "douyin", auth_status: "normal" }
    ] } },
    { method: "GET", match: "/shop-groups", json: { ok: true, items: [] } },
    { method: "GET", match: "/tasks", json: { ok: true, items: [] } },
    { method: "POST", match: "/price/adjust", json: (p, opts) => {
      bodies.push(JSON.parse(opts.body));
      return { ok: true, task: { id: "tr1", status: "queued" }, item_count: 1 };
    } }
  ];
  const { w, doc, EC } = boot(jsonFetch(routes));
  EC.setSelection("products", ["p1"]);
  await EC.render("ecomPublish");
  await flush();
  await flush();

  doc.querySelector('[data-tab="price"]').click();
  await flush();
  assert.ok(doc.querySelector("#ecomPriceAdjustSubmit"), "批量改价渲染提交按钮");

  doc.querySelector('[data-price-scope="listings"]').click();
  await flush();
  const sck = doc.querySelector("[data-psid]");
  sck.checked = true;
  sck.dispatchEvent(new w.Event("change"));
  await flush();

  doc.querySelector("#ecomPriceValue").value = "10";
  doc.querySelector("#ecomPriceValue").dispatchEvent(new w.Event("change"));
  doc.querySelector("#ecomPriceRound").value = "end9";
  doc.querySelector("#ecomPriceRound").dispatchEvent(new w.Event("change"));
  doc.querySelector("#ecomPriceAdjustSubmit").click();
  await flush();

  assert.equal(bodies.length, 1);
  assert.deepEqual(bodies[0].product_ids, ["p1"]);
  assert.equal(bodies[0].scope, "listings");
  assert.deepEqual(bodies[0].shop_ids, ["s1"]);
  assert.equal(bodies[0].rule.value, 10);
  assert.equal(bodies[0].rule.round, "end9");
});

test("图片工坊：加载配方表、按配方同步处理并预览结果", async () => {
  const processBodies = [];
  const routes = [
    { method: "GET", match: "/assets/recipes", json: { ok: true,
      recipes: [
        { id: "white", label: "白底图", roles: ["white"], ops: ["cutout", "white_bg"] },
        { id: "suite", label: "商品套图", roles: ["white", "promo"], ops: ["cutout"] }
      ],
      processors: [{ id: "cutout", label: "抠图" }, { id: "white_bg", label: "白底" }],
      sizes: [{ id: "main_square", label: "主图 · 1:1", width: 800, height: 800, ratio: "1:1" }],
      platforms: ["douyin"] } },
    { method: "POST", match: "/assets/process", json: (p, opts) => {
      processBodies.push(JSON.parse(opts.body));
      return { ok: true, item_count: 1, task: { id: "ti1", status: "succeeded" }, outputs: [
        { media_id: "e1", role: "white", recipe: "white", url: "http://x/1.png", width: 800, height: 800, ops: ["cutout", "white_bg"], platform: "douyin" }
      ] };
    } }
  ];
  const { doc, EC } = boot(jsonFetch(routes));
  EC.setSelection("media", ["m1"]);
  await EC.render("ecomImage");
  await flush();
  await flush();

  assert.match(doc.querySelector("#ecomImageMain").textContent, /白底图/);
  assert.match(doc.querySelector("#ecomImageMain").textContent, /已选素材 1/);
  assert.equal(doc.querySelectorAll("[data-spec]").length, 1);

  doc.querySelector("#ecomImageSubmit").click();
  await flush();
  await flush();

  assert.equal(processBodies.length, 1);
  assert.deepEqual(processBodies[0].media_ids, ["m1"]);
  assert.equal(processBodies[0].recipe, "white");
  assert.ok(processBodies[0].ops.indexOf("cutout") >= 0, "默认处理器随配方带入");
  assert.equal(processBodies[0].spec_id, "main_square");
  assert.equal(processBodies[0].sync, true);
  assert.match(doc.querySelector("#ecomImagePreview").textContent, /白底图/);
  assert.ok(doc.querySelector("#ecomImagePreview a[download]"), "结果提供下载入口");
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
