/* 铜龙电商 · AI 短剧工作台 · 项目页 */
/* 工程卡网格 + 顶部工具行 + 搜索 + 文件夹分组 + 回收站。点开工程进入其画布。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const K_TRASH = "xlx_drama_trash";
  const K_FOLDERS = "xlx_drama_folders";
  const K_FOLDER_MAP = "xlx_drama_folder_map";

  const state = { q: "", folder: "", trash: false, busy: false, covers: {} };

  function view() { return document.getElementById("dwHome"); }

  /* ===== LibTV 项目页样式 ===== */
  const CSS = `
.pj-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pj-tools .pj-title{font-size:16px;font-weight:700;letter-spacing:.3px}
.pj-search{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:0 12px;height:36px}
.pj-search input{flex:1;background:none;border:none;outline:none;color:var(--text);font-size:13px}
.pj-folderbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.pj-folder{border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:999px;padding:5px 13px;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}
.pj-folder:hover{border-color:var(--accent);color:var(--text)}
.pj-folder.on{border-color:var(--accent);color:var(--accent2);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.pj-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
@media(max-width:1100px){.pj-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:680px){.pj-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.pj-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;position:relative}
.pj-card:hover{border-color:var(--accent);transform:translateY(-2px)}
.pj-card-cover{width:100%;aspect-ratio:16/10;background:#0d1420;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px;overflow:hidden}
.pj-card-cover img{width:100%;height:100%;object-fit:cover}
.pj-card-body{padding:9px 11px 11px;display:flex;flex-direction:column;gap:5px}
.pj-card-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pj-card-meta{font-size:11px;color:var(--text3);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pj-card-acts{display:flex;gap:6px;padding:0 11px 11px}
.pj-more{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:8px;border:1px solid var(--border);background:rgba(0,0,0,.45);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s}
.pj-card:hover .pj-more{opacity:1}
.pj-more-menu{position:absolute;top:36px;right:8px;z-index:30;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);padding:5px;min-width:132px}
.pj-more-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:var(--text);font-size:12px;padding:7px 9px;border-radius:7px;cursor:pointer}
.pj-more-menu button:hover{background:var(--panel2)}
.pj-newcard{border:1px dashed var(--border);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:150px;color:var(--text2);cursor:pointer;background:var(--card);transition:border-color .15s,color .15s}
.pj-newcard:hover{border-color:var(--accent);color:var(--accent2)}
.pj-newcard .pj-newplus{width:42px;height:42px;border-radius:13px;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaProjectsCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  /* ===== 回收站 / 文件夹（独立存储键，不动工程数据形态） ===== */
  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function trashIds() {
    const v = readJson(K_TRASH, []);
    return Array.isArray(v) ? v : [];
  }
  function setTrash(ids) { writeJson(K_TRASH, ids); }
  function folders() {
    const v = readJson(K_FOLDERS, []);
    return Array.isArray(v) ? v : [];
  }
  function folderMap() {
    const v = readJson(K_FOLDER_MAP, {});
    return v && typeof v === "object" ? v : {};
  }

  function allProjects() {
    const list = D.project.list();
    list.forEach(D.project.migrate);
    return list;
  }

  function filtered() {
    const trash = trashIds();
    let list = allProjects().filter(p => trash.indexOf(p.id) >= 0 === state.trash);
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(p => String(p.title || "").toLowerCase().indexOf(q) >= 0);
    if (state.folder && !state.trash) {
      const map = folderMap();
      list = list.filter(p => (map[p.id] || "") === state.folder);
    }
    const by = {
      updated: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
      created: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      title: (a, b) => String(a.title || "").localeCompare(String(b.title || ""), "zh")
    };
    return list.sort(by[state.folder === "__created" ? "created" : "updated"] || by.updated);
  }

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

  function card(p) {
    const cover = p.thumb && String(p.thumb).startsWith("asset:") ? "" : (p.thumb || "");
    const coverHtml = cover ? '<img src="' + D.ui.esc(cover) + '" alt="">' : "<span>暂无封面</span>";
    const when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "";
    const nCanv = (p.canvases || []).length || 1;
    const acts = state.trash
      ? '<button class="btn small primary" data-pj-restore="' + D.ui.esc(p.id) + '">恢复</button>' +
        '<button class="btn small ghost" data-pj-purge="' + D.ui.esc(p.id) + '">彻底删除</button>'
      : '<button class="btn small primary" data-pj-open="' + D.ui.esc(p.id) + '">打开</button>' +
        '<button class="btn small" data-pj-makeup="' + D.ui.esc(p.id) + '">造型</button>';
    return '<div class="pj-card" data-pid="' + D.ui.esc(p.id) + '">' +
      '<div class="pj-card-cover" data-cover="' + D.ui.esc(p.id) + '">' + coverHtml + "</div>" +
      (!state.trash ? '<div class="pj-more" data-pj-more="' + D.ui.esc(p.id) + '">⋯</div>' : "") +
      '<div class="pj-card-body">' +
        '<div class="pj-card-title">' + D.ui.esc(p.title || "未命名工程") + "</div>" +
        '<div class="pj-card-meta"><span>' + nCanv + " 张画布</span>" +
          (when ? "<span>" + D.ui.esc(when) + "</span>" : "") + "</div>" +
      "</div>" +
      '<div class="pj-card-acts">' + acts + "</div>" +
    "</div>";
  }

  function newCard() {
    return '<div class="pj-newcard" id="pjNew">' +
      '<div class="pj-newplus"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>' +
      "<div>开始创作</div></div>";
  }

  function tools() {
    const title = state.trash ? "回收站" : (state.folder ? ((folders().find(f => f.id === state.folder) || {}).name || "分组") : "全部项目");
    return '<div class="pj-tools">' +
      '<button class="btn small ghost" id="pjBack" title="返回首页">← 返回</button>' +
      '<span class="pj-title">' + D.ui.esc(title) + "</span>" +
      '<div class="pj-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>' +
        '<input id="pjQ" placeholder="搜索项目" value="' + D.ui.esc(state.q) + '">' +
      "</div>" +
      (state.trash
        ? '<button class="btn small" id="pjBackTrash">返回项目</button>'
        : '<button class="btn small" id="pjTrash">回收站</button>' +
          '<button class="btn small" id="pjFolder">新建文件夹</button>') +
    "</div>";
  }

  function folderBar() {
    if (state.trash) return "";
    const list = folders();
    if (!list.length) return "";
    return '<div class="pj-folderbar">' +
      '<button class="pj-folder' + (state.folder === "" ? " on" : "") + '" data-pj-folder="">全部</button>' +
      list.map(f => '<button class="pj-folder' + (state.folder === f.id ? " on" : "") + '" data-pj-folder="' + D.ui.esc(f.id) + '">' + D.ui.esc(f.name) + "</button>").join("") +
    "</div>";
  }

  function grid(list) {
    const head = state.trash ? "" : newCard();
    if (!list.length) {
      return '<div class="pj-grid">' + head +
        '<div style="grid-column:span 4">' + D.ui.emptyBox(state.trash ? "回收站是空的。" : (state.q ? "没有匹配的项目，换个关键词试试。" : "还没有项目，点左侧卡片开始创作。")) + "</div></div>";
    }
    return '<div class="pj-grid">' + head + list.map(card).join("") + "</div>";
  }

  async function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    const list = filtered();
    v.innerHTML = '<div class="dw-wrap">' + tools() + folderBar() + '<div id="pjGrid">' + grid(list) + "</div></div>";
    bind(v);
    await hydrateCovers(v, list);
  }

  function bind(v) {
    const q = v.querySelector("#pjQ");
    if (q) q.oninput = (e) => { state.q = e.target.value; rerender(); };
    const back = v.querySelector("#pjBack");
    if (back) back.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("home"); };
    const t = v.querySelector("#pjTrash");
    if (t) t.onclick = () => { state.trash = true; state.folder = ""; render(); };
    const bt = v.querySelector("#pjBackTrash");
    if (bt) bt.onclick = () => { state.trash = false; render(); };
    const nf = v.querySelector("#pjFolder");
    if (nf) nf.onclick = newFolder;
    v.querySelectorAll("[data-pj-folder]").forEach(b => { b.onclick = () => { state.folder = b.dataset.pjFolder; render(); }; });
    bindGrid(v);
  }

  function bindGrid(root) {
    const box = root.querySelector("#pjGrid");
    if (!box) return;
    box.querySelectorAll("[data-pj-open]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); open(b.dataset.pjOpen); }; });
    box.querySelectorAll("[data-pj-makeup]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); openMakeup(b.dataset.pjMakeup); }; });
    box.querySelectorAll("[data-pj-restore]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); restore(b.dataset.pjRestore); }; });
    box.querySelectorAll("[data-pj-purge]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); purge(b.dataset.pjPurge); }; });
    box.querySelectorAll("[data-pj-more]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); moreMenu(b); }; });
    box.querySelectorAll(".pj-card").forEach(c => { c.onclick = () => { if (!state.trash) open(c.dataset.pid); }; });
    const nw = box.querySelector("#pjNew");
    if (nw) nw.onclick = () => createBlank();
  }

  async function rerender() {
    const v = view();
    if (!v) return;
    const list = filtered();
    const box = v.querySelector("#pjGrid");
    box.innerHTML = grid(list);
    bindGrid(v);
    await hydrateCovers(v, list);
  }

  function newFolder() {
    const name = window.prompt("文件夹名称", "新分组");
    if (!name) return;
    const list = folders();
    list.push({ id: "f" + Date.now().toString(36), name: String(name).slice(0, 20), createdAt: Date.now() });
    writeJson(K_FOLDERS, list);
    U.toast("已新建文件夹", "ok");
    render();
  }

  function moreMenu(btn) {
    const host = btn.closest(".pj-card");
    if (!host) return;
    const pid = btn.dataset.pjMore;
    const old = host.querySelector(".pj-more-menu");
    if (old) { old.remove(); return; }
    const menu = document.createElement("div");
    menu.className = "pj-more-menu";
    const list = folders();
    menu.innerHTML = (list.length
      ? list.map(f => '<button data-move="' + D.ui.esc(f.id) + '">移入 ' + D.ui.esc(f.name) + "</button>").join("") + '<button data-move="">移出分组</button>'
      : '<button data-move="" disabled>先新建文件夹</button>')
      + '<button data-pj-trash="' + D.ui.esc(pid) + '">移入回收站</button>';
    host.appendChild(menu);
    menu.querySelectorAll("[data-move]").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const map = folderMap();
        if (b.dataset.move) map[pid] = b.dataset.move; else delete map[pid];
        writeJson(K_FOLDER_MAP, map);
        render();
      };
    });
    const tb = menu.querySelector("[data-pj-trash]");
    if (tb) tb.onclick = (e) => { e.stopPropagation(); trash(pid); };
    setTimeout(() => {
      const close = () => { menu.remove(); document.removeEventListener("click", close); };
      document.addEventListener("click", close);
    }, 0);
  }

  async function createBlank() {
    if (state.busy) return;
    state.busy = true;
    try {
      const p = D.project.blank({ title: "未命名项目" });
      await D.project.save(p);
      await open(p.id);
    } catch (e) {
      U.toast((e && e.message) || "新建失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function open(pid) {
    const p = D.project.get(pid);
    if (!p) { U.toast("工程不存在", "warn"); return; }
    D.project.migrate(p);
    try {
      if (D.manual.load) await D.manual.load(pid);
      if (XLX.app && XLX.app.go) XLX.app.go("drama");
    } catch (e) {
      U.toast((e && e.message) || "打开工程失败", "err");
    }
  }

  async function openMakeup(pid) {
    try {
      if (D.makeup && D.makeup.load) await D.makeup.load(pid);
      if (XLX.app && XLX.app.go) XLX.app.go("assets");
    } catch (e) {
      U.toast((e && e.message) || "打开资产失败", "err");
    }
  }

  function trash(pid) {
    const ids = trashIds();
    if (ids.indexOf(pid) < 0) ids.push(pid);
    setTrash(ids);
    const map = folderMap();
    if (map[pid]) { delete map[pid]; writeJson(K_FOLDER_MAP, map); }
    U.toast("已移入回收站", "ok");
    render();
  }

  function restore(pid) {
    setTrash(trashIds().filter(id => id !== pid));
    U.toast("已恢复", "ok");
    render();
  }

  function purge(pid) {
    D.project.remove(pid);
    if (D.project.remote && D.project.remote.remove) D.project.remote.remove(pid).catch(() => {});
    setTrash(trashIds().filter(id => id !== pid));
    U.toast("已彻底删除", "ok");
    render();
  }

  D.projects = { render, open, openMakeup, newProject: createBlank, trash, restore, purge, state, trashIds, setTrash };
})();
