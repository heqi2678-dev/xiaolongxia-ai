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
    u = u.replace(/\.(?:search|summ|\d+x\d+)\.(jpg|jpeg|png|webp)$/i, ".$1");
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
    if (u.indexOf("/cms/upload/") >= 0) return true;
    if (u.indexOf("/tfs/") >= 0) return true;
    if (u.indexOf("tbvideo") >= 0) return true;
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

  // 从页面内嵌 JSON 的某个 key 抽取图片数组（形如 "offerImgList":["https:\/\/..."]）
  function extractJsonImageArray(html, key) {
    var i = String(html || "").indexOf('"' + key + '":[');
    if (i < 0) return [];
    var j = html.indexOf("]", i);
    if (j < 0) return [];
    var seg = html.slice(i, j + 1);
    var out = [], seen = {}, re = /"(https?:\\?\/\\?\/[^"]+)"/g, m;
    while ((m = re.exec(seg))) {
      var raw = m[1].replace(/\\\//g, "/");
      if (!isAllowedImage(raw)) continue;
      var url = normalizeImageUrl(raw);
      if (isJunkImage(url)) continue;
      if (seen[url]) continue;
      seen[url] = 1;
      out.push(url);
    }
    return out;
  }

  // 用页面内嵌 JSON 精确切分主图/详情图：1688 详情页
  //   gallery.fields.mainImage   —— 权威“商品主图”列表
  //   gallery.fields.offerImgList —— 主图 + 详情图全集
  // 取到即为权威结果，不再依赖 DOM 顺序猜测；取不到再退回 DOM 启发式。
  function extractStructuredGallery(html) {
    var main = extractJsonImageArray(html, "mainImage");
    var offer = extractJsonImageArray(html, "offerImgList");
    if (!main.length && !offer.length) return { found: false, main: [], detail: [] };
    if (!main.length) main = offer.slice(0, MAX_MAIN);
    var mainSet = {};
    main.forEach(function (u) { mainSet[u] = 1; });
    var detail = offer.filter(function (u) { return !mainSet[u]; });
    return { found: true, main: main, detail: detail };
  }

  // 详情描述地址：1688 详情页把「详情描述」长图托管在 detailUrl（itemcdn.tmall.com/1688offer/icoss*），
  // 内容不在首屏 HTML 里，需再拉取一次。这里只负责从页面 JSON 取出该地址。
  function extractDetailUrl(html) {
    var m = String(html || "").match(/"detailUrl"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/i);
    return m ? m[1].replace(/\\\//g, "/") : "";
  }

  // 从 detailUrl 返回的 JS 文本（var offer_details={"content":"<div>..<img src=..>..</div>"}）
  // 中抽取详情描述长图：先还原转义，再取 <img src>。
  function extractDetailImages(text) {
    var s = String(text || "").replace(/\\"/g, '"').replace(/\\\//g, "/");
    var out = [], seen = {}, re = /<img[^>]*\ssrc=["']?([^"'\s>]+)/gi, m;
    while ((m = re.exec(s))) {
      var raw = m[1];
      if (!isAllowedImage(raw)) continue;
      var url = normalizeImageUrl(raw);
      if (isJunkImage(url)) continue;
      if (seen[url]) continue;
      seen[url] = 1;
      out.push(url);
    }
    return out;
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
    var out = [], seen = {};
    var re = /"(?:beginAmount|startQuantity|beginNum|minQuantity|startAmount)"\s*:\s*(\d+)\s*,\s*"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/g, m;
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

  // 规格组合：优先页面 JSON 数组，其次从 specAttrs 文本（如「颜色:红色;尺码:M」）归纳
  function extractSpecs(html) {
    function values(re) {
      var m = html.match(re);
      return m ? (m[1].match(/"([^"]+)"/g) || []).map(function (s) { return s.replace(/"/g, ""); }) : [];
    }
    var colors = values(/"color"\s*:\s*\[([^\]]*)\]/i);
    var sizes = values(/"size"\s*:\s*\[([^\]]*)\]/i);
    if (!colors.length || !sizes.length) {
      var seenC = {}, seenS = {};
      var re = /"(?:specAttrs|skuAttrs|specProperties)"\s*:\s*"([^"]+)"/g, m;
      while ((m = re.exec(html))) {
        m[1].split(/[;&]/).forEach(function (part) {
          var kv = part.split(/[:：,]/);
          if (kv.length < 2) return;
          var key = kv[0].trim(), val = kv.slice(1).join(":").trim();
          if (!val) return;
          if (/颜色|色彩|色|color/i.test(key) && !seenC[val]) { seenC[val] = 1; colors.push(val); }
          else if (/尺码|尺寸|规格|size|型号/i.test(key) && !seenS[val]) { seenS[val] = 1; sizes.push(val); }
        });
      }
    }
    return { colors: colors, sizes: sizes };
  }

  // 各 SKU 价格：以 skuId/specAttrs/cargoNumber 等为锚点，抓邻近 price 数值，去重保序
  function extractSkuPrices(html) {
    var out = [], seen = {};
    function push(p) { if (!isNaN(p) && p > 0 && !seen[p]) { seen[p] = 1; out.push(p); } }
    var anchors = /"(?:skuId|specAttrs|skuAttrs|skuAttr|specId|cargoNumber|skuProperty|saleProp)"\s*:\s*"[^"]*"/g, m;
    var priceRe = /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/ig;
    while ((m = anchors.exec(html))) {
      var start = m.index + m[0].length;
      priceRe.lastIndex = 0;
      var pm = priceRe.exec(html.slice(start, start + 200));
      if (pm) { push(parseFloat(pm[1])); continue; }
      var before = html.slice(Math.max(0, m.index - 120), m.index);
      priceRe.lastIndex = 0;
      var last = null, mm;
      while ((mm = priceRe.exec(before))) last = mm;
      if (last) push(parseFloat(last[1]));
    }
    return out;
  }

  // 运费：从页面 JSON 里取快递费/运费；取不到返回 0（0 表示包邮或未标）
  function extractShipping(html) {
    var keys = ["freight", "postFee", "expressFee", "shippingFee", "deliveryFee", "freightFee"];
    for (var i = 0; i < keys.length; i++) {
      var m = firstMatch(html, new RegExp('"' + keys[i] + '"\\s*:\\s*"?([0-9]+(?:\\.[0-9]+)?)"?', "i"));
      var n = parseFloat(m);
      if (!isNaN(n)) return n;
    }
    return 0;
  }

  // images 为 SKU 图候选，按顺序循环分配给各 SKU；prices 为各 SKU 价格候选（可选）
  function buildSkus(specs, price, image, images, prices) {
    var colors = (specs && specs.colors && specs.colors.length) ? specs.colors : [""];
    var sizes = (specs && specs.sizes && specs.sizes.length) ? specs.sizes : [""];
    var pool = (images && images.length) ? images : (image ? [image] : []);
    var pricePool = (prices && prices.length) ? prices : (price ? [price] : []);
    var out = [];
    colors.forEach(function (c) {
      sizes.forEach(function (s) {
        var idx = out.length;
        out.push({
          skuId: "sku-" + (idx + 1),
          specs: { color: c, size: s },
          price: pricePool.length ? pricePool[idx % pricePool.length] : price,
          stock: 1,
          image: pool.length ? pool[idx % pool.length] : ""
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
    // 主图/详情图：优先用页面内嵌 JSON（权威），取不到再退回 DOM 启发式
    var structured = extractStructuredGallery(html);
    var split = structured.found
      ? { main: structured.main.slice(0, MAX_MAIN), detail: structured.detail }
      : classifyImages(collectImageRefs(html));
    var skuImages = extractSkuImages(html);
    var price = extractPrice(html);
    var ladder = extractLadderPrices(html);
    if (!price && ladder.length) price = ladder[0].price;
    var skuPrices = extractSkuPrices(html);
    var shipping = extractShipping(html);
    var specs = extractSpecs(html);
    // 主图/详情图/SKU 图三组各自独立取源，互不去重（同一张图可能既是 SKU 图又是详情图）
    var main = split.main.slice();
    var detail = split.detail.slice();
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
      detailUrl: extractDetailUrl(html),
      skus: price > 0 ? buildSkus(specs, price, cover, skuImages, skuPrices) : [],
      category: { sourcePath: [] },
      pricing: { cost: price, price: price, shipping: shipping, currency: "CNY", ladder: ladder }
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
    extractJsonImageArray: extractJsonImageArray,
    extractStructuredGallery: extractStructuredGallery,
    extractDetailUrl: extractDetailUrl,
    extractDetailImages: extractDetailImages,
    extractSkuImages: extractSkuImages,
    extractTitle: extractTitle,
    extractPrice: extractPrice,
    extractDescription: extractDescription,
    extractLadderPrices: extractLadderPrices,
    extractItemNo: extractItemNo,
    extractSupplier: extractSupplier,
    extractSpecs: extractSpecs,
    extractSkuPrices: extractSkuPrices,
    extractShipping: extractShipping,
    buildSkus: buildSkus,
    extractBatchLinks: extractBatchLinks,
    applySelection: applySelection,
    extractOffer: extractOffer
  };

  root.XLXCollector = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof self !== "undefined" ? self : this);
