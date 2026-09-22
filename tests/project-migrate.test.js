/* AI 短剧工作台 · 旧工程迁移测试
 * 运行：node --test tests/project-migrate.test.js
 * 覆盖设计「Correctness Properties」1（迁移无数据丢失）与 2（迁移幂等），
 * 以及 D5 旧故事板分镜自动转画布节点。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama } = require("./drama-harness.js");

function fresh() {
  const { D } = createDrama();
  return { D, p: D.project.blank({}) };
}

/* 把工程降级为“旧版本”：只有单画布 p.canvas，没有多画布字段 */
function degrade(p, canvas) {
  if (canvas !== undefined) p.canvas = canvas;
  delete p.canvases;
  delete p.activeCanvasId;
  delete p.canvasMigrated;
}

test("迁移：旧单画布包装为 canvases，保留名称与节点并删除 p.canvas", () => {
  const { D, p } = fresh();
  const img = D.canvas.addNode(p, "image", 5, 6, { prompt: "旧节点" });
  const live = D.canvas.activeCanvas(p);
  const legacy = { id: "cv_legacy", name: "旧画布", nodes: live.nodes, edges: live.edges, view: { x: 11, y: 22, k: 1.5 } };
  degrade(p, legacy);

  D.project.migrate(p);

  assert.equal(p.canvas, undefined, "旧字段已删除");
  assert.equal(p.canvases.length, 1);
  assert.equal(p.canvases[0].name, "旧画布", "旧画布名称保留");
  assert.equal(p.canvases[0].nodes.length, 1);
  assert.equal(p.canvases[0].nodes[0].id, img.id);
  assert.equal(p.canvases[0].nodes[0].data.prompt, "旧节点");
  assert.equal(p.canvases[0].view.k, 1.5, "视图倍率保留");
  assert.equal(p.activeCanvasId, p.canvases[0].id);
  assert.equal(p.canvasMigrated, true);
});

test("迁移：旧分镜转画布节点（D5），文本+图片，有视频再加视频节点", () => {
  const { D, p } = fresh();
  p.shots = [
    { id: "s1", seq: 1, name: "镜一", prompt: "P1", line: "L1", duration: 5 },
    { id: "s2", seq: 2, name: "镜二", prompt: "P2", line: "L2", duration: 5, videoUrl: "https://x/v.mp4" }
  ];
  degrade(p);

  D.project.migrate(p);

  const c = D.canvas.activeCanvas(p);
  assert.equal(c.nodes.length, 5, "镜一 2 节点 + 镜二 3 节点");
  assert.deepEqual(c.nodes.map(n => n.type).sort(), ["image", "image", "text", "text", "video"]);
  assert.equal(c.nodes.filter(n => n.type === "video").length, 1, "仅含视频的分镜生成视频节点");
  assert.equal(c.edges.length, 3, "镜一 1 条 + 镜二 2 条");
  const text = c.nodes.find(n => n.type === "text");
  assert.ok(text.data.text.includes("P1") && text.data.text.includes("L1"), "文本节点合并提示词与台词");
  assert.equal(p.canvasMigrated, true);
});

test("迁移：无内容分镜不建节点，但同样置位以保证幂等", () => {
  const { D, p } = fresh();
  degrade(p);

  D.project.migrate(p);

  assert.equal(D.canvas.activeCanvas(p).nodes.length, 0);
  assert.equal(p.canvasMigrated, true);
});

test("迁移：重复执行幂等，画布节点与边不再增长", () => {
  const { D, p } = fresh();
  p.shots = [
    { id: "s1", prompt: "P", line: "L" },
    { id: "s2", prompt: "Q", videoUrl: "https://x/v.mp4" }
  ];
  degrade(p);

  D.project.migrate(p);
  const first = D.canvas.activeCanvas(p);
  const snap = { nodes: first.nodes.length, edges: first.edges.length, ids: first.nodes.map(n => n.id).join(",") };

  D.project.migrate(p);
  const second = D.canvas.activeCanvas(p);
  assert.equal(second.nodes.length, snap.nodes);
  assert.equal(second.edges.length, snap.edges);
  assert.equal(second.nodes.map(n => n.id).join(","), snap.ids, "节点身份不因重复迁移而改变");
});

test("迁移：分镜、角色、场景等既有数据无损", () => {
  const { D, p } = fresh();
  p.title = "保留标题";
  p.characters = [{ id: "c1", name: "甲", refImages: ["asset:x"] }];
  p.scenes = [{ id: "sc1", name: "场景甲", desc: "描述" }];
  p.shots = [{
    id: "s1", seq: 1, name: "镜一", prompt: "P1", line: "L1",
    imageUrl: "https://x/1.png",
    box3d: { scale: "near", camera: "front", edit: { instruction: "换成夜景", url: "asset:u" } }
  }];
  const shotId = p.shots[0].id;
  degrade(p);

  D.project.migrate(p);

  assert.equal(p.title, "保留标题");
  assert.deepEqual(p.characters[0].refImages, ["asset:x"]);
  assert.deepEqual(p.scenes.map(s => ({ id: s.id, name: s.name, desc: s.desc })), [{ id: "sc1", name: "场景甲", desc: "描述" }]);
  const s = p.shots.find(x => x.id === shotId);
  assert.equal(s.prompt, "P1");
  assert.equal(s.line, "L1");
  assert.equal(s.imageUrl, "https://x/1.png");
  assert.equal(s.box3d.scale, "near");
  assert.equal(s.box3d.edit.instruction, "换成夜景", "箱3D 精准编辑说明保留");
  assert.equal(s.box3d.edit.url, "asset:u");
});

test("迁移：非对象入参原样返回，不抛错", () => {
  const { D } = fresh();
  assert.equal(D.project.migrate(null), null);
  assert.equal(D.project.migrate(undefined), undefined);
  assert.equal(D.project.migrate("x"), "x");
});
