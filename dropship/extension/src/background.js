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

async function apiGet(path) {
  const cfg = await getConfig();
  const url = cfg.backendUrl.replace(/\/$/, "") + path;
  const headers = {};
  if (cfg.token) headers["Authorization"] = "Bearer " + cfg.token;
  const resp = await fetch(url, { headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || ("HTTP " + resp.status));
  return data;
}

// 后端图片接口在 /api/* 下需要令牌，content 脚本不能直接 <a href>，
// 这里带令牌取回并转成 data URL，供缩略图预览与下载。
// 令牌只发给自家后端；1688/alicdn 等外部图床按普通请求取回。
async function fetchImageDataUrl(url) {
  const cfg = await getConfig();
  const backend = cfg.backendUrl.replace(/\/$/, "");
  const headers = {};
  if (cfg.token && url.indexOf(backend) === 0) headers["Authorization"] = "Bearer " + cfg.token;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("读取图片失败"));
    fr.readAsDataURL(blob);
  });
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
  if (msg.type === "list-products") {
    apiGet("/api/products?limit=" + (msg.limit || 100))
      .then((d) => reply({ ok: true, products: d.products || [], total: d.total || 0 }))
      .catch((e) => reply({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg.type === "fetch-image") {
    fetchImageDataUrl(msg.url)
      .then((dataUrl) => reply({ ok: true, dataUrl }))
      .catch((e) => reply({ ok: false, error: String(e.message || e) }));
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
