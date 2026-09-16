/* AI 短剧工作台 · 前端逻辑测试
 * 运行：node --test tests/
 * 覆盖：角色提示词、适配器请求构造与响应解析、剧种引擎、工程模型、合规校验、合成导出。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama, mockJson, setAdapter } = require("./drama-harness.js");

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
  assert.equal(body.model, "doubao-seedream-5-0-260128");
  assert.equal(body.size, "768x1344");
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

test("语音适配器 volc 请求体与 base64 解析", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "tts", { provider: "volc", appId: "app", key: "tok", cluster: "volcano_tts", voice: "BV1" });
  mockJson(sandbox, { data: "QUJD" });
  const r = await D.adapters.tts.synth({ text: "你好", voice: "BV1", speed: 1, pitch: 1 });
  assert.match(r.url, /^blob:/);
  const body = JSON.parse(sandbox.__calls[0].opts.body);
  assert.equal(body.app.appid, "app");
  assert.equal(body.app.token, "tok");
  assert.equal(body.audio.voice_type, "BV1");
  assert.equal(body.request.text, "你好");
  assert.equal(sandbox.__calls[0].opts.headers.Authorization, "Bearer;tok");
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
  assert.equal(body.model, "doubao-seedance-2-0-mini-260615");

  mockJson(sandbox, { status: "succeeded", content: { video_url: "https://cdn/v.mp4" } });
  const st = await D.adapters.video.poll("task-1");
  assert.equal(st.status, "done");
  assert.equal(st.url, "https://cdn/v.mp4");
});

test("口型适配器创建与轮询状态映射", async () => {
  const { D, sandbox } = createDrama();
  setAdapter(D, "lipsync", { provider: "volc-koubo", base: "https://ls.example.com", key: "k" });
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
  assert.equal(shot.imageUrl, "https://cdn/shot1.png");
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
