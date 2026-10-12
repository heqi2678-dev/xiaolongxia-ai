/* 铜龙电商ai助手 · 铺货板块
 * 采集货源 → 加工 → 平台映射 → 一键铺货。UI 挂在「工具箱」的铺货标签页里。
 * 本模块只做「货源库 / 授权 / 发布队列」的前端管理，采集由浏览器扩展完成，
 * 上架由铺货后端带店铺授权调用各平台官方 API 完成。
 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const U = XLX.util || {};
  const CFG_KEY = "xlx_dropship_cfg";
  const DEFAULT_BASE = "http://127.0.0.1:9150";

  function defaultBase() {
    try {
      const loc = window.location || {};
      const host = loc.hostname || "";
      if (/^https?:$/.test(loc.protocol) && host && host !== "localhost" && host !== "127.0.0.1") {
        return (loc.origin || (loc.protocol + "//" + loc.host)) + "/dropship";
      }
    } catch (e) {}
    return DEFAULT_BASE;
  }

  function esc(s) { return (U.esc || String)(s == null ? "" : s); }

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function setConfig(cfg) {
    const next = Object.assign({}, getConfig(), cfg || {});
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }
  function normalizeBase(url) { return String(url || defaultBase()).replace(/\/+$/, ""); }
  function buildHeaders(cfg) {
    const headers = { "Content-Type": "application/json" };
    const token = cfg && cfg.token;
    if (token) headers["Authorization"] = "Bearer " + token;
    return headers;
  }

  async function request(method, path, body) {
    const cfg = getConfig();
    const res = await fetch(normalizeBase(cfg.backendUrl) + path, {
      method: method,
      headers: buildHeaders(cfg),
      body: body == null ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  const API = {
    health: () => request("GET", "/health"),
    platforms: () => request("GET", "/api/platforms"),
    collect: (product) => request("POST", "/api/collect", product),
    listProducts: (query) => request("GET", "/api/products" + (query || "")),
    getProduct: (id) => request("GET", "/api/products/" + encodeURIComponent(id)),
    updateProduct: (id, patch) => request("PUT", "/api/products/" + encodeURIComponent(id), patch),
    deleteProduct: (id) => request("DELETE", "/api/products/" + encodeURIComponent(id)),
    publish: (productIds, platform) => request("POST", "/api/publish", { productIds: productIds, platform: platform }),
    publishOne: (id, platform) => request("POST", "/api/products/" + encodeURIComponent(id) + "/publish", { platform: platform }),
    listTasks: (status) => request("GET", "/api/tasks" + (status ? "?status=" + encodeURIComponent(status) : "")),
    retryTask: (id) => request("POST", "/api/tasks/" + encodeURIComponent(id) + "/retry"),
    localize: (id) => request("POST", "/api/images/localize", { productId: id }),
    categories: (platform, parent) => request("GET", "/api/adapters/" + encodeURIComponent(platform) + "/categories" + (parent ? "?parent=" + parent : "")),
    attributes: (platform, cid) => request("GET", "/api/adapters/" + encodeURIComponent(platform) + "/attributes?cid=" + encodeURIComponent(cid)),
    authorizeUrl: (platform) => request("GET", "/api/auth/" + encodeURIComponent(platform) + "/authorize"),
    callback: (platform, code) => request("GET", "/api/auth/" + encodeURIComponent(platform) + "/callback?code=" + encodeURIComponent(code)),
    revoke: (platform) => request("POST", "/api/auth/" + encodeURIComponent(platform) + "/revoke")
  };

  const STATUS_TEXT = {
    success: "已上架", dry_run: "试运行", pending: "排队中",
    running: "上架中", failed: "失败"
  };

  const STYLE = '<style id="dpStyle">'
    + '.dp-list{display:flex;flex-direction:column;gap:8px}'
    + '.dp-card{border:1px solid var(--border);border-radius:10px;background:var(--panel2);overflow:hidden}'
    + '.dp-rowmain{display:flex;align-items:center;gap:10px;padding:8px 10px}'
    + '.dp-check{flex:0 0 auto}'
    + '.dp-thumb{width:52px;height:52px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:var(--panel)}'
    + '.dp-thumb img{width:100%;height:100%;object-fit:cover;display:block}'
    + '.dp-thumb .ph{width:100%;height:100%;background:repeating-linear-gradient(45deg,var(--panel),var(--panel) 6px,var(--panel2) 6px,var(--panel2) 12px)}'
    + '.dp-info{flex:1;min-width:0}'
    + '.dp-title{font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.dp-meta{font-size:11.5px;color:var(--text3);margin-top:3px}'
    + '.dp-act{display:flex;gap:6px;flex:0 0 auto}'
    + '.dp-edit{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;padding:10px;border-top:1px dashed var(--border);background:var(--panel)}'
    + '.dp-edit .label{margin-bottom:4px}'
    + '.dp-tasks{display:flex;flex-direction:column;gap:5px}'
    + '.dp-task{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 8px;border-radius:8px;background:var(--panel2)}'
    + '.dp-plat{flex:0 0 auto;color:var(--text2)}'
    + '.dp-tinfo{flex:1;min-width:0;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.dp-plat-chip{font-size:12px;padding:4px 10px;border-radius:999px;background:var(--panel2);border:1px solid var(--border);color:var(--text2)}'
    + '</style>';

  const filters = { q: "", source: "" };
  let ROOT = null;

  function queryString() {
    const parts = [];
    if (filters.q) parts.push("q=" + encodeURIComponent(filters.q));
    if (filters.source) parts.push("source=" + encodeURIComponent(filters.source));
    return parts.length ? "?" + parts.join("&") : "";
  }

  function thumb(p) {
    const img = (p.images && p.images.main && p.images.main[0] && (p.images.main[0].url || p.images.main[0].local)) || "";
    return img ? '<img loading="lazy" src="' + esc(img) + '" onerror="this.style.opacity=.15">' : '<div class="ph"></div>';
  }

  function priceText(p) {
    const pr = p.pricing || {};
    if (!pr.price) return "—";
    return "¥" + pr.price;
  }

  function productRow(p) {
    const src = p.source || {};
    const target = (p.category && p.category.target) || {};
    const mapped = target.id ? '<b style="color:var(--ok,#3ddc84)">已映射</b>' : '<b style="color:var(--warn,#ffb020)">未映射</b>';
    const imgOk = !!(p.images && p.images.main && p.images.main.some ? p.images.main.some(i => i && i.local) : false);
    const arch = imgOk ? '<b style="color:var(--ok,#3ddc84)">已归档</b>' : '<span style="color:var(--text3)">未归档</span>';
    return '<div class="dp-card" data-id="' + esc(p.id) + '">'
      + '<div class="dp-rowmain">'
      + '<label class="dp-check"><input type="checkbox" data-pick value="' + esc(p.id) + '"></label>'
      + '<div class="dp-thumb">' + thumb(p) + '</div>'
      + '<div class="dp-info"><div class="dp-title">' + esc(p.title || "(无标题)") + '</div>'
      + '<div class="dp-meta">' + esc(src.platform || "") + ' · ' + esc(src.itemId || "") + ' · ' + priceText(p) + ' · ' + mapped + ' · ' + arch + '</div></div>'
      + '<div class="dp-act"><button class="btn ghost" data-edit="' + esc(p.id) + '">编辑</button>'
      + '<button class="btn ghost" data-loc="' + esc(p.id) + '">归档图</button>'
      + '<button class="btn primary" data-pub="' + esc(p.id) + '">上架</button></div>'
      + '</div>'
      + '<div class="dp-edit" data-editbox="' + esc(p.id) + '" hidden>'
      + '<div><label class="label">标题</label><input class="inp" data-f="title" value="' + esc(p.title || "") + '"></div>'
      + '<div><label class="label">售价</label><input class="inp" type="number" step="0.01" data-f="price" value="' + esc(String((p.pricing && p.pricing.price) || "")) + '"></div>'
      + '<div><label class="label">平台类目 ID</label><input class="inp" data-f="catId" value="' + esc(target.id || "") + '" placeholder="如 50010850"></div>'
      + '<div style="display:flex;align-items:flex-end;gap:6px"><button class="btn primary" data-save="' + esc(p.id) + '">保存</button>'
      + '<button class="btn ghost" data-cancel="' + esc(p.id) + '">取消</button></div>'
      + '</div>'
      + '</div>';
  }

  function taskRow(t) {
    const st = STATUS_TEXT[t.status] || t.status;
    const err = t.lastError ? ' · <span style="color:var(--warn,#ffb020)">' + esc(t.lastError) + '</span>' : '';
    const item = t.platformItemId ? ' · ' + esc(t.platformItemId) : '';
    const retry = t.status === "failed" ? '<button class="btn ghost" data-retry="' + esc(t.id) + '">重试</button>' : '';
    return '<div class="dp-task"><span class="dp-plat">' + esc(t.platform) + '</span>'
      + '<b class="dp-st dp-st-' + esc(t.status) + '">' + esc(st) + '</b>'
      + '<span class="dp-tinfo">' + esc(t.productId) + item + err + '</span>' + retry + '</div>';
  }

  function render(container) {
    if (!container) return;
    ROOT = container;
    const cfg = getConfig();
    container.innerHTML = STYLE
      + '<div class="notice" style="font-size:12px;color:var(--text2);background:var(--panel2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:12px">'
      + '铺货流程：用<b>浏览器扩展</b>在 1688 商品页采集 → 进入下方<b>货源库</b> → 完成 AI 加工与平台类目映射 → 一键铺货到淘宝 / TikTok 等店铺。'
      + '</div>'
      + '<div class="dp-cfg" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">'
      + '<div style="flex:1;min-width:220px"><label class="label">铺货后端地址</label>'
      + '<input id="dpBase" class="inp" value="' + esc(cfg.backendUrl || defaultBase()) + '" placeholder="' + esc(defaultBase()) + '"></div>'
      + '<div style="flex:1;min-width:180px"><label class="label">访问令牌</label>'
      + '<input id="dpToken" class="inp" type="password" value="' + esc(cfg.token || "") + '" placeholder="可留空"></div>'
      + '<button class="btn ghost" id="dpSave">保存</button>'
      + '<button class="btn primary" id="dpTest">测试连接</button>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">'
      + '<div style="flex:1;min-width:200px"><label class="label">搜索货源</label>'
      + '<input id="dpSearch" class="inp" value="' + esc(filters.q) + '" placeholder="标题 / 货号 / 类目关键词"></div>'
      + '<div style="min-width:130px"><label class="label">来源</label>'
      + '<select id="dpSource" class="inp"><option value="">全部</option><option value="1688">1688</option></select></div>'
      + '<button class="btn ghost" id="dpQuery">筛选</button>'
      + '<button class="btn ghost" id="dpRefresh">刷新</button>'
      + '</div>'
      + '<div id="dpPlatforms" style="margin-bottom:12px"></div>'
      + '<div id="dpBody"><div style="color:var(--text3);font-size:12px;padding:10px">加载货源库…</div></div>';

    const saveBtn = container.querySelector("#dpSave");
    if (saveBtn) saveBtn.onclick = () => {
      setConfig({ backendUrl: normalizeBase(container.querySelector("#dpBase").value.trim()), token: container.querySelector("#dpToken").value.trim() });
      if (U.toast) U.toast("已保存铺货设置", "ok");
      load(container);
    };
    const testBtn = container.querySelector("#dpTest");
    if (testBtn) testBtn.onclick = async () => {
      try { const info = await API.health(); if (U.toast) U.toast("连接正常，适配器：" + (info.adapters || []).join("/"), "ok"); load(container); }
      catch (e) { if (U.toast) U.toast("连接失败：" + e.message, "err"); }
    };
    const srcSel = container.querySelector("#dpSource");
    if (srcSel) srcSel.value = filters.source;
    const doQuery = () => {
      const q = container.querySelector("#dpSearch");
      const s = container.querySelector("#dpSource");
      filters.q = q ? q.value.trim() : "";
      filters.source = s ? s.value : "";
      load(container);
    };
    const queryBtn = container.querySelector("#dpQuery");
    if (queryBtn) queryBtn.onclick = doQuery;
    const searchInput = container.querySelector("#dpSearch");
    if (searchInput) searchInput.onkeydown = (e) => { if (e.key === "Enter") doQuery(); };
    const refreshBtn = container.querySelector("#dpRefresh");
    if (refreshBtn) refreshBtn.onclick = () => load(container);
    load(container);
  }

  async function load(container) {
    const body = container.querySelector("#dpBody");
    const platBox = container.querySelector("#dpPlatforms");
    try {
      const [products, platforms, tasks] = await Promise.all([API.listProducts(queryString()), API.platforms(), API.listTasks()]);
      if (platBox) platBox.innerHTML = renderPlatforms(platforms.platforms || []);
      const list = products.products || [];
      const total = products.total != null ? products.total : list.length;
      if (!list.length) {
        const msg = (filters.q || filters.source)
          ? '没有匹配的货源。试试清空筛选条件。'
          : '货源库为空。请用浏览器扩展在 1688 商品页点击「采集到铜龙铺货」。';
        body.innerHTML = '<div style="color:var(--text3);font-size:12.5px;padding:10px">' + msg + '</div>';
        return;
      }
      body.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        + '<div style="font-size:12.5px;color:var(--text2)">货源库共 <b>' + total + '</b> 件' + ((filters.q || filters.source) ? '（已筛选，显示 ' + list.length + ' 件）' : '') + '</div>'
        + '<div style="display:flex;gap:8px"><select id="dpPlat" class="inp" style="width:auto">'
        + (platforms.platforms || []).map(p => '<option value="' + esc(p.id) + '">' + esc(p.label) + (p.authorized ? "" : "（未授权）") + '</option>').join("")
        + '</select><button class="btn primary" id="dpPubAll">铺货选中</button></div></div>'
        + '<div class="dp-list">' + list.map(productRow).join("") + '</div>'
        + '<div style="margin-top:14px"><div style="font-size:12.5px;color:var(--text2);margin-bottom:6px">最近任务</div>'
        + '<div class="dp-tasks">' + ((tasks.tasks && tasks.tasks.length) ? tasks.tasks.map(taskRow).join("") : '<div style="color:var(--text3);font-size:12px;padding:6px">暂无发布任务</div>') + '</div></div>';
      wire(body, list);
    } catch (e) {
      body.innerHTML = '<div style="color:var(--warn,#ffb020);font-size:12.5px;padding:10px">加载失败：' + esc(e.message) + '（请检查后端地址与令牌）</div>';
    }
  }

  function renderPlatforms(plats) {
    if (!plats.length) return "";
    return '<div style="display:flex;gap:8px;flex-wrap:wrap">' + plats.map(p =>
      '<span class="dp-plat-chip">' + esc(p.label) + ' '
      + (p.authorized ? '<b style="color:var(--ok,#3ddc84)">已授权</b>' : '<a href="#" data-auth="' + esc(p.id) + '" style="color:var(--accent,#4c8dff)">去授权</a>')
      + '</span>').join("") + '</div>';
  }

  function wire(body, products) {
    body.querySelectorAll("[data-auth]").forEach(a => {
      a.onclick = async (e) => {
        e.preventDefault();
        try {
          const r = await API.authorizeUrl(a.dataset.auth);
          window.open(r.authorizeUrl, "_blank", "noopener");
          const pasted = window.prompt("已打开授权页，请用店铺账号登录并同意授权。\n授权后浏览器会跳转，把跳转地址里的 code 参数（或整段回调地址）粘贴到这里：");
          if (!pasted) return;
          const m = String(pasted).match(/[?&]code=([^&]+)/);
          const code = m ? decodeURIComponent(m[1]) : String(pasted).trim();
          await API.callback(a.dataset.auth, code);
          if (U.toast) U.toast("授权成功", "ok");
          load(ROOT || body);
        } catch (err) { if (U.toast) U.toast("授权失败：" + err.message, "err"); }
      };
    });
    body.querySelectorAll("[data-pub]").forEach(b => {
      b.onclick = () => publish([b.dataset.pub], body);
    });
    body.querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = () => {
        const box = body.querySelector('[data-editbox="' + b.dataset.edit + '"]');
        if (box) box.hidden = !box.hidden;
      };
    });
    body.querySelectorAll("[data-cancel]").forEach(b => {
      b.onclick = () => {
        const box = body.querySelector('[data-editbox="' + b.dataset.cancel + '"]');
        if (box) box.hidden = true;
      };
    });
    body.querySelectorAll("[data-save]").forEach(b => {
      b.onclick = () => saveEdit(b.dataset.save, body);
    });
    body.querySelectorAll("[data-loc]").forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await API.localize(b.dataset.loc);
          if (U.toast) U.toast(r.changed ? "图片已归档到本地" : "图片已是最新，无需归档", "ok");
          load(ROOT || body);
        } catch (err) {
          if (U.toast) U.toast("归档失败：" + err.message, "err");
          b.disabled = false;
        }
      };
    });
    body.querySelectorAll("[data-retry]").forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          await API.retryTask(b.dataset.retry);
          if (U.toast) U.toast("已重新排队", "ok");
          load(ROOT || body);
        } catch (err) {
          if (U.toast) U.toast("重试失败：" + err.message, "err");
          b.disabled = false;
        }
      };
    });
    const pubAll = body.querySelector("#dpPubAll");
    if (pubAll) pubAll.onclick = () => {
      const picked = Array.from(body.querySelectorAll("[data-pick]:checked")).map(c => c.value);
      if (!picked.length) { if (U.toast) U.toast("请先勾选要铺货的商品", "warn"); return; }
      publish(picked, body);
    };
  }

  async function saveEdit(id, body) {
    const box = body.querySelector('[data-editbox="' + id + '"]');
    if (!box) return;
    const get = (f) => { const el = box.querySelector('[data-f="' + f + '"]'); return el ? el.value.trim() : ""; };
    const patch = { title: get("title") };
    const price = parseFloat(get("price"));
    if (!isNaN(price)) patch.pricing = { price: price };
    const catId = get("catId");
    try {
      const r = await API.updateProduct(id, patch);
      if (catId) await API.updateProduct(id, { category: { target: { id: catId } } });
      if (U.toast) U.toast("已保存商品修改", "ok");
      load(ROOT || body);
    } catch (e) {
      if (U.toast) U.toast("保存失败：" + e.message, "err");
    }
  }

  async function publish(ids, body) {
    const sel = body.querySelector("#dpPlat");
    const platform = sel ? sel.value : "";
    if (!platform) { if (U.toast) U.toast("没有可用平台", "warn"); return; }
    try {
      const r = await API.publish(ids, platform);
      if (U.toast) U.toast("已提交 " + (r.tasks || []).length + " 个铺货任务", "ok");
      load(ROOT || body);
    } catch (e) {
      if (U.toast) U.toast("提交失败：" + e.message, "err");
    }
  }

  D.dropship = {
    DEFAULT_BASE: DEFAULT_BASE,
    getConfig: getConfig,
    setConfig: setConfig,
    normalizeBase: normalizeBase,
    buildHeaders: buildHeaders,
    API: API,
    render: render,
    renderPlatforms: renderPlatforms,
    STATUS_TEXT: STATUS_TEXT
  };
})();
