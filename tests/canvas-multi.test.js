/* AI 短剧工作台 · 多画布测试
 * 运行：node --test tests/canvas-multi.test.js
 * 覆盖设计「Correctness Properties」2（迁移幂等不在此文件）与 3（画布隔离），
 * 以及多画布增删改切、最后一张保护、activeCanvasId 悬空回落。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama } = require("./drama-harness.js");

function ready() {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.canvas.ensure(p);
  return { D, p };
}

test("多画布：默认一张，新增自动命名并切为活动画布", () => {
  const { D, p } = ready();
  const list = D.canvas.listCanvases(p);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "画布 1");
  assert.equal(p.activeCanvasId, list[0].id);

  const b = D.canvas.addCanvas(p);
  assert.equal(b.name, "画布 2");
  assert.equal(D.canvas.listCanvases(p).length, 2);
  assert.equal(p.activeCanvasId, b.id, "新增后可继续在画布上操作");
  assert.equal(D.canvas.activeCanvas(p).id, b.id);

  const c = D.canvas.addCanvas(p, "分镜草稿");
  assert.equal(c.name, "分镜草稿");
  assert.equal(D.canvas.listCanvases(p).length, 3);
});

test("多画布：重命名与按 id 查询", () => {
  const { D, p } = ready();
  const a = D.canvas.activeCanvas(p);
  const b = D.canvas.addCanvas(p, "B");
  D.canvas.renameCanvas(p, b.id, "  改名后  ");
  assert.equal(D.canvas.canvasById(p, b.id).name, "改名后");
  D.canvas.renameCanvas(p, b.id, "   ");
  assert.equal(D.canvas.canvasById(p, b.id).name, "改名后", "空白名不覆盖");
  assert.equal(D.canvas.canvasById(p, "nope"), null);
  assert.throws(() => D.canvas.renameCanvas(p, "nope", "x"), /画布不存在/);
});

test("多画布：删除与最后一张保护", () => {
  const { D, p } = ready();
  const a = D.canvas.activeCanvas(p);
  const b = D.canvas.addCanvas(p, "B");
  assert.throws(() => D.canvas.removeCanvas(p, "nope"), /画布不存在/, "未知 id 报错");
  D.canvas.removeCanvas(p, b.id);
  assert.equal(D.canvas.listCanvases(p).length, 1);
  assert.equal(p.activeCanvasId, a.id, "删除活动画布后回落到剩余画布");

  assert.throws(() => D.canvas.removeCanvas(p, a.id), /至少保留一张画布/, "最后一张不可删");
});

test("多画布：删除活动画布后活动 id 始终有效", () => {
  const { D, p } = ready();
  const a = D.canvas.activeCanvas(p);
  const b = D.canvas.addCanvas(p, "B");
  const c = D.canvas.addCanvas(p, "C");
  D.canvas.setActiveCanvas(p, b.id);
  D.canvas.removeCanvas(p, b.id);
  assert.ok([a.id, c.id].includes(p.activeCanvasId), "活动画布必为现存画布之一");
  assert.ok(D.canvas.canvasById(p, p.activeCanvasId));
});

test("多画布：画布隔离，节点与视图互不影响", () => {
  const { D, p } = ready();
  const a = D.canvas.activeCanvas(p);
  const n1 = D.canvas.addNode(p, "image", 10, 10, { prompt: "A 的节点" });
  assert.equal(D.canvas.activeCanvas(p).nodes.length, 1);

  const b = D.canvas.addCanvas(p, "B");
  assert.equal(D.canvas.activeCanvas(p).nodes.length, 0, "新画布不含别处节点");
  const n2 = D.canvas.addNode(p, "text", 20, 20, { text: "B 的节点" });
  assert.equal(b.nodes.length, 1);

  a.view.k = 2;
  a.view.x = 33;
  D.canvas.setActiveCanvas(p, a.id);
  assert.equal(D.canvas.activeCanvas(p).view.k, 2, "切回后视图保持各自倍率");
  assert.equal(D.canvas.nodeById(p, n1.id).data.prompt, "A 的节点");
  assert.equal(D.canvas.nodeById(p, n2.id), null, "B 的节点不在 A 画布内");

  D.canvas.setActiveCanvas(p, b.id);
  assert.equal(D.canvas.nodeById(p, n2.id).data.text, "B 的节点");
  assert.equal(D.canvas.activeCanvas(p).view.k, 1, "B 的视图未被 A 影响");
});

test("多画布：activeCanvasId 悬空时回落到首张", () => {
  const { D, p } = ready();
  D.canvas.addCanvas(p, "B");
  p.activeCanvasId = "missing";
  const c = D.canvas.ensure(p);
  assert.equal(c.id, p.canvases[0].id);
  assert.equal(p.activeCanvasId, c.id);
});
