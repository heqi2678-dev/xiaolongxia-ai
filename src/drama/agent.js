/* 铜龙电商 · AI 短剧工作台 · 画布感知 Agent
 * 让对话 Agent 能「看见」当前工程画布，并对画布直接下达指令：
 *   - 感知：把画布节点/连线/状态压缩成一段上下文，注入对话 system prompt；
 *   - 行动：识别「加节点 / 连线 / 拆分镜 / 整理画布 / 生成 / 问画布」等指令，直接落到 D.canvas。
 * 无关注工程或非画布指令时完全不介入，普通对话不受影响。 */
(function () {
  const D = XLX.drama;

  const TYPE_ALIAS = [
    ["lipsync", ["口型", "对口型", "嘴型"]],
    ["image", ["图片", "图像", "生图", "静帧", "首帧"]],
    ["video", ["视频", "片段", "镜头", "运镜"]],
    ["audio", ["音频", "配音", "语音", "旁白"]],
    ["asset", ["资产", "素材"]],
    ["script", ["脚本", "剧本"]],
    ["text", ["文本", "文字", "台词"]]
  ];

  let focusPid = "";
  function focus(pid) { focusPid = pid || ""; }
  function focused() { return focusPid ? D.project.get(focusPid) : null; }
  function activeCanvas(p) { try { return D.canvas.activeCanvas(p); } catch (e) { return null; } }

  /* ============ 感知 ============ */
  function typeName(t) {
    const info = D.canvas.NODE_TYPES[t];
    return (info && info.label) || t;
  }

  function nodeBrief(n) {
    if (!n) return "";
    const d = n.data || {};
    const body = d.title || d.prompt || d.text || "";
    const line = body ? String(body).replace(/\s+/g, " ").slice(0, 40) : "";
    return typeName(n.type) + (line ? "「" + line + "」" : "") + "(" + (n.status || "idle") + ")";
  }

  /* 把当前画布压缩成一段文字，供对话上下文与问答使用 */
  function context(p) {
    if (!p) return "";
    const c = activeCanvas(p);
    const nodes = (c && c.nodes) || [];
    const lines = [];
    lines.push("【当前画布】工程「" + (p.title || "未命名工程") + "」，画布「" + ((c && c.name) || "画布 1") + "」，共 " + nodes.length + " 个节点、 " + (((c && c.edges) || []).length) + " 条连线。");
    if (p.script && p.script.logline) lines.push("一句话故事：" + p.script.logline);
    if (nodes.length) {
      lines.push("节点清单：");
      nodes.forEach((n, i) => lines.push("  " + (i + 1) + ". " + nodeBrief(n)));
    }
    return lines.join("\n");
  }

  /* 供 index.html 注入 system prompt */
  function promptContext() {
    const p = focused();
    if (!p) return "";
    return "\n\n以下是用户当前正在编辑的短剧画布实况，回答时请结合它，必要时给出针对该画布的操作建议：\n" + context(p);
  }

  /* ============ 指令识别 ============ */
  function findType(text) {
    for (const [type, words] of TYPE_ALIAS) {
      if (words.some(w => text.indexOf(w) >= 0)) return type;
    }
    return "";
  }

  function pickText(text) {
    let m = text.match(/[：:]\s*([^\n]+)$/);
    if (m) return m[1].trim();
    m = text.match(/["“]([^"”]+)["”]/);
    if (m) return m[1].trim();
    m = text.match(/(?:写|填|内容|提示词|台词|文案)(?:是|为|：|:)?\s*([^\n]+)$/);
    if (m) return m[1].trim();
    return "";
  }

  function findNode(p, name) {
    const c = activeCanvas(p);
    if (!c || !name) return null;
    const q = String(name).trim().replace(/[「」"“”]/g, "");
    if (!q) return null;
    const num = q.match(/第?\s*(\d+)\s*个/);
    if (num) return c.nodes[Number(num[1]) - 1] || null;
    return c.nodes.find(n => {
      const d = n.data || {};
      return [d.title, d.prompt, d.text].some(v => v && String(v).indexOf(q) >= 0);
    }) || null;
  }

  /* 返回按出现顺序的意图数组；空数组表示不是画布指令 */
  function intents(text) {
    const t = String(text || "");
    const out = [];
    const wantsBuild = /(拆分镜|拆解|拆成.{0,4}(分镜|节点|镜头)|解析.{0,4}(脚本|分镜)|生成分镜)/.test(t);
    const wantsLayout = /(整理|排版|自动布局|对齐)画布/.test(t);
    const wantsAsk = /(画布|节点).{0,4}(有|是|状态|情况)|当前画布|有什么节点|几个节点|介绍一下画布|画布概览/.test(t);
    const wantsAdd = /(加|添加|新建|插入|建)\s*.{0,6}(节点|一个)/.test(t) || (/(加|添加|新建|插入|建)/.test(t) && !!findType(t));
    const wantsEdge = /把\s*.+?(连到|连接到|接到|连)\s*.+/.test(t);
    const wantsRun = /(生成|运行|跑|执行)/.test(t);

    if (wantsBuild) out.push({ type: "build" });
    if (wantsLayout) out.push({ type: "layout" });
    if (wantsAdd) {
      const nt = findType(t);
      if (nt) out.push({ type: "add", nodeType: nt, text: pickText(t) });
    }
    if (wantsEdge) {
      const m = t.match(/把\s*(.+?)\s*(?:连到|连接到|接到|连)\s*(.+?)(?:[。！!?？]|$)/);
      if (m) out.push({ type: "edge", from: m[1], to: m[2] });
    }
    if (wantsRun && !wantsBuild) out.push({ type: "run" });
    if (wantsAsk) out.push({ type: "ask" });
    return out;
  }

  function canHandle(text) { return !!focused() && intents(text).length > 0; }

  /* ============ 执行 ============ */
  function scriptTextOf(p) {
    if (p && p.script && p.script.logline) return p.script.logline;
    const c = activeCanvas(p);
    const sn = c && c.nodes.find(n => n.type === "script" && n.data && n.data.text);
    return (sn && sn.data.text) || "";
  }

  /* 脚本 → 分镜节点 → 自动排版（一条龙起流程） */
  function build(p, text) {
    const src = String(text || scriptTextOf(p) || "").trim();
    if (!src) throw D.err("NO_TEXT", "还没有可拆的脚本，先在提示词里写一段剧情，或在工程里写一句话故事");
    const script = D.canvas.addNode(p, "script", 60, 80, { text: src, title: "Agent 脚本" });
    const made = D.canvas.explodeScript(p, script.id);
    D.canvas.autoLayout(p);
    return { script, made };
  }

  function addOne(p, it) {
    const c = activeCanvas(p);
    const baseY = c && c.nodes.length ? c.nodes[c.nodes.length - 1].y + 160 : 80;
    const data = {};
    if (it.nodeType === "script" || it.nodeType === "text") data.text = it.text || "";
    else data.prompt = it.text || "";
    const n = D.canvas.addNode(p, it.nodeType, 60, baseY, data);
    return n;
  }

  async function runAll(p, opts) {
    const c = activeCanvas(p);
    const gen = (c && c.nodes || []).filter(n => ["image", "video", "audio", "lipsync"].indexOf(n.type) >= 0);
    let ok = 0, fail = 0;
    for (const n of gen) {
      if (opts && opts.signal && opts.signal.aborted) break;
      try { await D.canvas.runNode(p, n.id, {}); ok++; }
      catch (e) { fail++; }
    }
    return { ok, fail, total: gen.length };
  }

  async function handle(text, opts) {
    const p = focused();
    if (!p) return { handled: false, ok: false, reply: "" };
    const list = intents(text);
    if (!list.length) return { handled: false, ok: false, reply: "" };
    const done = [];
    let changed = false;
    try {
      for (const it of list) {
        if (it.type === "add") {
          const n = addOne(p, it);
          done.push("已新建" + typeName(n.type) + "节点" + (it.text ? "，内容：" + it.text : ""));
          changed = true;
        } else if (it.type === "edge") {
          const a = findNode(p, it.from), b = findNode(p, it.to);
          if (!a || !b) throw D.err("NO_NODE", "没找到「" + (a ? it.to : it.from) + "」对应的节点，可用节点标题或「第 2 个」来指定");
          D.canvas.addEdge(p, a.id, b.id);
          done.push("已连接：" + nodeBrief(a) + " → " + nodeBrief(b));
          changed = true;
        } else if (it.type === "build") {
          const r = build(p, scriptTextOf(p));
          done.push("已按脚本拆出 " + r.made.length + " 个分镜节点，并自动排版");
          changed = true;
        } else if (it.type === "layout") {
          D.canvas.autoLayout(p);
          done.push("已自动排版画布");
          changed = true;
        } else if (it.type === "run") {
          const r = await runAll(p, opts);
          done.push(r.total ? ("已触发生成：成功 " + r.ok + " 个" + (r.fail ? "，失败 " + r.fail + " 个" : "")) : "画布上没有可生成的节点");
          changed = true;
        } else if (it.type === "ask") {
          done.push(context(p));
        }
      }
      if (changed) { try { await D.project.save(p); } catch (e) {} }
      return { handled: true, ok: true, changed, reply: done.join("\n\n") };
    } catch (e) {
      return { handled: true, ok: false, changed: changed, reply: "没能完成：" + ((e && e.message) || "未知错误") };
    }
  }

  D.agent = { focus, focused, promptContext, context, intents, canHandle, handle, build, typeName };
})();
