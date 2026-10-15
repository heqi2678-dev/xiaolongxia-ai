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

  // 在发布页里找出「主图」上传控件：优先文案命中「主图/白底图」、支持多选的
  function findMainImageInput() {
    var all = Array.prototype.slice.call(document.querySelectorAll('input[type=file]')).filter(isFileInput);
    if (!all.length) return null;
    function score(el) {
      var t = fieldText(el);
      var box = el.closest ? el.closest("div,li,section,td") : null;
      if (box && box.innerText) t += " " + box.innerText.slice(0, 80);
      var s = 0;
      if (/主图|商品图|宝贝图|白底图/.test(t)) s += 4;
      if (/上传|添加图片|点击上传|选择图片/.test(t)) s += 1;
      if (el.multiple) s += 1;
      return s;
    }
    return all.slice().sort(function (a, b) { return score(b) - score(a); })[0];
  }

  // 把商品主图写入发布页的上传控件（走 DataTransfer，等价于手动选图）
  async function uploadImages(urls) {
    var input = findMainImageInput();
    if (!input) return { ok: false, error: "未找到主图上传控件（请切到主图所在 tab 再试）" };
    var files = [], failed = 0;
    for (var i = 0; i < urls.length; i++) {
      try {
        var dataUrl = await fetchImage(urls[i]);
        files.push(dataURLToFile(dataUrl, "xlx-main-" + (i + 1)));
      } catch (e) { failed++; }
    }
    if (!files.length) return { ok: false, error: "主图取图失败(" + failed + ")" };
    try {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      return { ok: false, error: "写入上传控件失败：" + (e.message || e) };
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
      + '<div class="xlx-pub-s">¥' + esc(plan.price || "—") + ' · 库存 ' + esc(plan.stock) + ' · 主图 ' + plan.images.length + '</div></div>'
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

  function renderDetail(plan, filled, missed) {
    var detail = ROOT.querySelector(".xlx-pub-detail");
    var html = '<div class="xlx-pub-dhead">填充结果</div>';
    html += '<div class="xlx-pub-hint">已填：' + (filled.length ? esc(filled.join("、")) : "无")
      + (missed.length ? '　未找到：' + esc(missed.join("、")) : "") + '</div>';
    html += '<div class="xlx-pub-actions">'
      + '<button class="xlx-pub-copy" data-copy="all">复制全部字段</button>'
      + '<button class="xlx-pub-copy" data-copy="desc">复制描述</button>'
      + (plan.images.length ? '<button class="xlx-pub-upload" data-up="1">写入主图（' + plan.images.length + '）</button>' : '')
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

  async function fillProduct(product) {
    var plan = XLXPublisher.buildFieldPlan(product, BASE);
    ROOT._product = product;
    ROOT._plan = plan;
    var targets = XLXPublisher.fillTargets(plan);
    var filled = [], missed = [];
    targets.forEach(function (t) {
      var el = findInput(t.keywords, true);
      if (el) { setValue(el, t.value); filled.push(t.label); }
      else missed.push(t.label);
    });
    var imgMsg = "", imgOk = true;
    if (plan.images.length && ROOT._uploadedFor !== product.id) {
      status("正在写入主图 " + plan.images.length + " 张…");
      var up = await uploadImages(plan.images);
      if (up.ok) { ROOT._uploadedFor = product.id; imgMsg = "已写入主图 " + up.count + " 张"; }
      else { imgOk = false; imgMsg = "主图未写入：" + up.error; }
    }
    renderDetail(plan, filled, missed);
    var parts = [];
    if (filled.length) parts.push("已填 " + filled.join("、"));
    if (missed.length) parts.push("未找到 " + missed.join("、"));
    if (imgMsg) parts.push(imgMsg);
    status(parts.join("　") || "无可填字段", missed.length === 0 && imgOk);
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
    var upBtn = ev.target.closest(".xlx-pub-upload");
    if (upBtn) {
      var prod = ROOT._product, plan = ROOT._plan;
      if (!prod || !plan) return;
      upBtn.disabled = true;
      status("正在写入主图 " + plan.images.length + " 张…");
      uploadImages(plan.images).then(function (r) {
        if (r.ok) { ROOT._uploadedFor = prod.id; status("已写入主图 " + r.count + " 张", true); }
        else status("主图未写入：" + r.error, false);
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
    var text = btn.getAttribute("data-copy") === "desc"
      ? XLXPublisher.buildFieldPlan(product, BASE).description
      : XLXPublisher.describeProduct(product, BASE);
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
