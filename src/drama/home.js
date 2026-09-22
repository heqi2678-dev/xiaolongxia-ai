/* 铜龙电商 · AI 短剧工作台 · 项目中心（首页） */
/* 工程卡片网格 + 搜索/排序/筛选 + 一键题材模板。打开工程时按 mode 分流到导演台或流水线。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const state = { q: "", sort: "updated", genre: "", busy: false, covers: {} };

  function view() { return document.getElementById("dwHome"); }

  /* ===== LibTV 风首页样式 ===== */
  const CSS = `
.hm-hero{position:relative;border:1px solid var(--border);border-radius:16px;overflow:hidden;padding:24px 20px;margin-bottom:14px;
  background:radial-gradient(120% 160% at 0% 0%,rgba(255,90,60,.16),transparent 55%),
    radial-gradient(120% 160% at 100% 0%,rgba(255,143,90,.10),transparent 55%),var(--panel)}
.hm-hero h1{font-size:23px;font-weight:800;letter-spacing:.5px;margin:0 0 4px}
.hm-hero p{margin:0 0 14px;color:var(--text2);font-size:12px}
.hm-hero .hm-hero-acts{display:flex;gap:8px;flex-wrap:wrap}
.hm-assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:10px}
.hm-asset{display:flex;gap:10px;align-items:center;border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--card);cursor:pointer;transition:border-color .15s,transform .15s}
.hm-asset:hover{border-color:var(--accent);transform:translateY(-2px)}
.hm-asset-ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--accent-grad);color:#fff;flex:none}
.hm-asset-t{font-size:13px;font-weight:600}
.hm-asset-s{font-size:11px;color:var(--text3);line-height:1.5}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaHomeCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function filtered() {
    let list = D.project.list();
    list.forEach(D.project.migrate);
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(p => String(p.title || "").toLowerCase().indexOf(q) >= 0);
    if (state.genre) list = list.filter(p => p.genre === state.genre);
    const by = {
      updated: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
      created: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      title: (a, b) => String(a.title || "").localeCompare(String(b.title || ""), "zh")
    };
    return list.sort(by[state.sort] || by.updated);
  }

  /* 封面可能是 asset: 引用，渲染后逐个换成可显示的 blob: */
  async function hydrateCovers(root, list) {
    for (const p of list) {
      if (!p.thumb || !String(p.thumb).startsWith("asset:")) continue;
      const el = root.querySelector('[data-cover="' + p.id + '"] img');
      if (!el) continue;
      if (state.covers[p.thumb] === undefined) {
        state.covers[p.thumb] = (await D.project.assets.hydrateRef(p.thumb)) || "";
      }
      if (state.covers[p.thumb]) el.src = state.covers[p.thumb];
    }
  }

  const ASSETS = [
    { tab: "views", name: "三视图", sub: "正 / 侧 / 背，把角色钉死" },
    { tab: "scenes", name: "场景卡", sub: "场景身份锚点，前后一致" },
    { tab: "refs", name: "多参考", sub: "每镜最多 3 张参考图" }
  ];
  const ASSET_ICONS = {
    views: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>',
    scenes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M4 18l5-5 3 3 4-4 4 4"/></svg>',
    refs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="14" height="12" rx="2"/><path d="M7 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/></svg>'
  };

  function hero() {
    return '<div class="hm-hero">' +
      "<h1>短剧工作室</h1>" +
      "<p>把想法铺成剧本与分镜，再把角色、场景与参考图一次钉死。</p>" +
      '<div class="hm-hero-acts">' +
        '<button class="btn primary" id="dwHomeNewManual">＋ 新建导演台工程</button>' +
        '<button class="btn" id="dwHomeNewAuto">＋ 新建流水线工程</button>' +
        '<button class="btn ghost" id="dwHomeMakeup">进入造型室</button>' +
      "</div>" +
    "</div>";
  }

  function assetsHtml() {
    return '<div class="hm-assets">' + ASSETS.map(a =>
      '<div class="hm-asset" data-asset-tab="' + D.ui.esc(a.tab) + '">' +
        '<span class="hm-asset-ic">' + (ASSET_ICONS[a.tab] || "") + "</span>" +
        "<div>" +
          '<div class="hm-asset-t">' + D.ui.esc(a.name) + "</div>" +
          '<div class="hm-asset-s">' + D.ui.esc(a.sub) + "</div>" +
        "</div>" +
      "</div>"
    ).join("") + "</div>";
  }

  function toolbar() {
    const genres = [{ id: "", name: "全部剧种" }].concat(D.GENRES);
    return '<div class="dw-bar">' +
      '<input class="inp" id="dwHomeQ" placeholder="搜索工程标题" style="width:auto;min-width:180px" value="' + D.ui.esc(state.q) + '">' +
      '<select class="inp" id="dwHomeGenre" style="width:auto;min-width:120px">' + D.ui.opts(genres, state.genre) + "</select>" +
      '<select class="inp" id="dwHomeSort" style="width:auto;min-width:130px">' +
        D.ui.opts([{ id: "updated", name: "最近更新" }, { id: "created", name: "创建时间" }, { id: "title", name: "按标题" }], state.sort) +
      "</select>" +
      "</div>";
  }

  function grid(list) {
    if (!list.length) {
      return D.ui.emptyBox(state.q || state.genre ? "没有匹配的工程，换个关键词试试。" : "还没有工程，从新建工程或下方题材模板开始。");
    }
    return '<div class="dw-grid-cards">' + list.map(p => {
      const card = D.ui.projectCard(p);
      return card.replace('<div class="dw-pcard-cover">', '<div class="dw-pcard-cover" data-cover="' + D.ui.esc(p.id) + '">');
    }).join("") + "</div>";
  }

  function tplGrid() {
    const list = D.templates.list();
    return '<div class="dw-tpl">' + list.map(t =>
      '<div class="dw-tpl-card" data-tpl="' + D.ui.esc(t.id) + '">' +
        '<div class="dw-tpl-name">' + D.ui.esc(t.name) + "</div>" +
        '<div class="dw-tpl-tag">' + D.ui.esc(t.tag) + " · " + t.shots.length + " 镜</div>" +
        '<div class="dw-tpl-desc">' + D.ui.esc(t.logline) + "</div>" +
      "</div>"
    ).join("") + "</div>";
  }

  async function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    const list = filtered();
    v.innerHTML = '<div class="dw-wrap">' +
      hero() +
      '<div class="dw-card"><h3>资产工作台 <span class="dw-hint">（开拍前先把角色与场景钉死）</span></h3>' +
        assetsHtml() +
      "</div>" +
      '<div class="dw-card"><h3>我的工程 <span class="dw-hint" id="dwHomeCount">（共 ' + list.length + ' 个工程）</span></h3>' +
        toolbar() +
        '<div id="dwHomeGrid" style="margin-top:12px">' + grid(list) + "</div>" +
      "</div>" +
      '<div class="dw-card"><h3>题材模板 <span class="dw-hint">（一键铺好剧本骨架与分镜示例）</span></h3>' +
        '<div id="dwHomeTpl" style="margin-top:10px">' + tplGrid() + "</div>" +
      "</div>" +
    "</div>";
    bind(v);
    await hydrateCovers(v, list);
  }

  function bind(v) {
    v.querySelector("#dwHomeQ").oninput = (e) => { state.q = e.target.value; rerenderGrid(); };
    v.querySelector("#dwHomeGenre").onchange = (e) => { state.genre = e.target.value; rerenderGrid(); };
    v.querySelector("#dwHomeSort").onchange = (e) => { state.sort = e.target.value; rerenderGrid(); };
    v.querySelector("#dwHomeNewManual").onclick = () => createBlank("manual");
    v.querySelector("#dwHomeNewAuto").onclick = () => createBlank("pipeline");
    v.querySelector("#dwHomeMakeup").onclick = () => openMakeup("");
    v.querySelectorAll("[data-asset-tab]").forEach(a => { a.onclick = () => openMakeup("", a.dataset.assetTab); });

    v.querySelectorAll("[data-pcard-open]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); open(b.dataset.pcardOpen); }; });
    v.querySelectorAll("[data-pcard-makeup]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); openMakeup(b.dataset.pcardMakeup); }; });
    v.querySelectorAll("[data-pcard-copy]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); copy(b.dataset.pcardCopy); }; });
    v.querySelectorAll("[data-pcard-del]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); del(b); }; });
    v.querySelectorAll(".dw-pcard").forEach(c => { c.onclick = () => open(c.dataset.pid); });

    v.querySelectorAll("[data-tpl]").forEach(c => { c.onclick = () => useTemplate(c.dataset.tpl); });
  }

  function rerenderGrid() {
    const v = view();
    if (!v) return;
    const box = v.querySelector("#dwHomeGrid");
    const list = filtered();
    box.innerHTML = grid(list);
    v.querySelector("#dwHomeCount").textContent = "（共 " + list.length + " 个工程）";
    box.querySelectorAll("[data-pcard-open]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); open(b.dataset.pcardOpen); }; });
    box.querySelectorAll("[data-pcard-makeup]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); openMakeup(b.dataset.pcardMakeup); }; });
    box.querySelectorAll("[data-pcard-copy]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); copy(b.dataset.pcardCopy); }; });
    box.querySelectorAll("[data-pcard-del]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); del(b); }; });
    box.querySelectorAll(".dw-pcard").forEach(c => { c.onclick = () => open(c.dataset.pid); });
    hydrateCovers(box, list);
  }

  async function createBlank(mode) {
    if (state.busy) return;
    state.busy = true;
    try {
      const p = D.project.blank({ mode });
      await D.project.save(p);
      await open(p.id);
    } catch (e) {
      U.toast((e && e.message) || "新建失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function useTemplate(tid) {
    if (state.busy) return;
    const tpl = D.templates.get(tid);
    if (!tpl) { U.toast("模板不存在", "warn"); return; }
    state.busy = true;
    try {
      const p = D.project.blank({ title: tpl.name + "·" + new Date().toLocaleDateString(), genre: tpl.genre, mode: "manual", templateId: tpl.id });
      D.templates.apply(p, tpl);
      await D.project.save(p);
      U.toast("已按「" + tpl.name + "」建好工程", "ok");
      await open(p.id);
    } catch (e) {
      U.toast((e && e.message) || "套用模板失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function open(pid) {
    const p = D.project.get(pid);
    if (!p) { U.toast("工程不存在", "warn"); return; }
    D.project.migrate(p);
    try {
      if (p.mode === "pipeline") {
        if (D.auto.open) await D.auto.open(pid);
        if (XLX.app && XLX.app.go) XLX.app.go("auto");
      } else {
        if (D.manual.load) await D.manual.load(pid);
        if (XLX.app && XLX.app.go) XLX.app.go("drama");
      }
    } catch (e) {
      U.toast((e && e.message) || "打开工程失败", "err");
    }
  }

  async function openMakeup(pid, tab) {
    try {
      if (!pid) {
        const l = filtered();
        pid = l.length ? l[0].id : "";
      }
      if (!pid) { U.toast("先新建一个工程，再进造型室", "warn"); return; }
      if (D.makeup && D.makeup.load) await D.makeup.load(pid);
      if (D.makeup && D.makeup.state && tab) D.makeup.state.tab = tab;
      if (XLX.app && XLX.app.go) XLX.app.go("makeup");
    } catch (e) {
      U.toast((e && e.message) || "打开造型室失败", "err");
    }
  }

  async function copy(pid) {
    try {
      const c = await D.project.duplicate(pid);
      U.toast("已复制为「" + c.title + "」", "ok");
      await render();
    } catch (e) {
      U.toast((e && e.message) || "复制失败", "err");
    }
  }

  /* 两步删除：第一下变确认，第二下才真删，避免误触 */
  function del(btn) {
    const pid = btn.dataset.pcardDel;
    if (btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      btn.textContent = "再点一次删除";
      setTimeout(() => {
        if (btn.dataset.confirm === "1") { btn.dataset.confirm = ""; btn.textContent = "删除"; }
      }, 4000);
      return;
    }
    D.project.remove(pid);
    if (D.project.remote && D.project.remote.remove) D.project.remote.remove(pid).catch(() => {});
    U.toast("工程已删除", "ok");
    render();
  }

  D.home = { render, open, openMakeup, state };
})();
