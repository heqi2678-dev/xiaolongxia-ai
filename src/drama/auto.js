/* 铜龙电商 · AI 短剧工作台 · 流水线「分镜流水线」 */
/* 阶段条 + 缩略图分镜网格：草案 / 生成中 / 逐镜检查三阶段共用同一网格，选中后在下方精修。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const state = {
    stage: "input", project: null, plan: null, busy: false, lastComposed: null, cur: "",
    input: { topic: "", genre: "comic", shotCount: 6, style: "cn-manhua" }
  };

  function view() { return document.getElementById("dwAuto"); }
  function stage() { return state.stage; }
  function real() { return state.project ? D.engine.isRealistic(state.project) : false; }
  function curShot() {
    const p = state.project;
    if (!p) return null;
    return (p.shots || []).find(s => s.id === state.cur) || p.shots[0] || null;
  }

  async function render() {
    D.ui.ensureCss();
    const v = view();
    if (!v) return;
    v.innerHTML = '<div class="dw-wrap">' + topBar() + stepper() + '<div id="dwAutoBody"></div><div id="dwAutoMsg"></div></div>';
    bindTop();
    const body = document.getElementById("dwAutoBody");
    if (stage() === "input") return renderInput(body);
    if (!state.project) { state.stage = "input"; return renderInput(body); }
    if (stage() === "plan") return renderPlan(body);
    if (stage() === "chars") return renderChars(body);
    if (stage() === "gen") return renderGen(body);
    if (stage() === "review") return renderReview(body);
    if (stage() === "voice") return renderVoice(body);
    if (stage() === "compose") return renderCompose(body);
    if (stage() === "final") return renderFinal(body);
    state.stage = "input";
    renderInput(body);
  }

  /* ============ 载入既有工程 ============ */
  async function load(pid) {
    const raw = D.project.get(pid);
    if (!raw) throw D.err("NO_PROJECT", "工程不存在");
    D.project.migrate(raw);
    state.project = raw;
    try { await D.project.hydrateAssets(state.project); } catch (e) {}
    state.cur = (state.project.shots[0] || {}).id || "";
    state.stage = inferStage(state.project);
    return state.project;
  }

  /* 依据工程现状推断该落在哪一阶段，便于从项目中心继续做 */
  function inferStage(p) {
    const shots = p.shots || [];
    if (!shots.length || !shots.some(s => s.prompt)) return "input";
    if (!shots.every(s => s.status === "done")) return shots.some(s => s.status === "done") ? "gen" : "plan";
    if (!shots.every(s => !s.line || s.audioUrl)) return "voice";
    return "final";
  }

  /* 从项目中心打开既有流水线工程：载入 + 渲染 */
  async function open(pid) {
    await load(pid);
    await render();
    return state.project;
  }

  function topBar() {
    const p = state.project;
    return '<div class="dw-bar">' +
      '<button class="btn small" id="auHome">项目中心</button>' +
      (p ? '<span class="dw-hint">工程：' + D.ui.esc(p.title) + "</span>" : "") +
      '<button class="btn small ghost" id="auGuide">看教程</button>' +
    "</div>";
  }

  function bindTop() {
    const v = view();
    v.querySelector("#auHome").onclick = () => { if (XLX.app) XLX.app.go("dramaHome"); };
    v.querySelector("#auGuide").onclick = () => { if (D.guide) D.guide.open("auto"); };
  }

  const STAGES = [
    ["input", "输入题材"], ["plan", "关卡一 · 审剧本"], ["chars", "角色锁定"],
    ["gen", "批量生成"], ["review", "关卡二 · 逐镜检查"], ["voice", "配音字幕"],
    ["compose", "合成成片"], ["final", "关卡三 · 终审发布"]
  ];

  function stepper() {
    const idx = STAGES.findIndex(s => s[0] === stage());
    return '<div class="dw-steps">' + STAGES.map((s, i) =>
      '<span class="dw-step' + (i === idx ? " on" : (i < idx ? " done" : "")) + '" data-stage="' + s[0] + '">' + (i < idx ? "✓ " : "") + s[1] + "</span>"
    ).join("") + "</div>";
  }

  function msg(text, type) {
    const el = document.getElementById("dwAutoMsg");
    if (!el) return;
    el.innerHTML = text ? '<div class="dw-card" style="border-color:' + (type === "err" ? "var(--red)" : type === "ok" ? "#2b5a3a" : "var(--border)") + '">' + D.ui.esc(text) + "</div>" : "";
  }

  /* ============ 共用：缩略图分镜网格 ============ */
  function shotGrid(container, p, after) {
    if (!container) return;
    container.innerHTML = (p.shots || []).map(s => D.ui.railItem(s, state.cur)).join("");
    container.querySelectorAll("[data-rail]").forEach(el => {
      el.onclick = () => { state.cur = el.dataset.rail; if (after) after(); else render(); };
    });
  }

  /* ============ 阶段一：输入 ============ */
  function renderInput(body) {
    const it = state.input;
    body.innerHTML = '<div class="dw-card"><h3>输入题材，AI 帮你出剧本分镜</h3>' +
      '<label class="label" style="margin-top:0">题材 / 一句话点子</label>' +
      '<textarea class="inp" id="auTopic" style="min-height:70px" placeholder="例如：外卖小哥其实是隐形富豪，被女总裁误认成骗子，反转打脸">' + D.ui.esc(it.topic) + "</textarea>" +
      '<div class="dw-grid" style="margin-top:10px">' +
        '<div><label class="label" style="margin-top:0">剧种</label><select class="inp" id="auGenre">' + D.ui.opts(D.GENRES, it.genre) + "</select></div>" +
        '<div><label class="label" style="margin-top:0">画风</label><select class="inp" id="auStyle">' + D.ui.opts(D.STYLES, it.style) + "</select></div>" +
        '<div><label class="label" style="margin-top:0">分镜数量</label><select class="inp" id="auCount">' + D.ui.opts([3, 4, 5, 6, 8, 10, 12].map(n => ({ id: n, name: n + " 镜" })), it.shotCount) + "</select></div>" +
      "</div>" +
      '<div class="dw-card" style="margin:12px 0 0;background:var(--bg)"><h3 style="margin-bottom:8px">模型</h3>' +
        D.ui.modelBar("image") + "</div>" +
      '<div class="dw-bar" style="margin-top:12px"><button class="btn primary" id="auGo">AI 出剧本分镜</button></div>' +
      '<div class="dw-hint" style="margin-top:8px">点子越具体越好。AI 需要「设置」里配好模型；没配模型会用内置模板生成，可手动润色。</div>' +
    "</div>";
    const v = view();
    v.querySelector("#auGo").onclick = () => runPlan();
    v.querySelector("#auGenre").onchange = (e) => { state.input.genre = e.target.value; };
    v.querySelector("#auStyle").onchange = (e) => { state.input.style = e.target.value; };
    v.querySelector("#auCount").onchange = (e) => { state.input.shotCount = Number(e.target.value); };
    v.querySelector("#auTopic").oninput = (e) => { state.input.topic = e.target.value; };
    D.models.bind(v, { onChange: async () => render() });
  }

  async function runPlan() {
    if (state.busy) return;
    if (!state.input.topic.trim()) { U.toast("先写一个题材点子", "warn"); return; }
    state.busy = true;
    msg("正在生成剧本分镜，请稍候…", "");
    try {
      const plan = await D.engine.planScript({ topic: state.input.topic, genre: state.input.genre, shotCount: state.input.shotCount, style: state.input.style });
      state.plan = plan;
      const p = D.project.blank({ title: (state.input.topic || "AI 短剧").slice(0, 18), genre: state.input.genre, source: "auto", mode: "pipeline" });
      p.style = state.input.style;
      D.engine.applyPlan(p, plan);
      p.script.logline = plan.logline || "";
      p.script.outline = plan.outline || "";
      await D.project.save(p);
      state.project = p;
      state.cur = (p.shots[0] || {}).id || "";
      state.stage = "plan";
      render();
      msg(plan._fallback ? "未配置模型，已用内置模板生成，请手动润色剧本与分镜。" : "AI 已生成剧本分镜，请审核修改。", plan._fallback ? "warn" : "");
    } catch (e) {
      msg((e && e.message) || "生成失败", "err");
    } finally {
      state.busy = false;
    }
  }

  /* ============ 关卡一：审剧本 ============ */
  function renderPlan(body) {
    const p = state.project;
    body.innerHTML = '<div class="dw-card"><h3>关卡一 · 审剧本</h3>' +
      '<label class="label" style="margin-top:0">一句话故事</label><input class="inp" id="auLogline" value="' + D.ui.esc(p.script.logline) + '">' +
      '<label class="label">剧情大纲</label><textarea class="inp" id="auOutline" style="min-height:70px">' + D.ui.esc(p.script.outline) + "</textarea>" +
    "</div>" +
    '<div class="dw-card"><h3>分镜草案 <span class="dw-hint">（点缩略图选中，下方改提示词与台词）</span></h3>' +
      '<div class="dw-shotgrid" id="auPlanGrid"></div>' +
      '<div id="auPlanEdit" style="margin-top:12px"></div>' +
      '<div class="dw-bar" style="margin-top:10px">' +
        '<button class="btn" id="auReplan">重新生成</button>' +
        '<button class="btn" id="auAdd">＋ 加一镜</button>' +
        '<button class="btn primary" id="auApprove">通过，去锁定角色</button>' +
      "</div><div class='dw-hint' style='margin-top:8px'>审核满意再通过。通过后才开始花钱生成。</div></div>";

    const handlers = {
      move: (sid, b) => { D.project.moveShot(p, sid, Number(b.dataset.dir)); D.project.save(p); paintPlan(); },
      remove: (sid) => { D.project.removeShot(p, sid); D.project.save(p); state.cur = (p.shots[0] || {}).id || ""; paintPlan(); },
      onChange: () => D.project.save(p)
    };
    function paintPlan() {
      shotGrid(document.getElementById("auPlanGrid"), p, paintPlan);
      const shot = curShot();
      const box = document.getElementById("auPlanEdit");
      box.innerHTML = shot ? D.ui.shotCard(p, shot) : '<div class="dw-empty">没有分镜</div>';
      if (shot) D.ui.bindShots(box, p, handlers);
    }
    paintPlan();

    const v = view();
    v.querySelector("#auLogline").onchange = (e) => { p.script.logline = e.target.value; D.project.save(p); };
    v.querySelector("#auOutline").onchange = (e) => { p.script.outline = e.target.value; D.project.save(p); };
    v.querySelector("#auReplan").onclick = () => { state.stage = "input"; render(); };
    v.querySelector("#auAdd").onclick = () => { const s = D.project.addShot(p); D.project.save(p); state.cur = s.id; paintPlan(); };
    v.querySelector("#auApprove").onclick = () => { state.stage = "chars"; render(); };
  }

  /* ============ 角色锁定 ============ */
  function renderChars(body) {
    const p = state.project;
    body.innerHTML = '<div class="dw-card"><h3>角色锁定 <span class="dw-hint">（外观写细一点，参考图能上传就上传）</span></h3>' +
      (p.characters.length ? p.characters.map(c =>
        '<div class="dw-char" data-char="' + c.id + '"><div style="flex:1"><div class="dw-grid">' +
          '<div><label class="label" style="margin-top:0">名字</label><input class="inp" data-cf="name" data-cid="' + c.id + '" value="' + D.ui.esc(c.name) + '"></div>' +
          '<div><label class="label" style="margin-top:0">身份</label><input class="inp" data-cf="identity" data-cid="' + c.id + '" value="' + D.ui.esc(c.identity) + '"></div>' +
        "</div>" +
        '<label class="label">外观</label><textarea class="inp" style="min-height:46px;font-size:12px" data-cf="appearance" data-cid="' + c.id + '">' + D.ui.esc(c.appearance) + "</textarea>" +
        '<div class="dw-char-refs">' + (c.refImages || []).map(u => '<img class="dw-char-ref" src="' + D.ui.esc(u) + '">').join("") +
        '<button class="btn small" data-act="charref" data-cid="' + c.id + '">＋ 参考图</button>' +
        '<label class="dw-chip' + (c.locked ? " on" : "") + '" data-act="lock" data-cid="' + c.id + '">' + (c.locked ? "已锁定" : "点此锁定") + "</label></div>" +
        "</div>" +
        '<div><button class="btn small" data-act="charsave" data-cid="' + c.id + '">存入角色库</button></div>' +
        "</div>"
      ).join("") : '<div class="dw-empty">没有角色，AI 可能没给出角色，可手动新增</div>') +
      '<div class="dw-bar" style="margin-top:6px"><button class="btn small" data-act="addchar">＋ 新增角色</button>' +
      '<button class="btn small" data-act="charload">从角色库添加</button></div>' +
      D.ui.libPanel(p, { prefix: "au" }) +
    "</div>" +
    '<div class="dw-card"><div class="dw-bar">' +
      '<button class="btn" id="auBackPlan">返回改剧本</button>' +
      '<button class="btn" id="auLockAll">全部锁定</button>' +
      '<button class="btn primary" id="auStartGen">开始批量生成</button>' +
    "</div><div class='dw-hint' style='margin-top:8px'>锁定后角色外观与参考图会写进每一镜的提示词，保证前后一致。</div></div>";

    const v = view();
    v.querySelectorAll("[data-cf]").forEach(el => el.onchange = async () => {
      const c = p.characters.find(x => x.id === el.dataset.cid); if (!c) return;
      c[el.dataset.cf] = el.value; await D.project.save(p);
    });
    v.querySelectorAll("[data-act='lock']").forEach(b => b.onclick = async () => {
      const c = p.characters.find(x => x.id === b.dataset.cid); if (!c) return;
      c.locked = !c.locked; await D.project.save(p); render();
    });
    v.querySelectorAll("[data-act='addchar']").forEach(b => b.onclick = async () => { D.project.addCharacter(p); await D.project.save(p); render(); });
    v.querySelectorAll("[data-act='charref']").forEach(b => b.onclick = () => pickRef(b.dataset.cid));
    D.ui.bindLib(v, p, { prefix: "au", onChange: async () => { await D.project.save(p); render(); } });
    v.querySelector("#auBackPlan").onclick = () => { state.stage = "plan"; render(); };
    v.querySelector("#auLockAll").onclick = async () => { p.characters.forEach(c => c.locked = true); await D.project.save(p); render(); };
    v.querySelector("#auStartGen").onclick = () => { state.stage = "gen"; render(); };
  }

  function pickRef(cid) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = async () => {
      const c = state.project.characters.find(x => x.id === cid); if (!c) return;
      for (const f of Array.from(input.files || [])) {
        const g = await D.compliance.guardUpload(f, "reference");
        if (!g.ok) { U.toast(g.reason, "err"); continue; }
        if (g.warn) U.toast(g.warn, "warn");
        c.refImages = c.refImages || [];
        c.refImages.push(await D.adapterUtil.fileToDataUrl(f));
      }
      await D.project.save(state.project);
      render();
    };
    input.click();
  }

  /* ============ 批量生成（共用网格） ============ */
  function renderGen(body) {
    const p = state.project;
    body.innerHTML = '<div class="dw-card"><h3>批量生成</h3>' +
      '<div class="dw-bar">' +
        D.ui.modelBar(D.engine.isRealistic(p) ? "video" : "image") +
      "</div>" +
      '<div class="dw-hint" style="margin:8px 0">正在逐镜生成，请保持页面打开。失败的单镜可在下一关重绘。</div>' +
      '<div class="dw-bar"><button class="btn primary" id="auGenRun">开始生成</button>' +
      '<button class="btn ghost danger" id="auGenStop">停止</button>' +
      '<button class="btn" id="auGenNext">跳过，去检查</button></div>' +
      '<div class="dw-shotgrid" id="auGenGrid" style="margin-top:12px"></div>' +
      '<div class="dw-shotgrid" id="auGenProg" style="margin-top:8px"></div>' +
    "</div>";
    shotGrid(document.getElementById("auGenGrid"), p, render);
    document.getElementById("auGenProg").innerHTML = (p.shots || []).map(s =>
      '<div><div class="dw-hint" style="text-align:center">第 ' + s.seq + ' 镜</div><div data-status="' + s.id + '">' + D.ui.statusBadge(s) + '</div><div class="dw-progress" data-prog="' + s.id + '"></div></div>'
    ).join("");
    const v = view();
    v.querySelector("#auGenRun").onclick = () => runGen();
    v.querySelector("#auGenStop").onclick = () => { D.engine.abortAll(); U.toast("已请求停止", "warn"); };
    v.querySelector("#auGenNext").onclick = () => { state.stage = "review"; render(); };
    D.models.bind(v, { onChange: async () => render() });
  }

  async function runGen() {
    const p = state.project;
    const kind = D.engine.isRealistic(p) ? "video" : "image";
    if (!D.isConfigured(kind)) { msg("还没配置" + (kind === "video" ? "视频" : "生图") + "服务，请到「设置 → 短剧服务」填写", "err"); return; }
    if (state.busy) { msg("正在生成，请等待当前任务结束…", ""); return; }
    state.busy = true;
    const ids = (p.shots || []).map(s => s.id);
    msg("开始批量生成 " + ids.length + " 镜…", "");
    try {
      const r = await D.engine.generateMany(p, ids, {
        concurrency: 2,
        onEach: (done, total) => msg("生成进度 " + done + "/" + total + "…", ""),
        onProgress: () => {}
      });
      await D.project.save(p);
      (p.shots || []).forEach(s => D.ui.refreshShot(p, s));
      shotGrid(document.getElementById("auGenGrid"), p, render);
      msg(r.errors.length ? "完成，" + r.errors.length + " 镜失败，下一关可重绘。" : "全部生成完成，去逐镜检查。", r.errors.length ? "warn" : "ok");
    } finally {
      state.busy = false;
    }
  }

  /* ============ 关卡二：逐镜检查 ============ */
  function renderReview(body) {
    const p = state.project;
    body.innerHTML = '<div class="dw-card"><h3>关卡二 · 逐镜检查</h3>' +
      '<div class="dw-hint">点缩略图选中，下方可重绘/换封面/改台词。不满意的单镜点「重绘」。</div>' +
      '<div class="dw-shotgrid" id="auReviewGrid" style="margin-top:10px"></div>' +
      '<div id="auReviewEdit" style="margin-top:12px"></div>' +
      '<div class="dw-bar" style="margin-top:10px"><button class="btn" id="auRedrawFail">重绘全部失败镜</button>' +
      '<button class="btn primary" id="auApprove2">通过，去配音</button></div></div>';
    const handlers = {
      gen: (sid) => redraw(sid),
      tts: (sid) => redrawTts(sid),
      lipsync: (sid) => redrawLipsync(sid),
      upload: (sid) => pickShotCover(sid),
      move: (sid, b) => { D.project.moveShot(p, sid, Number(b.dataset.dir)); D.project.save(p); refresh(); },
      remove: (sid) => { D.project.removeShot(p, sid); D.project.save(p); state.cur = (p.shots[0] || {}).id || ""; refresh(); },
      onChange: () => D.project.save(p)
    };
    function refresh() {
      shotGrid(document.getElementById("auReviewGrid"), p, refresh);
      const shot = curShot();
      const box = document.getElementById("auReviewEdit");
      box.innerHTML = shot ? D.ui.shotCard(p, shot) : '<div class="dw-empty">没有分镜</div>';
      if (shot) D.ui.bindShots(box, p, handlers);
    }
    refresh();
    const v = view();
    v.querySelector("#auRedrawFail").onclick = async () => {
      const ids = p.shots.filter(s => s.status === "failed").map(s => s.id);
      if (!ids.length) { U.toast("没有失败的分镜", "ok"); return; }
      await D.engine.generateMany(p, ids, { concurrency: 2, onEach: () => {} });
      refresh();
    };
    v.querySelector("#auApprove2").onclick = () => { state.stage = "voice"; render(); };
  }

  async function redraw(sid) {
    const p = state.project;
    try {
      D.ui.progress(sid, "重绘中…");
      const shot = await D.engine.generateShot(p, sid, { onProgress: () => D.ui.progress(sid, "生成中…") });
      await D.project.save(p);
      D.ui.refreshShot(p, shot);
      D.ui.progress(sid, "");
      render();
    } catch (e) { D.ui.progress(sid, ""); U.toast((e && e.message) || "重绘失败", "err"); }
  }
  async function redrawTts(sid) {
    const p = state.project; const shot = p.shots.find(s => s.id === sid);
    if (!shot || !shot.line) { U.toast("这一镜没有台词", "warn"); return; }
    try { D.ui.progress(sid, "配音中…"); await D.engine.synthShot(p, shot); if (D.engine.isRealistic(p) && shot.videoUrl) await D.engine.lipsyncShot(p, shot); await D.project.save(p); D.ui.refreshShot(p, shot); D.ui.progress(sid, ""); render(); }
    catch (e) { D.ui.progress(sid, ""); U.toast((e && e.message) || "配音失败", "err"); }
  }
  async function redrawLipsync(sid) {
    const p = state.project; const shot = p.shots.find(s => s.id === sid);
    if (!shot || !shot.videoUrl || !shot.audioUrl) { U.toast("需要视频和配音都就绪", "warn"); return; }
    try { D.ui.progress(sid, "口型中…"); await D.engine.lipsyncShot(p, shot); await D.project.save(p); D.ui.refreshShot(p, shot); D.ui.progress(sid, ""); render(); }
    catch (e) { D.ui.progress(sid, ""); U.toast((e && e.message) || "口型失败", "err"); }
  }
  function pickShotCover(sid) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files && input.files[0]; if (!f) return;
      const g = await D.compliance.guardUpload(f, "reference");
      if (!g.ok) { U.toast(g.reason, "err"); return; }
      if (g.warn) U.toast(g.warn, "warn");
      const shot = state.project.shots.find(s => s.id === sid); if (!shot) return;
      const url = await D.adapterUtil.fileToDataUrl(f);
      shot.imageUrl = url; shot.firstFrame = url;
      await D.project.save(state.project); render();
    };
    input.click();
  }

  /* ============ 配音字幕 ============ */
  function renderVoice(body) {
    const p = state.project;
    const need = (p.shots || []).filter(s => s.line && !s.audioUrl).length;
    body.innerHTML = '<div class="dw-card"><h3>配音与字幕</h3>' +
      '<div class="dw-bar">' + D.ui.modelBar("tts") + "</div>" +
      '<div class="dw-hint" style="margin:8px 0">需要补配音的分镜：' + need + " 个。字幕会在合成时按台词自动生成。</div>" +
      '<div class="dw-bar"><button class="btn primary" id="auTtsRun">批量配音</button>' +
      '<button class="btn" id="auApprove3">通过，去合成</button></div>' +
      '<div class="dw-shotgrid" id="auVoiceGrid" style="margin-top:12px"></div>' +
      '<div class="dw-shotgrid" id="auVoiceProg" style="margin-top:8px"></div></div>';
    shotGrid(document.getElementById("auVoiceGrid"), p, render);
    document.getElementById("auVoiceProg").innerHTML = (p.shots || []).map(s =>
      '<div><div class="dw-hint" style="text-align:center">第 ' + s.seq + ' 镜' + (s.line ? "" : "·无台词") + '</div><div class="dw-hint" style="text-align:center">' + (s.audioUrl ? "已配音" : "未配音") + '</div><div class="dw-progress" data-prog="' + s.id + '"></div></div>'
    ).join("");
    const v = view();
    v.querySelector("#auTtsRun").onclick = async () => {
      const ids = p.shots.filter(s => s.line && !s.audioUrl).map(s => s.id);
      if (!ids.length) { msg("配音都齐了", "ok"); return; }
      if (!D.isConfigured("tts")) { msg("还没配置语音服务，请到「设置 → 短剧服务」填写", "err"); return; }
      if (state.busy) { msg("正在处理，请等待当前任务结束…", ""); return; }
      state.busy = true;
      msg("正在配音 " + ids.length + " 镜…", "");
      try {
        const r = await D.engine.synthMany(p, ids, {});
        await D.project.save(p);
        msg(r.errors.length ? "有 " + r.errors.length + " 镜配音失败。" : "配音完成。", r.errors.length ? "err" : "ok");
        render();
      } finally {
        state.busy = false;
      }
    };
    v.querySelector("#auApprove3").onclick = () => { state.stage = "compose"; render(); };
    D.models.bind(v, { onChange: async () => render() });
  }

  /* ============ 合成成片 ============ */
  function renderCompose(body) {
    body.innerHTML = '<div class="dw-card"><h3>合成成片</h3>' +
      '<div class="dw-hint">合成会烧入字幕和「AI 生成」角标，请勿切走页面。</div>' +
      '<div class="dw-bar" style="margin-top:10px"><button class="btn primary" id="auCompose">开始合成</button>' +
      '<button class="btn" id="auApprove4">通过，去终审</button></div>' +
      '<div id="auComposeOut"></div></div>';
    const v = view();
    const btn = v.querySelector("#auCompose");
    btn.onclick = async () => {
      if (state.busy) { msg("正在合成，请勿重复点击…", ""); return; }
      state.busy = true;
      btn.disabled = true;
      try {
        msg("正在合成…请勿切走页面…", "");
        const blob = await D.compose.client(state.project, { onProgress: (pr) => msg("合成中 " + Math.round(pr.elapsed) + "/" + Math.round(pr.total) + " 秒…", "") });
        state.lastComposed = blob;
        await D.compliance.archive(state.project, { kind: "browser-webm", size: blob.size });
        const url = URL.createObjectURL(blob);
        document.getElementById("auComposeOut").innerHTML = '<video class="dw-preview" controls src="' + url + '"></video>';
        msg("合成完成。", "ok");
      } catch (e) { msg((e && e.message) || "合成失败", "err"); }
      finally { state.busy = false; btn.disabled = false; }
    };
    v.querySelector("#auApprove4").onclick = () => { state.stage = "final"; render(); };
  }

  /* ============ 关卡三：终审与发布 ============ */
  function renderFinal(body) {
    const p = state.project;
    body.innerHTML = '<div class="dw-card"><h3>关卡三 · 终审与发布</h3>' +
      '<div class="dw-shotgrid" id="auFinalGrid" style="margin:10px 0"></div>' +
      '<div class="dw-bar">' +
        '<button class="btn primary" id="auDownload">下载成片</button>' +
        '<button class="btn" id="auPack">导出素材包</button>' +
        '<button class="btn" id="auRestart">做下一部</button>' +
      "</div>" +
      '<div class="dw-hint" style="margin-top:8px">发布到抖音前请保留 AI 生成标注。可直接下载成片，或导出素材包用剪映二次剪辑。</div>' +
    "</div>" +
    D.ui.complianceCard(p, { prefix: "au" });
    shotGrid(document.getElementById("auFinalGrid"), p, render);
    const v = view();
    D.ui.bindCompliance(v, p, {
      prefix: "au",
      onChange: async () => { await D.project.save(p); render(); },
      onCheck: () => {
        const vv = D.project.validate(p);
        const c2 = D.compliance.verify(p);
        msg((vv.ok ? "画面与配音齐全。" : "还缺：" + vv.missing.map(m => "第" + m.seq + "镜" + m.reason).join("、")) +
          (c2.ok ? " 合规检查通过。" : " 合规问题：" + c2.blockers.join("；")),
          vv.ok && c2.ok ? "ok" : "err");
      }
    });
    v.querySelector("#auDownload").onclick = () => {
      if (!state.lastComposed) { U.toast("还没合成成片，请回到上一步合成", "warn"); return; }
      U.download(p.title + ".webm", state.lastComposed);
    };
    v.querySelector("#auPack").onclick = async () => {
      try {
        const blob = await D.compose.exportPack(p, state.lastComposed);
        U.download(p.title + "-素材包.zip", blob);
        await D.compliance.archive(p, { kind: "pack-zip" });
      } catch (e) { U.toast((e && e.message) || "打包失败", "err"); }
    };
    v.querySelector("#auRestart").onclick = () => {
      state.project = null; state.lastComposed = null; state.stage = "input"; state.cur = "";
      render();
    };
  }

  D.auto = { render, load, open, state };
})();
