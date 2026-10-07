/* 铜龙AI · 电商工作台 · 本地资产库 + 生成桥接 + 通用 UI
 * 真实能力：IndexedDB 持久化（不可用时内存兜底）、生图适配器、语言模型问答、文件上传、画布导出。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const U = XLX.util || {};
  const W = (typeof window !== "undefined") ? window : {};

  function uid(p) {
    return (p || "e") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function now() { return Date.now(); }
  function toast(msg, type) { if (EC.toast) EC.toast(msg, type); else if (U.toast) U.toast(msg, type); }
  function err(code, msg) { return (D.err ? D.err(code, msg) : new Error(msg || code)); }

  /* ---------------- IndexedDB（不可用时内存兜底） ---------------- */
  const MEM = { assets: new Map(), projects: new Map() };
  let _db = null, _probe = null;

  function openDB() {
    if (_probe) return _probe;
    _probe = new Promise(function (resolve) {
      if (!W.indexedDB) return resolve(null);
      let req;
      try { req = W.indexedDB.open("xlx_ecom", 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        const d = req.result;
        if (!d.objectStoreNames.contains("assets")) {
          const s = d.createObjectStore("assets", { keyPath: "id" });
          s.createIndex("kind", "kind"); s.createIndex("createdAt", "createdAt");
        }
        if (!d.objectStoreNames.contains("projects")) {
          const p = d.createObjectStore("projects", { keyPath: "id" });
          p.createIndex("createdAt", "createdAt");
        }
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { resolve(null); };
    });
    return _probe;
  }

  function idbReq(req) {
    return new Promise(function (res, rej) { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }
  function dbPut(storeName, rec) {
    return openDB().then(function (d) {
      if (!d) { MEM[storeName].set(rec.id, rec); return rec; }
      const t = d.transaction(storeName, "readwrite");
      t.objectStore(storeName).put(rec);
      return new Promise(function (res, rej) { t.oncomplete = () => res(rec); t.onerror = () => rej(t.error); });
    });
  }
  function dbGet(storeName, id) {
    return openDB().then(function (d) {
      if (!d) return MEM[storeName].get(id) || null;
      return idbReq(d.transaction(storeName).objectStore(storeName).get(id)).then(x => x || null);
    });
  }
  function dbAll(storeName) {
    return openDB().then(function (d) {
      if (!d) return Array.from(MEM[storeName].values());
      return idbReq(d.transaction(storeName).objectStore(storeName).getAll());
    });
  }
  function dbDel(storeName, id) {
    return openDB().then(function (d) {
      if (!d) { MEM[storeName].delete(id); return; }
      const t = d.transaction(storeName, "readwrite");
      t.objectStore(storeName).delete(id);
      return new Promise(function (res, rej) { t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
    });
  }
  function dbClear(storeName) {
    return openDB().then(function (d) {
      if (!d) { MEM[storeName].clear(); return; }
      const t = d.transaction(storeName, "readwrite");
      t.objectStore(storeName).clear();
      return new Promise(function (res, rej) { t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
    });
  }

  /* ---------------- 资产对象地址 ---------------- */
  const OBJ = {};
  function srcOf(a) {
    if (!a) return "";
    if (a.blob && W.URL && W.URL.createObjectURL) {
      if (!OBJ[a.id]) { try { OBJ[a.id] = W.URL.createObjectURL(a.blob); } catch (e) { OBJ[a.id] = ""; } }
      return OBJ[a.id] || a.url || "";
    }
    return a.url || a.dataUrl || "";
  }

  /* ---------------- 资产 CRUD ---------------- */
  function addAsset(rec) {
    const r = Object.assign({ id: uid("as"), createdAt: now(), kind: "image", name: "", meta: {} }, rec || {});
    return dbPut("assets", r).then(function () { return r; });
  }
  function addFile(file, meta) {
    return addAsset(Object.assign({ blob: file, mime: file.type, name: file.name || "upload" }, meta || {}));
  }
  function addFromUrl(url, meta) {
    const base = Object.assign({ url: url, name: (meta && meta.name) || "生成结果" }, meta || {});
    return fetch(url, { mode: "cors", credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP_" + r.status);
      return r.blob();
    }).then(function (b) {
      if (!b || !b.size) throw new Error("EMPTY");
      return addAsset(Object.assign(base, { blob: b, mime: b.type || "image/png" }));
    }).catch(function () { return addAsset(base); });
  }
  function addDataUrl(dataUrl, meta) {
    return addAsset(Object.assign({ dataUrl: dataUrl }, meta || {}));
  }
  function listAssets(filter) {
    return dbAll("assets").then(function (arr) {
      let out = arr.slice();
      if (filter && filter.kind) {
        const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind];
        out = out.filter(a => kinds.indexOf(a.kind) >= 0);
      }
      return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    });
  }
  function removeAsset(id) {
    if (OBJ[id]) { try { W.URL.revokeObjectURL(OBJ[id]); } catch (e) {} delete OBJ[id]; }
    return dbDel("assets", id);
  }
  function clearAssets() { return dbClear("assets"); }

  /* ---------------- 项目（轻量） ---------------- */
  function saveProject(rec) {
    const r = Object.assign({ id: uid("pj"), createdAt: now(), updatedAt: now() }, rec || {});
    r.updatedAt = now();
    return dbPut("projects", r).then(function () { return r; });
  }
  function listProjects() { return dbAll("projects").then(a => a.sort((x, y) => (y.updatedAt || y.createdAt || 0) - (x.updatedAt || x.createdAt || 0))); }
  function removeProject(id) { return dbDel("projects", id); }

  /* ---------------- 下载 / 导出 ---------------- */
  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || "").split(",");
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/png";
    const bin = (W.atob ? W.atob : atob)(parts[1] || "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  function blobToDataUrl(blob) {
    return new Promise(function (res, rej) {
      const fr = new FR();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  function FR() { return (W.FileReader || FileReader)(); }
  function downloadBlob(blob, filename) {
    const url = W.URL && W.URL.createObjectURL ? W.URL.createObjectURL(blob) : "";
    const a = document.createElement("a");
    a.href = url; a.download = filename || "download"; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { W.URL.revokeObjectURL(url); } catch (e) {} }, 5000);
  }
  function download(asset, filename) {
    if (!asset) return;
    const name = filename || asset.name || (asset.id + (String(asset.mime || "").indexOf("png") >= 0 ? ".png" : ".jpg"));
    if (asset.blob) return downloadBlob(asset.blob, name);
    if (asset.dataUrl) return downloadBlob(dataUrlToBlob(asset.dataUrl), name);
    const url = srcOf(asset) || asset.url;
    if (!url) { toast("该素材无可下载内容", "warn"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }
  function canvasToBlob(cv, mime, q) {
    return new Promise(function (res, rej) {
      if (cv.toBlob) cv.toBlob(function (b) { b ? res(b) : rej(err("EXPORT_FAIL", "导出失败（画布可能被跨域图片污染）")); }, mime || "image/png", q);
      else { try { res(dataUrlToBlob(cv.toDataURL(mime || "image/png"))); } catch (e) { rej(e); } }
    });
  }
  function loadImage(src) {
    return new Promise(function (res, rej) {
      const im = new W.Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(im);
      im.onerror = () => rej(err("IMG_FAIL", "图片加载失败"));
      im.src = src;
    });
  }

  /* ---------------- 生图 / 语言模型桥接 ---------------- */
  function imageConfigured() { try { return !!D.isConfigured("image"); } catch (e) { return false; } }
  const RATIO_WH = {
    "1:1": [1024, 1024], "3:4": [768, 1024], "4:3": [1024, 768],
    "16:9": [1280, 720], "9:16": [720, 1280], "2:3": [768, 1152], "3:2": [1152, 768]
  };
  function ratioWH(ratio) {
    const k = String(ratio || "1:1").replace(/\s/g, "");
    if (RATIO_WH[k]) return RATIO_WH[k];
    const m = k.match(/^(\d+)[:x](\d+)$/);
    if (m) {
      const w = Number(m[1]), h = Number(m[2]);
      if (w > 0 && h > 0) return [Math.round(1024 * w / Math.max(w, h)), Math.round(1024 * h / Math.max(w, h))];
    }
    return [1024, 1024];
  }
  function pollinationsUrl(prompt, ratio) {
    const wh = ratioWH(ratio);
    return "https://image.pollinations.ai/prompt/" + encodeURIComponent(String(prompt || "").slice(0, 800))
      + "?width=" + wh[0] + "&height=" + wh[1] + "&nologo=true&model=flux&seed=" + Math.floor(Math.random() * 1e6);
  }
  /* 真实生图：优先已配置服务（豆包/通义/自定义），未配置时用免费 Pollinations 兜底。 */
  function generate(opts) {
    opts = opts || {};
    if (imageConfigured() && D.adapters && D.adapters.image && D.adapters.image.generate) {
      return Promise.resolve(D.adapters.image.generate(opts)).then(function (r) {
        if (r && r.url) return r;
        return { url: pollinationsUrl(opts.prompt, opts.ratio), provider: "pollinations" };
      }).catch(function (e) {
        if (e && (e.code === "NO_KEY" || e.code === "no_key")) {
          return { url: pollinationsUrl(opts.prompt, opts.ratio), provider: "pollinations" };
        }
        throw e;
      });
    }
    return Promise.resolve({ url: pollinationsUrl(opts.prompt, opts.ratio), provider: "pollinations" });
  }
  function providerName() {
    if (!imageConfigured()) return "Pollinations 免费";
    try { const c = D.getAdapterConfig("image"); return (c.def && c.def.name) || c.provider || "已配置服务"; } catch (e) { return "已配置服务"; }
  }
  function llmConfigured() { try { return !!(XLX.llm && XLX.llm.isConfigured && XLX.llm.isConfigured()); } catch (e) { return false; } }
  function ask(sys, user, opts) {
    if (!llmConfigured()) return Promise.reject(err("NO_LLM", "尚未配置语言模型，请到「设置」填写 API Key"));
    return XLX.llm.ask(sys, user, opts || {});
  }
  /* 视频 / 配音 / 对口型桥接：均无免费兜底，未配置时抛 NOT_CONFIGURED。 */
  function videoConfigured() { try { return !!D.isConfigured("video"); } catch (e) { return false; } }
  function video(opts, onProgress, signal) {
    if (!videoConfigured() || !D.adapters || !D.adapters.video || !D.adapters.video.generate) {
      return Promise.reject(err("NOT_CONFIGURED", "尚未配置视频模型，请到「设置 → 短剧服务」填写"));
    }
    return Promise.resolve(D.adapters.video.generate(opts || {}, onProgress, signal));
  }
  function ttsConfigured() { try { return !!D.isConfigured("tts"); } catch (e) { return false; } }
  function synth(opts) {
    if (!ttsConfigured() || !D.adapters || !D.adapters.tts || !D.adapters.tts.synth) {
      return Promise.reject(err("NOT_CONFIGURED", "尚未配置语音合成服务，请到「设置 → 短剧服务」填写"));
    }
    return Promise.resolve(D.adapters.tts.synth(opts || {}));
  }
  function lipsyncConfigured() { try { return !!D.isConfigured("lipsync"); } catch (e) { return false; } }
  function lipsync(opts, onProgress, signal) {
    if (!lipsyncConfigured() || !D.adapters || !D.adapters.lipsync || !D.adapters.lipsync.generate) {
      return Promise.reject(err("NOT_CONFIGURED", "尚未配置对口型服务，请到「设置 → 短剧服务」填写"));
    }
    return Promise.resolve(D.adapters.lipsync.generate(opts || {}, onProgress, signal));
  }
  function kindConfigured(kind) {
    const fns = {
      image: imageConfigured, video: videoConfigured, tts: ttsConfigured,
      lipsync: lipsyncConfigured, stt: sttConfigured, ocr: ocrConfigured
    };
    const fn = fns[kind || "image"];
    return fn ? !!fn() : false;
  }
  function sttConfigured() { try { return !!D.isConfigured("stt"); } catch (e) { return false; } }
  function transcribe(opts) {
    if (!sttConfigured() || !D.adapters || !D.adapters.stt || !D.adapters.stt.transcribe) {
      return Promise.reject(err("NO_STT", "尚未配置语音识别服务，请到「设置 → 短剧服务」填写"));
    }
    return Promise.resolve(D.adapters.stt.transcribe(opts || {}));
  }
  function ocrConfigured() { try { return !!D.isConfigured("ocr"); } catch (e) { return false; } }
  function recognizeText(opts) {
    if (!ocrConfigured() || !D.adapters || !D.adapters.ocr || !D.adapters.ocr.recognize) {
      return Promise.reject(err("NO_OCR", "尚未配置文字识别服务，请到「设置 → 短剧服务」填写"));
    }
    return Promise.resolve(D.adapters.ocr.recognize(opts || {}));
  }
  /* 字幕/画面文字烧制：由网关用 ffmpeg 合成（服务端能力，无需本地配置）。 */
  function subtitle(opts) {
    return fetch("/dian/api/drama/subtitle", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts || {})
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) { return { r: r, j: j }; });
    }).then(function (o) {
      if (!o.r.ok || !o.j || !o.j.ok || !o.j.url) {
        throw err("SUB_FAIL", (o.j && o.j.error) || "字幕合成失败，请稍后再试");
      }
      return { url: o.j.url, file: o.j.file };
    });
  }
  function extractJson(text) {
    if (!text) return null;
    let s = String(text).trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    const arr = s.indexOf("["), arrEnd = s.lastIndexOf("]");
    if (arr >= 0 && (a < 0 || arr < a)) {
      try { return JSON.parse(s.slice(arr, arrEnd + 1)); } catch (e) {}
    }
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  /* 云端模型只收公网 URL：把本地资产上传到网关 /dian/api/drama/asset 换回公网地址。 */
  async function publicUrl(asset) {
    if (!asset) throw err("NO_ASSET", "缺少素材");
    if (asset.url && /^https?:\/\//i.test(asset.url)) return asset.url;
    let blob = asset.blob;
    if (!blob && asset.dataUrl) blob = dataUrlToBlob(asset.dataUrl);
    if (!blob) {
      const u = srcOf(asset);
      if (u) blob = await fetch(u).then(r => r.blob()).catch(() => null);
    }
    if (!blob) throw err("NO_ASSET", "本地素材读不到，请重新上传或生成");
    const r = await fetch("/dian/api/drama/asset", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok || !j.url) throw err("UPLOAD_FAIL", (j && j.error) || "素材上传到公网失败，请稍后再试");
    return j.url;
  }

  /* ---------------- 通用 UI ---------------- */
  function pickFiles(accept, multiple) {
    return new Promise(function (resolve) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = accept || "image/*"; inp.multiple = multiple !== false;
      inp.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      inp.onchange = function () { const f = Array.from(inp.files || []); inp.remove(); resolve(f); };
      document.body.appendChild(inp); inp.click();
    });
  }

  let _menuAt = 0;
  function closeMenus() { document.querySelectorAll(".ecmenu").forEach(n => n.remove()); }
  if (!W._ecomMenuBound) {
    W._ecomMenuBound = true;
    document.addEventListener("click", function () { if (now() - _menuAt > 40) closeMenus(); });
    if (W.addEventListener) W.addEventListener("resize", closeMenus);
  }
  function menu(anchor, items) {
    closeMenus();
    _menuAt = now();
    const m = document.createElement("div");
    m.className = "ecmenu";
    (items || []).forEach(function (it) {
      if (it.sep) { const s = document.createElement("div"); s.className = "ecmenu-sep"; m.appendChild(s); return; }
      const d = document.createElement("div");
      d.className = "ecmenu-mi" + (it.on ? " on" : "");
      d.textContent = it.label;
      d.addEventListener("click", function (e) { e.stopPropagation(); closeMenus(); it.pick && it.pick(); });
      m.appendChild(d);
    });
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 20, bottom: 40 };
    m.style.left = Math.max(8, Math.min(r.left, (W.innerWidth || 1200) - (m.offsetWidth || 160) - 10)) + "px";
    m.style.top = (r.bottom + 6) + "px";
    return m;
  }

  function modal(opts) {
    opts = opts || {};
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    const box = document.createElement("div");
    box.className = "modal" + (opts.wide ? " modal-wide" : "");
    box.innerHTML = '<div class="modal-head"><h3>' + (U.esc ? U.esc(opts.title || "") : (opts.title || "")) + '</h3>'
      + '<button class="modal-close" aria-label="关闭">&times;</button></div><div class="modal-body"></div>';
    const body = box.querySelector(".modal-body");
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    mask.appendChild(box);
    document.body.appendChild(mask);
    function close() { mask.remove(); opts.onClose && opts.onClose(); }
    box.querySelector(".modal-close").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    return { el: box, body: body, close: close };
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn._label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spin"></span>' + (label || "处理中…");
    } else {
      btn.disabled = false;
      if (btn._label != null) btn.innerHTML = btn._label;
    }
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag || "div");
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  EC.store = {
    ready: openDB,
    addAsset, addFile, addFromUrl, addDataUrl,
    list: listAssets, get: (id) => dbGet("assets", id), remove: removeAsset, clear: clearAssets,
    src: srcOf, download, downloadBlob, canvasToBlob, loadImage, dataUrlToBlob, blobToDataUrl, publicUrl,
    saveProject, listProjects, removeProject
  };
  EC.gen = { image: generate, configured: kindConfigured, providerName, ratioWH, pollinationsUrl, llmConfigured, ask, extractJson, stt: transcribe, sttConfigured, ocr: recognizeText, ocrConfigured, video, videoConfigured, tts: synth, ttsConfigured, lipsync, lipsyncConfigured, subtitle };
  EC.ui = { pickFiles, menu, closeMenus, modal, toast, busy, el, uid, err };
})();
