/* 适配器真实 HTTP 契约联调（本地仿真厂商，不触外网）
 * 在 jsdom 里加载真实适配器代码，把 base 指向本地 mock 服务，逐条校验：
 *   - 请求地址 / 方法 / 鉴权头 / 请求体字段（model、ratio、时长、首尾帧、参考图）
 *   - 任务式协议的创建与轮询路径、状态与结果字段的解析
 *   - 各类前置校验（视频编辑参数、Seedance 2.x 首尾帧 ratio）
 * 用法：NODE_PATH="$(npm root -g)" node --test tests/adapters-http.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/config.js", "src/util.js", "src/vendor-keys.js",
  "src/drama/config.js", "src/drama/adapters.js",
  "src/drama/adapters/image.js", "src/drama/adapters/video.js",
  "src/drama/adapters/tts.js", "src/drama/adapters/lipsync.js"
];

function startMock() {
  const reqs = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", c => { raw += c; });
    req.on("end", () => {
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
      const p = req.url.split("?")[0];
      const base = "http://127.0.0.1:" + server.address().port;
      reqs.push({ method: req.method, url: p, headers: req.headers, body });
      const send = (o, code) => {
        res.writeHead(code || 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(o));
      };
      if (p.endsWith("/images/generations")) {
        if (body && String(body.prompt).includes("B64")) return send({ data: [{ b64_json: Buffer.from("IMG").toString("base64") }] });
        return send({ data: [{ url: base + "/files/img.png" }] });
      }
      if (p.endsWith("/tts")) {
        if (body && String(body.text).includes("B64")) return send({ data: Buffer.from("AUD").toString("base64") });
        return send({ url: base + "/files/a.mp3" });
      }
      if (p.endsWith("/api/v1/services/aigc/text2image/image-synthesis")) return send({ output: { task_id: "t_img1" } });
      if (p.endsWith("/api/v1/tasks/t_img1")) return send({ output: { task_status: "SUCCEEDED", results: [{ url: base + "/files/wanx.png" }] } });
      if (p.endsWith("/api/v1/services/aigc/video-generation/video-synthesis")) return send({ output: { task_id: "k_vid1" } });
      if (p.endsWith("/api/v1/tasks/k_vid1")) return send({ output: { task_status: "SUCCEEDED", video_url: base + "/files/kling.mp4" } });
      if (p.endsWith("/api/v3/contents/generations/tasks") && req.method === "POST") return send({ id: "v_vid1" });
      if (p.endsWith("/api/v3/contents/generations/tasks/v_vid1")) return send({ status: "succeeded", content: { video_url: base + "/files/seedance.mp4" } });
      if (p.endsWith("/api/v1/tools/lipsync")) return send({ task_id: "l_lip1" });
      if (p.endsWith("/api/v1/tasks/l_lip1")) return send({ status: "succeeded", video_url: base + "/files/lip.mp4" });
      send({ error: { message: "no route " + p } }, 404);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({
    server, reqs, base: "http://127.0.0.1:" + server.address().port,
    close() { if (server.closeAllConnections) server.closeAllConnections(); server.close(); }
  })));
}

function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://preview.test/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = (u, o) => fetch(u, o);
  w.URL.createObjectURL = () => "blob:test/x";
  w.URL.revokeObjectURL = () => {};
  w.Audio = function () {
    const self = this;
    this.duration = 3.2;
    Object.defineProperty(this, "src", { configurable: true, get() { return ""; }, set() { setTimeout(() => self.onloadedmetadata && self.onloadedmetadata(), 0); } });
  };
  for (const f of FILES) {
    const s = w.document.createElement("script");
    s.textContent = fs.readFileSync(path.join(ROOT, f), "utf8");
    w.document.head.appendChild(s);
  }
  return { w, D: w.eval("XLX").drama };
}

function findReq(reqs, method, suffix) {
  for (let i = reqs.length - 1; i >= 0; i--) {
    const r = reqs[i];
    if (r.method === method && r.url.endsWith(suffix)) return r;
  }
  return null;
}
function imgParts(body) { return (body.content || []).filter(x => x.type === "image_url"); }

test("图像：自定义接口请求与解析", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("image", { provider: "custom-image", base: m.base + "/img", key: "IMGKEY", model: "custom-img-1" });
    const out = await D.adapters.image.generate({ prompt: "一只猫", ratio: "9:16", refImages: ["https://cdn.test/ref1.png"] });
    assert.equal(out.url, m.base + "/files/img.png");
    const r = findReq(m.reqs, "POST", "/img/images/generations");
    assert.equal(r.headers.authorization, "Bearer IMGKEY");
    assert.equal(r.body.model, "custom-img-1");
    assert.equal(r.body.size, "768x1344");
    assert.deepEqual(r.body.image, "https://cdn.test/ref1.png");
    assert.equal(r.body.n, 1);
  } finally { m.close(); }
});

test("图像：Seedream 多参考与尺寸", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("image", { provider: "seedream", base: m.base + "/ark", key: "ARKK" });
    const out = await D.adapters.image.generate({ prompt: "两只猫", ratio: "9:16", refImages: ["a", "b"] });
    assert.equal(out.url, m.base + "/files/img.png");
    const r = findReq(m.reqs, "POST", "/ark/images/generations");
    assert.equal(r.headers.authorization, "Bearer ARKK");
    assert.equal(r.body.watermark, false);
    assert.equal(r.body.size, "1440x2560");
    assert.deepEqual(r.body.image, ["a", "b"]);
  } finally { m.close(); }
});

test("图像：自定义接口 base64 回包解析", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("image", { provider: "custom-image", base: m.base + "/img", key: "K" });
    const out = await D.adapters.image.generate({ prompt: "B64 图", ratio: "1:1" });
    assert.ok(out.url.startsWith("data:image/png;base64,"), "应转成 dataURL");
  } finally { m.close(); }
});

test("图像：万相任务创建与轮询", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("image", { provider: "wanx", base: m.base + "/ali", key: "ALI" });
    const out = await D.adapters.image.generate({ prompt: "风景", ratio: "9:16", refImages: ["r1", "r2", "r3", "r4"] });
    assert.equal(out.url, m.base + "/files/wanx.png");
    const c = findReq(m.reqs, "POST", "/ali/api/v1/services/aigc/text2image/image-synthesis");
    assert.equal(c.headers["x-dashscope-async"], "enable");
    assert.equal(c.body.parameters.size, "768*1344");
    assert.deepEqual(c.body.input.ref_images, ["r1", "r2", "r3"], "参考图最多 3 张");
    assert.ok(findReq(m.reqs, "GET", "/ali/api/v1/tasks/t_img1"), "轮询走 /api/v1/tasks/{id}");
  } finally { m.close(); }
});

test("视频：Seedance 1.0 首尾帧、文字参数与参考图降级", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("video", { provider: "seedance", base: m.base + "/ark", key: "VK", model: "doubao-seedance-1-0-pro-fast-251015" });
    const out = await D.adapters.video.generate({
      prompt: "奔跑", ratio: "9:16", duration: 5, resolution: "720p",
      firstFrame: "https://cdn/f.png", lastFrame: "https://cdn/l.png", referenceImages: ["https://cdn/r.png"]
    });
    assert.equal(out.url, m.base + "/files/seedance.mp4");
    const c = findReq(m.reqs, "POST", "/ark/api/v3/contents/generations/tasks");
    assert.equal(c.body.model, "doubao-seedance-1-0-pro-fast-251015");
    assert.match(c.body.content[0].text, /--ratio 9:16/);
    assert.match(c.body.content[0].text, /--duration 5/);
    assert.match(c.body.content[0].text, /--resolution 720p/);
    const imgs = imgParts(c.body);
    assert.equal(imgs[0].image_url.url, "https://cdn/f.png");
    assert.equal(imgs[1].role, "last_frame");
    assert.equal(c.body.content.some(x => x.role === "reference_image"), false, "1.0 角色参考图应降级");
    assert.equal(out.degraded.reason, "R2V_UNSUPPORTED");
  } finally { m.close(); }
});

test("视频：Seedance 2.x 参考图按 reference_image 下发", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("video", { provider: "seedance", base: m.base + "/ark", key: "VK", model: "doubao-seedance-2-0-260128" });
    await D.adapters.video.generate({ prompt: "p", ratio: "adaptive", duration: 5, firstFrame: "f", referenceImages: ["r1", "r2"] });
    const c = findReq(m.reqs, "POST", "/ark/api/v3/contents/generations/tasks");
    const refs = c.body.content.filter(x => x.role === "reference_image").map(x => x.image_url.url);
    assert.deepEqual(refs, ["r1", "r2"]);
  } finally { m.close(); }
});

test("视频：任务参数前置校验", () => {
  const { D } = boot();
  const M = "doubao-seedance-2-0-260128";
  assert.throws(() => D.adapters.video.assertTaskParams({ referenceVideo: "v", prompt: "", ratio: "adaptive", duration: -1 }, M), /编辑意图/);
  assert.throws(() => D.adapters.video.assertTaskParams({ referenceVideo: "v", prompt: "p", ratio: "9:16", duration: -1 }, M), /ratio/);
  assert.throws(() => D.adapters.video.assertTaskParams({ referenceVideo: "v", prompt: "p", ratio: "adaptive", duration: 5 }, M), /duration/);
  assert.throws(() => D.adapters.video.assertTaskParams({ referenceVideo: "v", prompt: "p", ratio: "adaptive", duration: -1, refDuration: 2 }, M), /4 至 30/);
  assert.throws(() => D.adapters.video.assertTaskParams({ referenceVideo: "v", prompt: "p", ratio: "adaptive", duration: -1, lastFrame: "l" }, M), /尾帧/);
  assert.throws(() => D.adapters.video.assertTaskParams({ prompt: "p", duration: 40 }, M), /30 秒/);
  assert.throws(() => D.adapters.video.assertTaskParams({ prompt: "p", duration: 5, firstFrame: "f", ratio: "9:16" }, M), /adaptive/);
});

test("视频：可灵创建与轮询路径", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("video", { provider: "kling", base: m.base + "/maas", key: "KL", model: "kling/kling-v3-turbo-video-generation" });
    const out = await D.adapters.video.generate({ prompt: "p", ratio: "9:16", duration: 5, firstFrame: "https://cdn/f.png" });
    assert.equal(out.url, m.base + "/files/kling.mp4");
    const c = findReq(m.reqs, "POST", "/maas/api/v1/services/aigc/video-generation/video-synthesis");
    assert.equal(c.headers["x-dashscope-async"], "enable");
    assert.equal(c.body.model, "kling/kling-v3-turbo-video-generation");
    assert.equal(c.body.input.image_url, "https://cdn/f.png");
    assert.equal(c.body.parameters.aspect_ratio, "9:16");
    assert.ok(findReq(m.reqs, "GET", "/maas/api/v1/tasks/k_vid1"), "可灵轮询应打 /api/v1/tasks/{id}");
  } finally { m.close(); }
});

test("语音：自定义接口 URL 与 base64 两条路径", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("tts", { provider: "custom-tts", base: m.base + "/tts", key: "TK" });
    const a = await D.adapters.tts.synth({ text: "你好", voice: "v", format: "mp3" });
    assert.equal(a.url, m.base + "/files/a.mp3");
    assert.equal(a.duration, 3.2);
    const req = findReq(m.reqs, "POST", "/tts");
    assert.equal(req.headers.authorization, "Bearer TK");
    const b = await D.adapters.tts.synth({ text: "B64 语音" });
    assert.ok(b.url.startsWith("blob:test/"), "base64 回包应转 blob URL");
  } finally { m.close(); }
});

test("语音：火山走同源网关", async () => {
  const { w, D } = boot();
  D.setAdapterConfig("tts", { provider: "volc", key: "VOLCK", cluster: "seed-tts-2.0" });
  const calls = [];
  const orig = w.fetch;
  w.fetch = async (u, o) => { calls.push({ u, o }); return new Response(new Blob([Buffer.from("a")], { type: "audio/mpeg" }), { status: 200 }); };
  try {
    await D.adapters.tts.synth({ text: "你好", voice: "zh_female_vv_uranus_bigtts", speed: 1 });
  } finally { w.fetch = orig; }
  assert.equal(calls[0].u, "/dian/api/drama/tts", "必须打同源网关");
  const payload = JSON.parse(calls[0].o.body);
  assert.equal(payload.key, "VOLCK");
  assert.equal(payload.resource, "seed-tts-2.0");
  assert.equal(payload.speaker, "zh_female_vv_uranus_bigtts");
});

test("口型：自定义任务式创建与轮询", async () => {
  const m = await startMock();
  try {
    const { D } = boot();
    D.setAdapterConfig("lipsync", { provider: "custom-lipsync", base: m.base + "/lip", key: "LK" });
    const out = await D.adapters.lipsync.generate({ videoUrl: "https://cdn/v.mp4", audioUrl: "https://cdn/a.mp3" });
    assert.equal(out.url, m.base + "/files/lip.mp4");
    const c = findReq(m.reqs, "POST", "/lip/api/v1/tools/lipsync");
    assert.equal(c.body.video_url, "https://cdn/v.mp4");
    assert.equal(c.body.audio_url, "https://cdn/a.mp3");
  } finally { m.close(); }
});

test("口型：火山数字人走签名网关", async () => {
  const { w, D } = boot();
  D.setAdapterConfig("lipsync", { provider: "volc-koubo", key: "AKID", secret: "SECRET" });
  const calls = [];
  let n = 0;
  const orig = w.fetch;
  w.fetch = async (u, o) => {
    calls.push({ u, o });
    n++;
    /* 网关契约：{ok:true, data:<火山原样 JSON>}；火山成功码 10000，业务字段在 data 内 */
    const inner = n === 1
      ? { code: 10000, data: { task_id: "volc_1" } }
      : { code: 10000, data: { status: "done", video_url: "https://cdn/out.mp4" } };
    return new Response(JSON.stringify({ ok: true, data: inner }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  let out;
  try {
    out = await D.adapters.lipsync.generate({ imageUrl: "https://cdn/i.png", audioUrl: "https://cdn/a.mp3" });
  } finally { w.fetch = orig; }
  assert.equal(out.url, "https://cdn/out.mp4");
  assert.equal(calls[0].u, "/dian/api/drama/visual");
  const payload = JSON.parse(calls[0].o.body);
  assert.equal(payload.action, "CVSubmitTask");
  assert.equal(payload.service, "cv");
  assert.equal(payload.region, "cn-north-1");
  assert.equal(payload.key, "AKID");
  assert.equal(payload.secret, "SECRET");
  assert.equal(payload.body.req_key, "jimeng_realman_avatar_picture_omni_v15");
});
