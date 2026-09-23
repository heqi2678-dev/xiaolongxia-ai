/* 铜龙电商 · AI 短剧工作台 · 造型室 */
/* 三个台共用的「开拍前资产台」：三视图（治崩脸）/ 场景卡（场景身份锚点）/ 多参考（每镜最多 3 张）。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const TABS = [
    { id: "views", name: "角色", sub: "三视图治崩脸" },
    { id: "refs", name: "主体", sub: "每镜最多 3 张参考" },
    { id: "scenes", name: "场景", sub: "场景身份锚点" },
    { id: "style", name: "风格", sub: "画风预设" }
  ];

  const VIEW_ORDER = [
    { id: "front", name: "正面" },
    { id: "side", name: "侧面" },
    { id: "back", name: "背面" }
  ];

  const MAX_REFS = 3;

  const state = { pid: "", project: null, tab: "views", busy: false, shotCur: "", covers: {} };

  const CSS = `
.mk-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.mk-tab{font-size:12px;padding:7px 14px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--text2);cursor:pointer;transition:all .15s}
.mk-tab:hover{border-color:var(--border2)}
.mk-tab.on{background:var(--accent-grad);border-color:transparent;color:#fff;font-weight:600}
.mk-tab small{display:block;font-size:10px;font-weight:400;opacity:.75;margin-top:2px}
.mk-char{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--bg)}
.mk-char-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.mk-char-head b{font-size:13px;color:var(--accent2)}
.mk-char-head .mk-ap{font-size:11px;color:var(--text3);flex:1;min-width:120px;line-height:1.6}
.mk-viewgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.mk-slot{border:1px solid var(--border);border-radius:10px;background:var(--card);overflow:hidden;display:flex;flex-direction:column}
.mk-slot-body{position:relative;aspect-ratio:3/4;background:#0d1017;display:flex;align-items:center;justify-content:center}
.mk-slot-body img{width:100%;height:100%;object-fit:cover}
.mk-slot-ph{color:var(--text3);font-size:11px;text-align:center;padding:8px}
.mk-slot-foot{display:flex;align-items:center;gap:6px;padding:6px 8px;border-top:1px solid var(--border);font-size:11px;color:var(--text2)}
.mk-slot-foot b{color:var(--text)}
.mk-slot-foot .mk-sp{margin-left:auto}
.mk-scene{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--bg);display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px}
.mk-scene-anchor{width:120px;aspect-ratio:3/4;border-radius:10px;border:1px solid var(--border);background:#0d1017;overflow:hidden;display:flex;align-items:center;justify-content:center}
.mk-scene-anchor img{width:100%;height:100%;object-fit:cover}
.mk-scene-anchor span{color:var(--text3);font-size:11px;text-align:center;padding:8px}
.mk-scene-main{display:flex;flex-direction:column;gap:8px;min-width:0}
.mk-reflist{display:flex;flex-wrap:wrap;gap:8px}
.mk-ref{border:1px solid var(--border);border-radius:10px;background:var(--card);overflow:hidden;width:96px;display:flex;flex-direction:column}
.mk-ref-body{aspect-ratio:3/4;background:#0d1017;display:flex;align-items:center;justify-content:center}
.mk-ref-body img{width:100%;height:100%;object-fit:cover}
.mk-ref-body span{font-size:10px;color:var(--text3);padding:6px;text-align:center}
.mk-ref-foot{display:flex;align-items:center;justify-content:center;padding:4px;border-top:1px solid var(--border)}
.mk-ref.auto{border-style:dashed}
.mk-ref-add{border:1px dashed var(--border2);border-radius:10px;width:96px;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px;cursor:pointer;background:var(--bg)}
.mk-ref-add:hover{border-color:var(--accent);color:var(--accent2)}
.mk-count{font-size:11px;color:var(--text3)}
.mk-note{font-size:11px;color:var(--text3);line-height:1.7;margin-top:8px}
.mk-styles{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.mk-style{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--bg);cursor:pointer;transition:border-color .15s,transform .15s}
.mk-style:hover{border-color:var(--border2);transform:translateY(-2px)}
.mk-style.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.mk-style b{display:block;font-size:13px;margin-bottom:6px;color:var(--text)}
.mk-style.on b{color:var(--accent2)}
.mk-style span{font-size:11px;color:var(--text3);line-height:1.6}
.mk-prog{font-size:11px;color:var(--blue);margin-top:6px}
@media (max-width:720px){
  .mk-scene{grid-template-columns:90px minmax(0,1fr)}
  .mk-scene-anchor{width:90px}
  .mk-viewgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaMakeupCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  const esc = (s) => U.esc(String(s == null ? "" : s));
  function view() { return document.getElementById("dwMakeup"); }

  /* ============ 工程装载 ============ */
  async function ensureProject(pid) {
    let list = D.project.list();
    if (!list.length) {
      const p = D.project.blank({ title: "我的第一部短剧" });
      await D.project.save(p);
      list = D.project.list();
    }
    if (!pid || !D.project.get(pid)) pid = list[0].id;
    state.pid = pid;
  }

  async function load(pid) {
    await ensureProject(pid);
    const p = D.project.get(state.pid);
    if (!p) throw D.err("NO_PROJECT", "工程不存在");
    D.project.migrate(p);
    state.project = p;
    if (!state.shotCur || !(p.shots || []).some(s => s.id === state.shotCur)) {
      state.shotCur = ((p.shots || [])[0] || {}).id || "";
    }
    return p;
  }

  async function save() {
    if (!state.project) return;
    await D.project.save(state.project);
  }

  /* ============ 提示词 ============ */
  function characterText(c) {
    const bits = [];
    if (c.name) bits.push(c.name);
    if (c.identity) bits.push("身份：" + c.identity);
    const ap = D.character.displayAppearance(c);
    if (ap) bits.push("外观：" + ap);
    return bits.join("，");
  }

  const VIEW_DIR = { front: "正面全脸朝向镜头", side: "正侧面 90 度侧脸", back: "背面，后脑与背影" };

  function viewPrompt(project, c, viewId) {
    const parts = [];
    const sp = D.character.stylePrompt(project.style);
    if (sp) parts.push(sp);
    parts.push("角色三视图");
    parts.push(characterText(c));
    parts.push(VIEW_DIR[viewId] || "");
    parts.push("全身或七分身，中性站姿，纯色背景，居中构图，同一角色比例一致，五官清晰，服装细节完整，用于全片角色形象参考");
    return parts.filter(Boolean).join("。");
  }

  function scenePrompt(project, sc) {
    const parts = [];
    const sp = D.character.stylePrompt(project.style);
    if (sp) parts.push(sp);
    parts.push("场景概念图，场景身份锚点，用于全片同一场景保持一致");
    if (sc.name) parts.push(sc.name);
    if (sc.desc) parts.push(sc.desc);
    parts.push("无人物，环境全貌，光线与氛围明确，构图留出人物站位空间");
    return parts.filter(Boolean).join("。");
  }

  /* ============ 出图 ============ */
  async function genImage(project, prompt, ratio, refImages) {
    if (!D.isConfigured("image")) throw D.err("NO_KEY", "尚未配置生图服务，请到「设置 → 短剧服务」填写");
    const r = await D.adapters.image.generate({
      prompt,
      ratio: ratio || "3:4",
      refImages: (refImages || []).filter(Boolean).slice(0, 1),
      model: project.imageModel
    });
    return await D.project.cacheRemote(r.url, { role: "character" });
  }

  async function generateView(cid, viewId) {
    const p = state.project;
    const c = (p.characters || []).find(x => x.id === cid);
    if (!c) throw D.err("NO_CHAR", "找不到这个角色");
    const bad = D.character.check(c);
    if (bad) throw D.err("CHAR_INCOMPLETE", bad);
    const base = c.views.front || (c.refImages || [])[0] || "";
    const ref = await genImage(p, viewPrompt(p, c, viewId), "3:4", viewId === "front" ? (c.refImages || []) : [base]);
    c.views = c.views || {};
    c.views[viewId] = ref;
    c.views.updatedAt = Date.now();
    await save();
    return ref;
  }

  async function generateScene(sid) {
    const p = state.project;
    const sc = (p.scenes || []).find(x => x.id === sid);
    if (!sc) throw D.err("NO_SCENE", "找不到这个场景");
    sc.anchorRef = await genImage(p, scenePrompt(p, sc), "3:4", []);
    sc.updatedAt = Date.now();
    await save();
    return sc.anchorRef;
  }

  /* ============ 场景卡增删 ============ */
  function addScene() {
    const p = state.project;
    p.scenes = p.scenes || [];
    const sc = { id: D.project.id("sc"), name: "场景 " + (p.scenes.length + 1), desc: "", anchorRef: "", updatedAt: Date.now() };
    p.scenes.push(sc);
    save();
    return sc;
  }

  function removeScene(sid) {
    const p = state.project;
    p.scenes = (p.scenes || []).filter(x => x.id !== sid);
    save();
  }

  /* ============ 多参考合并 ============ */
  /* 出图参考统一走角色解析器：三视图/多参考优先，再补场景锚点、额外参考与白模预览。 */
  function refsForShot(project, shot, cap) {
    return D.character.allRefsForShot(project, shot, cap || MAX_REFS);
  }

  function shotById(sid) { return (state.project.shots || []).find(s => s.id === sid) || null; }

  /* ============ 渲染 ============ */
  async function render() {
    ensureCss();
    D.ui.ensureCss();
    const v = view();
    if (!v) return;
    if (!state.project || !D.project.get(state.pid)) {
      try { await load(); } catch (e) { v.innerHTML = '<div class="dw-wrap"><div class="dw-card">' + esc((e && e.message) || "装载工程失败") + "</div></div>"; return; }
    }
    const p = state.project;
    const list = D.project.list();

    v.innerHTML = '<div class="dw-wrap">' +
      '<div class="dw-bar">' +
        '<select class="inp" id="mkProjSel" style="width:auto;min-width:160px">' +
          list.map(x => '<option value="' + esc(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" + esc(x.title) + "</option>").join("") +
        "</select>" +
        '<button class="btn small" id="mkGoHome">项目中心</button>' +
        '<button class="btn small" id="mkGoDrama">去导演台</button>' +
      "</div>" +
      tabsBar() +
      '<div id="mkBody"></div>' +
      '<div id="mkStatus"></div>' +
    "</div>";

    paintBody();
    bind(p);
    await hydrate(rootImgs());
  }

  function tabsBar() {
    return '<div class="mk-tabs">' + TABS.map(t =>
      '<div class="mk-tab' + (t.id === state.tab ? " on" : "") + '" data-mk-tab="' + t.id + '">' + esc(t.name) + "<small>" + esc(t.sub) + "</small></div>"
    ).join("") + "</div>";
  }

  function rootImgs() { return view(); }

  function paintBody() {
    const box = view().querySelector("#mkBody");
    if (!box) return;
    if (state.tab === "views") box.innerHTML = viewsHtml();
    else if (state.tab === "scenes") box.innerHTML = scenesHtml();
    else if (state.tab === "style") box.innerHTML = styleHtml();
    else box.innerHTML = refsHtml();
    bindBody();
  }

  function setStatus(text) {
    const el = view().querySelector("#mkStatus");
    if (el) el.innerHTML = text ? '<div class="dw-card" style="border-color:var(--border2)">' + esc(text) + "</div>" : "";
  }

  const imgTag = (ref, alt, cls) => ref
    ? '<img data-ref="' + esc(ref) + '" class="' + (cls || "") + '" alt="' + esc(alt || "") + '">'
    : "";

  /* ===== 三视图 ===== */
  function viewsHtml() {
    const p = state.project;
    const chars = p.characters || [];
    if (!chars.length) {
      return D.ui.emptyBox("还没有角色。先到导演台添加角色并写好外观，再回造型室出三视图。");
    }
    return '<div class="dw-card"><h3>角色三视图 <span class="dw-hint">（正面 / 侧面 / 背面，先把角色钉死，再逐镜生成就不容易崩脸）</span></h3>' +
      chars.map(c => charHtml(c)).join("") +
      '<div class="mk-note">出图需先在「设置 → 短剧服务」配置生图服务。侧面与背面会以正面图为参考，出好正面再出侧面、背面一致性更好。</div>' +
    "</div>";
  }

  function charHtml(c) {
    const done = VIEW_ORDER.filter(v => c.views && c.views[v.id]).length;
    return '<div class="mk-char" data-char="' + esc(c.id) + '">' +
      '<div class="mk-char-head">' +
        "<b>" + esc(c.name || "未命名角色") + "</b>" +
        '<span class="mk-ap">' + esc(D.character.displayAppearance(c) || "尚未填写外观") + "</span>" +
        '<span class="mk-count">' + done + "/3</span>" +
        '<button class="btn small primary" data-mk-all="' + esc(c.id) + '">一键出三视图</button>' +
      "</div>" +
      '<div class="mk-viewgrid">' + VIEW_ORDER.map(v => viewSlotHtml(c, v)).join("") + "</div>" +
    "</div>";
  }

  function viewSlotHtml(c, v) {
    const ref = (c.views && c.views[v.id]) || "";
    return '<div class="mk-slot">' +
      '<div class="mk-slot-body">' + (ref ? imgTag(ref, v.name) : '<span class="mk-slot-ph">' + esc(v.name) + "未生成</span>") + "</div>" +
      '<div class="mk-slot-foot"><b>' + esc(v.name) + "</b>" +
        '<span class="mk-sp"></span>' +
        '<button class="btn small" data-mk-view="' + esc(v.id) + '" data-mk-char-id="' + esc(c.id) + '">' + (ref ? "重出" : "生成") + "</button>" +
        (ref ? '<button class="btn small ghost" data-mk-view-clear="' + esc(v.id) + '" data-mk-char-id="' + esc(c.id) + '">清</button>' : "") +
      "</div>" +
    "</div>";
  }

  /* ===== 场景卡 ===== */
  function scenesHtml() {
    const p = state.project;
    const scenes = p.scenes || [];
    return '<div class="dw-card"><h3>场景卡 <span class="dw-hint">（每个场景一张锚点图，全片同一场景反复出现时保持一致）</span></h3>' +
      '<div class="dw-bar"><button class="btn small primary" id="mkSceneAdd">＋ 新建场景卡</button>' +
        '<span class="mk-count">共 ' + scenes.length + " 个场景</span></div>" +
      (scenes.length ? scenes.map(sc => sceneHtml(sc)).join("") : D.ui.emptyBox("还没有场景卡，先新建一个再写名字与描述。")) +
      '<div class="mk-note">场景锚点图不带人物，只定环境、光线与构图，方便分镜里同场景镜头保持同一空间感。</div>' +
    "</div>";
  }

  function sceneHtml(sc) {
    return '<div class="mk-scene" data-scene="' + esc(sc.id) + '">' +
      '<div class="mk-scene-anchor">' + (sc.anchorRef ? imgTag(sc.anchorRef, sc.name) : "<span>锚点图<br>未生成</span>") + "</div>" +
      '<div class="mk-scene-main">' +
        '<input class="inp" data-scene-name="' + esc(sc.id) + '" placeholder="场景名称，如：老宅客厅" value="' + esc(sc.name) + '">' +
        '<textarea class="inp" data-scene-desc="' + esc(sc.id) + '" rows="2" placeholder="场景描述：年代、陈设、光线、氛围">' + esc(sc.desc) + "</textarea>" +
        '<div class="dw-bar">' +
          '<button class="btn small" data-scene-gen="' + esc(sc.id) + '">' + (sc.anchorRef ? "重出锚点图" : "生成锚点图") + "</button>" +
          '<button class="btn small ghost" data-scene-del="' + esc(sc.id) + '">删除场景</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  }

  /* ===== 多参考 ===== */
  function refsHtml() {
    const p = state.project;
    const shots = p.shots || [];
    if (!shots.length) return D.ui.emptyBox("工程里还没有分镜。");
    const shot = shotById(state.shotCur) || shots[0];
    state.shotCur = shot.id;
    const roles = D.character.rolesForShot(p, shot);
    const auto = [];
    roles.forEach(c => (c.refImages || []).filter(Boolean).slice(0, MAX_REFS).forEach(u => auto.push({ cid: c.id, name: c.name, ref: u })));
    const extra = (shot.extraRefs || []).filter(Boolean);
    const total = refsForShot(p, shot).length;

    return '<div class="dw-card"><h3>本镜多参考 <span class="dw-hint">（每镜最多 ' + MAX_REFS + " 张，用参考图把这一镜的角色与场景钉死）</span></h3>" +
      '<div class="dw-bar">' +
        '<span class="mk-count">当前分镜</span>' +
        '<select class="inp" id="mkShotSel" style="width:auto;min-width:180px">' +
          shots.map(s => '<option value="' + esc(s.id) + '"' + (s.id === shot.id ? " selected" : "") + ">#" + s.seq + " " + esc(s.name || "") + "</option>").join("") +
        "</select>" +
        '<span class="mk-count">合并后本镜计 ' + total + "/" + MAX_REFS + " 张</span>" +
      "</div>" +
      '<div style="margin-top:10px"><div class="mk-count" style="margin-bottom:6px">角色自动参考（来自角色卡，只读）</div>' +
        (auto.length ? '<div class="mk-reflist">' + auto.map(a => refCardHtml(a.ref, a.name + " · 角色", true)).join("") + "</div>"
                     : D.ui.emptyBox("本镜还没选角色，或角色没有参考图。")) +
      "</div>" +
      '<div style="margin-top:12px"><div class="mk-count" style="margin-bottom:6px">额外参考（本镜专属，最多 ' + MAX_REFS + " 张）</div>" +
        '<div class="mk-reflist">' +
          extra.map((u, i) => refCardHtml(u, "额外 " + (i + 1), false, i)).join("") +
          (extra.length < MAX_REFS ? '<div class="mk-ref-add" data-mk-ref-add="1">＋<br>加参考</div>' : "") +
        "</div>" +
      "</div>" +
      '<input type="file" id="mkRefFile" accept="image/*" style="display:none">' +
      '<div class="mk-note">额外参考会在生成时分发给支持多图的服务（如 Seedance 2.0）。合并规则：角色参考先按轮询摊平取前 ' + MAX_REFS + " 张，再补本镜额外参考，整体不超过 " + MAX_REFS + " 张。</div>" +
    "</div>";
  }

  function refCardHtml(ref, label, auto, idx) {
    return '<div class="mk-ref' + (auto ? " auto" : "") + '">' +
      '<div class="mk-ref-body">' + imgTag(ref, label) + "</div>" +
      '<div class="mk-ref-foot">' +
        (auto ? '<span class="mk-count">' + esc(label) + "</span>"
              : '<span class="mk-count">' + esc(label) + "</span>" +
                '<button class="btn small ghost" data-mk-ref-del="' + idx + '" style="margin-left:auto">删</button>') +
      "</div>" +
    "</div>";
  }

  /* ===== 风格（画风预设） ===== */
  function styleHtml() {
    const p = state.project;
    const list = D.STYLES || [];
    return '<div class="dw-card"><h3>画风 <span class="dw-hint">（选一种画风，生成分镜时作为统一风格前缀）</span></h3>' +
      '<div class="mk-styles">' + list.map(s =>
        '<div class="mk-style' + (s.id === p.style ? " on" : "") + '" data-mk-style="' + esc(s.id) + '">' +
          "<b>" + esc(s.name) + "</b><span>" + esc(s.prompt) + "</span>" +
        "</div>"
      ).join("") + "</div>" +
      '<div class="mk-note">画风会写进每一镜的提示词前缀，保证全片视觉统一。选完立即生效。</div>' +
    "</div>";
  }

  /* ============ 事件绑定 ============ */
  function bind(p) {
    const v = view();
    v.querySelector("#mkProjSel").onchange = (e) => { switchProject(e.target.value); };
    v.querySelector("#mkGoHome").onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("dramaHome"); };
    v.querySelector("#mkGoDrama").onclick = async () => {
      if (D.manual && D.manual.load) await D.manual.load(state.pid);
      if (XLX.app && XLX.app.go) XLX.app.go("drama");
    };
    v.querySelectorAll("[data-mk-tab]").forEach(t => {
      t.onclick = () => { state.tab = t.dataset.mkTab; render(); };
    });
  }

  function bindBody() {
    const v = view();
    const p = state.project;

    /* 风格 */
    v.querySelectorAll("[data-mk-style]").forEach(el => {
      el.onclick = async () => { p.style = el.dataset.mkStyle; p.updatedAt = Date.now(); await save(); paintBody(); };
    });

    /* 三视图 */
    v.querySelectorAll("[data-mk-view]").forEach(b => {
      b.onclick = () => runView(b.dataset.mkCharId, b.dataset.mkView, b);
    });
    v.querySelectorAll("[data-mk-all]").forEach(b => {
      b.onclick = () => runAllViews(b.dataset.mkAll, b);
    });
    v.querySelectorAll("[data-mk-view-clear]").forEach(b => {
      b.onclick = async () => {
        const c = (p.characters || []).find(x => x.id === b.dataset.mkCharId);
        if (c && c.views) { c.views[b.dataset.mkViewClear] = ""; c.views.updatedAt = Date.now(); await save(); }
        paintBody();
        await hydrate(v);
      };
    });

    /* 场景卡 */
    const add = v.querySelector("#mkSceneAdd");
    if (add) add.onclick = async () => { addScene(); paintBody(); await hydrate(v); };
    v.querySelectorAll("[data-scene-name]").forEach(el => {
      el.onchange = async () => {
        const sc = (p.scenes || []).find(x => x.id === el.dataset.sceneName);
        if (sc) { sc.name = el.value; sc.updatedAt = Date.now(); await save(); }
      };
    });
    v.querySelectorAll("[data-scene-desc]").forEach(el => {
      el.onchange = async () => {
        const sc = (p.scenes || []).find(x => x.id === el.dataset.sceneDesc);
        if (sc) { sc.desc = el.value; sc.updatedAt = Date.now(); await save(); }
      };
    });
    v.querySelectorAll("[data-scene-gen]").forEach(b => {
      b.onclick = () => runScene(b.dataset.sceneGen, b);
    });
    v.querySelectorAll("[data-scene-del]").forEach(b => {
      b.onclick = async () => { removeScene(b.dataset.sceneDel); paintBody(); await hydrate(v); };
    });

    /* 多参考 */
    const sel = v.querySelector("#mkShotSel");
    if (sel) sel.onchange = async () => { state.shotCur = sel.value; paintBody(); await hydrate(v); };
    const addRef = v.querySelector("[data-mk-ref-add]");
    const file = v.querySelector("#mkRefFile");
    if (addRef && file) {
      addRef.onclick = () => file.click();
      file.onchange = async () => {
        const f = file.files && file.files[0];
        file.value = "";
        if (!f) return;
        const shot = shotById(state.shotCur);
        if (!shot) return;
        shot.extraRefs = shot.extraRefs || [];
        if (shot.extraRefs.length >= MAX_REFS) { U.toast("每镜最多 " + MAX_REFS + " 张", "warn"); return; }
        const url = URL.createObjectURL(f);
        const ref = await D.project.assets.toRef(url, { role: "ref" });
        URL.revokeObjectURL(url);
        shot.extraRefs.push(ref);
        await save();
        paintBody();
        await hydrate(v);
      };
    }
    v.querySelectorAll("[data-mk-ref-del]").forEach(b => {
      b.onclick = async () => {
        const shot = shotById(state.shotCur);
        if (!shot) return;
        shot.extraRefs = (shot.extraRefs || []).filter((_, i) => i !== Number(b.dataset.mkRefDel));
        await save();
        paintBody();
        await hydrate(v);
      };
    });
  }

  async function switchProject(pid) {
    state.pid = pid;
    state.project = null;
    state.shotCur = "";
    await load(pid);
    await render();
  }

  /* ============ 动作 ============ */
  async function runView(cid, viewId, btn) {
    if (state.busy) return;
    state.busy = true;
    if (btn) btn.textContent = "出图中…";
    setStatus("正在生成 " + (VIEW_ORDER.find(v => v.id === viewId) || {}).name + " 视图…");
    try {
      await generateView(cid, viewId);
      setStatus("");
      paintBody();
      await hydrate(view());
    } catch (e) {
      U.toast((e && e.message) || "生成失败", "err");
      setStatus((e && e.message) || "生成失败");
    } finally {
      state.busy = false;
    }
  }

  async function runAllViews(cid, btn) {
    if (state.busy) return;
    state.busy = true;
    if (btn) btn.disabled = true;
    try {
      for (const v of VIEW_ORDER) {
        setStatus("正在生成 " + v.name + " 视图…");
        await generateView(cid, v.id);
      }
      setStatus("");
      U.toast("三视图已出好", "ok");
      paintBody();
      await hydrate(view());
    } catch (e) {
      U.toast((e && e.message) || "生成失败", "err");
      setStatus((e && e.message) || "生成失败");
    } finally {
      state.busy = false;
      if (btn) btn.disabled = false;
    }
  }

  async function runScene(sid, btn) {
    if (state.busy) return;
    state.busy = true;
    if (btn) btn.textContent = "出图中…";
    setStatus("正在生成场景锚点图…");
    try {
      await generateScene(sid);
      setStatus("");
      paintBody();
      await hydrate(view());
    } catch (e) {
      U.toast((e && e.message) || "生成失败", "err");
      setStatus((e && e.message) || "生成失败");
    } finally {
      state.busy = false;
    }
  }

  /* ============ 资源水合 ============ */
  async function hydrate(root) {
    const imgs = root.querySelectorAll("img[data-ref]");
    for (const img of imgs) {
      const ref = img.dataset.ref;
      if (!ref || !String(ref).startsWith("asset:")) continue;
      const u = await D.project.assets.hydrateRef(ref);
      if (u) img.src = u;
    }
  }

  D.makeup = {
    render, load, state,
    TABS, VIEW_ORDER, MAX_REFS,
    viewPrompt, scenePrompt, refsForShot,
    generateView, generateScene,
    addScene, removeScene, characterText
  };
})();
