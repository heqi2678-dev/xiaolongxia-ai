/* 铜龙电商 · LibTV 风格外壳 */
/* 左侧统一导航 + 顶部状态条 + 账号菜单；视图切换统一走 XLX.app.go */
(function () {
  /* 主导航（LibTV 左侧）。newProject 为主按钮，sep 为分组分隔线，其余为视图入口 */
  const NAV = [
    { id: "newProject", label: "新建项目", icon: "plus", primary: true },
    { id: "agent", label: "铜龙电商 Agent", icon: "chat" },
    { id: "home", label: "首页", icon: "home" },
    { id: "projects", label: "项目", icon: "film" },
    { id: "assets", label: "资产", icon: "palette" },
    { id: "tvshow", label: "TV Show", icon: "clapper", badge: "全网爆款" },
    { id: "ranking", label: "创作者挑战赛", icon: "trophy", badge: "王者大赛" },
    { sep: true },
    { id: "box3d", label: "铜龙电商 3D-BOX", icon: "box" },
    { id: "plugin", label: "Blender 插件", sub: "铜龙电商 Plugin", icon: "hammer" },
    { id: "toolkit", label: "工具包", icon: "grid" }
  ];

  /* 账号菜单（从主导航移出，复用原视图） */
  const ACCOUNT = [
    { id: "settings", label: "设置", icon: "settings" },
    { id: "memory", label: "记忆习惯", icon: "brain" },
    { id: "download", label: "下载客户端", icon: "download" }
  ];

  function icon(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
      + ((XLX.ICONS && XLX.ICONS[n]) || "") + '</svg>';
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toast(msg, type) { if (XLX.util && XLX.util.toast) XLX.util.toast(msg, type); }

  /* 钥匙：已配置厂商数 / 厂商总数；模型：目录模型总数。失败降级为 0，不阻塞导航 */
  function keyStat() {
    try {
      const all = XLX.vendorKeys.all() || [];
      return { done: all.filter(v => XLX.vendorKeys.isConfigured(v.id)).length, total: all.length };
    } catch (e) { return { done: 0, total: 0 }; }
  }
  function modelCount() {
    try {
      const kinds = (XLX.catalog && XLX.catalog.KINDS) || [];
      return kinds.reduce((n, k) => n + XLX.catalog.all(k).length, 0);
    } catch (e) { return 0; }
  }
  function status() {
    const k = keyStat();
    const models = modelCount();
    return {
      keys: k.done,
      totalKeys: k.total,
      models,
      keyText: "钥匙 " + k.done + "/" + k.total,
      modelText: "模型 " + models
    };
  }

  function navHtml() {
    return NAV.filter(it => !it.primary).map(it => it.sep
      ? '<div class="shell-nav-sep"></div>'
      : '<button class="shell-nav-item" data-view="' + it.id + '" title="' + esc(it.label) + '">'
      + icon(it.icon)
      + '<span class="shell-nav-txt">' + esc(it.label) + (it.sub ? '<i class="shell-nav-sub">' + esc(it.sub) + '</i>' : "") + "</span>"
      + (it.badge ? '<em class="shell-badge">' + esc(it.badge) + '</em>' : '')
      + '</button>'
    ).join("");
  }

  function sidebarHtml() {
    return ''
      + '<div class="shell-brand">'
      +   '<div class="shell-logo">' + icon("sparkle") + '</div>'
      +   '<div class="shell-brand-t"><b>铜龙电商</b></div>'
      + '</div>'
      + '<button class="shell-create" id="shellCreate">' + icon("plus") + '<span>新建项目</span></button>'
      + '<nav class="shell-nav" id="shellNavList">' + navHtml() + '</nav>';
  }

  function statusChipHtml() {
    const s = status();
    return icon("key")
      + '<span class="shell-chip-t"><b id="shellKeyText">' + s.keyText + '</b><i id="shellModelText">' + s.modelText + '</i></span>';
  }

  /* 历史版本：本地快照（每个工程最多 20 条）。保存草稿时由 manual 调用 snapshot 写入 */
  const VKEY = "xlx_drama_versions";
  function readVers() { try { return JSON.parse(localStorage.getItem(VKEY) || "{}") || {}; } catch (e) { return {}; } }
  function writeVers(m) { try { localStorage.setItem(VKEY, JSON.stringify(m)); } catch (e) {} }
  function versions(pid) { return pid ? (readVers()[pid] || []) : []; }

  function snapshot(p) {
    if (!p || !p.id) return;
    const all = readVers();
    const list = all[p.id] || [];
    list.unshift({ at: Date.now(), title: p.title || "未命名工程", canvases: (p.canvases || []).length, shots: (p.shots || []).length, data: JSON.parse(JSON.stringify(p)) });
    all[p.id] = list.slice(0, 20);
    writeVers(all);
    refresh();
  }

  /* 当前打开的工程：从画布工作台状态取，其次取工程列表首个 */
  function currentProject() {
    const M = XLX.drama && XLX.drama.manual;
    const p = M && M.state && M.state.project;
    if (p && p.id) return p;
    const P = XLX.drama && XLX.drama.project;
    if (P && P.list) { const l = P.list(); if (l && l.length) return P.get(l[0].id) || l[0]; }
    return null;
  }

  function shareProject() {
    const p = currentProject();
    const url = location.origin + location.pathname + (p ? "#p=" + encodeURIComponent(p.id) : "");
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url); } catch (e) {}
    if (toast) toast("分享链接已复制：" + url, "ok");
    return url;
  }

  function restoreVersion(pid, idx) {
    const snap = versions(pid)[idx];
    if (!snap) return false;
    const P = XLX.drama && XLX.drama.project;
    const M = XLX.drama && XLX.drama.manual;
    if (P && P.save) P.save(snap.data);
    if (M && M.state && M.state.pid === pid) { M.state.project = null; M.state.sel = ""; }
    if (XLX.app && XLX.app.go) XLX.app.go("drama");
    if (M && M.render) M.render();
    if (toast) toast("已恢复到该历史版本", "ok");
    return true;
  }

  function openHistory() {
    const p = currentProject();
    const list = versions(p && p.id);
    const m = document.getElementById("modal");
    if (!m) return;
    if (!list.length) { if (toast) toast("当前工程暂无历史版本，保存草稿后会生成", "warn"); return; }
    m.innerHTML = '<div class="modal-box">'
      + '<div class="modal-head"><div><div class="mt">历史版本</div><div class="ms">' + esc(p.title || "工程") + " · 共 " + list.length + " 条</div></div></div>"
      + '<div class="modal-body"><div class="shell-hist-list">'
      + list.map((v, i) => '<div class="shell-hist-item"><div class="shell-hist-t"><b>' + esc(v.title || "未命名工程") + "</b><i>" + new Date(v.at).toLocaleString() + "</i></div>"
        + '<div class="shell-hist-m">画布 ' + v.canvases + " · 分镜 " + v.shots + '</div>'
        + '<button class="btn small primary" data-hist="' + i + '">恢复</button></div>').join("")
      + "</div></div>"
      + '<div class="modal-foot"><button class="btn ghost" id="shellHistClose">关闭</button></div></div>';
    m.classList.add("open");
    const close = () => m.classList.remove("open");
    m.querySelector("#shellHistClose").onclick = close;
    m.querySelectorAll("[data-hist]").forEach(b => {
      b.onclick = () => { close(); restoreVersion(p.id, Number(b.getAttribute("data-hist"))); };
    });
  }

  function actionsHtml() {
    const p = currentProject();
    const hasHist = versions(p && p.id).length > 0;
    return '<div class="shell-actions" id="shellActions">'
      + '<button class="shell-top-btn" id="shellShare" title="分享当前工程">' + icon("send") + '<span>分享</span></button>'
      + '<button class="shell-top-btn" id="shellHistory" title="' + (hasHist ? "查看历史版本" : "暂无历史版本") + '"' + (hasHist ? "" : " disabled") + ">" + icon("history") + '<span>历史</span></button>'
      + '</div>';
  }

  function topHtml() {
    const account = ACCOUNT.map(it =>
      '<button class="shell-menu-item" data-view="' + it.id + '">' + icon(it.icon) + '<span>' + esc(it.label) + '</span></button>'
    ).join("");
    return actionsHtml()
      + '<div class="shell-account" id="shellAccountBox">'
      + '<button class="shell-account-btn" id="shellAccountBtn">' + icon("user")
      +   '<span class="shell-acc-text"><b>我的</b><i>账号与设置</i></span>'
      +   '<em class="shell-caret">' + icon("arrow") + '</em>'
      + '</button>'
      + '<div class="shell-account-menu" id="shellAccountMenu">' + account + '</div>'
      + '</div>';
  }

  function closeMenu() {
    const m = document.getElementById("shellAccountMenu");
    if (m) m.classList.remove("open");
  }

  function setActive(view) {
    document.querySelectorAll(".shell-nav-item").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-view") === view);
    });
  }

  /* 侧栏挂载：主导航 + 顶部状态条 + 账号菜单（后两者若存在容器则渲染） */
  function mount(container) {
    const el = container || document.getElementById("shellNav");
    if (el) {
      el.innerHTML = sidebarHtml();
      const create = el.querySelector("#shellCreate");
      if (create) create.addEventListener("click", () => {
        const P = XLX.drama && XLX.drama.projects;
        if (P && P.newProject) { P.newProject(); return; }
        if (XLX.app && XLX.app.go) XLX.app.go("home");
      });
    }
    const chip = document.getElementById("shellStatus");
    if (chip) {
      chip.innerHTML = statusChipHtml();
      chip.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("settings"); };
    }
    const top = document.getElementById("shellTop");
    if (top) {
      top.innerHTML = topHtml();
      const sh = top.querySelector("#shellShare");
      if (sh) sh.onclick = () => shareProject();
      const hi = top.querySelector("#shellHistory");
      if (hi) { hi.disabled = !versions((currentProject() || {}).id).length; hi.onclick = () => openHistory(); }
      const ab = top.querySelector("#shellAccountBtn");
      if (ab) ab.addEventListener("click", e => {
        e.stopPropagation();
        const m = top.querySelector("#shellAccountMenu");
        if (m) m.classList.toggle("open");
      });
      top.querySelectorAll(".shell-menu-item").forEach(b => {
        b.addEventListener("click", () => {
          closeMenu();
          if (XLX.app && XLX.app.go) XLX.app.go(b.getAttribute("data-view"));
        });
      });
    }
    bindNav();
    setActive((XLX.app && XLX.app.currentView) || "agent");
    return el;
  }

  function bindNav() {
    document.querySelectorAll(".shell-nav-item").forEach(b => {
      if (b._shellBound) return;
      b._shellBound = true;
      b.addEventListener("click", () => {
        if (XLX.app && XLX.app.go) XLX.app.go(b.getAttribute("data-view"));
      });
    });
  }

  /* 状态变更后刷新文本，不重建 DOM */
  function refresh() {
    const s = status();
    const k = document.getElementById("shellKeyText");
    if (k) k.textContent = s.keyText;
    const m = document.getElementById("shellModelText");
    if (m) m.textContent = s.modelText;
    const hi = document.getElementById("shellHistory");
    if (hi) {
      const n = versions((currentProject() || {}).id).length;
      hi.disabled = !n;
      hi.title = n ? "查看历史版本（" + n + "）" : "暂无历史版本";
    }
  }

  document.addEventListener("click", closeMenu);

  XLX.dramaShell = { NAV, ACCOUNT, mount, setActive, status, refresh, navHtml, sidebarHtml, snapshot, versions, shareProject, openHistory, restoreVersion, currentProject };
  XLX.shell = XLX.dramaShell;
})();
