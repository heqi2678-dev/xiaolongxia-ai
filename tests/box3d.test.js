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
