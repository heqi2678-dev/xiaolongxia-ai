/* 小龙虾 · AI 影视工作室 · LibTV 风格外壳 */
/* 左侧统一导航 + 顶部状态条 + 账号菜单；视图切换统一走 XLX.app.go */
(function () {
  /* 主导航（LibTV 左侧）。newProject 为主按钮，其余为视图入口 */
  const NAV = [
    { id: "newProject", label: "新建项目", icon: "plus", primary: true },
    { id: "agent", label: "Agent", icon: "chat" },
    { id: "home", label: "首页", icon: "home" },
    { id: "projects", label: "项目", icon: "film" },
    { id: "assets", label: "资产", icon: "palette" },
    { id: "tvshow", label: "TV Show", icon: "clapper", badge: "全网爆款" },
    { id: "ranking", label: "创作者挑战赛", icon: "trophy", badge: "王者大赛" },
    { id: "box3d", label: "3D-BOX", icon: "box" },
    { id: "plugin", label: "插件", icon: "hammer" }
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
    return NAV.filter(it => !it.primary).map(it =>
      '<button class="shell-nav-item" data-view="' + it.id + '" title="' + esc(it.label) + '">'
      + icon(it.icon) + '<span>' + esc(it.label) + '</span>'
      + (it.badge ? '<em class="shell-badge">' + esc(it.badge) + '</em>' : '')
      + '</button>'
    ).join("");
  }

  function sidebarHtml() {
    return ''
      + '<div class="shell-brand">'
      +   '<div class="shell-logo">' + icon("sparkle") + '</div>'
      +   '<div class="shell-brand-t"><b>小龙虾</b><i>AI 影视工作室</i></div>'
      + '</div>'
      + '<button class="shell-create" id="shellCreate">' + icon("plus") + '<span>新建项目</span></button>'
      + '<nav class="shell-nav" id="shellNavList">' + navHtml() + '</nav>';
  }

  function statusChipHtml() {
    const s = status();
    return icon("key")
      + '<span class="shell-chip-t"><b id="shellKeyText">' + s.keyText + '</b><i id="shellModelText">' + s.modelText + '</i></span>';
  }

  function topHtml() {
    const account = ACCOUNT.map(it =>
      '<button class="shell-menu-item" data-view="' + it.id + '">' + icon(it.icon) + '<span>' + esc(it.label) + '</span></button>'
    ).join("");
    return '<div class="shell-account" id="shellAccountBox">'
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
      if (create) create.addEventListener("click", () => { if (XLX.app && XLX.app.go) XLX.app.go("home"); });
    }
    const chip = document.getElementById("shellStatus");
    if (chip) {
      chip.innerHTML = statusChipHtml();
      chip.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("settings"); };
    }
    const top = document.getElementById("shellTop");
    if (top) {
      top.innerHTML = topHtml();
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
  }

  document.addEventListener("click", closeMenu);

  XLX.dramaShell = { NAV, ACCOUNT, mount, setActive, status, refresh, navHtml, sidebarHtml };
  XLX.shell = XLX.dramaShell;
})();
