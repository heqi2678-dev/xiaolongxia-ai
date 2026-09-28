/* 铜龙电商 · 搬家铺货（设计稿 2.2 / 6.5 / 6.7 / 6.8） */
/* 一键铺货向导：选品 -> 选店 -> 策略 -> 预检 -> 提交；附批量上下架与铺货记录。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const STEPS = ["选品", "选店", "策略", "预检", "提交"];
  const PLATFORMS = [
    { id: "douyin", label: "抖音小店" },
    { id: "mock", label: "测试（mock）" }
  ];
  const PRICE_MODES = [
    { id: "fixed", label: "固定加价" },
    { id: "ratio", label: "按比例" }
  ];
  const ROUNDS = [
    { id: "none", label: "不处理" },
    { id: "up", label: "向上取整" },
    { id: "down", label: "向下取整" },
    { id: "end9", label: "尾数 .9" }
  ];
  const LEVELS = { pass: "通过", warn: "警告", fail: "不通过" };
  const AUTH = { normal: "已授权", authorized: "已授权", expired: "已过期", unauthorized: "未授权" };

  const S = {
    tab: "wizard",
    step: 0,
    platform: "douyin",
    products: [], pTotal: 0, pKeyword: "", pLoaded: false,
    selected: {},
    shops: [], shopSel: {}, groups: [], sLoaded: false,
    categoryId: "", titlePrefix: "", titleSuffix: "",
    priceMode: "fixed", priceValue: 0, priceRound: "none", priceMin: 0,
    pace: "now", at: "", winStart: 9, winEnd: 22,
    precheck: null, prechecking: false,
    result: null, submitted: false, taskId: "",
    listingOn: true,
    priceScope: "products", priceTaskId: "",
    records: []
  };

  function empty(t) { return '<div class="ecom-empty">' + esc(t) + "</div>"; }
  function statusBadge(s) { return '<span class="ecom-badge st-' + esc(s || "") + '">' + esc(EC.statusText(s)) + "</span>"; }
  function levelBadge(l) { return '<span class="ecom-lv ecom-lv-' + esc(l || "") + '">' + esc(LEVELS[l] || l || "") + "</span>"; }
  function money(v) { const n = Number(v); return isNaN(n) ? "-" : "¥" + n.toFixed(2); }
  function selectedIds() { return Object.keys(S.selected); }
  function shopIds() { return Object.keys(S.shopSel); }
  function authText(a) { return AUTH[a] || a || "未授权"; }
  function groupName(id) {
    for (let i = 0; i < S.groups.length; i++) { if (S.groups[i].id === id) return S.groups[i].name || id; }
    return "未分组";
  }

  /* ============================ 数据加载 ============================ */

  function loadProducts(el) {
    const q = ["page_size=50"];
    if (S.pKeyword) q.push("keyword=" + encodeURIComponent(S.pKeyword));
    return EC.api("GET", "/products?" + q.join("&")).then(function (res) {
      S.products = res.items || [];
      S.pTotal = res.total || 0;
      S.pLoaded = true;
      paint(el);
    }).catch(function (e) { EC.toast(e.message || "商品加载失败", "err"); });
  }

  function loadShops(el) {
    return Promise.all([
      EC.api("GET", "/shops"),
      EC.api("GET", "/shop-groups")
    ]).then(function (res) {
      S.shops = (res[0] && res[0].items) || [];
      S.groups = (res[1] && res[1].items) || [];
      S.sLoaded = true;
      paint(el);
    }).catch(function (e) { EC.toast(e.message || "店铺加载失败", "err"); });
  }

  function loadRecords(el) {
    return EC.api("GET", "/tasks?kind=publish&page_size=12").then(function (res) {
      S.records = res.items || [];
      paint(el);
    }).catch(function () {});
  }

  /* ============================ 步骤内容 ============================ */

  function stepsHtml() {
    return '<div class="ecom-steps">' + STEPS.map(function (t, i) {
      const cls = i === S.step ? " active" : (i < S.step ? " done" : "");
      return '<button class="ecom-stepchip' + cls + '" data-step="' + i + '">'
        + '<span class="n">' + (i < S.step ? "✓" : i + 1) + "</span>" + esc(t) + "</button>";
    }).join("") + "</div>";
  }

  function stepProducts() {
    if (!S.pLoaded) return empty("加载中…");
    if (!S.products.length) return empty("商品库为空，先去「采集下载」抓一批，或调整关键词");
    return '<div class="ecom-filters"><input class="inp" id="ecomPublishKeyword" placeholder="搜索标题" value="' + esc(S.pKeyword) + '">'
      + '<button class="btn" data-load-products>搜索</button>'
      + '<span class="ecom-hint">共 ' + esc(S.pTotal) + " 件 · 已选 " + selectedIds().length + "</span></div>"
      + '<div class="ecom-list">' + S.products.map(function (p) {
        const checked = S.selected[p.id] ? " checked" : "";
        return '<label class="ecom-choice' + (checked ? " active" : "") + '">'
          + '<input type="checkbox" data-pid="' + esc(p.id) + '"' + checked + ">"
          + '<span class="ecom-choice-main"><span class="ecom-cell-t">' + esc(p.title || "未命名") + "</span>"
          + '<span class="ecom-row-d">' + esc(EC.platformText(p.source_platform)) + " · 源价 " + money(p.price) + "</span></span></label>";
      }).join("") + "</div>"
      + '<div class="ecom-line"><button class="btn" data-sel-all>全选本页</button>'
      + '<button class="btn" data-sel-none>清空</button>'
      + '<button class="btn" data-from-library>从商品库选择集带入</button></div>';
  }

  function stepShops() {
    if (!S.sLoaded) return empty("加载中…");
    if (!S.shops.length) return empty("还没有店铺，先去「店铺与授权」添加并授权");
    return '<div class="ecom-line"><span class="ecom-hint">已选 ' + shopIds().length + " 个店铺 · 未授权店铺不可铺货</span>"
      + '<button class="btn" data-shop-all>全选已授权</button><button class="btn" data-shop-none>清空</button></div>'
      + '<div class="ecom-list">' + S.shops.map(function (s) {
        const okAuth = s.auth_status === "normal" || s.auth_status === "authorized";
        const checked = S.shopSel[s.id] ? " checked" : "";
        return '<label class="ecom-choice' + (checked ? " active" : "") + (okAuth ? "" : " disabled") + '">'
          + '<input type="checkbox" data-sid="' + esc(s.id) + '"' + checked + (okAuth ? "" : " disabled") + ">"
          + '<span class="ecom-choice-main"><span class="ecom-cell-t">' + esc(s.name || s.shop_id || s.id) + "</span>"
          + '<span class="ecom-row-d">' + esc(EC.platformText(s.platform)) + " · " + esc(authText(s.auth_status)) + " · " + esc(groupName(s.group_id)) + "</span></span></label>";
      }).join("") + "</div>";
  }

  function opt(list, cur) {
    return list.map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (o.id === cur ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("");
  }

  function stepStrategy() {
    return '<div class="ecom-detail-form">'
      + '<div class="ecom-field"><label class="ecom-label">目标平台</label><select class="inp" id="ecomPublishPlatform">' + opt(PLATFORMS, S.platform) + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">目标类目 ID（留空自动匹配）</label><input class="inp" id="ecomPublishCategory" value="' + esc(S.categoryId) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">标题前缀</label><input class="inp" id="ecomTitlePrefix" value="' + esc(S.titlePrefix) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">标题后缀</label><input class="inp" id="ecomTitleSuffix" value="' + esc(S.titleSuffix) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">价格公式</label><select class="inp" id="ecomPriceMode">' + opt(PRICE_MODES, S.priceMode) + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">公式取值（加价额 / 比例）</label><input class="inp" id="ecomPriceValue" type="number" step="0.01" value="' + esc(S.priceValue) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">尾数规则</label><select class="inp" id="ecomPriceRound">' + opt(ROUNDS, S.priceRound) + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">最低售价</label><input class="inp" id="ecomPriceMin" type="number" step="0.01" value="' + esc(S.priceMin) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">上架节奏</label><select class="inp" id="ecomPace">'
      + '<option value="now"' + (S.pace === "now" ? " selected" : "") + ">立即铺货</option>"
      + '<option value="at"' + (S.pace === "at" ? " selected" : "") + ">定时铺货</option>"
      + '<option value="window"' + (S.pace === "window" ? " selected" : "") + ">分时上架</option></select></div>"
      + '<div class="ecom-field" id="ecomPaceAtField"' + (S.pace === "at" ? "" : ' style="display:none"') + '><label class="ecom-label">执行时间</label><input class="inp" id="ecomPaceAt" type="datetime-local" value="' + esc(S.at) + '"></div>'
      + '<div class="ecom-field" id="ecomPaceWinField"' + (S.pace === "window" ? "" : ' style="display:none"') + '><label class="ecom-label">允许时段（小时）</label>'
      + '<div class="ecom-line"><input class="inp" id="ecomWinStart" type="number" min="0" max="23" value="' + esc(S.winStart) + '">'
      + '<span class="ecom-hint">至</span><input class="inp" id="ecomWinEnd" type="number" min="0" max="23" value="' + esc(S.winEnd) + '"></div></div>'
      + "</div>"
      + '<div class="ecom-hint">价格公式举例：源价 ' + money(59) + "，固定加价 30、尾数 .9 → " + money(89.9) + "；比例 1.5 → " + money(88.5) + "。</div>";
  }

  function precheckHtml() {
    if (!S.precheck) return empty("点击「开始预检」检查类目 / 标题 / 主图 / 价格与合规风险");
    const v = S.precheck.verdict;
    const items = S.precheck.items || [];
    const byProduct = {};
    items.forEach(function (it) {
      const k = it.productId || it.product_id || "-";
      (byProduct[k] = byProduct[k] || []).push(it);
    });
    return '<div class="ecom-line"><span class="ecom-hint">预检结论</span>'
      + '<span class="ecom-lv ecom-lv-' + esc(v === "pass" ? "pass" : v) + '">' + esc(LEVELS[v] || v) + "</span>"
      + '<span class="ecom-hint">· ' + items.length + " 项</span></div>"
      + '<div class="ecom-pre">' + Object.keys(byProduct).map(function (pid) {
        return '<div class="ecom-panel"><div class="ecom-panel-h"><span class="ecom-mono">' + esc(pid) + "</span></div>"
          + '<div class="ecom-panel-b">' + byProduct[pid].map(function (it) {
            return '<div class="ecom-pre-item">' + levelBadge(it.level)
              + '<span class="ecom-mono">' + esc(it.dimension) + "</span>"
              + "<span>" + esc(it.message || "") + "</span></div>";
          }).join("") + "</div></div>";
      }).join("") + "</div>";
  }

  function summaryHtml() {
    return '<div class="ecom-kv"><span>目标平台</span><b>' + esc(EC.platformText(S.platform)) + "</b></div>"
      + '<div class="ecom-kv"><span>商品</span><b>' + selectedIds().length + " 件</b></div>"
      + '<div class="ecom-kv"><span>店铺</span><b>' + shopIds().length + " 个</b></div>"
      + '<div class="ecom-kv"><span>类目</span><b>' + esc(S.categoryId || "自动匹配") + "</b></div>"
      + '<div class="ecom-kv"><span>价格公式</span><b>' + esc(priceText()) + "</b></div>"
      + '<div class="ecom-kv"><span>节奏</span><b>' + esc(paceText()) + "</b></div>";
  }

  function priceText() {
    const mode = S.priceMode === "ratio" ? "×" + S.priceValue : "+" + money(S.priceValue);
    const rd = S.priceRound === "none" ? "" : " · " + (ROUNDS.filter(function (r) { return r.id === S.priceRound; })[0] || {}).label;
    return mode + rd + (S.priceMin ? " · 最低 " + money(S.priceMin) : "");
  }

  function paceText() {
    if (S.pace === "at") return "定时 " + (S.at || "未设置");
    if (S.pace === "window") return "分时 " + S.winStart + ":00-" + S.winEnd + ":00";
    return "立即铺货";
  }

  function stepSubmit() {
    if (S.submitted) {
      const r = S.result || {};
      return '<div class="ecom-panel"><div class="ecom-panel-h"><span>提交结果</span>'
        + (S.taskId ? statusBadge("queued") : "") + "</div>"
        + '<div class="ecom-panel-b">'
        + '<div class="ecom-kv"><span>任务</span><b class="ecom-mono">' + esc(S.taskId || "-") + "</b></div>"
        + '<div class="ecom-kv"><span>新建条目</span><b>' + esc(r.item_count == null ? 0 : r.item_count) + "</b></div>"
        + '<div class="ecom-kv"><span>去重跳过</span><b>' + esc(r.deduped == null ? 0 : r.deduped) + "</b></div>"
        + '<div class="ecom-hint">已进入任务队列，可在「任务中心」查看进度与失败重试</div>'
        + '<div class="ecom-line"><button class="btn primary" data-goto-tasks>去任务中心</button>'
        + '<button class="btn" data-reset>再铺一批</button></div></div></div>';
    }
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>确认提交</span></div>'
      + '<div class="ecom-panel-b">' + summaryHtml()
      + '<div class="ecom-line"><button class="btn primary" id="ecomPublishSubmit">确认铺货</button>'
      + '<span class="ecom-hint">按「商品 × 店铺」去重，已上架或排队中的组合会自动跳过</span></div></div></div>';
  }

  function wizardBody() {
    return stepsHtml() + '<div class="ecom-panel"><div class="ecom-panel-h"><span>步骤 ' + (S.step + 1) + " · " + esc(STEPS[S.step]) + "</span></div>"
      + '<div class="ecom-panel-b" id="ecomStepBody">'
      + [stepProducts, stepShops, stepStrategy, precheckHtml, stepSubmit][S.step]()
      + "</div></div>"
      + '<div class="ecom-line">'
      + (S.step > 0 ? '<button class="btn" data-prev>上一步</button>' : "")
      + (S.step === 3 && !S.precheck ? '<button class="btn primary" id="ecomPrecheckRun">开始预检</button>' : "")
      + (S.step === 3 && S.precheck ? '<button class="btn" id="ecomPrecheckRun">重新预检</button>' : "")
      + (S.step < 4 && S.step !== 3 ? '<button class="btn primary" data-next>下一步</button>' : "")
      + (S.step < 4 && S.step === 3 && S.precheck && S.precheck.verdict !== "fail" ? '<button class="btn primary" data-next>下一步</button>' : "")
      + "</div>";
  }

  /* ============================ 批量上下架 / 记录 ============================ */

  function listingBody() {
    return '<div class="ecom-panel"><div class="ecom-panel-h">批量上下架</div><div class="ecom-panel-b">'
      + (selectedIds().length && shopIds().length
        ? '<div class="ecom-hint">将对 ' + selectedIds().length + " 件商品 × " + shopIds().length + " 个店铺提交任务</div>"
        : '<div class="ecom-hint">请先在「一键铺货」的选品 / 选店步骤勾选商品与店铺，二者共用同一份选择</div>')
      + '<div class="ecom-field"><label class="ecom-label">操作</label><div class="ecom-tabs">'
      + '<button class="ecom-tab' + (S.listingOn ? " active" : "") + '" data-listing="on">上架</button>'
      + '<button class="ecom-tab' + (!S.listingOn ? " active" : "") + '" data-listing="off">下架</button></div></div>'
      + '<div class="ecom-line"><button class="btn primary" id="ecomListingSubmit">提交' + (S.listingOn ? "上架" : "下架") + "任务</button></div>"
      + "</div></div>";
  }

  function shopPicker() {
    if (!S.shops.length) return empty("还没有店铺，先去「店铺与授权」添加并授权");
    return '<div class="ecom-field"><label class="ecom-label">应用店铺</label><div class="ecom-list">'
      + S.shops.map(function (s) {
        const checked = S.shopSel[s.id] ? " checked" : "";
        return '<label class="ecom-choice' + (checked ? " active" : "") + '">'
          + '<input type="checkbox" data-psid="' + esc(s.id) + '"' + checked + ">"
          + '<span class="ecom-choice-main"><span class="ecom-cell-t">' + esc(s.name || s.shop_id || s.id) + "</span>"
          + '<span class="ecom-row-d">' + esc(EC.platformText(s.platform)) + " · " + esc(authText(s.auth_status)) + "</span></span></label>";
      }).join("") + "</div></div>";
  }

  function priceBody() {
    const needShops = S.priceScope === "listings";
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>批量改价</span>'
      + '<button class="ecom-link" data-view="ecomProducts">商品库</button></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-hint">将对 ' + selectedIds().length + " 件商品改价"
      + (needShops ? "，已选 " + shopIds().length + " 个店铺" : "，仅改商品库价格") + "</div>"
      + '<div class="ecom-field"><label class="ecom-label">改价范围</label><div class="ecom-tabs">'
      + '<button class="ecom-tab' + (!needShops ? " active" : "") + '" data-price-scope="products">商品库价格</button>'
      + '<button class="ecom-tab' + (needShops ? " active" : "") + '" data-price-scope="listings">已上架价格</button></div></div>'
      + (needShops ? shopPicker() : "")
      + '<div class="ecom-detail-form">'
      + '<div class="ecom-field"><label class="ecom-label">目标平台</label><select class="inp" id="ecomPublishPlatform">' + opt(PLATFORMS, S.platform) + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">价格公式</label><select class="inp" id="ecomPriceMode">' + opt(PRICE_MODES, S.priceMode) + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">公式取值（加价额 / 比例）</label><input class="inp" id="ecomPriceValue" type="number" step="0.01" value="' + esc(S.priceValue) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">尾数规则</label><select class="inp" id="ecomPriceRound">' + opt(ROUNDS, S.priceRound) + "</select></div>"
      + '<div class="ecom-field"><label class="ecom-label">最低售价</label><input class="inp" id="ecomPriceMin" type="number" step="0.01" value="' + esc(S.priceMin) + '"></div>'
      + '<div class="ecom-field"><label class="ecom-label">执行节奏</label><select class="inp" id="ecomPace">'
      + '<option value="now"' + (S.pace === "now" ? " selected" : "") + ">立即改价</option>"
      + '<option value="at"' + (S.pace === "at" ? " selected" : "") + ">定时改价</option>"
      + '<option value="window"' + (S.pace === "window" ? " selected" : "") + ">分时改价</option></select></div>"
      + '<div class="ecom-field" id="ecomPaceAtField"' + (S.pace === "at" ? "" : ' style="display:none"') + '><label class="ecom-label">执行时间</label><input class="inp" id="ecomPaceAt" type="datetime-local" value="' + esc(S.at) + '"></div>'
      + '<div class="ecom-field" id="ecomPaceWinField"' + (S.pace === "window" ? "" : ' style="display:none"') + '><label class="ecom-label">允许时段（小时）</label>'
      + '<div class="ecom-line"><input class="inp" id="ecomWinStart" type="number" min="0" max="23" value="' + esc(S.winStart) + '">'
      + '<span class="ecom-hint">至</span><input class="inp" id="ecomWinEnd" type="number" min="0" max="23" value="' + esc(S.winEnd) + '"></div></div>'
      + "</div>"
      + '<div class="ecom-hint">价格公式举例：原价 ' + money(59) + "，固定加价 10、尾数 .9 → " + money(69.9) + "；比例 1.5 → " + money(88.5) + "。</div>"
      + '<div class="ecom-line"><button class="btn primary" id="ecomPriceAdjustSubmit">提交改价任务</button>'
      + (S.priceTaskId ? '<span class="ecom-hint ecom-mono">任务 ' + esc(S.priceTaskId) + "</span>"
        + '<button class="ecom-link" data-view="ecomTasks">任务中心</button>' : "")
      + "</div></div></div>";
  }

  function recordsBody() {
    if (!S.records.length) return '<div class="ecom-panel"><div class="ecom-panel-b">' + empty("还没有铺货记录") + "</div></div>";
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>铺货记录</span><button class="ecom-link" data-view="ecomTasks">任务中心</button></div>'
      + '<div class="ecom-panel-b">' + S.records.map(function (t) {
        return '<div class="ecom-row ecom-task-row" data-task="' + esc(t.id) + '">'
          + '<div class="ecom-row-main"><div class="ecom-row-t">' + esc(t.title || "一键铺货") + "</div>"
          + '<div class="ecom-row-d">' + esc(EC.fmtTime(t.created_at)) + " · 成功 " + esc(t.done || 0) + " / 失败 " + esc(t.failed || 0) + " / 共 " + esc(t.total || 0) + "</div></div>"
          + statusBadge(t.status) + "</div>";
      }).join("") + "</div></div>";
  }

  /* ============================ 动作 ============================ */

  function buildStrategy() {
    return {
      category_id: S.categoryId,
      title: { prefix: S.titlePrefix, suffix: S.titleSuffix },
      price_rule: { mode: S.priceMode, value: Number(S.priceValue) || 0, round: S.priceRound, min_price: Number(S.priceMin) || 0 }
    };
  }

  function buildSchedule() {
    if (S.pace === "at" && S.at) {
      const ts = Date.parse(S.at);
      if (!isNaN(ts)) return { schedule: { mode: "at", at: ts } };
    }
    if (S.pace === "window") {
      return { schedule: { mode: "recurring", window: [Number(S.winStart) || 0, Number(S.winEnd) || 24] } };
    }
    return {};
  }

  function runPrecheck(el) {
    const ids = selectedIds();
    if (!ids.length) return EC.toast("请先选择商品", "err");
    S.prechecking = true;
    const btn = el.querySelector("#ecomPrecheckRun");
    if (btn) btn.disabled = true;
    EC.api("POST", "/publish/precheck", { product_ids: ids, platform: S.platform, strategy: buildStrategy() })
      .then(function (res) {
        S.prechecking = false;
        S.precheck = res;
        EC.toast(res.verdict === "fail" ? "预检发现阻断项" : "预检完成", res.verdict === "fail" ? "err" : "ok");
        paint(el);
      }).catch(function (e) {
        S.prechecking = false;
        EC.toast(e.message || "预检失败", "err");
        if (btn) btn.disabled = false;
      });
  }

  function submitPublish(el) {
    const ids = selectedIds();
    if (!ids.length || !shopIds().length) return EC.toast("请先选择商品与店铺", "err");
    const body = Object.assign({ product_ids: ids, shop_ids: shopIds(), platform: S.platform, strategy: buildStrategy() }, buildSchedule());
    const btn = el.querySelector("#ecomPublishSubmit");
    if (btn) btn.disabled = true;
    EC.api("POST", "/publish", body).then(function (res) {
      S.submitted = true;
      S.result = res;
      S.taskId = res.task && res.task.id;
      EC.toast(res.item_count ? "已提交 " + res.item_count + " 条铺货" : "全部为重复项，未新建", res.item_count ? "ok" : "err");
      loadRecords(el);
      paint(el);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      EC.toast(e.message || "提交失败", "err");
    });
  }

  function submitListing(el) {
    if (!selectedIds().length || !shopIds().length) return EC.toast("请先选择商品与店铺", "err");
    const btn = el.querySelector("#ecomListingSubmit");
    if (btn) btn.disabled = true;
    EC.api("POST", "/listing/batch", { product_ids: selectedIds(), shop_ids: shopIds(), platform: S.platform, on: S.listingOn })
      .then(function (res) {
        if (btn) btn.disabled = false;
        EC.toast("已提交 " + (res.item_count || 0) + " 条" + (S.listingOn ? "上架" : "下架") + "任务", "ok");
        loadRecords(el);
      }).catch(function (e) {
        if (btn) btn.disabled = false;
        EC.toast(e.message || "提交失败", "err");
      });
  }

  function submitPrice(el) {
    const ids = selectedIds();
    if (!ids.length) return EC.toast("请先选择商品", "err");
    if (S.priceScope === "listings" && !shopIds().length) return EC.toast("对已上架商品改价需选择店铺", "err");
    const btn = el.querySelector("#ecomPriceAdjustSubmit");
    if (btn) btn.disabled = true;
    const body = Object.assign({
      product_ids: ids,
      scope: S.priceScope,
      platform: S.platform,
      rule: { mode: S.priceMode, value: Number(S.priceValue) || 0, round: S.priceRound, min_price: Number(S.priceMin) || 0 }
    }, S.priceScope === "listings" ? { shop_ids: shopIds() } : {}, buildSchedule());
    EC.api("POST", "/price/adjust", body).then(function (res) {
      if (btn) btn.disabled = false;
      S.priceTaskId = res.task && res.task.id || "";
      EC.toast("已提交 " + (res.item_count || 0) + " 条改价", "ok");
      loadRecords(el);
      paint(el);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      EC.toast(e.message || "提交失败", "err");
    });
  }

  /* ============================ 渲染与绑定 ============================ */

  function contentHtml() {
    if (S.tab === "listing") return listingBody();
    if (S.tab === "price") return priceBody();
    if (S.tab === "records") return recordsBody();
    return wizardBody();
  }

  function bindWizard(el) {
    el.querySelectorAll("[data-step]").forEach(function (n) {
      n.onclick = function () { S.step = Number(n.getAttribute("data-step")); paint(el); };
    });
    const prev = el.querySelector("[data-prev]");
    if (prev) prev.onclick = function () { S.step = Math.max(0, S.step - 1); paint(el); };
    const next = el.querySelector("[data-next]");
    if (next) next.onclick = function () {
      if (S.step === 0 && !selectedIds().length) return EC.toast("请至少选择一件商品", "err");
      if (S.step === 1 && !shopIds().length) return EC.toast("请至少选择一个店铺", "err");
      if (S.step === 3 && (!S.precheck || S.precheck.verdict === "fail")) return EC.toast("预检未通过，请先处理阻断项", "err");
      S.step = Math.min(4, S.step + 1);
      paint(el);
    };
    const kw = el.querySelector("#ecomPublishKeyword");
    if (kw) {
      kw.onkeydown = function (e) { if (e.key === "Enter") { S.pKeyword = kw.value.trim(); loadProducts(el); } };
    }
    const loadBtn = el.querySelector("[data-load-products]");
    if (loadBtn) loadBtn.onclick = function () { S.pKeyword = (el.querySelector("#ecomPublishKeyword").value || "").trim(); loadProducts(el); };
    el.querySelectorAll("[data-pid]").forEach(function (n) {
      n.onchange = function () {
        const id = n.getAttribute("data-pid");
        if (n.checked) S.selected[id] = 1; else delete S.selected[id];
        paint(el);
      };
    });
    const selAll = el.querySelector("[data-sel-all]");
    if (selAll) selAll.onclick = function () { S.products.forEach(function (p) { S.selected[p.id] = 1; }); paint(el); };
    const selNone = el.querySelector("[data-sel-none]");
    if (selNone) selNone.onclick = function () { S.selected = {}; paint(el); };
    const fromLib = el.querySelector("[data-from-library]");
    if (fromLib) fromLib.onclick = function () {
      const ids = EC.getSelection("products") || [];
      if (!ids.length) return EC.toast("商品库里还没有选择集", "err");
      ids.forEach(function (id) { S.selected[id] = 1; });
      paint(el);
    };
    el.querySelectorAll("[data-sid]").forEach(function (n) {
      n.onchange = function () {
        const id = n.getAttribute("data-sid");
        if (n.checked) S.shopSel[id] = 1; else delete S.shopSel[id];
        paint(el);
      };
    });
    const shopAll = el.querySelector("[data-shop-all]");
    if (shopAll) shopAll.onclick = function () {
      S.shops.forEach(function (s) { if (s.auth_status === "normal" || s.auth_status === "authorized") S.shopSel[s.id] = 1; });
      paint(el);
    };
    const shopNone = el.querySelector("[data-shop-none]");
    if (shopNone) shopNone.onclick = function () { S.shopSel = {}; paint(el); };

    const bind = function (id, key, cast) {
      const n = el.querySelector(id);
      if (n) n.onchange = function () { S[key] = cast ? cast(n.value) : n.value; };
    };
    bind("#ecomPublishPlatform", "platform");
    bind("#ecomPublishCategory", "categoryId");
    bind("#ecomTitlePrefix", "titlePrefix");
    bind("#ecomTitleSuffix", "titleSuffix");
    bind("#ecomPriceMode", "priceMode");
    bind("#ecomPriceValue", "priceValue", Number);
    bind("#ecomPriceRound", "priceRound");
    bind("#ecomPriceMin", "priceMin", Number);
    bind("#ecomPaceAt", "at");
    bind("#ecomWinStart", "winStart", Number);
    bind("#ecomWinEnd", "winEnd", Number);
    const pace = el.querySelector("#ecomPace");
    if (pace) pace.onchange = function () {
      S.pace = pace.value;
      const af = el.querySelector("#ecomPaceAtField");
      const wf = el.querySelector("#ecomPaceWinField");
      if (af) af.style.display = S.pace === "at" ? "" : "none";
      if (wf) wf.style.display = S.pace === "window" ? "" : "none";
    };

    const pre = el.querySelector("#ecomPrecheckRun");
    if (pre) pre.onclick = function () {
      if (S.step !== 3) { S.step = 3; }
      runPrecheck(el);
    };
    const submit = el.querySelector("#ecomPublishSubmit");
    if (submit) submit.onclick = function () { submitPublish(el); };
    const goTasks = el.querySelector("[data-goto-tasks]");
    if (goTasks) goTasks.onclick = function () { EC.go("ecomTasks"); };
    const reset = el.querySelector("[data-reset]");
    if (reset) reset.onclick = function () { S.submitted = false; S.result = null; S.taskId = ""; S.step = 0; S.precheck = null; paint(el); };
  }

  function bindContent(el) {
    const list = el.querySelector("#ecomListingSubmit");
    if (list) list.onclick = function () { submitListing(el); };
    el.querySelectorAll("[data-listing]").forEach(function (n) {
      n.onclick = function () { S.listingOn = n.getAttribute("data-listing") === "on"; paint(el); };
    });
    if (S.tab === "price") bindPrice(el);
    el.querySelectorAll("[data-task]").forEach(function (n) {
      n.onclick = function () { EC.go("ecomTasks"); };
    });
    el.querySelectorAll("[data-view]").forEach(function (n) {
      n.onclick = function () { EC.go(n.getAttribute("data-view")); };
    });
  }

  function bindPrice(el) {
    el.querySelectorAll("[data-price-scope]").forEach(function (n) {
      n.onclick = function () { S.priceScope = n.getAttribute("data-price-scope"); paint(el); };
    });
    el.querySelectorAll("[data-psid]").forEach(function (n) {
      n.onchange = function () {
        const id = n.getAttribute("data-psid");
        if (n.checked) S.shopSel[id] = 1; else delete S.shopSel[id];
        paint(el);
      };
    });
    const bind = function (id, key, cast) {
      const n = el.querySelector(id);
      if (n) n.onchange = function () { S[key] = cast ? cast(n.value) : n.value; };
    };
    bind("#ecomPublishPlatform", "platform");
    bind("#ecomPriceMode", "priceMode");
    bind("#ecomPriceValue", "priceValue", Number);
    bind("#ecomPriceRound", "priceRound");
    bind("#ecomPriceMin", "priceMin", Number);
    bind("#ecomPaceAt", "at");
    bind("#ecomWinStart", "winStart", Number);
    bind("#ecomWinEnd", "winEnd", Number);
    const pace = el.querySelector("#ecomPace");
    if (pace) pace.onchange = function () {
      S.pace = pace.value;
      const af = el.querySelector("#ecomPaceAtField");
      const wf = el.querySelector("#ecomPaceWinField");
      if (af) af.style.display = S.pace === "at" ? "" : "none";
      if (wf) wf.style.display = S.pace === "window" ? "" : "none";
    };
    const submit = el.querySelector("#ecomPriceAdjustSubmit");
    if (submit) submit.onclick = function () { submitPrice(el); };
  }

  function paint(el) {
    el.querySelectorAll("[data-tab]").forEach(function (n) {
      n.classList.toggle("active", n.getAttribute("data-tab") === S.tab);
    });
    const body = el.querySelector("#ecomPublishBody");
    if (!body) return;
    body.innerHTML = contentHtml();
    if (S.tab === "wizard") bindWizard(el);
    bindContent(el);
  }

  function render(el) {
    S.submitted = false;
    S.result = null;
    S.taskId = "";
    S.priceTaskId = "";
    const lib = EC.getSelection("products") || [];
    lib.forEach(function (id) { S.selected[id] = 1; });
    el.innerHTML = '<div class="ecom-wrap">'
      + '<div class="ecom-panel"><div class="ecom-panel-h">'
      + '<div class="ecom-tabs">'
      + '<button class="ecom-tab' + (S.tab === "wizard" ? " active" : "") + '" data-tab="wizard">一键铺货</button>'
      + '<button class="ecom-tab' + (S.tab === "listing" ? " active" : "") + '" data-tab="listing">批量上下架</button>'
      + '<button class="ecom-tab' + (S.tab === "price" ? " active" : "") + '" data-tab="price">批量改价</button>'
      + '<button class="ecom-tab' + (S.tab === "records" ? " active" : "") + '" data-tab="records">铺货记录</button>'
      + "</div>"
      + '<button class="ecom-link" data-view="ecomTasks">任务中心</button></div></div>'
      + '<div id="ecomPublishBody"></div></div>';

    el.querySelectorAll("[data-tab]").forEach(function (n) {
      n.onclick = function () { S.tab = n.getAttribute("data-tab"); paint(el); };
    });
    if (!S.pLoaded) loadProducts(el);
    if (!S.sLoaded) loadShops(el);
    loadRecords(el);
    paint(el);
  }

  EC.register("ecomPublish", render);
})();
