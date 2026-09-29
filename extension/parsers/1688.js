/* 1688 采集解析层（Design: parsers/1688.js）
 *
 * 所有函数都设计为“自包含”，可被 chrome.scripting.executeScript 直接序列化注入。
 * 因此函数内部不引用本文件作用域的变量，所有选择器与工具函数都写在函数体内。
 * parseDetail 需要读取页面 window 上的内嵌 JSON，注入时须使用 world: "MAIN"。
 */
(function () {
  var globalScope = typeof self !== "undefined" ? self : window;

  function offerIdFromUrl(href) {
    var m = String(href || "").match(/offer\/(\d{6,})\.html/);
    return m ? m[1] : "";
  }

  function parseDetail() {
    var out = {
      source_id: "",
      source_url: location.href.split("#")[0],
      title: "",
      subtitle: "",
      category: "",
      price: null,
      stock: null,
      main_image: "",
      images: [],
      skus: [],
      detail: {},
      attrs: {}
    };
    var seen = {};
    function pushImage(u) {
      if (!u) return;
      u = absUrl(u);
      if (!u || seen[u]) return;
      if (/\.(gif|svg)($|\?)/i.test(u)) return;
      seen[u] = 1;
      out.images.push(u);
    }
    function absUrl(u) {
      if (!u) return "";
      u = String(u).trim();
      if (!u || u.indexOf("data:") === 0 || u.indexOf("blob:") === 0) return "";
      if (u.indexOf("//") === 0) return location.protocol + u;
      if (u.charAt(0) === "/") return location.origin + u;
      return u;
    }
    function num(v) {
      if (v == null) return null;
      var m = String(v).replace(/[^0-9.\-]/g, "");
      if (!m) return null;
      var n = parseFloat(m);
      return isNaN(n) ? null : n;
    }
    function text(sel) {
      try {
        var el = document.querySelector(sel);
        return el ? String(el.textContent || "").trim() : "";
      } catch (e) { return ""; }
    }
    function attr(sel, name) {
      try {
        var el = document.querySelector(sel);
        return el ? (el.getAttribute(name) || "") : "";
      } catch (e) { return ""; }
    }
    function meta(prop) {
      try {
        var el = document.querySelector('meta[property="' + prop + '"]')
          || document.querySelector('meta[name="' + prop + '"]');
        return el ? (el.getAttribute("content") || "") : "";
      } catch (e) { return ""; }
    }

    out.source_id = (function () {
      var m = String(location.href).match(/offer\/(\d{6,})\.html/);
      return m ? m[1] : "";
    })();

    /* 1) 内嵌 JSON（MAIN world 可见） */
    var data = null;
    var candidates = [];
    try {
      if (typeof window !== "undefined") {
        ["__INIT_DATA__", "__GLOBAL_DATA", "__NEXT_DATA__", "iDetailData", "detailData", "runParams"].forEach(function (k) {
          if (window[k]) candidates.push(window[k]);
        });
      }
    } catch (e) { /* ignore */ }
    for (var i = 0; i < candidates.length && !data; i++) {
      data = dig(candidates[i]);
    }
    function dig(root) {
      if (!root || typeof root !== "object") return null;
      try {
        var stack = [root];
        var guard = 0;
        while (stack.length && guard < 4000) {
          guard++;
          var node = stack.pop();
          if (!node || typeof node !== "object") continue;
          if (node.offerId || node.offer_id || node.productId || node.subject) {
            if (node.offerId || node.offer_id || node.productId) {
              if (node.subject || node.title || node.name) return node;
            }
          }
          for (var k in node) {
            if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
            var v = node[k];
            if (v && typeof v === "object") stack.push(v);
          }
        }
      } catch (e) { /* ignore */ }
      return null;
    }
    if (data) {
      out.source_id = String(data.offerId || data.offer_id || data.productId || out.source_id);
      out.title = String(data.subject || data.title || data.name || "");
    }

    /* 2) JSON-LD */
    if (!out.title || !out.source_id) {
      try {
        var ldNodes = document.querySelectorAll('script[type="application/ld+json"]');
        for (var li = 0; li < ldNodes.length; li++) {
          var j = JSON.parse(ldNodes[li].textContent || "null");
          if (j && j["@type"] === "Product") {
            out.title = out.title || String(j.name || "");
            if (j.offers) out.price = out.price != null ? out.price : num(j.offers.price);
            if (j.image) {
              var imgs = Array.isArray(j.image) ? j.image : [j.image];
              for (var ii = 0; ii < imgs.length; ii++) pushImage(imgs[ii]);
            }
          }
        }
      } catch (e) { /* ignore */ }
    }

    /* 3) meta / og */
    if (!out.title) out.title = meta("og:title") || document.title || "";
    if (out.price == null) out.price = num(meta("og:price:amount")) || num(meta("product:price:amount"));
    pushImage(meta("og:image"));

    /* 4) DOM 回退 */
    if (!out.title) out.title = text("h1") || text(".title-text") || text('[class*="title"] h1');
    if (out.price == null) out.price = num(text(".price .value")) || num(text('[class*="price"] [class*="value"]')) || num(text(".price-original"));
    var imgSel = [
      '[class*="gallery"] img',
      '[class*="thumb"] img',
      '[class*="detail"] img',
      'img[src*="cbu01"]',
      'img[data-src*="cbu01"]'
    ];
    for (var si = 0; si < imgSel.length; si++) {
      var nodes = document.querySelectorAll(imgSel[si]);
      for (var ni = 0; ni < nodes.length; ni++) {
        pushImage(nodes[ni].getAttribute("src") || nodes[ni].getAttribute("data-src") || nodes[ni].getAttribute("data-lazy-src"));
      }
    }
    out.main_image = out.images[0] || "";

    /* 5) 属性表 */
    try {
      var dts = document.querySelectorAll("dt");
      for (var di = 0; di < dts.length; di++) {
        var dt = String(dts[di].textContent || "").trim();
        var dd = dts[di].nextElementSibling;
        if (dt && dd) {
          var val = String(dd.textContent || "").trim();
          if (val && dt.length < 20 && !out.attrs[dt]) out.attrs[dt] = val;
        }
      }
    } catch (e) { /* ignore */ }

    out.detail = { html: "" };
    return out;
  }

  function parseList() {
    var offers = [];
    var seen = {};
    function add(href, title) {
      var m = String(href || "").match(/offer\/(\d{6,})\.html/);
      if (!m) return;
      var id = m[1];
      if (seen[id]) {
        var ex = offers.filter(function (o) { return o.source_id === id; })[0];
        if (ex && !ex.title && title) ex.title = title;
        return;
      }
      seen[id] = 1;
      offers.push({ source_id: id, source_url: "https://detail.1688.com/offer/" + id + ".html", title: title || "" });
    }
    try {
      var anchors = document.querySelectorAll('a[href*="/offer/"]');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var t = (a.getAttribute("title") || a.textContent || "").trim().replace(/\s+/g, " ");
        add(a.href, t.slice(0, 120));
      }
    } catch (e) { /* ignore */ }
    return offers;
  }

  var api = { parseDetail: parseDetail, parseList: parseList, offerIdFromUrl: offerIdFromUrl };
  globalScope.XLX1688 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
