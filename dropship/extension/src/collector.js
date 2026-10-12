/* 铜龙铺货采集器 · 采集核心（纯函数）
 * 只依赖字符串与正则，浏览器与 node 测试台共用。content 脚本负责取页面 HTML，
 * 本文件负责把 HTML/URL 解析成统一商品原始结构（交给铺货后端 normalize）。
 */
(function (root) {
  "use strict";

  // 允许采集的图床域名（避免把无关站点素材带进来）
  var IMAGE_HOSTS = ["cbu01.alicdn.com", "img.alicdn.com", "gw.alicdn.com", "sc04.alicdn.com"];

  var ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

  function decodeEntities(s) {
    return String(s == null ? "" : s).replace(/&(amp|lt|gt|quot|#39|nbsp);/g, function (m) {
      return ENTITIES[m] || m;
    });
  }

  function stripTags(s) {
    return decodeEntities(String(s || "").replace(/<[^>]*>/g, "")).trim();
  }

  function extractOfferId(url) {
    var m = String(url || "").match(/offer\/(\d+)\.html/) || String(url || "").match(/[?&]offerId=(\d+)/);
    return m ? m[1] : "";
  }

  function isAllowedImage(url) {
    var u = String(url || "").trim();
    if (!u) return false;
    if (u.indexOf("data:") === 0) return false;
    var norm = u.indexOf("//") === 0 ? "https:" + u : u;
    try {
      var host = norm.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
      return IMAGE_HOSTS.some(function (h) { return host === h || host.slice(-(h.length + 1)) === "." + h; });
    } catch (e) {
      return false;
    }
  }

  // 去掉缩略图后缀，换取原图：xxx.jpg_220x220.jpg → xxx.jpg
  function normalizeImageUrl(url) {
    var u = String(url || "").trim();
    if (u.indexOf("//") === 0) u = "https:" + u;
    u = u.replace(/\.(jpg|jpeg|png|webp)_[^/?#]*$/i, ".$1");
    u = u.replace(/\?.*$/, "");
    return u;
  }

  // 页面装饰性素材（图标/占位/广告/评价图）——直接不采集
  function isJunkImage(url) {
    var u = String(url || "").trim().toLowerCase();
    if (!u) return true;
    if (/\.svg$|\.ico$/.test(u)) return true;
    if (u.indexOf("-tps-") >= 0 || u.indexOf("/tps/") >= 0 || u.indexOf("tps-") === 0) return true;
    if (u.indexOf("gg_dtc") >= 0 || u.indexOf("spacer.") >= 0) return true;
    if (/-rate[.-]|_rate[.-]|\/rate\//.test(u)) return true;
    return false;
  }

  // 采集图片并保留其在 HTML 中的位置（用于按板块切分主图/详情图）
  function collectImageRefs(html) {
    var out = [];
    var seen = {};
    var re = /(?:data-src|data-lazy-src|data-oss-src|src)\s*=\s*["']([^"']+)["']/gi;
    var m;
    while ((m = re.exec(html))) {
      var raw = m[1];
      if (!isAllowedImage(raw)) continue;
      if (isJunkImage(normalizeImageUrl(raw))) continue;
      var url = normalizeImageUrl(raw);
      if (seen[url]) continue;
      seen[url] = 1;
      out.push({ url: url, index: m.index });
    }
    return out;
  }

  function collectImages(html) {
    return collectImageRefs(html).map(function (r) { return r.url; });
  }

  // 主图上限：1688 详情页主图一般 5 张
  var MAX_MAIN = 5;
  // 判定“本商品图”所需的最少同卖家图数量
  var MIN_GROUP = 4;

  // 从 alicdn 图片 URL 提取卖家/账号 uid（形如 ..._!!2206904719491-0-cib.jpg）
  function imageUid(url) {
    var m = String(url || "").match(/!!(\d+)/);
    return m ? m[1] : "";
  }

  // 隔离“本商品自己的图”：详情页会混入大量“推荐/相关商品”的缩略图（各自独立 uid），
  // 本商品图共用同一卖家 uid。取占比最高的 uid 组为本商品图，无 uid 的图单独归入详情。
  function isolateOfferImages(refs) {
    var groups = {}, order = [], noUid = [];
    (refs || []).forEach(function (r) {
      var k = imageUid(r.url);
      if (!k) { noUid.push(r); return; }
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });
    var best = "", bestLen = 0;
    order.forEach(function (k) {
      if (groups[k].length > bestLen) { bestLen = groups[k].length; best = k; }
    });
    if (best && bestLen >= MIN_GROUP) return { own: groups[best], extra: noUid };
    return { own: refs || [], extra: [] };
  }

  // 归纳主图/详情图：主图取本商品图前 MAX_MAIN 张，其余本商品图与无 uid 图归详情图
  function classifyImages(refs) {
    refs = refs || [];
    var iso = isolateOfferImages(refs);
    var main = iso.own.slice(0, MAX_MAIN).map(function (r) { return r.url; });
    var detail = iso.own.slice(MAX_MAIN).map(function (r) { return r.url; })
      .concat(iso.extra.map(function (r) { return r.url; }));
    if (!main.length) main = detail.splice(0, Math.min(MAX_MAIN, detail.length));
    return { main: main, detail: detail };
  }

  // SKU 图：从页面 JSON 的 sku 图片字段抽取（兼容 1688 常见字段名）
  function extractSkuImages(html) {
    var out = [], seen = {}, re = /"(?:skuImage|skuImg|skuImageUrl|imageUrl)"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/gi, m;
    while ((m = re.exec(html))) {
      var raw = m[1].replace(/\\\//g, "/");
      if (!isAllowedImage(raw) || isJunkImage(raw)) continue;
      var url = normalizeImageUrl(raw);
      if (seen[url]) continue;
      seen[url] = 1;
      out.push(url);
    }
    return out;
  }

  function firstMatch(html, re) {
    var m = html.match(re);
    return m ? m[1] : "";
  }

  function extractTitle(html) {
    var og = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og) return stripTags(og);
    var t = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    return stripTags(t).replace(/[-_].*1688.*$/i, "").trim();
  }

  function extractPrice(html) {
    var m = firstMatch(html, /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i);
    if (!m) m = firstMatch(html, /property=["']og:price:amount["'][^>]+content=["']([0-9.]+)["']/i);
    var n = parseFloat(m);
    return isNaN(n) ? 0 : n;
  }

  function extractDescription(html) {
    var m = html.match(/<div[^>]+class=["'][^"']*detail-desc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    return m ? stripTags(m[1]).slice(0, 5000) : "";
  }

  // 阶梯价：[{minQty, price}]，1688 常见形如 {"beginAmount":N,"price":"P"}
  function extractLadderPrices(html) {
    var out = [], seen = {}, re = /"beginAmount"\s*:\s*(\d+)\s*,\s*"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/g, m;
    while ((m = re.exec(html))) {
      var key = m[1] + "-" + m[2];
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({ minQty: parseInt(m[1], 10), price: parseFloat(m[2]) });
    }
    return out;
  }

  // 货号 / 商家编码
  function extractItemNo(html) {
    var m = firstMatch(html, /"(?:productCode|productSn|articleNo|itemNo)"\s*:\s*"([^"]+)"/i);
    if (!m) m = firstMatch(html, /货号[：:\s]*([A-Za-z0-9_\-]{2,40})/);
    return m ? m.trim() : "";
  }

  // 供应商
  function extractSupplier(html) {
    var m = firstMatch(html, /"(?:companyName|supplierName|sellerName)"\s*:\s*"([^"]+)"/i);
    return stripTags(m);
  }

  // 规格组合：从页面 JSON 里取颜色/尺码候选值
  function extractSpecs(html) {
    function values(re) {
      var m = html.match(re);
      return m ? (m[1].match(/"([^"]+)"/g) || []).map(function (s) { return s.replace(/"/g, ""); }) : [];
    }
    return {
      colors: values(/"color"\s*:\s*\[([^\]]*)\]/i),
      sizes: values(/"size"\s*:\s*\[([^\]]*)\]/i)
    };
  }

  // images 为 SKU 图候选，按顺序循环分配给各 SKU；无 SKU 图时退回主图
  function buildSkus(specs, price, image, images) {
    var colors = (specs && specs.colors && specs.colors.length) ? specs.colors : [""];
    var sizes = (specs && specs.sizes && specs.sizes.length) ? specs.sizes : [""];
    var pool = (images && images.length) ? images : (image ? [image] : []);
    var out = [];
    colors.forEach(function (c) {
      sizes.forEach(function (s) {
        out.push({
          skuId: "sku-" + (out.length + 1),
          specs: { color: c, size: s },
          price: price,
          stock: 1,
          image: pool.length ? pool[out.length % pool.length] : ""
        });
      });
    });
    return out;
  }

  // 列表页 / 收藏夹：提取所有商品详情链接（去重、补全协议）
  function extractBatchLinks(html) {
    var out = [], seen = {}, re = /href\s*=\s*["']([^"']*offer\/(\d+)\.html[^"']*)["']/gi, m;
    while ((m = re.exec(html))) {
      var id = m[2];
      if (seen[id]) continue;
      seen[id] = 1;
      var u = m[1];
      if (u.indexOf("//") === 0) u = "https:" + u;
      if (u.indexOf("http") !== 0) u = "https://detail.1688.com/offer/" + id + ".html";
      out.push({ itemId: id, url: u });
    }
    return out;
  }

  // 按预览面板的勾选裁剪商品：fields 控制字段开关，main/detail 为保留的图片下标
  function applySelection(product, sel) {
    sel = sel || {};
    var fields = sel.fields || {};
    var out = JSON.parse(JSON.stringify(product || {}));
    out.images = out.images || { main: [], detail: [], sku: [] };
    if (fields.title === false) out.title = "";
    if (fields.description === false) out.description = "";
    if (fields.skus === false) out.skus = [];
    if (fields.ladder === false && out.pricing) out.pricing.ladder = [];
    if (fields.source === false && out.source) {
      out.source = { platform: out.source.platform, itemId: out.source.itemId, url: out.source.url };
    }
    if (Array.isArray(sel.main)) out.images.main = (out.images.main || []).filter(function (_, i) { return sel.main.indexOf(i) >= 0; });
    if (Array.isArray(sel.detail)) out.images.detail = (out.images.detail || []).filter(function (_, i) { return sel.detail.indexOf(i) >= 0; });
    if (Array.isArray(sel.sku)) out.images.sku = (out.images.sku || []).filter(function (_, i) { return sel.sku.indexOf(i) >= 0; });
    return out;
  }

  // 把页面 HTML 解析为统一原始商品结构
  function extractOffer(input) {
    var url = (input && input.url) || "";
    var html = (input && input.html) || "";
    var offerId = extractOfferId(url);
    var refs = collectImageRefs(html);
    var split = classifyImages(refs);
    var skuImages = extractSkuImages(html);
    var price = extractPrice(html);
    var ladder = extractLadderPrices(html);
    if (!price && ladder.length) price = ladder[0].price;
    var specs = extractSpecs(html);
    // 三组互斥：SKU 图不重复进主图；主图/详情图也不重复进 SKU 图
    var main = split.main.filter(function (u) { return skuImages.indexOf(u) < 0; });
    var detail = split.detail.filter(function (u) { return skuImages.indexOf(u) < 0; });
    skuImages = skuImages.filter(function (u) { return main.indexOf(u) < 0 && detail.indexOf(u) < 0; });
    var cover = main[0] || detail[0] || skuImages[0] || "";
    var product = {
      source: {
        platform: "1688",
        itemId: offerId,
        url: url,
        shop: extractSupplier(html),
        articleNo: extractItemNo(html),
        collectedAt: new Date().toISOString()
      },
      title: extractTitle(html),
      description: extractDescription(html),
      images: { main: main, detail: detail, sku: skuImages },
      skus: price > 0 ? buildSkus(specs, price, cover, skuImages) : [],
      category: { sourcePath: [] },
      pricing: { cost: price, price: price, currency: "CNY", ladder: ladder }
    };
    return product;
  }

  var API = {
    IMAGE_HOSTS: IMAGE_HOSTS,
    MAX_MAIN: MAX_MAIN,
    decodeEntities: decodeEntities,
    stripTags: stripTags,
    extractOfferId: extractOfferId,
    isAllowedImage: isAllowedImage,
    isJunkImage: isJunkImage,
    normalizeImageUrl: normalizeImageUrl,
    collectImageRefs: collectImageRefs,
    collectImages: collectImages,
    imageUid: imageUid,
    isolateOfferImages: isolateOfferImages,
    classifyImages: classifyImages,
    extractSkuImages: extractSkuImages,
    extractTitle: extractTitle,
    extractPrice: extractPrice,
    extractDescription: extractDescription,
    extractLadderPrices: extractLadderPrices,
    extractItemNo: extractItemNo,
    extractSupplier: extractSupplier,
    extractSpecs: extractSpecs,
    buildSkus: buildSkus,
    extractBatchLinks: extractBatchLinks,
    applySelection: applySelection,
    extractOffer: extractOffer
  };

  root.XLXCollector = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof self !== "undefined" ? self : this);
