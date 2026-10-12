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

  function mainImages(product, backendBase) {
    var arr = (product && product.images && product.images.main) || [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var url = resolveImage(arr[i], backendBase);
      if (url && out.indexOf(url) < 0) out.push(url);
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
    var price = Number((product && product.pricing && product.pricing.price) || 0);
    if (price) return price;
    var skus = (product && product.skus) || [];
    for (var i = 0; i < skus.length; i++) {
      var sp = Number(skus[i] && skus[i].price) || 0;
      if (sp) return sp;
    }
    return 0;
  }

  function skuSummary(product) {
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
        stock: Number(s && s.stock) || 0
      };
    });
  }

  function buildFieldPlan(product, backendBase) {
    product = product || {};
    return {
      title: str(product.title).slice(0, 60),
      price: listPrice(product),
      stock: totalStock(product),
      description: str(product.description),
      articleNo: str((product.source || {}).articleNo),
      images: mainImages(product, backendBase),
      skus: skuSummary(product),
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
    if (plan.price) lines.push("价格：" + plan.price);
    if (plan.stock) lines.push("库存：" + plan.stock);
    if (plan.articleNo) lines.push("货号：" + plan.articleNo);
    if (plan.skus.length) {
      lines.push("规格：" + plan.skus.map(function (s) {
        return s.label + "(" + s.price + "/" + s.stock + ")";
      }).join("，"));
    }
    if (plan.description) lines.push("描述：\n" + plan.description);
    return lines.join("\n");
  }

  var API = {
    DEFAULT_BACKEND: DEFAULT_BACKEND,
    joinUrl: joinUrl,
    resolveImage: resolveImage,
    mainImages: mainImages,
    totalStock: totalStock,
    listPrice: listPrice,
    skuSummary: skuSummary,
    buildFieldPlan: buildFieldPlan,
    fillTargets: fillTargets,
    describeProduct: describeProduct
  };

  root.XLXPublisher = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof self !== "undefined" ? self : this);
