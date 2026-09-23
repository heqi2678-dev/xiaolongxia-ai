/* 铜龙电商 · AI 短剧工作台 · 故事板视图（LibTV Storyboard 形态）
 * 与节点画布双视图切换：把画布节点按拓扑序读成分镜卡片，可直接改提示词/台词/运镜/时长，
 * 点「定位节点」回到节点画布并选中该节点。无节点时回退读工程 shots。 */
(function () {
  const D = XLX.drama;

  const SHOT_TYPES = ["image", "video", "lipsync"];
  const TEXT_TYPES = ["script", "text"];
  const STATUS = { idle: "待生成", running: "生成中", done: "已完成", failed: "失败" };

  function activeCanvas(p) {
    try { return D.canvas.activeCanvas(p); } catch (e) { return null; }
  }

  function num(v, d) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : d;
  }

  function esc(s) { return D.ui.esc(s); }

  /* 分镜卡片：画布有出图/出片节点时取节点（拓扑序），否则回退工程 shots */
  function list(p) {
    const c = activeCanvas(p);
    if (c && (c.nodes || []).some(n => SHOT_TYPES.indexOf(n.type) >= 0)) return fromCanvas(p, c);
    return fromShots(p);
  }

  function card(n, seq, text) {
    const t = D.canvas.NODE_TYPES[n.type] || {};
    return {
      seq: seq, nodeId: n.id, type: n.type, label: t.label || n.type,
      prompt: (n.data && n.data.prompt) || "",
      text: text || (n.data && n.data.text) || "",
      motion: (n.data && n.data.motion) || "",
      duration: num(n.data && n.data.duration, 5),
      status: n.status || "idle", out: n.out || "", error: n.error || ""
    };
  }

  function fromCanvas(p, c) {
    const byId = {};
    (c.nodes || []).forEach(n => { byId[n.id] = n; });
    const order = D.canvas.topoOrder(p);
    const out = [];
    order.forEach(id => {
      const n = byId[id];
      if (!n || SHOT_TYPES.indexOf(n.type) < 0) return;
      const ups = (c.edges || []).filter(e => e.to === n.id).map(e => byId[e.from]).filter(Boolean);
      const tn = ups.find(x => TEXT_TYPES.indexOf(x.type) >= 0);
      out.push(card(n, out.length + 1, (tn && tn.data && tn.data.text) || ""));
    });
    return out;
  }

  function fromShots(p) {
    return (p.shots || []).map((s, i) => ({
      seq: i + 1, nodeId: "", type: "video", label: "视频",
      prompt: s.prompt || "", text: s.line || "",
      motion: s.motion || "", duration: num(s.duration, 5),
      status: s.status || "idle", out: s.videoUrl || s.imageUrl || "", error: s.error || ""
    }));
  }

  /* 写回分镜字段到对应节点（旧 shots 无 nodeId 时不写） */
  function update(p, nodeId, patch) {
    if (!nodeId) return null;
    const n = D.canvas.nodeById(p, nodeId);
    if (!n) return null;
    ["prompt", "motion", "duration", "trimIn", "trimOut", "text"].forEach(k => {
      if (patch && Object.prototype.hasOwnProperty.call(patch, k)) D.canvas.setData(p, nodeId, k, patch[k]);
    });
    return n;
  }

  function badge(s) {
    const cls = s === "done" ? "st-done" : s === "failed" ? "st-failed" : s === "running" ? "st-running" : "";
    return '<span class="cv-st ' + cls + '">' + (STATUS[s] || s) + "</span>";
  }

  function html(p) {
    const cards = list(p);
    if (!cards.length) {
      return '<div class="sb-empty">当前画布还没有可排的分镜。切回节点画布，添加图片 / 视频节点后这里会自动生成故事板。</div>';
    }
    return '<div class="sb-grid">' + cards.map(c => {
      const isVid = c.type === "video" || /\.(mp4|webm)(\?|#|$)/i.test(c.out);
      const thumb = c.out
        ? (isVid
            ? '<video class="sb-thumb" muted playsinline preload="metadata" src="' + esc(c.out) + '"></video>'
            : '<img class="sb-thumb" src="' + esc(c.out) + '" alt="">')
        : '<div class="sb-thumb sb-ph">' + c.seq + "</div>";
      const ro = c.nodeId ? "" : " readonly";
      return '<div class="sb-card" data-sb-seq="' + c.seq + '">' +
        '<div class="sb-top">' + thumb +
          '<div class="sb-meta"><div class="sb-seq">第 ' + c.seq + " 镜 " + badge(c.status) + "</div>" +
            '<div class="sb-type">' + esc(c.label) + "</div></div>" +
          (c.nodeId ? '<button class="sb-open" data-sb-open="' + esc(c.nodeId) + '" title="在节点画布中定位">定位节点</button>' : "") +
        "</div>" +
        '<label class="label">画面提示词</label>' +
        '<textarea class="inp sb-t" data-sb-f="prompt" data-sb-id="' + esc(c.nodeId) + '" style="min-height:56px;font-size:12px"' + ro + ">" + esc(c.prompt) + "</textarea>" +
        '<label class="label">台词</label>' +
        '<textarea class="inp sb-t" data-sb-f="text" data-sb-id="' + esc(c.nodeId) + '" style="min-height:42px;font-size:12px"' + ro + ">" + esc(c.text) + "</textarea>" +
        '<div class="sb-row">' +
          '<label class="label" style="margin:0">运镜</label>' +
          '<input class="inp sb-i" data-sb-f="motion" data-sb-id="' + esc(c.nodeId) + '" value="' + esc(c.motion) + '"' + ro + ">" +
          '<label class="label" style="margin:0 0 0 8px">时长</label>' +
          '<input class="inp sb-i" type="number" min="1" max="30" data-sb-f="duration" data-sb-id="' + esc(c.nodeId) + '" value="' + Number(c.duration || 5) + '"' + ro + ">" +
        "</div>" +
      "</div>";
    }).join("") + "</div>";
  }

  const CSS = `
.sb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:2px 2px 30px}
@media(max-width:1100px){.sb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.sb-grid{grid-template-columns:1fr}}
.sb-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px;min-width:0}
.sb-top{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}
.sb-thumb{width:92px;height:52px;object-fit:cover;border-radius:8px;background:var(--card);flex:none;display:block}
.sb-ph{display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--text3)}
.sb-meta{flex:1;min-width:0}
.sb-seq{font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px}
.sb-type{font-size:11.5px;color:var(--text3);margin-top:3px}
.sb-open{flex:none;font-size:11.5px;color:var(--accent2);background:none;border:1px solid var(--border);border-radius:8px;padding:4px 8px;cursor:pointer}
.sb-open:hover{border-color:var(--accent)}
.sb-row{display:flex;align-items:center;gap:6px;margin-top:6px}
.sb-row .sb-i{flex:1;min-width:0}
.sb-empty{grid-column:1/-1;padding:40px 16px;text-align:center;color:var(--text3);font-size:13px;line-height:1.8}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaStoryboardCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function mount(host, p, opts) {
    opts = opts || {};
    if (!host) return null;
    ensureCss();
    host.innerHTML = html(p);
    host.querySelectorAll("[data-sb-f]").forEach(el => {
      const id = el.getAttribute("data-sb-id");
      const f = el.getAttribute("data-sb-f");
      if (!id) return;
      const write = () => {
        let v = el.value;
        if (f === "duration") v = Number(v) || 0;
        const patch = {}; patch[f] = v;
        update(p, id, patch);
        if (opts.onChange) opts.onChange();
      };
      el.oninput = write;
      el.onchange = () => { write(); if (opts.onSave) opts.onSave(); };
    });
    host.querySelectorAll("[data-sb-open]").forEach(b => {
      b.onclick = () => { if (opts.onOpen) opts.onOpen(b.getAttribute("data-sb-open")); };
    });
    return { refresh: () => mount(host, p, opts) };
  }

  D.storyboard = { list, fromCanvas, fromShots, update, html, mount, SHOT_TYPES, TEXT_TYPES };
})();
