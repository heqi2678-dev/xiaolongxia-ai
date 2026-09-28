/* 铜龙电商 · 电商首页（设计稿 2.2 / 2.3） */
/* 聚合入口与概览：五个能力卡 + 店铺概览 + 待办任务 + 最近采集/铺货。数据以服务端为准。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;
  const icon = EC.icon;

  const CAPS = [
    { view: "ecomCollect", icon: "download", t: "采集下载", d: "链接采集 · 整店采集 · 采集结果" },
    { view: "ecomImage", icon: "image", t: "图片工坊", d: "抠图 · 白底 · 去重 · 尺寸比例" },
    { view: "ecomAi", icon: "sparkle", t: "AI 创作", d: "商品图 · 场景图 · 详情页" },
    { view: "ecomPublish", icon: "send", t: "搬家铺货", d: "一键铺货 · 批量改价 · 上架节奏" },
    { view: "ecomCompliance", icon: "scan", t: "合规检测", d: "违禁词 · 侵权 · 重复铺货" }
  ];

  const ACTIVE = { scheduled: 1, queued: 1, running: 1, paused: 1 };

  function capCard(c) {
    return '<div class="ecom-card" data-view="' + c.view + '">'
      + '<div class="ecom-card-ic">' + svg(c.icon) + "</div>"
      + '<div class="ecom-card-t">' + esc(c.t) + "</div>"
      + '<div class="ecom-card-d">' + esc(c.d) + "</div>"
      + "</div>";
  }

  function svg(id) {
    const body = (XLX.ICONS && XLX.ICONS[id]) || "";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";
  }

  function tile(value, label) {
    return '<div class="ecom-tile"><div class="ecom-tile-v">' + esc(value) + '</div><div class="ecom-tile-k">' + esc(label) + "</div></div>";
  }

  function progress(p) {
    const v = Math.max(0, Math.min(100, Number(p) || 0));
    return '<div class="ecom-progress"><i style="width:' + v + '%"></i></div>';
  }

  function taskRow(t, withProgress) {
    const cls = "ecom-badge st-" + esc(t.status || "");
    return '<div class="ecom-row ecom-task-row" data-task="' + esc(t.id) + '">'
      + '<div class="ecom-row-main"><div class="ecom-row-t">' + esc(t.title || EC.kindText(t.kind)) + "</div>"
      + '<div class="ecom-row-d">' + esc(EC.kindText(t.kind)) + " · " + esc(EC.fmtTime(t.created_at)) + "</div></div>"
      + (withProgress ? '<div class="ecom-row-prog">' + progress(t.progress) + "</div>" : "")
      + '<span class="' + cls + '">' + esc(EC.statusText(t.status)) + "</span>"
      + "</div>";
  }

  function empty(text) { return '<div class="ecom-empty">' + esc(text) + "</div>"; }

  function render(el) {
    el.innerHTML = '<div class="ecom-wrap">'
      + '<div class="ecom-cards">' + CAPS.map(capCard).join("") + "</div>"
      + '<div id="ecomHomeTiles" class="ecom-tiles">' + tile("-", "商品库") + tile("-", "素材") + tile("-", "店铺") + tile("-", "已上架") + "</div>"
      + '<div class="ecom-grid2">'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>待办任务</span><button class="ecom-link" data-view="ecomTasks">全部任务</button></div>'
      + '<div class="ecom-panel-b" id="ecomHomeTodo">' + empty("加载中…") + "</div></div>"
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>最近采集 / 铺货</span><button class="ecom-link" data-view="ecomCollect">去采集</button></div>'
      + '<div class="ecom-panel-b" id="ecomHomeRecent">' + empty("加载中…") + "</div></div>"
      + "</div></div>";

    el.querySelectorAll("[data-view]").forEach(function (n) {
      n.onclick = function () { EC.go(n.getAttribute("data-view")); };
    });

    return Promise.all([
      EC.api("GET", "/stats").catch(function () { return null; }),
      EC.api("GET", "/shops").catch(function () { return { items: [] }; }),
      EC.api("GET", "/tasks?page_size=20").catch(function () { return { items: [] }; })
    ]).then(function (res) {
      if (!el.isConnected && !el.parentNode) return;
      const stats = res[0] || {};
      const shops = (res[1] && res[1].items) || [];
      const tasks = (res[2] && res[2].items) || [];

      const tiles = el.querySelector("#ecomHomeTiles");
      if (tiles) {
        tiles.innerHTML = tile(stats.products || 0, "商品库")
          + tile(stats.media || 0, "素材")
          + tile(stats.shops || 0, "店铺")
          + tile(stats.listings || 0, "已上架");
      }

      const todo = el.querySelector("#ecomHomeTodo");
      if (todo) {
        const active = tasks.filter(function (t) { return ACTIVE[t.status]; });
        todo.innerHTML = active.length
          ? active.slice(0, 6).map(function (t) { return taskRow(t, true); }).join("")
          : empty("暂无待办任务，去「采集下载」开始");
      }

      const recent = el.querySelector("#ecomHomeRecent");
      if (recent) {
        const rows = tasks.filter(function (t) { return t.kind === "collect" || t.kind === "publish"; });
        recent.innerHTML = rows.length
          ? rows.slice(0, 6).map(function (t) { return taskRow(t, false); }).join("")
          : empty(shops.length ? "还没有采集或铺货记录" : "先到「店铺与授权」绑定店铺");
      }

      el.querySelectorAll("[data-task]").forEach(function (n) {
        n.onclick = function () { EC.go("ecomTasks"); };
      });
    });
  }

  EC.register("ecomHome", render);
})();
