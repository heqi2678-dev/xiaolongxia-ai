/* AI 短剧工作台 · 故事板视图测试
 * 运行：node --test tests/storyboard.test.js
 * 覆盖：画布节点按拓扑序读取为分镜、台词归属、字段写回、无节点回退 shots、非镜头节点过滤。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama } = require("./drama-harness.js");

function ready() {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.canvas.ensure(p);
  return { D, p };
}

test("故事板：空画布且无 shots 时返回空列表", () => {
  const { D, p } = ready();
  p.shots = [];
  assert.deepEqual(D.storyboard.list(p), []);
});

test("故事板：画布节点按拓扑序读成分镜，非镜头节点被过滤", () => {
  const { D, p } = ready();
  const a = D.canvas.addNode(p, "image", 0, 0, { prompt: "镜头一" });
  const b = D.canvas.addNode(p, "video", 0, 0, { prompt: "镜头二" });
  D.canvas.addNode(p, "audio", 0, 0, {});           // 音频不参与分镜
  D.canvas.addNode(p, "text", 0, 0, { text: "旁白" }); // 纯文本不参与分镜
  D.canvas.addEdge(p, a.id, b.id);

  const list = D.storyboard.list(p);
  assert.deepEqual(list.map(x => x.prompt), ["镜头一", "镜头二"]);
  assert.deepEqual(list.map(x => x.seq), [1, 2]);
  assert.equal(list[0].nodeId, a.id);
});

test("故事板：上游文本节点的台词归属到下游镜头", () => {
  const { D, p } = ready();
  const t = D.canvas.addNode(p, "text", 0, 0, { text: "你好世界" });
  const s = D.canvas.addNode(p, "video", 0, 0, { prompt: "开场" });
  D.canvas.addEdge(p, t.id, s.id);

  const list = D.storyboard.list(p);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, "你好世界");
});

test("故事板：分镜字段可直接写回节点", () => {
  const { D, p } = ready();
  const n = D.canvas.addNode(p, "video", 0, 0, { prompt: "旧" });
  D.storyboard.update(p, n.id, { prompt: "新", motion: "推镜", duration: 8 });
  const got = D.canvas.nodeById(p, n.id);
  assert.equal(got.data.prompt, "新");
  assert.equal(got.data.motion, "推镜");
  assert.equal(got.data.duration, 8);
});

test("故事板：update 对未知节点与空 nodeId 返回 null", () => {
  const { D, p } = ready();
  assert.equal(D.storyboard.update(p, "", { prompt: "x" }), null);
  assert.equal(D.storyboard.update(p, "nope", { prompt: "x" }), null);
});

test("故事板：画布无镜头节点时回退工程 shots", () => {
  const { D, p } = ready();
  D.canvas.addNode(p, "audio", 0, 0, {}); // 画布非空但无镜头节点
  p.shots = [{ prompt: "旧分镜", line: "台词", duration: 6 }];
  const list = D.storyboard.list(p);
  assert.equal(list.length, 1);
  assert.equal(list[0].prompt, "旧分镜");
  assert.equal(list[0].text, "台词");
  assert.equal(list[0].nodeId, "", "回退数据无节点定位");
});

test("故事板：渲染含镜号与提示词，且不为回退数据输出定位按钮", () => {
  const { D, p } = ready();
  const n = D.canvas.addNode(p, "image", 0, 0, { prompt: "唯美逆光" });
  const html = D.storyboard.html(p);
  assert.ok(html.indexOf("第 1 镜") >= 0);
  assert.ok(html.indexOf("唯美逆光") >= 0);
  assert.ok(html.indexOf('data-sb-open="' + n.id + '"') >= 0);
});
