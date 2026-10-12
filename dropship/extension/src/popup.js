/* 铜龙铺货采集器 · 弹窗 */
"use strict";

const $ = (id) => document.getElementById(id);

function setStatus(text, cls) {
  const el = $("status");
  el.textContent = text;
  el.className = cls || "";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadConfig() {
  const cfg = await chrome.runtime.sendMessage({ type: "get-config" });
  if (cfg && cfg.ok) {
    $("backendUrl").value = cfg.config.backendUrl || "";
    $("token").value = cfg.config.token || "";
  }
}

$("save").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({
    type: "set-config",
    backendUrl: $("backendUrl").value.trim(),
    token: $("token").value.trim()
  });
  setStatus("已保存", "ok");
});

$("test").addEventListener("click", async () => {
  setStatus("连接中…");
  const resp = await chrome.runtime.sendMessage({ type: "test-connection" });
  if (resp && resp.ok) setStatus("连接正常，适配器：" + (resp.info.adapters || []).join("/"), "ok");
  else setStatus("连接失败：" + ((resp && resp.error) || "未知"), "err");
});

$("collect").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab || !/1688\.com\/offer\//.test(tab.url || "")) {
    setStatus("请先打开 1688 商品详情页", "err");
    return;
  }
  setStatus("采集中…");
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "collect-now" });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || "解析失败");
    const sent = await chrome.runtime.sendMessage({ type: "collect", product: resp.product });
    if (!sent || !sent.ok) throw new Error((sent && sent.error) || "回传失败");
    setStatus("已采集：" + (resp.product.title || resp.product.source.itemId), "ok");
  } catch (e) {
    setStatus("失败：" + (e.message || e), "err");
  }
});

$("batch").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab || !/1688\.com\//.test(tab.url || "")) {
    setStatus("请先打开 1688 列表页 / 收藏夹", "err");
    return;
  }
  setStatus("批量采集中，请保持页面打开…");
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "collect-batch", limit: 30 });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || "批量采集失败");
    setStatus("已采集 " + resp.result.sent + "/" + resp.result.total + " 件", "ok");
  } catch (e) {
    setStatus("失败：" + (e.message || e), "err");
  }
});

loadConfig();
