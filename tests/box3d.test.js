/* AI 短剧工作台 · 3D-BOX 导演工具测试
 * 运行：node --test tests/box3d.test.js
 * 覆盖：五工具与预设、统一取景接口与实现注册、本镜记录归一化、提示词与主体参考、
 *       9 宫格/灯光/运镜生成落库、精准编辑闸门、并行按序返回、挂载。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama, mockJson, setAdapter } = require("./drama-harness.js");

function ready() {
  const { D, sandbox } = createDrama();
  const p = D.project.blank({});
  return { D, sandbox, p, shot: p.shots[0] };
}

test("五工具与预设：9 宫格、运镜、灯光、角度均可用", () => {
  const { D } = createDrama();
  assert.equal(D.box3d.TOOLS.length, 5);
  assert.deepEqual(D.box3d.TOOLS.map(t => t.id), ["grid", "move", "light", "angle", "edit"]);
  assert.equal(D.box3d.GRID.length, 9, "景别 × 机位 = 9");
  assert.equal(D.box3d.SCALES.length, 3);
  assert.equal(D.box3d.CAMERAS.length, 3);
  assert.ok(D.box3d.MOVES.length >= 8);
  assert.ok(D.box3d.LIGHTS.length >= 8);
  assert.ok(D.box3d.ANGLES.length >= 4);
});

test("统一取景接口：任意机位/运镜/角度都是同一种 spec 结构", () => {
  const { D } = createDrama();
  const a = D.box3d.spec("camera", D.box3d.GRID[0]);
  const b = D.box3d.spec("move", D.box3d.MOVES[0]);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  ["kind", "id", "name", "prompt"].forEach(k => assert.ok(k in a, "spec 含 " + k));
  assert.equal(a.kind, "camera");
  assert.equal(b.kind, "move");
});

test("取景方案编译：9 宫格全出，运镜/灯光各 1，角度按需子集", () => {
  const { D } = createDrama();
  assert.equal(D.box3d.specsFor("grid").length, 9);
  assert.equal(D.box3d.specsFor("move", { id: "orbit" }).length, 1);
  assert.equal(D.box3d.specsFor("move", { id: "orbit" })[0].id, "orbit");
  assert.equal(D.box3d.specsFor("light", { id: "neon" })[0].id, "neon");
  const ang = D.box3d.specsFor("angle", { angles: ["front", "side"] });
  assert.equal(ang.length, 2);
  assert.deepEqual(ang.map(x => x.id), ["front", "side"]);
});

test("可插拔实现：注册新取景实现后 render 走新实现", async () => {
  const { D, p, shot } = ready();
  D.box3d.register("engine", { id: "engine", label: "真 3D", render: async (proj, s, sp) => ({ url: "asset:3d/" + sp.id, media: "image" }) });
  D.box3d.setProvider("engine");
  assert.equal(D.box3d.currentProvider().id, "engine");
  const r = await D.box3d.render(p, shot, D.box3d.spec("camera", D.box3d.GRID[0]));
  assert.equal(r.url, "asset:3d/wide-eye");
  D.box3d.setProvider("ai");
  assert.equal(D.box3d.currentProvider().id, "ai");
});

test("本镜记录归一化：缺字段补齐、幂等", () => {
  const { D } = createDrama();
  const shot = {};
  const b = D.box3d.ensure(shot);
  assert.ok(b && Array.isArray(b.grid) && Array.isArray(b.angle));
  assert.equal(b.move.url, "");
  assert.equal(b.edit.instruction, "");
  D.box3d.ensure(shot);
  assert.equal(shot.box3d, b, "再次调用返回同一对象");
});

test("提示词与主体参考：拼上取景提示，参考图最多 3 张且首帧优先", () => {
  const { D, p, shot } = ready();
  shot.prompt = "雨夜街头";
  const sp = D.box3d.spec("camera", D.box3d.GRID[0]);
  const prompt = D.box3d.promptFor(p, shot, sp);
  assert.ok(prompt.includes("雨夜街头"), "含本镜提示词");
  assert.ok(prompt.includes(D.box3d.GRID[0].prompt), "含取景提示");

  shot.firstFrame = "https://cdn/frame.png";
  const c1 = D.project.newCharacter("甲");
  c1.refImages = ["https://cdn/a.png", "https://cdn/a2.png"];
  const c2 = D.project.newCharacter("乙");
  c2.refImages = ["https://cdn/b.png", "https://cdn/b2.png"];
  p.characters = [c1, c2];
  shot.roleIds = [c1.id, c2.id];
  const refs = D.box3d.refImagesFor(p, shot);
  assert.equal(refs.length, 3);
  assert.equal(refs[0], "https://cdn/frame.png", "首帧优先");
});

test("9 宫格生成：并行出 9 格并转存本地资源仓", async () => {
  const { D, sandbox, p, shot } = ready();
  setAdapter(D, "image", { provider: "custom-image", base: "https://img.test", key: "k" });
  mockJson(sandbox, { data: [{ url: "https://cdn/cell.png" }] });
  const res = await D.box3d.runTool(p, shot, "grid", {});
  assert.equal(res.length, 9);
  assert.equal(shot.box3d.grid.length, 9);
  assert.ok(shot.box3d.grid.every(c => /^asset:/.test(c.url)), "每格都转存本地");
  assert.ok(shot.box3d.updatedAt > 0);
});

test("灯光生成：单值落库，记录所选方案", async () => {
  const { D, sandbox, p, shot } = ready();
  setAdapter(D, "image", { provider: "custom-image", base: "https://img.test", key: "k" });
  mockJson(sandbox, { data: [{ url: "https://cdn/light.png" }] });
  await D.box3d.runTool(p, shot, "light", { id: "neon" });
  assert.equal(shot.box3d.light.id, "neon");
  assert.ok(/^asset:/.test(shot.box3d.light.url));
});

test("运镜生成：视频任务式协议，落库到 move", async () => {
  const { D, sandbox, p, shot } = ready();
  setAdapter(D, "video", { provider: "seedance", base: "https://ark.test", key: "k", model: "seedance-2.5" });
  mockJson(sandbox, (url, opts) => ((opts && opts.method) === "POST"
    ? { id: "job-1" }
    : { status: "succeeded", content: { video_url: "https://cdn/move.mp4" } }));
  await D.box3d.runTool(p, shot, "move", { id: "orbit" });
  assert.equal(shot.box3d.move.id, "orbit");
  assert.ok(/^asset:r/.test(shot.box3d.move.url), "视频转存本地资源仓");
});

test("精准编辑：非 Seedance 2.x、无素材、正常三条路径", async () => {
  const { D, sandbox, p, shot } = ready();
  setAdapter(D, "video", { provider: "seedance", base: "https://ark.test", key: "k", model: "seedance-1.0" });
  await assert.rejects(() => D.box3d.runEdit(p, shot, { instruction: "换红衣服" }), /Seedance 2/);

  setAdapter(D, "video", { provider: "seedance", base: "https://ark.test", key: "k", model: "seedance-2.5" });
  await assert.rejects(() => D.box3d.runEdit(p, shot, { instruction: "换红衣服" }), /还没有视频素材/);

  shot.videoUrl = "https://cdn/existing.mp4";
  mockJson(sandbox, (url, opts) => ((opts && opts.method) === "POST"
    ? { id: "job-2" }
    : { status: "succeeded", content: { video_url: "https://cdn/edited.mp4" } }));
  await D.box3d.runEdit(p, shot, { instruction: "换红衣服" });
  assert.equal(shot.box3d.edit.instruction, "换红衣服");
  assert.ok(/^asset:r/.test(shot.box3d.edit.url));
});

test("并行执行按传入顺序返回，失败项记 error 不阻断", async () => {
  const { D, p, shot } = ready();
  D.box3d.register("order", {
    id: "order",
    render: async (proj, s, sp) => {
      if (sp.id === "wide-high") throw D.err("BOOM", "故意失败");
      return { url: "asset:" + sp.id, media: "image" };
    }
  });
  D.box3d.setProvider("order");
  const specs = D.box3d.GRID.slice(0, 3).map(g => D.box3d.spec("camera", g));
  const out = await D.box3d.run(p, shot, specs, { concurrency: 2 });
  D.box3d.setProvider("ai");
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(r => r.spec.id), specs.map(s => s.id), "顺序与传入一致");
  const bad = out.find(r => r.spec.id === "wide-high");
  assert.ok(bad.error, "失败项带 error");
  assert.equal(bad.url, "");
});

test("挂载面板返回句柄且不报错", () => {
  const { D, sandbox, p } = ready();
  const el = sandbox.document.createElement("div");
  const handle = D.box3d.mount(el, p, { onChange: () => {} });
  assert.ok(handle && typeof handle.refresh === "function");
  assert.ok(typeof handle.setShot === "function");
  assert.ok(typeof handle.setTool === "function");
});

/* ---------------- 真 3D 视口（box3dscene 纯逻辑 + real3d 实现） ---------------- */

test("真 3D 视口纯逻辑：机位/角度位姿、灯光预设、轨迹提示与可播放判定", () => {
  const { D } = createDrama();
  const s = D.box3dscene;
  assert.ok(s, "box3dscene 已加载");

  const wide = s.poseFor("wide", "eye");
  assert.deepEqual(wide.pos, [0, 1.4, 8.4], "全景平视距离最远");
  const high = s.poseFor("close", "high");
  assert.ok(high.pos[1] > high.pos[2], "俯拍机位更高");
  const low = s.poseFor("medium", "low");
  assert.equal(low.pos[1], 0.42, "仰拍贴地");

  assert.deepEqual(s.anglePoseFor("front").pos, [0, 1.4, 4.6]);
  assert.deepEqual(s.anglePoseFor("side").pos, [4.6, 1.4, 0]);
  assert.deepEqual(s.anglePoseFor("back").pos, [0, 1.6, -4.6]);
  const top = s.anglePoseFor("top");
  assert.equal(top.pos[0], 0);
  assert.ok(top.pos[1] > top.pos[2], "俯视机位在高处");
  assert.deepEqual(s.anglePoseFor("不存在").pos, [0, 1.4, 4.6], "未知角度退回正面");

  assert.equal(s.lightPreset("neon").key.color, 0xff3d8b);
  assert.equal(s.lightPreset("nope").key.color, 0xffffff, "未知灯光退回三点布光");
  assert.equal(s.FOV, 45);

  assert.equal(s.playable([[0, 0, 0]]), false);
  assert.equal(s.playable([[0, 0, 0], [1, 0, 1]]), true);
  assert.equal(s.pathPrompt([[0, 0, 0]]), "", "不足两点没有运镜描述");
  assert.ok(/推进/.test(s.pathPrompt([[0, 1.4, 4], [0, 1.4, 1]])), "识别向前推进");
  assert.ok(/上升/.test(s.pathPrompt([[0, 1, 2], [0, 3, 2]])), "识别镜头上升");

  assert.deepEqual(s.vec3([1, 2, 3]), [1, 2, 3]);
  assert.equal(s.vec3([1, 2]), null);
  assert.equal(s.vec3(["x", 2, 3]), null);
});

test("真 3D 在无 WebGL 环境优雅降级：supported=false，未就绪时 render 报错", async () => {
  const { D, p, shot } = ready();
  assert.equal(D.box3dscene.supported(), false, "测试台无 WebGL");
  assert.equal(D.box3dscene.providerReady(), false);

  D.box3d.setProvider("real3d");
  assert.equal(D.box3d.currentProvider().id, "real3d", "real3d 已注册");
  await assert.rejects(
    () => D.box3d.render(p, shot, D.box3d.spec("camera", D.box3d.GRID[0])),
    /视口未就绪/
  );
  D.box3d.setProvider("ai");
  assert.equal(D.box3d.currentProvider().id, "ai");
});

test("取景接口支持按次指定实现，且不改动全局实现", async () => {
  const { D, p, shot } = ready();
  D.box3d.register("fake3d", { id: "fake3d", label: "假 3D", render: async (proj, s, sp) => ({ url: "asset:fake/" + sp.id, media: "image" }) });
  const r = await D.box3d.render(p, shot, D.box3d.spec("camera", D.box3d.GRID[0]), { provider: "fake3d" });
  assert.equal(r.url, "asset:fake/wide-eye");
  assert.equal(D.box3d.currentProvider().id, "ai", "全局实现仍是 AI");
});

test("工具运行按 provider 走指定实现并落库", async () => {
  const { D, p, shot } = ready();
  D.box3d.register("fake3d", { id: "fake3d", label: "假 3D", render: async (proj, s, sp) => ({ url: "asset:fake/" + sp.id, media: "image" }) });
  const res = await D.box3d.runTool(p, shot, "grid", { provider: "fake3d" });
  assert.equal(res.length, 9);
  assert.equal(shot.box3d.grid.length, 9);
  assert.ok(shot.box3d.grid.every(c => /^asset:fake\//.test(c.url)), "九格均来自指定实现");
});

test("3D-BOX 面板：asset 结果用 data-ref 占位待水合，http 结果直接给 src", () => {
  const { D, sandbox, p, shot } = ready();
  shot.box3d.grid = [{ id: "wide-eye", name: "全景 · 平视", url: "asset:x1", error: "" }];
  shot.box3d.light = { id: "neon", name: "霓虹", url: "https://cdn/l.png", error: "" };
  const gridEl = sandbox.document.createElement("div");
  D.box3d.mount(gridEl, p, { shotId: shot.id, tool: "grid" });
  assert.ok(gridEl.innerHTML.includes('data-ref="asset:x1"'), "asset 结果带 data-ref 便于水合");
  const lightEl = sandbox.document.createElement("div");
  D.box3d.mount(lightEl, p, { shotId: shot.id, tool: "light" });
  assert.ok(lightEl.innerHTML.includes('src="https://cdn/l.png"'), "http 结果直接给 src");
  assert.ok(!/data-ref="https:\/\/cdn\/l\.png"/.test(lightEl.innerHTML), "http 结果不需要水合");
});

test("3D-BOX 独立页：默认 AI 实现，无 WebGL 时视口分支关闭", () => {
  const { D, p } = ready();
  assert.equal(D.box3dview.state.impl, "ai");
  assert.equal(D.box3dview.sceneReady(), false);
  const html = D.box3dview.implSwitchHtml();
  assert.ok(html.includes('data-bv-impl="ai"'), "提供 AI 取景切换项");
  assert.ok(html.includes('data-bv-impl="real3d"'), "提供真 3D 视口切换项");
  assert.ok(/data-bv-impl="real3d"[^>]*disabled/.test(html), "无 WebGL 时真 3D 项禁用");
  assert.equal(D.box3dview.currentShot(p).id, p.shots[0].id, "默认取第一镜");
  assert.doesNotThrow(() => D.box3dview.mountScene(p), "无 WebGL 时 mountScene 安全跳过");
  assert.equal(typeof D.box3dview.render, "function");
});
