"use strict";
const test = require("node:test");
const assert = require("node:assert");
const C = require("../src/collector.js");

const PAGE = `
<!doctype html><html><head>
<meta property="og:title" content="纯棉短袖T恤 夏季新款" />
<meta property="og:price:amount" content="19.90" />
</head><body>
<img src="//cbu01.alicdn.com/img/ibank/a.jpg_220x220.jpg" />
<img data-src="https://cbu01.alicdn.com/img/ibank/a.jpg_440x440.jpg" />
<img src="https://img.alicdn.com/bb/c.png" />
<img src="https://evil.example.com/x.jpg" />
<div class="detail-desc"><p>详情描述文本</p></div>
<script>"price":"19.9","companyName":"杭州某某服饰有限公司"</script>
</body></html>`;

test("extractOfferId 从详情页 URL 取 ID", () => {
  assert.equal(C.extractOfferId("https://detail.1688.com/offer/123456789.html?spm=a"), "123456789");
  assert.equal(C.extractOfferId("https://m.1688.com/offer/987.html"), "987");
  assert.equal(C.extractOfferId("https://detail.1688.com/"), "");
});

test("normalizeImageUrl 去缩略图后缀并补全协议", () => {
  assert.equal(C.normalizeImageUrl("//cbu01.alicdn.com/a.jpg_220x220.jpg"), "https://cbu01.alicdn.com/a.jpg");
  assert.equal(C.normalizeImageUrl("https://cbu01.alicdn.com/a.jpg?x=1"), "https://cbu01.alicdn.com/a.jpg");
});

test("isAllowedImage 只放行白名单图床", () => {
  assert.ok(C.isAllowedImage("https://cbu01.alicdn.com/a.jpg"));
  assert.ok(!C.isAllowedImage("https://evil.example.com/x.jpg"));
  assert.ok(!C.isAllowedImage("data:image/png;base64,AAAA"));
});

test("collectImages 归一去重并保持顺序", () => {
  const imgs = C.collectImages(PAGE);
  assert.deepEqual(imgs, [
    "https://cbu01.alicdn.com/img/ibank/a.jpg",
    "https://img.alicdn.com/bb/c.png"
  ]);
});

test("extractTitle 优先 og:title", () => {
  assert.equal(C.extractTitle(PAGE), "纯棉短袖T恤 夏季新款");
});

test("extractPrice 解析价格", () => {
  assert.equal(C.extractPrice(PAGE), 19.9);
});

test("extractOffer 产出统一原始商品结构", () => {
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/123456789.html", html: PAGE });
  assert.equal(p.source.platform, "1688");
  assert.equal(p.source.itemId, "123456789");
  assert.equal(p.title, "纯棉短袖T恤 夏季新款");
  assert.equal(p.images.main[0], "https://cbu01.alicdn.com/img/ibank/a.jpg");
  assert.equal(p.skus.length, 1);
  assert.equal(p.pricing.cost, 19.9);
  assert.ok(p.source.collectedAt);
});

const RICH_PAGE = `
<script>
var data = {"productCode":"A-7788","companyName":"广州加丽服饰有限公司",
"beginAmount":2,"price":"8.80","beginAmount":100,"price":"7.20",
"color":["红色","蓝色"],"size":["S","M","L"]};
</script>`;

test("extractLadderPrices 解析阶梯价", () => {
  const ladder = C.extractLadderPrices(RICH_PAGE);
  assert.deepEqual(ladder, [{ minQty: 2, price: 8.8 }, { minQty: 100, price: 7.2 }]);
});

test("extractItemNo 取货号，extractSupplier 取供应商", () => {
  assert.equal(C.extractItemNo(RICH_PAGE), "A-7788");
  assert.equal(C.extractSupplier(RICH_PAGE), "广州加丽服饰有限公司");
});

test("extractSpecs 取颜色/尺码候选值", () => {
  assert.deepEqual(C.extractSpecs(RICH_PAGE), { colors: ["红色", "蓝色"], sizes: ["S", "M", "L"] });
});

test("buildSkus 生成颜色×尺码组合", () => {
  const skus = C.buildSkus({ colors: ["红", "蓝"], sizes: ["S", "M"] }, 9.9, "https://x/a.jpg");
  assert.equal(skus.length, 4);
  assert.deepEqual(skus[0].specs, { color: "红", size: "S" });
  assert.equal(skus[3].specs.color, "蓝");
  assert.equal(skus[0].price, 9.9);
});

test("extractOffer 带出货号、供应商、阶梯价、规格组合", () => {
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/1.html", html: RICH_PAGE });
  assert.equal(p.source.articleNo, "A-7788");
  assert.equal(p.source.shop, "广州加丽服饰有限公司");
  assert.equal(p.pricing.ladder.length, 2);
  assert.equal(p.skus.length, 6);
});

test("extractBatchLinks 提取列表页商品链接并去重", () => {
  const html = '<a href="//detail.1688.com/offer/111.html?x=1">A</a>'
    + '<a href="https://detail.1688.com/offer/222.html">B</a>'
    + '<a href="https://detail.1688.com/offer/111.html">A2</a>'
    + '<a href="/other">no</a>';
  const links = C.extractBatchLinks(html);
  assert.deepEqual(links, [
    { itemId: "111", url: "https://detail.1688.com/offer/111.html?x=1" },
    { itemId: "222", url: "https://detail.1688.com/offer/222.html" }
  ]);
});

const IMG_PAGE = `
<html><body>
<img src="https://img.alicdn.com/imgextra/i1/xxx-2-tps-288-56.png" />
<img src="https://gw.alicdn.com/tps/i4/abc-tps-16-16.svg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-A1_!!888-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-A3_!!888-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-A4_!!888-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-A5_!!888-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-A6_!!888-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-REC_!!111-0-cib.jpg" />
<img src="https://cbu01.alicdn.com/img/ibank/O1CN-review_!!888-0-rate.jpg" />
<img src="https://img.alicdn.com/gg_dtc_123.png" />
<script>var d = {"price":"12.50","skuImage":"https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg"};</script>
</body></html>`;

test("isJunkImage 识别图标/广告/评价等装饰素材", () => {
  assert.ok(C.isJunkImage("https://img.alicdn.com/x-2-tps-288-56.png"));
  assert.ok(C.isJunkImage("https://gw.alicdn.com/tps/i4/a-tps-16-16.svg"));
  assert.ok(C.isJunkImage("https://img.alicdn.com/gg_dtc_123.png"));
  assert.ok(C.isJunkImage("https://cbu01.alicdn.com/img/ibank/a-0-rate.jpg"));
  assert.ok(!C.isJunkImage("https://cbu01.alicdn.com/img/ibank/O1CN-main-0-cib.jpg"));
});

test("collectImages 直接丢弃装饰素材", () => {
  const imgs = C.collectImages(IMG_PAGE);
  assert.deepEqual(imgs, [
    "https://cbu01.alicdn.com/img/ibank/O1CN-A1_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A3_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A4_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A5_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A6_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-REC_!!111-0-cib.jpg"
  ]);
});

test("imageUid 提取卖家 uid", () => {
  assert.equal(C.imageUid("https://cbu01.alicdn.com/img/ibank/O1CN-A1_!!888-0-cib.jpg"), "888");
  assert.equal(C.imageUid("https://cbu01.alicdn.com/img/ibank/2020/428/378/22185873824_536529798.jpg"), "");
});

test("classifyImages 只保留本商品图（同卖家 uid），并切分主图/详情图", () => {
  const refs = C.collectImageRefs(IMG_PAGE);
  const split = C.classifyImages(refs);
  assert.deepEqual(split.main, [
    "https://cbu01.alicdn.com/img/ibank/O1CN-A1_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A3_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A4_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A5_!!888-0-cib.jpg"
  ]);
  assert.deepEqual(split.detail, [
    "https://cbu01.alicdn.com/img/ibank/O1CN-A6_!!888-0-cib.jpg"
  ]);
});

test("classifyImages 图少时不做 uid 隔离，前 MAX_MAIN 张为主图", () => {
  const html = '<img src="https://cbu01.alicdn.com/img/ibank/a-0-cib.jpg"><img src="https://cbu01.alicdn.com/img/ibank/b-0-cib.jpg">';
  const split = C.classifyImages(C.collectImageRefs(html));
  assert.equal(split.main.length, 2);
  assert.equal(split.detail.length, 0);
});

test("extractSkuImages 抽取 SKU 图", () => {
  assert.deepEqual(C.extractSkuImages(IMG_PAGE), [
    "https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg"
  ]);
});

test("extractOffer 归纳主图/详情图/SKU图/价格，剔除推荐图与装饰素材", () => {
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/874025170740.html", html: IMG_PAGE });
  assert.deepEqual(p.images.main, [
    "https://cbu01.alicdn.com/img/ibank/O1CN-A1_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A3_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A4_!!888-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/O1CN-A5_!!888-0-cib.jpg"
  ]);
  assert.deepEqual(p.images.detail, [
    "https://cbu01.alicdn.com/img/ibank/O1CN-A6_!!888-0-cib.jpg"
  ]);
  assert.equal(p.skus.length, 1);
  assert.equal(p.skus[0].image, "https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg");
  assert.deepEqual(p.images.sku, ["https://cbu01.alicdn.com/img/ibank/O1CN-A2_!!888-0-cib.jpg"]);
  assert.equal(p.pricing.cost, 12.5);
  const all = p.images.main.concat(p.images.detail);
  assert.ok(!all.some((u) => /-tps-|gg_dtc|-rate|!!111-/.test(u)));
});

const STRUCTURED_PAGE = `
<html><body>
<img src="https://cbu01.alicdn.com/cms/upload/2015/839/305/2503938_1964054271.png" />
<img src="https://img.alicdn.com/imgextra/i1/xxx-2-tps-58-58.png" />
<script>window.context = {"gallery":{"fields":{
"offerImgList":[
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M1_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M2_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M3_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M4_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M5_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/D1_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/D2_!!222-0-cib.jpg"
],
"mainImage":[
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M1_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M2_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M3_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M4_!!222-0-cib.jpg",
"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/M5_!!222-0-cib.jpg"
]}}};
"skuModel":{"skuProps":[{"fid":1234,"prop":"规格","value":[
{"imageUrl":"https://cbu01.alicdn.com/img/ibank/D1_!!222-0-cib.jpg","name":"房屋型"},
{"imageUrl":"https://cbu01.alicdn.com/img/ibank/D2_!!222-0-cib.jpg","name":"手提型"}
]}]};
"price":"12.50";</script>
</body></html>`;

test("isJunkImage 拦截服务标/cms/tfs/视频封面等平台素材", () => {
  assert.ok(C.isJunkImage("https://cbu01.alicdn.com/cms/upload/2015/839/305/2503938_1.png"));
  assert.ok(C.isJunkImage("https://img.alicdn.com/tfs/TB1ZwSvqG6qK1RZ.png"));
  assert.ok(C.isJunkImage("https://img.alicdn.com/imgextra/i2/x_!!6-0-tbvideo.jpg"));
  assert.ok(!C.isJunkImage("https://cbu01.alicdn.com/img/ibank/O1CN-A1_!!888-0-cib.jpg"));
});

test("normalizeImageUrl 去掉 ibank 尺寸后缀变体", () => {
  assert.equal(C.normalizeImageUrl("https://cbu01.alicdn.com/img/ibank/a_!!1-0-cib.220x220.jpg"), "https://cbu01.alicdn.com/img/ibank/a_!!1-0-cib.jpg");
  assert.equal(C.normalizeImageUrl("https://cbu01.alicdn.com/img/ibank/a_!!1-0-cib.310x310.jpg"), "https://cbu01.alicdn.com/img/ibank/a_!!1-0-cib.jpg");
  assert.equal(C.normalizeImageUrl("https://cbu01.alicdn.com/img/ibank/a_!!1-0-cib.search.jpg"), "https://cbu01.alicdn.com/img/ibank/a_!!1-0-cib.jpg");
});

test("extractStructuredGallery 用内嵌 JSON 精确切分主图/详情图", () => {
  const g = C.extractStructuredGallery(STRUCTURED_PAGE);
  assert.equal(g.found, true);
  assert.deepEqual(g.main, [
    "https://cbu01.alicdn.com/img/ibank/M1_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M2_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M3_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M4_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M5_!!222-0-cib.jpg"
  ]);
  assert.deepEqual(g.detail, [
    "https://cbu01.alicdn.com/img/ibank/D1_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/D2_!!222-0-cib.jpg"
  ]);
});

test("extractOffer 优先用内嵌 JSON 主图/详情图/SKU图，剔除平台装饰素材", () => {
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/1089621589938.html", html: STRUCTURED_PAGE });
  assert.deepEqual(p.images.main, [
    "https://cbu01.alicdn.com/img/ibank/M1_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M2_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M3_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M4_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/M5_!!222-0-cib.jpg"
  ]);
  assert.deepEqual(p.images.detail, [
    "https://cbu01.alicdn.com/img/ibank/D1_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/D2_!!222-0-cib.jpg"
  ]);
  assert.deepEqual(p.images.sku, [
    "https://cbu01.alicdn.com/img/ibank/D1_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/D2_!!222-0-cib.jpg"
  ]);
  const all = p.images.main.concat(p.images.detail, p.images.sku);
  assert.ok(!all.some((u) => /cms\/upload|-tps-/.test(u)));
});

test("extractDetailUrl 取详情描述地址", () => {
  const html = '<script>{"detailUrl":"https:\\/\\/itemcdn.tmall.com\\/1688offer\\/icoss123abc"}</script>';
  assert.equal(C.extractDetailUrl(html), "https://itemcdn.tmall.com/1688offer/icoss123abc");
  assert.equal(C.extractDetailUrl("<html></html>"), "");
});

test("extractDetailImages 从 offer_details.content 抽取详情长图并剔除装饰素材", () => {
  const text = 'var offer_details={"content":"<div><img style=\\"display:block;\\" src=\\"https:\\/\\/cbu01.alicdn.com\\/img\\/ibank\\/DD1_!!222-0-cib.jpg\\"/>'
    + '<img src=\\"https://cbu01.alicdn.com/img/ibank/DD2_!!222-0-cib.jpg\\"/>'
    + '<img src=\\"https://img.alicdn.com/gg_dtc_x.png\\"/></div>","other":1};';
  assert.deepEqual(C.extractDetailImages(text), [
    "https://cbu01.alicdn.com/img/ibank/DD1_!!222-0-cib.jpg",
    "https://cbu01.alicdn.com/img/ibank/DD2_!!222-0-cib.jpg"
  ]);
});

test("extractOffer 带出 detailUrl 供详情长图二次拉取", () => {
  const html = '<img src="https://cbu01.alicdn.com/img/ibank/M1_!!222-0-cib.jpg">'
    + '<script>{"price":"9.9","detailUrl":"https:\\/\\/itemcdn.tmall.com\\/1688offer\\/icoss9"}</script>';
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/1.html", html: html });
  assert.equal(p.detailUrl, "https://itemcdn.tmall.com/1688offer/icoss9");
});



test("extractOffer 无阶梯价时用 ladder 兜底基础价", () => {
  const html = '<img src="https://cbu01.alicdn.com/img/ibank/a-0-cib.jpg">'
    + '<script>{"beginAmount":2,"price":"8.80"}</script>';
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/1.html", html: html });
  assert.equal(p.pricing.price, 8.8);
  assert.equal(p.pricing.ladder.length, 1);
});

test("applySelection 按勾选裁剪字段与图片", () => {
  const product = C.extractOffer({ url: "https://detail.1688.com/offer/1.html", html: PAGE });
  product.images.main = ["m0", "m1", "m2"];
  product.images.detail = ["d0", "d1"];
  const out = C.applySelection(product, {
    fields: { description: false, ladder: false, source: false },
    main: [0, 2],
    detail: [1]
  });
  assert.equal(out.title, product.title);
  assert.equal(out.description, "");
  assert.deepEqual(out.images.main, ["m0", "m2"]);
  assert.deepEqual(out.images.detail, ["d1"]);
  assert.equal(out.source.articleNo, undefined);
  assert.equal(out.source.itemId, product.source.itemId);
});

test("applySelection 支持裁剪 SKU 图", () => {
  const product = C.extractOffer({ url: "https://detail.1688.com/offer/1.html", html: IMG_PAGE });
  product.images.sku = ["s0", "s1", "s2"];
  const out = C.applySelection(product, { sku: [0, 2] });
  assert.deepEqual(out.images.sku, ["s0", "s2"]);
});

test("extractShipping 抓运费字段，取不到为 0", () => {
  assert.equal(C.extractShipping('<script>{"postFee":"6.00"}</script>'), 6);
  assert.equal(C.extractShipping('<script>{"freight":8}</script>'), 8);
  assert.equal(C.extractShipping('<script>{"title":"x"}</script>'), 0);
});

test("extractSkuPrices 去重保序抓各 SKU 价", () => {
  const html = '<script>[{"skuId":"s1","price":"9.90"},{"skuId":"s2","price":"11.50"},{"skuId":"s3","price":"9.90"}]</script>';
  assert.deepEqual(C.extractSkuPrices(html), [9.9, 11.5]);
});

test("buildSkus 按价格池循环分配各 SKU 价", () => {
  const skus = C.buildSkus({ colors: ["红", "蓝"] }, 9.9, "cover.jpg", ["a.jpg", "b.jpg"], [9.9, 11.5]);
  assert.equal(skus.length, 2);
  assert.equal(skus[0].price, 9.9);
  assert.equal(skus[1].price, 11.5);
});

test("extractOffer 带出运费与 SKU 价格", () => {
  const html = '<img src="https://cbu01.alicdn.com/img/ibank/a-0-cib.jpg">'
    + '<script>{"price":"9.90","postFee":"6.00","color":["红","蓝"],"skuId":"s1","sellerId":"1","price":"11.50"}</script>';
  const p = C.extractOffer({ url: "https://detail.1688.com/offer/1.html", html: html });
  assert.equal(p.pricing.shipping, 6);
});
