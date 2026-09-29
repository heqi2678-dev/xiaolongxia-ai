/* 小龙虾 1688 采集 · 内容脚本
 * 仅在 *.1688.com 渲染入口；只读页面数据，不写任何内容到 1688。
 */
(function () {
  if (!/(^|\.)1688\.com$/i.test(location.hostname)) return;
  if (window.__xlxCollectInjected) return;
  window.__xlxCollectInjected = true;

  function isDetailPage() {
    return /\/offer\/\d{6,}\.html/.test(location.pathname) || /\/offer\/\d{6,}/.test(location.href);
  }

  function send(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          void chrome.runtime.lastError;
          resolve(res || { ok: false, error: "扩展未响应" });
        });
      } catch (e) {
        resolve({ ok: false, error: "扩展未响应" });
      }
    });
  }

  var root = document.createElement("div");
  root.className = "xlx-collect";
  root.innerHTML = [
    '<div class="xlx-collect-bar">',
    '  <span class="xlx-collect-logo">小龙虾采集</span>',
    '  <button class="xlx-collect-btn" data-act="main">采集本商品</button>',
    '  <button class="xlx-collect-min" title="收起" data-act="toggle">−</button>',
    "</div>",
    '<div class="xlx-collect-body" hidden>',
    '  <div class="xlx-collect-status" data-status>就绪</div>',
    '  <div class="xlx-collect-sub" data-sub></div>',
    "</div>"
  ].join("");
  document.body.appendChild(root);

  var statusEl = root.querySelector("[data-status]");
  var subEl = root.querySelector("[data-sub]");
  var body = root.querySelector(".xlx-collect-body");
  var mainBtn = root.querySelector('[data-act="main"]');
  var toggleBtn = root.querySelector('[data-act="toggle"]');

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "xlx-collect-status" + (cls ? " " + cls : "");
    body.hidden = false;
  }
  function setSub(text) { subEl.textContent = text || ""; }

  toggleBtn.onclick = function () {
    body.hidden = !body.hidden;
    toggleBtn.textContent = body.hidden ? "+" : "−";
  };

  function collectDetail() {
    mainBtn.disabled = true;
    setStatus("正在采集本商品…");
    setSub("");
    send({ type: "collect-detail" }).then(function (res) {
      mainBtn.disabled = false;
      if (res && res.ok) {
        setStatus("已入库：" + (res.title || "商品"), "ok");
        setSub("可在小龙虾「商品库」查看，图片正在后台转存");
      } else {
        setStatus((res && res.error) || "采集失败", "err");
      }
    });
  }

  function collectBatch() {
    var offers = (self.XLX1688 && self.XLX1688.parseList()) || [];
    if (!offers.length) {
      setStatus("本页没找到 1688 商品链接", "err");
      return;
    }
    var urls = offers.map(function (o) { return o.source_url; });
    mainBtn.disabled = true;
    setStatus("开始批量采集 " + urls.length + " 件…");
    send({ type: "collect-batch", urls: urls }).then(function (res) {
      mainBtn.disabled = false;
      if (res && res.ok) {
        setStatus("批量完成：成功 " + res.okCount + " / 失败 " + res.failed, "ok");
        setSub("共 " + res.total + " 件");
      } else {
        setStatus((res && res.error) || "批量采集失败", "err");
      }
    });
  }

  mainBtn.onclick = function () {
    if (isDetailPage()) collectDetail();
    else collectBatch();
  };

  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || msg.type !== "batch-progress") return;
    var p = msg.payload || {};
    if (p.finished) {
      setStatus("批量完成：成功 " + p.ok + " / 失败 " + p.failed, "ok");
      setSub("共 " + p.total + " 件");
    } else {
      setStatus("采集中 " + p.done + " / " + p.total);
      setSub(p.current || "");
    }
  });

  if (!isDetailPage()) {
    mainBtn.textContent = "采集本页商品";
    setStatus("列表页：点按钮采集本页全部商品");
  }
})();
