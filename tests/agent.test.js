/* AI 短剧工作台 · 画布感知 Agent 测试
 * 运行：node --test tests/agent.test.js
 * 覆盖：聚焦感知、指令识别、加节点/连线/拆分镜/整理画布/问画布落点、非画布指令不介入。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama } = require("./drama-harness.js");

async function ready() {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.canvas.ensure(p);
  await D.project.save(p);
  D.agent.focus(p.id);
  return { D, p, pid: p.id };
}

function activeNodes(D, pid) {
  const p = D.project.get(pid);
  return D.canvas.activeCanvas(p).nodes;
}

test("Agent：未聚焦工程时不介入任何指令", () => {
  const { D } = createDrama();
  assert.equal(D.agent.focused(), null);
  assert.equal(D.agent.canHandle("加一个视频节点"), false);
});

test("Agent：聚焦后能感知画布，promptContext 含画布实况", async () => {
  const { D, pid } = await ready();
  assert.ok(D.agent.focused());
  const ctx = D.agent.promptContext();
  assert.ok(ctx.indexOf("当前画布") >= 0, "含画布小节");
  assert.equal(D.agent.canHandle("加一个视频节点：落日"), true);
});

test("Agent：指令识别出加节点/连线/布局/拆分镜/问画布", async () => {
  const { D } = await ready();
  assert.deepEqual(D.agent.intents("加一个视频节点：落日").map(i => i.type), ["add"]);
  assert.equal(D.agent.intents("加一个视频节点：落日")[0].nodeType, "video");
  assert.equal(D.agent.intents("加一个视频节点：落日")[0].text, "落日");
  assert.deepEqual(D.agent.intents("整理画布").map(i => i.type), ["layout"]);
  assert.deepEqual(D.agent.intents("按脚本拆分镜").map(i => i.type), ["build"]);
  assert.ok(D.agent.intents("当前画布有什么节点").some(i => i.type === "ask"));
  assert.deepEqual(D.agent.intents("今天天气怎么样"), []);
});

test("Agent：加节点指令直接落到画布", async () => {
  const { D, pid } = await ready();
  const out = await D.agent.handle("加一个视频节点：落日");
  assert.equal(out.handled, true);
  assert.equal(out.changed, true);
  const nodes = activeNodes(D, pid);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, "video");
  assert.equal(nodes[0].data.prompt, "落日");
});

test("Agent：连线指令把两个节点连起来", async () => {
  const { D, p, pid } = await ready();
  D.canvas.addNode(p, "image", 0, 0, { prompt: "一" });
  D.canvas.addNode(p, "video", 0, 0, { prompt: "二" });
  await D.project.save(p);

  const out = await D.agent.handle("把第1个连到第2个");
  assert.equal(out.changed, true);
  const stored = D.project.get(pid);
  const c = D.canvas.activeCanvas(stored);
  assert.equal(c.edges.length, 1);
});

test("Agent：拆分镜指令按脚本建节点并自动排版", async () => {
  const { D, p, pid } = await ready();
  p.script = p.script || {};
  p.script.logline = "第一幕：主角登场\n\n第二幕：反派现身";
  await D.project.save(p);

  const out = await D.agent.handle("按脚本拆分镜");
  assert.equal(out.handled, true);
  assert.ok(out.reply.indexOf("2 个分镜") >= 0, "回复应报告分镜数：" + out.reply);
  const nodes = activeNodes(D, pid);
  const images = nodes.filter(n => n.type === "image");
  assert.equal(images.length, 2);
});

test("Agent：整理画布与问画布分别布局、返回概览", async () => {
  const { D, p } = await ready();
  D.canvas.addNode(p, "image", 500, 500, { prompt: "甲" });
  await D.project.save(p);

  const laid = await D.agent.handle("整理画布");
  assert.equal(laid.changed, true);

  const asked = await D.agent.handle("当前画布有什么节点");
  assert.equal(asked.handled, true);
  assert.equal(asked.changed, false);
  assert.ok(asked.reply.indexOf("当前画布") >= 0);
});

test("Agent：非画布指令返回 handled=false，不影响普通对话", async () => {
  const { D } = await ready();
  assert.equal(D.agent.canHandle("帮我写一段人物小传"), false);
  const out = await D.agent.handle("帮我写一段人物小传");
  assert.equal(out.handled, false);
  assert.equal(out.reply, "");
});
