/* 铜龙电商 · 任务中心（设计稿 7） */
/* 任务列表（类型/状态过滤）+ 任务详情（明细与错误）+ 暂停/重试。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const KINDS = [
    { id: "", label: "全部" },
    { id: "collect", label: "采集" },
    { id: "publish", label: "铺货" },
    { id: "price_adjust", label: "改价" },
    { id: "listing", label: "上下架" },
    { id: "assets", label: "图片处理" },
    { id: "generate", label: "AI 生成" },
    { id: "compliance", label: "合规检测" }
  ];

  const STATUSES = [
    { id: "", label: "全部" },
    { id: "scheduled", label: "待执行" },
    { id: "queued", label: "排队中" },
    { id: "running", label: "执行中" },
    { id: "paused", label: "已暂停" },
    { id: "succeeded", label: "已完成" },
    { id: "partial", label: "部分完成" },
    { id: "failed", label: "失败" }
  ];

  const REF_LABEL = { product: "商品", sku: "SKU", media: "素材", listing: "上架项", shop: "店铺" };

  const S = {
    kind: "",
    status: "",
    page: 1,
    pageSize: 20,
    total: 0,
    items: [],
    loaded: false,
    detailId: "",
    detail: null,
    detailItems: [],
    loading: false
  };

  function empty(t) { return '<div class="ecom-empty">' + esc(t) + "</div>"; }

  function refLabel(t) { return REF_LABEL[t] || t || "-"; }

  function percent(task) {
    const total = task.total || 0;
    if (!total) return task.status === "succeeded" ? 100 : 0;
    return Math.min(100, Math.round(((task.done || 0) / total) * 100));
  }

  function statusBadge(s) {
    return '<span class="ecom-badge st-' + esc(s || "") + '">' + esc(EC.statusText(s)) + "</span>";
  }

  function filterPanel() {
    const kinds = KINDS.map(function (k) {
      return '<button class="ecom-chip' + (S.kind === k.id ? " active" : "") + '" data-kind="' + k.id + '">' + esc(k.label) + "</button>";
    }).join("");
    const stats = STATUSES.map(function (s) {
      return '<button class="ecom-chip' + (S.status === s.id ? " active" : "") + '" data-status="' + s.id + '">' + esc(s.label) + "</button>";
    }).join("");
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>任务中心</span>'
      + '<button class="ecom-link" data-refresh-list>刷新</button></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-line"><span class="ecom-hint">类型</span>' + kinds + "</div>"
      + '<div class="ecom-line"><span class="ecom-hint">状态</span>' + stats + "</div>"
      + "</div></div>";
  }

  function taskRow(t) {
    const active = !EC.isTerminal(t.status);
    const pct = percent(t);
    const actions = '<button class="ecom-link" data-detail="' + esc(t.id) + '">详情</button>'
      + (active && t.status !== "paused" ? '<button class="ecom-link" data-pause="' + esc(t.id) + '">暂停</button>' : "")
      + (t.status === "failed" || t.status === "partial" ? '<button class="ecom-link" data-retry="' + esc(t.id) + '">重试</button>' : "");
    return '<tr><td><div class="ecom-row-t">' + esc(t.title || t.id) + "</div>"
      + '<div class="ecom-row-d">' + esc(t.id) + " · " + esc(EC.kindText(t.kind)) + "</div></td>"
      + '<td><span class="' + statusBadge(t.status) + '">' + esc(EC.statusText(t.status)) + "</span></td>"
      + '<td><div class="ecom-bar"><span style="width:' + pct + '%"></span></div>'
      + '<div class="ecom-row-d">' + (t.done || 0) + "/" + (t.total || 0) + (t.failed ? " · 失败 " + t.failed : "") + "</div></td>"
      + '<td class="ecom-row-d">' + esc(EC.fmtTime(t.created_at)) + "</td>"
      + '<td class="ecom-td-act">' + actions + "</td></tr>";
  }

  function listPanel() {
    if (!S.loaded) return '<div class="ecom-panel"><div class="ecom-panel-b">' + empty("加载中…") + "</div></div>";
    if (!S.items.length) return '<div class="ecom-panel"><div class="ecom-panel-h"><span>任务列表</span></div><div class="ecom-panel-b">' + empty("暂无任务") + "</div></div>";
    const rows = S.items.map(taskRow).join("");
    const pages = Math.max(1, Math.ceil(S.total / S.pageSize));
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>任务列表（' + S.total + "）</span>"
      + '<span class="ecom-hint">第 ' + S.page + "/" + pages + " 页</span></div>"
      + '<div class="ecom-panel-b"><table class="ecom-table">'
      + "<thead><tr><th>任务</th><th>状态</th><th>进度</th><th>创建时间</th><th>操作</th></tr></thead>"
      + "<tbody>" + rows + "</tbody></table>"
      + '<div class="ecom-line"><button class="btn" data-page="prev"' + (S.page <= 1 ? " disabled" : "") + ">上一页</button>"
      + '<button class="btn" data-page="next"' + (S.page >= pages ? " disabled" : "") + ">下一页</button></div>"
      + "</div></div>";
  }

  function detailPanel() {
    if (!S.detailId) return '<div class="ecom-panel"><div class="ecom-panel-b">' + empty("选择任务查看明细") + "</div></div>";
    if (!S.detail) return '<div class="ecom-panel"><div class="ecom-panel-b">' + empty("加载中…") + "</div></div>";
    const t = S.detail;
    const items = S.detailItems.length
      ? S.detailItems.map(function (it) {
          return '<tr><td>' + (it.seq || 0) + "</td>"
            + "<td>" + esc(refLabel(it.ref_type)) + " · " + esc(it.ref_id || "-") + "</td>"
            + '<td><span class="' + statusBadge(it.status) + '">' + esc(EC.statusText(it.status)) + "</span></td>"
            + '<td class="ecom-row-d">' + (it.attempt || 0) + "</td>"
            + '<td class="ecom-row-d">' + esc(it.error || "-") + "</td></tr>";
        }).join("")
      : "";
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>' + esc(t.title || t.id) + "</span>"
      + '<button class="ecom-link" data-refresh-detail>刷新</button></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-hint">' + esc(t.id) + " · " + esc(EC.kindText(t.kind)) + " · " + esc(EC.statusText(t.status)) + "</div>"
      + (t.error ? '<div class="ecom-alert">' + esc(t.error) + "</div>" : "")
      + (items
        ? '<table class="ecom-table"><thead><tr><th>#</th><th>对象</th><th>状态</th><th>尝试</th><th>错误</th></tr></thead><tbody>' + items + "</tbody></table>"
        : empty("该任务无明细项"))
      + '<div class="ecom-line">'
      + (t.status === "failed" || t.status === "partial" ? '<button class="btn primary" data-retry="' + esc(t.id) + '">重试失败项</button>' : "")
      + ((t.status === "running" || t.status === "queued" || t.status === "scheduled") ? '<button class="btn" data-pause="' + esc(t.id) + '">暂停</button>' : "")
      + "</div></div></div>";
  }

  function paint(el) {
    const box = el.querySelector("#ecomTasksMain");
    if (!box) return;
    box.innerHTML = '<div class="ecom-grid2">'
      + '<div class="ecom-col">' + filterPanel() + listPanel() + "</div>"
      + '<div class="ecom-col">' + detailPanel() + "</div>"
      + "</div>";
    bind(el);
  }

  function bind(el) {
    el.querySelectorAll("[data-kind]").forEach(function (n) {
      n.onclick = function () {
        S.kind = n.getAttribute("data-kind");
        S.page = 1;
        load(el);
      };
    });
    el.querySelectorAll("[data-status]").forEach(function (n) {
      n.onclick = function () {
        S.status = n.getAttribute("data-status");
        S.page = 1;
        load(el);
      };
    });
    el.querySelectorAll("[data-page]").forEach(function (n) {
      n.onclick = function () {
        if (n.disabled) return;
        S.page += n.getAttribute("data-page") === "next" ? 1 : -1;
        if (S.page < 1) S.page = 1;
        load(el);
      };
    });
    el.querySelectorAll("[data-detail]").forEach(function (n) {
      n.onclick = function () { loadDetail(el, n.getAttribute("data-detail")); };
    });
    el.querySelectorAll("[data-refresh-list]").forEach(function (n) {
      n.onclick = function () { load(el); };
    });
    el.querySelectorAll("[data-refresh-detail]").forEach(function (n) {
      n.onclick = function () { if (S.detailId) loadDetail(el, S.detailId); };
    });
    el.querySelectorAll("[data-retry]").forEach(function (n) {
      n.onclick = function () { act(el, n.getAttribute("data-retry"), "retry"); };
    });
    el.querySelectorAll("[data-pause]").forEach(function (n) {
      n.onclick = function () { act(el, n.getAttribute("data-pause"), "pause"); };
    });
  }

  function load(el) {
    const q = "?page=" + S.page + "&page_size=" + S.pageSize
      + (S.kind ? "&kind=" + encodeURIComponent(S.kind) : "")
      + (S.status ? "&status=" + encodeURIComponent(S.status) : "");
    return EC.api("GET", "/tasks" + q).then(function (res) {
      S.items = res.items || [];
      S.total = res.total || 0;
      S.loaded = true;
      paint(el);
    }).catch(function (e) {
      S.loaded = true;
      EC.toast(e.message || "加载失败", "err");
      paint(el);
    });
  }

  function loadDetail(el, id) {
    S.detailId = id;
    return EC.api("GET", "/tasks/" + id).then(function (res) {
      S.detail = res.task || null;
      S.detailItems = res.items || [];
      paint(el);
    }).catch(function (e) {
      EC.toast(e.message || "加载失败", "err");
    });
  }

  function act(el, id, action) {
    EC.api("POST", "/tasks/" + id + "/" + action, {}).then(function (res) {
      EC.toast(action === "retry" ? "已提交重试" : "已暂停", "ok");
      if (res && res.task && S.detailId === id) S.detail = res.task;
      return load(el).then(function () {
        if (S.detailId === id) return loadDetail(el, id);
      });
    }).catch(function (e) {
      EC.toast(e.message || "操作失败", "err");
    });
  }

  function render(el) {
    el.innerHTML = '<div class="ecom-wrap"><div id="ecomTasksMain"><div class="ecom-empty">加载中…</div></div></div>';
    load(el);
  }

  EC.register("ecomTasks", render);
})();
