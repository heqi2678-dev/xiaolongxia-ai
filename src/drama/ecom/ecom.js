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
    if (fn) { fn(el, view); return; }
    el.innerHTML = placeholder(view);
  }

  function register(view, fn) { RENDERERS[view] = fn; }

  D.ecom = { ZONE, NAV, VIEWS, DEFAULT_VIEW, TITLES, render, register, host, esc };
})();
