/* 铜龙电商 · AI 短剧工作台 · 节点画布（导演台·无限画布） */
/* 对齐 LibTV：无限画布 + 五类节点（脚本/文本/图片/视频/音频）+ 连线，画布内生成与合成导出。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const NW = 248;
  const NH = 176;
  const MIN_K = 0.35;
  const MAX_K = 2.2;

  const NODE_TYPES = {
    script: { label: "脚本", accent: "#f5a524", out: "text", in: [], multi: false, hint: "粘贴剧本，解析分镜自动铺图" },
    text:   { label: "文本", accent: "#7c8598", out: "text", in: [], multi: false, hint: "写提示词或台词" },
    image:  { label: "图片", accent: "#5b8def", out: "image", in: ["text", "image"], multi: false, hint: "文生图 / 图生图" },
    video:  { label: "视频", accent: "#2fbf71", out: "video", in: ["image", "text", "audio"], multi: true, hint: "首帧 + 提示词生视频" },
    audio:  { label: "音频", accent: "#c06be0", out: "audio", in: ["text"], multi: false, hint: "文本转语音" }
  };
  const TYPE_ORDER = ["script", "text", "image", "video", "audio"];
  const OUT_NAME = { text: "文本", image: "图片", video: "视频", audio: "音频" };
  const RATIOS = ["9:16", "16:9", "1:1", "3:4", "4:3"];
  const STATUS_TEXT = { idle: "待生成", running: "生成中", done: "已完成", failed: "失败" };

  function id(prefix) { return (prefix || "n") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function typeOf(t) { return NODE_TYPES[t] || null; }
  function isType(t) { return !!NODE_TYPES[t]; }
  function num(v, dflt) { const x = Number(v); return isFinite(x) ? x : (dflt || 0); }

  function blank() {
    return { v: 1, nodes: [], edges: [], view: { x: 0, y: 0, k: 1 }, updatedAt: Date.now() };
  }

  function ensure(p) {
    if (!p) return null;
    if (!p.canvas || typeof p.canvas !== "object") p.canvas = blank();
    const c = p.canvas;
    if (!Array.isArray(c.nodes)) c.nodes = [];
    if (!Array.isArray(c.edges)) c.edges = [];
    if (!c.view || typeof c.view !== "object") c.view = { x: 0, y: 0, k: 1 };
    const k = num(c.view.k, 1);
    c.view.k = (k >= MIN_K && k <= MAX_K) ? k : 1;
    c.view.x = num(c.view.x, 0);
    c.view.y = num(c.view.y, 0);
    c.nodes = c.nodes.filter(n => n && isType(n.type));
    c.nodes.forEach(n => {
      if (!n.id) n.id = id(String(n.type)[0]);
      n.x = Math.round(num(n.x, 0));
      n.y = Math.round(num(n.y, 0));
      if (!n.data || typeof n.data !== "object") n.data = {};
      if (typeof n.data.text !== "string") n.data.text = n.data.text ? String(n.data.text) : "";
      if (typeof n.data.prompt !== "string") n.data.prompt = n.data.prompt ? String(n.data.prompt) : "";
      if (typeof n.out !== "string") n.out = "";
      if (typeof n.status !== "string" || !STATUS_TEXT[n.status]) n.status = "idle";
      if (typeof n.error !== "string") n.error = "";
    });
    const ids = {};
    c.nodes.forEach(n => { ids[n.id] = true; });
    c.edges = c.edges.filter(e => e && e.from && e.to && e.from !== e.to && ids[e.from] && ids[e.to]);
    c.edges.forEach(e => { if (!e.id) e.id = id("e"); });
    c.updatedAt = Date.now();
    return c;
  }

  function nodeById(p, nid) { const c = ensure(p); return (c && c.nodes.find(n => n.id === nid)) || null; }
  function outType(n) { const t = n && typeOf(n.type); return t ? t.out : ""; }

  function addNode(p, type, x, y, data) {
    if (!isType(type)) throw D.err("BAD_NODE", "未知节点类型：" + type);
    const c = ensure(p);
    const n = {
      id: id(String(type)[0]), type,
      x: Math.round(num(x, 0)), y: Math.round(num(y, 0)),
      data: Object.assign({}, data || {}),
      out: "", status: "idle", error: ""
    };
    if ((type === "image" || type === "video") && !n.data.ratio) n.data.ratio = (p.output && p.output.ratio) || "9:16";
    if (type === "video" && !n.data.duration) n.data.duration = 5;
    c.nodes.push(n);
    c.updatedAt = Date.now();
    return n;
  }

  function removeNode(p, nid) {
    const c = ensure(p);
    c.nodes = c.nodes.filter(n => n.id !== nid);
    c.edges = c.edges.filter(e => e.from !== nid && e.to !== nid);
    c.updatedAt = Date.now();
  }

  function moveNode(p, nid, x, y) {
    const n = nodeById(p, nid);
    if (!n) return null;
    n.x = Math.round(num(x, n.x));
    n.y = Math.round(num(y, n.y));
    ensure(p).updatedAt = Date.now();
    return n;
  }

  function setData(p, nid, field, value) {
    const n = nodeById(p, nid);
    if (!n) return null;
    n.data[field] = value;
    ensure(p).updatedAt = Date.now();
    return n;
  }

  function accepts(fromNode, toNode) {
    if (!fromNode || !toNode || fromNode.id === toNode.id) return false;
    const t = typeOf(toNode.type);
    if (!t) return false;
    return t.in.indexOf(outType(fromNode)) >= 0;
  }

  function hasCycle(p, extraFrom, extraTo) {
    const c = ensure(p);
    const adj = {};
    c.nodes.forEach(n => { adj[n.id] = []; });
    c.edges.forEach(e => { if (adj[e.from]) adj[e.from].push(e.to); });
    if (extraFrom && extraTo && adj[extraFrom]) adj[extraFrom] = adj[extraFrom].concat([extraTo]);
    const color = {};
    let bad = false;
    function dfs(u) {
      color[u] = 1;
      const list = adj[u] || [];
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (color[v] === 1) { bad = true; return; }
        if (!color[v]) dfs(v);
        if (bad) return;
      }
      color[u] = 2;
    }
    const keys = Object.keys(adj);
    for (let i = 0; i < keys.length && !bad; i++) if (!color[keys[i]]) dfs(keys[i]);
    return bad;
  }

  function addEdge(p, from, to) {
    const c = ensure(p);
    const a = nodeById(p, from), b = nodeById(p, to);
    if (!a || !b) throw D.err("NO_NODE", "找不到节点");
    if (a.id === b.id) throw D.err("SELF_EDGE", "不能连到自己");
    if (!accepts(a, b)) throw D.err("BAD_EDGE", typeOf(b.type).label + " 节点不接受" + (OUT_NAME[outType(a)] || "该") + "输入");
    if (c.edges.some(e => e.from === from && e.to === to)) throw D.err("DUP_EDGE", "这两个节点已经连好了");
    if (hasCycle(p, from, to)) throw D.err("CYCLE", "这条连线会形成环路");
    const t = typeOf(b.type);
    if (!t.multi) {
      c.edges = c.edges.filter(e => e.to !== to);
    } else {
      const ot = outType(a);
      c.edges = c.edges.filter(e => {
        if (e.to !== to) return true;
        const src = c.nodes.find(n => n.id === e.from);
        return src && outType(src) !== ot;
      });
    }
    const e = { id: id("e"), from, to };
    c.edges.push(e);
    c.updatedAt = Date.now();
    return e;
  }

  function disconnect(p, eid) {
    const c = ensure(p);
    c.edges = c.edges.filter(e => e.id !== eid);
    c.updatedAt = Date.now();
  }

  function upstream(p, nid) {
    const c = ensure(p);
    return c.edges.filter(e => e.to === nid).map(e => c.nodes.find(n => n.id === e.from)).filter(Boolean);
  }

  function downstream(p, nid) {
    const c = ensure(p);
    return c.edges.filter(e => e.from === nid).map(e => c.nodes.find(n => n.id === e.to)).filter(Boolean);
  }

  function incoming(p, nid, outT) {
    return upstream(p, nid).filter(n => outType(n) === outT);
  }

  function topoOrder(p) {
    const c = ensure(p);
    const indeg = {};
    c.nodes.forEach(n => { indeg[n.id] = 0; });
    c.edges.forEach(e => { if (indeg[e.to] != null) indeg[e.to]++; });
    const queue = c.nodes.filter(n => !indeg[n.id]).map(n => n.id);
    const order = [];
    while (queue.length) {
      const u = queue.shift();
      order.push(u);
      c.edges.filter(e => e.from === u).forEach(e => {
        if (indeg[e.to] != null) {
          indeg[e.to]--;
          if (!indeg[e.to]) queue.push(e.to);
        }
      });
    }
    return order;
  }

  function textOf(n) {
    if (!n) return "";
    if (n.type === "script" || n.type === "text") return (n.data && n.data.text) || "";
    return "";
  }

  function buildPrompt(p, nid) {
    const n = nodeById(p, nid);
    if (!n) return "";
    const parts = [];
    incoming(p, nid, "text").forEach(src => { const t = textOf(src); if (t) parts.push(t); });
    if (n.data && n.data.prompt) parts.push(n.data.prompt);
    return parts.join("\n").trim();
  }

  function firstFrameFrom(p, nid) {
    const n = nodeById(p, nid);
    if (!n) return "";
    if (n.data && n.data.firstFrame) return n.data.firstFrame;
    const src = incoming(p, nid, "image").filter(x => x.out)[0];
    return src ? src.out : "";
  }

  function refImagesFrom(p, nid, cap) {
    const lim = cap || 3;
    const out = [];
    incoming(p, nid, "image").forEach(src => { if (src.out && out.length < lim) out.push(src.out); });
    return out;
  }

  function splitScript(text) {
    const raw = String(text || "").replace(/\r/g, "").trim();
    if (!raw) return [];
    let chunks = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (chunks.length <= 1) chunks = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
    return chunks.slice(0, 30);
  }

  function explodeScript(p, nid) {
    const n = nodeById(p, nid);
    if (!n || (n.type !== "script" && n.type !== "text")) throw D.err("BAD_NODE", "只有脚本/文本节点能解析分镜");
    const parts = splitScript(n.data.text);
    if (!parts.length) throw D.err("NO_TEXT", "节点里还没有内容");
    const made = [];
    let y = n.y;
    parts.forEach(t => {
      const node = addNode(p, "image", n.x + NW + 60, y, { prompt: t, ratio: (p.output && p.output.ratio) || "9:16" });
      y += NH + 28;
      addEdge(p, n.id, node.id);
      made.push(node);
    });
    return made;
  }

  function autoLayout(p, originX, originY) {
    const c = ensure(p);
    const order = topoOrder(p);
    const depth = {};
    order.forEach(nid => {
      const ups = upstream(p, nid);
      depth[nid] = ups.length ? Math.max.apply(null, ups.map(u => num(depth[u.id], 0))) + 1 : 0;
    });
    const cols = {};
    const ox = isFinite(originX) ? originX : 60;
    const oy = isFinite(originY) ? originY : 48;
    order.forEach(nid => {
      const n = nodeById(p, nid);
      if (!n) return;
      const d = num(depth[nid], 0);
      const row = cols[d] || 0;
      cols[d] = row + 1;
      n.x = Math.round(ox + d * (NW + 96));
      n.y = Math.round(oy + row * (NH + 28));
    });
    c.updatedAt = Date.now();
    return c;
  }

  function serialize(p) {
    const c = ensure(p);
    return {
      v: 1,
      app: "xiaolongxia-drama-canvas",
      nodes: c.nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, data: JSON.parse(JSON.stringify(n.data || {})) })),
      edges: c.edges.map(e => ({ from: e.from, to: e.to }))
    };
  }

  function parse(p, json) {
    let obj = json;
    if (typeof json === "string") {
      try { obj = JSON.parse(json); } catch (e) { throw D.err("BAD_JSON", "工作流 JSON 解析失败"); }
    }
    if (!obj || !Array.isArray(obj.nodes)) throw D.err("BAD_JSON", "工作流缺少 nodes");
    const c = blank();
    const map = {};
    obj.nodes.forEach(raw => {
      if (!raw || !isType(raw.type)) return;
      const n = {
        id: id(String(raw.type)[0]), type: raw.type,
        x: Math.round(num(raw.x, 0)), y: Math.round(num(raw.y, 0)),
        data: Object.assign({}, raw.data || {}), out: "", status: "idle", error: ""
      };
      map[raw.id] = n.id;
      c.nodes.push(n);
    });
    (obj.edges || []).forEach(e => {
      if (!e) return;
      const from = map[e.from], to = map[e.to];
      if (from && to && from !== to && c.nodes.some(n => n.id === from) && c.nodes.some(n => n.id === to)) {
        c.edges.push({ id: id("e"), from, to });
      }
    });
    p.canvas = c;
    ensure(p);
    return c;
  }

  async function cacheUrl(url, role) {
    if (D.project && D.project.cacheRemote) {
      try { return await D.project.cacheRemote(url, { role }); } catch (e) {}
    }
    return url;
  }

  async function runNode(p, nid, opts) {
    opts = opts || {};
    const n = nodeById(p, nid);
    if (!n) throw D.err("NO_NODE", "找不到节点");
    if (n.type === "text" || n.type === "script") return n;
    if (n.status === "running") return n;
    const onStep = opts.onStep || function () {};
    n.status = "running";
    n.error = "";
    try {
      if (n.type === "image") {
        if (!D.isConfigured("image")) throw D.err("NO_KEY", "尚未配置生图服务，请到「设置 → 短剧服务」填写");
        const prompt = buildPrompt(p, nid);
        if (!prompt) throw D.err("NO_PROMPT", "图片节点还没有提示词");
        onStep("生图");
        const r = await D.adapters.image.generate({
          prompt,
          ratio: n.data.ratio || (p.output && p.output.ratio) || "9:16",
          refImages: refImagesFrom(p, nid, 1),
          model: p.imageModel
        });
        n.out = await cacheUrl(r.url, "imageUrl");
      } else if (n.type === "video") {
        if (!D.isConfigured("video")) throw D.err("NO_KEY", "尚未配置视频服务，请到「设置 → 短剧服务」填写");
        const prompt = buildPrompt(p, nid);
        const firstFrame = firstFrameFrom(p, nid);
        if (!prompt && !firstFrame) throw D.err("NO_PROMPT", "视频节点需要提示词或上游首帧");
        onStep("生视频");
        const r = await D.adapters.video.generate({
          prompt,
          firstFrame,
          refImages: refImagesFrom(p, nid, 3),
          ratio: n.data.ratio || (p.output && p.output.ratio) || "9:16",
          duration: num(n.data.duration, 5) || 5,
          resolution: (p.output && p.output.resolution) === "1080p" ? "1080p" : "720p",
          model: p.videoModel
        }, opts.onProgress, opts.signal);
        n.out = await cacheUrl(r.url, "videoUrl");
      } else if (n.type === "audio") {
        if (!D.isConfigured("tts")) throw D.err("NO_KEY", "尚未配置语音服务，请到「设置 → 短剧服务」填写");
        const text = buildPrompt(p, nid) || n.data.text || "";
        if (!text) throw D.err("NO_TEXT", "音频节点还没有文本");
        onStep("配音");
        const r = await D.adapters.tts.synth({ text, voice: n.data.voice || "", speed: num(n.data.speed, 1) || 1 });
        n.out = await cacheUrl(r.url, "audioUrl");
        n.data.duration = (r && r.duration) || 0;
      }
      n.status = "done";
      return n;
    } catch (e) {
      n.status = "failed";
      n.error = (e && e.message) || "生成失败";
      throw e;
    }
  }

  /* ============ 渲染 ============ */
  const CSS = `
.cv-wrap{border:1px solid var(--border);border-radius:14px;background:var(--bg);overflow:hidden;display:flex;flex-direction:column;height:680px}
.cv-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px;border-bottom:1px solid var(--border);background:var(--panel)}
.cv-bar .cv-sp{flex:1}
.cv-addbtn{font-size:12px;padding:6px 12px;border-radius:9px;background:var(--card);border:1px solid var(--border);color:var(--text);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.cv-addbtn:hover{border-color:var(--accent)}
.cv-addbtn i{width:8px;height:8px;border-radius:50%;display:inline-block}
.cv-viewport{position:relative;flex:1;overflow:hidden;cursor:grab;background:#0a0c11}
.cv-viewport.cv-pan{cursor:grabbing}
.cv-viewport:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;opacity:.7}
.cv-world{position:absolute;left:0;top:0;transform-origin:0 0}
.cv-edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.cv-edges path{fill:none;stroke:var(--border2);stroke-width:2}
.cv-edges path.hot{stroke:var(--accent)}
.cv-edges circle{fill:var(--accent)}
.cv-node{position:absolute;width:248px;background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);user-select:none}
.cv-node.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 10px 28px rgba(0,0,0,.4)}
.cv-node-head{display:flex;align-items:center;gap:6px;padding:7px 8px;border-bottom:1px solid var(--border);cursor:move;border-radius:12px 12px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.03),transparent)}
.cv-node-head b{font-size:12px;color:var(--text)}
.cv-dot{width:8px;height:8px;border-radius:50%;flex:none}
.cv-st{font-size:10px;padding:2px 7px;border-radius:99px;border:1px solid var(--border);color:var(--text3);margin-left:auto}
.cv-st.st-running{color:#e8b64a;border-color:#6a5320}
.cv-st.st-done{color:#4fd08a;border-color:#2b5a3a}
.cv-st.st-failed{color:#ff6b6b;border-color:#6a2b2b}
.cv-x{background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;line-height:1;padding:2px 4px}
.cv-x:hover{color:var(--red)}
.cv-node-body{padding:8px;display:flex;flex-direction:column;gap:6px}
.cv-ta{min-height:52px;resize:vertical;font-size:11px;line-height:1.5}
.cv-sel{font-size:11px;padding:4px 6px}
.cv-num{width:64px;font-size:11px;padding:4px 6px}
.cv-row{display:flex;align-items:center;gap:6px}
.cv-out{margin-top:2px;border:1px solid var(--border);border-radius:9px;background:#0d1017;aspect-ratio:16/10;display:flex;align-items:center;justify-content:center;overflow:hidden}
.cv-out img,.cv-out video{width:100%;height:100%;object-fit:cover}
.cv-out audio{width:100%}
.cv-ph{color:var(--text3);font-size:10px;text-align:center;padding:6px}
.cv-err{color:#ff8080;font-size:10px;line-height:1.5}
.cv-port{position:absolute;width:13px;height:13px;border-radius:50%;background:var(--card);border:2px solid var(--border2);top:34px;cursor:crosshair;z-index:2}
.cv-port:hover{border-color:var(--accent);background:var(--accent)}
.cv-port.cv-in{left:-7px}
.cv-port.cv-out{right:-7px;background:var(--accent);border-color:var(--accent)}
.cv-port.link{box-shadow:0 0 0 4px rgba(91,141,239,.3)}
.cv-linkline{position:absolute;pointer-events:none}
.cv-foot{display:flex;align-items:center;gap:12px;padding:8px 12px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);background:var(--panel)}
.cv-menu{position:absolute;z-index:20;background:var(--panel);border:1px solid var(--border2);border-radius:10px;padding:6px;min-width:150px;box-shadow:0 12px 30px rgba(0,0,0,.5)}
.cv-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:var(--text);font-size:12px;padding:7px 9px;border-radius:7px;cursor:pointer}
.cv-menu button:hover{background:var(--card)}
.cv-menu .cv-menu-t{padding:5px 9px;font-size:10px;color:var(--text3)}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaCanvasCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  let mountSeq = 0;
  const linkState = { from: "", hover: null };

  function esc(s) { return D.ui.esc(s == null ? "" : String(s)); }

  function ratioOpts(cur) {
    return RATIOS.map(r => '<option value="' + r + '"' + (r === cur ? " selected" : "") + ">" + r + "</option>").join("");
  }

  function bodyHTML(n) {
    const t = typeOf(n.type);
    let h = "";
    if (n.type === "text" || n.type === "script") {
      h += '<textarea class="inp cv-ta" data-f="text" data-nid="' + n.id + '" placeholder="' + esc(t.hint) + '">' + esc(n.data.text) + "</textarea>";
      if (n.type === "script") h += '<div class="cv-row"><button class="btn small" data-act="explode" data-nid="' + n.id + '">解析分镜</button><span class="cv-ph">一段一条，自动铺图</span></div>';
      return h;
    }
    if (n.type === "image") {
      h += '<textarea class="inp cv-ta" data-f="prompt" data-nid="' + n.id + '" placeholder="画面提示词">' + esc(n.data.prompt) + "</textarea>";
      h += '<div class="cv-row"><select class="inp cv-sel" data-f="ratio" data-nid="' + n.id + '">' + ratioOpts(n.data.ratio) + "</select>";
      h += '<button class="btn small primary" data-act="run" data-nid="' + n.id + '"' + (n.status === "running" ? " disabled" : "") + ">" + (n.status === "running" ? "生成中" : "生成") + "</button></div>";
      h += preview(n);
      return h;
    }
    if (n.type === "video") {
      h += '<textarea class="inp cv-ta" data-f="prompt" data-nid="' + n.id + '" placeholder="运镜与动作提示词">' + esc(n.data.prompt) + "</textarea>";
      h += '<div class="cv-row"><select class="inp cv-sel" data-f="ratio" data-nid="' + n.id + '">' + ratioOpts(n.data.ratio) + "</select>";
      h += '<input class="inp cv-num" type="number" min="1" max="30" data-f="duration" data-nid="' + n.id + '" value="' + esc(n.data.duration || 5) + '"><span class="cv-ph">秒</span>';
      h += '<button class="btn small primary" data-act="run" data-nid="' + n.id + '"' + (n.status === "running" ? " disabled" : "") + ">" + (n.status === "running" ? "生成中" : "生成") + "</button></div>";
      h += preview(n);
      return h;
    }
    if (n.type === "audio") {
      h += '<textarea class="inp cv-ta" data-f="text" data-nid="' + n.id + '" placeholder="台词（有上游文本时以上游为准）">' + esc(n.data.text) + "</textarea>";
      h += '<div class="cv-row"><input class="inp cv-num" style="width:auto;flex:1" data-f="voice" data-nid="' + n.id + '" placeholder="音色" value="' + esc(n.data.voice || "") + '">';
      h += '<button class="btn small primary" data-act="run" data-nid="' + n.id + '"' + (n.status === "running" ? " disabled" : "") + ">" + (n.status === "running" ? "生成中" : "生成") + "</button></div>";
      h += preview(n);
      return h;
    }
    return h;
  }

  function preview(n) {
    let h = '<div class="cv-out">';
    if (!n.out) h += '<span class="cv-ph">' + (n.status === "running" ? "生成中…" : "尚未生成") + "</span>";
    else if (n.type === "image") h += '<img src="' + esc(n.out) + '" alt="">';
    else if (n.type === "video") h += '<video src="' + esc(n.out) + '" controls></video>';
    else if (n.type === "audio") h += '<audio src="' + esc(n.out) + '" controls></audio>';
    h += "</div>";
    if (n.error) h += '<div class="cv-err">' + esc(n.error) + "</div>";
    return h;
  }

  function nodeHTML(n, sel) {
    const t = typeOf(n.type);
    return '<div class="cv-node' + (sel === n.id ? " sel" : "") + '" data-nid="' + n.id + '" style="left:' + n.x + "px;top:" + n.y + 'px">' +
      '<div class="cv-node-head">' +
        '<span class="cv-dot" style="background:' + t.accent + '"></span>' +
        "<b>" + t.label + "</b>" +
        '<span class="cv-st st-' + n.status + '">' + (STATUS_TEXT[n.status] || n.status) + "</span>" +
        '<button class="cv-x" data-act="del" data-nid="' + n.id + '" title="删除">×</button>' +
      "</div>" +
      '<div class="cv-node-body">' + bodyHTML(n) + "</div>" +
      (t.in.length ? '<span class="cv-port cv-in" data-port="in" data-nid="' + n.id + '" title="输入：' + t.in.map(x => OUT_NAME[x]).join("/") + '"></span>' : "") +
      '<span class="cv-port cv-out" data-port="out" data-nid="' + n.id + '" title="输出：' + OUT_NAME[t.out] + '"></span>' +
    "</div>";
  }

  function portPos(n, side) {
    const x = side === "out" ? n.x + NW : n.x;
    const y = n.y + 34 + 6.5;
    return { x, y };
  }

  function edgePath(a, b) {
    const dx = Math.max(44, Math.abs(b.x - a.x) / 2);
    return "M" + a.x + " " + a.y + " C" + (a.x + dx) + " " + a.y + " " + (b.x - dx) + " " + b.y + " " + b.x + " " + b.y;
  }

  function renderShell(ctx) {
    const n = ++mountSeq;
    ctx.uid = n;
    const bar = '<div class="cv-bar">' +
      TYPE_ORDER.map(t => '<button class="cv-addbtn" data-cvadd="' + t + '"><i style="background:' + NODE_TYPES[t].accent + '"></i>' + NODE_TYPES[t].label + "</button>").join("") +
      '<span class="cv-sp"></span>' +
      '<button class="btn small ghost" data-cvact="layout">自动排版</button>' +
      '<button class="btn small ghost" data-cvact="fit">适应画布</button>' +
      '<button class="btn small ghost" data-cvact="import">导入工作流</button>' +
      '<button class="btn small ghost" data-cvact="export">导出工作流</button>' +
      '<button class="btn small primary" data-cvact="compose">合成导出</button>' +
    "</div>";
    ctx.el.innerHTML = '<div class="cv-wrap">' + bar +
      '<div class="cv-viewport" id="cvVp' + n + '">' +
        '<div class="cv-world" id="cvWorld' + n + '">' +
          '<svg class="cv-edges" id="cvEdges' + n + '"></svg>' +
          '<div id="cvNodes' + n + '"></div>' +
        "</div>" +
      "</div>" +
      '<div class="cv-foot" id="cvFoot' + n + '"></div>' +
    "</div>";
    ctx.vp = ctx.el.querySelector("#cvVp" + n);
    ctx.world = ctx.el.querySelector("#cvWorld" + n);
    ctx.edges = ctx.el.querySelector("#cvEdges" + n);
    ctx.nodesEl = ctx.el.querySelector("#cvNodes" + n);
    ctx.nodesEl.style.position = "absolute";
    ctx.nodesEl.style.left = "0";
    ctx.nodesEl.style.top = "0";
    ctx.foot = ctx.el.querySelector("#cvFoot" + n);
    bindShell(ctx);
  }

  function applyView(ctx) {
    const v = ensure(ctx.p).view;
    ctx.world.style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.k + ")";
  }

  function paintEdges(ctx) {
    const c = ensure(ctx.p);
    const parts = [];
    c.edges.forEach(e => {
      const a = c.nodes.find(n => n.id === e.from);
      const b = c.nodes.find(n => n.id === e.to);
      if (!a || !b) return;
      const pa = portPos(a, "out"), pb = portPos(b, "in");
      const hot = linkState.from && (linkState.from === e.from || linkState.from === e.to);
      parts.push('<path class="' + (hot ? "hot" : "") + '" d="' + edgePath(pa, pb) + '"></path>');
      parts.push('<circle cx="' + pa.x + '" cy="' + pa.y + '" r="3"></circle>');
    });
    if (linkState.from && linkState.hover) {
      const a = c.nodes.find(n => n.id === linkState.from);
      if (a) {
        const pa = portPos(a, "out");
        parts.push('<path class="hot" d="' + edgePath(pa, linkState.hover) + '"></path>');
      }
    }
    ctx.edges.innerHTML = parts.join("");
  }

  function paint(ctx) {
    const c = ensure(ctx.p);
    applyView(ctx);
    ctx.nodesEl.innerHTML = c.nodes.map(n => nodeHTML(n, ctx.sel)).join("");
    paintEdges(ctx);
    const done = c.nodes.filter(n => n.status === "done").length;
    ctx.foot.innerHTML = "<span>节点 " + c.nodes.length + " 个 · 连线 " + c.edges.length + " 条 · 已生成 " + done + "</span>" +
      "<span style=\"flex:1\"></span><span>双击空白加节点 · 右键节点加下游 · Ctrl/滚轮缩放 · 拖节点标题移动</span>";
    bindNodes(ctx);
  }

  function worldPoint(ctx, clientX, clientY) {
    const r = ctx.vp.getBoundingClientRect();
    const v = ensure(ctx.p).view;
    return { x: (clientX - r.left - v.x) / v.k, y: (clientY - r.top - v.y) / v.k };
  }

  function notify(ctx) { if (ctx.opts.onChange) ctx.opts.onChange(); }
  function refresh(ctx, structural) {
    if (structural) { paint(ctx); notify(ctx); return; }
    applyView(ctx);
    paintEdges(ctx);
    notify(ctx);
  }

  function toast(msg, type) { if (U && U.toast) U.toast(msg, type); }

  function bindShell(ctx) {
    ctx.el.querySelectorAll("[data-cvadd]").forEach(b => b.onclick = () => {
      const r = ctx.vp.getBoundingClientRect();
      const c = ensure(ctx.p).view;
      const x = Math.round((-c.x + r.width / 2) / c.k - NW / 2);
      const y = Math.round((-c.y + r.height / 2) / c.k - NH / 2 + (ctx.p.canvas.nodes.length % 3) * 24);
      const n = addNode(ctx.p, b.dataset.cvadd, x, y, {});
      ctx.sel = n.id;
      refresh(ctx, true);
    });
    ctx.el.querySelectorAll("[data-cvact]").forEach(b => b.onclick = () => act(ctx, b.dataset.cvact));

    const vp = ctx.vp;
    vp.addEventListener("wheel", e => {
      e.preventDefault();
      const v = ensure(ctx.p).view;
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k + delta));
      if (k === v.k) return;
      const r = vp.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      v.x = mx - ((mx - v.x) / v.k) * k;
      v.y = my - ((my - v.y) / v.k) * k;
      v.k = k;
      refresh(ctx, false);
    }, { passive: false });

    vp.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      if (e.target.closest(".cv-node")) return;
      if (e.target.closest(".cv-menu")) return;
      const v = ensure(ctx.p).view;
      ctx.pan = { sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      vp.classList.add("cv-pan");
      ctx.sel = "";
      closeMenu(ctx);
    });
    window.addEventListener("mousemove", onMove(ctx));
    window.addEventListener("mouseup", onUp(ctx));

    vp.addEventListener("dblclick", e => {
      if (e.target.closest(".cv-node")) return;
      const pt = worldPoint(ctx, e.clientX, e.clientY);
      openAddMenu(ctx, e.clientX, e.clientY, pt);
    });
    vp.addEventListener("contextmenu", e => {
      const nodeEl = e.target.closest(".cv-node");
      if (!nodeEl) return;
      e.preventDefault();
      openNodeMenu(ctx, e.clientX, e.clientY, nodeEl.dataset.nid);
    });
  }

  function onMove(ctx) {
    return e => {
      if (ctx.pan) {
        const v = ensure(ctx.p).view;
        v.x = ctx.pan.vx + (e.clientX - ctx.pan.sx);
        v.y = ctx.pan.vy + (e.clientY - ctx.pan.sy);
        applyView(ctx);
        return;
      }
      if (ctx.drag) {
        const pt = worldPoint(ctx, e.clientX, e.clientY);
        const n = nodeById(ctx.p, ctx.drag.id);
        if (n) { n.x = Math.round(pt.x - ctx.drag.dx); n.y = Math.round(pt.y - ctx.drag.dy); ntmp(ctx, n); }
        return;
      }
      if (linkState.from) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const over = el && el.closest ? el.closest(".cv-port.cv-in") : null;
        linkState.hover = over ? worldPoint(ctx, e.clientX, e.clientY) : null;
        paintEdges(ctx);
      }
    };
  }

  function ntmp(ctx, n) {
    const el = ctx.nodesEl.querySelector('.cv-node[data-nid="' + n.id + '"]');
    if (el) { el.style.left = n.x + "px"; el.style.top = n.y + "px"; }
    paintEdges(ctx);
  }

  function onUp(ctx) {
    return () => {
      if (ctx.pan) { ctx.pan = null; ctx.vp.classList.remove("cv-pan"); notify(ctx); }
      if (ctx.drag) { ctx.drag = null; notify(ctx); }
    };
  }

  function bindNodes(ctx) {
    ctx.nodesEl.querySelectorAll(".cv-node").forEach(el => {
      const nid = el.dataset.nid;
      const head = el.querySelector(".cv-node-head");
      head.addEventListener("mousedown", e => {
        if (e.target.closest(".cv-x")) return;
        e.stopPropagation();
        const pt = worldPoint(ctx, e.clientX, e.clientY);
        const n = nodeById(ctx.p, nid);
        ctx.drag = { id: nid, dx: pt.x - n.x, dy: pt.y - n.y };
        ctx.sel = nid;
        closeMenu(ctx);
        ctx.nodesEl.querySelectorAll(".cv-node.sel").forEach(x => x.classList.remove("sel"));
        el.classList.add("sel");
      });
      el.addEventListener("click", () => { ctx.sel = nid; });
    });

    ctx.nodesEl.querySelectorAll("[data-act]").forEach(b => {
      const act = b.dataset.act, nid = b.dataset.nid;
      if (act === "del") b.onclick = e => { e.stopPropagation(); removeNode(ctx.p, nid); refresh(ctx, true); };
      else if (act === "explode") b.onclick = e => { e.stopPropagation(); doExplode(ctx, nid); };
      else if (act === "run") b.onclick = e => { e.stopPropagation(); doRun(ctx, nid); };
    });

    ctx.nodesEl.querySelectorAll("[data-f]").forEach(el => {
      el.oninput = () => {
        let v = el.value;
        if (el.dataset.f === "duration") v = num(el.value, 5);
        setData(ctx.p, el.dataset.nid, el.dataset.f, v);
        notify(ctx);
      };
    });

    ctx.nodesEl.querySelectorAll(".cv-port.cv-out").forEach(el => {
      el.onmousedown = e => {
        e.stopPropagation(); e.preventDefault();
        linkState.from = el.dataset.nid;
        linkState.hover = null;
        paintEdges(ctx);
      };
    });
    ctx.nodesEl.querySelectorAll(".cv-port.cv-in").forEach(el => {
      el.onmouseup = e => {
        e.stopPropagation(); e.preventDefault();
        if (!linkState.from) return;
        try {
          addEdge(ctx.p, linkState.from, el.dataset.nid);
        } catch (err) { toast((err && err.message) || "连线失败", "err"); }
        linkState.from = ""; linkState.hover = null;
        refresh(ctx, true);
      };
    });
  }

  async function doRun(ctx, nid) {
    const n = nodeById(ctx.p, nid);
    if (!n) return;
    n.status = "running"; n.error = "";
    refresh(ctx, true);
    try {
      await runNode(ctx.p, nid, {
        onStep: () => {},
        onProgress: p => { n.error = ""; }
      });
      toast("「" + typeOf(n.type).label + "」节点已生成", "ok");
    } catch (e) {
      toast((e && e.message) || "生成失败", "err");
    }
    refresh(ctx, true);
  }

  function doExplode(ctx, nid) {
    try {
      const made = explodeScript(ctx.p, nid);
      autoLayout(ctx.p, 60, 48);
      toast("已解析出 " + made.length + " 张分镜图节点", made.length ? "ok" : "warn");
    } catch (e) {
      toast((e && e.message) || "解析失败", "err");
    }
    refresh(ctx, true);
  }

  function fit(ctx) {
    const c = ensure(ctx.p);
    if (!c.nodes.length) { c.view = { x: 0, y: 0, k: 1 }; refresh(ctx, false); return; }
    const xs = c.nodes.map(n => n.x), ys = c.nodes.map(n => n.y);
    const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
    const maxX = Math.max.apply(null, xs) + NW, maxY = Math.max.apply(null, ys) + NH;
    const r = ctx.vp.getBoundingClientRect();
    const k = Math.min(MAX_K, Math.max(MIN_K, Math.min((r.width - 64) / (maxX - minX || 1), (r.height - 64) / (maxY - minY || 1))));
    c.view.k = k;
    c.view.x = (r.width - (maxX - minX) * k) / 2 - minX * k;
    c.view.y = (r.height - (maxY - minY) * k) / 2 - minY * k;
    refresh(ctx, false);
  }

  function act(ctx, name) {
    if (name === "layout") { autoLayout(ctx.p, 60, 48); refresh(ctx, true); toast("已按连线自动排版", "ok"); }
    else if (name === "fit") fit(ctx);
    else if (name === "export") exportJson(ctx);
    else if (name === "import") importJson(ctx);
    else if (name === "compose") compose(ctx);
  }

  function exportJson(ctx) {
    const json = serialize(ctx.p);
    try {
      U.download((ctx.p.title || "工作流") + "-工作流.json", new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
      toast("工作流已导出（只含节点/参数/连线）", "ok");
    } catch (e) { toast("导出失败", "err"); }
  }

  function importJson(ctx) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          parse(ctx.p, String(rd.result || ""));
          toast("工作流已导入", "ok");
          refresh(ctx, true);
          fit(ctx);
        } catch (e) { toast((e && e.message) || "导入失败", "err"); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  async function compose(ctx) {
    try {
      if (!D.compose || !D.compose.client) throw D.err("NO_COMPOSE", "合成模块未就绪");
      toast("正在画布内合成（实时录制，请勿切走）…", "");
      const blob = await D.compose.client(ctx.p, {});
      U.download((ctx.p.title || "成片") + ".webm", blob);
      toast("画布合成完成，已开始下载", "ok");
    } catch (e) {
      toast((e && e.message) || "合成失败", "err");
    }
  }

  function closeMenu(ctx) {
    if (ctx.menu && ctx.menu.parentNode) ctx.menu.parentNode.removeChild(ctx.menu);
    ctx.menu = null;
  }

  function openMenu(ctx, x, y, html) {
    closeMenu(ctx);
    const m = document.createElement("div");
    m.className = "cv-menu";
    m.innerHTML = html;
    document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(x, window.innerWidth - w - 8) + "px";
    m.style.top = Math.min(y, window.innerHeight - h - 8) + "px";
    ctx.menu = m;
    setTimeout(() => {
      const off = ev => { if (!m.contains(ev.target)) { closeMenu(ctx); document.removeEventListener("mousedown", off); } };
      document.addEventListener("mousedown", off);
    }, 0);
    return m;
  }

  function openAddMenu(ctx, clientX, clientY, pt) {
    const m = openMenu(ctx, clientX, clientY,
      '<div class="cv-menu-t">添加节点</div>' +
      TYPE_ORDER.map(t => '<button data-t="' + t + '">' + NODE_TYPES[t].label + " · " + NODE_TYPES[t].hint + "</button>").join("")
    );
    m.querySelectorAll("button").forEach(b => b.onclick = () => {
      const n = addNode(ctx.p, b.dataset.t, Math.round(pt.x - NW / 2), Math.round(pt.y - NH / 2), {});
      ctx.sel = n.id;
      closeMenu(ctx);
      refresh(ctx, true);
    });
  }

  function openNodeMenu(ctx, clientX, clientY, nid) {
    const n = nodeById(ctx.p, nid);
    if (!n) return;
    const t = typeOf(n.type);
    const downstream = TYPE_ORDER.filter(k => NODE_TYPES[k].in.indexOf(t.out) >= 0);
    const m = openMenu(ctx, clientX, clientY,
      '<div class="cv-menu-t">添加下游节点</div>' +
      (downstream.length
        ? downstream.map(k => '<button data-t="' + k + '">' + NODE_TYPES[k].label + "</button>").join("")
        : '<button disabled>该节点没有可接的下游</button>') +
      '<div class="cv-menu-t">操作</div>' +
      '<button data-a="del">删除节点</button>'
    );
    m.querySelectorAll("button[data-t]").forEach(b => b.onclick = () => {
      const node = addNode(ctx.p, b.dataset.t, n.x + NW + 60, n.y + (downstream.indexOf(b.dataset.t) * 40), {});
      try { addEdge(ctx.p, n.id, node.id); } catch (e) { toast((e && e.message) || "连线失败", "warn"); }
      closeMenu(ctx);
      refresh(ctx, true);
    });
    const del = m.querySelector('button[data-a="del"]');
    if (del) del.onclick = () => { removeNode(ctx.p, nid); closeMenu(ctx); refresh(ctx, true); };
  }

  function mount(el, p, opts) {
    if (!el) return null;
    ensureCss();
    ensure(p);
    const ctx = { el, p, opts: opts || {}, sel: "", pan: null, drag: null, menu: null, uid: ++mountSeq };
    renderShell(ctx);
    paint(ctx);
    return {
      refresh: () => paint(ctx),
      ctx,
      key: "cv" + ctx.uid
    };
  }

  D.canvas = {
    NW, NH, MIN_K, MAX_K, NODE_TYPES, TYPE_ORDER, OUT_NAME, RATIOS,
    blank, ensure, addNode, removeNode, moveNode, setData, nodeById,
    accepts, addEdge, disconnect, upstream, downstream, incoming, topoOrder,
    buildPrompt, firstFrameFrom, refImagesFrom, splitScript, explodeScript, autoLayout,
    serialize, parse, runNode, mount
  };
})();
