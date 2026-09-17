/* 铜龙电商 · AI 短剧工作台 · 项目中心（首页） */
/* 工程卡片网格 + 搜索/排序/筛选 + 一键题材模板。打开工程时按 mode 分流到导演台或流水线。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const state = { q: "", sort: "updated", genre: "", busy: false, covers: {} };

  function view() { return document.getElementById("dwHome"); }

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

  function toolbar() {
    const genres = [{ id: "", name: "全部剧种" }].concat(D.GENRES);
    return '<div class="dw-bar">' +
      '<input class="inp" id="dwHomeQ" placeholder="搜索工程标题" style="width:auto;min-width:180px" value="' + D.ui.esc(state.q) + '">' +
      '<select class="inp" id="dwHomeGenre" style="width:auto;min-width:120px">' + D.ui.opts(genres, state.genre) + "</select>" +
      '<select class="inp" id="dwHomeSort" style="width:auto;min-width:130px">' +
        D.ui.opts([{ id: "updated", name: "最近更新" }, { id: "created", name: "创建时间" }, { id: "title", name: "按标题" }], state.sort) +
      "</select>" +
      '<button class="btn primary" id="dwHomeNewManual">＋ 新建导演台工程</button>' +
      '<button class="btn" id="dwHomeNewAuto">＋ 新建流水线工程</button>' +
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
    const v = view();
    if (!v) return;
    const list = filtered();
    v.innerHTML = '<div class="dw-wrap">' +
      '<div class="dw-card"><h3>项目中心 <span class="dw-hint">（共 ' + list.length + ' 个工程）</span></h3>' +
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

    v.querySelectorAll("[data-pcard-open]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); open(b.dataset.pcardOpen); }; });
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
    v.querySelector("h3 .dw-hint").textContent = "（共 " + list.length + " 个工程）";
    box.querySelectorAll("[data-pcard-open]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); open(b.dataset.pcardOpen); }; });
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

  D.home = { render, open, state };
})();
