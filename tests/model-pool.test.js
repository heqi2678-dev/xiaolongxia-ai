/* 统一模型目录 + 统一适配器接口（地基层 1.4）· 单元测试
 * 用最小 vm 沙箱加载 src/model-catalog.js 与 src/pool.js，核对：
 * 目录的厂商/能力映射、对话预设并入、适配器登记与按 kind+id 派发。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CATALOG = fs.readFileSync(path.resolve(__dirname, "..", "src", "model-catalog.js"), "utf8");
const POOL = fs.readFileSync(path.resolve(__dirname, "..", "src", "pool.js"), "utf8");

function loadCatalog(providers) {
  const sandbox = { XLX: { PROVIDERS: providers || [] }, console, JSON, Object, String, Array };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CATALOG, sandbox, { filename: "src/model-catalog.js" });
  return sandbox.XLX.catalog;
}

function loadPool(prep) {
  const sandbox = { XLX: {}, console, JSON, Object, String, Array, Promise, Error };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CATALOG, sandbox, { filename: "src/model-catalog.js" });
  vm.runInContext(POOL, sandbox, { filename: "src/pool.js" });
  if (prep) prep(sandbox);
  return { pool: sandbox.XLX.pool, sandbox };
}

test("模型目录：别名归一到厂商（qwen/doubao/seedream/kling）", () => {
  const cat = loadCatalog();
  assert.equal(cat.vendorFor("qwen"), "aliyun-bailian");
  assert.equal(cat.vendorFor("doubao"), "volc-ark");
  assert.equal(cat.vendorFor("seedream"), "volc-ark");
  assert.equal(cat.vendorFor("wanx"), "aliyun-bailian");
  assert.equal(cat.vendorFor("kling"), "kling");
  assert.equal(cat.vendorFor("volc"), "volc-speech");
  assert.equal(cat.vendorFor("volc-koubo"), "volc-vision");
});

test("模型目录：首批厂商（可灵、百炼）模型齐全", () => {
  const cat = loadCatalog();
  const kling = cat.modelIds("video", "kling");
  assert.equal(kling.length, 3);
  assert.ok(kling.some(m => /turbo/.test(m)));
  const bailianImg = cat.modelIds("image", "wanx");
  assert.ok(bailianImg.includes("qwen-image-3.0-pro"));
  assert.ok(bailianImg.includes("wan2.2-t2i-flash"));
  const bailianLlm = cat.modelIds("llm", "qwen");
  assert.ok(bailianLlm.includes("qwen-plus"));
});

test("模型目录：一个能力可跨厂商（video 同时有火山方舟与可灵）", () => {
  const cat = loadCatalog();
  const vid = cat.all("video");
  assert.ok(vid.some(m => m.vendor === "volc-ark"));
  assert.ok(vid.some(m => m.vendor === "kling"));
  assert.equal(cat.modelIds("video", "seedance").length, 6);
});

test("模型目录：models() 带厂商信息，base() 取厂商地址", () => {
  const cat = loadCatalog();
  const m = cat.models("image", "seedream")[0];
  assert.equal(m.vendor, "volc-ark");
  assert.equal(m.vendorName, "火山方舟");
  assert.equal(m.kind, "image");
  assert.equal(cat.base("video", "kling"), "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com");
});

test("模型目录：applyToChat 把目录模型并进对话预设且不丢原有条目", () => {
  const providers = [{ id: "qwen", name: "通义千问", base: "", key: "", model: "", models: ["qwen-legacy"] }];
  const cat = loadCatalog(providers);
  assert.ok(providers[0].models.includes("qwen-plus"));
  assert.ok(providers[0].models.includes("qwen-legacy"));
  assert.equal(providers[0].model, "qwen-plus");
  assert.equal(providers[0].base, "https://dashscope.aliyuncs.com/compatible-mode/v1");
});

test("适配器池：登记 / 查询 / 列表 / 按 id 派发", async () => {
  const { pool } = loadPool();
  let got = null;
  pool.register({ kind: "image", id: "demo", vendor: "volc-ark", label: "Demo", run: (o) => { got = o; return Promise.resolve({ url: "u" }); } });
  assert.ok(pool.get("image", "demo"));
  assert.equal(pool.list("image").length, 1);
  const r = await pool.run("image", { prompt: "a" }, {}, "demo");
  assert.equal(r.url, "u");
  assert.equal(got.prompt, "a");
});

test("适配器池：syncDrama 接入四类现有适配器，run 正确转发参数", async () => {
  const { pool, sandbox } = loadPool();
  const calls = [];
  sandbox.XLX.drama = {
    adapters: {
      image: { generate: (o) => { calls.push(["image", o]); return Promise.resolve({ url: "img" }); } },
      video: { generate: (o, p, s) => { calls.push(["video", !!p, !!s]); return Promise.resolve({ url: "vid" }); } },
      tts: { synth: (o) => { calls.push(["tts", o]); return Promise.resolve({ url: "aud" }); } },
      lipsync: { generate: (o) => { calls.push(["lipsync", o]); return Promise.resolve({ url: "lip" }); } }
    },
    adapterList: (kind) => ({
      image: [{ id: "seedream", name: "Seedream" }, { id: "wanx", name: "Wanx" }],
      video: [{ id: "seedance", name: "Seedance" }, { id: "kling", name: "Kling" }],
      tts: [{ id: "volc", name: "火山语音" }],
      lipsync: [{ id: "volc-koubo", name: "火山口型" }]
    }[kind] || []),
    getAdapterConfig: (kind) => ({ provider: { image: "seedream", video: "kling", tts: "volc", lipsync: "volc-koubo" }[kind] })
  };
  pool.syncDrama();
  assert.equal(pool.get("video", "kling").vendor, "kling");
  assert.equal(pool.get("image", "seedream").vendor, "volc-ark");
  assert.equal(pool.descriptor("image", "wanx").models.length, 2);
  await pool.run("image", { prompt: "p" });
  await pool.run("video", { prompt: "p" }, { onProgress: () => {}, signal: {} });
  await pool.run("tts", { text: "t" });
  await pool.run("lipsync", { imageUrl: "i" });
  assert.deepEqual(calls[0], ["image", { prompt: "p" }]);
  assert.deepEqual(calls[1], ["video", true, true]);
  assert.deepEqual(calls[2], ["tts", { text: "t" }]);
  assert.deepEqual(calls[3], ["lipsync", { imageUrl: "i" }]);
});

test("适配器池：registerLlm 接入对话能力并转发 messages/options", async () => {
  const { pool, sandbox } = loadPool();
  let seen = null;
  sandbox.XLX.llm = { chat: (messages, opts) => { seen = { messages, opts }; return Promise.resolve("ok"); } };
  pool.registerLlm();
  const r = await pool.run("llm", { messages: [{ role: "user", content: "hi" }], chat: { stream: true } });
  assert.equal(r, "ok");
  assert.equal(seen.messages[0].content, "hi");
  assert.equal(seen.opts.stream, true);
  assert.equal(pool.currentId("llm"), "chat");
});
