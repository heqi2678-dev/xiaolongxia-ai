/* 厂商钥匙库（地基层）· 单元测试
 * 用最小 vm 沙箱加载 src/vendor-keys.js，核对：读写、对话/短剧/店员解析、写穿、旧数据迁移、幂等。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = fs.readFileSync(path.resolve(__dirname, "..", "src", "vendor-keys.js"), "utf8");

function makeStore(seed) {
  const store = Object.assign({}, seed || {});
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store
  };
}

function load(seed) {
  const localStorage = makeStore(seed);
  const sandbox = { XLX: {}, localStorage, console, JSON: JSON, Object: Object, String: String };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "src/vendor-keys.js" });
  return { xv: sandbox.XLX.vendorKeys, store: localStorage };
}

test("厂商钥匙库：默认空，不误报已配置", () => {
  const { xv } = load();
  assert.equal(xv.llmKey("deepseek"), "");
  assert.equal(xv.isConfigured("deepseek"), false);
  assert.equal(xv.vendorDef("deepseek").name, "DeepSeek");
  assert.ok(xv.all().length >= 10);
});

test("厂商钥匙库：set/get/isConfigured/llmKey", () => {
  const { xv } = load();
  xv.set("deepseek", { key: "  sk-ds  " });
  assert.equal(xv.llmKey("deepseek"), "sk-ds");
  assert.equal(xv.llmKeyOfPid("deepseek"), "sk-ds");
  assert.equal(xv.isConfigured("deepseek"), true);
  assert.equal(xv.isConfigured("openrouter"), false);
});

test("厂商钥匙库：服务映射（千问→百炼、豆包→方舟）", () => {
  const { xv } = load();
  xv.set("aliyun-bailian", { key: "sk-qwen" });
  xv.set("volc-ark", { key: "sk-ark" });
  assert.equal(xv.llmKeyOfPid("qwen"), "sk-qwen");
  assert.equal(xv.llmKeyOfPid("doubao"), "sk-ark");
  assert.equal(xv.llmKeyOfBrain("qwen"), "sk-qwen");
  assert.equal(xv.llmKeyOfBrain("doubao"), "sk-ark");
  assert.equal(xv.llmKeyOfBrain("deepseek"), "");
});

test("厂商钥匙库：短剧可灵 → key/secret/base", () => {
  const { xv } = load();
  xv.set("kling", { accessKey: "AK", secretKey: "SK", workspaceId: "ws123" });
  const r = xv.dramaResolve("kling");
  assert.equal(r.key, "AK");
  assert.equal(r.secret, "SK");
  assert.equal(r.base, "https://ws123.cn-beijing.maas.aliyuncs.com");
});

test("厂商钥匙库：短剧火山视觉 → key/appId/secret", () => {
  const { xv } = load();
  xv.set("volc-vision", { accessKeyId: "AKID", secret: "SEC" });
  const r = xv.dramaResolve("volc-koubo");
  assert.equal(r.key, "AKID");
  assert.equal(r.appId, "AKID");
  assert.equal(r.secret, "SEC");
});

test("厂商钥匙库：短剧火山语音 → key/cluster", () => {
  const { xv } = load();
  xv.set("volc-speech", { key: "SPK", cluster: "seed-tts-2.0" });
  const r = xv.dramaResolve("volc");
  assert.equal(r.key, "SPK");
  assert.equal(r.cluster, "seed-tts-2.0");
});

test("厂商钥匙库：未知 provider 返回空对象", () => {
  const { xv } = load();
  assert.deepEqual(xv.dramaResolve("pollinations"), {});
});

test("厂商钥匙库：写穿 syncLlm/syncBrain/syncDrama 只写非空", () => {
  const { xv } = load();
  xv.syncLlm("deepseek", "k1");
  assert.equal(xv.llmKey("deepseek"), "k1");
  xv.syncLlm("deepseek", "");
  assert.equal(xv.llmKey("deepseek"), "k1", "空值不应清掉已有钥匙");
  xv.syncBrain("qwen", "k2");
  assert.equal(xv.llmKeyOfBrain("qwen"), "k2");
  xv.syncDrama("kling", { key: "AK", secret: "SK", base: "https://ws9.cn-beijing.maas.aliyuncs.com" });
  const r = xv.dramaResolve("kling");
  assert.equal(r.key, "AK");
  assert.equal(r.secret, "SK");
  assert.equal(r.base, "https://ws9.cn-beijing.maas.aliyuncs.com");
});

test("厂商钥匙库：workspaceFromBase 解析与忽略占位符", () => {
  const { xv } = load();
  assert.equal(xv.workspaceFromBase("https://ws123.cn-beijing.maas.aliyuncs.com"), "ws123");
  assert.equal(xv.workspaceFromBase("https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com"), "");
  assert.equal(xv.workspaceFromBase("https://api.example.com"), "");
  assert.equal(xv.workspaceFromBase(""), "");
});

test("厂商钥匙库：加载时迁移四本账旧钥匙", () => {
  const seed = {
    xlx_drama_settings: JSON.stringify({
      adapters: {
        image: { provider: "seedream", key: "ark-img" },
        video: { provider: "kling", key: "kl-ak", secret: "kl-sk", base: "https://ws77.cn-beijing.maas.aliyuncs.com" },
        tts: { provider: "volc", key: "spk", cluster: "seed-tts-2.0" },
        lipsync: { provider: "volc-koubo", key: "vid-ak", secret: "vid-sk" }
      }
    }),
    xlx_settings: JSON.stringify({ providers: [{ id: "deepseek", key: "ds-key" }, { id: "qwen", key: "qwen-key" }] }),
    xlx_models: JSON.stringify([{ vendor: "openrouter", key: "or-key" }, { vendor: "custom", key: "cu-key" }]),
    xlx_clerk_brain: JSON.stringify({ keys: { deepseek: "clerk-ds", qwen: "clerk-qwen", doubao: "clerk-db" } })
  };
  const { xv } = load(seed);
  assert.equal(xv.llmKey("deepseek"), "ds-key");
  assert.equal(xv.llmKeyOfPid("qwen"), "qwen-key");
  assert.equal(xv.llmKey("openrouter"), "or-key");
  assert.equal(xv.field("volc-ark", "key"), "ark-img");
  assert.equal(xv.dramaResolve("kling").key, "kl-ak");
  assert.equal(xv.dramaResolve("kling").base, "https://ws77.cn-beijing.maas.aliyuncs.com");
  assert.equal(xv.field("volc-speech", "cluster"), "seed-tts-2.0");
  assert.equal(xv.field("volc-vision", "accessKeyId"), "vid-ak");
  /* deepseek 已被对话单配置先占；豆包与 Seedream 同属火山方舟，共用一把 Key */
  assert.equal(xv.llmKey("deepseek"), "ds-key");
  assert.equal(xv.llmKeyOfBrain("doubao"), "ark-img");
});

test("厂商钥匙库：迁移不覆盖已有值，且只跑一次", () => {
  const seed = {
    xlx_vendor_keys: JSON.stringify({ deepseek: { key: "user-set" } }),
    xlx_settings: JSON.stringify({ providers: [{ id: "deepseek", key: "old-key" }] })
  };
  const { xv, store } = load(seed);
  assert.equal(xv.llmKey("deepseek"), "user-set", "已有厂商钥匙优先，不被旧数据覆盖");
  assert.equal(store.getItem("xlx_vendor_keys_migrated"), "1");
  /* 抹掉迁移标记并再次加载，仍不覆盖用户已设的钥匙 */
  delete store._store.xlx_vendor_keys_migrated;
  const again = load(store._store);
  assert.equal(again.xv.llmKey("deepseek"), "user-set");
});
