/* 小龙虾 1688 采集 · Service Worker
 * 唯一发起后端请求的地方：持有站点地址与口令，负责提交入库、失败重试与批量编排。
 */
importScripts("parsers/1688.js");

var DEFAULTS = {
  endpoint: "http://47.108.14.206/dian/api/ecom",
  token: "",
  interval: 800
};
var MAX_RETRY = 3;
var RECENT_MAX = 30;

function getConfig() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(DEFAULTS, function (cfg) { resolve(cfg); });
  });
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function isNetworkError(err) {
  var msg = String((err && err.message) || err || "");
  if (/口令|无效|撤销|unavailable|缺少|不支持|最多/.test(msg)) return false;
  return true;
}

function endpoints(cfg) {
  return String(cfg.endpoint || "").replace(/\/+$/, "");
}

function request(cfg, method, path, body) {
  var url = endpoints(cfg) + path;
  var opts = {
    method: method,
    headers: { "X-Ecom-Token": cfg.token || "" }
  };
  if (body !== undefined && body !== null) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  return fetch(url, opts).then(function (resp) {
    return resp.json().catch(function () { return { ok: false, error: "HTTP_" + resp.status }; })
      .then(function (j) {
        if (resp.status === 401) throw new Error("插件口令无效或已撤销，请在插件里重新配置");
        if (!resp.ok || !j || j.ok === false) {
          throw new Error((j && j.error) || ("HTTP_" + resp.status));
        }
        return j;
      });
  });
}

function ingest(platform, items) {
  return getConfig().then(function (cfg) {
    if (!cfg.token) throw new Error("尚未配置插件口令，请点扩展图标填写");
    var attempt = 0;
    function run() {
      return request(cfg, "POST", "/collect/ingest", { platform: platform, items: items })
        .catch(function (err) {
          if (attempt >= MAX_RETRY || !isNetworkError(err)) throw err;
          attempt++;
          return sleep(500 * Math.pow(2, attempt - 1)).then(run);
        });
    }
    return run();
  });
}

function pushRecent(record) {
  return new Promise(function (resolve) {
    chrome.storage.local.get({ recent: [] }, function (st) {
      var list = st.recent || [];
      list.unshift(record);
      chrome.storage.local.set({ recent: list.slice(0, RECENT_MAX) }, resolve);
    });
  });
}

function recordFromIngest(summary, extra) {
  var rec = {
    ts: Date.now(),
    title: (extra && extra.title) || "",
    source_id: (extra && extra.source_id) || "",
    saved: summary.saved || 0,
    failed: summary.failed || 0,
    product_id: "",
    media_task_id: summary.media_task_id || "",
    error: ""
  };
  if (summary.results && summary.results.length) {
    rec.product_id = summary.results[0].product_id || "";
    if (summary.results[0].error) rec.error = summary.results[0].error;
  }
  if (summary.errors && summary.errors.length) rec.error = summary.errors[0].error || rec.error;
  return rec;
}

/* ---------------- 单个商品 ---------------- */

function waitTabComplete(tabId, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("页面加载超时"));
    }, timeoutMs || 20000);
    function listener(id, info) {
      if (id !== tabId || info.status !== "complete") return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, function () {
      if (chrome.runtime.lastError) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });
}

function parseDetailInTab(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: "MAIN",
    func: self.XLX1688.parseDetail
  }).then(function (out) {
    return (out && out[0] && out[0].result) || null;
  });
}

function collectDetail(tabId) {
  var tries = 0;
  function attempt() {
    return parseDetailInTab(tabId).then(function (raw) {
      tries++;
      if (!raw || !raw.source_id || !raw.title) {
        if (tries < 3) return sleep(1400).then(attempt);
        throw new Error("未解析到商品数据，请确认这是 1688 商品详情页并已加载完成");
      }
      return ingest("1688", [raw]).then(function (summary) {
        var rec = recordFromIngest(summary, raw);
        pushRecent(rec);
        return { ok: true, raw: raw, summary: summary };
      });
    });
  }
  return attempt();
}

/* ---------------- 列表页批量（逐个详情页解析） ---------------- */

function batchProgress(tabId, payload) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, { type: "batch-progress", payload: payload }, function () {
      void chrome.runtime.lastError;
    });
  } catch (e) { /* popup/内容脚本可能已关闭 */ }
}

function collectBatch(tabId, urls) {
  var cfgPromise = getConfig();
  return cfgPromise.then(function (cfg) {
    var total = urls.length;
    var done = 0;
    var ok = 0;
    var failed = 0;
    var results = [];

    function step(index) {
      if (index >= total) {
        batchProgress(tabId, { finished: true, total: total, done: done, ok: ok, failed: failed, results: results });
        return { ok: true, total: total, okCount: ok, failed: failed, results: results };
      }
      var url = urls[index];
      batchProgress(tabId, { finished: false, total: total, done: done, ok: ok, failed: failed, current: url });
      return chrome.tabs.create({ url: url, active: false }).then(function (tab) {
        var finish = function (rec) {
          results.push(rec);
          done++;
          if (rec.ok) ok++; else failed++;
          batchProgress(tabId, { finished: false, total: total, done: done, ok: ok, failed: failed, current: url });
        };
        return waitTabComplete(tab.id, 25000)
          .then(function () { return sleep(1200); })
          .then(function () { return parseDetailInTab(tab.id); })
          .then(function (raw) {
            if (!raw || !raw.source_id || !raw.title) throw new Error("未解析到商品数据");
            return ingest("1688", [raw]).then(function (summary) {
              var rec = recordFromIngest(summary, raw);
              pushRecent(rec);
              return finish({ ok: true, url: url, title: raw.title, source_id: raw.source_id, product_id: rec.product_id });
            });
          })
          .catch(function (err) {
            finish({ ok: false, url: url, error: (err && err.message) || "采集失败" });
          })
          .then(function () {
            return chrome.tabs.remove(tab.id).catch(function () {});
          })
          .then(function () {
            return sleep(cfg.interval || DEFAULTS.interval);
          })
          .then(function () { return step(index + 1); });
      });
    }
    return step(0);
  });
}

/* ---------------- 消息路由 ---------------- */

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return false;
  var tabId = sender && sender.tab ? sender.tab.id : null;

  if (msg.type === "get-config") {
    getConfig().then(function (cfg) { sendResponse({ ok: true, config: cfg }); });
    return true;
  }
  if (msg.type === "save-config") {
    var patch = msg.config || {};
    chrome.storage.local.set(patch, function () {
      getConfig().then(function (cfg) { sendResponse({ ok: true, config: cfg }); });
    });
    return true;
  }
  if (msg.type === "test") {
    getConfig().then(function (cfg) {
      if (!cfg.token) throw new Error("尚未配置插件口令");
      return request(cfg, "GET", "/stats?days=1");
    }).then(function (j) {
      sendResponse({ ok: true, stats: j });
    }).catch(function (e) {
      sendResponse({ ok: false, error: (e && e.message) || "连接失败" });
    });
    return true;
  }
  if (msg.type === "collect-detail") {
    collectDetail(tabId).then(function (r) {
      sendResponse({ ok: true, title: r.raw.title, summary: r.summary });
    }).catch(function (e) {
      sendResponse({ ok: false, error: (e && e.message) || "采集失败" });
    });
    return true;
  }
  if (msg.type === "collect-batch") {
    collectBatch(tabId, msg.urls || []).then(function (r) {
      sendResponse(r);
    }).catch(function (e) {
      sendResponse({ ok: false, error: (e && e.message) || "批量采集失败" });
    });
    return true;
  }
  if (msg.type === "get-recent") {
    chrome.storage.local.get({ recent: [] }, function (st) { sendResponse({ ok: true, recent: st.recent || [] }); });
    return true;
  }
  if (msg.type === "clear-recent") {
    chrome.storage.local.set({ recent: [] }, function () { sendResponse({ ok: true }); });
    return true;
  }
  return false;
});
