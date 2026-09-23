/* AI 短剧工作台 · 前端逻辑测试
 * 运行：node --test tests/
 * 覆盖：角色提示词、适配器请求构造与响应解析、剧种引擎、工程模型、合规校验、合成导出。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { createDrama, mockJson, mockBlob, setAdapter } = require("./drama-harness.js");

function dramaSrc(file) {
  return fs.readFileSync(path.resolve(__dirname, "..", "src", "drama", file), "utf8");
}

function sleepStub(D) { D.adapterUtil.sleep = async () => {}; }

test("角色提示词包含画风、角色设定与剧情描述", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.style = "cn-manhua";
  const c = D.project.addCharacter(p, "小美");
  c.identity = "落魄千金";
  c.appearance = "长发，红裙，眼神倔强";
  const shot = p.shots[0];
  shot.prompt = "雨夜街头回眸";
  shot.roleIds = [c.id];
  const prompt = D.character.buildImagePrompt(p, shot);
  assert.match(prompt, /角色设定/);
  assert.match(prompt, /小美/);
  assert.match(prompt, /雨夜街头回眸/);
  assert.ok(prompt.length > 20);
});

test("角色参考图按分镜角色聚合且上限 3 张", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  const c = D.project.addCharacter(p, "A");
  c.refImages = ["u1", "u2", "u3", "u4"];
  const shot = p.shots[0];
  shot.roleIds = [c.id];
  assert.deepEqual(D.character.refImagesForShot(p, shot), ["u1", "u2", "u3"]);
});

test("图像适配器 seedream 请求体与响应解析", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  mockJson(sandbox, { data: [{ url: "https://cdn/1.png" }] });
  const r = await D.adapters.image.generate({
    prompt: "黄昏街头", ratio: "9:16", refImages: ["https://cdn/ref.png"]
  });
  assert.equal(r.url, "https://cdn/1.png");
  const call = sandbox.__calls[0];
  assert.match(call.url, /\/images\/generations$/);
  const body = JSON.parse(call.opts.body);
  assert.equal(body.model, "doubao-seedream-4-5-251128");
  assert.equal(body.size, "1440x2560");
  assert.equal(body.image, "https://cdn/ref.png");
  assert.equal(body.response_format, "url");
  assert.equal(call.opts.headers.Authorization, "Bearer k");
});

test("图像适配器支持 b64 返回与免费兜底", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  mockJson(sandbox, { data: [{ b64_json: "QUJD" }] });
  const r = await D.adapters.image.generate({ prompt: "p", ratio: "1:1" });
  assert.equal(r.url, "data:image/png;base64,QUJD");

  setAdapter(D, "image", { provider: "pollinations" });
  const free = await D.adapters.image.generate({ prompt: "一只猫", ratio: "9:16" });
  assert.match(free.url, /image\.pollinations\.ai\/prompt\//);
  assert.match(free.url, /width=768&height=1344/);
});

test("图像适配器 wanx 走异步任务轮询", async () => {
  const { D, sandbox } = createDrama();
  sleepStub(D);
  setAdapter(D, "image", { provider: "wanx", key: "k" });
  mockJson(sandbox, (url) => {
    if (url.includes("/tasks/")) {
      return { output: { task_status: "SUCCEEDED", results: [{ url: "https://cdn/w.png" }] } };
    }
    return { output: { task_id: "t1", task_status: "RUNNING" } };
  });
  const r = await D.adapters.image.generate({ prompt: "p", ratio: "1:1" });
  assert.equal(r.url, "https://cdn/w.png");
  assert.equal(sandbox.__calls.length, 2);
});

test("未配置生图服务时抛出 NO_KEY", async () => {
  const { D } = createDrama();
  setAdapter(D, "image", { provider: "seedream", key: "" });
  await assert.rejects(
    () => D.adapters.image.generate({ prompt: "p", ratio: "1:1" }),
    (e) => e.code === "NO_KEY"
  );
});

test("语音适配器 volc 走同源网关代理并透传凭据与台词", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "tts", { provider: "volc", key: "tok", cluster: "seed-tts-2.0", voice: "zh_female_vv_uranus_bigtts" });
  mockBlob(sandbox, "audio/mpeg");
  const r = await D.adapters.tts.synth({ text: "你好", voice: "zh_female_vv_uranus_bigtts", speed: 1 });
  assert.match(r.url, /^blob:/);
  const call = sandbox.__calls[0];
  assert.equal(call.url, "/dian/api/drama/tts");
  assert.equal(call.opts.headers["X-Api-Key"], undefined);
  assert.equal(call.opts.headers["X-Api-Resource-Id"], undefined);
  const body = JSON.parse(call.opts.body);
  assert.equal(body.key, "tok");
  assert.equal(body.resource, "seed-tts-2.0");
  assert.equal(body.text, "你好");
  assert.equal(body.speaker, "zh_female_vv_uranus_bigtts");
  assert.equal(body.speed, 1);
  assert.equal(body.format, "mp3");
});

test("语音适配器 volc 兼容设置页 secret 字段并透传语速", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "tts", { provider: "volc", secret: "tok", cluster: "seed-tts-1.0" });
  mockBlob(sandbox, "audio/mpeg");
  const r = await D.adapters.tts.synth({ text: "你好", voice: "v", speed: 1.5 });
  assert.match(r.url, /^blob:/);
  const body = JSON.parse(sandbox.__calls[0].opts.body);
  assert.equal(body.key, "tok");
  assert.equal(body.resource, "seed-tts-1.0");
  assert.equal(body.speed, 1.5);
});

test("语音适配器 volc 缺 Key 抛 NO_KEY，网关报错透出提示", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "tts", { provider: "volc", key: "" });
  await assert.rejects(() => D.adapters.tts.synth({ text: "你好" }), (e) => e.code === "NO_KEY");

  setAdapter(D, "tts", { provider: "volc", key: "tok" });
  mockBlob(sandbox, "audio/mpeg", false, JSON.stringify({ ok: false, error: "语音合成未返回音频：resource ID is mismatched" }));
  await assert.rejects(
    () => D.adapters.tts.synth({ text: "你好", voice: "bad" }),
    (e) => e.code === "HTTP_502" && /mismatched/.test(e.message)
  );
});

test("b64ToBlobUrl 支持多分片拼接", () => {
  const { D, sandbox } = createDrama();
  let captured = null;
  sandbox.URL.createObjectURL = (blob) => { captured = blob; return "blob:test"; };
  D.adapterUtil.b64ToBlobUrl(["QUJD", "REVG"], "audio/mpeg");
  assert.equal(captured.type, "audio/mpeg");
  assert.equal(String.fromCharCode.apply(null, captured.parts[0]), "ABCDEF");
});

test("视频适配器 seedance 任务创建与轮询", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "video", { provider: "seedance", key: "k" });
  mockJson(sandbox, { id: "task-1" });
  const created = await D.adapters.video.create({ prompt: "奔跑", ratio: "9:16", duration: 5, resolution: "720p" });
  assert.equal(created.jobId, "task-1");
  const body = JSON.parse(sandbox.__calls[0].opts.body);
  assert.match(body.content[0].text, /--ratio 9:16/);
  assert.match(body.content[0].text, /--duration 5/);
  assert.equal(body.model, "doubao-seedance-1-0-pro-fast-251015");

  mockJson(sandbox, { status: "succeeded", content: { video_url: "https://cdn/v.mp4" } });
  const st = await D.adapters.video.poll("task-1");
  assert.equal(st.status, "done");
  assert.equal(st.url, "https://cdn/v.mp4");
});

test("视频适配器把角色参考图作为 reference_image 送入，首帧图不重复", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "video", { provider: "seedance", key: "k", model: "doubao-seedance-2-0-260128" });
  mockJson(sandbox, { id: "task-ref" });
  await D.adapters.video.create({
    prompt: "两人对峙", ratio: "adaptive", duration: 5, resolution: "720p",
    firstFrame: "a1", refImages: ["a1", "b1", "a2"]
  });
  const content = JSON.parse(sandbox.__calls[0].opts.body).content;
  const refs = content.filter(x => x.role === "reference_image").map(x => x.image_url.url);
  assert.deepEqual(refs, ["b1", "a2"], "首帧已用的 a1 不重复送");
  assert.equal(content.filter(x => x.type === "image_url" && !x.role).length, 1);
});

test("1.0 模型不支持 r2v：参考图降级为首帧，不送 reference_image", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "video", { provider: "seedance", key: "k" });
  mockJson(sandbox, { id: "task-degrade" });
  const created = await D.adapters.video.create({
    prompt: "咖啡馆", ratio: "9:16", duration: 10, resolution: "720p",
    refImages: ["r1", "r2", "r3"]
  });
  const content = JSON.parse(sandbox.__calls[0].opts.body).content;
  assert.equal(content.filter(x => x.role === "reference_image").length, 0, "1.0 不得送 reference_image");
  const frames = content.filter(x => x.type === "image_url" && !x.role);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].image_url.url, "r1", "首张参考图改用首帧驱动");
  assert.equal(created.degraded.reason, "R2V_UNSUPPORTED");
  assert.equal(created.degraded.dropped, 2);
  assert.equal(created.degraded.asFirstFrame, true);
});

test("2.x 模型正常支持 r2v，无降级标记", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "video", { provider: "seedance", key: "k", model: "doubao-seedance-2-5-260628" });
  mockJson(sandbox, { id: "task-2x" });
  const created = await D.adapters.video.create({
    prompt: "咖啡馆", ratio: "9:16", duration: 15, resolution: "720p", refImages: ["r1"]
  });
  const content = JSON.parse(sandbox.__calls[0].opts.body).content;
  assert.equal(content.filter(x => x.role === "reference_image").length, 1);
  assert.equal(created.degraded, null);
});

test("整段生成遇 1.0 降级时把提示写到段上", async () => {
  const { D } = createDrama();
  D.project.cacheRemote = async (url) => url;
  D.adapters.video.generate = async () => ({ url: "https://example.com/t.mp4", degraded: { reason: "R2V_UNSUPPORTED", dropped: 2, asFirstFrame: true } });
  const p = D.project.blank({ title: "t", genre: "comic", engine: "video", shotMode: "take" });
  p.engine = "video";
  p.takeTarget = 10;
  p.shots = [1, 2].map(i => {
    const s = D.project.newShot(i);
    s.duration = 5;
    return s;
  });
  D.project.renumber(p);
  D.takes.sync(p);
  await D.engine.generateTake(p, p.takes[0].id, {});
  assert.match(p.takes[0].notice, /不支持角色参考图/);
  assert.match(p.takes[0].notice, /首帧/);
});

test("自定义口型适配器创建与轮询状态映射", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "custom-lipsync", base: "https://ls.example.com", key: "k" });
  mockJson(sandbox, { task_id: "L1" });
  const created = await D.adapters.lipsync.create({ videoUrl: "https://cdn/v.mp4", audioUrl: "https://cdn/a.mp3" });
  assert.equal(created.jobId, "L1");

  mockJson(sandbox, { status: "processing" });
  assert.equal((await D.adapters.lipsync.poll("L1")).status, "running");
  mockJson(sandbox, { status: "completed", video_url: "https://cdn/out.mp4" });
  const done = await D.adapters.lipsync.poll("L1");
  assert.equal(done.status, "done");
  assert.equal(done.url, "https://cdn/out.mp4");
});

test("火山即梦数字人口型 720P 走快速模式并截断超长提示词", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST", secret: "SKTEST", resolution: 720 });
  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { task_id: "L1" } } });
  await D.adapters.lipsync.create({
    imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3",
    prompt: "镜".repeat(400), maskUrl: "https://cdn/m.png"
  });
  const body = JSON.parse(sandbox.__calls[0].opts.body).body;
  assert.equal(body.output_resolution, 720);
  assert.equal(body.pe_fast_mode, true);
  assert.equal(body.prompt.length, 300);
  assert.deepEqual(body.mask_url, ["https://cdn/m.png"]);
});

test("火山即梦数字人口型走同源签名代理", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST", secret: "SKTEST" });
  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { task_id: "L1" } } });
  const created = await D.adapters.lipsync.create({
    imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3"
  });
  assert.equal(created.jobId, "L1");
  assert.equal(created.provider, "volc-koubo");
  const call = sandbox.__calls[0];
  assert.equal(call.url, "/dian/api/drama/visual");
  const body = JSON.parse(call.opts.body);
  assert.equal(body.key, "AKTEST");
  assert.equal(body.secret, "SKTEST");
  assert.equal(body.action, "CVSubmitTask");
  assert.equal(body.version, "2022-08-31");
  assert.equal(body.service, "cv");
  assert.equal(body.region, "cn-north-1");
  assert.equal(body.body.req_key, "jimeng_realman_avatar_picture_omni_v15");
  assert.equal(body.body.image_url, "https://cdn/i.jpg");
  assert.equal(body.body.audio_url, "https://cdn/a.mp3");
  assert.equal(body.body.output_resolution, 1080);
  assert.equal(body.body.pe_fast_mode, false);

  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { status: "done", video_url: "https://cdn/out.mp4" } } });
  const st = await D.adapters.lipsync.poll("L1");
  assert.equal(st.status, "done");
  assert.equal(st.url, "https://cdn/out.mp4");
  const pollBody = JSON.parse(sandbox.__calls[1].opts.body);
  assert.equal(pollBody.action, "CVGetResult");
  assert.equal(pollBody.body.task_id, "L1");
  assert.equal(pollBody.body.output_resolution, undefined);
});

test("火山即梦数字人口型缺凭证与代理报错时给出可读提示", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST" });
  await assert.rejects(
    D.adapters.lipsync.create({ imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3" }),
    /Secret Access Key/
  );
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST", secret: "SKTEST" });
  mockJson(sandbox, { ok: false, error: "火山智能视觉报错：Access Denied" });
  await assert.rejects(
    D.adapters.lipsync.create({ imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3" }),
    /Access Denied/
  );
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST", secret: "SKTEST", retryDelay: 0 });
  mockJson(sandbox, { ok: true, data: { code: 50430, message: "Request Has Reached API Concurrent Limit" } });
  await assert.rejects(
    D.adapters.lipsync.create({ imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3" }),
    /并发/
  );
  mockJson(sandbox, { ok: true, data: { code: 50400, message: "Access Denied: Access Denied" } });
  await assert.rejects(
    D.adapters.lipsync.create({ imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3" }),
    /未开通/
  );
  mockJson(sandbox, { ok: true, data: { code: 50215, message: "Input invalid for this service." } });
  await assert.rejects(
    D.adapters.lipsync.create({ imageUrl: "https://cdn/i.jpg", audioUrl: "https://cdn/a.mp3" }),
    /60 秒/
  );
});

test("火山口型轮询解析 data.status 与 video_url", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST", secret: "SKTEST" });
  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { status: "in_queue" } } });
  const queued = await D.adapters.lipsync.poll("L1");
  assert.equal(queued.status, "running");
  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { status: "generating" } } });
  const running = await D.adapters.lipsync.poll("L1");
  assert.equal(running.status, "running");
  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { status: "done", video_url: "https://cdn/out.mp4" } } });
  const done = await D.adapters.lipsync.poll("L1");
  assert.equal(done.status, "done");
  assert.equal(done.url, "https://cdn/out.mp4");
  mockJson(sandbox, { ok: true, data: { code: 10000, message: "Success", data: { status: "expired" } } });
  const expired = await D.adapters.lipsync.poll("L1");
  assert.equal(expired.status, "failed");
  assert.match(expired.error, /过期/);
  mockJson(sandbox, { ok: true, data: { code: 50514, message: "Pre Audio Risk Not Pass" } });
  const bad = await D.adapters.lipsync.poll("L1");
  assert.equal(bad.status, "failed");
  assert.match(bad.error, /音频/);
});

test("readBlob 统一读取本地资源仓与远端地址", async () => {
  const { D, sandbox } = createDrama();
  const blob = new sandbox.Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" });
  await D.project.assets.put("b1", blob, {});
  assert.equal((await D.project.readBlob("asset:b1")).size, 3);
  assert.equal(await D.project.readBlob("asset:none"), null);
  assert.equal(await D.project.readBlob(""), null);
  mockJson(sandbox, {});
  assert.equal((await D.project.readBlob("https://cdn/v.mp4")).size, 3);
  mockJson(sandbox, {}, false);
  assert.equal(await D.project.readBlob("https://cdn/x.mp4"), null);
});

test("本地素材上传网关换公网地址，http 地址原样透传", async () => {
  const { D, sandbox } = createDrama();
  const blob = new sandbox.Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" });
  await D.project.assets.put("x1", blob, { mime: "audio/mpeg" });
  mockJson(sandbox, { ok: true, url: "https://pub.example/dian/pub/abc.mp3" });
  assert.equal(await D.project.toPublicUrl("asset:x1"), "https://pub.example/dian/pub/abc.mp3");
  const call = sandbox.__calls[0];
  assert.equal(call.url, "/dian/api/drama/asset");
  assert.equal(call.opts.method, "POST");
  assert.equal(call.opts.headers["Content-Type"], "audio/mpeg");
  assert.equal(await D.project.toPublicUrl("https://cdn/x.png"), "https://cdn/x.png");
  mockJson(sandbox, { ok: false, error: "素材超过 200MB" });
  await assert.rejects(D.project.toPublicUrl("asset:x1"), /200MB/);
  await assert.rejects(D.project.toPublicUrl("asset:nope"), /读不到/);
});

test("云端临时成片地址转存本地资源仓", async () => {
  const { D, sandbox } = createDrama();
  assert.equal(await D.project.cacheRemote("asset:keep"), "asset:keep");
  assert.equal(await D.project.cacheRemote(""), "");
  mockJson(sandbox, {});
  assert.match(await D.project.cacheRemote("https://cdn/v.mp4", { role: "videoUrl" }), /^asset:r/);
  mockJson(sandbox, {}, false);
  assert.equal(await D.project.cacheRemote("https://cdn/bad.mp4"), "https://cdn/bad.mp4");
  sandbox.fetch = async () => ({ ok: true, blob: async () => new sandbox.Blob([], {}) });
  assert.equal(await D.project.cacheRemote("https://cdn/empty.mp4"), "https://cdn/empty.mp4");
});

test("火山口型把本地配音换成公网地址后再提交", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "volc-koubo", key: "AKTEST", secret: "SKTEST", retryDelay: 0 });
  const blob = new sandbox.Blob([new Uint8Array([1])], { type: "audio/mpeg" });
  await D.project.assets.put("a1", blob, { mime: "audio/mpeg" });
  sandbox.fetch = async (url, opts) => {
    sandbox.__calls = sandbox.__calls || [];
    sandbox.__calls.push({ url: String(url), opts: opts || {} });
    const body = String(url).indexOf("/api/drama/asset") >= 0
      ? { ok: true, url: "https://pub.example/dian/pub/a1.mp3" }
      : { ok: true, data: { code: 10000, message: "Success", data: { task_id: "L9" } } };
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify(body),
      json: async () => body,
      blob: async () => new sandbox.Blob([])
    };
  };
  const created = await D.adapters.lipsync.create({ imageUrl: "https://cdn/i.jpg", audioUrl: "asset:a1" });
  assert.equal(created.jobId, "L9");
  const submit = JSON.parse(sandbox.__calls[sandbox.__calls.length - 1].opts.body);
  assert.equal(submit.body.audio_url, "https://pub.example/dian/pub/a1.mp3");
  assert.equal(submit.body.image_url, "https://cdn/i.jpg");
});

test("剧种引擎：漫剧单镜生成写入画面与配音", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  setAdapter(D, "tts", { provider: "volc", appId: "a", key: "t", voice: "v" });
  mockJson(sandbox, (url) => {
    if (url.includes("/images/generations")) return { data: [{ url: "https://cdn/shot1.png" }] };
    return { data: "QUJD" };
  });
  const p = D.project.blank({});
  const c = D.project.addCharacter(p, "小美");
  p.shots[0].prompt = "雨夜街头";
  p.shots[0].line = "你好";
  p.shots[0].roleIds = [c.id];
  const shot = await D.engine.generateShot(p, p.shots[0].id, {});
  assert.equal(shot.status, "done");
  assert.match(shot.imageUrl, /^asset:r/);
  assert.match(shot.audioUrl, /^blob:/);
  assert.equal(shot.stale, false);
});

test("剧种引擎：extractJson 兼容代码围栏", () => {
  const { D } = createDrama();
  assert.deepEqual(D.engine.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(D.engine.extractJson('前缀 {"b":2} 后缀'), { b: 2 });
  assert.equal(D.engine.extractJson("没有 JSON"), null);
  assert.equal(D.engine.extractJson(""), null);
});

test("剧种引擎：localPlan 与 applyPlan 落进工程", () => {
  const { D } = createDrama();
  const plan = D.engine.localPlan({ topic: "重生", shotCount: 4 });
  assert.equal(plan.shots.length, 4);
  assert.ok(plan.logline.includes("重生"));
  const p = D.project.blank({});
  D.engine.applyPlan(p, plan);
  assert.equal(p.shots.length, 4);
  assert.equal(p.characters.length, plan.characters.length);
  assert.deepEqual(p.shots.map((s) => s.seq), [1, 2, 3, 4]);
  assert.equal(p.shots[0].roleIds.length, 1);
});

test("工程模型：增删移镜与重新编号", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.project.addShot(p);
  D.project.addShot(p);
  assert.equal(p.shots.length, 3);
  assert.deepEqual(p.shots.map((s) => s.seq), [1, 2, 3]);
  const second = p.shots[1].id;
  D.project.moveShot(p, second, -1);
  assert.equal(p.shots[0].id, second);
  assert.deepEqual(p.shots.map((s) => s.seq), [1, 2, 3]);
  D.project.removeShot(p, second);
  assert.equal(p.shots.length, 2);
  assert.deepEqual(p.shots.map((s) => s.seq), [1, 2]);
});

test("工程模型：validate 指出缺失画面与配音", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  p.shots[0].line = "有台词";
  let v = D.project.validate(p);
  assert.equal(v.ok, false);
  assert.deepEqual(v.missing.map((m) => m.reason).sort(), ["有台词但缺配音", "缺画面"]);
  p.shots[0].imageUrl = "https://cdn/1.png";
  p.shots[0].audioUrl = "https://cdn/1.mp3";
  assert.equal(D.project.validate(p).ok, true);
});

test("合规：默认开启标注可通过，关闭被拦截", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  assert.equal(D.compliance.verify(p).ok, true);
  p.compliance.aigcMarked = false;
  const bad = D.compliance.verify(p);
  assert.equal(bad.ok, false);
  assert.match(bad.blockers.join(), /标注/);
});

test("合规：仿真人剧必须有有效肖像授权", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "realistic" });
  assert.equal(D.compliance.verify(p).ok, false);
  const rec = D.compliance.recordConsent("本人", "AI 短剧");
  p.compliance.consentIds = [rec.id];
  assert.equal(D.compliance.verify(p).ok, true);
});

test("合规：移除授权后仿真人剧重新被拦截", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "realistic" });
  const rec = D.compliance.recordConsent("模特甲", "授权 AI 短剧");
  p.compliance.consentIds = [rec.id];
  assert.equal(D.compliance.verify(p).ok, true);
  p.compliance.consentIds = [];
  const bad = D.compliance.verify(p);
  assert.equal(bad.ok, false);
  assert.match(bad.blockers.join(), /肖像授权/);
});

test("合规：角色标记真人时漫剧也需要授权", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  const c = D.project.addCharacter(p, "真人甲");
  c.realPerson = true;
  assert.equal(D.compliance.needsConsent(p), true);
  assert.equal(D.compliance.verify(p).ok, false);
  const rec = D.compliance.recordConsent("真人甲", "本人授权");
  p.compliance.consentIds = [rec.id];
  assert.equal(D.compliance.verify(p).ok, true);
});

test("合规：浏览器不支持人脸检测时放行并提示", async () => {
  const { D } = createDrama();
  assert.equal(D.compliance.faceDetectorAvailable(), false);
  const r = await D.compliance.guardUpload({ name: "x.png" }, "reference");
  assert.equal(r.ok, true);
  assert.match(r.warn, /自行确认/);
});

test("合规：未授权仿真人剧被服务端合成拦截", async () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "realistic" });
  p.shots[0].videoUrl = "https://cdn/v.mp4";
  p.shots[0].line = "";
  assert.equal(D.project.validate(p).ok, true);
  await assert.rejects(() => D.compose.server(p), (e) => e.code === "COMPLIANCE");
});

test("合规：未授权工程导出素材包被拦截", async () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "realistic" });
  await assert.rejects(() => D.compose.exportPack(p), (e) => e.code === "COMPLIANCE");
});

test("剧种引擎：仿真人单镜串联视频、配音与口型", async () => {
  const { D, sandbox } = createDrama();
  sleepStub(D);
  setAdapter(D, "video", { provider: "seedance", key: "k", base: "https://ark.test" });
  setAdapter(D, "tts", { provider: "volc", appId: "a", key: "t", voice: "v" });
  setAdapter(D, "lipsync", { provider: "custom-lipsync", base: "https://ls.test", key: "k" });
  mockJson(sandbox, (url) => {
    if (url.indexOf("/contents/generations/tasks/") >= 0) return { status: "succeeded", content: { video_url: "https://cdn/v.mp4" } };
    if (url.indexOf("/contents/generations/tasks") >= 0) return { id: "v1" };
    if (url.indexOf("/tools/lipsync") >= 0) return { task_id: "L1" };
    if (url.indexOf("/tasks/L1") >= 0) return { status: "completed", video_url: "https://cdn/out.mp4" };
    return { data: "QUJD" };
  });
  const p = D.project.blank({ genre: "realistic" });
  p.shots[0].prompt = "雨夜奔跑";
  p.shots[0].line = "别回头";
  const shot = await D.engine.generateShot(p, p.shots[0].id, {});
  assert.equal(shot.status, "done");
  assert.match(shot.videoUrl, /^asset:r/);
  assert.match(shot.audioUrl, /^blob:/);
  assert.match(shot.lipsyncUrl, /^asset:r/);
});

test("手搓台：首次渲染自动建工程并注入合规授权区", async () => {
  const { D } = createDrama();
  await D.manual.load();
  assert.ok(D.manual.state.project, "应自动创建并加载工程");
  assert.equal(D.manual.state.project.genre, "comic");
  assert.deepEqual(D.manual.state.project.compliance.consentIds, []);
  await D.manual.render();
  assert.equal(D.project.list().length, 1);
});

test("合成：SRT 时间轴与 CSV 分镜表", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  p.shots[0].line = "第一句";
  p.shots[0].duration = 4;
  D.project.addShot(p);
  p.shots[1].line = "第二句";
  p.shots[1].duration = 3;
  const srt = D.compose.srt(p);
  assert.match(srt, /00:00:00,000 --> 00:00:04,000/);
  assert.match(srt, /00:00:04,000 --> 00:00:07,000/);
  assert.match(srt, /第一句/);
  const csv = D.compose.csv(p);
  assert.match(csv, /镜号/);
  assert.match(csv, /第一句/);
});

test("合成：srt 忽略无台词分镜但保留时间推进", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  p.shots[0].line = "";
  p.shots[0].duration = 5;
  D.project.addShot(p);
  p.shots[1].line = "有声";
  p.shots[1].duration = 5;
  const srt = D.compose.srt(p);
  assert.match(srt, /00:00:05,000 --> 00:00:10,000/);
  assert.ok(!/00:00:00,000 --> 00:00:05,000/.test(srt));
});

test("合成：双语字幕逐镜输出中英两行，关闭双语则忽略英文", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  p.shots[0].line = "你好";
  p.shots[0].lineEn = "Hello";
  p.shots[0].duration = 4;
  p.subtitle.bilingual = true;
  let srt = D.compose.srt(p);
  assert.match(srt, /你好\nHello/, "双语同屏两行");
  p.subtitle.bilingual = false;
  srt = D.compose.srt(p);
  assert.match(srt, /你好/);
  assert.ok(!/Hello/.test(srt), "关闭双语不输出英文");
  p.subtitle.bilingual = true;
  p.shots[0].line = "";
  srt = D.compose.srt(p);
  assert.match(srt, /Hello/, "仅英文台词也成条");
});

test("分镜卡：提供英文字幕精修输入框", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "comic" });
  p.shots[0].line = "你好";
  p.shots[0].lineEn = "Hello";
  const html = D.ui.shotCard(p, p.shots[0]);
  assert.match(html, /data-field="lineEn"/);
  assert.match(html, /英文字幕/);
  assert.match(html, /Hello/);
});

/* ============ 跨工程角色库 ============ */

test("角色库：同名同外观原地更新，不重复入库", () => {
  const { D, sandbox } = createDrama();
  assert.equal(D.character.libAll().length, 0);
  const a = D.character.libSave({ name: "小美", appearance: "长发红裙" });
  const b = D.character.libSave({ name: "小美", appearance: "长发红裙" });
  assert.equal(a.id, b.id, "同名同外观应更新同一条，而不是新增");
  assert.equal(D.character.libAll().length, 1);
  D.character.libSave({ name: "阿强", appearance: "寸头" });
  assert.equal(D.character.libAll().length, 2);
  assert.ok(D.character.libGet(a.id));
  D.character.libRemove(a.id);
  assert.equal(D.character.libGet(a.id), null);
  assert.equal(D.character.libAll().length, 1);
  assert.ok(sandbox.localStorage.getItem("xlx_drama_library") !== null, "角色库应落在独立存储键上");
});

test("角色库：缺外观的角色拒绝入库", async () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  const c = D.project.addCharacter(p, "小美");
  await assert.rejects(() => D.character.libFromProject(p, c.id), (e) => e.code === "CHAR_INCOMPLETE");
  assert.equal(D.character.libAll().length, 0);
});

test("角色库：工程存卡把参考图落进资源仓，导入后跨工程可用", async () => {
  const { D } = createDrama();
  const p1 = D.project.blank({});
  const c1 = D.project.addCharacter(p1, "小美");
  c1.identity = "女主";
  c1.appearance = "长发红裙";
  c1.refImages = ["data:image/png;base64,QUJD"];
  const rec = await D.character.libFromProject(p1, c1.id);
  assert.equal(rec.refImages.length, 1);
  assert.match(rec.refImages[0], /^asset:/, "data/blob 参考图要转成可复用的 asset: 引用");

  const p2 = D.project.blank({});
  const c2 = await D.character.libToProject(p2, rec);
  assert.equal(p2.characters.length, 1);
  assert.equal(c2.name, "小美");
  assert.equal(c2.identity, "女主");
  assert.equal(c2.appearance, "长发红裙");
  assert.equal(c2.libraryId, rec.id);
  assert.equal(c2.refImages.length, 1);
  assert.ok(c2.refImages[0], "导入后参考图应能解析成可显示地址");
  assert.notEqual(c2.id, c1.id, "导入是复制一份，改库不影响已有工程");
});

test("角色库：真人角色导入后需补肖像授权才能过合规", async () => {
  const { D } = createDrama();
  const rec = D.character.libSave({ name: "真人甲", appearance: "短发", realPerson: true });
  const p = D.project.blank({ genre: "realistic" });
  const c = await D.character.libToProject(p, rec);
  assert.equal(c.realPerson, true);
  assert.equal(D.compliance.needsConsent(p), true);
  assert.equal(D.compliance.verify(p).ok, false);
  const r = D.compliance.recordConsent("真人甲", "本人授权");
  p.compliance.consentIds = [r.id];
  assert.equal(D.compliance.verify(p).ok, true);
});

/* ============ 角色一致性增强：外观细分 / 分组参考图 / 定妆图 ============ */

test("外观细分字段按固定顺序进入提示词，空字段不出现", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  const c = D.project.addCharacter(p, "小美");
  c.details = { outfit: "黑色高领毛衣", age: "27 岁", accessory: "银色腕表" };
  assert.equal(D.character.check(c), "", "有细分外观即可通过完整性检查");
  const shot = p.shots[0];
  shot.roleIds = [c.id];
  const prompt = D.character.buildImagePrompt(p, shot);
  assert.match(prompt, /年龄：27 岁/);
  assert.match(prompt, /服装：黑色高领毛衣/);
  assert.match(prompt, /配饰：银色腕表/);
  assert.ok(prompt.indexOf("年龄") < prompt.indexOf("服装"), "细分字段按固定顺序拼接");
  assert.ok(prompt.indexOf("服装") < prompt.indexOf("配饰"));
  assert.ok(!/瞳色/.test(prompt), "留空字段不进提示词");
});

test("多角色同框参考图按角色轮询摊平，不让单角色占满名额", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  const a = D.project.addCharacter(p, "A");
  const b = D.project.addCharacter(p, "B");
  a.refImages = ["a1", "a2", "a3"];
  b.refImages = ["b1", "b2"];
  const shot = p.shots[0];
  shot.roleIds = [a.id, b.id];
  assert.deepEqual(D.character.refImagesForShot(p, shot), ["a1", "b1", "a2"]);
  const groups = D.character.refGroupsForShot(p, shot);
  assert.deepEqual(groups.map(g => g.cid), [a.id, b.id]);
  assert.deepEqual(groups[0].urls, ["a1", "a2", "a3"]);
  const note = D.character.refNote(p, shot);
  assert.match(note, /A（参考图 1）/);
  assert.match(note, /B（参考图 2）/);
});

test("角色定妆图：按 3:4 生成、写入参考图并标记相关分镜需重绘", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  const p = D.project.blank({});
  const c = D.project.addCharacter(p, "小美");
  c.appearance = "长发红裙";
  const shot = p.shots[0];
  shot.roleIds = [c.id];
  shot.status = "done";
  shot.imageUrl = "asset:old";
  mockJson(sandbox, { data: [{ url: "https://cdn/sheet.png" }] });
  const r = await D.character.generateSheet(p, c.id);
  assert.ok(r.ref, "应返回落仓后的参考图引用");
  assert.equal(r.affected, 1);
  assert.equal(c.refImages.length, 1);
  assert.equal(shot.stale, true, "换了参考图，相关分镜应标记需重绘");
  const body = JSON.parse(sandbox.__calls[0].opts.body);
  assert.match(body.prompt, /角色定妆图/);
  assert.match(body.prompt, /长发红裙/);
  assert.equal(body.size, "1728x2304", "定妆图采用 3:4");
});

test("角色定妆图：没写外观时拒绝生成", async () => {
  const { D } = createDrama();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  const p = D.project.blank({});
  const c = D.project.addCharacter(p, "小美");
  await assert.rejects(() => D.character.generateSheet(p, c.id), (e) => e.code === "CHAR_INCOMPLETE");
});

test("角色库：细分外观随卡存取并被导入", async () => {
  const { D } = createDrama();
  const rec = D.character.libSave({ name: "小美", appearance: "清冷", details: { hair: "黑色短发", eyes: "深棕" } });
  assert.equal(rec.details.hair, "黑色短发");
  const p = D.project.blank({});
  const c = await D.character.libToProject(p, rec);
  assert.equal(c.details.hair, "黑色短发");
  assert.equal(c.details.eyes, "深棕");
});

test("外观细分组件：输出带 data-cd 的输入框并回填", () => {
  const { D } = createDrama();
  const c = D.project.newCharacter("小美");
  c.details = { outfit: "黑色高领毛衣" };
  const html = D.ui.charDetails(c);
  assert.match(html, /data-cd="age"/);
  assert.match(html, /data-cd="outfit"/);
  assert.match(html, /data-cid="/);
  assert.match(html, /value="黑色高领毛衣"/);
  assert.match(html, /年龄/);
});

/* ============ 共用合规/角色库组件 ============ */

test("共用合规组件：按前缀生成授权表单与检查入口", () => {
  const { D } = createDrama();
  const p = D.project.blank({ genre: "realistic" });
  const manual = D.ui.complianceCard(p, { prefix: "dw" });
  assert.match(manual, /id="dwAigc"/);
  assert.match(manual, /id="dwConsentForm"/);
  assert.match(manual, /id="dwConsentSave"/);
  assert.match(manual, /data-act="checkcompliance"/);
  assert.match(manual, /data-act="addconsent"/);
  const auto = D.ui.complianceCard(p, { prefix: "au" });
  assert.match(auto, /id="auAigc"/);
  assert.match(auto, /id="auConsentForm"/);
  assert.ok(!/id="dwAigc"/.test(auto), "另一套前缀不应混入");
  assert.equal(typeof D.ui.bindCompliance, "function");
  assert.equal(typeof D.ui.bindLib, "function");
  assert.equal(typeof D.ui.libPanel, "function");
});

test("角色库面板：列出已存角色并带加入与删除入口", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  assert.match(D.ui.libPanel(p, { prefix: "dw" }), /id="dwLibPanel"/);
  D.character.libSave({ name: "阿强", identity: "反派", appearance: "寸头" });
  const html = D.ui.libPanel(p, { prefix: "au" });
  assert.match(html, /id="auLibPanel"/);
  assert.match(html, /阿强/);
  assert.match(html, /反派/);
  assert.match(html, /data-act="libadd"/);
  assert.match(html, /data-act="libdel"/);
});

test("两个工作台都复用共用组件，半自动台不再用 prompt 收集授权", () => {
  const manual = dramaSrc("manual.js");
  assert.match(manual, /D\.ui\.complianceCard\(p, \{ prefix: "dw" \}\)/);
  assert.match(manual, /D\.ui\.bindLib\(v, state\.project/);
  assert.ok(!/id="dwCheck2"/.test(manual), "手搓台不应再保留内联授权区");
  assert.ok(!/function complianceCard/.test(manual), "授权区已抽到 ui.js 共用");

  const auto = dramaSrc("auto.js");
  assert.match(auto, /D\.ui\.complianceCard\(p, \{ prefix: "au" \}\)/);
  assert.match(auto, /D\.ui\.bindCompliance\(/);
  assert.match(auto, /D\.ui\.bindLib\(v, p/);
  assert.ok(!/prompt\(/.test(auto), "终审不应再用 prompt() 收集授权");
});

/* ============ 题材模板 ============ */

test("题材模板：list/get 返回副本，get 未知 id 返回 null", () => {
  const { D } = createDrama();
  const list = D.templates.list();
  assert.ok(list.length >= 4);
  const first = list[0];
  first.name = "改坏了";
  assert.notEqual(D.templates.list()[0].name, "改坏了", "list 返回的是副本");
  assert.equal(D.templates.get("不存在的模板"), null);
});

test("题材模板：apply 一次性铺好剧本、角色与分镜", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  const tpl = D.templates.get("tpl-counterattack");
  D.templates.apply(p, tpl);
  assert.equal(p.templateId, "tpl-counterattack");
  assert.equal(p.genre, "comic");
  assert.equal(p.engine, "image");
  assert.equal(p.style, "cn-manhua");
  assert.match(p.script.logline, /隐形富豪|商业巨鳄/);
  assert.equal(p.characters.length, tpl.characters.length);
  assert.equal(p.shots.length, tpl.shots.length);
  assert.ok(p.characters[0].id, "角色已生成 id");
  assert.deepEqual(p.shots[0].roleIds, [p.characters[0].id], "默认把主角挂到每一镜");
  assert.ok(p.shots[0].prompt.includes(tpl.shots[0].prompt), "提示词并入画风前缀");
  assert.ok(D.MOTIONS.some(m => m.id === p.shots[0].motion), "运镜合法");
});

test("题材模板：古风复仇的运镜不再是空串", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.templates.apply(p, D.templates.get("tpl-revenge"));
  p.shots.forEach(s => assert.ok(s.motion && s.motion !== "", "第 " + s.seq + " 镜有运镜"));
  const evidence = p.shots.find(s => s.name === "证据惊朝");
  assert.equal(evidence.motion, "pan-right");
});

/* ============ 工程迁移 / 封面 / 复制 ============ */

test("project.migrate：补齐旧工程缺失字段且幂等", () => {
  const { D } = createDrama();
  const old = { id: "old1", source: "auto", shots: [{ prompt: "p", duration: 0 }] };
  D.project.migrate(old);
  assert.equal(old.mode, "pipeline", "按 source 推断工作台");
  assert.equal(old.templateId, "");
  assert.equal(old.thumb, "");
  assert.equal(old.shots[0].audioDuration, 0);
  assert.equal(old.shots[0].duration, 5, "非法时长回落到 5");
  assert.equal(old.shots[0].status, "pending");
  assert.ok(old.shots[0].id, "分镜补上 id");
  assert.ok(Array.isArray(old.compliance.consentIds));
  const snap = JSON.stringify(old);
  D.project.migrate(old);
  assert.equal(JSON.stringify(old), snap, "二次迁移幂等");
});

test("project.migrate：保留未知字段", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.futureField = { a: 1 };
  D.project.migrate(p);
  assert.deepEqual(p.futureField, { a: 1 });
});

test("project.cover：取第一张可用画面，优先成片与视频", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots[0].imageUrl = "img1";
  assert.equal(D.project.cover(p), "img1");
  p.shots[0].videoUrl = "vid1";
  assert.equal(D.project.cover(p), "vid1");
  p.shots[0].lipsyncUrl = "lip1";
  assert.equal(D.project.cover(p), "lip1");
  assert.equal(D.project.cover(D.project.blank({})), "");
});

test("project.duplicate：生成独立副本", async () => {
  const { D } = createDrama();
  const p = D.project.blank({ title: "原剧" });
  p.shots[0].prompt = "原提示词";
  await D.project.save(p);
  const copy = await D.project.duplicate(p.id);
  assert.notEqual(copy.id, p.id);
  assert.match(copy.title, /原剧 · 副本/);
  copy.shots[0].prompt = "改副本";
  assert.equal(D.project.get(p.id).shots[0].prompt, "原提示词", "副本改动不影响原工程");
});

/* ============ 三轨时间轴 ============ */

test("timeline：总时长按分镜时长累加", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots = [
    { id: "a", seq: 1, duration: 5, status: "done" },
    { id: "b", seq: 2, duration: 4, status: "pending" }
  ];
  assert.equal(D.timeline.total(p), 9);
  const segs = D.timeline.layout(p);
  assert.deepEqual(segs.map(s => [s.sid, s.start, s.end]), [["a", 0, 5], ["b", 5, 9]]);
});

test("timeline.shotAt：定位归属并夹紧越界", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots = [
    { id: "a", seq: 1, duration: 5, status: "done" },
    { id: "b", seq: 2, duration: 4, status: "done" }
  ];
  assert.equal(D.timeline.shotAt(p, 0).sid, "a");
  assert.equal(D.timeline.shotAt(p, 4.99).sid, "a");
  assert.equal(D.timeline.shotAt(p, 5).sid, "b", "区间左闭右开");
  assert.equal(D.timeline.shotAt(p, 999).sid, "b", "超尾夹到末镜");
  assert.equal(D.timeline.shotAt(p, -3).sid, "a", "负值夹到首镜");
  assert.equal(D.timeline.shotAt({ shots: [] }, 1), null);
});

test("timeline.frameStep：按帧率步进且不越过 0", () => {
  const { D } = createDrama();
  assert.ok(Math.abs(D.timeline.frameStep(1, 1, 30) - (1 + 1 / 30)) < 1e-9);
  assert.ok(Math.abs(D.timeline.frameStep(1 / 30, -1, 30)) < 1e-9);
  assert.equal(D.timeline.frameStep(0, -1, 30), 0);
  assert.ok(Math.abs(D.timeline.frameStep(0.5, 1) - (0.5 + 1 / 30)) < 1e-9, "缺省 30fps");
});

test("timeline.fmt：秒数格式化为 mm:ss", () => {
  const { D } = createDrama();
  assert.equal(D.timeline.fmt(0), "00:00");
  assert.equal(D.timeline.fmt(9.6), "00:10");
  assert.equal(D.timeline.fmt(65), "01:05");
  assert.equal(D.timeline.fmt(-5), "00:00");
});

test("timeline.render：三轨带时长与当前镜高亮", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots = [
    { id: "a", seq: 1, duration: 5, status: "done", line: "台词", audioUrl: "a.mp3" },
    { id: "b", seq: 2, duration: 5, status: "pending" }
  ];
  const html = D.timeline.render(p, { currentShotId: "b" });
  assert.match(html, /data-track="video"/);
  assert.match(html, /data-track="audio"/);
  assert.match(html, /data-track="subtitle"/);
  assert.match(html, /总时长 00:10/);
  assert.match(html, /dw-clip on[^"]*"[^>]*data-sid="b"/, "当前镜高亮");
  assert.match(html, /共 2 镜/);
});

test("takes.sync：复用既有段对象，保持对象身份稳定", () => {
  const { D } = createDrama();
  const p = D.project.blank({ title: "t", genre: "comic", engine: "video", shotMode: "take" });
  p.engine = "video";
  p.takeTarget = 10;
  p.shots = [1, 2].map(i => {
    const s = D.project.newShot(i);
    s.duration = 5;
    return s;
  });
  D.project.renumber(p);
  D.takes.sync(p);
  const first = p.takes[0];
  first.videoUrl = "u.mp4";
  first.status = "done";
  D.takes.sync(p);
  assert.equal(p.takes[0], first, "sync 不应替换既有段对象");
  assert.equal(p.takes[0].videoUrl, "u.mp4", "sync 应保留段素材");
  assert.equal(p.takes[0].status, "done");
});

test("takes.sync：新增分镜后旧段素材不丢失", () => {
  const { D } = createDrama();
  const p = D.project.blank({ title: "t", genre: "comic", engine: "video", shotMode: "take" });
  p.engine = "video";
  p.takeTarget = 10;
  p.shots = [1, 2].map(i => {
    const s = D.project.newShot(i);
    s.duration = 5;
    return s;
  });
  D.project.renumber(p);
  D.takes.sync(p);
  p.takes[0].videoUrl = "old.mp4";
  p.takes[0].status = "done";
  const s3 = D.project.addShot(p, 3);
  s3.duration = 5;
  D.takes.sync(p);
  assert.equal(p.takes[0].videoUrl, "old.mp4", "同签名段应保留素材");
  assert.equal(p.takes[1].videoUrl, "");
});

test("整段生成后段状态回填到工程且可直接导出", async () => {
  const { D } = createDrama();
  D.project.cacheRemote = async (url) => url;
  D.adapters.video.generate = async () => ({ url: "https://example.com/take.mp4" });
  const p = D.project.blank({ title: "t", genre: "comic", engine: "video", shotMode: "take" });
  p.engine = "video";
  p.takeTarget = 10;
  p.shots = [1, 2].map(i => {
    const s = D.project.newShot(i);
    s.duration = 5;
    return s;
  });
  D.project.renumber(p);
  D.takes.sync(p);
  const takeId = p.takes[0].id;
  await D.engine.generateTake(p, takeId, {});
  const live = p.takes.find(t => t.id === takeId);
  assert.equal(live.videoUrl, "https://example.com/take.mp4", "生成结果应写回工程内的段");
  assert.equal(live.status, "done");
  assert.equal(live.dirty, false);
  assert.deepEqual(D.compose.missingTakes(p), []);
  p.shots.forEach(s => {
    assert.equal(s.videoUrl, "https://example.com/take.mp4");
    assert.equal(typeof s.srcStart, "number");
    assert.equal(typeof s.srcEnd, "number");
  });
});

test("整段生成后保存草稿仍保留段素材", async () => {
  const { D } = createDrama();
  D.project.cacheRemote = async (url) => url;
  D.adapters.video.generate = async () => ({ url: "https://example.com/take.mp4" });
  const p = D.project.blank({ title: "t", genre: "comic", engine: "video", shotMode: "take" });
  p.engine = "video";
  p.takeTarget = 10;
  p.shots = [1, 2].map(i => {
    const s = D.project.newShot(i);
    s.duration = 5;
    return s;
  });
  D.project.renumber(p);
  D.takes.sync(p);
  await D.engine.generateTake(p, p.takes[0].id, {});
  await D.project.save(p);
  assert.equal(p.takes[0].videoUrl, "https://example.com/take.mp4");
  assert.equal(p.takes[0].status, "done");
});

test("段内裁剪：trimOf 归一化边界，effDuration 反映裁剪后时长", () => {
  const { D } = createDrama();
  const s = D.project.newShot(1);
  s.duration = 6;
  assert.deepEqual(D.project.trimOf(s), { in: 0, out: 0, on: false }, "默认不裁剪");
  assert.equal(D.project.effDuration(s), 6);

  s.trimIn = 1;
  s.trimOut = 4;
  assert.deepEqual(D.project.trimOf(s), { in: 1, out: 4, on: true });
  assert.equal(D.project.effDuration(s), 3);

  s.trimIn = 2;
  s.trimOut = 2.2;
  const c = D.project.trimOf(s);
  assert.equal(c.on, true, "窗口不足下限时向后撑到最小窗");
  assert.ok(Math.abs((c.out - c.in) - D.project.TRIM_MIN) < 1e-9);

  s.trimIn = -3;
  s.trimOut = 99;
  const t = D.project.trimOf(s);
  assert.equal(t.on, false, "覆盖整段且负起点夹 0 后视为不裁剪");
  assert.equal(D.project.effDuration(s), 6);
});

test("timeline：裁剪后段长与总时长按有效时长计算", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots = [
    { id: "a", seq: 1, duration: 6, status: "done", trimIn: 1, trimOut: 4 },
    { id: "b", seq: 2, duration: 4, status: "done" }
  ];
  assert.equal(D.timeline.total(p), 7);
  const segs = D.timeline.layout(p);
  assert.deepEqual(segs.map(s => [s.sid, s.start, s.end]), [["a", 0, 3], ["b", 3, 7]]);
  assert.equal(segs[0].trimmed, true);
  assert.equal(segs[0].footage, 6);

  const html = D.timeline.render(p, { currentShotId: "a" });
  assert.match(html, /dw-clip on[^"]*trimmed/, "裁剪片段带 trimmed 标记");
});

test("合成：resolveShots 把裁剪换算成片段源窗口", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots = [
    { id: "a", seq: 1, duration: 6, status: "done", videoUrl: "a.mp4", trimIn: 1, trimOut: 4 },
    { id: "b", seq: 2, duration: 4, status: "done", videoUrl: "b.mp4" }
  ];
  const out = D.compose.resolveShots(p);
  assert.equal(out[0].srcStart, 1);
  assert.equal(out[0].srcEnd, 4);
  assert.equal(out[1].srcStart, undefined, "未裁剪不写源窗口");
});

test("合成：srt 按裁剪后时长推进时间轴", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  p.shots = [
    { id: "a", seq: 1, duration: 6, status: "done", line: "第一句", trimIn: 1, trimOut: 3 },
    { id: "b", seq: 2, duration: 4, status: "done", line: "第二句" }
  ];
  const srt = D.compose.srt(p);
  assert.match(srt, /00:00:00,000 --> 00:00:02,000/, "首镜按裁剪后 2 秒");
  assert.match(srt, /00:00:02,000 --> 00:00:06,000/, "次镜顺延到 2s 起");
});

test("配乐与字幕：默认开启字幕且可在工程里改样式与 BGM", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  assert.equal(p.subtitle.enabled, true);
  assert.equal(p.subtitle.bilingual, false, "默认关闭双语");
  assert.equal(p.subtitle.color, "#ffffff");
  assert.equal(p.bgm, "");
  p.subtitle.enabled = false;
  p.subtitle.color = "#ffcc00";
  p.bgm = "asset:bgm1";
  D.project.migrate(p);
  assert.equal(p.subtitle.color, "#ffcc00", "migrate 保留字幕样式");
  assert.equal(p.subtitle.bilingual, false, "migrate 补双语开关");
  assert.equal(p.bgm, "asset:bgm1", "migrate 保留 BGM 引用");
});
