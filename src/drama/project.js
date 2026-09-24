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

  /* 云端模型（如火山数字人）只收公网 URL，把本地 blob/asset: 上传到网关换回公网地址。
     已经是 http(s) 的原样返回。 */
  async function toPublicUrl(v) {
    const url = String(v || "");
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    let blob = null;
    if (url.startsWith("asset:")) {
      const rec = await idbGet(url.slice(6));
      blob = rec && rec.blob;
    } else if (isLocalRef(url)) {
      blob = await fetch(url).then(r => r.blob()).catch(() => null);
    }
    if (!blob) throw D.err("NO_ASSET", "本地素材读不到，请重新生成");
    const r = await fetch("/dian/api/drama/asset", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok || !j.url) {
      throw D.err("UPLOAD_FAIL", (j && j.error) || "素材上传到公网失败，请稍后再试");
    }
    return j.url;
  }

  /* 统一把 asset:/blob:/data:/http(s) 读成 Blob，供合成与素材打包使用 */
  async function readBlob(v) {
    const s = String(v || "");
    if (!s) return null;
    if (s.startsWith("asset:")) {
      const rec = await idbGet(s.slice(6));
      return rec && rec.blob ? rec.blob : null;
    }
    try {
      const r = await fetch(s);
      if (!r.ok) return null;
      const b = await r.blob();
      return b && b.size ? b : null;
    } catch (e) {
      return null;
    }
  }

  /* 云端成片地址多为临时链接（火山口型 video_url 仅 1 小时有效），拿到就转存本地资源仓，
     返回 asset:<id> 供离线编辑/导出复用；转存失败时退回原地址，不阻断生成。 */
  async function cacheRemote(url, meta) {
    const s = String(url || "");
    if (!s || s.startsWith("asset:")) return s;
    if (!/^https?:\/\//i.test(s)) return toRef(s, meta);
    try {
      const res = await fetch(s);
      if (!res.ok) return s;
      const blob = await res.blob();
      if (!blob || !blob.size) return s;
      const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const ok = await idbPut(id, blob, Object.assign({ mime: blob.type, size: blob.size, src: "remote" }, meta || {}));
      return ok ? "asset:" + id : s;
    } catch (e) {
      return s;
    }
  }

  const ASSET_FIELDS = ["imageUrl", "videoUrl", "audioUrl", "lipsyncUrl"];

  /* 3D-BOX 的成图/成片同样落资源仓：网格/角度是列表，运镜/灯光/编辑是单值 */
  const BOX3D_LISTS = ["grid", "angle"];
  const BOX3D_ONE = ["move", "light", "edit"];

  async function persistBox3d(s) {
    const b = s && s.box3d;
    if (!b) return;
    for (const key of BOX3D_LISTS) {
      if (!Array.isArray(b[key])) continue;
      for (const c of b[key]) if (c && c.url) c.url = await toRef(c.url, { role: "box3d" });
    }
    for (const key of BOX3D_ONE) if (b[key] && b[key].url) b[key].url = await toRef(b[key].url, { role: "box3d" });
  }

  async function hydrateBox3d(s) {
    const b = s && s.box3d;
    if (!b) return;
    for (const key of BOX3D_LISTS) {
      if (!Array.isArray(b[key])) continue;
      for (const c of b[key]) if (c && c.url) c.url = await hydrateRef(c.url);
    }
    for (const key of BOX3D_ONE) if (b[key] && b[key].url) b[key].url = await hydrateRef(b[key].url);
  }

  async function persistAssets(p) {
    p.characters = p.characters || [];
    for (const c of p.characters) {
      c.refImages = await Promise.all((c.refImages || []).map(u => toRef(u, { role: "character" })));
      if (c.views) for (const v of ["front", "side", "back"]) if (c.views[v]) c.views[v] = await toRef(c.views[v], { role: "charView" });
    }
    p.scenes = p.scenes || [];
    for (const sc of p.scenes) if (sc.anchorRef) sc.anchorRef = await toRef(sc.anchorRef, { role: "scene" });
    p.shots = p.shots || [];
    for (const s of p.shots) {
      for (const f of ASSET_FIELDS) if (s[f]) s[f] = await toRef(s[f], { role: f });
      if (s.firstFrame) s.firstFrame = await toRef(s.firstFrame, { role: "firstFrame" });
      if (Array.isArray(s.extraRefs)) s.extraRefs = await Promise.all(s.extraRefs.map(u => toRef(u, { role: "ref" })));
      await persistBox3d(s);
    }
    p.takes = p.takes || [];
    for (const t of p.takes) if (t.videoUrl) t.videoUrl = await toRef(t.videoUrl, { role: "takeVideo" });
    if (p.bgm) p.bgm = await toRef(p.bgm, { role: "bgm" });
    return p;
  }

  async function hydrateAssets(p) {
    p.characters = p.characters || [];
    for (const c of p.characters) {
      c.refImages = (await Promise.all((c.refImages || []).map(u => hydrateRef(u)))).filter(Boolean);
      if (c.views) for (const v of ["front", "side", "back"]) if (c.views[v]) c.views[v] = await hydrateRef(c.views[v]);
    }
    p.scenes = p.scenes || [];
    for (const sc of p.scenes) if (sc.anchorRef) sc.anchorRef = await hydrateRef(sc.anchorRef);
    p.shots = p.shots || [];
    for (const s of p.shots) {
      for (const f of ASSET_FIELDS) if (s[f]) s[f] = await hydrateRef(s[f]);
      if (s.firstFrame) s.firstFrame = await hydrateRef(s.firstFrame);
      if (Array.isArray(s.extraRefs)) s.extraRefs = (await Promise.all(s.extraRefs.map(u => hydrateRef(u)))).filter(Boolean);
      await hydrateBox3d(s);
    }
    p.takes = p.takes || [];
    for (const t of p.takes) if (t.videoUrl) t.videoUrl = await hydrateRef(t.videoUrl);
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
      prompt: "", line: "", roleIds: [], sceneId: "", extraRefs: [], duration: 5, motion: "zoom-in",
      imageUrl: "", videoUrl: "", audioUrl: "", lipsyncUrl: "",
      firstFrame: "", status: "pending", error: "", audioDuration: 0,
      trimIn: 0, trimOut: 0,
      box3d: emptyBox3d()
    };
  }

  /* 3D-BOX 导演工具记录：机位/灯光/角度共用一个取景结果结构 */
  function emptyBox3d() {
    return {
      grid: [], angle: [],
      move: { id: "", name: "", url: "" },
      light: { id: "", name: "", url: "" },
      edit: { instruction: "", url: "" },
      blocking: [], camPath: [],
      cam: { pos: [], look: [], fov: 45 },
      updatedAt: 0
    };
  }

  /* ============ 段内裁剪 ============
   * trimIn / trimOut 是该镜画面内部的起止秒数（0 表示不裁剪）。
   * 画面时长由模型生成决定，裁剪只改"用哪一段"，不重跑模型。 */
  const TRIM_MIN = 0.5;

  function trimOf(s) {
    const d = Number(s && s.duration) > 0 ? Number(s.duration) : 0;
    let a = Number(s && s.trimIn);
    let b = Number(s && s.trimOut);
    if (!isFinite(a) || a < 0) a = 0;
    if (!isFinite(b) || b <= 0) b = 0;
    if (b <= 0) return { in: 0, out: 0, on: false };
    if (b > d) b = d;
    if (b - a < TRIM_MIN) a = Math.max(0, b - TRIM_MIN);
    const on = (b - a) >= TRIM_MIN && (b - a) < d - 1e-6;
    return on ? { in: a, out: b, on: true } : { in: 0, out: 0, on: false };
  }

  /* 该镜在时间轴/成片里的实际时长 */
  function effDuration(s) {
    const d = Number(s && s.duration) > 0 ? Number(s.duration) : 0;
    const t = trimOf(s);
    return t.on ? (t.out - t.in) : d;
  }

  function newCharacter(name) {
    return { id: id("c"), name: name || "新角色", identity: "", appearance: "", details: {}, refImages: [], views: {} };
  }

  function blank(opts) {
    opts = opts || {};
    const genre = opts.genre || "comic";
    const canvasId = id("cv");
    const proj = {
      id: id(),
      title: opts.title || "未命名短剧",
      genre,
      engine: genre === "realistic" ? "video" : "image",
      script: { logline: "", outline: "", scenes: [] },
      characters: [],
      scenes: [],
      shots: [newShot(1)],
      style: genre === "realistic" ? "realistic" : "cn-manhua",
      subtitle: { enabled: true, bilingual: false, font: "default", color: "#ffffff", stroke: "#000000" },
      bgm: "",
      output: { ratio: opts.ratio || "9:16", resolution: "1080p", fps: 30 },
      compliance: { aigcMarked: true, consentIds: [] },
      source: opts.source || "manual",
      mode: opts.mode || (opts.source === "auto" ? "pipeline" : "manual"),
      shotMode: opts.shotMode === "take" ? "take" : "shot",
      takeTarget: 15,
      takes: [],
      canvases: [{ id: canvasId, name: "画布 1", v: 1, nodes: [], edges: [], view: { x: 0, y: 0, k: 1 }, updatedAt: Date.now() }],
      activeCanvasId: canvasId,
      templateId: opts.templateId || "",
      thumb: "",
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
    migrate(p);
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

  /* 补齐旧工程缺失字段。幂等纯函数，保留未知字段。 */
  const URL_FIELDS = ["imageUrl", "videoUrl", "audioUrl", "lipsyncUrl", "firstFrame"];

  /* 旧故事板分镜 → 画布节点（D5）。仅当画布为空且分镜有待生成内容时执行一次，随后置位保证幂等。 */
  function shotsToCanvas(p) {
    if (p.canvasMigrated) return;
    if (!D.canvas || !D.canvas.addNode || !D.canvas.ensure) return;
    const c = D.canvas.ensure(p);
    if (!c || c.nodes.length) { p.canvasMigrated = true; return; }
    const shots = (p.shots || []).filter(s => s && (s.prompt || s.line || s.imageUrl || s.videoUrl || s.lipsyncUrl));
    if (!shots.length) { p.canvasMigrated = true; return; }
    const COL = 380, ROW = 300;
    shots.forEach((s, i) => {
      const x0 = (i % 3) * COL, y0 = Math.floor(i / 3) * ROW;
      const txt = (s.prompt || "") + (s.line ? (s.prompt ? "\n" : "") + s.line : "");
      const t = D.canvas.addNode(p, "text", x0, y0, { text: txt });
      const img = D.canvas.addNode(p, "image", x0 + 160, y0, { prompt: s.prompt || s.line || "" });
      D.canvas.addEdge(p, t.id, img.id);
      if (s.videoUrl || s.lipsyncUrl) {
        const v = D.canvas.addNode(p, "video", x0 + 320, y0, { prompt: s.prompt || "" });
        D.canvas.addEdge(p, img.id, v.id);
      }
    });
    p.canvasMigrated = true;
  }

  function migrate(p) {
    if (!p || typeof p !== "object") return p;
    p.title = p.title || "未命名短剧";
    p.genre = p.genre || "comic";
    p.engine = p.engine || (p.genre === "realistic" ? "video" : "image");
    p.mode = p.mode || (p.source === "auto" ? "pipeline" : "manual");
    if (typeof p.templateId !== "string") p.templateId = "";
    if (typeof p.thumb !== "string") p.thumb = "";
    if (p.shotMode !== "take") p.shotMode = "shot";
    const takeTarget = Number(p.takeTarget);
    p.takeTarget = (takeTarget >= 4 && takeTarget <= 30) ? takeTarget : 15;
    if (typeof p.bgm !== "string") p.bgm = p.bgm || "";
    if (typeof p.imageModel !== "string") p.imageModel = p.imageModel || "";
    if (typeof p.videoModel !== "string") p.videoModel = p.videoModel || "";

    if (!p.script || typeof p.script !== "object") p.script = { logline: "", outline: "", scenes: [] };
    if (typeof p.script.logline !== "string") p.script.logline = "";
    if (typeof p.script.outline !== "string") p.script.outline = "";
    if (!Array.isArray(p.script.scenes)) p.script.scenes = [];

    /* 场景卡：场景身份锚点，与剧本大纲的 script.scenes 互相独立 */
    if (!Array.isArray(p.scenes)) p.scenes = [];
    p.scenes.forEach((sc, i) => {
      if (!sc.id) sc.id = id("sc");
      if (typeof sc.name !== "string" || !sc.name) sc.name = "场景 " + (i + 1);
      if (typeof sc.desc !== "string") sc.desc = "";
      if (typeof sc.anchorRef !== "string") sc.anchorRef = "";
      if (typeof sc.updatedAt !== "number") sc.updatedAt = Date.now();
    });

    if (!p.output || typeof p.output !== "object") p.output = {};
    if (!p.output.ratio) p.output.ratio = "9:16";
    if (!p.output.resolution) p.output.resolution = "1080p";
    if (!p.output.fps) p.output.fps = 30;

    if (!p.subtitle || typeof p.subtitle !== "object") p.subtitle = { enabled: true, bilingual: false, font: "default", color: "#ffffff", stroke: "#000000" };
    if (typeof p.subtitle.enabled !== "boolean") p.subtitle.enabled = true;
    if (typeof p.subtitle.bilingual !== "boolean") p.subtitle.bilingual = false;

    if (!p.compliance || typeof p.compliance !== "object") p.compliance = { aigcMarked: true, consentIds: [] };
    if (typeof p.compliance.aigcMarked !== "boolean") p.compliance.aigcMarked = true;
    if (!Array.isArray(p.compliance.consentIds)) p.compliance.consentIds = [];

    if (!Array.isArray(p.characters)) p.characters = [];
    p.characters.forEach(c => {
      if (!c) return;
      if (!Array.isArray(c.refImages)) c.refImages = [];
      if (!c.views || typeof c.views !== "object") c.views = {};
      ["front", "side", "back"].forEach(v => { if (typeof c.views[v] !== "string") c.views[v] = ""; });
      if (typeof c.views.updatedAt !== "number") c.views.updatedAt = 0;
    });

    if (!Array.isArray(p.shots)) p.shots = [];
    p.shots.forEach((s, i) => {
      if (!s.id) s.id = id("s");
      if (typeof s.seq !== "number") s.seq = i + 1;
      if (!s.name) s.name = "分镜 " + (i + 1);
      if (typeof s.prompt !== "string") s.prompt = "";
      if (typeof s.line !== "string") s.line = "";
      if (typeof s.lineEn !== "string") s.lineEn = "";
      if (!Array.isArray(s.roleIds)) s.roleIds = [];
      if (typeof s.sceneId !== "string") s.sceneId = "";
      if (!Array.isArray(s.extraRefs)) s.extraRefs = [];
      else s.extraRefs = s.extraRefs.filter(Boolean).slice(0, 3);
      if (typeof s.duration !== "number" || !(s.duration > 0)) s.duration = 5;
      if (typeof s.motion !== "string") s.motion = "zoom-in";
      if (typeof s.trimIn !== "number" || !isFinite(s.trimIn) || s.trimIn < 0) s.trimIn = 0;
      if (typeof s.trimOut !== "number" || !isFinite(s.trimOut) || s.trimOut < 0) s.trimOut = 0;
      const t = trimOf(s);
      s.trimIn = t.on ? t.in : 0;
      s.trimOut = t.on ? t.out : 0;
      URL_FIELDS.forEach(f => { if (typeof s[f] !== "string") s[f] = ""; });
      if (typeof s.status !== "string") s.status = "pending";
      if (typeof s.error !== "string") s.error = "";
      if (typeof s.audioDuration !== "number") s.audioDuration = 0;
      if (!s.box3d || typeof s.box3d !== "object") s.box3d = emptyBox3d();
      if (D.box3d && D.box3d.ensure) D.box3d.ensure(s);
    });
    if (!p.shots.length) p.shots = [newShot(1)];
    renumber(p);

    if (!Array.isArray(p.takes)) p.takes = [];
    D.takes.sync(p);

    if (D.canvas && D.canvas.ensure) D.canvas.ensure(p);
    shotsToCanvas(p);

    if (typeof p.createdAt !== "number") p.createdAt = Date.now();
    if (typeof p.updatedAt !== "number") p.updatedAt = p.createdAt;
    return p;
  }

  function cover(p) {
    const shot = (p.shots || []).find(s => s.lipsyncUrl || s.videoUrl || s.imageUrl);
    if (!shot) return "";
    return shot.lipsyncUrl || shot.videoUrl || shot.imageUrl || "";
  }

  async function duplicate(pid) {
    const src = get(pid);
    if (!src) throw D.err("NO_PROJECT", "工程不存在");
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = id();
    copy.title = (src.title || "未命名短剧") + " · 副本";
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    await save(copy);
    return copy;
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
    validate, setStatus, migrate, cover, duplicate,
    trimOf, effDuration, TRIM_MIN,
    persistAssets, hydrateAssets, toPublicUrl, cacheRemote, readBlob,
    assets: { put: idbPut, get: idbGet, toRef, hydrateRef },
    remote
  };
})();
