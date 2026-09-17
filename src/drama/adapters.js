/* 铜龙电商 · AI 短剧工作台 · 适配器共享工具 */
/* HTTP、文件转换、轮询节流等无厂商逻辑的通用能力，供 adapters/ 下四个适配器复用。 */
(function () {
  XLX.drama = XLX.drama || {};
  XLX.drama.adapters = XLX.drama.adapters || {};
  const D = XLX.drama;

  function httpJson(url, opts) {
    return fetch(url, opts).then(async (r) => {
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      if (!r.ok) {
        const msg = (json && (json.error && (json.error.message || json.error.code) || json.message)) || text.slice(0, 200) || ("HTTP " + r.status);
        throw D.err("HTTP_" + r.status, msg);
      }
      return json;
    });
  }

  function httpText(url, opts) {
    return fetch(url, opts).then(async (r) => {
      const text = await r.text();
      if (!r.ok) throw D.err("HTTP_" + r.status, text.slice(0, 200) || ("HTTP " + r.status));
      return text;
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(D.err("NO_FILE", "未选择文件"));
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(D.err("FILE_READ", "文件读取失败"));
      fr.readAsDataURL(file);
    });
  }

  function urlToDataUrl(url) {
    return fetch(url).then(r => r.blob()).then(b => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(D.err("FILE_READ", "远程文件读取失败"));
      fr.readAsDataURL(b);
    }));
  }

  function b64ToBlobUrl(b64, mime) {
    const parts = Array.isArray(b64) ? b64 : [b64];
    const bufs = parts.map((s) => {
      const bin = atob(s);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    });
    const total = bufs.reduce((n, b) => n + b.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    bufs.forEach((b) => { all.set(b, off); off += b.length; });
    return URL.createObjectURL(new Blob([all], { type: mime || "audio/mpeg" }));
  }

  function audioDuration(url) {
    return new Promise((resolve) => {
      try {
        const a = new Audio();
        a.preload = "metadata";
        a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0);
        a.onerror = () => resolve(0);
        a.src = url;
      } catch (e) { resolve(0); }
    });
  }

  function ratioSize(def, ratio) {
    const m = (def && def.ratios && def.ratios[ratio]) || (def && def.ratios && def.ratios["1:1"]) || [1024, 1024];
    return m[0] + "x" + m[1];
  }

  function pick(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  /* 通用任务轮询：适配 seedance 与大多数任务式协议 */
  async function taskPoll(getUrl, authHeaders, urlPath) {
    const j = await httpJson(getUrl, { headers: authHeaders });
    const status = (j && (j.status || j.state)) || "";
    const map = { queued: "running", running: "running", processing: "running", pending: "running", succeeded: "done", success: "done", completed: "done", failed: "failed", cancelled: "failed", canceled: "failed" };
    const st = map[String(status).toLowerCase()] || "running";
    let outUrl = "";
    if (urlPath) outUrl = pick(j, urlPath) || "";
    if (!outUrl && j && j.content && j.content.video_url) outUrl = j.content.video_url;
    if (!outUrl && j && j.output && j.output.video_url) outUrl = j.output.video_url;
    return {
      status: st === "done" && !outUrl ? "running" : st,
      url: outUrl,
      error: j && j.error && (j.error.message || j.error.code),
      raw: j
    };
  }

  XLX.drama.adapterUtil = {
    httpJson, httpText, sleep, fileToDataUrl, urlToDataUrl, b64ToBlobUrl, audioDuration, ratioSize, pick, taskPoll
  };
})();
