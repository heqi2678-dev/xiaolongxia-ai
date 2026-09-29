/* 铜龙电商 · 采集下载（设计稿 2.2 / 6.2） */
/* 链接采集（单商品）与整店采集；创建 collect 任务并轮询进度，结果进入采集结果表。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const S = {
    mode: "product",
    platform: "1688",
    taskId: "",
    timer: null,
    polling: false
  };

  const SOURCES = [
    { id: "1688", label: "1688（货源地）" },
    { id: "mock", label: "测试（mock）" }
  ];

  function stopPoll() {
    if (S.timer) { clearTimeout(S.timer); S.timer = null; }
    S.polling = false;
  }

  function statusBadge(s) { return '<span class="ecom-badge st-' + esc(s || "") + '">' + esc(EC.statusText(s)) + "</span>"; }

  function itemResult(it) {
    if (it.status === "failed") return '<span class="ecom-err">' + esc(it.error || "失败") + "</span>";
    const r = it.result_json || {};
    if (it.ref_type === "shop") return "采集 " + esc(r.collected == null ? "-" : r.collected) + " 件";
    const bits = [];
    if (r.product_id) bits.push("商品 " + esc(r.product_id));
    if (r.skus != null) bits.push("SKU " + esc(r.skus));
    if (r.media != null) bits.push("素材 " + esc(r.media));
    return bits.join(" · ") || "完成";
  }

  function itemsTable(items) {
    if (!items || !items.length) return '<div class="ecom-empty">暂无明细</div>';
    return '<table class="ecom-table"><thead><tr><th>#</th><th>采集对象</th><th>状态</th><th>结果 / 原因</th></tr></thead><tbody>'
      + items.map(function (it) {
        return "<tr><td>" + esc(it.seq) + "</td>"
          + '<td class="ecom-mono" title="' + esc(it.ref_id) + '">' + esc(String(it.ref_id || "").slice(0, 48)) + "</td>"
          + "<td>" + statusBadge(it.status) + "</td>"
          + "<td>" + itemResult(it) + "</td></tr>";
      }).join("")
      + "</tbody></table>";
  }

  function paintProgress(host, task) {
    const box = host.querySelector("#ecomCollectProgress");
    if (!box) return;
    if (!task) { box.innerHTML = ""; return; }
    const p = Math.max(0, Math.min(100, Number(task.progress) || 0));
    box.innerHTML = '<div class="ecom-panel"><div class="ecom-panel-h"><span>采集进度</span>'
      + statusBadge(task.status) + "</div>"
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-row ecom-task-row"><div class="ecom-row-main"><div class="ecom-row-t">' + esc(task.title || "采集任务") + "</div>"
      + '<div class="ecom-row-d">成功 ' + esc(task.done || 0) + " / 失败 " + esc(task.failed || 0) + " / 共 " + esc(task.total || 0) + "</div></div>"
      + '<div class="ecom-row-prog"><div class="ecom-progress"><i style="width:' + p + '%"></i></div></div></div>'
      + (task.error ? '<div class="ecom-err">' + esc(task.error) + "</div>" : "")
      + '<div class="ecom-line">'
      + (task.failed > 0 && EC.isTerminal(task.status) ? '<button class="btn" data-retry>重试失败项</button>' : "")
      + '<button class="btn" data-goto-products>去商品库</button>'
      + "</div></div></div>";
    const retry = box.querySelector("[data-retry]");
    if (retry) retry.onclick = function () { retryTask(host, task.id); };
    const gp = box.querySelector("[data-goto-products]");
    if (gp) gp.onclick = function () { EC.go("ecomProducts"); };
  }

  function parseUrls(text) {
    return String(text || "").split(/[\s,，;；]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function submit(host) {
    const textarea = host.querySelector("#ecomCollectUrls");
    const shopInput = host.querySelector("#ecomCollectShop");
    const body = { platform: S.platform, mode: S.mode };
    if (S.mode === "shop") {
      const url = (shopInput && shopInput.value || "").trim();
      if (!url) return EC.toast("请输入店铺地址", "err");
      body.shop_url = url;
    } else {
      const urls = parseUrls(textarea && textarea.value);
      if (!urls.length) return EC.toast("请输入商品链接（每行一个）", "err");
      body.urls = urls;
    }
    const btn = host.querySelector("#ecomCollectSubmit");
    if (btn) btn.disabled = true;
    paintProgress(host, { status: "queued", title: "正在提交…", total: body.urls ? body.urls.length : 1, done: 0, failed: 0, progress: 0 });
    EC.api("POST", "/collect", body).then(function (res) {
      if (btn) btn.disabled = false;
      S.taskId = res.task && res.task.id;
      EC.toast("已提交采集任务", "ok");
      poll(host);
      loadRecent(host);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      paintProgress(host, null);
      EC.toast(e.message || "提交失败", "err");
    });
  }

  function poll(host) {
    if (!S.taskId) return;
    stopPoll();
    S.polling = true;
    EC.api("GET", "/collect/" + encodeURIComponent(S.taskId)).then(function (res) {
      paintProgress(host, res.task);
      const box = host.querySelector("#ecomCollectResults");
      if (box) box.innerHTML = itemsTable(res.items);
      if (EC.isTerminal(res.task && res.task.status)) { stopPoll(); loadRecent(host); return; }
      if (S.polling) S.timer = setTimeout(function () { poll(host); }, 1200);
    }).catch(function (e) {
      stopPoll();
      EC.toast(e.message || "读取进度失败", "err");
    });
  }

  function retryTask(host, taskId) {
    EC.api("POST", "/tasks/" + encodeURIComponent(taskId) + "/retry").then(function () {
      S.taskId = taskId;
      EC.toast("已重试失败项", "ok");
      poll(host);
    }).catch(function (e) { EC.toast(e.message || "重试失败", "err"); });
  }

  function openTask(host, taskId) {
    S.taskId = taskId;
    EC.api("GET", "/collect/" + encodeURIComponent(taskId)).then(function (res) {
      paintProgress(host, res.task);
      const box = host.querySelector("#ecomCollectResults");
      if (box) box.innerHTML = itemsTable(res.items);
      if (!EC.isTerminal(res.task && res.task.status)) poll(host);
    }).catch(function (e) { EC.toast(e.message || "读取任务失败", "err"); });
  }

  function loadRecent(host) {
    const box = host.querySelector("#ecomCollectRecent");
    if (!box) return;
    EC.api("GET", "/tasks?kind=collect&page_size=10").then(function (res) {
      const items = (res.items || []);
      box.innerHTML = items.length
        ? items.map(function (t) {
          return '<div class="ecom-row ecom-task-row' + (t.id === S.taskId ? " active" : "") + '" data-task="' + esc(t.id) + '">'
            + '<div class="ecom-row-main"><div class="ecom-row-t">' + esc(t.title || "采集任务") + "</div>"
            + '<div class="ecom-row-d">' + esc(EC.fmtTime(t.created_at)) + " · 成功 " + esc(t.done || 0) + " / 共 " + esc(t.total || 0) + "</div></div>"
            + statusBadge(t.status) + "</div>";
        }).join("")
        : '<div class="ecom-empty">还没有采集记录</div>';
      box.querySelectorAll("[data-task]").forEach(function (n) {
        n.onclick = function () { openTask(host, n.getAttribute("data-task")); };
      });
    }).catch(function () {});
  }

  /* ---------------- 插件采集（浏览器扩展） ---------------- */
  const P = { loaded: false, active: false, prefix: "", created_at: 0, token: "" };
  const EXT_ZIP = "/dian/ecom-collect-extension.zip";

  function copyText(text, msg) {
    const fn = (XLX.util && XLX.util.copyText) || function () { return Promise.resolve(false); };
    Promise.resolve(fn(text)).then(function (ok) {
      EC.toast(ok ? (msg || "已复制") : "复制失败，请手动复制", ok ? "ok" : "err");
    });
  }

  function pluginStatusHtml() {
    if (!P.loaded) return '<div class="ecom-empty">加载中…</div>';
    if (!P.active) return '<div class="ecom-empty">还没有插件口令，先点「生成口令」</div>';
    return '<div class="ecom-row ecom-task-row"><div class="ecom-row-main">'
      + '<div class="ecom-row-t">口令 ' + esc(P.prefix) + "…</div>"
      + '<div class="ecom-row-d">生成于 ' + esc(EC.fmtTime(P.created_at)) + " · 完整口令仅生成时显示一次</div></div>"
      + '<span class="ecom-badge st-succeeded">已启用</span></div>'
      + (P.token
        ? '<div class="ecom-field"><label class="ecom-label">完整口令（请立即复制，离开后不再显示）</label>'
          + '<div class="ecom-line"><input class="inp ecom-mono" id="ecomPluginToken" readonly value="' + esc(P.token) + '">'
          + '<button class="btn" data-plugin-copy>复制口令</button></div></div>'
        : "");
  }

  function pluginButtonsHtml() {
    if (!P.loaded) return "";
    if (!P.active) return '<button class="btn primary" data-plugin-mint>生成口令</button>';
    return (P.token ? '<button class="btn primary" data-plugin-copy>复制口令</button>' : "")
      + '<button class="btn" data-plugin-revoke>撤销口令</button>';
  }

  function pluginHtml() {
    const steps = [
      "下载扩展包并解压到任意目录：<a class=\"ecom-link\" href=\"" + EXT_ZIP + "\" download>ecom-collect-extension.zip</a>",
      "浏览器打开 <span class=\"ecom-mono\">chrome://extensions</span>（Edge 为 <span class=\"ecom-mono\">edge://extensions</span>），右上角开启「开发者模式」",
      "点「加载已解压的扩展程序」，选择解压后的目录",
      "点扩展图标，把上面的口令粘贴进去保存",
      "打开 1688 商品页或搜索结果页，点插件「采集本页」即可"
    ];
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>插件采集（1688 页面一键采集）</span>'
      + '<button class="ecom-link" data-plugin-refresh>刷新</button></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-hint">在 1688 页面用浏览器插件直接抓取，无需申请 1688 应用凭证；采集结果写入商品库，并自动把图片转存到本机。</div>'
      + '<div class="ecom-line"><span class="ecom-label">插件口令</span></div>'
      + '<div id="ecomPluginStatus">' + pluginStatusHtml() + "</div>"
      + '<div class="ecom-line" id="ecomPluginButtons">' + pluginButtonsHtml() + "</div>"
      + '<div class="ecom-sub-h">安装步骤</div>'
      + '<div class="ecom-pre">' + steps.map(function (t, i) {
        return '<div class="ecom-pre-item"><span class="ecom-badge">' + (i + 1) + "</span><span>" + t + "</span></div>";
      }).join("") + "</div>"
      + "</div></div>";
  }

  function loadPlugin(host) {
    EC.api("GET", "/plugin/token").then(function (res) {
      P.loaded = true;
      P.active = !!res.active;
      P.prefix = res.prefix || "";
      P.created_at = res.created_at || 0;
      repaintPlugin(host);
    }).catch(function () {
      P.loaded = true;
      repaintPlugin(host);
    });
  }

  function repaintPlugin(host) {
    const box = host.querySelector("#ecomPluginStatus");
    if (box) box.innerHTML = pluginStatusHtml();
    const btns = host.querySelector("#ecomPluginButtons");
    if (btns) btns.innerHTML = pluginButtonsHtml();
    bindPlugin(host);
  }

  function mintPlugin(host) {
    EC.api("POST", "/plugin/token", {}).then(function (res) {
      P.loaded = true; P.active = true;
      P.prefix = res.prefix || ""; P.created_at = res.created_at || 0;
      P.token = res.token || "";
      repaintPlugin(host);
      EC.toast("已生成插件口令，请立即复制", "ok");
    }).catch(function (e) { EC.toast(e.message || "生成失败", "err"); });
  }

  function revokePlugin(host) {
    EC.api("DELETE", "/plugin/token").then(function () {
      P.active = false; P.token = ""; P.prefix = ""; P.created_at = 0;
      repaintPlugin(host);
      EC.toast("已撤销插件口令", "ok");
    }).catch(function (e) { EC.toast(e.message || "撤销失败", "err"); });
  }

  function bindPlugin(host) {
    const mint = host.querySelector("[data-plugin-mint]");
    if (mint) mint.onclick = function () { mintPlugin(host); };
    const revoke = host.querySelector("[data-plugin-revoke]");
    if (revoke) revoke.onclick = function () { revokePlugin(host); };
    const copy = host.querySelector("[data-plugin-copy]");
    if (copy) copy.onclick = function () {
      const input = host.querySelector("#ecomPluginToken");
      copyText((input && input.value) || P.token, "口令已复制");
    };
  }

  function formHtml() {
    const sourceOpts = SOURCES.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === S.platform ? " selected" : "") + ">" + esc(s.label) + "</option>";
    }).join("");
    return '<div class="ecom-panel"><div class="ecom-panel-h">'
      + '<div class="ecom-tabs"><button class="ecom-tab' + (S.mode === "product" ? " active" : "") + '" data-mode="product">链接采集</button>'
      + '<button class="ecom-tab' + (S.mode === "shop" ? " active" : "") + '" data-mode="shop">整店采集</button></div>'
      + '<button class="ecom-link" data-view="ecomProducts">商品库</button></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-field"><label class="ecom-label">源平台</label><select class="inp" id="ecomCollectPlatform">' + sourceOpts + "</select></div>"
      + '<div class="ecom-field" id="ecomCollectProductField"' + (S.mode === "shop" ? ' style="display:none"' : "") + '>'
      + '<label class="ecom-label">商品链接（每行一个）</label>'
      + '<textarea class="inp ecom-textarea" id="ecomCollectUrls" rows="5" placeholder="https://detail.1688.com/offer/xxxxx.html&#10;https://detail.1688.com/offer/yyyyy.html"></textarea></div>'
      + '<div class="ecom-field" id="ecomCollectShopField"' + (S.mode === "product" ? ' style="display:none"' : "") + '>'
      + '<label class="ecom-label">店铺地址</label>'
      + '<input class="inp" id="ecomCollectShop" placeholder="https://xxxxx.1688.com/"></div>'
      + '<div class="ecom-line"><button class="btn primary" id="ecomCollectSubmit">开始采集</button>'
      + '<span class="ecom-hint">采集到的商品会写入商品库，可在「采集结果」逐项核对</span></div>'
      + "</div></div>";
  }

  function render(el) {
    stopPoll();
    el.innerHTML = '<div class="ecom-wrap">'
      + formHtml()
      + pluginHtml()
      + '<div id="ecomCollectProgress"></div>'
      + '<div class="ecom-grid2">'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>采集结果</span><button class="ecom-link" data-refresh>刷新</button></div>'
      + '<div class="ecom-panel-b" id="ecomCollectResults"><div class="ecom-empty">提交采集后在此查看明细</div></div></div>'
      + '<div class="ecom-panel"><div class="ecom-panel-h"><span>最近采集</span><button class="ecom-link" data-view="ecomTasks">任务中心</button></div>'
      + '<div class="ecom-panel-b" id="ecomCollectRecent"><div class="ecom-empty">加载中…</div></div></div>'
      + "</div></div>";

    el.querySelectorAll("[data-view]").forEach(function (n) {
      n.onclick = function () { EC.go(n.getAttribute("data-view")); };
    });
    el.querySelectorAll("[data-mode]").forEach(function (n) {
      n.onclick = function () {
        S.mode = n.getAttribute("data-mode");
        el.querySelectorAll("[data-mode]").forEach(function (x) { x.classList.toggle("active", x === n); });
        el.querySelector("#ecomCollectProductField").style.display = S.mode === "product" ? "" : "none";
        el.querySelector("#ecomCollectShopField").style.display = S.mode === "shop" ? "" : "none";
      };
    });
    const sel = el.querySelector("#ecomCollectPlatform");
    if (sel) sel.onchange = function () { S.platform = sel.value; };
    const submitBtn = el.querySelector("#ecomCollectSubmit");
    if (submitBtn) submitBtn.onclick = function () { submit(el); };
    const refresh = el.querySelector("[data-refresh]");
    if (refresh) refresh.onclick = function () { if (S.taskId) openTask(el, S.taskId); else loadRecent(el); };
    const pluginRefresh = el.querySelector("[data-plugin-refresh]");
    if (pluginRefresh) pluginRefresh.onclick = function () { loadPlugin(el); };

    loadPlugin(el);
    loadRecent(el);
    if (S.taskId) openTask(el, S.taskId);
  }

  EC.register("ecomCollect", render);
})();
