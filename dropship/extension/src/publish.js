/* 铜龙铺货 · 淘宝发布助手
 * 淘宝店铺无法申请开放平台自研应用，改在淘宝/天猫「发布宝贝」页注入一个面板：
 * 从铺货库选一件商品 → 尽力自动填入标题/价格/库存，并提供描述、规格、主图的复制/下载，
 * 图片与富文本描述仍需人工上传（淘宝发布页为复杂 SPA，无法可靠免人工）。
 */
(function () {
  "use strict";
  if (window.__xlxPublishInjected) return;
  window.__xlxPublishInjected = true;

  var PUBLISH_HINT = /发布宝贝|宝贝发布|商品发布|一口价|宝贝标题|商品标题|上架|发布的宝贝/;
  var TAOBAO_HOST = /(^|\.)(taobao|tmall|taobao\.org)\.com$/;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function fieldText(el) {
    var parts = [el.placeholder, el.getAttribute && el.getAttribute("aria-label"), el.id, el.name];
    try {
      if (el.labels && el.labels.length) {
        for (var i = 0; i < el.labels.length; i++) parts.push(el.labels[i].innerText);
      }
    } catch (e) { /* ignore */ }
    var p = el.parentElement;
    for (var d = 0; p && d < 2; d++, p = p.parentElement) {
      if (p.innerText) parts.push(p.innerText.slice(0, 60));
    }
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function findInput(keywords, allowHidden) {
    var els = document.querySelectorAll('input[type=text],input[type=search],input[type=tel],input[type=number],input:not([type]),textarea');
    var fallback = null;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.disabled || el.readOnly) continue;
      var hidden = (el.offsetParent === null && el.getClientRects().length === 0);
      if (hidden && !allowHidden) continue;
      var text = fieldText(el);
      var hit = false;
      for (var k = 0; k < keywords.length; k++) {
        if (text.indexOf(keywords[k].toLowerCase()) >= 0) { hit = true; break; }
      }
      if (!hit) continue;
      if (hidden) { if (!fallback) fallback = el; continue; }
      return el;
    }
    return fallback;
  }

  // 把 data URL 还原成可直接喂给 <input type=file> 的 File
  function dataURLToFile(dataUrl, name) {
    var s = String(dataUrl || "");
    var comma = s.indexOf(",");
    if (comma < 0) throw new Error("图片数据无效");
    var meta = s.slice(0, comma);
    var body = s.slice(comma + 1);
    var mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    var bin = /;base64/i.test(meta) ? atob(body) : decodeURIComponent(body);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    return new File([bytes], (name || "xlx-image") + "." + ext, { type: mime });
  }

  function isFileInput(el) {
    return el && el.tagName === "INPUT" && (el.type || "").toLowerCase() === "file" && !el.disabled;
  }

  var IMAGE_KIND_RE = {
    main: /主图|商品图|宝贝图|白底图|1:1|3:4|白底|长图/,
    sku: /规格图|销售属性图|sku\s*图|颜色图|颜色|属性图|销售规格/i,
    detail: /详情图|宝贝详情|详情描述|图文详情|描述图|详情信息|详情页/
  };
  var KIND_TEXT = { main: "主图", sku: "SKU图", detail: "详情图" };

  // 收集元素及祖先节点的文案（穿透 shadow DOM 后的局部上下文）
  function elContext(el, depth) {
    var parts = [el.placeholder, el.getAttribute && el.getAttribute("aria-label"), el.id, el.name, el.className];
    try {
      if (el.labels && el.labels.length) {
        for (var i = 0; i < el.labels.length; i++) parts.push(el.labels[i].innerText);
      }
    } catch (e) { /* ignore */ }
    var p = el.parentElement;
    for (var d = 0; p && d < (depth || 4); d++, p = p.parentElement) {
      if (p.innerText) parts.push(p.innerText.slice(0, 160));
    }
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  // 递归收集文档及开放 shadow root 内的所有文件选择框
  function collectFileInputs(root, out) {
    out = out || [];
    root = root || document;
    var list = root.querySelectorAll('input[type=file]');
    for (var i = 0; i < list.length; i++) out.push(list[i]);
    var all = root.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      if (all[j].shadowRoot) collectFileInputs(all[j].shadowRoot, out);
    }
    return out;
  }

  // 在发布页里找出指定类型的图片上传控件（主图 / SKU 图 / 详情图）；找不到返回 null
  function findImageInput(kind) {
    var re = IMAGE_KIND_RE[kind] || IMAGE_KIND_RE.main;
    var all = collectFileInputs().filter(isFileInput);
    if (!all.length) return null;
    function score(el) {
      var t = elContext(el, 5);
      var s = 0;
      if (re.test(t)) s += 5;
      if (/上传图片|点击上传|选择图片|添加图片|拖拽|上传文件/.test(t)) s += 1;
      if (el.multiple) s += 1;
      try { if (el.getClientRects().length) s += 1; } catch (e) { /* ignore */ }
      return s;
    }
    var sorted = all.slice().sort(function (a, b) { return score(b) - score(a); });
    return score(sorted[0]) > 0 ? sorted[0] : null;
  }

  // 找不到文件选择框时，退而求其次找「上传图片」拖拽区，用 drop 事件投喂
  function findDropZone(kind) {
    var re = IMAGE_KIND_RE[kind] || IMAGE_KIND_RE.main;
    var cands = document.querySelectorAll("div,span,button,li,section,td,a");
    var best = null, bestScore = 0;
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      var txt = (el.innerText || "").trim();
      if (!txt || txt.length > 30) continue;
      if (!/上传图片|点击上传|添加图片|上传文件/.test(txt)) continue;
      var ctx = elContext(el, 4);
      var s = re.test(ctx) ? 5 : 0;
      if (!s) continue;
      if (s > bestScore) { bestScore = s; best = el; }
    }
    return best;
  }

  function findMainImageInput() { return findImageInput("main"); }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 尽力展开某个板块（如「销售信息」里的一口价），只在正好命中短标签时点击
  function ensureSection(re) {
    try {
      var els = document.querySelectorAll('[role=tab],a,button,li,span,div');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.closest && el.closest("#xlx-publish-panel")) continue;
        var t = (el.innerText || "").trim();
        if (!t || t.length > 6 || !re.test(t)) continue;
        var target = el.closest('[role=tab],a,button,li') || el;
        target.click();
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function dispatchDrop(el, files) {
    var dt = new DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    ["dragenter", "dragover", "drop"].forEach(function (type) {
      var ev;
      try { ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }); }
      catch (e) { ev = new Event(type, { bubbles: true, cancelable: true }); try { ev.dataTransfer = dt; } catch (e2) { /* ignore */ } }
      el.dispatchEvent(ev);
    });
  }

  // 把指定类型的图片写入发布页对应上传控件（走 DataTransfer，等价于手动选图）
  async function uploadImages(kind, urls) {
    var label = KIND_TEXT[kind] || "图片";
    var files = [], failed = 0;
    for (var i = 0; i < urls.length; i++) {
      try {
        var dataUrl = await fetchImage(urls[i]);
        files.push(dataURLToFile(dataUrl, "xlx-" + kind + "-" + (i + 1)));
      } catch (e) { failed++; }
    }
    if (!files.length) return { ok: false, error: label + "取图失败(" + failed + ")" };
    var input = findImageInput(kind);
    if (!input) {
      var zone = findDropZone(kind);
      if (zone) {
        try { dispatchDrop(zone, files); return { ok: true, count: files.length, failed: failed, via: "drop" }; }
        catch (e) { return { ok: false, error: label + "拖拽投喂失败：" + (e.message || e) }; }
      }
      return { ok: false, error: "未找到" + label + "上传控件（请让该区域出现在当前可视区，或切到对应 tab 再试）" };
    }
    try {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      return { ok: false, error: "写入" + label + "上传控件失败：" + (e.message || e) };
    }
    return { ok: true, count: files.length, failed: failed };
  }

  // React/Vue 受控输入需要走原生 setter 再派发事件，页面才会识别
  function setValue(el, value) {
    try { el.focus(); } catch (e) { /* ignore */ }
    var proto = Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
    return Promise.resolve();
  }

  function getConfig() {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ type: "get-config" }, function (resp) {
        resolve((resp && resp.ok && resp.config) || { backendUrl: XLXPublisher.DEFAULT_BACKEND, token: "" });
      });
    });
  }

  function listProducts(limit) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: "list-products", limit: limit || 100 }, function (resp) {
        if (resp && resp.ok) resolve(resp.products || []);
        else reject(new Error((resp && resp.error) || "取货源库失败"));
      });
    });
  }

  function fetchImage(url) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: "fetch-image", url: url }, function (resp) {
        if (resp && resp.ok) resolve(resp.dataUrl);
        else reject(new Error((resp && resp.error) || "取图失败"));
      });
    });
  }

  function hasPublishForm() {
    if (!TAOBAO_HOST.test(location.hostname || "")) return false;
    var text = (document.body && document.body.innerText || "").slice(0, 20000);
    if (PUBLISH_HINT.test(text)) return true;
    return !!findInput(["宝贝标题", "商品标题", "一口价"]);
  }

  // ---- 面板 ----
  var ROOT = null;
  var BASE = XLXPublisher.DEFAULT_BACKEND;

  function panelHtml() {
    return ''
      + '<div class="xlx-pub-inner">'
      + '<div class="xlx-pub-head">从铺货库填入<span class="xlx-pub-close" title="关闭">×</span></div>'
      + '<input class="xlx-pub-search" placeholder="搜索标题 / 货号 / 商品ID" />'
      + '<div class="xlx-pub-list"><div class="xlx-pub-hint">加载中…</div></div>'
      + '<div class="xlx-pub-detail"></div>'
      + '<div class="xlx-pub-status"></div>'
      + '</div>';
  }

  function status(text, ok) {
    var el = ROOT && ROOT.querySelector(".xlx-pub-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "xlx-pub-status" + (ok === true ? " ok" : ok === false ? " err" : "");
  }

  function rowHtml(p) {
    var img = XLXPublisher.resolveImage(((p.images || {}).main || [])[0], BASE);
    var plan = XLXPublisher.buildFieldPlan(p, BASE);
    var thumb = img
      ? '<span class="xlx-pub-thumb" data-src="' + esc(img) + '"></span>'
      : '<span class="xlx-pub-thumb xlx-pub-thumb-empty"></span>';
    return '<div class="xlx-pub-row" data-id="' + esc(p.id) + '">'
      + thumb
      + '<div class="xlx-pub-meta"><div class="xlx-pub-t">' + esc(plan.title || "(无标题)") + '</div>'
      + '<div class="xlx-pub-s">上架 ¥' + esc(plan.price || "—") + ' · 库存 ' + esc(plan.stock)
      + ' · 主图 ' + plan.images.length + ' · SKU ' + plan.skuImages.length + ' · 详情 ' + plan.detailImages.length + '</div></div>'
      + '<button class="xlx-pub-fill">填入</button></div>';
  }

  function renderList(products) {
    var list = ROOT.querySelector(".xlx-pub-list");
    ROOT._products = products;
    if (!products.length) {
      list.innerHTML = '<div class="xlx-pub-hint">货源库为空，请先在 1688 采集商品</div>';
      return;
    }
    list.innerHTML = products.map(rowHtml).join("");
    list.querySelectorAll(".xlx-pub-thumb[data-src]").forEach(function (s) {
      fetchImage(s.getAttribute("data-src")).then(function (dataUrl) {
        s.style.backgroundImage = "url(" + dataUrl + ")";
      }).catch(function () { s.classList.add("xlx-pub-thumb-empty"); });
    });
  }

  function filterList(keyword) {
    var all = ROOT._products || [];
    var kw = String(keyword || "").trim().toLowerCase();
    if (!kw) return renderList(all);
    var hit = all.filter(function (p) {
      return (p.title || "").toLowerCase().indexOf(kw) >= 0
        || ((p.source || {}).articleNo || "").toLowerCase().indexOf(kw) >= 0
        || ((p.source || {}).itemId || "").indexOf(kw) >= 0;
    });
    renderList(hit);
  }

  function renderDetail(plan, filled, missed, price) {
    var detail = ROOT.querySelector(".xlx-pub-detail");
    var shown = (price == null ? plan.price : price);
    var html = '<div class="xlx-pub-dhead">上架价格（可改）</div>'
      + '<input class="xlx-pub-price" type="number" step="0.01" value="' + esc(shown || "") + '" placeholder="填入价格" />';
    html += '<div class="xlx-pub-hint">已填：' + (filled.length ? esc(filled.join("、")) : "无")
      + (missed.length ? '　未找到：' + esc(missed.join("、")) : "") + '</div>';
    html += '<div class="xlx-pub-actions"><button class="xlx-pub-fillall">一键写入标题·价格·库存·图片</button></div>';
    html += '<div class="xlx-pub-actions">'
      + (plan.images.length ? '<button class="xlx-pub-upload" data-up="main">写入主图（' + plan.images.length + '）</button>' : '')
      + (plan.skuImages.length ? '<button class="xlx-pub-upload" data-up="sku">写入SKU图（' + plan.skuImages.length + '）</button>' : '')
      + (plan.detailImages.length ? '<button class="xlx-pub-upload" data-up="detail">写入详情图（' + plan.detailImages.length + '）</button>' : '')
      + '</div>';
    html += '<div class="xlx-pub-actions">'
      + '<button class="xlx-pub-copy" data-copy="title">复制标题</button>'
      + '<button class="xlx-pub-copy" data-copy="desc">复制描述</button>'
      + '<button class="xlx-pub-copy" data-copy="skus">复制规格价格</button>'
      + '<button class="xlx-pub-copy" data-copy="all">复制全部字段</button>'
      + '</div>';
    if (plan.skus.length) {
      html += '<div class="xlx-pub-dhead">规格（' + plan.skus.length + '）</div>'
        + '<div class="xlx-pub-skus">' + plan.skus.map(function (s) {
          return '<span class="xlx-pub-sku">' + esc(s.label) + ' ¥' + esc(s.price) + ' / ' + esc(s.stock) + '</span>';
        }).join("") + '</div>';
    }
    if (plan.images.length) {
      html += '<div class="xlx-pub-dhead">主图（' + plan.images.length + '，点击下载后上传）</div>'
        + '<div class="xlx-pub-imgs">' + plan.images.map(function (u, i) {
          return '<button class="xlx-pub-img" data-idx="' + i + '" data-src="' + esc(u) + '">图 ' + (i + 1) + '</button>';
        }).join("") + '</div>';
    }
    detail.innerHTML = html;
  }

  function readPriceInput(fallback) {
    var inp = ROOT && ROOT.querySelector(".xlx-pub-price");
    var v = inp ? parseFloat(inp.value) : NaN;
    return (isNaN(v) || v <= 0) ? fallback : v;
  }

  async function uploadAll(plan) {
    var jobs = [["main", plan.images], ["sku", plan.skuImages], ["detail", plan.detailImages]];
    var out = [];
    for (var i = 0; i < jobs.length; i++) {
      var kind = jobs[i][0], list = jobs[i][1];
      if (!list || !list.length) continue;
      var r = await uploadImages(kind, list);
      r.kind = kind;
      r.label = KIND_TEXT[kind];
      out.push(r);
    }
    return out;
  }

  async function fillProduct(product) {
    var plan = XLXPublisher.buildFieldPlan(product, BASE);
    ROOT._product = product;
    ROOT._plan = plan;
    var price = readPriceInput(plan.price);
    // 一口价通常在「销售信息」板块，先尝试展开再找输入框
    if (ensureSection(/销售信息|销售属性|价格与库存|价格/)) await sleep(250);
    var targets = XLXPublisher.fillTargets(plan);
    var filled = [], missed = [];
    targets.forEach(function (t) {
      var el = findInput(t.keywords, true);
      if (el) { setValue(el, t.key === "price" ? String(price) : t.value); filled.push(t.label); }
      else missed.push(t.label);
    });
    status("正在写入图片…");
    var up = await uploadAll(plan);
    renderDetail(plan, filled, missed, price);
    var done = up.filter(function (r) { return r.ok; });
    var bad = up.filter(function (r) { return !r.ok; });
    var parts = [];
    if (filled.length) parts.push("已填 " + filled.join("、"));
    if (missed.length) parts.push("未找到 " + missed.join("、"));
    done.forEach(function (r) { parts.push("已写" + r.label + " " + r.count + " 张"); });
    bad.forEach(function (r) { parts.push(r.label + "：" + r.error); });
    status(parts.join("　") || "无可填字段", bad.length === 0 && missed.length === 0);
  }

  function copyValue(kind, product) {
    if (kind === "title") return String(product.title || "");
    if (kind === "desc") return String(product.description || "");
    if (kind === "skus") {
      return XLXPublisher.buildFieldPlan(product, BASE).skus.map(function (s) {
        return s.label + " ¥" + s.price + " / " + s.stock;
      }).join("\n");
    }
    return XLXPublisher.describeProduct(product, BASE);
  }

  function onListClick(ev) {
    var btn = ev.target.closest(".xlx-pub-fill");
    if (!btn) return;
    var row = btn.closest(".xlx-pub-row");
    var id = row && row.getAttribute("data-id");
    var product = (ROOT._products || []).filter(function (p) { return p.id === id; })[0];
    if (!product) return;
    btn.disabled = true;
    fillProduct(product).then(function () { btn.disabled = false; })
      .catch(function (e) { status("填入失败：" + (e.message || e), false); btn.disabled = false; });
  }

  function onDetailClick(ev) {
    var fillBtn = ev.target.closest(".xlx-pub-fillall");
    if (fillBtn) {
      var p0 = ROOT._product;
      if (!p0) return;
      fillBtn.disabled = true;
      fillProduct(p0).then(function () { fillBtn.disabled = false; })
        .catch(function (e) { status("写入失败：" + (e.message || e), false); fillBtn.disabled = false; });
      return;
    }
    var upBtn = ev.target.closest(".xlx-pub-upload");
    if (upBtn) {
      var plan = ROOT._plan;
      if (!plan) return;
      var kind = upBtn.getAttribute("data-up") || "main";
      var list = kind === "sku" ? plan.skuImages : kind === "detail" ? plan.detailImages : plan.images;
      var label = KIND_TEXT[kind] || "图片";
      upBtn.disabled = true;
      status("正在写入" + label + " " + list.length + " 张…");
      uploadImages(kind, list).then(function (r) {
        if (r.ok) status("已写入" + label + " " + r.count + " 张", true);
        else status(label + "未写入：" + r.error, false);
      }).then(function () { upBtn.disabled = false; });
      return;
    }
    var imgBtn = ev.target.closest(".xlx-pub-img");
    if (imgBtn) {
      var src = imgBtn.getAttribute("data-src");
      var idx = Number(imgBtn.getAttribute("data-idx")) + 1;
      imgBtn.disabled = true;
      status("正在取图 " + idx + "…");
      fetchImage(src).then(function (dataUrl) {
        var a = document.createElement("a");
        a.href = dataUrl;
        a.download = "xlx-image-" + idx + ".jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        status("已下载 图 " + idx, true);
      }).catch(function (e) {
        status("取图失败：" + (e.message || e) + "（可右键另存或先在货源库归档图片）", false);
      }).then(function () { imgBtn.disabled = false; });
      return;
    }
    var btn = ev.target.closest(".xlx-pub-copy");
    if (!btn) return;
    var product = ROOT._product;
    if (!product) return;
    var text = copyValue(btn.getAttribute("data-copy"), product);
    if (!text) { status("没有可复制的内容", false); return; }
    copyText(text).then(function () { status("已复制到剪贴板", true); });
  }

  function closePanel() {
    if (ROOT) { ROOT.remove(); ROOT = null; }
  }

  async function openPanel() {
    var cfg = await getConfig();
    BASE = cfg.backendUrl || XLXPublisher.DEFAULT_BACKEND;
    var old = document.getElementById("xlx-publish-panel");
    if (old) old.remove();
    ROOT = document.createElement("div");
    ROOT.id = "xlx-publish-panel";
    ROOT.innerHTML = panelHtml();
    document.body.appendChild(ROOT);
    ROOT.querySelector(".xlx-pub-close").addEventListener("click", closePanel);
    ROOT.querySelector(".xlx-pub-list").addEventListener("click", onListClick);
    ROOT.querySelector(".xlx-pub-detail").addEventListener("click", onDetailClick);
    ROOT.querySelector(".xlx-pub-search").addEventListener("input", function (e) { filterList(e.target.value); });
    try {
      var products = await listProducts(100);
      renderList(products);
      status("共 " + products.length + " 件货源", products.length > 0);
    } catch (e) {
      ROOT.querySelector(".xlx-pub-list").innerHTML = '<div class="xlx-pub-hint">加载失败</div>';
      status("加载失败：" + (e.message || e) + "（请检查扩展配置的后端地址与令牌）", false);
    }
  }

  function mount() {
    if (document.getElementById("xlx-publish-btn")) return;
    var btn = document.createElement("button");
    btn.id = "xlx-publish-btn";
    btn.textContent = "从铺货库填入";
    btn.addEventListener("click", openPanel);
    document.body.appendChild(btn);
  }

  function waitForForm() {
    if (hasPublishForm()) { mount(); return; }
    var tries = 0;
    var obs = new MutationObserver(function () {
      if (hasPublishForm()) { obs.disconnect(); mount(); }
      else if (++tries > 60) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForForm);
  else waitForForm();
})();
