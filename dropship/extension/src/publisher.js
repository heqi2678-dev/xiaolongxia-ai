/* 铜龙铺货 · 淘宝发布助手（纯函数）
 * 淘宝店铺不支持开放平台自研应用，改在「发布宝贝」页辅助填表。
 * 本文件把统一商品模型转成「发布页要填的字段计划」，浏览器 content 脚本与 node 测试台共用。
 * 只依赖字符串与数组操作，不碰 DOM。
 */
(function (root) {
  "use strict";

  var DEFAULT_BACKEND = "http://127.0.0.1:9150";

  function str(v) {
    return v == null ? "" : String(v);
  }

  function trimBase(base) {
    return str(base || DEFAULT_BACKEND).replace(/\/+$/, "");
  }

  // 把后端返回的图片相对地址（local = /api/images/xxx）拼成可访问地址
  function joinUrl(base, path) {
    var p = str(path).trim();
    if (!p) return "";
    if (p.indexOf("//") === 0) return "https:" + p;
    if (/^https?:\/\//i.test(p)) return p;
    return trimBase(base) + (p.charAt(0) === "/" ? p : "/" + p);
  }

  // 取一张商品图的可下载地址：优先本地归档（后端可访问），否则远端 url
  function resolveImage(item, backendBase) {
    if (item == null) return "";
    if (typeof item === "string") return joinUrl(backendBase, item);
    return joinUrl(backendBase, item.local || item.remote || item.url || "");
  }

  function imageList(arr, backendBase) {
    var out = [];
    arr = arr || [];
    for (var i = 0; i < arr.length; i++) {
      var url = resolveImage(arr[i], backendBase);
      if (url && out.indexOf(url) < 0) out.push(url);
    }
    return out;
  }

  function mainImages(product, backendBase) {
    return imageList(product && product.images && product.images.main, backendBase);
  }

  function detailImages(product, backendBase) {
    return imageList(product && product.images && product.images.detail, backendBase);
  }

  // SKU 图：优先 sku 自身图片，其次 images.sku 汇总，最后退回主图
  function skuImages(product, backendBase) {
    var out = imageList(product && product.images && product.images.sku, backendBase);
    var skus = (product && product.skus) || [];
    for (var i = 0; i < skus.length; i++) {
      var img = resolveImage(skus[i] && (skus[i].image || (skus[i].images && skus[i].images[0])), backendBase);
      if (img && out.indexOf(img) < 0) out.push(img);
    }
    return out;
  }

  function totalStock(product) {
    var skus = (product && product.skus) || [];
    var n = 0;
    for (var i = 0; i < skus.length; i++) n += Number(skus[i] && skus[i].stock) || 0;
    return n;
  }

  function listPrice(product) {
    var pricing = (product && product.pricing) || {};
    var price = Number(pricing.listPrice || pricing.price || 0);
    if (price) return price;
    var skus = (product && product.skus) || [];
    for (var i = 0; i < skus.length; i++) {
      var sp = Number(skus[i] && skus[i].price) || 0;
      if (sp) return sp;
    }
    return 0;
  }

  function shipping(product) {
    return Number((product && product.pricing && product.pricing.shipping) || 0);
  }

  // 阶梯价：按起订量排列的 [{minQty, price}]，去重保序
  function ladderPrices(product) {
    var arr = (product && product.pricing && product.pricing.ladder) || [];
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var p = Number(arr[i] && arr[i].price) || 0;
      var q = Number(arr[i] && arr[i].minQty) || 0;
      if (!p) continue;
      var key = q + "-" + p;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({ minQty: q, price: p });
    }
    return out;
  }

  // 所有价格：上架价 / 货源价 / 成本 / 运费 / 各 SKU 价 / 阶梯价
  function priceList(product) {
    var pricing = (product && product.pricing) || {};
    var out = [];
    if (Number(pricing.cost)) out.push({ label: "成本价", price: Number(pricing.cost) });
    if (Number(pricing.price)) out.push({ label: "货源价", price: Number(pricing.price) });
    if (Number(pricing.listPrice)) out.push({ label: "上架价", price: Number(pricing.listPrice) });
    if (Number(pricing.shipping)) out.push({ label: "运费", price: Number(pricing.shipping) });
    var skus = skuSummary(product);
    for (var i = 0; i < skus.length; i++) {
      out.push({ label: "SKU " + skus[i].label, price: skus[i].price });
    }
    var ladder = ladderPrices(product);
    for (var j = 0; j < ladder.length; j++) {
      out.push({ label: "满" + ladder[j].minQty + "件", price: ladder[j].price });
    }
    return out;
  }

  function skuSummary(product, backendBase) {
    var skus = (product && product.skus) || [];
    return skus.map(function (s) {
      var specs = (s && s.specs) || {};
      var parts = [];
      Object.keys(specs).forEach(function (k) {
        if (specs[k]) parts.push(specs[k]);
      });
      return {
        label: parts.join("/") || "默认",
        price: Number(s && s.price) || 0,
        stock: Number(s && s.stock) || 0,
        image: resolveImage(s && (s.image || (s.images && s.images[0])), backendBase)
      };
    });
  }

  function buildFieldPlan(product, backendBase) {
    product = product || {};
    return {
      title: str(product.title).slice(0, 60),
      price: listPrice(product),
      shipping: shipping(product),
      stock: totalStock(product),
      description: str(product.description),
      articleNo: str((product.source || {}).articleNo),
      images: mainImages(product, backendBase),
      skuImages: skuImages(product, backendBase),
      detailImages: detailImages(product, backendBase),
      skus: skuSummary(product, backendBase),
      ladder: ladderPrices(product),
      prices: priceList(product),
      attributes: product.attributes || {}
    };
  }

  // 需要自动填入页面的字段；keywords 用于在发布页按文案定位输入框
  function fillTargets(plan) {
    var out = [];
    if (plan.title) out.push({ key: "title", label: "标题", keywords: ["宝贝标题", "商品标题", "标题"], value: plan.title });
    if (plan.price) out.push({ key: "price", label: "一口价", keywords: ["一口价", "价格"], value: String(plan.price) });
    if (plan.stock) out.push({ key: "stock", label: "库存", keywords: ["库存", "数量"], value: String(plan.stock) });
    return out;
  }

  // 供「复制全部」使用的一整段文本（淘宝发布页图片/富文本描述仍需人工上传）
  function describeProduct(product, backendBase) {
    var plan = buildFieldPlan(product, backendBase);
    var lines = ["标题：" + plan.title];
    if (plan.price) lines.push("上架价格：" + plan.price);
    if (plan.shipping) lines.push("运费：" + plan.shipping);
    if (plan.stock) lines.push("库存：" + plan.stock);
    if (plan.articleNo) lines.push("货号：" + plan.articleNo);
    if (plan.skuImages.length) lines.push("SKU 图：" + plan.skuImages.length + " 张");
    if (plan.detailImages.length) lines.push("详情图：" + plan.detailImages.length + " 张");
    if (plan.skus.length) {
      lines.push("规格：" + plan.skus.map(function (s) {
        return s.label + "(" + s.price + "/" + s.stock + ")";
      }).join("，"));
    }
    if (plan.ladder && plan.ladder.length) {
      lines.push("阶梯价：" + plan.ladder.map(function (l) {
        return "满" + l.minQty + "件¥" + l.price;
      }).join("，"));
    }
    if (plan.description) lines.push("描述：\n" + plan.description);
    return lines.join("\n");
  }

  var API = {
    DEFAULT_BACKEND: DEFAULT_BACKEND,
    joinUrl: joinUrl,
    resolveImage: resolveImage,
    imageList: imageList,
    mainImages: mainImages,
    detailImages: detailImages,
    skuImages: skuImages,
    totalStock: totalStock,
    listPrice: listPrice,
    shipping: shipping,
    ladderPrices: ladderPrices,
    priceList: priceList,
    skuSummary: skuSummary,
    buildFieldPlan: buildFieldPlan,
    fillTargets: fillTargets,
    describeProduct: describeProduct
  };

  root.XLXPublisher = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof self !== "undefined" ? self : this);
