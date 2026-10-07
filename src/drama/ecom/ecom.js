/* 铜龙AI · 电商工作台 · 分区注册、导航与视图骨架 */
/* 第二分区「电商工作台」：7 页创作工作台。NAV/VIEWS/TITLES 在此注册，各视图渲染器随后按 register 挂入。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const U = XLX.util || {};

  const ZONE = "ecom";
  const DEFAULT_VIEW = "ecomHome";

  /* 电商分区左侧导航（自上而下，7 项） */
  const NAV = [
    { id: "ecomHome", label: "工作台", icon: "home" },
    { id: "ecomDraw", label: "AI 作图", icon: "wand" },
    { id: "ecomDetail", label: "AI 详情图", icon: "poster" },
    { id: "ecomMainEdit", label: "主图编辑", icon: "crop" },
    { id: "ecomDetailEdit", label: "详情页编辑", icon: "layers" },
    { id: "ecomLocalize", label: "跨境本地化", icon: "translate" },
    { id: "ecomGallery", label: "作品库", icon: "grid" }
  ];
  const VIEWS = NAV.map(n => n.id);

  /* 视图标题与副标题（顶栏文案） */
  const TITLES = {
    ecomHome: ["工作台", "能力入口 · 数据概览 · 最近项目"],
    ecomDraw: ["AI 作图", "万能修图间 · 12 工具 · 大白话出图"],
    ecomDetail: ["AI 详情图", "上传商品图 · 一键生成整套详情"],
    ecomMainEdit: ["主图编辑", "元素精修 · 列表 / 画布双模式"],
    ecomDetailEdit: ["详情页编辑", "模块排版 · 长图导出"],
    ecomLocalize: ["跨境本地化", "换语言 · 换模特 · 平台适配"],
    ecomGallery: ["作品库", "搜索 · 筛选 · 再编辑 · 批量下载"]
  };

  /* 已注册的视图渲染器：view → fn(el, view) */
  const RENDERERS = {};

  function esc(s) {
    if (U.esc) return U.esc(s);
    return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function icon(id) {
    const item = NAV.find(n => n.id === id) || {};
    return (XLX.ICONS && XLX.ICONS[item.icon]) || "";
  }

  function host(view) { return document.getElementById(view + "View"); }

  function placeholder(view) {
    const m = TITLES[view] || ["电商工作台", "建设中"];
    return '<div class="ecom-ph" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;color:var(--text2)">'
      + '<div style="width:56px;height:56px;border-radius:16px;background:rgba(255,90,60,.12);color:var(--accent);display:flex;align-items:center;justify-content:center;margin-bottom:14px"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon(view) + "</svg></div>"
      + '<div style="font-weight:800;font-size:16px;margin-bottom:6px">' + esc(m[0]) + "</div>"
      + '<div style="font-size:13px;color:var(--text3)">' + esc(m[1]) + "（建设中）</div>"
      + "</div>";
  }

  /* 渲染指定电商视图；未注册渲染器时输出占位空态 */
  function render(view) {
    const el = host(view);
    if (!el) return;
    const fn = RENDERERS[view];
    if (fn) return fn(el, view);
    el.innerHTML = placeholder(view);
  }

  function register(view, fn) { RENDERERS[view] = fn; }

  /* ---------------- 后端通道（统一 /dian/api/ecom/*，同源 JSON） ---------------- */
  function api(method, path, body) {
    const p = (path || "").indexOf("http") === 0
      ? path
      : "/dian/api/ecom" + (path && path[0] === "/" ? path : "/" + (path || ""));
    const opts = { method: method || "GET", credentials: "same-origin" };
    if (body !== undefined && body !== null) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    return fetch(p, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "HTTP_" + r.status }; })
        .then(function (j) {
          if (!r.ok || !j || j.ok === false) {
            const e = new Error((j && j.error) || ("HTTP_" + r.status));
            e.code = (j && j.code) || "http_" + r.status;
            e.status = r.status;
            throw e;
          }
          return j;
        });
    });
  }

  function toast(msg, type) {
    if (U.toast) U.toast(msg, type || "");
    else if (typeof console !== "undefined") console.log("[ecom]", msg);
  }

  function go(view) {
    if (XLX.app && XLX.app.go) XLX.app.go(view);
  }

  function fmtTime(ts) {
    if (!ts) return "-";
    if (U.fmtTime) return U.fmtTime(ts);
    return new Date(ts * 1000).toLocaleString();
  }

  /* ---------------- 用量累计（本地起算，默认全 0） ---------------- */
  const USAGE_KEY = "xlx_ecom_usage";
  function readUsage() {
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      const u = raw ? JSON.parse(raw) : null;
      return (u && typeof u === "object") ? u : {};
    } catch (e) { return {}; }
  }
  function writeUsage(u) {
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(u || {})); } catch (e) {}
  }
  function addUsage(patch) {
    const u = readUsage();
    Object.keys(patch || {}).forEach(function (k) {
      const n = Number(patch[k]) || 0;
      if (n) u[k] = (Number(u[k]) || 0) + n;
    });
    writeUsage(u);
    return u;
  }
  function stats() {
    const u = readUsage();
    return {
      generated: Number(u.generated) || 0,
      exported: Number(u.exported) || 0,
      tokens: Number(u.tokens) || 0,
      projects: Number(u.projects) || 0
    };
  }

  /* ---------------- 原型交互（作用域 .ecom-ui，事件委托） ---------------- */
  function bindInteractions() {
    if (window._ecomBound) return;
    window._ecomBound = true;
    document.addEventListener("click", function (e) {
      const root = e.target.closest ? e.target.closest(".ecom-ui") : null;
      if (!root) return;

      /* 工具卡：同组单选 */
      const tool = e.target.closest(".tool-card");
      if (tool && root.contains(tool)) {
        const grid = tool.parentElement;
        grid.querySelectorAll(".tool-card").forEach(x => x.classList.remove("on"));
        tool.classList.add("on");
        return;
      }

      /* chips：同组单选（与原型一致：已有选中则先清空） */
      const chip = e.target.closest(".chip");
      if (chip) {
        const g = chip.closest(".chips") || chip.parentElement;
        g.querySelectorAll(".chip").forEach(x => x.classList.remove("on"));
        chip.classList.add("on");
        return;
      }

      /* 色板：同组单选 */
      const sw = e.target.closest(".sw");
      if (sw) {
        const g = sw.closest(".swatches") || sw.parentElement;
        g.querySelectorAll(".sw").forEach(x => x.classList.remove("on"));
        sw.classList.add("on");
        return;
      }

      /* 开关 */
      const swt = e.target.closest(".switch");
      if (swt) { swt.classList.toggle("off"); return; }

      /* 列表 / 画布模式切换 */
      const modeBtn = e.target.closest("[data-mode-group] button");
      if (modeBtn) {
        const seg = modeBtn.closest("[data-mode-group]");
        const wrap = seg.closest(".editor-wrap") || root;
        seg.querySelectorAll("button").forEach(x => x.classList.remove("on"));
        modeBtn.classList.add("on");
        const mode = modeBtn.getAttribute("data-mode");
        const vl = wrap.querySelector(".view-list");
        const vc = wrap.querySelector(".view-canvas");
        if (vl) vl.hidden = mode !== "list";
        if (vc) vc.hidden = mode !== "canvas";
        return;
      }

      /* 灵感卡：填入最近的输入框 */
      const insp = e.target.closest(".insp-card");
      if (insp) {
        const ta = root.querySelector(".prompt-box textarea, textarea");
        if (ta) { ta.value = insp.textContent.trim(); ta.focus(); }
        return;
      }
    });
  }
  bindInteractions();

  D.ecom = {
    ZONE, NAV, VIEWS, DEFAULT_VIEW, TITLES, render, register, host, esc, icon,
    api, toast, go, fmtTime, USAGE_KEY, stats, addUsage
  };
})();
