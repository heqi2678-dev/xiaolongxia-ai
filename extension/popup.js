/* 小龙虾采集 · 弹窗配置 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DEFAULT_ENDPOINT = "http://47.108.14.206/dian/api/ecom";

  function send(msg) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(msg, function (res) {
        void chrome.runtime.lastError;
        resolve(res || { ok: false, error: "扩展未响应" });
      });
    });
  }

  function setMsg(text, cls) {
    var el = $("msg");
    el.textContent = text || "";
    el.className = "msg" + (cls ? " " + cls : "");
  }

  function load() {
    send({ type: "get-config" }).then(function (res) {
      var cfg = (res && res.config) || {};
      $("endpoint").value = cfg.endpoint || DEFAULT_ENDPOINT;
      $("token").value = cfg.token || "";
      $("interval").value = cfg.interval || 800;
    });
    loadRecent();
  }

  function ensureOrigin(endpoint) {
    return new Promise(function (resolve) {
      var origin;
      try {
        origin = new URL(endpoint).origin + "/*";
      } catch (e) {
        resolve(false);
        return;
      }
      chrome.permissions.contains({ origins: [origin] }, function (has) {
        if (has) { resolve(true); return; }
        chrome.permissions.request({ origins: [origin] }, function (granted) {
          void chrome.runtime.lastError;
          resolve(!!granted);
        });
      });
    });
  }

  function save() {
    var endpoint = ($("endpoint").value || DEFAULT_ENDPOINT).trim().replace(/\/+$/, "");
    var token = ($("token").value || "").trim();
    var interval = parseInt($("interval").value, 10) || 800;
    if (!token) { setMsg("请填写插件口令", "err"); return; }
    $("save").disabled = true;
    ensureOrigin(endpoint).then(function (granted) {
      if (!granted) {
        $("save").disabled = false;
        setMsg("未授权访问该站点地址，请检查地址或重新授权", "err");
        return;
      }
      send({ type: "save-config", config: { endpoint: endpoint, token: token, interval: interval } })
        .then(function () {
          $("save").disabled = false;
          setMsg("已保存，去 1688 页面点悬浮按钮即可采集", "ok");
        });
    });
  }

  function test() {
    setMsg("正在测试…");
    $("test").disabled = true;
    send({ type: "test" }).then(function (res) {
      $("test").disabled = false;
      if (res && res.ok) setMsg("连接正常，口令有效", "ok");
      else setMsg((res && res.error) || "连接失败", "err");
    });
  }

  function loadRecent() {
    send({ type: "get-recent" }).then(function (res) {
      var list = (res && res.recent) || [];
      var box = $("recent");
      if (!list.length) {
        box.innerHTML = '<div class="recent-empty">还没有采集记录</div>';
        return;
      }
      box.innerHTML = list.map(function (r) {
        var ok = (r.saved || 0) > 0 && !r.error;
        var when = new Date(r.ts).toLocaleString();
        var desc = ok
          ? "已入库" + (r.product_id ? " · " + r.product_id : "")
          : (r.error || "采集失败");
        return '<div class="recent-item' + (ok ? "" : " err") + '">'
          + '<div class="t">' + esc(r.title || r.source_id || "商品") + "</div>"
          + '<div class="d">' + esc(when + " · " + desc) + "</div></div>";
      }).join("");
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  $("save").onclick = save;
  $("test").onclick = test;
  $("clear").onclick = function () {
    send({ type: "clear-recent" }).then(loadRecent);
  };

  load();
})();
