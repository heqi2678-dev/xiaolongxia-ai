/* 铜龙铺货采集器 · 后台 Service Worker
 * 保存后端地址与访问令牌，接收 content/popup 的采集请求并 POST 到铺货后端。
 */
"use strict";

const DEFAULT_BACKEND = "http://127.0.0.1:9150";

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND, token: "" }, (cfg) => resolve(cfg));
  });
}

async function postCollect(product) {
  const cfg = await getConfig();
  const url = cfg.backendUrl.replace(/\/$/, "") + "/api/collect";
  const headers = { "Content-Type": "application/json" };
  if (cfg.token) headers["Authorization"] = "Bearer " + cfg.token;
  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(product) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || ("HTTP " + resp.status));
  return data;
}

async function testConnection() {
  const cfg = await getConfig();
  const url = cfg.backendUrl.replace(/\/$/, "") + "/health";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || !msg.type) return false;
  if (msg.type === "collect") {
    postCollect(msg.product)
      .then((data) => reply({ ok: true, product: data.product }))
      .catch((e) => reply({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg.type === "test-connection") {
    testConnection().then((d) => reply({ ok: true, info: d })).catch((e) => reply({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "get-config") {
    getConfig().then((c) => reply({ ok: true, config: c }));
    return true;
  }
  if (msg.type === "set-config") {
    chrome.storage.local.set(
      { backendUrl: msg.backendUrl || DEFAULT_BACKEND, token: msg.token || "" },
      () => reply({ ok: true })
    );
    return true;
  }
  return false;
});
