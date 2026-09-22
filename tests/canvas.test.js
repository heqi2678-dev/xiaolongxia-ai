/* AI 短剧工作台 · 节点画布测试
 * 运行：node --test tests/canvas.test.js
 * 覆盖：五类节点与端口约束、连线增删与防环、多入端口替换、提示词/首帧按连线取值、
 *       解析分镜铺图、自动排版、工作流 JSON 序列化、节点生成落库、挂载。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama, mockJson, mockBlob, setAdapter } = require("./drama-harness.js");

function ready() {
  const { D, sandbox } = createDrama();
  const p = D.project.blank({});
  D.canvas.ensure(p);
  return { D, sandbox, p };
}

test("节点画布：五类节点与端口方向", () => {
  const { D } = createDrama();
  assert.deepEqual(D.canvas.TYPE_ORDER, ["script", "text", "image", "video", "audio"]);
  assert.deepEqual(Object.keys(D.canvas.NODE_TYPES).sort(), ["audio", "image", "script", "text", "video"]);
  assert.equal(D.canvas.NODE_TYPES.script.out, "text");
  assert.equal(D.canvas.NODE_TYPES.image.out, "image");
  assert.equal(D.canvas.NODE_TYPES.video.out, "video");
  assert.deepEqual(D.canvas.NODE_TYPES.audio.in, ["text"]);
});

test("工程默认带空画布，迁移补全", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  assert.ok(p.canvas && Array.isArray(p.canvas.nodes) && Array.isArray(p.canvas.edges));
  delete p.canvas;
  D.project.migrate(p);
  assert.ok(p.canvas && Array.isArray(p.canvas.nodes));
  assert.equal(p.canvas.nodes.length, 0);
  assert.equal(p.canvas.view.k, 1);
});

test("增删移节点与字段写入", () => {
  const { D, p } = ready();
  const n = D.canvas.addNode(p, "image", 10, 20, { prompt: "猫" });
  assert.equal(n.type, "image");
  assert.equal(n.x, 10);
  assert.equal(D.canvas.nodeById(p, n.id).data.prompt, "猫");
  D.canvas.moveNode(p, n.id, 99.6, -3.2);
  assert.equal(D.canvas.nodeById(p, n.id).x, 100);
  assert.equal(D.canvas.nodeById(p, n.id).y, -3);
  D.canvas.setData(p, n.id, "prompt", "狗");
  assert.equal(D.canvas.nodeById(p, n.id).data.prompt, "狗");
  D.canvas.removeNode(p, n.id);
  assert.equal(D.canvas.nodeById(p, n.id), null);
});

test("连线按端口类型校验，拒绝自连/重复/环路", () => {
  const { D, p } = ready();
  const t = D.canvas.addNode(p, "text", 0, 0, { text: "海边" });
  const img = D.canvas.addNode(p, "image", 300, 0, { prompt: "日落" });
  assert.equal(D.canvas.accepts(t, img), true);
  assert.equal(D.canvas.accepts(img, t), false, "文本节点不接受图片输入");
  D.canvas.addEdge(p, t.id, img.id);
  assert.throws(() => D.canvas.addEdge(p, t.id, img.id), /已经连好/);
  assert.throws(() => D.canvas.addEdge(p, t.id, t.id), /不能连到自己/);

  const a = D.canvas.addNode(p, "image", 600, 0, {});
  const b = D.canvas.addNode(p, "image", 900, 0, {});
  D.canvas.addEdge(p, a.id, b.id);
  assert.throws(() => D.canvas.addEdge(p, b.id, a.id), /环路/);
});

test("视频节点多入：图片/音频/文本各留一条，重复图片被替换", () => {
  const { D, p } = ready();
  const i1 = D.canvas.addNode(p, "image", 0, 0, {});
  const i2 = D.canvas.addNode(p, "image", 0, 200, {});
  const au = D.canvas.addNode(p, "audio", 0, 400, {});
  const tx = D.canvas.addNode(p, "text", 0, 600, { text: "推镜" });
  const v = D.canvas.addNode(p, "video", 400, 0, {});
  D.canvas.addEdge(p, i1.id, v.id);
  D.canvas.addEdge(p, au.id, v.id);
  D.canvas.addEdge(p, tx.id, v.id);
  D.canvas.addEdge(p, i2.id, v.id);
  assert.equal(D.canvas.upstream(p, v.id).length, 3);
  assert.deepEqual(D.canvas.incoming(p, v.id, "image").map(x => x.id), [i2.id]);
});

test("提示词拼接与首帧按连线取值", () => {
  const { D, p } = ready();
  const tx = D.canvas.addNode(p, "text", 0, 0, { text: "雨夜街头" });
  const img = D.canvas.addNode(p, "image", 300, 0, { prompt: "霓虹灯" });
  const v = D.canvas.addNode(p, "video", 600, 0, { prompt: "缓慢推近" });
  D.canvas.addEdge(p, tx.id, img.id);
  D.canvas.addEdge(p, img.id, v.id);
  D.canvas.addEdge(p, tx.id, v.id);
  assert.equal(D.canvas.buildPrompt(p, img.id), "雨夜街头\n霓虹灯");
  assert.equal(D.canvas.buildPrompt(p, v.id), "雨夜街头\n缓慢推近");
  img.out = "asset:frame";
  assert.equal(D.canvas.firstFrameFrom(p, v.id), "asset:frame");
  assert.deepEqual(D.canvas.refImagesFrom(p, v.id, 3), ["asset:frame"]);
});

test("解析分镜：按空行/换行切分并自动铺图片节点", () => {
  const { D, p } = ready();
  const sc = D.canvas.addNode(p, "script", 0, 0, { text: "第一镜\n\n第二镜\n\n第三镜" });
  const made = D.canvas.explodeScript(p, sc.id);
  assert.equal(made.length, 3);
  assert.equal(p.canvas.edges.filter(e => e.from === sc.id).length, 3);
  assert.equal(D.canvas.downstream(p, sc.id).length, 3);
  assert.throws(() => D.canvas.explodeScript(p, made[0].id), /只有脚本\/文本节点/);
  const empty = D.canvas.addNode(p, "script", 0, 900, { text: "" });
  assert.throws(() => D.canvas.explodeScript(p, empty.id), /还没有内容/);
});

test("拓扑序与自动排版：上游在左、下游在右", () => {
  const { D, p } = ready();
  const tx = D.canvas.addNode(p, "text", 500, 500, { text: "x" });
  const img = D.canvas.addNode(p, "image", 10, 10, {});
  D.canvas.addEdge(p, tx.id, img.id);
  const order = D.canvas.topoOrder(p);
  assert.ok(order.indexOf(tx.id) < order.indexOf(img.id));
  D.canvas.autoLayout(p, 60, 48);
  assert.ok(D.canvas.nodeById(p, tx.id).x < D.canvas.nodeById(p, img.id).x);
});

test("工作流 JSON 序列化/解析：保留类型与连线，不导出成图数据", () => {
  const { D, p } = ready();
  const t = D.canvas.addNode(p, "text", 0, 0, { text: "海边" });
  const img = D.canvas.addNode(p, "image", 300, 0, { prompt: "日落" });
  D.canvas.addEdge(p, t.id, img.id);
  img.out = "asset:big-blob";
  const json = D.canvas.serialize(p);
  assert.equal(json.nodes.length, 2);
  assert.equal(json.edges.length, 1);
  assert.ok(!("out" in json.nodes[1]), "导出只留类型/参数/连线");

  const p2 = D.project.blank({});
  D.canvas.parse(p2, JSON.stringify(json));
  D.canvas.ensure(p2);
  assert.equal(p2.canvas.nodes.length, 2);
  assert.equal(p2.canvas.edges.length, 1);
  const types = p2.canvas.nodes.map(n => n.type).sort();
  assert.deepEqual(types, ["image", "text"]);
  const img2 = p2.canvas.nodes.find(n => n.type === "image");
  assert.equal(img2.out, "", "成图不在 JSON 里，导入后为空");
});

test("图片节点生成落库；未配置时明确报错", async () => {
  const { D, sandbox, p } = ready();
  const t = D.canvas.addNode(p, "text", 0, 0, { text: "一只橘猫" });
  const img = D.canvas.addNode(p, "image", 300, 0, {});
  D.canvas.addEdge(p, t.id, img.id);

  await assert.rejects(() => D.canvas.runNode(p, img.id), /尚未配置生图服务/);

  setAdapter(D, "image", { provider: "seedream", key: "k" });
  mockJson(sandbox, { data: [{ url: "https://cdn/cat.png" }] });
  await D.canvas.runNode(p, img.id);
  assert.match(img.out, /^asset:/);
  assert.equal(img.status, "done");
  const posts = sandbox.__calls.filter(c => c.opts && c.opts.body);
  const body = JSON.parse(posts[posts.length - 1].opts.body);
  assert.match(body.prompt, /一只橘猫/);
});

test("视频/音频节点生成校验与配音落库", async () => {
  const { D, sandbox, p } = ready();
  const v = D.canvas.addNode(p, "video", 0, 0, {});
  await assert.rejects(() => D.canvas.runNode(p, v.id), /尚未配置视频服务/);

  const au = D.canvas.addNode(p, "audio", 400, 0, { text: "你好" });
  await assert.rejects(() => D.canvas.runNode(p, au.id), /尚未配置语音服务/);
  setAdapter(D, "tts", { provider: "volc", key: "k" });
  mockBlob(sandbox, "audio/mpeg");
  await D.canvas.runNode(p, au.id);
  assert.match(au.out, /^asset:/);
  assert.equal(au.status, "done");
});

test("挂载画布返回句柄且不报错", () => {
  const { D, sandbox, p } = ready();
  const el = sandbox.document.createElement("div");
  const handle = D.canvas.mount(el, p, { onChange: () => {} });
  assert.ok(handle && typeof handle.refresh === "function");
  assert.ok(p.canvas);
});
