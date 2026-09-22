/* AI 短剧工作台 · 测试台
 * 在 Node 里用最小 DOM / fetch 桩加载 src/drama/*.js，供 tests/drama.test.js 调用。
 * 只加载前端逻辑，不触网、不依赖浏览器。 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DRAMA_FILES = [
  "config.js", "adapters.js", "adapters/image.js", "adapters/video.js",
  "adapters/tts.js", "adapters/lipsync.js", "project.js", "character.js",
  "takes.js", "engine.js", "compliance.js", "compose.js", "ui.js",
  "templates.js", "models.js", "timeline.js", "home.js", "guide.js",
  "manual.js", "auto.js", "makeup.js", "canvas.js", "box3d.js"
];

function noop() {}

function makeLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store
  };
}

/* 最小可用的 IndexedDB 桩：只支持本测试台用到的单个 objectStore 的 put/get。 */
function makeIndexedDB() {
  const data = {};
  return {
    open: () => {
      const req = { result: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => {
            const tx = {};
            tx.objectStore = () => ({
              put: (rec) => { data[rec.id] = rec; setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0); },
              get: (id) => {
                const rq = { result: data[id] || null };
                setTimeout(() => { if (rq.onsuccess) rq.onsuccess(); }, 0);
                return rq;
              }
            });
            return tx;
          }
        };
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    }
  };
}

function makeEl() {
  const node = {
    style: {}, dataset: {}, parentNode: null, childNodes: [],
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild(child) { this.childNodes.push(child); if (child) child.parentNode = this; return child; },
    insertBefore(child) { this.childNodes.push(child); if (child) child.parentNode = this; return child; },
    removeChild(child) { if (child) child.parentNode = null; return child; },
    remove: noop, focus: noop, setAttribute: noop, getAttribute: () => null, addEventListener: noop,
    querySelector: () => makeEl(), querySelectorAll: () => [], closest: () => null,
    insertAdjacentHTML: noop, getContext: () => ({}), innerHTML: "", textContent: "", value: "",
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    clientWidth: 800, clientHeight: 600,
    readyState: 0, duration: 0, currentTime: 0, poster: "",
    play: () => Promise.resolve(), pause: noop
  };
  return node;
}

/* 创建一份隔离的运行环境，返回 { D, sandbox, calls } */
function createDrama() {
  const calls = [];
  const sandbox = {
    console,
    document: {
      getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
      createElement: () => makeEl(), head: makeEl(), body: makeEl(),
      addEventListener: noop, documentElement: makeEl()
    },
    navigator: { mediaDevices: {} },
    localStorage: makeLocalStorage(),
    indexedDB: makeIndexedDB(),
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: noop, alert: noop,
    atob, btoa,
    AbortController: function () { this.signal = { aborted: false }; this.abort = noop; },
    Blob: function (parts, opts) {
      this.parts = parts || [];
      this.type = (opts && opts.type) || "";
      this.size = this.parts.reduce((n, p) => n + (p && (p.length || p.byteLength || 0)), 0);
    },
    FileReader: function () { this.readAsDataURL = noop; },
    Image: function () {},
    Audio: function () {
      this.play = noop; this.pause = noop;
      const self = this;
      Object.defineProperty(this, "src", {
        get() { return self._src; },
        set(v) { self._src = v; setTimeout(() => { if (self.onloadedmetadata) self.onloadedmetadata(); }, 0); }
      });
    },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: noop },
    performance: { now: () => Date.now() }
  };
  sandbox.window = { addEventListener: noop, matchMedia: () => ({ matches: false }), document: sandbox.document };
  sandbox.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts: opts || {} });
    return {
      ok: true, status: 200,
      text: async () => "{}",
      json: async () => ({}),
      blob: async () => new sandbox.Blob([], { type: "image/png" })
    };
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  sandbox.XLX = {};
  sandbox.XLX.util = {
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    uid: () => "uid" + Math.random().toString(36).slice(2, 8),
    toast: noop, download: noop, fmtTime: () => "", copyText: noop, logo: "",
    el: () => makeEl(),
    ZIP: { make: async () => new sandbox.Blob([], { type: "application/zip" }) }
  };
  sandbox.XLX.llm = {
    getSettings: () => ({ provider: "x", model: "m", apiKey: "k" }),
    chat: async () => "", ask: async () => "", isConfigured: () => false,
    currentProvider: () => ({ name: "x" }), currentModel: () => "m"
  };

  const root = path.resolve(__dirname, "..", "src", "drama");
  for (const f of DRAMA_FILES) {
    vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: "src/drama/" + f });
  }

  return { D: sandbox.XLX.drama, sandbox, calls };
}

/* 让 httpJson 的下一次/所有请求返回指定 JSON */
function mockJson(sandbox, json, ok) {
  sandbox.fetch = async (url, opts) => {
    sandbox.__calls = sandbox.__calls || [];
    sandbox.__calls.push({ url: String(url), opts: opts || {} });
    const body = typeof json === "function" ? json(String(url), opts) : json;
    return {
      ok: ok === undefined ? true : ok,
      status: ok === false ? 500 : 200,
      text: async () => JSON.stringify(body),
      json: async () => body,
      blob: async () => new sandbox.Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
    };
  };
}

function setAdapter(D, kind, cfg) {
  D.setAdapterConfig(kind, cfg);
}

/* 让 httpBlobUrl 的下一次/所有请求返回音频 Blob，或 ok=false 时返回错误 JSON */
function mockBlob(sandbox, mime, ok, errorBody) {
  sandbox.fetch = async (url, opts) => {
    sandbox.__calls = sandbox.__calls || [];
    sandbox.__calls.push({ url: String(url), opts: opts || {} });
    return {
      ok: ok === undefined ? true : ok,
      status: ok === false ? 502 : 200,
      text: async () => errorBody || JSON.stringify({ ok: false, error: "语音合成失败" }),
      json: async () => ({}),
      blob: async () => new sandbox.Blob([new Uint8Array([1, 2, 3])], { type: mime || "audio/mpeg" })
    };
  };
}

module.exports = { createDrama, mockJson, mockBlob, setAdapter, DRAMA_FILES };
