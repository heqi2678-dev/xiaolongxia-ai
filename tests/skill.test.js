/* AI 短剧工作台 · Skill 执行引擎测试
 * 运行：node --test tests/skill.test.js
 * 覆盖：内置/自定义合并、增删查、分类、提示词填充、流水线规划、建工程铺节点、执行与后台出片。 */
const test = require("node:test");
const assert = require("node:assert");
const { createDrama } = require("./drama-harness.js");

function builtin() {
  return { id: "b-img", name: "商品主图", desc: "生成商品主图", icon: "cart", cat: "image", action: "chat", prompt: "为 {input} 生成电商主图" };
}

function activeNodes(D, pid) {
  const p = D.project.get(pid);
  return D.canvas.activeCanvas(p).nodes;
}

test("Skill：内置技能来自 XLX.SKILLS，自定义追加在后", () => {
  const { D, sandbox } = createDrama();
  sandbox.XLX.SKILLS = [builtin()];
  assert.equal(D.skill.all().length, 1);
  assert.equal(D.skill.get("b-img").name, "商品主图");

  D.skill.add({ id: "c-1", name: "我的风格", prompt: "写 {input}" });
  assert.equal(D.skill.all().length, 2);
  assert.equal(D.skill.isCustom("c-1"), true);
  assert.equal(D.skill.isCustom("b-img"), false);
  assert.equal(D.skill.get("c-1").custom, true);
  assert.equal(D.skill.get("c-1").author, "我的");
});

test("Skill：自定义技能持久化在 localStorage，重复 id 报错", () => {
  const { D, sandbox } = createDrama();
  D.skill.add({ id: "c-1", name: "甲", prompt: "a" });
  const raw = sandbox.localStorage.getItem(D.skill.K_SKILLS);
  assert.ok(raw && raw.indexOf("c-1") >= 0, "应写入存储键 " + D.skill.K_SKILLS);
  assert.throws(() => D.skill.add({ id: "c-1", name: "乙", prompt: "b" }), /已存在/);
  assert.equal(D.skill.customs().length, 1);
});

test("Skill：删除自定义技能", () => {
  const { D } = createDrama();
  D.skill.add({ id: "c-1", name: "甲", prompt: "a" });
  assert.equal(D.skill.remove("c-1"), true);
  assert.equal(D.skill.remove("c-1"), false);
  assert.equal(D.skill.customs().length, 0);
});

test("Skill：分类识别工具/搜索/对话/生成，媒体判定图片与视频", () => {
  const { D } = createDrama();
  assert.equal(D.skill.kind({ action: "tool" }).id, "tool");
  assert.equal(D.skill.kind({ action: "search" }).id, "search");
  assert.equal(D.skill.kind({ action: "chat" }).id, "chat");
  assert.equal(D.skill.kind({ cat: "image" }).id, "gen");
  assert.equal(D.skill.kind({ cat: "video" }).id, "gen");
  assert.equal(D.skill.media({ cat: "video" }), "video");
  assert.equal(D.skill.media({ cat: "image" }), "image");
  assert.equal(D.skill.media({ media: "video", cat: "image" }), "video");
});

test("Skill：fillPrompt 用本次需求替换 {input} 占位", () => {
  const { D } = createDrama();
  const out = D.skill.fillPrompt({ name: "x", prompt: "画一张 {input} 的海报" }, "咖啡杯");
  assert.equal(out, "画一张 咖啡杯 的海报");
  assert.equal(D.skill.fillPrompt({ name: "无提示词", prompt: "" }, "落日"), "无提示词：落日");
});

test("Skill：图片技能规划为 文本→图片，视频技能追加视频节点", () => {
  const { D } = createDrama();
  const img = D.skill.plan({ name: "主图", cat: "image", prompt: "画 {input}" }, "杯子");
  assert.deepEqual(img.media, "image");
  assert.deepEqual(img.nodes.map(n => n.type), ["text", "image"]);
  assert.deepEqual(img.run, ["main"]);
  assert.equal(img.nodes[0].data.text, "画 杯子");

  const vid = D.skill.plan({ name: "短片", cat: "video", prompt: "拍 {input}" }, "落日");
  assert.deepEqual(vid.media, "video");
  assert.deepEqual(vid.nodes.map(n => n.type), ["text", "image", "video"]);
  assert.deepEqual(vid.run, ["main", "clip"]);
  assert.equal(vid.edges.length, 2);
});

test("Skill：build 把流水线落到工程画布，节点用边串联", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.canvas.ensure(p);
  const built = D.skill.build(p, { name: "短片", cat: "video", prompt: "拍 {input}" }, "落日");
  const nodes = D.canvas.activeCanvas(p).nodes;
  assert.equal(nodes.length, 3);
  assert.equal(nodes.filter(n => n.type === "image").length, 1);
  assert.equal(built.run.length, 2);
  assert.equal(D.canvas.activeCanvas(p).edges.length, 2);
});

test("Skill：run 建工程→铺节点→保存，enter/generate 可关", async () => {
  const { D, sandbox } = createDrama();
  sandbox.XLX.app = { go: () => {} };
  const out = await D.skill.run({ name: "短片", cat: "video", prompt: "拍 {input}" }, "落日", { enter: false, generate: false });
  assert.ok(out.project && out.project.id);
  assert.equal(out.media, "video");
  assert.equal(out.runIds.length, 2);
  assert.equal(activeNodes(D, out.project.id).length, 3);
  assert.equal(D.project.list().length, 1);
});

test("Skill：generate 时不阻塞，未配置服务商则不触网", async () => {
  const { D, sandbox, calls } = createDrama();
  sandbox.XLX.app = { go: () => {} };
  const out = await D.skill.run({ name: "主图", cat: "image", prompt: "画 {input}" }, "杯子", { enter: false });
  assert.equal(out.runIds.length, 1);
  await new Promise(r => setTimeout(r, 40));
  assert.equal(calls.length, 0);
});

test("Skill：导演分身流水线把梗概拆成逐镜图片+视频", () => {
  const { D } = createDrama();
  const skill = { name: "导演分身", cat: "video", media: "video", pipeline: "shots", action: "gen", prompt: "你是导演：{input}" };
  const pl = D.skill.plan(skill, "第一镜。第二镜！第三镜？");
  assert.equal(pl.shots, 3);
  assert.deepEqual(pl.nodes[0].type, "text");
  assert.equal(pl.nodes.filter(n => n.type === "image").length, 3);
  assert.equal(pl.nodes.filter(n => n.type === "video").length, 3);
  assert.equal(pl.edges.length, 6);
  assert.equal(pl.run.length, 6);
  assert.equal(pl.nodes[1].data.prompt, "第一镜。");
  assert.ok(pl.nodes[0].data.text.indexOf("你是导演") >= 0, "文本节点保留导演提示词");
});

test("Skill：导演分身优先按空行/换行切分，且限制最大镜头数", () => {
  const { D } = createDrama();
  const img = { name: "导演分身", cat: "image", pipeline: "shots", action: "gen", prompt: "拆 {input}" };
  const pl = D.skill.plan(img, "镜头甲\n\n镜头乙\n\n镜头丙");
  assert.equal(pl.shots, 3);
  assert.equal(pl.nodes.filter(n => n.type === "image").length, 3);
  assert.equal(pl.nodes.filter(n => n.type === "video").length, 0);
  const many = D.skill.plan(img, Array.from({ length: 30 }, (_, i) => "第" + i + "镜。").join(""));
  assert.equal(many.shots, 12);
});

test("Skill：普通技能不收 shots 字段，导演分身按 input 而非提示词拆分", () => {
  const { D } = createDrama();
  const plain = D.skill.plan({ name: "主图", cat: "image", prompt: "画 {input}" }, "杯子");
  assert.equal(plain.shots, 0);
  const shots = D.skill.plan({ name: "导演分身", cat: "video", pipeline: "shots", prompt: "导演提示：{input}" }, "甲。乙。");
  assert.equal(shots.nodes.filter(n => n.type === "image").length, 2);
  assert.equal(shots.nodes[1].data.prompt, "甲。", "分镜来自 input");
});

test("Skill：剧本设定器铺出设定/分幕/人物/世界观/主角形象节点", () => {
  const { D } = createDrama();
  const skill = { name: "剧本设定器", cat: "video", media: "image", pipeline: "script", action: "gen", prompt: "你是编剧：{input}" };
  const pl = D.skill.plan(skill, "民国悬疑");
  assert.equal(pl.shots, 0);
  const texts = pl.nodes.filter(n => n.type === "text");
  assert.deepEqual(texts.map(n => n.data.title), ["剧本设定", "分幕大纲", "人物设定", "世界观 / 场景"]);
  assert.ok(texts[0].data.text.indexOf("民国悬疑") >= 0, "设定节点带入题材");
  assert.ok(texts[1].data.text.indexOf("第一幕") >= 0, "含分幕模板");
  assert.equal(pl.nodes.filter(n => n.type === "image").length, 1);
  assert.equal(pl.run.length, 1);
  assert.equal(pl.edges.length, 1);
});

test("Skill：剧本设定器整链落进工程并连边", () => {
  const { D } = createDrama();
  const p = D.project.blank({});
  D.canvas.ensure(p);
  const built = D.skill.build(p, { name: "剧本设定器", pipeline: "script", prompt: "题材：{input}" }, "仙侠");
  const nodes = D.canvas.activeCanvas(p).nodes;
  assert.equal(nodes.length, 5);
  assert.equal(D.canvas.activeCanvas(p).edges.length, 1);
  assert.equal(built.run.length, 1);
});

test("Skill：fromText 用首个非空行作标题并补 {input}", () => {
  const { D } = createDrama();
  const s = D.skill.fromText("# 我的口播风格\n\n先抛出痛点，再给方案。", { fileName: "koban.md" });
  assert.equal(s.name, "我的口播风格");
  assert.ok(s.prompt.indexOf("{input}") >= 0);
  assert.equal(s.custom, true);
});

test("Skill：fromConversation 把最近一轮对话沉淀为风格示例", () => {
  const { D } = createDrama();
  const conv = {
    title: "爆款标题", messages: [
      { role: "user", content: "给我写个标题" },
      { role: "assistant", content: "标题示例：三秒抓住你" }
    ]
  };
  const s = D.skill.fromConversation(conv);
  assert.equal(s.name, "爆款标题");
  assert.ok(s.prompt.indexOf("三秒抓住你") >= 0);
  assert.ok(s.prompt.indexOf("{input}") >= 0);
});
