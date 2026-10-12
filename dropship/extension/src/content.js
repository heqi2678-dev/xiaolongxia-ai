/* 铜龙铺货采集器 · 页面内容脚本
 * 在 1688 商品页注入一个悬浮按钮；点击后滚动页面触发懒加载，取整页 HTML，
 * 交给 XLXCollector 解析，再通过 background 回传铺货后端。
 */
(function () {
  "use strict";
  if (window.__xlxCollectorInjected) return;
  window.__xlxCollectorInjected = true;

  function fullHtml() {
    return "<!doctype html>" + document.documentElement.outerHTML;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // 逐步滚到底再回顶，触发 1688 的图片懒加载
  async function triggerLazyLoad() {
    var total = document.body.scrollHeight;
    var step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (var y = 0; y <= total; y += step) {
      window.scrollTo(0, y);
      await sleep(120);
      total = Math.max(total, document.body.scrollHeight);
    }
    window.scrollTo(0, 0);
    await sleep(150);
  }

  async function collectNow() {
    await triggerLazyLoad();
    var product = XLXCollector.extractOffer({ url: location.href, html: fullHtml() });
    return product;
  }

  function setState(btn, text, ok) {
    btn.textContent = text;
    btn.dataset.state = ok ? "ok" : "busy";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // 采集预览面板：勾选要保留的字段与图片，确认后再回传
  function showPreview(product, onConfirm) {
    var old = document.getElementById("xlx-preview");
    if (old) old.remove();
    var main = (product.images && product.images.main) || [];
    var detail = (product.images && product.images.detail) || [];
    var sku = (product.images && product.images.sku) || [];
    var field = function (key, label, checked) {
      return '<label class="xlx-pf"><input type="checkbox" data-field="' + key + '"' + (checked ? " checked" : "") + '> ' + esc(label) + "</label>";
    };
    var imgCell = function (group, i, url) {
      return '<label class="xlx-pi"><input type="checkbox" data-group="' + group + '" data-idx="' + i + '" checked>'
        + '<img src="' + esc(url) + '" loading="lazy"></label>';
    };
    var box = document.createElement("div");
    box.id = "xlx-preview";
    box.innerHTML = ''
      + '<div class="xlx-pv-inner">'
      + '<div class="xlx-pv-head">采集预览 · 确认要铺货的内容</div>'
      + '<div class="xlx-pv-title">' + esc((product.title || "").slice(0, 60) || "(无标题)") + "</div>"
      + '<div class="xlx-pv-fields">'
      + field("title", "标题", true) + field("description", "描述", true)
      + field("skus", "SKU/价格", true) + field("ladder", "阶梯价", true) + field("source", "货号/供应商", true)
      + "</div>"
      + '<div class="xlx-pv-label">主图（' + main.length + '）</div>'
      + '<div class="xlx-pv-imgs">' + main.map(function (u, i) { return imgCell("main", i, u); }).join("") + "</div>"
      + (sku.length ? '<div class="xlx-pv-label">SKU 图（' + sku.length + '）</div>'
        + '<div class="xlx-pv-imgs">' + sku.map(function (u, i) { return imgCell("sku", i, u); }).join("") + "</div>" : "")
      + (detail.length ? '<div class="xlx-pv-label">详情图（' + detail.length + '）</div>'
        + '<div class="xlx-pv-imgs">' + detail.map(function (u, i) { return imgCell("detail", i, u); }).join("") + "</div>" : "")
      + '<div class="xlx-pv-actions"><button class="xlx-pv-cancel">取消</button><button class="xlx-pv-ok">确认采集</button></div>'
      + "</div>";

    function readSelection() {
      var fields = {};
      box.querySelectorAll("[data-field]").forEach(function (c) { fields[c.dataset.field] = c.checked; });
      var sel = { fields: fields, main: [], detail: [] };
      box.querySelectorAll('input[data-group]:checked').forEach(function (c) {
        sel[c.dataset.group].push(parseInt(c.dataset.idx, 10));
      });
      return sel;
    }

    box.querySelector(".xlx-pv-cancel").onclick = function () { box.remove(); };
    box.querySelector(".xlx-pv-ok").onclick = function () {
      box.remove();
      onConfirm(XLXCollector.applySelection(product, readSelection()));
    };
    document.body.appendChild(box);
  }

  async function onCollect(btn) {
    setState(btn, "采集中…", false);
    try {
      var product = await collectNow();
      if (!product.source.itemId) throw new Error("未识别到商品 ID");
      setState(btn, "待确认", false);
      showPreview(product, async function (selected) {
        setState(btn, "回传中…", false);
        try {
          var resp = await chrome.runtime.sendMessage({ type: "collect", product: selected });
          if (!resp || !resp.ok) throw new Error((resp && resp.error) || "回传失败");
          setState(btn, "已采集 ✓", true);
        } catch (e) {
          setState(btn, "失败：" + (e.message || e), false);
        }
        setTimeout(function () { setState(btn, "采集到铜龙铺货", true); }, 2500);
      });
    } catch (e) {
      setState(btn, "失败：" + (e.message || e), false);
      setTimeout(function () { setState(btn, "采集到铜龙铺货", true); }, 3000);
    }
  }

  function mount() {
    if (document.getElementById("xlx-collect-btn")) return;
    var btn = document.createElement("button");
    btn.id = "xlx-collect-btn";
    btn.textContent = "采集到铜龙铺货";
    btn.addEventListener("click", function () { onCollect(btn); });
    document.body.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (msg && msg.type === "collect-now") {
      collectNow().then(function (p) { reply({ ok: true, product: p }); })
        .catch(function (e) { reply({ ok: false, error: String(e) }); });
      return true;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
