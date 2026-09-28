/* 铜龙电商 · 商品库与素材库（设计稿 2.2 / 5.1-5.3 / 9.2） */
/* 商品库：筛选 + 列表 + 批量编辑 + 详情（SKU / 素材 / 版本记录）。素材库：按类型/来源/关联商品筛选，批处理入口。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const STATUS = { collected: "待编辑", pending: "待铺货", publishing: "铺货中", listed: "已上架", error: "异常" };
  const KINDS = { image: "图片", video: "视频" };
  const SOURCES = { collected: "采集", mock: "采集", ai: "AI 生成", edit: "图片处理" };
  const PAGE_SIZES = 20;

  const S = {
    p: { page: 1, keyword: "", platform: "", status: "", sort: "updated", items: [], total: 0, selected: {}, detailId: "", detail: null },
    a: { page: 1, kind: "", source: "", productId: "", items: [], total: 0, selected: {} }
  };

  function statusText(s) { return STATUS[s] || s || ""; }
  function statusBadge(s) { return '<span class="ecom-badge st-' + esc(s || "") + '">' + esc(statusText(s)) + "</span>"; }
  function sourceText(s) { return SOURCES[s] || s || ""; }
  function empty(t) { return '<div class="ecom-empty">' + esc(t) + "</div>"; }

  function money(v) {
    const n = Number(v);
    return isNaN(n) ? "-" : "¥" + n.toFixed(2);
  }

  function thumb(url, cls) {
    if (!url) return '<div class="ecom-thumb ecom-thumb-ph">无图</div>';
    return '<img class="ecom-thumb ' + (cls || "") + '" src="' + esc(url) + '" alt="">';
  }

  function pager(box, total, page, onGo) {
    if (!box) return;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZES));
    box.innerHTML = '<button class="ecom-link" data-pg="prev"' + (page <= 1 ? " disabled" : "") + ">上一页</button>"
      + '<span class="ecom-hint">第 ' + page + " / " + pages + " 页 · 共 " + total + " 件</span>"
      + '<button class="ecom-link" data-pg="next"' + (page >= pages ? " disabled" : "") + ">下一页</button>";
    box.querySelectorAll("[data-pg]").forEach(function (n) {
      if (n.disabled) return;
      n.onclick = function () { onGo(n.getAttribute("data-pg") === "next" ? page + 1 : page - 1); };
    });
  }

  /* ============================ 商品库 ============================ */

  function loadProducts(el) {
    const q = ["page=" + S.p.page, "page_size=" + PAGE_SIZES];
    if (S.p.keyword) q.push("keyword=" + encodeURIComponent(S.p.keyword));
    if (S.p.platform) q.push("platform=" + encodeURIComponent(S.p.platform));
    if (S.p.status) q.push("status=" + encodeURIComponent(S.p.status));
    if (S.p.sort === "price") q.push("sort=price");
    const box = el.querySelector("#ecomProductTable");
    if (box) box.innerHTML = empty("加载中…");
    return EC.api("GET", "/products?" + q.join("&")).then(function (res) {
      S.p.items = res.items || [];
      S.p.total = res.total || 0;
      paintProducts(el);
    }).catch(function (e) {
      if (box) box.innerHTML = empty(e.message || "加载失败");
    });
  }

  function productRows(el) {
    const items = S.p.items;
    if (!items.length) return empty("商品库还是空的，去「采集下载」抓一批");
    const head = '<tr><th class="ecom-ck"><input type="checkbox" data-all></th><th>主图</th><th>标题</th>'
      + "<th>来源</th><th>源价</th><th>库存</th><th>状态</th><th>更新</th><th></th></tr>";
    const body = items.map(function (p) {
      const checked = S.p.selected[p.id] ? " checked" : "";
      return '<tr data-id="' + esc(p.id) + '">'
        + '<td class="ecom-ck"><input type="checkbox" data-ck' + checked + "></td>"
        + "<td>" + thumb(p.main_image) + "</td>"
        + '<td><div class="ecom-cell-t">' + esc(p.title || "未命名") + '</div><div class="ecom-mono">' + esc(p.id) + "</div></td>"
        + "<td>" + esc(EC.platformText(p.source_platform)) + "</td>"
        + "<td>" + money(p.price) + "</td>"
        + "<td>" + esc(p.stock == null ? "-" : p.stock) + "</td>"
        + "<td>" + statusBadge(p.status) + "</td>"
        + "<td>" + esc(EC.fmtTime(p.updated_at)) + "</td>"
        + '<td><button class="ecom-link" data-detail>详情</button></td></tr>';
    }).join("");
    return '<table class="ecom-table ecom-ptable"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  function paintProducts(el) {
    const box = el.querySelector("#ecomProductTable");
    if (box) {
      box.innerHTML = productRows(el);
      box.querySelectorAll("tr[data-id]").forEach(function (tr) {
        const id = tr.getAttribute("data-id");
        const ck = tr.querySelector("[data-ck]");
        if (ck) ck.onchange = function () { if (ck.checked) S.p.selected[id] = 1; else delete S.p.selected[id]; paintBatchCount(el); };
      });
    }
    const all = el.querySelector("[data-all]");
    if (all) all.onchange = function () {
      S.p.selected = {};
      if (all.checked) S.p.items.forEach(function (p) { S.p.selected[p.id] = 1; });
      paintProducts(el);
    };
    box && box.querySelectorAll("[data-detail]").forEach(function (n) {
      n.onclick = function () { openDetail(el, n.closest("tr").getAttribute("data-id")); };
    });
    paintBatchCount(el);
    pager(el.querySelector("#ecomProductPager"), S.p.total, S.p.page, function (pg) {
      S.p.page = Math.max(1, pg);
      loadProducts(el);
    });
  }

  function paintBatchCount(el) {
    const n = Object.keys(S.p.selected).length;
    const tag = el.querySelector("#ecomBatchCount");
    if (tag) tag.textContent = n ? "已选 " + n + " 件" : "未选择";
  }

  function applyBatch(el) {
    const ids = Object.keys(S.p.selected);
    if (!ids.length) return EC.toast("请先选择商品", "err");
    const patch = {};
    const cat = (el.querySelector("#ecomBatchCategory").value || "").trim();
    const st = el.querySelector("#ecomBatchStatus").value;
    const tags = (el.querySelector("#ecomBatchTags").value || "").split(/[,，\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (cat) patch.category = cat;
    if (st) patch.status = st;
    if (tags.length) patch.tags = tags;
    if (!Object.keys(patch).length) return EC.toast("没有填写要批量修改的字段", "err");
    const btn = el.querySelector("#ecomBatchApply");
    if (btn) btn.disabled = true;
    EC.api("POST", "/products/batch", { ids: ids, patch: patch }).then(function (res) {
      if (btn) btn.disabled = false;
      EC.toast("已更新 " + (res.updated || ids.length) + " 件商品", "ok");
      S.p.selected = {};
      loadProducts(el);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      EC.toast(e.message || "批量编辑失败", "err");
    });
  }

  function detailHtml(d) {
    const p = d.product || {};
    const skus = d.skus || [];
    const media = d.media || [];
    const versions = d.versions || [];
    const report = d.report;
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>商品详情 · ' + esc(p.title || p.id) + "</span>"
      + '<button class="ecom-link" data-close>收起</button></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-detail">'
      + thumb(p.main_image, "ecom-thumb-lg")
      + '<div class="ecom-detail-form">'
      + field("标题", "text", "ecomEditTitle", p.title)
      + field("类目", "text", "ecomEditCategory", p.category)
      + field("源价", "number", "ecomEditPrice", p.price, "0.01")
      + field("库存", "number", "ecomEditStock", p.stock, "1")
      + '<div class="ecom-line"><button class="btn primary" data-save>保存商品</button>'
      + (report ? '<span class="ecom-hint">最近合规：' + esc(report.verdict || "-") + "</span>" : "") + "</div>"
      + '<div class="ecom-row-d">来源 ' + esc(EC.platformText(p.source_platform)) + " · " + esc(p.source_url || "-") + "</div>"
      + "</div></div>"
      + '<div class="ecom-sub-h">SKU（' + skus.length + "）</div>"
      + skuTable(skus)
      + '<div class="ecom-line"><button class="btn" data-save-skus>保存 SKU</button>'
      + '<button class="btn" data-add-sku>新增规格</button></div>'
      + '<div class="ecom-sub-h">素材（' + media.length + "）</div>"
      + (media.length ? '<div class="ecom-thumbs">' + media.slice(0, 12).map(function (m) { return thumb(m.url || m.source_url); }).join("") + "</div>" : empty("暂无素材"))
      + '<div class="ecom-sub-h">版本记录（' + versions.length + "）</div>"
      + (versions.length ? versions.map(function (v) {
        return '<div class="ecom-row"><div class="ecom-row-main"><div class="ecom-row-t">' + esc(v.note || "快照") + "</div>"
          + '<div class="ecom-row-d">' + esc(EC.fmtTime(v.created_at)) + "</div></div></div>";
      }).join("") : empty("暂无版本记录"))
      + "</div></div>";
  }

  function field(label, type, id, value, step) {
    return '<div class="ecom-field"><label class="ecom-label">' + esc(label) + "</label>"
      + '<input class="inp" id="' + id + '" type="' + type + '"' + (step ? ' step="' + step + '"' : "")
      + ' value="' + esc(value == null ? "" : value) + '"></div>';
  }

  function skuTable(skus) {
    const head = "<tr><th>规格</th><th>价格</th><th>库存</th><th>条码</th><th>启用</th></tr>";
    const body = skus.length ? skus.map(function (s) {
      return '<tr data-sku="' + esc(s.id) + '">'
        + '<td><input class="inp" data-k="spec" value="' + esc(s.spec || "") + '"></td>'
        + '<td><input class="inp" data-k="price" type="number" step="0.01" value="' + esc(s.price || 0) + '"></td>'
        + '<td><input class="inp" data-k="stock" type="number" value="' + esc(s.stock == null ? 0 : s.stock) + '"></td>'
        + '<td><input class="inp" data-k="barcode" value="' + esc(s.barcode || "") + '"></td>'
        + '<td class="ecom-ck"><input type="checkbox" data-k="enabled"' + (s.enabled ? " checked" : "") + "></td></tr>";
    }).join("") : '<tr><td colspan="5">' + empty("暂无 SKU，点「新增规格」") + "</td></tr>";
    return '<table class="ecom-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  function openDetail(el, id) {
    S.p.detailId = id;
    const box = el.querySelector("#ecomProductDetail");
    if (box) box.innerHTML = '<div class="ecom-panel"><div class="ecom-panel-b">' + empty("加载中…") + "</div></div>";
    EC.api("GET", "/products/" + encodeURIComponent(id)).then(function (d) {
      S.p.detail = d;
      paintDetail(el);
    }).catch(function (e) {
      if (box) box.innerHTML = '<div class="ecom-panel"><div class="ecom-panel-b">' + empty(e.message || "加载失败") + "</div></div>";
    });
  }

  function paintDetail(el) {
    const box = el.querySelector("#ecomProductDetail");
    if (!box || !S.p.detail) return;
    box.innerHTML = detailHtml(S.p.detail);
    box.querySelector("[data-close]").onclick = function () { S.p.detail = null; box.innerHTML = ""; };
    box.querySelector("[data-save]").onclick = function () {
      const body = {
        title: box.querySelector("#ecomEditTitle").value,
        category: box.querySelector("#ecomEditCategory").value,
        price: Number(box.querySelector("#ecomEditPrice").value) || 0,
        stock: parseInt(box.querySelector("#ecomEditStock").value, 10) || 0,
        note: "商品库编辑"
      };
      EC.api("PATCH", "/products/" + encodeURIComponent(S.p.detailId), body).then(function (d) {
        S.p.detail = d;
        EC.toast("已保存", "ok");
        paintDetail(el);
        loadProducts(el);
      }).catch(function (e) { EC.toast(e.message || "保存失败", "err"); });
    };
    box.querySelector("[data-save-skus]").onclick = function () { saveSkus(el, box); };
    box.querySelector("[data-add-sku]").onclick = function () {
      const tbody = box.querySelector("tbody");
      const tr = document.createElement("tr");
      tr.setAttribute("data-sku", "");
      tr.innerHTML = '<td><input class="inp" data-k="spec" value="新规格"></td>'
        + '<td><input class="inp" data-k="price" type="number" step="0.01" value="0"></td>'
        + '<td><input class="inp" data-k="stock" type="number" value="0"></td>'
        + '<td><input class="inp" data-k="barcode"></td>'
        + '<td class="ecom-ck"><input type="checkbox" data-k="enabled" checked></td>';
      if (tbody) {
        const placeholder = tbody.querySelector("td[colspan]");
        if (placeholder) tbody.innerHTML = "";
        tbody.appendChild(tr);
      }
    };
  }

  function saveSkus(el, box) {
    const rows = box.querySelectorAll("tr[data-sku]");
    if (!rows.length) return EC.toast("没有可保存的 SKU", "err");
    const skus = Array.prototype.map.call(rows, function (tr) {
      const get = function (k) { const n = tr.querySelector('[data-k="' + k + '"]'); return n ? n.value : ""; };
      const enabled = tr.querySelector('[data-k="enabled"]');
      return {
        spec: get("spec"), price: Number(get("price")) || 0, stock: parseInt(get("stock"), 10) || 0,
        barcode: get("barcode"), enabled: enabled && enabled.checked ? 1 : 0
      };
    });
    EC.api("PATCH", "/products/" + encodeURIComponent(S.p.detailId), { skus: skus, note: "SKU 编辑" }).then(function (d) {
      S.p.detail = d;
      EC.toast("SKU 已保存", "ok");
      paintDetail(el);
    }).catch(function (e) { EC.toast(e.message || "保存失败", "err"); });
  }

  function renderProducts(el) {
    const platforms = ["", "1688", "mock", "taobao", "pinduoduo"].map(function (v) {
      return opt(v, v ? EC.platformText(v) : "全部来源", S.p.platform);
    }).join("");
    const statuses = ["", "collected", "pending", "publishing", "listed", "error"].map(function (v) {
      return opt(v, v ? statusText(v) : "全部状态", S.p.status);
    }).join("");
    const batchStatuses = '<option value="">批量状态不变</option>' + ["collected", "pending", "publishing", "listed", "error"].map(function (v) {
      return opt(v, statusText(v), "");
    }).join("");
    const sorts = [["updated", "按更新时间"], ["price", "按价格"]].map(function (v) {
      return opt(v[0], v[1], S.p.sort);
    }).join("");

    el.innerHTML = '<div class="ecom-wrap">'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>商品筛选</span>'
      + '<button class="ecom-link" data-refresh>刷新</button></div>'
      + '<div class="ecom-panel-b"><div class="ecom-filters">'
      + '<input class="inp" id="ecomProductKeyword" placeholder="按标题搜索" value="' + esc(S.p.keyword) + '">'
      + '<select class="inp" id="ecomProductPlatform">' + platforms + "</select>"
      + '<select class="inp" id="ecomProductStatus">' + statuses + "</select>"
      + '<select class="inp" id="ecomProductSort">' + sorts + "</select>"
      + '<button class="btn primary" id="ecomProductSearch">查询</button>'
      + "</div></div></div>"
      + '<div id="ecomProductDetail"></div>'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>商品列表</span>'
      + '<span class="ecom-hint" id="ecomBatchCount">未选择</span></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-line ecom-batchbar">'
      + '<button class="ecom-link" data-select-all>全选本页</button>'
      + '<button class="ecom-link" data-select-none>清空选择</button>'
      + '<input class="inp" id="ecomBatchCategory" placeholder="批量类目">'
      + '<select class="inp" id="ecomBatchStatus">' + batchStatuses + "</select>"
      + '<input class="inp" id="ecomBatchTags" placeholder="批量标签，逗号分隔">'
      + '<button class="btn" id="ecomBatchApply">批量应用</button>'
      + "</div>"
      + '<div id="ecomProductTable">' + empty("加载中…") + "</div>"
      + '<div class="ecom-line" id="ecomProductPager"></div>'
      + "</div></div></div>";

    el.querySelector("[data-refresh]").onclick = function () { loadProducts(el); };
    el.querySelector("#ecomProductSearch").onclick = function () {
      S.p.keyword = el.querySelector("#ecomProductKeyword").value.trim();
      S.p.platform = el.querySelector("#ecomProductPlatform").value;
      S.p.status = el.querySelector("#ecomProductStatus").value;
      S.p.sort = el.querySelector("#ecomProductSort").value;
      S.p.page = 1;
      loadProducts(el);
    };
    el.querySelector("[data-select-all]").onclick = function () {
      S.p.items.forEach(function (p) { S.p.selected[p.id] = 1; });
      paintProducts(el);
    };
    el.querySelector("[data-select-none]").onclick = function () { S.p.selected = {}; paintProducts(el); };
    el.querySelector("#ecomBatchApply").onclick = function () { applyBatch(el); };

    if (S.p.detail) paintDetail(el);
    loadProducts(el);
  }

  function opt(value, label, current) {
    return '<option value="' + esc(value) + '"' + (String(value) === String(current) ? " selected" : "") + ">" + esc(label) + "</option>";
  }

  /* ============================ 素材库 ============================ */

  function loadAssets(el) {
    const q = ["page=" + S.a.page, "page_size=" + PAGE_SIZES];
    if (S.a.kind) q.push("kind=" + encodeURIComponent(S.a.kind));
    if (S.a.source) q.push("source=" + encodeURIComponent(S.a.source));
    if (S.a.productId) q.push("product_id=" + encodeURIComponent(S.a.productId));
    const box = el.querySelector("#ecomAssetGrid");
    if (box) box.innerHTML = empty("加载中…");
    return EC.api("GET", "/assets?" + q.join("&")).then(function (res) {
      S.a.items = res.items || [];
      S.a.total = res.total || 0;
      paintAssets(el);
    }).catch(function (e) {
      if (box) box.innerHTML = empty(e.message || "加载失败");
    });
  }

  function assetCard(m) {
    const meta = m.meta_json || {};
    const size = meta.width && meta.height ? meta.width + "×" + meta.height : "-";
    const checked = S.a.selected[m.id] ? " checked" : "";
    return '<div class="ecom-asset" data-id="' + esc(m.id) + '">'
      + '<label class="ecom-asset-ck"><input type="checkbox" data-ck' + checked + "></label>"
      + '<div class="ecom-asset-thumb">' + thumb(m.url || m.source_url) + "</div>"
      + '<div class="ecom-asset-meta"><div class="ecom-row-t">' + esc(KINDS[m.kind] || m.kind || "-") + " · " + esc(sourceText(m.source_type)) + "</div>"
      + '<div class="ecom-row-d">' + esc(size) + " · " + esc(EC.fmtTime(m.created_at)) + "</div>"
      + '<div class="ecom-row-d">商品 ' + esc(m.product_id || "-") + "</div></div></div>";
  }

  function paintAssets(el) {
    const box = el.querySelector("#ecomAssetGrid");
    if (box) {
      box.innerHTML = S.a.items.length
        ? '<div class="ecom-assets">' + S.a.items.map(assetCard).join("") + "</div>"
        : empty("素材库还是空的，先采集或到图片工坊处理");
      box.querySelectorAll(".ecom-asset").forEach(function (n) {
        const id = n.getAttribute("data-id");
        const ck = n.querySelector("[data-ck]");
        ck.onchange = function () { if (ck.checked) S.a.selected[id] = 1; else delete S.a.selected[id]; paintAssetCount(el); };
      });
    }
    paintAssetCount(el);
    pager(el.querySelector("#ecomAssetPager"), S.a.total, S.a.page, function (pg) { S.a.page = Math.max(1, pg); loadAssets(el); });
  }

  function paintAssetCount(el) {
    const n = Object.keys(S.a.selected).length;
    const tag = el.querySelector("#ecomAssetCount");
    if (tag) tag.textContent = n ? "已选 " + n + " 项" : "共 " + S.a.total + " 项";
  }

  function renderAssets(el) {
    const kinds = ["", "image", "video"].map(function (v) { return opt(v, v ? KINDS[v] : "全部类型", S.a.kind); }).join("");
    const sources = ["", "collected", "ai", "edit"].map(function (v) { return opt(v, v ? sourceText(v) : "全部来源", S.a.source); }).join("");
    el.innerHTML = '<div class="ecom-wrap">'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>素材筛选</span>'
      + '<button class="ecom-link" data-refresh>刷新</button></div>'
      + '<div class="ecom-panel-b"><div class="ecom-filters">'
      + '<select class="inp" id="ecomAssetKind">' + kinds + "</select>"
      + '<select class="inp" id="ecomAssetSource">' + sources + "</select>"
      + '<input class="inp" id="ecomAssetProduct" placeholder="按关联商品 ID 筛选" value="' + esc(S.a.productId) + '">'
      + '<button class="btn primary" id="ecomAssetSearch">查询</button>'
      + "</div></div></div>"
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>素材</span>'
      + '<div class="ecom-line"><span class="ecom-hint" id="ecomAssetCount">共 0 项</span>'
      + '<button class="ecom-link" data-select-all>全选本页</button>'
      + '<button class="ecom-link" data-select-none>清空</button>'
      + '<button class="btn" data-to-image>去图片工坊处理</button></div></div>'
      + '<div class="ecom-panel-b">'
      + '<div id="ecomAssetGrid">' + empty("加载中…") + "</div>"
      + '<div class="ecom-line" id="ecomAssetPager"></div>'
      + "</div></div></div>";

    el.querySelector("[data-refresh]").onclick = function () { loadAssets(el); };
    el.querySelector("#ecomAssetSearch").onclick = function () {
      S.a.kind = el.querySelector("#ecomAssetKind").value;
      S.a.source = el.querySelector("#ecomAssetSource").value;
      S.a.productId = el.querySelector("#ecomAssetProduct").value.trim();
      S.a.page = 1;
      loadAssets(el);
    };
    el.querySelector("[data-select-all]").onclick = function () {
      S.a.items.forEach(function (m) { S.a.selected[m.id] = 1; });
      paintAssets(el);
    };
    el.querySelector("[data-select-none]").onclick = function () { S.a.selected = {}; paintAssets(el); };
    el.querySelector("[data-to-image]").onclick = function () {
      const ids = Object.keys(S.a.selected);
      if (!ids.length) return EC.toast("请先选择素材", "err");
      EC.setSelection("media", ids);
      EC.toast("已带入 " + ids.length + " 项素材", "ok");
      EC.go("ecomImage");
    };
    loadAssets(el);
  }

  EC.register("ecomProducts", renderProducts);
  EC.register("ecomAssets", renderAssets);
})();
