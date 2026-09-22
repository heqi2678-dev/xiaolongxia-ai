/* 铜龙电商 · AI 短剧工作台 · 节点工作台（画布宿主） */
/* 对齐 LibTV：顶部工程/画布/缩放/面板条 + 无限画布 + 右侧节点详情 + 底部浮动工具条。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;
  const FPS = 30;

  const state = { pid: "", project: null, busy: false, lastComposed: null, canvasId: "", sel: "", view: null, statusText: "", statusType: "" };

  let saveTimer = null;
  let cssDone = false;

  const GEN_TYPES = ["image", "video", "audio", "lipsync"];

  const CSS = `
.dw-workbench{display:flex;flex-direction:column;gap:10px}
.dw-workbench>.dw-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:0;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}
.dw-workbench>.dw-bar .inp{width:auto;min-width:140px}
.dw-more{position:relative;display:inline-block}
.dw-more-menu{position:absolute;left:0;top:calc(100% + 6px);z-index:40;display:flex;flex-direction:column;gap:6px;min-width:150px;padding:8px;border:1px solid var(--border);border-radius:12px;background:var(--card);box-shadow:0 12px 30px rgba(0,0,0,.45)}
.dw-more-menu[hidden]{display:none}
.dw-more-menu .btn{width:100%;justify-content:flex-start}
.dw-wb-sp{flex:1}
.dw-zoom{font-size:11px;color:var(--text3);min-width:44px;text-align:center;display:inline-block}
.dw-wb-main{display:flex;gap:10px;align-items:stretch}
.dw-wb-canvas{flex:1;min-width:0}
.dw-wb-canvas .cv-wrap{height:640px}
.dw-wb-side{width:340px;flex:none;max-height:640px;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.dw-wb-side.dw-side-off{display:none}
.dw-wb-foot{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}
.dw-wb-cards{display:flex;flex-direction:column;gap:10px}
.dw-node-empty{color:var(--text3);font-size:12px;padding:10px;line-height:1.6}
.dw-frame-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
@media (max-width:860px){.dw-wb-main{flex-direction:column}.dw-wb-side{width:auto}}
`;

  function view() { return document.getElementById("dwManual"); }

  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dwWorkbenchCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  async function ensureProject(pid) {
    let list = D.project.list();
    if (!list.length) {
      const p = D.project.blank({ title: "我的第一部短剧" });
      await D.project.save(p);
      list = D.project.list();
    }
    if (!pid || !D.project.get(pid)) pid = list[0].id;
    state.pid = pid;
  }

  async function load(pid) {
    await ensureProject(pid);
    const raw = D.project.get(state.pid);
    state.project = normalize(raw);
    if (!state.project) throw D.err("NO_PROJECT", "工程不存在");
    try { await D.project.hydrateAssets(state.project); } catch (e) {}
    D.canvas.ensure(state.project);
    const list = D.canvas.listCanvases(state.project);
    if (!state.canvasId || !D.canvas.canvasById(state.project, state.canvasId)) {
      state.canvasId = (D.canvas.activeCanvas(state.project) || list[0]).id;
    }
    state.sel = "";
    return state.project;
  }

  function normalize(p) {
    if (!p) return p;
    D.project.migrate(p);
    return p;
  }

  function saveSoon(ms) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; save(); }, ms || 500);
  }

  async function save() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!state.project) return;
    await D.project.save(state.project);
  }

  function setStatus(text, type) {
    state.statusText = text || "";
    state.statusType = type || "";
    const el = document.getElementById("dwStatus");
    if (!el) return;
    el.innerHTML = text ? '<div class="dw-card" style="border-color:' + (type === "err" ? "var(--red)" : type === "ok" ? "#2b5a3a" : "var(--border)") + '">' + D.ui.esc(text) + "</div>" : "";
  }

  function activeCanvas() { return D.canvas.activeCanvas(state.project); }
  function selNode() { return state.sel ? D.canvas.nodeById(state.project, state.sel) : null; }
  function selCanvas() { return D.canvas.canvasById(state.project, state.canvasId) || activeCanvas(); }

  /* ============ 渲染骨架 ============ */
  async function render() {
    ensureCss();
    D.ui.ensureCss();
    const v = view();
    if (!v) return;
    if (!state.project || !D.project.get(state.pid)) await load();
    const p = state.project;
    const list = D.project.list();
    const canvases = D.canvas.listCanvases(p);
    if (!state.canvasId || !D.canvas.canvasById(p, state.canvasId)) state.canvasId = (D.canvas.activeCanvas(p) || canvases[0]).id;

    v.innerHTML = '<div class="dw-wrap dw-workbench">' +
      '<div class="dw-bar">' +
        '<select class="inp" id="dwProjSel" style="width:auto;min-width:160px">' + list.map(x => '<option value="' + x.id + '"' + (x.id === p.id ? " selected" : "") + ">" + D.ui.esc(x.title) + "</option>").join("") + "</select>" +
        '<div class="dw-more">' +
          '<button class="btn small" id="dwMoreBtn" type="button">工程操作 ▾</button>' +
          '<div class="dw-more-menu" id="dwMoreMenu" hidden>' +
            '<button class="btn small" id="dwNew">新建工程</button>' +
            '<button class="btn small" id="dwSave">保存草稿</button>' +
            '<button class="btn small" id="dwPush">上传云端</button>' +
            '<button class="btn small" id="dwPull">云端同步</button>' +
            '<button class="btn small ghost" id="dwGuide">看教程</button>' +
            '<button class="btn small ghost" id="dwMakeupBtn">造型室</button>' +
          "</div>" +
        "</div>" +
        '<label class="label" style="margin:0">画布</label>' +
        '<select class="inp" id="dwCanvasSel">' + canvases.map(c => '<option value="' + D.ui.esc(c.id) + '"' + (c.id === state.canvasId ? " selected" : "") + ">" + D.ui.esc(c.name) + "</option>").join("") + "</select>" +
        '<button class="btn small" id="dwCanvasAdd">＋ 画布</button>' +
        '<button class="btn small ghost" id="dwCanvasRename">重命名</button>' +
        '<button class="btn small ghost" id="dwCanvasDel">删除画布</button>' +
        '<span class="dw-wb-sp"></span>' +
        '<button class="btn small" id="dwZoomOut" title="缩小">－</button>' +
        '<span class="dw-zoom" id="dwZoomVal">100%</span>' +
        '<button class="btn small" id="dwZoomIn" title="放大">＋</button>' +
        '<button class="btn small ghost" id="dwFit">适应画布</button>' +
        '<button class="btn small ghost" id="dwPanelToggle">节点详情</button>' +
      "</div>" +
      '<div class="dw-wb-main">' +
        '<div class="dw-wb-canvas" id="dwCanvasHost"></div>' +
        '<div class="dw-wb-side" id="dwSide"></div>' +
      "</div>" +
      '<div class="dw-wb-foot">' +
        '<button class="btn small primary" id="dwAddNode">＋ 节点</button>' +
        '<button class="btn small" id="dwGenSel">生成所选</button>' +
        '<button class="btn small" id="dwGenMissing">生成未完成</button>' +
        '<button class="btn small ghost danger" id="dwStopAll">全部停止</button>' +
        '<span class="dw-wb-sp"></span>' +
        '<button class="btn small" id="dwCheck">合规检查</button>' +
        '<button class="btn primary" id="dwCompose">合成导出</button>' +
        '<button class="btn small" id="dwComposeServer">服务端合成</button>' +
        '<button class="btn small" id="dwExport">导出素材包</button>' +
      "</div>" +
      '<div class="dw-wb-cards">' +
        '<div class="dw-card"><h3>作品信息与剧本</h3>' + infoFields(p) + "</div>" +
        '<div class="dw-card"><h3>配乐与字幕</h3>' + mediaFields(p) + "</div>" +
        charCard(p) +
        D.ui.complianceCard(p, { prefix: "dw" }) +
        '<div class="dw-card"><h3>合成结果</h3><div id="dwComposeOut"></div></div>' +
      "</div>" +
      '<div id="dwStatus"></div>' +
    "</div>";

    mountCanvas();
    bind(p);
    paintSide();
  }

  function infoFields(p) {
    return '<div class="dw-grid">' +
      '<div><label class="label" style="margin-top:0">标题</label><input class="inp" id="dwTitle" value="' + D.ui.esc(p.title) + '"></div>' +
      '<div><label class="label" style="margin-top:0">剧种</label><select class="inp" id="dwGenre">' + D.ui.opts(D.GENRES, p.genre) + "</select></div>" +
      '<div><label class="label" style="margin-top:0">画风</label><select class="inp" id="dwStyle">' + D.ui.opts(D.STYLES, p.style) + "</select></div>" +
      '<div><label class="label" style="margin-top:0">画幅</label><select class="inp" id="dwRatio">' + D.ui.opts(D.RATIOS, p.output.ratio) + "</select></div>" +
      "</div>" +
      '<label class="label">一句话故事</label><input class="inp" id="dwLogline" value="' + D.ui.esc(p.script.logline) + '">' +
      '<label class="label">剧情大纲</label><textarea class="inp" id="dwOutline" style="min-height:70px">' + D.ui.esc(p.script.outline) + "</textarea>";
  }

  function isHex(v) { return /^#[0-9a-f]{6}$/i.test(String(v || "").trim()); }

  function mediaFields(p) {
    const sub = p.subtitle || {};
    return '<div class="dw-grid">' +
      "<div>" +
        '<label class="label" style="margin-top:0">背景音乐（BGM）</label>' +
        '<div class="dw-bar">' +
          '<button class="btn small" id="dwBgmPick">' + (p.bgm ? "更换 BGM" : "选择 BGM") + "</button>" +
          (p.bgm
            ? '<button class="btn small ghost danger" id="dwBgmClear">清除</button>'
            : '<span class="dw-hint">未选择，合成时无背景音乐</span>') +
        "</div>" +
      "</div>" +
      "<div>" +
        '<label class="label" style="margin-top:0">字幕</label>' +
        '<label class="label" style="display:flex;align-items:center;gap:6px;margin-top:0">' +
          '<input type="checkbox" id="dwSubOn"' + (sub.enabled === false ? "" : " checked") + "> 合成时烧录台词字幕</label>" +
        '<div class="dw-grid" style="margin-top:6px">' +
          '<div><label class="label" style="margin-top:0">字幕颜色</label><input class="inp" type="color" id="dwSubColor" value="' + (isHex(sub.color) ? sub.color : "#ffffff") + '"></div>' +
          '<div><label class="label" style="margin-top:0">描边颜色</label><input class="inp" type="color" id="dwSubStroke" value="' + (isHex(sub.stroke) ? sub.stroke : "#000000") + '"></div>' +
        "</div>" +
      "</div>" +
      "</div>" +
      '<div class="dw-hint" style="margin-top:8px">BGM 在合成时循环垫底；字幕按每镜台词烧录并按上面的颜色描边。两者都只在浏览器合成时生效（运镜同理），服务端合成只做快速拼接。</div>';
  }

  /* ============ 画布宿主 ============ */
  function mountCanvas() {
    const host = view().querySelector("#dwCanvasHost");
    if (!host) return;
    const p = state.project;
    try { D.canvas.setActiveCanvas(p, state.canvasId); } catch (e) { state.canvasId = D.canvas.activeCanvas(p).id; }
    state.view = D.canvas.mount(host, p, {
      bar: false,
      foot: false,
      select: state.sel,
      onSelect: (nid) => { state.sel = nid || ""; paintSide(); },
      onChange: () => saveSoon(400)
    });
    syncZoom();
  }

  function refreshCanvas() {
    if (state.view && state.view.refresh) state.view.refresh();
    syncZoom();
  }

  function zoomValue() {
    const c = selCanvas();
    return (c && c.view && c.view.k) || 1;
  }

  function syncZoom() {
    const el = document.getElementById("dwZoomVal");
    if (el) el.textContent = Math.round(zoomValue() * 100) + "%";
  }

  /* ============ 右侧：节点详情 ============ */
  function paintSide() {
    const el = document.getElementById("dwSide");
    if (!el) return;
    const n = selNode();
    if (!n) {
      const c = selCanvas();
      el.innerHTML = '<div class="dw-card"><h3>节点详情</h3>' +
        '<div class="dw-node-empty">在画布上点选一个节点，这里编辑提示词、台词、运镜、时长与入出点。<br><br>当前画布共 ' + ((c && c.nodes.length) || 0) + " 个节点、" + ((c && c.edges.length) || 0) + " 条连线。</div></div>";
      return;
    }
    const t = D.canvas.NODE_TYPES[n.type];
    const canvas = activeCanvas();
    const upstream = (canvas.nodes || []).filter(x => (canvas.edges || []).some(e => e.to === n.id && e.from === x.id));
    const downstream = (canvas.nodes || []).filter(x => (canvas.edges || []).some(e => e.from === n.id && e.to === x.id));
    let h = '<div class="dw-card"><h3>' + D.ui.esc(t.label) + '节点 <span data-status="' + n.id + '">' + statusBadge(n) + "</span></h3>";
    h += '<div class="dw-hint">' + D.ui.esc(t.hint) + "</div>";

    if (n.type === "script" || n.type === "text") {
      h += '<label class="label">文本 / 台词</label><textarea class="inp" style="min-height:80px;font-size:12px" data-sf="text">' + D.ui.esc(n.data.text || "") + "</textarea>";
    }
    if (n.type === "image" || n.type === "video") {
      h += '<label class="label">画面提示词</label><textarea class="inp" style="min-height:70px;font-size:12px" data-sf="prompt">' + D.ui.esc(n.data.prompt || "") + "</textarea>" +
        '<div class="dw-grid" style="margin-top:8px">' +
          '<div><label class="label" style="margin-top:0">运镜</label><input class="inp" data-sf="motion" placeholder="例如：推近 / 环绕" value="' + D.ui.esc(n.data.motion || "") + '"></div>' +
          '<div><label class="label" style="margin-top:0">画幅</label><select class="inp" data-sf="ratio">' + D.ui.opts(D.RATIOS.map(r => ({ id: r, name: r })), n.data.ratio || (state.project.output && state.project.output.ratio)) + "</select></div>" +
        "</div>";
    }
    if (n.type === "video" || n.type === "lipsync") {
      h += '<div class="dw-grid" style="margin-top:8px">' +
        '<div><label class="label" style="margin-top:0">时长（秒）</label><input class="inp" type="number" min="1" max="30" data-sf="duration" value="' + Number(n.data.duration || 5) + '"></div>' +
        '<div><label class="label" style="margin-top:0">入点（秒）</label><input class="inp" type="number" min="0" step="0.1" data-sf="trimIn" value="' + Number(n.data.trimIn || 0) + '"></div>' +
        '<div><label class="label" style="margin-top:0">出点（秒）</label><input class="inp" type="number" min="0" step="0.1" data-sf="trimOut" value="' + Number(n.data.trimOut || 0) + '"></div>' +
        "</div>";
      if (n.out) {
        h += '<div class="dw-frame-row" style="margin-top:6px">' +
          '<button class="btn small" data-sa="frame-back">⏪ 上一帧</button>' +
          '<button class="btn small" data-sa="frame-fwd">⏩ 下一帧</button>' +
          '<span class="dw-hint">逐帧预览不重跑模型</span>' +
          "</div>";
      }
    }
    if (n.type === "audio") {
      h += '<label class="label">台词</label><textarea class="inp" style="min-height:60px;font-size:12px" data-sf="text">' + D.ui.esc(n.data.text || "") + "</textarea>" +
        '<label class="label">音色</label><input class="inp" data-sf="voice" placeholder="留空用默认音色" value="' + D.ui.esc(n.data.voice || "") + '">';
    }
    if (n.type === "asset") {
      h += '<label class="label">资产地址</label><input class="inp" data-sf="ref" value="' + D.ui.esc(n.data.ref || "") + '">';
    }

    if (n.error) h += '<div class="dw-hint" style="color:var(--red)">' + D.ui.esc(n.error) + "</div>";

    h += '<div class="dw-shot-actions" style="margin-top:8px">';
    if (GEN_TYPES.indexOf(n.type) >= 0) {
      h += '<button class="btn small primary" data-sa="gen">' + (n.type === "image" ? (n.out ? "改图" : "生成") : (n.out ? "重绘" : "生成")) + "</button>";
      if (n.type === "image") h += '<button class="btn small" data-sa="hires">图片高清</button>';
      else if (n.type === "video") h += '<button class="btn small" data-sa="hires">视频高清</button>';
    }
    h += '<button class="btn small ghost danger" data-sa="del">删除节点</button>' +
      "</div>";
    h += '<div class="dw-progress" data-prog="' + n.id + '"></div>';

    h += '<div class="dw-hint" style="margin-top:6px">上游 ' + upstream.length + " 个 · 下游 " + downstream.length + " 个</div>";
    h += "</div>";

    const kind = (n.type === "video" || n.type === "lipsync") ? "video" : n.type === "audio" ? "tts" : "image";
    h += '<div class="dw-card"><h3>模型</h3>' + D.ui.modelBar(kind) + "</div>";

    el.innerHTML = h;
    bindSide(el, n);
  }

  function statusBadge(n) {
    const map = { idle: "待生成", running: "生成中", done: "已完成", failed: "失败" };
    const cls = n.status === "done" ? "st-done" : n.status === "failed" ? "st-failed" : n.status === "running" ? "st-running" : "";
    return '<span class="cv-st ' + cls + '">' + (map[n.status] || n.status) + "</span>";
  }

  function bindSide(el, n) {
    el.querySelectorAll("[data-sf]").forEach(inp => {
      const f = inp.dataset.sf;
      const write = () => {
        let val = inp.value;
        if (f === "duration" || f === "trimIn" || f === "trimOut") val = Number(val) || 0;
        D.canvas.setData(state.project, n.id, f, val);
        saveSoon(500);
      };
      inp.oninput = write;
      inp.onchange = async () => { write(); await save(); };
    });
    const act = (name, fn) => { const b = el.querySelector('[data-sa="' + name + '"]'); if (b) b.onclick = fn; };
    act("gen", () => runSelected());
    act("hires", () => runSelected("hires"));
    act("del", async () => {
      D.canvas.removeNode(state.project, n.id);
      state.sel = "";
      await save();
      refreshCanvas();
      paintSide();
    });
    act("frame-back", () => stepFrame(-1));
    act("frame-fwd", () => stepFrame(1));
    D.models.bind(el, { onChange: () => paintSide() });
  }

  /* 逐帧预览：直接操作画布内当前节点的 <video>，不改数据 */
  function stepFrame(dir) {
    const host = document.getElementById("dwCanvasHost");
    const n = selNode();
    if (!host || !n || !n.out) { U.toast("先用生成或点开视频预览", "warn"); return; }
    const vids = Array.from(host.querySelectorAll("video"));
    const v = vids.find(x => (x.getAttribute("src") || "") === n.out) || vids[0];
    if (!v) { U.toast("画布里还没挂上视频预览", "warn"); return; }
    v.pause();
    try { v.currentTime = Math.max(0, (v.currentTime || 0) + dir / FPS); } catch (e) {}
  }

  /* ============ 生成与管理 ============ */
  async function runSelected(action) {
    const n = selNode();
    if (!n) { U.toast("先在画布上选中一个节点", "warn"); return; }
    if (GEN_TYPES.indexOf(n.type) < 0) { U.toast("该节点不需要生成", "warn"); return; }
    if (state.busy) { U.toast("正在生成，请等待当前任务结束", "warn"); return; }
    state.busy = true;
    setStatus((action === "hires" ? "正在高清重绘…" : "正在生成节点…"), "");
    try {
      await D.canvas[action === "hires" ? "actionNode" : "runNode"](state.project, n.id, action === "hires" ? "hires" : undefined);
      await save();
      refreshCanvas();
      paintSide();
      setStatus("节点生成完成。", "ok");
      U.toast("节点生成完成", "ok");
    } catch (e) {
      refreshCanvas();
      paintSide();
      setStatus((e && e.message) || "生成失败", "err");
      U.toast((e && e.message) || "生成失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function genMissing() {
    const c = activeCanvas();
    const ids = (c.nodes || []).filter(n => GEN_TYPES.indexOf(n.type) >= 0 && (n.status !== "done" || !n.out)).map(n => n.id);
    if (!ids.length) { U.toast("画布上的节点都已完成", "ok"); return; }
    if (state.busy) { U.toast("正在生成，请等待当前任务结束", "warn"); return; }
    state.busy = true;
    setStatus("正在生成 " + ids.length + " 个未完成节点…", "");
    let failed = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        setStatus("生成进度 " + (i + 1) + "/" + ids.length + "…", "");
        try { await D.canvas.runNode(state.project, ids[i]); }
        catch (e) { failed++; }
      }
      await save();
      refreshCanvas();
      paintSide();
      setStatus(failed ? "完成，失败 " + failed + " 个节点，可单选重试。" : "全部节点生成完成。", failed ? "err" : "ok");
    } finally {
      state.busy = false;
    }
  }

  function pickBgm() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try {
        await D.project.assets.put(id, f, { mime: f.type, size: f.size, name: f.name });
      } catch (e) {
        U.toast("BGM 读取失败，请换一个文件", "err");
        return;
      }
      state.project.bgm = "asset:" + id;
      await save();
      render();
      U.toast("背景音乐已设置", "ok");
    };
    input.click();
  }

  function pickCharRef(cid) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const c = (state.project.characters || []).find(x => x.id === cid);
      if (!c) return;
      for (const f of files) {
        const guard = await D.compliance.guardUpload(f, "reference");
        if (!guard.ok) { U.toast(guard.reason, "err"); continue; }
        if (guard.warn) U.toast(guard.warn, "warn");
        c.refImages = c.refImages || [];
        c.refImages.push(await D.adapterUtil.fileToDataUrl(f));
      }
      D.character.markAffected(state.project, cid);
      await save();
      render();
      U.toast("参考图已添加，相关分镜已标记「需重绘」", "ok");
    };
    input.click();
  }

  async function genSheet(cid) {
    const p = state.project;
    if (state.busy) { U.toast("正在生成，请等待当前任务结束", "warn"); return; }
    state.busy = true;
    setStatus("正在生成角色定妆图…", "");
    try {
      const r = await D.character.generateSheet(p, cid);
      await save();
      render();
      setStatus(r.affected ? "定妆图已加入参考图，" + r.affected + " 个相关分镜已标记「需重绘」。" : "定妆图已生成，已加入参考图。", "ok");
    } catch (e) {
      setStatus((e && e.message) || "定妆图生成失败", "err");
    } finally {
      state.busy = false;
    }
  }

  function checkCompliance() {
    const vv = D.project.validate(state.project);
    const cc = D.compliance.verify(state.project);
    setStatus(
      (vv.ok ? "画面与配音齐全。" : "还缺：" + vv.missing.map(m => "第" + m.seq + "镜" + m.reason).join("、")) +
      (cc.ok ? " 合规检查通过。" : " 合规问题：" + cc.blockers.join("；")),
      vv.ok && cc.ok ? "ok" : "err"
    );
  }

  async function compose() {
    if (state.busy) return;
    state.busy = true;
    setStatus("正在合成（实时录制，约等于成片时长，请勿切走）…", "");
    try {
      const blob = await D.compose.client(state.project, {
        onProgress: (pr) => setStatus("合成中 " + Math.round(pr.elapsed) + "/" + Math.round(pr.total) + " 秒…", "")
      });
      state.lastComposed = blob;
      await D.compliance.archive(state.project, { kind: "browser-webm", size: blob.size });
      const out = document.getElementById("dwComposeOut");
      const url = URL.createObjectURL(blob);
      out.innerHTML = '<video class="dw-preview" controls src="' + url + '"></video>' +
        '<div class="dw-bar" style="margin-top:8px"><button class="btn small primary" id="dwDlVideo">下载成片</button></div>';
      out.querySelector("#dwDlVideo").onclick = () => U.download(state.project.title + ".webm", blob);
      setStatus("合成完成，可下载或导出素材包。", "ok");
    } catch (e) {
      setStatus((e && e.message) || "合成失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function composeServer() {
    if (state.busy) return;
    state.busy = true;
    setStatus("正在请求服务端合成…", "");
    try {
      const r = await D.compose.server(state.project);
      setStatus("服务端合成完成：", "ok");
      const out = document.getElementById("dwComposeOut");
      out.innerHTML = '<video class="dw-preview" controls src="' + r.url + '"></video>';
    } catch (e) {
      setStatus((e && e.message) || "服务端合成失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function exportPack() {
    try {
      setStatus("正在打包素材…", "");
      if (!state.lastComposed) U.toast("还没合成成片，将只导出素材", "warn");
      const blob = await D.compose.exportPack(state.project, state.lastComposed);
      U.download(state.project.title + "-素材包.zip", blob);
      setStatus("素材包已导出，可导入剪映二次剪辑。", "ok");
    } catch (e) {
      setStatus((e && e.message) || "打包失败", "err");
    }
  }

  /* ============ 角色卡 ============ */
  function charCard(p) {
    let html = '<div class="dw-card"><h3>角色卡 <span class="dw-hint">（角色越具体，画面越稳定）</span></h3>';
    if (!(p.characters || []).length) {
      html += '<div class="dw-empty">还没有角色，点下面「＋ 新增角色」</div>';
    } else {
      html += p.characters.map(c =>
        '<div class="dw-char" data-char="' + c.id + '">' +
          '<div style="flex:1">' +
            '<div class="dw-grid">' +
              '<div><label class="label" style="margin-top:0">名字</label><input class="inp" data-cf="name" data-cid="' + c.id + '" value="' + D.ui.esc(c.name) + '"></div>' +
              '<div><label class="label" style="margin-top:0">身份</label><input class="inp" data-cf="identity" data-cid="' + c.id + '" value="' + D.ui.esc(c.identity) + '"></div>' +
            "</div>" +
            '<label class="label">外观总述（发型、服装、气质）</label><textarea class="inp" style="min-height:46px;font-size:12px" data-cf="appearance" data-cid="' + c.id + '">' + D.ui.esc(c.appearance) + "</textarea>" +
            D.ui.charDetails(c) +
            '<div class="dw-char-refs">' +
              (c.refImages || []).map(u => '<img class="dw-char-ref" src="' + D.ui.esc(u) + '" alt="">').join("") +
              '<button class="btn small" data-act="charref" data-cid="' + c.id + '">＋ 参考图</button>' +
              '<button class="btn small" data-act="charsheet" data-cid="' + c.id + '">生成定妆图</button>' +
            "</div>" +
          "</div>" +
          '<div>' +
            '<button class="btn small" data-act="charsave" data-cid="' + c.id + '">存入角色库</button>' +
            '<button class="btn small ghost danger" style="margin-top:6px" data-act="delchar" data-cid="' + c.id + '">删除</button>' +
          "</div>" +
        "</div>"
      ).join("");
    }
    html += '<div class="dw-bar" style="margin-top:6px"><button class="btn small" data-act="addchar">＋ 新增角色</button>' +
      '<button class="btn small" data-act="charload">从角色库添加</button></div>';
    html += D.ui.libPanel(p, { prefix: "dw" });
    html += "</div>";
    return html;
  }

  /* ============ 绑定 ============ */
  function bind(p) {
    const v = view();
    v.querySelector("#dwProjSel").onchange = async (e) => { state.project = null; state.lastComposed = null; state.canvasId = ""; state.sel = ""; await load(e.target.value); render(); };
    v.querySelector("#dwMoreBtn").onclick = (e) => {
      e.stopPropagation();
      const mn = v.querySelector("#dwMoreMenu");
      if (mn) mn.hidden = !mn.hidden;
    };
    v.querySelector("#dwMoreMenu").addEventListener("click", () => { v.querySelector("#dwMoreMenu").hidden = true; });
    v.querySelector("#dwNew").onclick = async () => {
      const np = D.project.blank({});
      await D.project.save(np);
      state.project = null;
      state.lastComposed = null;
      state.canvasId = "";
      state.sel = "";
      await load(np.id);
      render();
    };
    v.querySelector("#dwSave").onclick = async () => {
      await save();
      if (XLX.dramaShell && XLX.dramaShell.snapshot) XLX.dramaShell.snapshot(state.project);
      U.toast("草稿已保存", "ok");
    };
    v.querySelector("#dwPush").onclick = async () => {
      try { await D.project.remote.save(state.project); U.toast("已上传云端", "ok"); }
      catch (e) { U.toast((e && e.message) || "上传失败", "err"); }
    };
    v.querySelector("#dwPull").onclick = async () => {
      try {
        const remote = await D.project.remote.list();
        if (!remote.length) { U.toast("云端还没有工程", "warn"); return; }
        const pick = prompt("输入要拉取的工程标题：", remote[0].title);
        const hit = remote.find(x => x.title === pick);
        if (!hit) { U.toast("没找到这个标题", "warn"); return; }
        const full = await D.project.remote.get(hit.id);
        if (!full) { U.toast("拉取失败", "err"); return; }
        await D.project.save(full);
        state.project = null;
        state.canvasId = "";
        state.sel = "";
        await load(full.id);
        render();
        U.toast("已从云端同步", "ok");
      } catch (e) { U.toast((e && e.message) || "同步失败", "err"); }
    };
    v.querySelector("#dwGuide").onclick = () => { if (D.guide) D.guide.open("manual"); };
    v.querySelector("#dwMakeupBtn").onclick = async () => { await save(); if (D.makeup && D.makeup.load) await D.makeup.load(state.pid); if (XLX.app) XLX.app.go("makeup"); };

    /* 画布条 */
    v.querySelector("#dwCanvasSel").onchange = async (e) => {
      state.canvasId = e.target.value;
      state.sel = "";
      try { D.canvas.setActiveCanvas(state.project, state.canvasId); } catch (err) {}
      await save();
      mountCanvas();
      paintSide();
    };
    v.querySelector("#dwCanvasAdd").onclick = async () => {
      const c = D.canvas.addCanvas(state.project);
      state.canvasId = c.id;
      state.sel = "";
      await save();
      render();
    };
    v.querySelector("#dwCanvasRename").onclick = async () => {
      const c = selCanvas();
      const name = prompt("画布名称：", c.name);
      if (name == null) return;
      D.canvas.renameCanvas(state.project, c.id, name);
      await save();
      render();
    };
    v.querySelector("#dwCanvasDel").onclick = async () => {
      try { D.canvas.removeCanvas(state.project, state.canvasId); }
      catch (e) { U.toast((e && e.message) || "无法删除画布", "warn"); return; }
      state.canvasId = D.canvas.activeCanvas(state.project).id;
      state.sel = "";
      await save();
      render();
    };
    v.querySelector("#dwZoomOut").onclick = () => { if (state.view) state.view.zoom(-0.12); syncZoom(); };
    v.querySelector("#dwZoomIn").onclick = () => { if (state.view) state.view.zoom(0.12); syncZoom(); };
    v.querySelector("#dwFit").onclick = () => { if (state.view) state.view.fit(); syncZoom(); };
    v.querySelector("#dwPanelToggle").onclick = () => {
      const side = v.querySelector("#dwSide");
      side.classList.toggle("dw-side-off");
    };

    /* 底部工具条 */
    v.querySelector("#dwAddNode").onclick = () => {
      const host = document.getElementById("dwCanvasHost");
      const r = host.getBoundingClientRect();
      if (state.view && state.view.openAddMenu) state.view.openAddMenu(r.left + r.width / 2, r.top + r.height / 2);
    };
    v.querySelector("#dwGenSel").onclick = () => runSelected();
    v.querySelector("#dwGenMissing").onclick = () => genMissing();
    v.querySelector("#dwStopAll").onclick = () => { D.engine.abortAll(); U.toast("已请求停止", "warn"); };
    v.querySelector("#dwCheck").onclick = () => checkCompliance();
    v.querySelector("#dwCompose").onclick = () => compose();
    v.querySelector("#dwComposeServer").onclick = () => composeServer();
    v.querySelector("#dwExport").onclick = () => exportPack();

    /* 作品信息 */
    const titleEl = v.querySelector("#dwTitle");
    titleEl.oninput = () => { state.project.title = titleEl.value; saveSoon(500); };
    titleEl.onchange = async () => { state.project.title = titleEl.value; await save(); };
    const logEl = v.querySelector("#dwLogline");
    logEl.oninput = () => { state.project.script.logline = logEl.value; saveSoon(500); };
    logEl.onchange = async () => { state.project.script.logline = logEl.value; await save(); };
    const outEl = v.querySelector("#dwOutline");
    outEl.oninput = () => { state.project.script.outline = outEl.value; saveSoon(500); };
    outEl.onchange = async () => { state.project.script.outline = outEl.value; await save(); };
    v.querySelector("#dwGenre").onchange = async (e) => { state.project.genre = e.target.value; state.project.engine = e.target.value === "realistic" ? "video" : "image"; await save(); render(); };
    v.querySelector("#dwStyle").onchange = async (e) => { state.project.style = e.target.value; await save(); };
    v.querySelector("#dwRatio").onchange = async (e) => { state.project.output.ratio = e.target.value; await save(); };

    /* 配乐与字幕 */
    const bgmPick = v.querySelector("#dwBgmPick");
    if (bgmPick) bgmPick.onclick = () => pickBgm();
    const bgmClear = v.querySelector("#dwBgmClear");
    if (bgmClear) bgmClear.onclick = async () => { state.project.bgm = ""; await save(); render(); U.toast("已清除背景音乐", "ok"); };
    const subOn = v.querySelector("#dwSubOn");
    if (subOn) subOn.onchange = async () => {
      state.project.subtitle = state.project.subtitle || {};
      state.project.subtitle.enabled = subOn.checked;
      await save();
    };
    const bindColor = (sel, key) => {
      const el = v.querySelector(sel);
      if (!el) return;
      el.oninput = () => {
        state.project.subtitle = state.project.subtitle || {};
        state.project.subtitle[key] = el.value;
        saveSoon(400);
      };
      el.onchange = async () => {
        state.project.subtitle = state.project.subtitle || {};
        state.project.subtitle[key] = el.value;
        await save();
      };
    };
    bindColor("#dwSubColor", "color");
    bindColor("#dwSubStroke", "stroke");

    /* 角色卡 */
    v.querySelectorAll("[data-cf]").forEach(el => {
      el.oninput = () => {
        const c = (state.project.characters || []).find(x => x.id === el.dataset.cid);
        if (c) { c[el.dataset.cf] = el.value; saveSoon(500); }
      };
      el.onchange = async () => {
        const c = (state.project.characters || []).find(x => x.id === el.dataset.cid);
        if (!c) return;
        c[el.dataset.cf] = el.value;
        await save();
      };
    });
    v.querySelectorAll("[data-cd]").forEach(el => {
      el.oninput = () => {
        const c = (state.project.characters || []).find(x => x.id === el.dataset.cid);
        if (c) { c.details = c.details || {}; c.details[el.dataset.cd] = el.value; saveSoon(500); }
      };
      el.onchange = async () => {
        const c = (state.project.characters || []).find(x => x.id === el.dataset.cid);
        if (!c) return;
        c.details = c.details || {};
        c.details[el.dataset.cd] = el.value;
        await save();
      };
    });
    v.querySelectorAll('[data-act="addchar"]').forEach(b => b.onclick = async () => { D.project.addCharacter(state.project); await save(); render(); });
    v.querySelectorAll('[data-act="delchar"]').forEach(b => b.onclick = async () => { D.project.removeCharacter(state.project, b.dataset.cid); await save(); render(); });
    v.querySelectorAll('[data-act="charref"]').forEach(b => b.onclick = () => pickCharRef(b.dataset.cid));
    v.querySelectorAll('[data-act="charsheet"]').forEach(b => b.onclick = () => genSheet(b.dataset.cid));
    D.ui.bindLib(v, state.project, { prefix: "dw", onChange: async () => { await save(); render(); } });

    D.ui.bindCompliance(v, state.project, {
      prefix: "dw",
      onChange: async () => { await save(); render(); },
      onCheck: () => checkCompliance()
    });
  }

  D.manual = { render, load, state };
})();
