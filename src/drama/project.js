/* 铜龙电商 · AI 短剧工作台 · 工程数据模型与存储 */
/* 草稿存 localStorage；图片/音频/视频等大块走 IndexedDB，工程里只留 asset:<id> 引用。 */
(function () {
  const D = XLX.drama;
  const K = D.K;

  /* ============ IndexedDB 资源仓 ============ */
  const ASSET_DB = "xlx_drama_assets";
  const ASSET_STORE = "assets";
  let _dbp = null;

  function db() {
    if (_dbp) return _dbp;
    _dbp = new Promise((resolve, reject) => {
      if (!self.indexedDB) return resolve(null);
      const req = indexedDB.open(ASSET_DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(ASSET_STORE)) d.createObjectStore(ASSET_STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(D.err("IDB_OPEN", "本地资源仓打不开"));
    }).catch(() => null);
    return _dbp;
  }

  async function idbPut(id, blob, meta) {
    const d = await db();
    if (!d) return false;
    return new Promise((resolve) => {
      const tx = d.transaction(ASSET_STORE, "readwrite");
      tx.objectStore(ASSET_STORE).put({ id, blob, meta: meta || {}, at: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function idbGet(id) {
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
      const tx = d.transaction(ASSET_STORE, "readonly");
      const rq = tx.objectStore(ASSET_STORE).get(id);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => resolve(null);
    });
  }

  function isLocalRef(v) {
    return typeof v === "string" && (v.startsWith("blob:") || v.startsWith("data:"));
  }

  /* 把 blob:/data: 落进资源仓，返回 asset:<id>；其余原样返回 */
  async function toRef(v, meta) {
    if (!isLocalRef(v)) return v || "";
    try {
      const blob = await fetch(v).then(r => r.blob());
      const id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await idbPut(id, blob, Object.assign({ mime: blob.type, size: blob.size }, meta || {}));
      return "asset:" + id;
    } catch (e) {
      return v;
    }
  }

  async function hydrateRef(v) {
    if (typeof v !== "string" || !v.startsWith("asset:")) return v || "";
    const rec = await idbGet(v.slice(6));
    if (!rec || !rec.blob) return "";
    return URL.createObjectURL(rec.blob);
  }

  const ASSET_FIELDS = ["imageUrl", "videoUrl", "audioUrl", "lipsyncUrl"];

  async function persistAssets(p) {
    p.characters = p.characters || [];
    for (const c of p.characters) {
      c.refImages = await Promise.all((c.refImages || []).map(u => toRef(u, { role: "character" })));
    }
    p.shots = p.shots || [];
    for (const s of p.shots) {
      for (const f of ASSET_FIELDS) if (s[f]) s[f] = await toRef(s[f], { role: f });
      if (s.firstFrame) s.firstFrame = await toRef(s.firstFrame, { role: "firstFrame" });
    }
    if (p.bgm) p.bgm = await toRef(p.bgm, { role: "bgm" });
    return p;
  }

  async function hydrateAssets(p) {
    p.characters = p.characters || [];
    for (const c of p.characters) {
      c.refImages = (await Promise.all((c.refImages || []).map(u => hydrateRef(u)))).filter(Boolean);
    }
    p.shots = p.shots || [];
    for (const s of p.shots) {
      for (const f of ASSET_FIELDS) if (s[f]) s[f] = await hydrateRef(s[f]);
      if (s.firstFrame) s.firstFrame = await hydrateRef(s.firstFrame);
    }
    if (p.bgm) p.bgm = await hydrateRef(p.bgm);
    return p;
  }

  /* ============ 工程模型 ============ */
  function id(prefix) {
    return (prefix || "p") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function newShot(seq) {
    return {
      id: id("s"), seq: seq || 1, name: "分镜 " + (seq || 1),
      prompt: "", line: "", roleIds: [], duration: 5, motion: "zoom-in",
      imageUrl: "", videoUrl: "", audioUrl: "", lipsyncUrl: "",
      firstFrame: "", status: "pending", error: ""
    };
  }

  function newCharacter(name) {
    return { id: id("c"), name: name || "新角色", identity: "", appearance: "", refImages: [] };
  }

  function blank(opts) {
    opts = opts || {};
    const genre = opts.genre || "comic";
    const proj = {
      id: id(),
      title: opts.title || "未命名短剧",
      genre,
      engine: genre === "realistic" ? "video" : "image",
      script: { logline: "", outline: "", scenes: [] },
      characters: [],
      shots: [newShot(1)],
      style: genre === "realistic" ? "realistic" : "cn-manhua",
      subtitle: { enabled: true, font: "default", color: "#ffffff", stroke: "#000000" },
      bgm: "",
      output: { ratio: opts.ratio || "9:16", resolution: "1080p", fps: 30 },
      compliance: { aigcMarked: true, consentIds: [] },
      source: opts.source || "manual",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return proj;
  }

  function all() {
    let m = {};
    try { m = JSON.parse(localStorage.getItem(K.PROJECTS) || "{}"); } catch (e) { m = {}; }
    return m || {};
  }

  function writeAll(m) {
    localStorage.setItem(K.PROJECTS, JSON.stringify(m || {}));
  }

  function list() {
    const m = all();
    return Object.keys(m).map(k => m[k]).filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function get(pid) {
    return all()[pid] || null;
  }

  async function save(p) {
    if (!p || !p.id) throw D.err("NO_PROJECT", "工程不存在");
    p.updatedAt = Date.now();
    const copy = JSON.parse(JSON.stringify(p));
    await persistAssets(copy);
    const m = all();
    m[p.id] = copy;
    writeAll(m);
    return p;
  }

  function remove(pid) {
    const m = all();
    if (m[pid]) { delete m[pid]; writeAll(m); }
  }

  function addShot(p, at) {
    const s = newShot(p.shots.length + 1);
    if (at == null || at >= p.shots.length) p.shots.push(s);
    else p.shots.splice(at, 0, s);
    renumber(p);
    return s;
  }

  function removeShot(p, sid) {
    p.shots = p.shots.filter(s => s.id !== sid);
    renumber(p);
  }

  function moveShot(p, sid, dir) {
    const i = p.shots.findIndex(s => s.id === sid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.shots.length) return;
    const t = p.shots[i];
    p.shots[i] = p.shots[j];
    p.shots[j] = t;
    renumber(p);
  }

  function renumber(p) {
    p.shots.forEach((s, i) => { s.seq = i + 1; });
  }

  function addCharacter(p, name) {
    const c = newCharacter(name);
    p.characters.push(c);
    return c;
  }

  function removeCharacter(p, cid) {
    p.characters = p.characters.filter(c => c.id !== cid);
    p.shots.forEach(s => { s.roleIds = (s.roleIds || []).filter(x => x !== cid); });
  }

  function characterName(p, cid) {
    const c = (p.characters || []).find(x => x.id === cid);
    return c ? c.name : "";
  }

  /* 校验是否够合成：返回 { ok, missing:[{seq,reason}] } */
  function validate(p) {
    const missing = [];
    if (!p.shots || !p.shots.length) missing.push({ seq: 0, reason: "还没有分镜" });
    (p.shots || []).forEach(s => {
      if (p.engine === "video" || p.genre === "realistic") {
        if (!s.videoUrl) missing.push({ seq: s.seq, reason: "缺画面视频" });
      } else {
        if (!s.imageUrl) missing.push({ seq: s.seq, reason: "缺画面" });
      }
      if (s.line && !s.audioUrl) missing.push({ seq: s.seq, reason: "有台词但缺配音" });
      if (s.status === "failed") missing.push({ seq: s.seq, reason: "生成失败未重试" });
    });
    return { ok: missing.length === 0, missing };
  }

  function setStatus(s, status, error) {
    s.status = status;
    s.error = error || "";
    return s;
  }

  /* ============ 服务器同步（店门，需登录） ============ */
  const API = "/dian/api/drama/projects";
  const remote = {
    async list() {
      const r = await fetch(API, { credentials: "same-origin" });
      if (!r.ok) throw D.err("HTTP_" + r.status, "拉取云端工程失败");
      const j = await r.json();
      return (j && j.projects) || [];
    },
    async get(pid) {
      const r = await fetch(API + "/" + encodeURIComponent(pid), { credentials: "same-origin" });
      if (!r.ok) throw D.err("HTTP_" + r.status, "拉取云端工程失败");
      const j = await r.json();
      return (j && j.project) || null;
    },
    async save(p) {
      const copy = JSON.parse(JSON.stringify(p));
      await persistAssets(copy);
      const r = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: copy })
      });
      if (!r.ok) throw D.err("HTTP_" + r.status, "上传云端工程失败");
      const j = await r.json();
      if (!j || !j.ok) throw D.err("SYNC_FAIL", (j && j.error) || "上传失败");
      return j;
    },
    async remove(pid) {
      const r = await fetch(API + "/delete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pid })
      });
      if (!r.ok) throw D.err("HTTP_" + r.status, "删除云端工程失败");
      return r.json();
    }
  };

  D.project = {
    id, blank, newShot, newCharacter,
    all, list, get, save, remove,
    addShot, removeShot, moveShot, renumber,
    addCharacter, removeCharacter, characterName,
    validate, setStatus,
    persistAssets, hydrateAssets,
    assets: { put: idbPut, get: idbGet, toRef, hydrateRef },
    remote
  };
})();
