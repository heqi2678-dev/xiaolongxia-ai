/* 铜龙AI · 电商工作台 · 分区注册、导航与视图骨架 */
/* 第二分区「电商工作台」：7 页创作工作台。NAV/VIEWS/TITLES 在此注册，各视图渲染器随后按 register 挂入。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const U = XLX.util || {};

  const ZONE = "ecom";
  const DEFAULT_VIEW = "ecomHome";

  /* 电商分区左侧导航（自上而下，13 项；前 9 项与 51aic 同序） */
  const NAV = [
    { id: "ecomHome", label: "首页", icon: "home" },
    { id: "ecomDraw", label: "AI 作图", icon: "wand" },
    { id: "ecomDetail", label: "AI 详情图", icon: "poster" },
    { id: "ecomStyle", label: "风格复刻", icon: "palette" },
    { id: "ecomVideoI2V", label: "图生视频", icon: "video" },
    { id: "ecomVideoCopy", label: "视频复刻", icon: "film" },
    { id: "ecomVideoTranslate", label: "视频翻译", icon: "globe", badge: "NEW" },
    { id: "ecomVideoHome", label: "AI 视频", icon: "play", badge: "NEW" },
    { id: "ecomToolbox", label: "AI 工具箱", icon: "spark" },
    { id: "ecomMainEdit", label: "主图编辑", icon: "crop" },
    { id: "ecomDetailEdit", label: "详情页编辑", icon: "layers" },
    { id: "ecomLocalize", label: "跨境本地化", icon: "translate" },
    { id: "ecomGallery", label: "资产", icon: "grid" }
  ];
  const VIEWS = NAV.map(n => n.id);

  /* 视图标题与副标题（顶栏文案） */
  const TITLES = {
    ecomHome: ["首页", "能力入口 · 数据概览 · 最近项目"],
    ecomDraw: ["AI 作图", "万能修图间 · 12 工具 · 大白话出图"],
    ecomDetail: ["AI 详情图", "上传商品图 · 一键生成整套详情"],
    ecomStyle: ["风格复刻", "参考设计图定风格 · 结合产品属性"],
    ecomVideoI2V: ["图生视频", "参考图 · AI 帮写脚本 · 商品讲解视频"],
    ecomVideoCopy: ["视频复刻", "爆款参考视频 · 同款带货视频"],
    ecomVideoTranslate: ["视频翻译", "语音/字幕/画面文字 · 多语言出海"],
    ecomVideoHome: ["AI 视频", "图生视频 · 视频复刻 · 视频翻译"],
    ecomToolbox: ["AI 工具箱", "16 项编辑 · 本地即改即存 + AI 生成"],
    ecomMainEdit: ["主图编辑", "元素精修 · 列表 / 画布双模式"],
    ecomDetailEdit: ["详情页编辑", "模块排版 · 长图导出"],
    ecomLocalize: ["跨境本地化", "换语言 · 换模特 · 平台适配"],
    ecomGallery: ["资产", "搜索 · 筛选 · 再编辑 · 批量下载"]
  };

  /* ---------------- 共享常量（对齐 51aic，供各创作页复用） ---------------- */
  const CONST = {
    /* 目标平台（AI 作图 / AI 详情图共用，21 项） */
    PLATFORMS: ["智能匹配", "1688", "阿里国际站", "淘宝", "天猫", "拼多多", "京东", "抖音", "亚马逊", "TEMU", "eBay", "SHEIN", "Shopee", "Lazada", "TikTok", "Ozon", "速卖通", "独立站", "美客多", "小红书", "快手"],
    /* 文案语言（AI 作图 / AI 详情图共用，16 项） */
    LANGS: ["简体中文", "繁体中文", "英语", "日语", "韩语", "德语", "法语", "阿拉伯语", "俄语", "泰语", "印尼语", "越南语", "马来语", "西班牙语", "葡萄牙语", "巴西葡萄牙语"],
    /* 详情图尺寸比例（含中文后缀，10 项） */
    DETAIL_RATIOS: [
      { label: "1:1 正方形", value: "1:1" }, { label: "2:3 竖版", value: "2:3" }, { label: "3:2 横版", value: "3:2" },
      { label: "3:4 竖版", value: "3:4" }, { label: "4:3 横版", value: "4:3" }, { label: "4:5 竖版", value: "4:5" },
      { label: "5:4 横版", value: "5:4" }, { label: "9:16 手机竖版", value: "9:16" }, { label: "16:9 宽屏", value: "16:9" },
      { label: "21:9 超宽屏", value: "21:9" }
    ],
    /* 视频语言（图生视频 / 视频复刻 / 视频翻译共用，18 项） */
    VIDEO_LANGS: ["简体中文", "繁体中文", "英语", "泰语", "俄语", "越南语", "马来语", "葡萄牙语", "西班牙语", "日语", "韩语", "德语", "法语", "荷兰语", "波兰语", "土耳其语", "印尼语", "菲律宾语"],
    /* 详情图生成张数（1–15） */
    DETAIL_COUNTS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
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
    if (fn) fn(el, view);
    else el.innerHTML = placeholder(view);
    if (D.ecom && D.ecom.chrome && D.ecom.chrome.mount) D.ecom.chrome.mount(el, view);
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

  const pending = {};
  function openDraw(mode) {
    if (mode) pending.drawMode = mode;
    go("ecomDraw");
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

      /* 工作台入口卡：跳转到对应功能区 */
      const feat = e.target.closest(".feature[data-go]");
      if (feat && root.contains(feat)) { go(feat.getAttribute("data-go")); return; }

      /* 工具卡：同组单选 */
      const tool = e.target.closest(".tool-card");
      if (tool && root.contains(tool)) {
        const grid = tool.parentElement;
        grid.querySelectorAll(".tool-card").forEach(x => x.classList.remove("on"));
        tool.classList.add("on");
        return;
      }

      /* 编辑器工具栏：工具同组单选（不含列表/画布模式切换） */
      const editTool = e.target.closest(".toolbar .tool");
      if (editTool) {
        editTool.closest(".toolbar").querySelectorAll(".tool").forEach(x => x.classList.remove("on"));
        editTool.classList.add("on");
        return;
      }

      /* 编辑器列表：元素/模块行、图层、元素库块同组单选 */
      const row = e.target.closest(".module-row, .layer, .block");
      if (row) {
        const g = row.parentElement;
        g.querySelectorAll(":scope > *").forEach(x => x.classList.remove("on"));
        row.classList.add("on");
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
    });
  }
  bindInteractions();

  D.ecom = {
    ZONE, NAV, VIEWS, DEFAULT_VIEW, TITLES, render, register, host, esc, icon,
    api, toast, go, openDraw, pending, fmtTime, USAGE_KEY, stats, addUsage, const: CONST
  };
})();
