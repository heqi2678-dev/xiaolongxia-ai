/* 铜龙电商 · 电商工作台 · 分区注册、导航与视图骨架 */
/* 与短剧工作台并列的第二分区：导航、视图键、标题在此注册；各视图渲染器随后按 register 挂入。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const U = XLX.util || {};

  const ZONE = "ecom";
  const DEFAULT_VIEW = "ecomHome";

  /* 电商分区左侧导航（自上而下） */
  const NAV = [
    { id: "ecomHome", label: "首页", icon: "home" },
    { id: "ecomCollect", label: "采集下载", icon: "download" },
    { id: "ecomProducts", label: "商品库", icon: "cart" },
    { id: "ecomAssets", label: "素材库", icon: "palette" },
    { id: "ecomImage", label: "图片工坊", icon: "image" },
    { id: "ecomAi", label: "AI 创作", icon: "sparkle" },
    { id: "ecomPublish", label: "搬家铺货", icon: "send" },
    { id: "ecomCompliance", label: "合规检测", icon: "scan" },
    { id: "ecomShops", label: "店铺与授权", icon: "shopping" },
    { id: "ecomTasks", label: "任务中心", icon: "clock" }
  ];
  const VIEWS = NAV.map(n => n.id);

  /* 视图标题与副标题（顶栏文案） */
  const TITLES = {
    ecomHome: ["电商首页", "能力入口 · 店铺概览 · 待办任务"],
    ecomCollect: ["采集下载", "链接采集 · 整店采集 · 采集结果"],
    ecomProducts: ["商品库", "商品列表 · SKU · 版本记录"],
    ecomAssets: ["素材库", "图片视频 · 来源标注 · 关联商品"],
    ecomImage: ["图片工坊", "抠图 · 白底 · 去重 · 尺寸比例"],
    ecomAi: ["AI 创作", "商品图 · 场景图 · 详情页 · 模特图"],
    ecomPublish: ["搬家铺货", "一键铺货 · 批量改价 · 上架节奏"],
    ecomCompliance: ["合规检测", "违禁词 · 侵权 · 重复铺货 · 水印"],
    ecomShops: ["店铺与授权", "店铺列表 · 店群分组 · 授权管理"],
    ecomTasks: ["任务中心", "采集 / 处理 / 生成 / 铺货任务跟踪"]
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
    return '<div class="ecom-ph">'
      + '<div class="ecom-ph-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon(view) + "</svg></div>"
      + '<div class="ecom-ph-t">' + esc(m[0]) + "</div>"
      + '<div class="ecom-ph-d">' + esc(m[1]) + "（建设中）</div>"
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

  /* ---------------- 共享状态（设计稿 9.3：跨视图选择集） ---------------- */
  const STATE = {
    products: [],
    shops: [],
    params: {}
  };

  function setSelection(kind, ids) {
    STATE[kind] = Array.from(new Set((ids || []).map(String)));
    return STATE[kind];
  }

  function toggleSelection(kind, id) {
    id = String(id);
    const list = STATE[kind] || (STATE[kind] = []);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    return list.slice();
  }

  function getSelection(kind) { return (STATE[kind] || []).slice(); }

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

  /* ---------------- 常量 ---------------- */
  const TERMINAL = { succeeded: 1, partial: 1, failed: 1, canceled: 1 };
  const TASK_STATUS = {
    scheduled: "待执行", queued: "排队中", running: "执行中", paused: "已暂停",
    succeeded: "已完成", partial: "部分完成", failed: "失败", canceled: "已取消"
  };
  const TASK_KIND = {
    collect: "采集", publish: "铺货", price_adjust: "改价", listing: "上下架",
    assets: "图片处理", generate: "AI 生成", compliance: "合规检测"
  };
  const ITEM_STATUS = { pending: "待处理", done: "已完成", failed: "失败", canceled: "已取消" };
  const PLATFORM = {
    "1688": "1688", mock: "测试（mock）", taobao: "淘宝", pinduoduo: "拼多多",
    douyin: "抖音小店", kuaishou: "快手小店", tiktok: "TikTok Shop"
  };

  function statusText(s) { return TASK_STATUS[s] || ITEM_STATUS[s] || s || ""; }
  function kindText(k) { return TASK_KIND[k] || k || ""; }
  function platformText(p) { return PLATFORM[p] || p || ""; }
  function isTerminal(s) { return !!TERMINAL[s]; }

  function fmtTime(ts) {
    if (!ts) return "-";
    if (U.fmtTime) return U.fmtTime(ts);
    return new Date(ts * 1000).toLocaleString();
  }

  D.ecom = {
    ZONE, NAV, VIEWS, DEFAULT_VIEW, TITLES, render, register, host, esc, icon,
    api, toast, go, fmtTime,
    STATE, setSelection, toggleSelection, getSelection,
    TERMINAL, TASK_STATUS, ITEM_STATUS, statusText, kindText, platformText, isTerminal
  };
})();
