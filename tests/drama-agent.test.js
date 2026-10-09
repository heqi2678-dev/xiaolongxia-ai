/* 短剧 Agent 测试
 * 运行：node --test tests/drama-agent.test.js
 * 覆盖：独立注册与存储、首屏建议卡、会话新建/切换、画布感知直连、流式对话与上下文注入。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/drama/dramaagent.js"), "utf8");

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><div id="dramaAgentView" class="view">'
    + '<div id="dramaAgent"></div></div><div id="toasts"></div></body></html>',
    { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.AbortController = global.AbortController;

  const toasts = [];
  w.XLX = {};
  w.XLX.ICONS = { user: '<circle/>', plus: "", arrow: "", stop: "", film: "", chat: "", grid: "", trend: "", trophy: "" };
  w.XLX.K = { DRAMA_AGENT_CONVS: "xlx_drama_agent_convs", DRAMA_AGENT_CURRENT: "xlx_drama_agent_current" };
  w.XLX.util = {
    esc: (s) => String(s == null ? "" : s),
    uid: (() => { let n = 0; return () => "c" + (++n); })(),
    toast: (m, t) => toasts.push({ m, t }),
    fmtTime: () => "10-09 10:00",
    logo: "",
    mdStream: (el) => { el.dataset.buf = ""; },
    appendDelta: (el, t) => { el.dataset.buf = (el.dataset.buf || "") + t; el.innerHTML = el.dataset.buf; },
    finalizeDelta: (el) => { el.innerHTML = el.dataset.buf || ""; },
    renderFull: (el, t) => { el.dataset.buf = t; el.innerHTML = t; }
  };
  w.XLX.llm = opts.llm || { isConfigured: () => false, chat: async () => "" };
  w.XLX.memory = { systemPrompt: () => "BASE_SYS" };
  w.XLX.DEFAULT_SYSTEM = "DEFAULT_SYS";
  w.XLX.drama = opts.drama || {};

  w.eval(SRC);
  return { w, doc: w.document, D: w.XLX.drama.dramaAgent, toasts };
}

test("短剧 Agent：独立注册且不占用通用对话存储键", () => {
  const { D } = boot();
  assert.ok(D, "注册 XLX.drama.dramaAgent");
  assert.equal(D.K_CONVS, "xlx_drama_agent_convs");
  assert.equal(D.K_CUR, "xlx_drama_agent_current");
  assert.notEqual(D.K_CONVS, "xlx_conversations", "与通用对话历史隔离");
});

test("短剧 Agent：首屏渲染外壳、建议卡与空态", () => {
  const { doc, D } = boot();
  D.render();
  const host = doc.getElementById("dramaAgent");
  assert.ok(host.querySelector(".da-wrap"), "三段式外壳");
  assert.ok(host.querySelector(".da-side #daList"), "左侧对话列表");
  assert.ok(host.querySelector(".da-main #daBody"), "中部消息流");
  assert.ok(host.querySelector("#daInput"), "底部输入框");
  assert.equal(host.querySelectorAll(".da-empty .suggest-card").length, 5, "首屏 5 张建议卡");
  assert.ok(host.querySelector(".da-hero"), "首屏 hero");
});

test("短剧 Agent：新建会话写入独立存储并切换当前", () => {
  const { w, D } = boot();
  D.render();
  D.newConv();
  const list = JSON.parse(w.localStorage.getItem("xlx_drama_agent_convs"));
  assert.equal(list.length, 1, "会话写入 xlx_drama_agent_convs");
  assert.equal(w.localStorage.getItem("xlx_drama_agent_current"), list[0].id, "当前会话已持久化");
  assert.equal(w.localStorage.getItem("xlx_conversations"), null, "不污染通用对话存储");
});

test("短剧 Agent：未配置 Key 时给出提示且不调用模型", async () => {
  let called = 0;
  const { doc, D, toasts } = boot({ llm: { isConfigured: () => false, chat: async () => { called++; return ""; } } });
  D.render();
  await D.send("帮我起一部甜宠短剧");
  assert.equal(called, 0, "未配置 Key 不调用模型");
  assert.ok(toasts.some(t => /API Key/.test(t.m) && t.t === "warn"), "提示去设置填写 Key");
  const conv = D.current();
  assert.equal(conv.messages.length, 1, "用户消息仍记录");
  assert.equal(conv.messages[0].role, "user");
});

test("短剧 Agent：画布指令直连 agent，不占用对话模型", async () => {
  let handled = 0, refreshed = 0;
  const drama = {
    agent: { canHandle: () => true, handle: async () => { handled++; return { reply: "已添加雨夜镜头", changed: true }; } },
    manual: { refreshCanvas: () => { refreshed++; } }
  };
  let chatCalled = 0;
  const { doc, D } = boot({ drama, llm: { isConfigured: () => true, chat: async () => { chatCalled++; return "x"; } } });
  D.render();
  await D.send("加一个 5 秒的雨夜镜头");
  assert.equal(handled, 1, "命中画布指令直接交给 agent");
  assert.equal(chatCalled, 0, "画布指令不调用对话模型");
  assert.equal(refreshed, 1, "画布变更后刷新");
  const conv = D.current();
  assert.equal(conv.messages[conv.messages.length - 1].role, "assistant");
  assert.match(conv.messages[conv.messages.length - 1].content, /雨夜镜头/);
});

test("短剧 Agent：流式对话注入画布上下文并保存结果", async () => {
  let streamed = "";
  const drama = { agent: { canHandle: () => false, promptContext: () => "\n【当前画布】3 个节点" } };
  const { doc, D } = boot({
    drama,
    llm: {
      isConfigured: () => true,
      chat: async (msgs, o) => {
        assert.equal(msgs[0].role, "system");
        assert.match(msgs[0].content, /BASE_SYS/, "注入记忆系统提示");
        assert.match(msgs[0].content, /短剧 Agent/, "注入短剧 Agent 角色");
        assert.match(msgs[0].content, /当前画布/, "注入画布上下文");
        o.onDelta("分幕");
        o.onDelta("大纲");
        streamed = "分幕大纲";
        return streamed;
      }
    }
  });
  D.render();
  await D.send("帮我列个分幕大纲");
  const conv = D.current();
  const last = conv.messages[conv.messages.length - 1];
  assert.equal(last.role, "assistant");
  assert.equal(last.content, "分幕大纲");
  const md = doc.querySelector("#dramaAgent .msg.ai [data-role=md]");
  assert.ok(md, "渲染 AI 消息");
  assert.match(md.textContent, /分幕大纲/, "流式内容落到气泡");
});
