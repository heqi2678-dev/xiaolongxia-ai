/* 铜龙电商 · AI 短剧工作台 · 导演台「逐镜工坊」 */
/* 三区创作台：左分镜列表 / 中竖屏预览 / 右镜属性与模型，底部三轨时间轴。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;
  const FPS = 30;

  const state = { pid: "", project: null, busy: false, lastComposed: null, cur: "", time: 0, playing: false, mode: "board" };

  let rafId = null;
  let lastTs = 0;
  let trackAudio = null;
  let trackSrc = "";
  let audition = null;

  function view() { return document.getElementById("dwManual"); }

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
    state.cur = (state.project.shots[0] || {}).id || "";
    state.time = 0;
    state.playing = false;
    return state.project;
  }

  function normalize(p) {
    if (!p) return p;
    D.project.migrate(p);
    return p;
  }

  let saveTimer = null;
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
    const el = document.getElementById("dwStatus");
    if (!el) return;
    el.innerHTML = text ? '<div class="dw-card" style="border-color:' + (type === "err" ? "var(--red)" : type === "ok" ? "#2b5a3a" : "var(--border)") + '">' + D.ui.esc(text) + "</div>" : "";
  }

  function shotById(sid) { return (state.project.shots || []).find(s => s.id === sid) || null; }
  function curShot() { return shotById(state.cur) || state.project.shots[0] || null; }
  function segOf() { return D.timeline.shotAt(state.project, state.time); }
  function realistic() { return D.engine.isRealistic(state.project); }

  /* 整段模式下，段素材里本镜的起始时间，用于把全局时间换算成视频内时间 */
  function takeBase(shot) {
    const p = state.project;
    if (!p || p.shotMode !== "take" || !shot) return 0;
    const s = D.takes.segmentOf(p, shot.id);
    return s ? s.start : 0;
  }

  /* ============ 渲染骨架 ============ */
  async function render() {
    D.ui.ensureCss();
    const v = view();
    if (!v) return;
    if (!state.project || !D.project.get(state.pid)) await load();
    const p = state.project;
    const list = D.project.list();

    v.innerHTML = '<div class="dw-wrap">' +
      '<div class="dw-bar">' +
        '<select class="inp" id="dwProjSel" style="width:auto;min-width:160px">' + list.map(x => '<option value="' + x.id + '"' + (x.id === p.id ? " selected" : "") + ">" + D.ui.esc(x.title) + "</option>").join("") + "</select>" +
        '<button class="btn small" id="dwGoHome">项目中心</button>' +
        '<button class="btn small" id="dwNew">新建工程</button>' +
        '<button class="btn small" id="dwSave">保存草稿</button>' +
        '<button class="btn small" id="dwPush">上传云端</button>' +
        '<button class="btn small" id="dwPull">云端同步</button>' +
        '<button class="btn small ghost" id="dwGuide">看教程</button>' +
        '<button class="btn small ghost" id="dwMakeupBtn">造型室</button>' +
        '<button class="btn small ghost" id="dwModeBoard">故事板</button>' +
        '<button class="btn small ghost" id="dwModeNode">节点画布</button>' +
        '<button class="btn small ghost" id="dwPanelRail">分镜</button>' +
        '<button class="btn small ghost" id="dwPanelInsp">属性</button>' +
      "</div>" +
      '<div id="dwCanvasPanel" style="display:none"></div>' +
      '<div class="dw-console" id="dwConsole">' +
        '<div class="dw-rail" id="dwRail"></div>' +
        '<div class="dw-stage" id="dwStage"></div>' +
        '<div class="dw-inspector" id="dwInspector"></div>' +
      "</div>" +
      '<div id="dwTimeline"></div>' +
      '<div class="dw-card"><h3>作品信息与剧本</h3>' + infoFields(p) + "</div>" +
      '<div class="dw-card"><h3>配乐与字幕</h3>' + mediaFields(p) + "</div>" +
      charCard(p) +
      D.ui.complianceCard(p, { prefix: "dw" }) +
      '<div class="dw-card"><h3>合成与导出</h3>' +
        '<div class="dw-bar">' +
          '<button class="btn primary" id="dwCompose">浏览器合成成片</button>' +
          '<button class="btn" id="dwComposeServer">服务端合成（需公网素材）</button>' +
          '<button class="btn" id="dwExport">导出素材包（剪映二次剪辑）</button>' +
          '<button class="btn" id="dwCheck">合规检查</button>' +
        "</div>" +
        '<div class="dw-hint" style="margin-top:8px">浏览器合成实时录制，约等于成片时长，运镜、BGM、字幕样式都在这条生效；服务端合成更快但要求素材是公网地址，只做快速拼接，不含运镜、BGM 与字幕样式。</div>' +
        '<div id="dwComposeOut" style="margin-top:10px"></div>' +
      "</div>" +
      '<div id="dwStatus"></div>' +
    "</div>";

    paintAll();
    bind(p);
    applyMode();
  }

  /* 故事板 / 节点画布（LibTV 双视图）切换 */
  function applyMode() {
    const v = view();
    if (!v) return;
    const node = state.mode === "node";
    const consoleEl = v.querySelector("#dwConsole");
    const tl = v.querySelector("#dwTimeline");
    const panel = v.querySelector("#dwCanvasPanel");
    const b = v.querySelector("#dwModeBoard");
    const nb = v.querySelector("#dwModeNode");
    if (consoleEl) consoleEl.style.display = node ? "none" : "";
    if (tl) tl.style.display = node ? "none" : "";
    if (panel) panel.style.display = node ? "" : "none";
    if (b) b.className = "btn small " + (node ? "ghost" : "primary");
    if (nb) nb.className = "btn small " + (node ? "primary" : "ghost");
    if (node && panel && D.canvas && D.canvas.mount) {
      D.canvas.mount(panel, state.project, { onChange: () => saveSoon(400) });
    }
  }

  function infoFields(p) {
    return '<div class="dw-grid">' +
      '<div><label class="label" style="margin-top:0">标题</label><input class="inp" id="dwTitle" value="' + D.ui.esc(p.title) + '"></div>' +
      '<div><label class="label" style="margin-top:0">剧种</label><select class="inp" id="dwGenre">' + D.ui.opts(D.GENRES, p.genre) + "</select></div>" +
      '<div><label class="label" style="margin-top:0">画风</label><select class="inp" id="dwStyle">' + D.ui.opts(D.STYLES, p.style) + "</select></div>" +
      '<div><label class="label" style="margin-top:0">画幅</label><select class="inp" id="dwRatio">' + D.ui.opts(D.RATIOS, p.output.ratio) + "</select></div>" +
      (realistic() ? '<div><label class="label" style="margin-top:0">生成模式</label><select class="inp" id="dwShotMode">' + D.ui.opts([{ id: "shot", name: "逐镜生成" }, { id: "take", name: "整段生成" }], p.shotMode) + "</select></div>" : "") +
      (realistic() && p.shotMode === "take" ? '<div><label class="label" style="margin-top:0">每段目标时长</label><input class="inp" id="dwTakeTarget" type="number" min="4" max="30" value="' + p.takeTarget + '"></div>' : "") +
      "</div>" +
      '<div class="dw-hint" style="margin-top:8px">' + (p.genre === "realistic" ? (p.shotMode === "take" ? "整段生成：把若干连续分镜合成一次请求，一镜到底更连贯，单段上限 " + D.takes.MAX_SECONDS + " 秒。" : "仿真人剧：逐镜生成视频 + 口型同步，成本较高。") : "漫剧：逐镜生图 + 微动效 + 配音字幕，成本低产能高。") + "</div>" +
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
      '<div class="dw-hint" style="margin-top:8px">BGM 在合成时循环垫底；字幕按每镜台词烧录并按上面的颜色描边。两者都只在浏览器合成时生效（运镜同理），服务端合成只做快速拼接。精修（转场、特效、多轨）请在导出素材包后用剪映处理。</div>';
  }

  function paintAll() {
    paintRail();
    paintStage();
    paintInspector();
    paintTimeline();
  }

  /* ============ 左：分镜列表 ============ */
  function paintRail() {
    const el = document.getElementById("dwRail");
    if (!el) return;
    const p = state.project;
    if (p.shotMode === "take" && realistic()) {
      el.innerHTML = (p.takes || []).map(takeGroup).join("") +
        '<button class="btn small" data-railadd="1" style="margin-top:2px">＋ 加一镜</button>';
      el.querySelectorAll("[data-takegen]").forEach(b => { b.onclick = (e) => { e.stopPropagation(); doGenTake(b.dataset.takegen); }; });
    } else {
      el.innerHTML = (p.shots || []).map(s => D.ui.railItem(s, state.cur)).join("") +
        '<button class="btn small" data-railadd="1" style="margin-top:2px">＋ 加一镜</button>';
    }
    el.querySelectorAll("[data-rail]").forEach(x => { x.onclick = () => selectShot(x.dataset.rail); });
    const add = el.querySelector("[data-railadd]");
    if (add) add.onclick = async () => { const s = D.project.addShot(p); await save(); D.takes.sync(p); state.cur = s.id; await save(); paintAll(); };
  }

  /* 只切换选中态，不重建分镜列表（切镜时用） */
  function paintRailActive() {
    const el = document.getElementById("dwRail");
    if (!el) return;
    el.querySelectorAll("[data-rail]").forEach(x => x.classList.toggle("on", x.dataset.rail === state.cur));
    const curTake = (D.takes && D.takes.takeOf) ? D.takes.takeOf(state.project, state.cur) : null;
    el.querySelectorAll(".dw-take[data-take]").forEach(g => g.classList.toggle("on", !!curTake && g.dataset.take === curTake.id));
  }

  function takeGroup(t) {
    const over = Number(t.duration) > D.takes.MAX_SECONDS;
    const head = "段 " + t.seq + " · " + t.duration + " 秒" + (over ? " · 超出上限" : "") + (t.dirty ? " · 需重绘" : "");
    return '<div class="dw-take ' + (t.status || "pending") + (D.takes.takeOf(state.project, state.cur) === t ? " on" : "") + '" data-take="' + D.ui.esc(t.id) + '">' +
      '<div class="dw-take-head"><b>' + D.ui.esc(head) + "</b>" + D.ui.statusBadge(t) + "</div>" +
      '<div class="dw-take-shots">' + (t.shotIds || []).map(shotById).filter(Boolean).map(s => D.ui.railItem(s, state.cur)).join("") + "</div>" +
      (over
        ? '<div class="dw-hint" style="color:var(--warn)">超过单段上限 ' + D.takes.MAX_SECONDS + " 秒，请拆分为多镜或缩短时长</div>"
        : '<button class="btn small primary" data-takegen="' + t.id + '">' + (t.videoUrl ? "整段重绘" : "生成本段") + "</button>") +
      (t.status === "failed" ? '<div class="dw-hint" style="color:var(--red)">' + D.ui.esc(t.error || "生成失败") + "</div>" : "") +
      (t.status === "done" && t.notice ? '<div class="dw-hint" style="color:var(--warn)">' + D.ui.esc(t.notice) + "</div>" : "") +
      "</div>";
  }

  /* ============ 中：预览与播放 ============ */
  /* 预览舞台的 <video>/<img> 只创建一次，切镜时改 src 复用，避免每次重绘重新拉流。 */
  let stageVideoEl = null;
  let stageImgEl = null;
  let stageEmptyEl = null;
  let stageVideoSrc = "";
  let preloadEl = null;
  let preloadSrc = "";

  function stageVideo() { return stageVideoEl && stageVideoEl.parentNode ? stageVideoEl : null; }

  function ensureMediaEls() {
    if (stageVideoEl) return;
    stageVideoEl = document.createElement("video");
    stageVideoEl.id = "dwStageVideo";
    stageVideoEl.setAttribute("playsinline", "");
    stageVideoEl.preload = "auto";
    stageVideoEl.onended = () => { if (state.playing) nextShot(true); };
    stageImgEl = document.createElement("img");
    stageImgEl.alt = "";
    stageEmptyEl = document.createElement("div");
    stageEmptyEl.className = "dw-stage-empty";
  }

  function buildStage(el) {
    el.innerHTML =
      '<div class="dw-stage-canvas"><span class="dw-stage-tip"></span></div>' +
      '<div class="dw-stage-ctrl">' +
        '<button class="btn small" id="dwPrev" title="上一镜">⏮</button>' +
        '<button class="btn small" id="dwFrameBack" title="后退一帧">⏪</button>' +
        '<button class="btn small primary" id="dwPlay">▶ 播放</button>' +
        '<button class="btn small" id="dwFrameFwd" title="前进一帧">⏩</button>' +
        '<button class="btn small" id="dwNext" title="下一镜">⏭</button>' +
        '<span class="dw-stage-time" id="dwTime"></span>' +
      "</div>" +
      '<div class="dw-stage-failed dw-hint" style="color:var(--red);display:none"></div>' +
      '<div class="dw-stage-hint dw-hint" id="dwStageHint"></div>';
    el.querySelector("#dwPrev").onclick = () => stepShot(-1);
    el.querySelector("#dwNext").onclick = () => stepShot(1);
    el.querySelector("#dwPlay").onclick = () => { state.playing ? pause() : play(); paintStage(); };
    el.querySelector("#dwFrameBack").onclick = () => seekBy(-1);
    el.querySelector("#dwFrameFwd").onclick = () => seekBy(1);
  }

  function paintStage() {
    const el = document.getElementById("dwStage");
    if (!el) return;
    const p = state.project;
    const shot = curShot();
    const seg = segOf();
    const video = shot && (shot.lipsyncUrl || shot.videoUrl);
    const img = shot && shot.imageUrl;
    const total = D.timeline.total(p);

    if (!el.querySelector(".dw-stage-canvas")) buildStage(el);
    ensureMediaEls();
    const box = el.querySelector(".dw-stage-canvas");
    const tip = el.querySelector(".dw-stage-tip");

    if (video) {
      if (stageImgEl.parentNode === box) box.removeChild(stageImgEl);
      if (stageEmptyEl.parentNode === box) box.removeChild(stageEmptyEl);
      if (stageVideoEl.parentNode !== box) box.insertBefore(stageVideoEl, tip);
      const poster = img || "";
      if (stageVideoSrc !== video) {
        stageVideoSrc = video;
        stageVideoEl.setAttribute("poster", poster);
        stageVideoEl.src = video;
      } else if ((stageVideoEl.getAttribute("poster") || "") !== poster) {
        stageVideoEl.setAttribute("poster", poster);
      }
      const off = Math.max(0, state.time - (seg ? seg.start : 0)) + takeBase(shot);
      if (off > 0.05) {
        const seek = () => { try { stageVideoEl.currentTime = off; } catch (e) {} };
        if (stageVideoEl.readyState >= 1) seek();
        else stageVideoEl.addEventListener("loadedmetadata", seek, { once: true });
      }
    } else if (img) {
      if (stageVideoEl.parentNode === box) box.removeChild(stageVideoEl);
      if (stageEmptyEl.parentNode === box) box.removeChild(stageEmptyEl);
      if (stageImgEl.parentNode !== box) box.insertBefore(stageImgEl, tip);
      if (stageImgEl.getAttribute("src") !== img) stageImgEl.setAttribute("src", img);
    } else {
      if (stageVideoEl.parentNode === box) box.removeChild(stageVideoEl);
      if (stageImgEl.parentNode === box) box.removeChild(stageImgEl);
      if (stageEmptyEl.parentNode !== box) box.insertBefore(stageEmptyEl, tip);
      stageEmptyEl.innerHTML = "还没有画面<br>点下面「" + (realistic() ? "生成视频" : "生成画面") + "」出这一镜";
    }

    if (tip) tip.textContent = "第 " + ((shot && shot.seq) || "-") + " 镜 · " + (shot ? (shot.name || "") : "");
    const playBtn = el.querySelector("#dwPlay");
    if (playBtn) playBtn.textContent = state.playing ? "⏸ 暂停" : "▶ 播放";
    const tEl = el.querySelector("#dwTime");
    if (tEl) tEl.textContent = D.timeline.fmt(state.time) + " / " + D.timeline.fmt(total);
    const failed = el.querySelector(".dw-stage-failed");
    if (failed) {
      const on = !!(shot && shot.status === "failed");
      failed.style.display = on ? "" : "none";
      failed.textContent = on ? (shot.error || "生成失败") : "";
    }
    const hint = el.querySelector("#dwStageHint");
    if (hint) hint.textContent = seg ? "本镜占用 " + seg.start.toFixed(1) + "s – " + seg.end.toFixed(1) + "s" : "";

    preloadNext();
  }

  /* 预载下一镜/下一段的视频，切镜时首帧更快 */
  function nextMediaUrl() {
    const p = state.project;
    const shots = p.shots || [];
    const i = shots.findIndex(s => s.id === (curShot() || {}).id);
    const nx = shots[i + 1];
    if (!nx) return "";
    if (p.shotMode === "take" && realistic() && D.takes.takeOf) {
      const t = D.takes.takeOf(p, nx.id);
      const cur = D.takes.takeOf(p, (curShot() || {}).id);
      return (t && t.videoUrl && (!cur || cur.id !== t.id)) ? t.videoUrl : "";
    }
    return nx.lipsyncUrl || nx.videoUrl || "";
  }

  function preloadNext() {
    const url = nextMediaUrl();
    if (!url || !stageVideoEl) return;
    if (!preloadEl) {
      preloadEl = document.createElement("video");
      preloadEl.id = "dwPreload";
      preloadEl.muted = true;
      preloadEl.preload = "auto";
      preloadEl.style.display = "none";
      document.body.appendChild(preloadEl);
    }
    if (preloadSrc !== url) { preloadSrc = url; preloadEl.src = url; }
  }

  function stepShot(dir) {
    const p = state.project;
    const shots = p.shots || [];
    let i = shots.findIndex(s => s.id === (curShot() || {}).id);
    const j = i + dir;
    if (j < 0 || j >= shots.length) return;
    selectShot(shots[j].id, { keepPlaying: state.playing });
  }

  function nextShot(keep) {
    const p = state.project;
    const shots = p.shots || [];
    const i = shots.findIndex(s => s.id === (curShot() || {}).id);
    const next = shots[i + 1];
    if (!next) { pause(); state.time = D.timeline.total(p); paintStage(); return; }
    selectShot(next.id, { keepPlaying: keep });
  }

  function selectShot(sid, o) {
    o = o || {};
    const seg = (D.timeline.layout(state.project) || []).find(x => x.sid === sid);
    state.cur = sid;
    if (seg) state.time = seg.start;
    const keep = !!o.keepPlaying;
    if (!keep) pause();
    stopAudition();
    paintRailActive();
    paintStage();
    paintInspector();
    paintTimelineActive();
    paintPlayhead();
    if (keep) {
      const v = stageVideo();
      if (v) {
        try { v.currentTime = 0; } catch (e) {}
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => {});
      }
      syncTrack(true);
      lastTs = 0;
      if (!rafId) rafId = requestAnimationFrame(tick);
    }
  }

  function seekTo(t, light) {
    const p = state.project;
    const total = D.timeline.total(p);
    state.time = Math.max(0, Math.min(total, t));
    const seg = D.timeline.shotAt(p, state.time);
    if (seg && seg.sid !== state.cur) {
      state.cur = seg.sid;
      paintRailActive(); paintInspector(); paintStage(); paintTimelineActive();
    }
    if (!light) {
      const v = stageVideo();
      if (v && seg) { try { v.currentTime = Math.max(0, state.time - seg.start) + takeBase(curShot()); } catch (e) {} }
      seekTrack();
      paintTimelineActive();
      paintPlayhead();
    } else {
      paintPlayhead();
    }
    const tEl = document.getElementById("dwTime");
    if (tEl) tEl.textContent = D.timeline.fmt(state.time) + " / " + D.timeline.fmt(total);
  }

  function seekBy(frames) {
    pause();
    seekTo(D.timeline.frameStep(state.time, frames, FPS));
    const tEl = document.getElementById("dwTime");
    if (tEl) tEl.textContent = D.timeline.fmt(state.time) + " / " + D.timeline.fmt(D.timeline.total(state.project));
    paintStage();
  }

  function play() {
    if (state.playing) return;
    const total = D.timeline.total(state.project);
    if (state.time >= total - 1e-3) state.time = 0;
    state.playing = true;
    lastTs = 0;
    const v = stageVideo();
    if (v) { v.play().catch(() => {}); }
    syncTrack(true);
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    state.playing = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    const v = stageVideo();
    if (v) { try { v.pause(); } catch (e) {} }
    pauseTrack();
  }

  /* 时间轴播放时同步当前镜的配音：切镜换源，按片段时间对轴。 */
  function syncTrack(playing) {
    const shot = curShot();
    if (!shot || !shot.audioUrl) { pauseTrack(); return; }
    const seg = segOf();
    if (!trackAudio) trackAudio = new Audio();
    if (trackSrc !== shot.audioUrl) {
      trackSrc = shot.audioUrl;
      trackAudio.src = shot.audioUrl;
    }
    const off = Math.max(0, state.time - (seg ? seg.start : 0));
    const setOff = () => { try { trackAudio.currentTime = off; } catch (e) {} };
    if (trackAudio.readyState >= 1) setOff();
    else if (typeof trackAudio.addEventListener === "function") trackAudio.addEventListener("loadedmetadata", setOff, { once: true });
    const pr = trackAudio.play();
    if (pr && pr.catch) pr.catch(() => {});
  }

  function pauseTrack() {
    if (trackAudio) { try { trackAudio.pause(); } catch (e) {} }
  }

  function seekTrack() {
    const shot = curShot();
    if (!trackAudio || !shot || !shot.audioUrl || trackSrc !== shot.audioUrl) return;
    const seg = segOf();
    try { trackAudio.currentTime = Math.max(0, state.time - (seg ? seg.start : 0)); } catch (e) {}
  }

  function stopAudition() {
    if (audition) { try { audition.pause(); } catch (e) {} audition = null; }
  }

  function doAudition(sid) {
    const shot = shotById(sid);
    stopAudition();
    if (!shot || !shot.audioUrl) { U.toast("这一镜还没配音，先点「配音」", "warn"); return; }
    const a = new Audio(shot.audioUrl);
    audition = a;
    a.onended = () => { if (audition === a) audition = null; };
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => U.toast("浏览器拦了自动播放，请再点一次「试听」", "warn"));
  }

  function tick(ts) {
    if (!state.playing) return;
    const p = state.project;
    const total = D.timeline.total(p);
    const seg = segOf();
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    const v = stageVideo();
    if (v && !isNaN(v.duration) && v.duration > 0) {
      const local = Math.max(0, (v.currentTime || 0) - takeBase(curShot()));
      state.time = (seg ? seg.start : 0) + Math.min(local, seg ? seg.duration : v.duration);
    } else {
      state.time += dt;
    }
    if (state.time >= total - 1e-3) { state.time = total; pause(); paintStage(); return; }
    if (seg && state.time >= seg.end - 1e-3) {
      const segs = D.timeline.layout(p);
      const i = segs.findIndex(x => x.sid === seg.sid);
      const nx = segs[i + 1];
      if (nx) { selectShot(nx.sid, { keepPlaying: true }); return; }
    }
    seekTo(state.time, true);
    rafId = requestAnimationFrame(tick);
  }

  /* ============ 右：当前镜属性与模型 ============ */
  function paintInspector() {
    const el = document.getElementById("dwInspector");
    if (!el) return;
    const p = state.project;
    const shot = curShot();
    if (!shot) { el.innerHTML = '<div class="dw-card"><div class="dw-empty">还没有分镜</div></div>'; return; }
    const rl = realistic();
    const take = (rl && p.shotMode === "take") ? D.takes.takeOf(p, shot.id) : null;
    const durList = take ? D.takes.durationList(shot.duration) : D.DURATIONS;
    const tr = D.project.trimOf(shot);
    const footage = Number(shot.duration) > 0 ? Number(shot.duration) : 0;
    const trimIn = tr.on ? tr.in : 0;
    const trimOut = tr.on ? tr.out : footage;
    el.innerHTML =
      '<div class="dw-card"><h3>第 ' + shot.seq + ' 镜 ' + (take ? '<span class="dw-hint">段 ' + take.seq + "</span> " : "") + '<span data-status="' + shot.id + '">' + D.ui.statusBadge(take || shot) + "</span></h3>" +
        '<label class="label" style="margin-top:0">分镜名</label><input class="inp" data-if="name" value="' + D.ui.esc(shot.name || "") + '">' +
        '<label class="label">画面提示词</label><textarea class="inp" style="min-height:66px;font-size:12px" data-if="prompt">' + D.ui.esc(shot.prompt) + "</textarea>" +
        '<label class="label">台词（留空则无配音）</label><textarea class="inp" style="min-height:50px;font-size:12px" data-if="line">' + D.ui.esc(shot.line) + "</textarea>" +
        '<div class="dw-grid" style="margin-top:8px">' +
          '<div><label class="label" style="margin-top:0">运镜</label><select class="inp" data-if="motion">' + D.ui.opts(D.MOTIONS, shot.motion) + "</select></div>" +
          '<div><label class="label" style="margin-top:0">时长</label><select class="inp" data-if="duration">' + D.ui.opts(durList.map(d => ({ id: d, name: d + " 秒" })), shot.duration) + "</select></div>" +
        "</div>" +
        (footage
          ? '<div class="dw-grid" style="margin-top:8px">' +
              '<div><label class="label" style="margin-top:0">入点（秒）</label><input class="inp" type="number" min="0" step="0.1" data-trim="in" value="' + trimIn + '"></div>' +
              '<div><label class="label" style="margin-top:0">出点（秒）</label><input class="inp" type="number" min="0" step="0.1" data-trim="out" value="' + trimOut + '"></div>' +
            "</div>" +
            '<div class="dw-bar">' +
              (tr.on ? '<button class="btn small ghost" data-trimclear>清除裁剪</button>' : "") +
              '<span class="dw-hint">原片 ' + footage + " 秒，实际用 " + D.project.effDuration(shot).toFixed(1) + " 秒，裁剪不重跑模型</span>" +
            "</div>"
          : '<div class="dw-hint">生成后可用入点/出点裁剪片段，不重跑模型</div>') +
        (take ? '<div class="dw-hint">本段共 ' + take.shotIds.length + " 镜，合计 " + take.duration + " 秒" + (take.dirty ? "，已改动需重绘" : "") + "</div>" : "") +
        roleChips(p, shot) +
        (take ? '<label class="label">局段重绘要求</label><input class="inp" data-takeedit placeholder="例如：把外套换成红色，其余保持不变">' : "") +
        '<div class="dw-shot-actions">' +
          '<button class="btn small primary" data-iact="gen">' + (take ? "生成本段" : rl ? "生成视频" : "生成画面") + "</button>" +
          (take ? '<button class="btn small" data-iact="takeedit">局段重绘</button>' : "") +
          (rl && !take ? '<button class="btn small" data-iact="lipsync">只做口型</button>' : "") +
          '<button class="btn small" data-iact="tts">配音</button>' +
          (shot.audioUrl ? '<button class="btn small" data-iact="audition">试听</button>' : "") +
          '<button class="btn small" data-iact="upload">换封面图</button>' +
          '<button class="btn small ghost" data-iact="move" data-dir="-1">上移</button>' +
          '<button class="btn small ghost" data-iact="move" data-dir="1">下移</button>' +
          '<button class="btn small ghost" data-iact="dup">复制本镜</button>' +
          '<button class="btn small ghost danger" data-iact="remove">删除</button>' +
        "</div>" +
        '<div class="dw-progress" data-prog="' + shot.id + '"></div>' +
      "</div>" +
      '<div class="dw-card"><h3>模型</h3>' +
        D.ui.modelBar(rl ? "video" : "image") +
        D.ui.modelBar("tts") +
        (rl ? D.ui.modelBar("lipsync") : "") +
      "</div>" +
      '<div class="dw-card"><h3>批量</h3>' +
        '<div class="dw-bar">' +
          '<button class="btn small primary" id="dwGenMissing">' + (take ? "生成所有未完成段" : "生成所有未完成镜") + "</button>" +
          '<button class="btn small" id="dwTtsAll">补全部配音</button>' +
          '<button class="btn small ghost danger" id="dwStopAll">全部停止</button>' +
        "</div>" +
      "</div>";
    bindInspector(el);
  }

  function roleChips(project, shot) {
    if (!(project.characters || []).length) return "";
    return '<label class="label">出场角色</label><div class="dw-role-chips">' + project.characters.map(c =>
      '<span class="dw-chip' + ((shot.roleIds || []).indexOf(c.id) >= 0 ? " on" : "") + '" data-irole="' + c.id + '">' + D.ui.esc(c.name) + "</span>"
    ).join("") + "</div>";
  }

  function bindInspector(el) {
    const shot = curShot();
    const takeMode = state.project.shotMode === "take" && realistic();
    const take = takeMode ? D.takes.takeOf(state.project, shot.id) : null;
    el.querySelectorAll("[data-if]").forEach(inp => {
      const f = inp.dataset.if;
      if (inp.tagName === "TEXTAREA" || (inp.tagName === "INPUT" && inp.type !== "number")) {
        inp.oninput = () => {
          shot[f] = inp.value;
          if (takeMode && f === "prompt") D.takes.markDirty(state.project, shot.id);
          saveSoon(500);
        };
      }
      inp.onchange = async () => {
        shot[f] = f === "duration" ? Number(inp.value) : inp.value;
        if (takeMode && (f === "prompt" || f === "duration")) D.takes.markDirty(state.project, shot.id);
        await save();
        if (takeMode && f === "duration") { D.takes.sync(state.project); await save(); paintAll(); return; }
        if (f === "name") paintRail();
        if (f === "duration") { paintRail(); paintTimeline(); paintInspector(); }
      };
    });
    el.querySelectorAll("[data-trim]").forEach(inp => {
      inp.onchange = async () => {
        const cur = D.project.trimOf(shot);
        const dur = Number(shot.duration) > 0 ? Number(shot.duration) : 0;
        let a = cur.on ? cur.in : 0;
        let b = cur.on ? cur.out : dur;
        const v = Number(inp.value);
        if (isFinite(v)) { if (inp.dataset.trim === "in") a = v; else b = v; }
        shot.trimIn = a;
        shot.trimOut = b;
        D.project.migrate(state.project);
        await save();
        paintAll();
      };
    });
    const trimClear = el.querySelector("[data-trimclear]");
    if (trimClear) trimClear.onclick = async () => {
      shot.trimIn = 0;
      shot.trimOut = 0;
      await save();
      paintAll();
    };
    el.querySelectorAll("[data-irole]").forEach(c => {
      c.onclick = async () => {
        const cid = c.dataset.irole;
        shot.roleIds = shot.roleIds || [];
        const i = shot.roleIds.indexOf(cid);
        if (i >= 0) shot.roleIds.splice(i, 1); else shot.roleIds.push(cid);
        c.classList.toggle("on");
        if (takeMode) D.takes.markDirty(state.project, shot.id);
        await save();
      };
    });
    const act = (name, fn) => { const b = el.querySelector('[data-iact="' + name + '"]'); if (b) b.onclick = fn; };
    act("gen", () => (take ? doGenTake(take.id) : doGen(shot.id)));
    act("takeedit", () => {
      const inp = el.querySelector("[data-takeedit]");
      doTakeEdit(take ? take.id : "", inp ? inp.value : "");
    });
    act("tts", () => doTts(shot.id));
    act("audition", () => doAudition(shot.id));
    act("lipsync", () => doLipsync(shot.id));
    act("upload", () => pickCover(shot.id));
    act("dup", async () => {
      const copy = JSON.parse(JSON.stringify(shot));
      copy.id = D.project.id("s");
      const i = state.project.shots.findIndex(s => s.id === shot.id);
      state.project.shots.splice(i + 1, 0, copy);
      D.project.renumber(state.project);
      await save();
      state.cur = copy.id;
      paintAll();
      U.toast("已复制本镜", "ok");
    });
    act("remove", async () => {
      D.project.removeShot(state.project, shot.id);
      await save();
      state.cur = (state.project.shots[0] || {}).id || "";
      paintAll();
    });
    el.querySelectorAll('[data-iact="move"]').forEach(b => {
      b.onclick = async () => { D.project.moveShot(state.project, shot.id, Number(b.dataset.dir)); await save(); paintAll(); };
    });
    D.models.bind(el, { onChange: async () => { paintInspector(); } });
  }

  /* ============ 底：三轨时间轴 ============ */
  function paintTimeline() {
    const el = document.getElementById("dwTimeline");
    if (!el) return;
    el.innerHTML = D.timeline.render(state.project, { currentShotId: state.cur });
    D.timeline.bind(el, state.project, {
      onSeek: (sid, t) => { pause(); state.cur = sid; seekTo(t); paintRailActive(); paintStage(); paintInspector(); },
      onSelect: (sid) => { if (sid !== state.cur) { state.cur = sid; paintRailActive(); paintStage(); paintInspector(); paintTimelineActive(); } }
    });
    paintPlayhead();
  }

  /* 只切换时间轴选中态，不重建轨道（切镜/播放时用） */
  function paintTimelineActive() {
    const el = document.getElementById("dwTimeline");
    if (!el) return;
    el.querySelectorAll(".dw-clip[data-sid]").forEach(c => c.classList.toggle("on", c.dataset.sid === state.cur));
  }

  function paintPlayhead() {
    const hull = document.querySelector("#dwTimeline .dw-timeline");
    if (!hull) return;
    const total = D.timeline.total(state.project) || 1;
    let ph = hull.querySelector(".dw-playhead");
    if (!ph) {
      ph = document.createElement("div");
      ph.className = "dw-playhead";
      hull.appendChild(ph);
    }
    ph.style.left = Math.max(0, Math.min(100, (state.time / total) * 100)).toFixed(3) + "%";
  }

  /* ============ 编辑与生成动作 ============ */
  const doGen = async (sid) => {
    const p = state.project;
    try {
      D.ui.progress(sid, "正在提交生成任务…");
      const shot = await D.engine.generateShot(p, sid, {
        onProgress: (st) => D.ui.progress(sid, st && st.status === "done" ? "完成" : "生成中…")
      });
      await save();
      D.ui.progress(sid, "");
      paintAll();
      U.toast("第 " + shot.seq + " 镜生成完成", "ok");
    } catch (e) {
      D.ui.progress(sid, "");
      paintAll();
      U.toast((e && e.message) || "生成失败", "err");
    }
  };

  const doGenTake = async (tid) => {
    const p = state.project;
    const take = (p.takes || []).find(x => x.id === tid);
    const firstSid = take && take.shotIds[0];
    try {
      D.ui.progress(firstSid, "正在提交整段生成任务…");
      const done = await D.engine.generateTake(p, tid, {
        onProgress: (st) => D.ui.progress(firstSid, st && st.status === "done" ? "完成" : "整段生成中…")
      });
      await save();
      D.ui.progress(firstSid, "");
      paintAll();
      U.toast("第 " + done.seq + " 段生成完成", "ok");
    } catch (e) {
      D.ui.progress(firstSid, "");
      paintAll();
      U.toast((e && e.message) || "整段生成失败", "err");
    }
  };

  const doTakeEdit = async (tid, instruction) => {
    const p = state.project;
    const take = (p.takes || []).find(x => x.id === tid);
    if (!take) return;
    const firstSid = take.shotIds[0];
    if (!instruction || !instruction.trim()) { U.toast("请先填写局段重绘要求", "warn"); return; }
    try {
      D.ui.progress(firstSid, "正在提交局段重绘任务…");
      await D.engine.editTake(p, tid, instruction, {
        onProgress: (st) => D.ui.progress(firstSid, st && st.status === "done" ? "完成" : "局段重绘中…")
      });
      await save();
      D.ui.progress(firstSid, "");
      paintAll();
      U.toast("第 " + take.seq + " 段已重绘", "ok");
    } catch (e) {
      D.ui.progress(firstSid, "");
      paintAll();
      U.toast((e && e.message) || "局段重绘失败", "err");
    }
  };

  const doTts = async (sid) => {
    const p = state.project;
    const shot = shotById(sid);
    if (!shot) return;
    if (!shot.line) { U.toast("这一镜没有台词", "warn"); return; }
    try {
      D.ui.progress(sid, "正在合成配音…");
      await D.engine.synthShot(p, shot);
      if (realistic() && shot.videoUrl) await D.engine.lipsyncShot(p, shot);
      await save();
      D.ui.progress(sid, "");
      paintAll();
      U.toast("配音完成（" + Math.round(shot.audioDuration || 0) + " 秒）", "ok");
    } catch (e) {
      D.ui.progress(sid, "");
      U.toast((e && e.message) || "配音失败", "err");
    }
  };

  const doLipsync = async (sid) => {
    const p = state.project;
    const shot = shotById(sid);
    if (!shot) return;
    if (!shot.videoUrl || !shot.audioUrl) { U.toast("需要先生成视频和配音", "warn"); return; }
    try {
      D.ui.progress(sid, "正在做口型…");
      await D.engine.lipsyncShot(p, shot);
      await save();
      D.ui.progress(sid, "");
      paintAll();
      U.toast("口型完成", "ok");
    } catch (e) {
      D.ui.progress(sid, "");
      U.toast((e && e.message) || "口型失败", "err");
    }
  };

  function pickCover(sid) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const guard = await D.compliance.guardUpload(f, "reference");
      if (!guard.ok) { U.toast(guard.reason, "err"); return; }
      if (guard.warn) U.toast(guard.warn, "warn");
      const url = await D.adapterUtil.fileToDataUrl(f);
      const shot = shotById(sid);
      if (!shot) return;
      shot.imageUrl = url;
      shot.firstFrame = url;
      await save();
      paintAll();
      U.toast("封面已替换", "ok");
    };
    input.click();
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
      if (r.affected) {
        setStatus("定妆图已加入参考图，" + r.affected + " 个相关分镜已标记「需重绘」。", "ok");
        U.toast("定妆图已生成，相关分镜请重绘", "ok");
      } else {
        setStatus("定妆图已生成，已加入参考图。", "ok");
        U.toast("定妆图已生成", "ok");
      }
    } catch (e) {
      setStatus((e && e.message) || "定妆图生成失败", "err");
    } finally {
      state.busy = false;
    }
  }

  function needsGen(s) {
    if (realistic()) return !s.videoUrl || s.status !== "done";
    return !s.imageUrl || s.status !== "done";
  }

  async function genMissing() {
    const p = state.project;
    if (p.shotMode === "take" && realistic()) return genMissingTakes();
    const ids = (p.shots || []).filter(needsGen).map(s => s.id);
    if (!ids.length) { U.toast("所有分镜都已完成", "ok"); return; }
    if (!D.isConfigured(realistic() ? "video" : "image")) {
      U.toast("还没配置生成服务，请到「设置 → 短剧服务」填写", "err");
      return;
    }
    if (state.busy) { U.toast("正在生成，请等待当前任务结束", "warn"); return; }
    state.busy = true;
    setStatus("正在生成 " + ids.length + " 个分镜，请保持页面打开…", "");
    try {
      const r = await D.engine.generateMany(p, ids, {
        concurrency: 2,
        onEach: (done, total) => setStatus("生成进度 " + done + "/" + total + "…", ""),
        onProgress: () => {}
      });
      await save();
      paintAll();
      setStatus(r.errors.length ? "完成，失败 " + r.errors.length + " 镜，可单镜重试。" : "全部生成完成。", r.errors.length ? "err" : "ok");
    } finally {
      state.busy = false;
    }
  }

  async function genMissingTakes() {
    const p = state.project;
    const ids = (p.takes || []).filter(t => t.status !== "done" || t.dirty || !t.videoUrl).map(t => t.id);
    if (!ids.length) { U.toast("所有镜头段都已完成", "ok"); return; }
    if (!D.isConfigured("video")) {
      U.toast("还没配置视频生成服务，请到「设置 → 短剧服务」填写", "err");
      return;
    }
    if (state.busy) { U.toast("正在生成，请等待当前任务结束", "warn"); return; }
    state.busy = true;
    setStatus("正在生成 " + ids.length + " 个镜头段，请保持页面打开…", "");
    try {
      const r = await D.engine.generateTakes(p, ids, {
        concurrency: 2,
        onEach: (done, total) => setStatus("生成进度 " + done + "/" + total + "…", ""),
        onProgress: () => {}
      });
      await save();
      paintAll();
      setStatus(r.errors.length ? "完成，失败 " + r.errors.length + " 段，可单段重试。" : "全部生成完成。", r.errors.length ? "err" : "ok");
    } finally {
      state.busy = false;
    }
  }

  async function ttsAll() {
    const p = state.project;
    const ids = (p.shots || []).filter(s => s.line && !s.audioUrl).map(s => s.id);
    if (!ids.length) { U.toast("没有需要补配音的分镜", "ok"); return; }
    if (state.busy) { U.toast("正在处理，请等待当前任务结束", "warn"); return; }
    state.busy = true;
    setStatus("正在补配音 " + ids.length + " 镜…", "");
    try {
      const r = await D.engine.synthMany(p, ids, { onEach: () => {} });
      await save();
      paintAll();
      setStatus(r.errors.length ? "配音失败 " + r.errors.length + " 镜。" : "配音完成。", r.errors.length ? "err" : "ok");
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
    pause();
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
    v.querySelector("#dwProjSel").onchange = async (e) => { state.project = null; state.lastComposed = null; await load(e.target.value); render(); };
    v.querySelector("#dwGoHome").onclick = () => { pause(); if (XLX.app) XLX.app.go("dramaHome"); };
    v.querySelector("#dwNew").onclick = async () => {
      const np = D.project.blank({});
      await D.project.save(np);
      state.project = null;
      state.lastComposed = null;
      await load(np.id);
      render();
    };
    v.querySelector("#dwSave").onclick = async () => { await save(); U.toast("草稿已保存", "ok"); };
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
        await load(full.id);
        render();
        U.toast("已从云端同步", "ok");
      } catch (e) { U.toast((e && e.message) || "同步失败", "err"); }
    };
    v.querySelector("#dwGuide").onclick = () => { if (D.guide) D.guide.open("manual"); };
    v.querySelector("#dwMakeupBtn").onclick = async () => { await save(); if (D.makeup && D.makeup.load) await D.makeup.load(state.pid); if (XLX.app) XLX.app.go("makeup"); };
    v.querySelector("#dwModeBoard").onclick = () => { if (state.mode !== "board") { state.mode = "board"; render(); } };
    v.querySelector("#dwModeNode").onclick = () => { if (state.mode !== "node") { state.mode = "node"; render(); } };

    /* 窄屏抽屉：分镜 / 属性 */
    const con = v.querySelector("#dwConsole");
    v.querySelector("#dwPanelRail").onclick = () => {
      con.querySelector(".dw-rail").classList.toggle("drawer-off");
      con.querySelector(".dw-inspector").classList.add("drawer-off");
    };
    v.querySelector("#dwPanelInsp").onclick = () => {
      con.querySelector(".dw-inspector").classList.toggle("drawer-off");
      con.querySelector(".dw-rail").classList.add("drawer-off");
    };

    v.querySelector("#dwGenMissing").onclick = () => genMissing();
    v.querySelector("#dwTtsAll").onclick = () => ttsAll();
    v.querySelector("#dwStopAll").onclick = () => { D.engine.abortAll(); U.toast("已请求停止", "warn"); };
    v.querySelector("#dwCompose").onclick = () => compose();
    v.querySelector("#dwComposeServer").onclick = () => composeServer();
    v.querySelector("#dwExport").onclick = () => exportPack();
    v.querySelector("#dwCheck").onclick = () => checkCompliance();

    const titleEl = v.querySelector("#dwTitle");
    titleEl.oninput = () => { state.project.title = titleEl.value; saveSoon(500); };
    titleEl.onchange = async () => { state.project.title = titleEl.value; await save(); };

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
    v.querySelector("#dwGenre").onchange = async (e) => { state.project.genre = e.target.value; state.project.engine = e.target.value === "realistic" ? "video" : "image"; await save(); render(); };
    v.querySelector("#dwStyle").onchange = async (e) => { state.project.style = e.target.value; await save(); };
    v.querySelector("#dwRatio").onchange = async (e) => { state.project.output.ratio = e.target.value; await save(); };
    const modeEl = v.querySelector("#dwShotMode");
    if (modeEl) modeEl.onchange = async (e) => {
      state.project.shotMode = e.target.value === "take" ? "take" : "shot";
      await save();
      render();
    };
    const targetEl = v.querySelector("#dwTakeTarget");
    if (targetEl) targetEl.onchange = async (e) => {
      const n = Number(e.target.value);
      state.project.takeTarget = Math.max(D.takes.MIN_SECONDS, Math.min(D.takes.MAX_SECONDS, n > 0 ? n : D.takes.TARGET_SECONDS));
      D.takes.sync(state.project);
      await save();
      render();
    };
    const logEl = v.querySelector("#dwLogline");
    logEl.oninput = () => { state.project.script.logline = logEl.value; saveSoon(500); };
    logEl.onchange = async () => { state.project.script.logline = logEl.value; await save(); };
    const outEl = v.querySelector("#dwOutline");
    outEl.oninput = () => { state.project.script.outline = outEl.value; saveSoon(500); };
    outEl.onchange = async () => { state.project.script.outline = outEl.value; await save(); };

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
