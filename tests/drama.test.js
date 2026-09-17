/* AI 短剧工作台 · 前端逻辑测试
 * 运行：node --test tests/
 * 覆盖：角色提示词、适配器请求构造与响应解析、剧种引擎、工程模型、合规校验、合成导出。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { createDrama, mockJson, setAdapter } = require("./drama-harness.js");

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
  setAdapter(D, "lipsync", { provider: "volc-koubo", base: "https://ls.test", key: "k" });
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
  assert.equal(shot.videoUrl, "https://cdn/v.mp4");
  assert.match(shot.audioUrl, /^blob:/);
  assert.equal(shot.lipsyncUrl, "https://cdn/out.mp4");
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
