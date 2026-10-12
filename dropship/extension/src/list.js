/* 铜龙铺货采集器 · 列表页/收藏夹批量采集
 * 在 1688 搜索结果页、店铺商品页、收藏夹等列表页注入「批量采集本页商品」按钮，
 * 逐条抓取详情页 HTML 并解析，批量回传到铺货后端。
 */
(function () {
  "use strict";
  if (window.__xlxListInjected) return;
  window.__xlxListInjected = true;

  function isDetailPage() {
    return /\/offer\/\d+\.html/.test(location.pathname);
  }

  function pageLinks() {
    var anchors = document.querySelectorAll('a[href*="offer/"]');
    var html = Array.prototype.map.call(anchors, function (a) {
      return '<a href="' + a.getAttribute("href") + '"></a>';
    }).join("");
    return XLXCollector.extractBatchLinks(html);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function collectBatch(limit, onProgress) {
    var links = pageLinks().slice(0, limit || 30);
    var sent = 0;
    for (var i = 0; i < links.length; i++) {
      if (onProgress) onProgress(i + 1, links.length);
      try {
        var resp = await fetch(links[i].url, { credentials: "include" });
        var html = await resp.text();
        var product = XLXCollector.extractOffer({ url: links[i].url, html: html });
        if (product.source.itemId) {
          var r = await chrome.runtime.sendMessage({ type: "collect", product: product });
          if (r && r.ok) sent++;
        }
      } catch (e) { /* 单条失败不影响批量 */ }
      await sleep(300);
    }
    return { total: links.length, sent: sent };
  }

  function setState(btn, text, ok) {
    btn.textContent = text;
    btn.dataset.state = ok ? "ok" : "busy";
  }

  function mount() {
    if (isDetailPage() || document.getElementById("xlx-batch-btn")) return;
    if (!pageLinks().length) return;
    var btn = document.createElement("button");
    btn.id = "xlx-batch-btn";
    btn.textContent = "批量采集本页商品";
    btn.addEventListener("click", async function () {
      btn.disabled = true;
      setState(btn, "批量采集中…", false);
      try {
        var r = await collectBatch(30, function (i, n) { setState(btn, "采集中 " + i + "/" + n, false); });
        setState(btn, "已采集 " + r.sent + "/" + r.total, true);
      } catch (e) {
        setState(btn, "失败：" + (e.message || e), false);
      }
      btn.disabled = false;
      setTimeout(function () { setState(btn, "批量采集本页商品", true); }, 3000);
    });
    document.body.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (msg && msg.type === "collect-batch") {
      collectBatch(msg.limit || 30).then(function (r) { reply({ ok: true, result: r }); })
        .catch(function (e) { reply({ ok: false, error: String(e) }); });
      return true;
    }
    return false;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
