/* 铜龙电商 · AI 短剧工作台 · Skill 执行引擎
 * 把「静态技能清单」升级成可执行引擎：
 *   - 分类：工具 / 搜索 / 对话 / 生成；
 *   - 规划：按技能类型给出确定性的节点流水线（文本 → 图片 → 视频）；
 *   - 执行：建工程 → 铺节点 → 进画布 → 触发生成（选 Skill 即出片）；
 *   - 自定义：上传 md/文本沉淀为 Skill，或把一段对话沉淀成 Skill。
 * 工具/搜索/对话类仍分流到工具箱与 Agent 对话，只有生成类才建工程出片。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const K_SKILLS = "xlx_drama_skills";
  const VIDEO_CATS = { video: 1, media: 1 };

  const X0 = 60, X1 = 420, X2 = 780, Y0 = 120;
  const NH = (D.canvas && D.canvas.NH) || 200;
  const VGAP = 28;
  const MAX_SHOTS = 12;

  /* ============ 自定义 Skill 存储 ============ */
  function customs() {
    try {
      const v = JSON.parse(localStorage.getItem(K_SKILLS) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(K_SKILLS, JSON.stringify(list || [])); } catch (e) {}
  }
  function builtins() { return (XLX.SKILLS || []).slice(); }
  function all() { return builtins().concat(customs()); }
  function get(id) { return all().find(s => s.id === id) || null; }
  function isCustom(id) { return customs().some(s => s.id === id); }

  function add(skill) {
    if (!skill || !skill.name) throw D.err("BAD_SKILL", "Skill 需要名称");
    const list = customs();
    const id = skill.id || ("sk-c-" + ((U && U.uid) ? U.uid() : Date.now().toString(36)));
    if (get(id)) throw D.err("DUP_SKILL", "同名 Skill 已存在");
    const rec = Object.assign({
      id: id, custom: true, icon: "sparkle", cat: "media",
      action: "chat", author: "我的", createdAt: Date.now()
    }, skill, { id: id, custom: true });
    list.push(rec);
    write(list);
    return rec;
  }

  function remove(id) {
    const list = customs();
    const next = list.filter(s => s.id !== id);
    if (next.length === list.length) return false;
    write(next);
    return true;
  }

  /* 上传 md / 文本 → Skill：取首个非空行作标题，全文作提示词，自动补 {input} 占位 */
  function fromText(text, opts) {
    opts = opts || {};
    const raw = String(text || "").trim();
    if (!raw) throw D.err("NO_TEXT", "内容为空，无法创建 Skill");
    const first = (raw.split(/\r?\n/).find(l => l.trim()) || "").replace(/^#+\s*/, "").trim();
    const name = opts.name || first || "自定义 Skill";
    let prompt = raw;
    if (prompt.indexOf("{input}") < 0) prompt += "\n\n【本次需求】\n{input}";
    return add({
      name: name, desc: opts.desc || ("来自文件：" + (opts.fileName || name)),
      icon: opts.icon || "book", cat: opts.cat || "media",
      action: opts.action || "chat", prompt: prompt
    });
  }

  /* 对话沉淀 → Skill：把最近一条指令与期望输出作为风格示例 */
  function fromConversation(conv, opts) {
    opts = opts || {};
    const msgs = (conv && conv.messages) || [];
    const users = msgs.filter(m => m.role === "user").map(m => m.content).filter(Boolean);
    const lastUser = users.length ? users[users.length - 1] : "";
    let lastAi = "";
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant" && msgs[i].content) { lastAi = msgs[i].content; break; }
    }
    const name = opts.name || (conv && conv.title) || "对话沉淀";
    const prompt = opts.prompt || ("按照下面的示例风格与要求完成任务。\n\n【参考指令】\n" + lastUser +
      "\n\n【期望输出示例】\n" + lastAi + "\n\n【本次需求】\n{input}");
    return add({
      name: name, desc: opts.desc || "从对话沉淀的自定义 Skill",
      icon: opts.icon || "chat", cat: opts.cat || "media",
      action: opts.action || "chat", prompt: prompt
    });
  }

  /* ============ 分类与提示词 ============ */
  function kind(s) {
    if (!s) return { id: "chat", label: "对话" };
    if (s.action === "tool") return { id: "tool", label: "工具" };
    if (s.action === "search") return { id: "search", label: "搜索" };
    if (s.action === "chat") return { id: "chat", label: "对话" };
    return { id: "gen", label: media(s) === "video" ? "视频" : "图片" };
  }

  function media(s) {
    if (s && s.media === "image") return "image";
    if (s && s.media === "video") return "video";
    return VIDEO_CATS[s && s.cat] ? "video" : "image";
  }

  function fillPrompt(skill, input) {
    let s = String((skill && skill.prompt) || "").replace(/\{input\}/g, input || "（待补充）");
    s = s.replace(/\{search\}/g, "（联网搜索到的资料见下方「自动搜索到的网页资料」）").replace(/\{err\}/g, "");
    if (input && s.indexOf(input) < 0 && !(skill && skill.prompt)) s = skill.name + "：" + input;
    return s || ((skill && skill.name) || "") + (input ? "：" + input : "");
  }

  /* ============ 规划：确定性的节点流水线 ============ */
  function plan(skill, input) {
    const m = media(skill);
    if (skill && skill.pipeline === "shots") return planShots(skill, input, m);
    if (skill && skill.pipeline === "script") return planScript(skill, input);
    const title = skill.name;
    const nodes = [
      { ref: "text", type: "text", x: X0, y: Y0, data: { text: fillPrompt(skill, input), title: title } },
      { ref: "main", type: "image", x: X1, y: Y0, data: { prompt: "", title: title } }
    ];
    const edges = [["text", "main"]];
    const run = ["main"];
    if (m === "video") {
      nodes.push({ ref: "clip", type: "video", x: X2, y: Y0, data: { prompt: "", title: title } });
      edges.push(["main", "clip"]);
      run.push("clip");
    }
    return { media: m, title: title, genre: m === "video" ? "realistic" : "comic", nodes: nodes, edges: edges, run: run, shots: 0 };
  }

  /* 把一段梗概切成分镜：优先空行/换行，其次按句末标点，最多 MAX_SHOTS 条 */
  function shotChunks(text) {
    const raw = String(text || "");
    let parts = D.canvas.splitScript(raw);
    if (parts.length <= 1) {
      const single = (parts[0] || raw).trim();
      const bySentence = single.split(/(?<=[。！？!?；;])/).map(s => s.trim()).filter(Boolean);
      if (bySentence.length > 1) parts = bySentence;
    }
    return parts.slice(0, MAX_SHOTS);
  }

  /* 导演分身：梗概 → 分镜文本节点 + 逐镜图片（视频类再逐镜追加视频），全部由分镜文本连边 */
  function planShots(skill, input, m) {
    const title = skill.name;
    const text = fillPrompt(skill, input);
    const source = String(input || "").trim() || text;
    const parts = shotChunks(source);
    const shots = parts.length ? parts : [source];
    const nodes = [{ ref: "text", type: "text", x: X0, y: Y0, data: { text: text, title: title } }];
    const edges = [];
    const run = [];
    shots.forEach((t, i) => {
      const iy = Y0 + i * (NH + VGAP);
      nodes.push({ ref: "shot" + i, type: "image", x: X1, y: iy, data: { prompt: t, title: "分镜 " + (i + 1) } });
      edges.push(["text", "shot" + i]);
      run.push("shot" + i);
      if (m === "video") {
        nodes.push({ ref: "clip" + i, type: "video", x: X2, y: iy, data: { prompt: "", title: "分镜 " + (i + 1) } });
        edges.push(["shot" + i, "clip" + i]);
        run.push("clip" + i);
      }
    });
    return { media: m, title: title, genre: m === "video" ? "realistic" : "comic", nodes: nodes, edges: edges, run: run, shots: shots.length };
  }

  /* 剧本设定器：生成一块可填写的剧本设定工作区（设定→分幕→人物/世界观→主角形象） */
  const T_OUTLINE =
    "【分幕大纲】\n" +
    "第一幕 · 建置：介绍主角与处境，抛出核心冲突的引线\n" +
    "第二幕 · 对抗：冲突升级，主角付出代价并发生转变\n" +
    "第三幕 · 收束：高潮对决与结局，呼应主题\n" +
    "（按题材增减幕数，每幕写 2-3 句剧情走向）";
  const T_CHARS =
    "【人物设定】\n" +
    "主角：\n- 身份/年龄：\n- 性格：\n- 核心欲望：\n- 成长弧光：\n" +
    "对手：\n- 立场与动机：\n- 与主角的冲突点：\n" +
    "关键配角：\n- 作用：\n- 关系：";
  const T_WORLD =
    "【世界观 / 场景】\n" +
    "时代与地域：\n社会规则/势力：\n核心场景（3-5 个）：\n视觉基调（色彩/光影/质感）：";

  function planScript(skill, input) {
    const title = skill.name;
    const brief = fillPrompt(skill, input);
    const step = NH + VGAP;
    const nodes = [
      { ref: "brief", type: "text", x: X0, y: Y0, data: { text: brief, title: "剧本设定" } },
      { ref: "outline", type: "text", x: X1, y: Y0, data: { text: T_OUTLINE, title: "分幕大纲" } },
      { ref: "chars", type: "text", x: X1, y: Y0 + step, data: { text: T_CHARS, title: "人物设定" } },
      { ref: "world", type: "text", x: X1, y: Y0 + step * 2, data: { text: T_WORLD, title: "世界观 / 场景" } },
      { ref: "hero", type: "image", x: X2, y: Y0, data: { prompt: brief, title: "主角形象" } }
    ];
    const edges = [["brief", "hero"]];
    return { media: "image", title: title, genre: "comic", nodes: nodes, edges: edges, run: ["hero"], shots: 0 };
  }

  /* 把规划落到工程上，返回节点 id 映射与待生成清单 */
  function build(p, skill, input) {
    const pl = plan(skill, input);
    const ratio = (p.output && p.output.ratio) || "9:16";
    const byRef = {};
    pl.nodes.forEach(nd => {
      const data = Object.assign({ ratio: ratio }, nd.data);
      byRef[nd.ref] = D.canvas.addNode(p, nd.type, nd.x, nd.y, data);
    });
    pl.edges.forEach(e => { try { D.canvas.addEdge(p, byRef[e[0]].id, byRef[e[1]].id); } catch (err) {} });
    return { plan: pl, byRef: byRef, run: pl.run.map(ref => byRef[ref].id) };
  }

  /* ============ 执行：建工程 → 铺节点 → 进画布 → 出片 ============ */
  async function run(skill, input, opts) {
    opts = opts || {};
    if (!skill) throw D.err("NO_SKILL", "Skill 不存在");
    const pl = plan(skill, input);
    const p = D.project.blank({
      title: (opts.title || skill.name) + "·" + new Date().toLocaleDateString(),
      genre: pl.genre
    });
    const built = build(p, skill, input);
    await D.project.save(p);
    if (opts.enter !== false) await enterCanvas(p.id);
    if (opts.generate !== false) kick(p, built);
    return { project: p, media: pl.media, runIds: built.run, byRef: built.byRef };
  }

  /* 后台触发生成：逐个跑生成节点，失败不阻塞 */
  function kick(p, built) {
    setTimeout(async () => {
      for (const nid of built.run) {
        try { await D.canvas.runNode(p, nid, {}); } catch (e) { break; }
      }
      try { await D.project.save(p); } catch (e) {}
      if (D.manual && D.manual.state && D.manual.state.pid === p.id && D.manual.render) D.manual.render();
    }, 300);
  }

  async function enterCanvas(pid) {
    if (D.manual && D.manual.load) await D.manual.load(pid);
    if (XLX.app && XLX.app.go) XLX.app.go("drama");
  }

  D.skill = {
    all, get, add, remove, isCustom, customs,
    fromText, fromConversation,
    kind, media, fillPrompt, plan, build, run,
    VIDEO_CATS, K_SKILLS
  };
})();
