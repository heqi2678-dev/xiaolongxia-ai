/* 铜龙电商 · 合规检测（设计稿 6.x / 3.5） */
/* 违禁词 / 品牌词 / B 端词检测：出具 verdict 与命中明细，阻断不合格商品铺货。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const VERDICT = {
    pass: { label: "通过", cls: "ecom-badge st-succeeded" },
    warn: { label: "警告", cls: "ecom-badge st-paused" },
    block: { label: "拦截", cls: "ecom-badge st-failed" }
  };

  const HIT_TYPE = { forbidden: "违禁词", brand: "品牌词", b_end: "B 端词" };

  const PLATFORMS = [
    { id: "douyin", label: "抖音小店" },
    { id: "taobao", label: "淘宝" },
    { id: "pinduoduo", label: "拼多多" },
    { id: "kuaishou", label: "快手小店" },
    { id: "tiktok", label: "TikTok Shop" }
  ];

  const S = {
    platform: "douyin",
    sync: true,
    result: null,
    taskId: ""
  };

  function empty(t) { return '<div class="ecom-empty">' + esc(t) + "</div>"; }

  function verdictBadge(v) {
    const m = VERDICT[v] || { label: v || "-", cls: "ecom-badge" };
    return '<span class="' + m.cls + '">' + esc(m.label) + "</span>";
  }

  function hitType(t) { return HIT_TYPE[t] || t || "-"; }

  function selectedCount() {
    return EC.getSelection("products").length;
  }

  function formPanel() {
    const opts = PLATFORMS.map(function (p) {
      return '<option value="' + p.id + '"' + (S.platform === p.id ? " selected" : "") + ">" + esc(p.label) + "</option>";
    }).join("");
    const n = selectedCount();
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>检测设置</span></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-hint">在商品库勾选商品后运行检测；命中违禁/品牌词判定为「拦截」。</div>'
      + '<label class="ecom-field"><span>目标平台</span><select class="inp" id="ecomCompliancePlatform">' + opts + "</select></label>"
      + '<label class="ecom-op"><input type="checkbox" id="ecomComplianceSync"' + (S.sync ? " checked" : "") + ">同步等待结果</label>"
      + '<div class="ecom-line"><button class="btn primary" id="ecomComplianceRun"' + (n ? "" : " disabled") + ">运行检测（已选 " + n + "）</button>"
      + '<button class="btn" data-view="ecomProducts">去商品库选择</button></div>'
      + "</div></div>";
  }

  function summaryPanel() {
    if (!S.result) return '<div class="ecom-panel"><div class="ecom-panel-h"><span>检测结果</span></div><div class="ecom-panel-b">' + empty("运行检测后在此查看结果") + "</div></div>";
    const reports = S.result.reports || [];
    const rows = reports.length
      ? reports.map(function (r) {
          const hits = (r.hits_json || r.hits || []);
          const detail = hits.length
            ? hits.map(function (h) {
                return '<span class="ecom-hit">' + esc(hitType(h.type)) + "：" + esc(h.word) + "</span>";
              }).join("")
            : '<span class="ecom-hint">无命中</span>';
          return '<div class="ecom-report"><div class="ecom-row-t">' + esc(r.product_id || "-") + " " + verdictBadge(r.verdict) + "</div>"
            + '<div class="ecom-line ecom-choices">' + detail + "</div></div>";
        }).join("")
      : empty("没有报告");
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>检测结果</span>'
      + '<span>' + verdictBadge(S.result.verdict) + "</span></div>"
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-line"><span class="ecom-hint">任务</span><button class="ecom-link" data-view="ecomTasks">' + esc(S.taskId || "-") + "</button></div>"
      + rows + "</div></div>";
  }

  function paint(el) {
    const box = el.querySelector("#ecomComplianceMain");
    if (!box) return;
    box.innerHTML = '<div class="ecom-grid2"><div class="ecom-col">' + formPanel() + "</div><div class=\"ecom-col\">" + summaryPanel() + "</div></div>";
    bind(el);
  }

  function bind(el) {
    el.querySelectorAll("[data-view]").forEach(function (n) {
      n.onclick = function () { EC.go(n.getAttribute("data-view")); };
    });
    const plat = el.querySelector("#ecomCompliancePlatform");
    if (plat) plat.onchange = function () { S.platform = plat.value; };
    const sync = el.querySelector("#ecomComplianceSync");
    if (sync) sync.onchange = function () { S.sync = sync.checked; };
    const run = el.querySelector("#ecomComplianceRun");
    if (run) run.onclick = function () { submit(el); };
  }

  function submit(el) {
    const ids = EC.getSelection("products");
    if (!ids.length) return EC.toast("请先选择商品", "err");
    const btn = el.querySelector("#ecomComplianceRun");
    if (btn) btn.disabled = true;
    const body = { product_ids: ids, platform: S.platform };
    if (!S.sync) body.async = true;
    EC.api("POST", "/compliance/check", body).then(function (res) {
      if (btn) btn.disabled = false;
      S.taskId = res.task && res.task.id || "";
      if (S.sync) {
        S.result = { verdict: res.verdict || "pass", reports: res.reports || [] };
        EC.toast("检测完成：" + (VERDICT[S.result.verdict] || {}).label, S.result.verdict === "block" ? "err" : "ok");
      } else {
        EC.toast("已提交后台检测", "ok");
      }
      paint(el);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      EC.toast(e.message || "检测失败", "err");
    });
  }

  function render(el) {
    el.innerHTML = '<div class="ecom-wrap"><div id="ecomComplianceMain"><div class="ecom-empty">加载中…</div></div></div>';
    paint(el);
  }

  EC.register("ecomCompliance", render);
})();
