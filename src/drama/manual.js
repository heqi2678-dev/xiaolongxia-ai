/* 铜龙电商 · AI 短剧工作台 · 手搓台「逐镜工坊」 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;
  const state = { pid: "", project: null, busy: false, lastComposed: null };

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
    return state.project;
  }

  function normalize(p) {
    if (!p) return p;
    if (!p.compliance) p.compliance = { aigcMarked: true, consentIds: [] };
    if (typeof p.compliance.aigcMarked !== "boolean") p.compliance.aigcMarked = true;
    if (!Array.isArray(p.compliance.consentIds)) p.compliance.consentIds = [];
    return p;
  }

  async function save() {
    if (!state.project) return;
    await D.project.save(state.project);
  }

  function setStatus(text, type) {
    const el = document.getElementById("dwStatus");
    if (!el) return;
    el.innerHTML = text ? '<div class="dw-card" style="border-color:' + (type === "err" ? "var(--red)" : type === "ok" ? "#2b5a3a" : "var(--border)") + '">' + D.ui.esc(text) + "</div>" : "";
  }

  async function render() {
    D.ui.ensureCss();
    const v = view();
    if (!v) return;
    if (!state.project || !D.project.get(state.pid)) await load();
    const p = state.project;
    const list = D.project.list();

    v.innerHTML = '<div class="dw-wrap">' +
      '<div class="dw-steps">' +
        step(1, "写剧本", !!p.script.logline) +
        step(2, "建角色", (p.characters || []).length > 0) +
        step(3, "拆分镜", (p.shots || []).length > 0) +
        step(4, "逐镜生成", (p.shots || []).length > 0 && (p.shots || []).every(s => s.status === "done")) +
        step(5, "配音字幕", (p.shots || []).length > 0 && (p.shots || []).every(s => !s.line || s.audioUrl)) +
        step(6, "合成导出", !!state.lastComposed) +
      "</div>" +
      '<div class="dw-bar">' +
        '<select class="inp" id="dwProjSel" style="width:auto;min-width:160px">' + list.map(x => '<option value="' + x.id + '"' + (x.id === p.id ? " selected" : "") + ">" + D.ui.esc(x.title) + "</option>").join("") + "</select>" +
        '<button class="btn small" id="dwNew">新建工程</button>' +
        '<button class="btn small" id="dwSave">保存草稿</button>' +
        '<button class="btn small" id="dwPush">上传云端</button>' +
        '<button class="btn small" id="dwPull">云端同步</button>' +
        '<button class="btn small ghost danger" id="dwDel">删除工程</button>' +
        '<button class="btn small" id="dwGuide">看教程</button>' +
      "</div>" +
      '<div class="dw-card">' +
        '<h3>作品信息</h3>' +
        '<div class="dw-grid">' +
          '<div><label class="label" style="margin-top:0">标题</label><input class="inp" id="dwTitle" value="' + D.ui.esc(p.title) + '"></div>' +
          '<div><label class="label" style="margin-top:0">剧种</label><select class="inp" id="dwGenre">' + D.ui.opts(D.GENRES, p.genre) + "</select></div>" +
          '<div><label class="label" style="margin-top:0">画风</label><select class="inp" id="dwStyle">' + D.ui.opts(D.STYLES, p.style) + "</select></div>" +
          '<div><label class="label" style="margin-top:0">画幅</label><select class="inp" id="dwRatio">' + D.ui.opts(D.RATIOS, p.output.ratio) + "</select></div>" +
        "</div>" +
        '<div class="dw-hint" style="margin-top:8px">' + (p.genre === "realistic" ? "仿真人剧：逐镜生成视频 + 口型同步，成本较高。" : "漫剧：逐镜生图 + 微动效 + 配音字幕，成本低产能高。") + "</div>" +
      "</div>" +
      '<div class="dw-card">' +
        "<h3>剧本</h3>" +
        '<label class="label" style="margin-top:0">一句话故事</label><input class="inp" id="dwLogline" value="' + D.ui.esc(p.script.logline) + '">' +
        '<label class="label">剧情大纲</label><textarea class="inp" id="dwOutline" style="min-height:70px">' + D.ui.esc(p.script.outline) + "</textarea>" +
      "</div>" +
      charCard(p) +
      complianceCard(p) +
      '<div class="dw-card">' +
        '<h3>分镜 <span class="dw-hint">（共 ' + (p.shots || []).length + ' 镜）</span></h3>' +
        '<div id="dwShots"></div>' +
        '<div class="dw-bar" style="margin-top:10px">' +
          '<button class="btn small" id="dwAddShot">＋ 加一镜</button>' +
          '<button class="btn small primary" id="dwGenMissing">生成所有未完成镜</button>' +
          '<button class="btn small" id="dwTtsAll">补全部配音</button>' +
          '<button class="btn small ghost danger" id="dwStopAll">全部停止</button>' +
        "</div>" +
      "</div>" +
      '<div class="dw-card">' +
        "<h3>合成与导出</h3>" +
        '<div class="dw-bar">' +
          '<button class="btn primary" id="dwCompose">浏览器合成成片</button>' +
          '<button class="btn" id="dwComposeServer">服务端合成（需公网素材）</button>' +
          '<button class="btn" id="dwExport">导出素材包（剪映二次剪辑）</button>' +
          '<button class="btn" id="dwCheck">合规检查</button>' +
        "</div>" +
        '<div class="dw-hint" style="margin-top:8px">浏览器合成实时录制，约等于成片时长；服务端合成更快但要求素材是公网地址。</div>' +
        '<div id="dwComposeOut" style="margin-top:10px"></div>' +
      "</div>" +
      '<div id="dwStatus"></div>' +
    "</div>";

    renderShots();
    bind(p);
  }

  function step(n, name, done) {
    return '<span class="dw-step' + (done ? " done" : "") + '">' + (done ? "✓ " : "") + n + ". " + name + "</span>";
  }

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
            '<label class="label">外观（发型、服装、气质）</label><textarea class="inp" style="min-height:46px;font-size:12px" data-cf="appearance" data-cid="' + c.id + '">' + D.ui.esc(c.appearance) + "</textarea>" +
            '<div class="dw-char-refs">' +
              (c.refImages || []).map(u => '<img class="dw-char-ref" src="' + D.ui.esc(u) + '" alt="">').join("") +
              '<button class="btn small" data-act="charref" data-cid="' + c.id + '">＋ 参考图</button>' +
            "</div>" +
          "</div>" +
          '<div>' +
            '<button class="btn small ghost danger" data-act="delchar" data-cid="' + c.id + '">删除</button>' +
          "</div>" +
        "</div>"
      ).join("");
    }
    html += '<div class="dw-bar" style="margin-top:6px"><button class="btn small" data-act="addchar">＋ 新增角色</button></div>';
    html += "</div>";
    return html;
  }

  function complianceCard(p) {
    const need = D.compliance.needsConsent(p);
    const ids = p.compliance.consentIds;
    const mine = D.compliance.consents().filter(c => ids.indexOf(c.id) >= 0);
    const v = D.compliance.verify(p);
    let html = '<div class="dw-card"><h3>合规与授权 <span class="dw-hint">（发布前必看）</span></h3>';
    html += '<label class="dw-chip' + (p.compliance.aigcMarked ? " on" : "") + '" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">' +
      '<input type="checkbox" id="dwAigc"' + (p.compliance.aigcMarked ? " checked" : "") + "> AI 生成标注（平台要求，关闭将无法合成导出）</label>";
    html += '<div class="dw-hint" style="margin:8px 0">' + (need ? "本作品涉及真人形象，必须登记肖像授权后才能合成与导出。" : "当前剧种为漫剧，无需真人肖像授权。") + "</div>";
    if (mine.length) {
      html += '<div class="dw-hint">已登记授权：</div>';
      html += mine.map(c =>
        '<div class="dw-char" style="align-items:center"><div style="flex:1">' +
          '<div style="font-size:13px">' + D.ui.esc(c.subject) + "</div>" +
          '<div class="dw-hint">' + D.ui.esc(c.scope) + " · " + new Date(c.confirmedAt).toLocaleString() + "</div>" +
        "</div>" +
        '<button class="btn small ghost danger" data-act="delconsent" data-cid="' + c.id + '">移除</button></div>'
      ).join("");
    }
    html += '<div class="dw-bar" style="margin-top:6px">' +
      '<button class="btn small" data-act="addconsent">＋ 登记肖像授权</button>' +
      '<button class="btn small" id="dwCheck2">检查合规</button>' +
    "</div>";
    html += '<div id="dwConsentForm" style="display:none;margin-top:8px">' +
      '<input class="inp" id="dwConsentName" placeholder="授权人姓名（本人或已获授权的模特）">' +
      '<input class="inp" id="dwConsentScope" style="margin-top:6px" value="本人肖像用于 AI 短剧生成">' +
      '<div class="dw-bar" style="margin-top:6px"><button class="btn small primary" id="dwConsentSave">确认登记</button>' +
      '<button class="btn small" id="dwConsentCancel">取消</button></div>' +
    "</div>";
    html += '<div class="dw-hint" style="margin-top:8px;color:' + (v.ok ? "var(--green)" : "var(--red)") + '">' +
      (v.ok ? "合规检查通过，可以合成与导出。" : "待处理：" + v.blockers.join("；")) + "</div>";
    html += "</div>";
    return html;
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

  function renderShots() {
    const p = state.project;
    const box = document.getElementById("dwShots");
    if (!box) return;
    D.ui.renderShots(box, p);
    D.ui.bindShots(box, p, shotHandlers);
  }

  const shotHandlers = {
    gen(sid) { doGen(sid); },
    tts(sid) { doTts(sid); },
    lipsync(sid) { doLipsync(sid); },
    move(sid, btn) { D.project.moveShot(state.project, sid, Number(btn.dataset.dir)); save(); renderShots(); },
    remove(sid) {
      if (!confirm("删掉这一镜？")) return;
      D.project.removeShot(state.project, sid);
      save();
      renderShots();
    },
    upload(sid) { pickCover(sid); },
    onChange() { save(); }
  };

  async function doGen(sid) {
    const p = state.project;
    try {
      D.ui.progress(sid, "正在提交生成任务…");
      const shot = await D.engine.generateShot(p, sid, {
        onProgress: (st) => D.ui.progress(sid, st && st.status === "done" ? "完成" : "生成中…")
      });
      D.ui.refreshShot(p, shot);
      D.ui.progress(sid, "");
      U.toast("第 " + shot.seq + " 镜生成完成", "ok");
    } catch (e) {
      const shot = (p.shots || []).find(s => s.id === sid);
      if (shot) D.ui.refreshShot(p, shot);
      D.ui.progress(sid, "");
      U.toast((e && e.message) || "生成失败", "err");
    }
  }

  async function doTts(sid) {
    const p = state.project;
    const shot = (p.shots || []).find(s => s.id === sid);
    if (!shot) return;
    if (!shot.line) { U.toast("这一镜没有台词", "warn"); return; }
    try {
      D.ui.progress(sid, "正在合成配音…");
      await D.engine.synthShot(p, shot);
      if (D.engine.isRealistic(p) && shot.videoUrl) await D.engine.lipsyncShot(p, shot);
      await save();
      D.ui.refreshShot(p, shot);
      D.ui.progress(sid, "");
      U.toast("配音完成（" + Math.round(shot.audioDuration || 0) + " 秒）", "ok");
    } catch (e) {
      D.ui.progress(sid, "");
      U.toast((e && e.message) || "配音失败", "err");
    }
  }

  async function doLipsync(sid) {
    const p = state.project;
    const shot = (p.shots || []).find(s => s.id === sid);
    if (!shot) return;
    if (!shot.videoUrl || !shot.audioUrl) { U.toast("需要先生成视频和配音", "warn"); return; }
    try {
      D.ui.progress(sid, "正在做口型…");
      await D.engine.lipsyncShot(p, shot);
      await save();
      D.ui.refreshShot(p, shot);
      D.ui.progress(sid, "");
      U.toast("口型完成", "ok");
    } catch (e) {
      D.ui.progress(sid, "");
      U.toast((e && e.message) || "口型失败", "err");
    }
  }

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
      const shot = (state.project.shots || []).find(s => s.id === sid);
      if (!shot) return;
      shot.imageUrl = url;
      shot.firstFrame = url;
      await save();
      D.ui.refreshShot(state.project, shot);
      U.toast("封面已替换", "ok");
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

  function bind(p) {
    const v = view();
    v.querySelector("#dwProjSel").onchange = async (e) => { state.project = null; state.lastComposed = null; await load(e.target.value); render(); };
    v.querySelector("#dwNew").onclick = async () => {
      const np = D.project.blank({});
      await D.project.save(np);
      state.project = null;
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
        U.toast("云端有 " + remote.length + " 个工程（按标题选择后覆盖本地）", "info");
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
    v.querySelector("#dwDel").onclick = () => {
      if (!confirm("删除这个工程？本地草稿会被移除。")) return;
      D.project.remove(state.pid);
      state.project = null;
      state.lastComposed = null;
      render();
    };
    v.querySelector("#dwGuide").onclick = () => { if (D.guide) D.guide.open("manual"); };

    v.querySelector("#dwTitle").onchange = async (e) => { state.project.title = e.target.value; await save(); };
    v.querySelector("#dwGenre").onchange = async (e) => { state.project.genre = e.target.value; state.project.engine = e.target.value === "realistic" ? "video" : "image"; await save(); render(); };
    v.querySelector("#dwStyle").onchange = async (e) => { state.project.style = e.target.value; await save(); };
    v.querySelector("#dwRatio").onchange = async (e) => { state.project.output.ratio = e.target.value; await save(); };
    v.querySelector("#dwLogline").onchange = async (e) => { state.project.script.logline = e.target.value; await save(); };
    v.querySelector("#dwOutline").onchange = async (e) => { state.project.script.outline = e.target.value; await save(); };

    v.querySelector("#dwAddShot").onclick = () => { D.project.addShot(state.project); save(); renderShots(); };
    v.querySelector("#dwGenMissing").onclick = () => genMissing();
    v.querySelector("#dwTtsAll").onclick = () => ttsAll();
    v.querySelector("#dwStopAll").onclick = () => { D.engine.abortAll(); U.toast("已请求停止", "warn"); };
    v.querySelector("#dwCompose").onclick = () => compose();
    v.querySelector("#dwComposeServer").onclick = () => composeServer();
    v.querySelector("#dwExport").onclick = () => exportPack();
    v.querySelector("#dwCheck").onclick = () => checkCompliance();

    /* 角色卡区事件 */
    v.querySelectorAll("[data-cf]").forEach(el => {
      el.onchange = async () => {
        const c = (state.project.characters || []).find(x => x.id === el.dataset.cid);
        if (!c) return;
        c[el.dataset.cf] = el.value;
        await save();
      };
    });
    v.querySelectorAll('[data-act="addchar"]').forEach(b => b.onclick = async () => { D.project.addCharacter(state.project); await save(); render(); });
    v.querySelectorAll('[data-act="delchar"]').forEach(b => b.onclick = async () => { D.project.removeCharacter(state.project, b.dataset.cid); await save(); render(); });
    v.querySelectorAll('[data-act="charref"]').forEach(b => b.onclick = () => pickCharRef(b.dataset.cid));

    /* 合规与授权区事件 */
    const aigc = v.querySelector("#dwAigc");
    if (aigc) aigc.onchange = async () => { state.project.compliance.aigcMarked = aigc.checked; await save(); render(); };
    v.querySelectorAll('[data-act="addconsent"]').forEach(b => b.onclick = () => {
      const f = document.getElementById("dwConsentForm");
      if (f) f.style.display = "block";
    });
    v.querySelectorAll('[data-act="delconsent"]').forEach(b => b.onclick = async () => {
      state.project.compliance.consentIds = state.project.compliance.consentIds.filter(x => x !== b.dataset.cid);
      await save();
      render();
    });
    v.querySelectorAll("#dwConsentCancel").forEach(b => b.onclick = () => {
      const f = document.getElementById("dwConsentForm");
      if (f) f.style.display = "none";
    });
    v.querySelectorAll("#dwConsentSave").forEach(b => b.onclick = async () => {
      const name = ((document.getElementById("dwConsentName") || {}).value || "").trim();
      const scope = ((document.getElementById("dwConsentScope") || {}).value || "").trim();
      if (!name) { U.toast("请填写授权人姓名", "warn"); return; }
      const rec = D.compliance.recordConsent(name, scope);
      state.project.compliance.consentIds.push(rec.id);
      await save();
      render();
      U.toast("肖像授权已登记", "ok");
    });
    v.querySelectorAll("#dwCheck2").forEach(b => b.onclick = () => checkCompliance());
  }

  function needsGen(s) {
    if (state.project.genre === "realistic") return !s.videoUrl || s.status !== "done";
    return !s.imageUrl || s.status !== "done";
  }

  async function genMissing() {
    const p = state.project;
    const ids = (p.shots || []).filter(needsGen).map(s => s.id);
    if (!ids.length) { U.toast("所有分镜都已完成", "ok"); return; }
    if (!D.isConfigured(p.genre === "realistic" ? "video" : "image")) {
      U.toast("还没配置生成服务，请到「设置 → 短剧服务」填写", "err");
      return;
    }
    setStatus("正在生成 " + ids.length + " 个分镜，请保持页面打开…", "");
    const r = await D.engine.generateMany(p, ids, {
      concurrency: 2,
      onEach: (done, total) => setStatus("生成进度 " + done + "/" + total + "…", ""),
      onProgress: (st) => {}
    });
    (p.shots || []).forEach(s => D.ui.refreshShot(p, s));
    setStatus(r.errors.length ? "完成，失败 " + r.errors.length + " 镜，可单镜重试。" : "全部生成完成。", r.errors.length ? "err" : "ok");
  }

  async function ttsAll() {
    const p = state.project;
    const ids = (p.shots || []).filter(s => s.line && !s.audioUrl).map(s => s.id);
    if (!ids.length) { U.toast("没有需要补配音的分镜", "ok"); return; }
    setStatus("正在补配音 " + ids.length + " 镜…", "");
    const r = await D.engine.synthMany(p, ids, { onEach: () => {} });
    (p.shots || []).forEach(s => D.ui.refreshShot(p, s));
    setStatus(r.errors.length ? "配音失败 " + r.errors.length + " 镜。" : "配音完成。", r.errors.length ? "err" : "ok");
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

  D.manual = { render, load, state };
})();
