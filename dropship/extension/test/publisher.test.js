"use strict";
const test = require("node:test");
const assert = require("node:assert");
const P = require("../src/publisher.js");

const BACKEND = "http://127.0.0.1:9150";

const PRODUCT = {
  title: "纯棉短袖T恤 夏季新款 宽松百搭 男女同款",
  description: "详情描述文本",
  images: {
    main: [
      { url: "https://cbu01.alicdn.com/a.jpg" },
      { local: "/api/images/hash.jpg", url: "https://cbu01.alicdn.com/dup.jpg" },
      "https://img.alicdn.com/b.jpg"
    ],
    detail: []
  },
  skus: [
    { specs: { color: "红", size: "S" }, price: 19.9, stock: 5 },
    { specs: { color: "蓝", size: "M" }, price: 21.9, stock: 3 }
  ],
  pricing: { price: 19.9 },
  source: { articleNo: "A-1" },
  attributes: { 颜色: "红" }
};

test("joinUrl 拼接后端相对地址并保留绝对地址", () => {
  assert.equal(P.joinUrl(BACKEND, "/api/images/x.jpg"), "http://127.0.0.1:9150/api/images/x.jpg");
  assert.equal(P.joinUrl(BACKEND, "api/images/x.jpg"), "http://127.0.0.1:9150/api/images/x.jpg");
  assert.equal(P.joinUrl("http://x/", "https://a/b.jpg"), "https://a/b.jpg");
  assert.equal(P.joinUrl("http://x", "//a/b.jpg"), "https://a/b.jpg");
  assert.equal(P.joinUrl(BACKEND, ""), "");
});

test("resolveImage 优先本地归档地址", () => {
  assert.equal(P.resolveImage("https://c/a.jpg", BACKEND), "https://c/a.jpg");
  assert.equal(P.resolveImage({ local: "/api/images/h.jpg", url: "https://c/a.jpg" }, BACKEND), "http://127.0.0.1:9150/api/images/h.jpg");
  assert.equal(P.resolveImage({ url: "https://c/a.jpg" }, BACKEND), "https://c/a.jpg");
  assert.equal(P.resolveImage(null, BACKEND), "");
});

test("mainImages 解析并去重保持顺序", () => {
  const urls = P.mainImages(PRODUCT, BACKEND);
  assert.deepEqual(urls, [
    "https://cbu01.alicdn.com/a.jpg",
    "http://127.0.0.1:9150/api/images/hash.jpg",
    "https://img.alicdn.com/b.jpg"
  ]);
});

test("totalStock / listPrice", () => {
  assert.equal(P.totalStock(PRODUCT), 8);
  assert.equal(P.listPrice(PRODUCT), 19.9);
});

test("listPrice 无定价时回落到首个 SKU 价格", () => {
  const p = { pricing: {}, skus: [{ specs: {}, price: 12.5, stock: 1 }] };
  assert.equal(P.listPrice(p), 12.5);
});

test("skuSummary 组合规格并给默认标签", () => {
  const s = P.skuSummary(PRODUCT, BACKEND);
  assert.deepEqual(s, [
    { label: "红/S", price: 19.9, stock: 5, image: "" },
    { label: "蓝/M", price: 21.9, stock: 3, image: "" }
  ]);
  assert.equal(P.skuSummary({ skus: [{ specs: {}, price: 9, stock: 1 }] }, BACKEND)[0].label, "默认");
});

test("listPrice 优先取上架价格 listPrice", () => {
  assert.equal(P.listPrice({ pricing: { price: 10, listPrice: 15 } }), 15);
});

test("shipping 读取运费", () => {
  assert.equal(P.shipping({ pricing: { shipping: 6 } }), 6);
  assert.equal(P.shipping({}), 0);
});

test("skuImages / detailImages 解析并去重", () => {
  const p = {
    images: {
      sku: [{ url: "https://cbu01.alicdn.com/s1.jpg" }],
      detail: [{ url: "https://cbu01.alicdn.com/d1.jpg" }, { local: "/api/images/d2.jpg" }]
    },
    skus: [{ image: "https://cbu01.alicdn.com/s1.jpg" }, { image: "https://cbu01.alicdn.com/s2.jpg" }]
  };
  assert.deepEqual(P.skuImages(p, BACKEND), [
    "https://cbu01.alicdn.com/s1.jpg",
    "https://cbu01.alicdn.com/s2.jpg"
  ]);
  assert.deepEqual(P.detailImages(p, BACKEND), [
    "https://cbu01.alicdn.com/d1.jpg",
    "http://127.0.0.1:9150/api/images/d2.jpg"
  ]);
});

test("buildFieldPlan 含 skuImages/detailImages/shipping", () => {
  const p = {
    images: { sku: [{ url: "https://cbu01.alicdn.com/s.jpg" }], detail: [{ url: "https://cbu01.alicdn.com/d.jpg" }] },
    pricing: { listPrice: 12, shipping: 5 }
  };
  const plan = P.buildFieldPlan(p, BACKEND);
  assert.equal(plan.price, 12);
  assert.equal(plan.shipping, 5);
  assert.equal(plan.skuImages.length, 1);
  assert.equal(plan.detailImages.length, 1);
});

test("buildFieldPlan 产出发布页所需字段", () => {
  const plan = P.buildFieldPlan(PRODUCT, BACKEND);
  assert.equal(plan.title, PRODUCT.title.slice(0, 60));
  assert.equal(plan.price, 19.9);
  assert.equal(plan.stock, 8);
  assert.equal(plan.articleNo, "A-1");
  assert.equal(plan.images.length, 3);
  assert.deepEqual(plan.attributes, { 颜色: "红" });
});

test("buildFieldPlan 标题截断到 60 字", () => {
  const long = "字".repeat(80);
  assert.equal(P.buildFieldPlan({ title: long }, BACKEND).title.length, 60);
});

test("fillTargets 只在有值时给出填写项并带定位关键词", () => {
  const plan = P.buildFieldPlan(PRODUCT, BACKEND);
  const targets = P.fillTargets(plan);
  assert.deepEqual(targets.map((t) => t.key), ["title", "price", "stock"]);
  assert.ok(targets[0].keywords.includes("宝贝标题"));
  assert.deepEqual(P.fillTargets({ title: "x", price: 0, stock: 0 }).map((t) => t.key), ["title"]);
});

test("describeProduct 汇总为可粘贴文本", () => {
  const text = P.describeProduct(PRODUCT, BACKEND);
  assert.ok(text.indexOf("标题：纯棉短袖T恤") === 0);
  assert.ok(text.includes("价格：19.9"));
  assert.ok(text.includes("库存：8"));
  assert.ok(text.includes("货号：A-1"));
  assert.ok(text.includes("规格：红/S(19.9/5)，蓝/M(21.9/3)"));
  assert.ok(text.includes("描述：\n详情描述文本"));
});
