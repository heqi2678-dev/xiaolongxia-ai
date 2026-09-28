/* 铜龙电商 · 图片工坊（设计稿 6.2-6.3 / HookShot 参照） */
/* 主图制作与详情页：选择来源与配方 → 平台与分辨率 → 批量提交 → 预览下载。素材沉淀到素材库。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const ROLE_LABEL = {
    white: "白底图", promo: "卖点图", detail: "细节图", size: "尺寸图",
    scene: "使用场景图", scene_render: "场景渲染图", poster: "营销海报",
    detail_long: "详情长图", recreate: "图片复刻", main: "主图", edit: "处理图"
  };

  const TABS = [
    { id: "main", label: "主图制作", recipes: ["white", "promo", "detail", "size", "scene", "scene_render", "poster", "suite"] },
    { id: "detail", label: "详情页", recipes: ["detail_long", "recreate"] }
  ];

  const OP_LIST = ["cutout", "white_bg", "bg_replace", "dedup", "scale", "copy", "crop", "relight", "compose", "template"];

  const S = {
    tab: "main",
    recipe: "white",
    ops: {},
    platform: "douyin",
    specId: "main_square",
    size: "",
    sync: true,
    catalog: null,
    outputs: [],
    taskId: ""
  };

  function empty(t) { return '<div class="ecom-empty">' + esc(t) + "</div>"; }

  function recipeLabel(id) {
    const list = (S.catalog && S.catalog.recipes) || [];
    const r = list.filter(function (x) { return x.id === id; })[0];
    return (r && r.label) || id;
  }

  function roleLabel(role) { return ROLE_LABEL[role] || role || "-"; }

  function opLabel(id) {
    const list = (S.catalog && S.catalog.processors) || [];
    const p = list.filter(function (x) { return x.id === id; })[0];
    return (p && p.label) || id;
  }

  function specs() { return (S.catalog && S.catalog.sizes) || []; }

  function specLabel(id) {
    const s = specs().filter(function (x) { return x.id === id; })[0];
    if (!s) return "";
    return s.label + "（" + s.width + "×" + s.height + "）";
  }

  function currentRecipe() {
    const list = (S.catalog && S.catalog.recipes) || [];
    return list.filter(function (x) { return x.id === S.recipe; })[0] || null;
  }

  function resetOps() {
    S.ops = {};
    const r = currentRecipe();
    ((r && r.ops) || []).forEach(function (op) { S.ops[op] = 1; });
  }

  function loadCatalog(el) {
    return EC.api("GET", "/assets/recipes").then(function (res) {
      S.catalog = res;
      if (!res.recipes.some(function (r) { return r.id === S.recipe; })) {
        S.recipe = (res.recipes[0] && res.recipes[0].id) || "white";
      }
      if (res.platforms && res.platforms.indexOf(S.platform) < 0) S.platform = res.platforms[0];
      if (res.sizes && !res.sizes.some(function (s) { return s.id === S.specId; })) {
        S.specId = (res.sizes[0] && res.sizes[0].id) || "";
      }
      resetOps();
      paint(el);
    }).catch(function (e) {
      const box = el.querySelector("#ecomImageMain");
      if (box) box.innerHTML = empty(e.message || "加载失败");
    });
  }

  function selectedCounts() {
    return {
      media: EC.getSelection("media").length,
      products: EC.getSelection("products").length
    };
  }

  function sourcePanel() {
    const c = selectedCounts();
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>处理来源</span>'
      + '<div class="ecom-line"><button class="ecom-link" data-view="ecomAssets">从素材库选</button>'
      + '<button class="ecom-link" data-view="ecomProducts">从商品库选</button></div></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-sel-count"><span>已选素材 <b>' + c.media + "</b> 项</span>"
      + "<span>已选商品 <b>" + c.products + "</b> 件</span></div>"
      + '<div class="ecom-hint">商品来源会以其主图作为处理底图；素材库选择集在本页直接读取，无需重复勾选。</div>'
      + "</div></div>";
  }

  function recipePanel() {
    const tab = TABS.filter(function (t) { return t.id === S.tab; })[0] || TABS[0];
    const chips = tab.recipes.map(function (id) {
      return '<button class="ecom-choice' + (S.recipe === id ? " active" : "") + '" data-recipe="' + esc(id) + '">' + esc(recipeLabel(id)) + "</button>";
    }).join("");
    const r = currentRecipe();
    const ops = OP_LIST.map(function (op) {
      return '<label class="ecom-op"><input type="checkbox" data-op="' + esc(op) + '"' + (S.ops[op] ? " checked" : "") + "> " + esc(opLabel(op)) + "</label>";
    }).join("");
    const hint = r ? "默认：" + (r.ops || []).map(opLabel).join(" / ") : "";
    return '<div class="ecom-panel"><div class="ecom-panel-h">'
      + '<div class="ecom-tabs">' + TABS.map(function (t) {
        return '<button class="ecom-tab' + (S.tab === t.id ? " active" : "") + '" data-tab="' + esc(t.id) + '">' + esc(t.label) + "</button>";
      }).join("") + "</div>"
      + '<span class="ecom-hint">配方</span></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-choices">' + chips + "</div>"
      + '<div class="ecom-field"><label class="ecom-label">处理器（可多选）</label><div class="ecom-ops">' + ops + "</div>"
      + (hint ? '<div class="ecom-hint">' + esc(hint) + "</div>" : "")
      + "</div></div>";
  }

  function specPanel() {
    const plat = (S.catalog && S.catalog.platforms) || ["douyin"];
    const pOpts = plat.map(function (p) {
      return '<option value="' + esc(p) + '"' + (p === S.platform ? " selected" : "") + ">" + esc(EC.platformText(p)) + "</option>";
    }).join("");
    const sOpts = specs().map(function (s) {
      return '<label class="ecom-choice' + (S.specId === s.id ? " active" : "") + '" data-spec="' + esc(s.id) + '">'
        + esc(s.label) + '<span class="ecom-choice-d">' + s.width + "×" + s.height + "</span></label>";
    }).join("");
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>平台与分辨率</span>'
      + '<span class="ecom-hint">内置对照表，可按需自定义</span></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-field"><label class="ecom-label">目标平台</label><select class="inp" id="ecomImagePlatform">' + pOpts + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">宽高比 / 分辨率</label><div class="ecom-choices ecom-choices-col">' + sOpts + "</div></div>"
      + '<div class="ecom-field"><label class="ecom-label">自定义分辨率（覆盖上方，如 800x800）</label>'
      + '<input class="inp" id="ecomImageSize" placeholder="留空则使用对照表" value="' + esc(S.size) + '"></div>'
      + "</div></div>";
  }

  function actionPanel() {
    const has = selectedCounts().media + selectedCounts().products;
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>提交处理</span>'
      + '<label class="ecom-op"><input type="checkbox" id="ecomImageSync"' + (S.sync ? " checked" : "") + "> 立即返回结果</label></div>"
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-hint">当前配方：' + esc(recipeLabel(S.recipe)) + " · 平台 " + esc(EC.platformText(S.platform)) + " · " + esc(S.size || specLabel(S.specId)) + "</div>"
      + '<div class="ecom-line"><button class="btn primary" id="ecomImageSubmit"' + (has ? "" : " disabled") + ">批量提交</button>"
      + '<button class="btn" data-view="ecomAssets">去素材库查看</button>'
      + (S.taskId ? '<button class="ecom-link" data-view="ecomTasks">任务中心</button>' : "")
      + "</div></div></div>";
  }

  function outputCard(o) {
    const dl = o.url ? '<a class="ecom-link" href="' + esc(o.url) + '" download target="_blank" rel="noopener">下载</a>' : '<span class="ecom-hint">无文件</span>';
    const img = o.url
      ? '<img class="ecom-thumb" src="' + esc(o.url) + '" alt="">'
      : '<div class="ecom-thumb ecom-thumb-ph">无图</div>';
    return '<div class="ecom-asset"><div class="ecom-asset-thumb">' + img + "</div>"
      + '<div class="ecom-asset-meta"><div class="ecom-row-t">' + esc(roleLabel(o.role)) + "</div>"
      + '<div class="ecom-row-d">' + esc(o.width + "×" + o.height) + " · " + esc(EC.platformText(S.platform)) + "</div>"
      + '<div class="ecom-row-d">' + esc((o.ops || []).map(opLabel).join(" / ") || "-") + "</div>"
      + '<div class="ecom-row-d">' + dl + "</div></div></div>";
  }

  function paintPreview(el) {
    const box = el.querySelector("#ecomImagePreview");
    if (!box) return;
    box.innerHTML = S.outputs.length
      ? '<div class="ecom-assets">' + S.outputs.map(outputCard).join("") + "</div>"
      : empty("提交后在此预览处理结果");
  }

  function paint(el) {
    const box = el.querySelector("#ecomImageMain");
    if (!box) return;
    box.innerHTML = '<div class="ecom-grid2">'
      + '<div class="ecom-col">' + sourcePanel() + recipePanel() + "</div>"
      + '<div class="ecom-col">' + specPanel() + actionPanel() + "</div>"
      + "</div>";
    bind(el);
    paintPreview(el);
  }

  function bind(el) {
    el.querySelectorAll("[data-view]").forEach(function (n) {
      n.onclick = function () { EC.go(n.getAttribute("data-view")); };
    });
    el.querySelectorAll("[data-tab]").forEach(function (n) {
      n.onclick = function () {
        S.tab = n.getAttribute("data-tab");
        const tab = TABS.filter(function (t) { return t.id === S.tab; })[0];
        if (tab && tab.recipes.indexOf(S.recipe) < 0) S.recipe = tab.recipes[0];
        resetOps();
        paint(el);
      };
    });
    el.querySelectorAll("[data-recipe]").forEach(function (n) {
      n.onclick = function () { S.recipe = n.getAttribute("data-recipe"); resetOps(); paint(el); };
    });
    el.querySelectorAll("[data-op]").forEach(function (n) {
      n.onchange = function () {
        const op = n.getAttribute("data-op");
        if (n.checked) S.ops[op] = 1; else delete S.ops[op];
      };
    });
    el.querySelectorAll("[data-spec]").forEach(function (n) {
      n.onclick = function () { S.specId = n.getAttribute("data-spec"); paint(el); };
    });
    const plat = el.querySelector("#ecomImagePlatform");
    if (plat) plat.onchange = function () { S.platform = plat.value; };
    const size = el.querySelector("#ecomImageSize");
    if (size) size.oninput = function () { S.size = size.value.trim(); };
    const sync = el.querySelector("#ecomImageSync");
    if (sync) sync.onchange = function () { S.sync = sync.checked; };
    const submit = el.querySelector("#ecomImageSubmit");
    if (submit) submit.onclick = function () { run(el); };
  }

  function run(el) {
    const mediaIds = EC.getSelection("media");
    const productIds = EC.getSelection("products");
    if (!mediaIds.length && !productIds.length) return EC.toast("请先选择素材或商品", "err");
    const body = {
      media_ids: mediaIds,
      product_ids: productIds,
      recipe: S.recipe,
      ops: Object.keys(S.ops),
      size: S.size,
      spec_id: S.size ? "" : S.specId,
      platform: S.platform,
      sync: S.sync ? true : undefined
    };
    const btn = el.querySelector("#ecomImageSubmit");
    if (btn) btn.disabled = true;
    EC.api("POST", "/assets/process", body).then(function (res) {
      if (btn) btn.disabled = false;
      S.taskId = res.task && res.task.id || "";
      if (S.sync) {
        S.outputs = res.outputs || [];
        EC.toast("已处理 " + S.outputs.length + " 张", "ok");
      } else {
        EC.toast("已提交后台任务", "ok");
      }
      paint(el);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      EC.toast(e.message || "提交失败", "err");
    });
  }

  function render(el) {
    el.innerHTML = '<div class="ecom-wrap">'
      + '<div id="ecomImageMain"><div class="ecom-empty">加载中…</div></div>'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>处理结果</span>'
      + '<button class="ecom-link" data-refresh>刷新配方表</button></div>'
      + '<div class="ecom-panel-b" id="ecomImagePreview">' + empty("提交后在此预览处理结果") + "</div></div>"
      + "</div>";
    const refresh = el.querySelector("[data-refresh]");
    if (refresh) refresh.onclick = function () { loadCatalog(el); };
    if (S.catalog) { paint(el); } else { loadCatalog(el); }
  }

  EC.register("ecomImage", render);
})();
