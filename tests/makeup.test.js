/* AI 短剧工作台 · 造型室测试
 * 运行：node --test tests/model-pool.test.js tests/makeup.test.js
 * 覆盖：目录常量、三视图/场景卡提示词、多参考合并上限、旧工程迁移、出图落库。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama, mockJson, setAdapter } = require("./drama-harness.js");

function ready() {
  const { D, sandbox } = createDrama();
  const p = D.project.blank({});
  p.style = "cn-manhua";
  const c = D.project.addCharacter(p, "小美");
  c.identity = "落魄千金";
  c.appearance = "长发，红裙，眼神倔强";
  D.makeup.state.project = p;
  D.makeup.state.pid = p.id;
  return { D, sandbox, p, c };
}

test("造型室目录：四个分类、三种视图、上限 3 张", () => {
  const { D } = createDrama();
  assert.deepEqual(D.makeup.TABS.map(t => t.id), ["views", "refs", "scenes", "style"]);
  assert.deepEqual(D.makeup.TABS.map(t => t.name), ["角色", "主体", "场景", "风格"], "分类对齐 LibTV");
  assert.deepEqual(D.makeup.VIEW_ORDER.map(v => v.id), ["front", "side", "back"]);
  assert.equal(D.makeup.MAX_REFS, 3);
});

test("三视图提示词含画风、角色与朝向", () => {
  const { D, p, c } = ready();
  const front = D.makeup.viewPrompt(p, c, "front");
  assert.match(front, /三视图/);
  assert.match(front, /小美/);
  assert.match(front, /正面/);
  const side = D.makeup.viewPrompt(p, c, "side");
  assert.match(side, /侧面/);
  const back = D.makeup.viewPrompt(p, c, "back");
  assert.match(back, /背面/);
});

test("场景卡提示词含场景身份锚点与描述，且不含人物", () => {
  const { D, p } = ready();
  const sc = D.makeup.addScene();
  sc.name = "老宅客厅";
  sc.desc = "民国年间，红木家具，午后斜光";
  const pr = D.makeup.scenePrompt(p, sc);
  assert.match(pr, /场景身份锚点/);
  assert.match(pr, /老宅客厅/);
  assert.match(pr, /民国年间/);
  assert.match(pr, /无人物/);
});

test("场景卡增删：id 唯一、默认名递增", () => {
  const { D, p } = ready();
  assert.equal(p.scenes.length, 0);
  const a = D.makeup.addScene();
  const b = D.makeup.addScene();
  assert.equal(p.scenes.length, 2);
  assert.notEqual(a.id, b.id);
  assert.equal(a.name, "场景 1");
  assert.equal(b.name, "场景 2");
  D.makeup.removeScene(a.id);
  assert.equal(p.scenes.length, 1);
  assert.equal(p.scenes[0].id, b.id);
});

test("多参考合并：角色轮询优先，额外参考补位，整体不超 3", () => {
  const { D, p, c } = ready();
  const shot = p.shots[0];
  shot.roleIds = [c.id];
  c.refImages = ["a1", "a2", "a3", "a4"];
  assert.deepEqual(D.makeup.refsForShot(p, shot), ["a1", "a2", "a3"]);

  const { D: D2, p: p2, c: c2 } = ready();
  const s2 = p2.shots[0];
  s2.roleIds = [c2.id];
  c2.refImages = ["b1"];
  s2.extraRefs = ["x1", "x2", "x3", "x4"];
  assert.deepEqual(D2.makeup.refsForShot(p2, s2), ["b1", "x1", "x2"]);

  const { D: D3, p: p3 } = ready();
  const s3 = p3.shots[0];
  s3.extraRefs = ["x1", "x2", "x3", "x4"];
  assert.deepEqual(D3.makeup.refsForShot(p3, s3), ["x1", "x2", "x3"]);
});

test("旧工程迁移补齐 views / scenes / extraRefs 并夹紧上限", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  delete p.scenes;
  p.characters = [{ id: "c1", name: "A" }];
  p.shots = [{ id: "s1", seq: 1, extraRefs: ["1", "2", "3", "4", "5"] }];
  D.project.migrate(p);
  assert.deepEqual(p.scenes, []);
  assert.deepEqual(p.characters[0].refImages, []);
  assert.deepEqual(p.characters[0].views, { front: "", side: "", back: "", updatedAt: 0 });
  assert.deepEqual(p.shots[0].extraRefs, ["1", "2", "3"]);

  const p2 = D.project.blank({});
  p2.scenes = [{ name: "" }];
  D.project.migrate(p2);
  assert.ok(p2.scenes[0].id);
  assert.equal(p2.scenes[0].name, "场景 1");
  assert.equal(p2.scenes[0].anchorRef, "");
});

test("未配置生图服务时出图报错", async () => {
  const { D, c } = ready();
  await assert.rejects(() => D.makeup.generateView(c.id, "front"), /尚未配置生图服务/);
});

test("生成三视图落库，且侧面以正面为参考", async () => {
  const { D, sandbox, p, c } = ready();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  mockJson(sandbox, { data: [{ url: "https://cdn/1.png" }] });

  const ref = await D.makeup.generateView(c.id, "front");
  assert.match(ref, /^asset:/);
  assert.equal(c.views.front, ref);
  assert.ok(c.views.updatedAt > 0);

  await D.makeup.generateView(c.id, "side");
  const posts = sandbox.__calls.filter(c => c.opts && c.opts.body);
  const body = JSON.parse(posts[posts.length - 1].opts.body);
  assert.ok(body.image, "侧面应带正面图作参考");
  assert.match(body.prompt, /侧面/);
});

test("生成场景锚点图落库", async () => {
  const { D, sandbox, p } = ready();
  setAdapter(D, "image", { provider: "seedream", key: "k" });
  mockJson(sandbox, { data: [{ url: "https://cdn/scene.png" }] });
  const sc = D.makeup.addScene();
  sc.name = "天台";
  const ref = await D.makeup.generateScene(sc.id);
  assert.match(ref, /^asset:/);
  assert.equal(sc.anchorRef, ref);
});
