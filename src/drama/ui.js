/* 铜龙电商 · AI 短剧工作台 · 共用界面部件 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;
  const noop = () => {};
  let cssDone = false;

  const CSS = `
.dw-wrap{max-width:1180px;margin:0 auto;padding:14px 4px 40px;width:100%}
#homeView,#projectsView,#assetsView,#tvshowView,#rankingView,#box3dView,#pluginView,#dramaView,#autoView{overflow-y:auto}
.dw-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.dw-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px}
.dw-card h3{margin:0 0 10px;font-size:14px;display:flex;align-items:center;gap:8px}
.dw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.dw-shot{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px}
.dw-shot.failed{border-color:var(--red)}
.dw-shot.generating{border-color:var(--blue)}
.dw-shot.done{border-color:#2b5a3a}
.dw-shot-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.dw-seq{font-weight:700;color:var(--accent2);font-size:13px}
.dw-badge{font-size:11px;padding:2px 8px;border-radius:20px;background:var(--panel2);color:var(--text2)}
.dw-badge.ok{background:rgba(61,220,132,.15);color:var(--green)}
.dw-badge.wait{background:rgba(74,168,255,.15);color:var(--blue)}
.dw-badge.bad{background:rgba(255,95,109,.15);color:var(--red)}
.dw-badge.stale{background:rgba(245,196,81,.15);color:var(--yellow)}
.dw-shot-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.dw-thumb{width:84px;height:148px;border-radius:8px;object-fit:cover;background:#0d1420;border:1px solid var(--border);cursor:pointer}
.dw-thumb.wide{width:148px;height:84px}
.dw-role-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.dw-chip{font-size:11px;padding:3px 9px;border-radius:20px;border:1px solid var(--border);background:var(--bg);cursor:pointer;user-select:none}
.dw-chip.on{border-color:var(--accent);color:var(--accent2);background:rgba(255,90,60,.1)}
.dw-empty{color:var(--text3);font-size:12px;padding:16px;text-align:center}
.dw-hint{font-size:11px;color:var(--text3);line-height:1.7}
.dw-progress{font-size:11px;color:var(--blue);margin-top:6px}
.dw-steps{display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-bottom:14px;padding:10px 12px;background:var(--panel);border:1px solid var(--border);border-radius:12px}
.dw-step{position:relative;display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;border-radius:20px;background:transparent;border:1px solid transparent;color:var(--text3);white-space:nowrap;transition:.15s}
.dw-step::after{content:"›";margin-left:8px;color:var(--text3);opacity:.5}
.dw-step:last-child::after{display:none}
.dw-step.on{background:var(--accent-grad);border-color:transparent;color:#fff;font-weight:600}
.dw-step.on::after,.dw-step:last-child.on::after{color:var(--text3)}
.dw-step.done{color:var(--green)}
.dw-step-no{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;font-size:10px;background:var(--bg);border:1px solid var(--border2);color:var(--text2)}
.dw-step.on .dw-step-no{background:rgba(255,255,255,.22);border-color:transparent;color:#fff}
.dw-preview{width:100%;max-width:300px;border-radius:10px;background:#000;display:block}
.dw-char{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;background:var(--bg)}
.dw-char-refs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.dw-char-ref{width:44px;height:44px;border-radius:6px;object-fit:cover;border:1px solid var(--border)}

/* ===== 专业创作台：三区布局 ===== */
.dw-console{display:grid;grid-template-columns:132px minmax(0,1fr) 320px;gap:12px;align-items:start}
.dw-rail{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 200px);overflow-y:auto;padding-right:2px}
.dw-rail-item{position:relative;flex:0 0 auto;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#0d1420;cursor:pointer;transition:border-color .15s,transform .15s}
.dw-rail-item:hover{transform:translateY(-1px);border-color:var(--border2,#3a4a63)}
.dw-rail-item.on{border-color:var(--accent)}
.dw-rail-item img,.dw-rail-item video{width:100%;aspect-ratio:9/16;object-fit:cover;display:block}
.dw-rail-ph{width:100%;aspect-ratio:9/16;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px}
.dw-rail-meta{display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:11px;color:var(--text2);background:var(--panel)}
.dw-rail-idx{font-weight:700;color:var(--accent2)}
.dw-dot{width:6px;height:6px;border-radius:50%;background:var(--text3);margin-left:auto}
.dw-dot.done{background:var(--green)}
.dw-dot.failed{background:var(--red)}
.dw-dot.generating{background:var(--blue)}

.dw-stage{position:sticky;top:8px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;gap:10px}
.dw-stage-canvas{position:relative;width:100%;aspect-ratio:9/16;max-height:60vh;margin:0 auto;background:#05080e;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.dw-stage-canvas img,.dw-stage-canvas video{width:100%;height:100%;object-fit:contain}
.dw-stage-empty{color:var(--text3);font-size:12px;text-align:center;padding:20px}
.dw-stage-tip{position:absolute;left:8px;top:8px;font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(0,0,0,.55);color:#fff}
.dw-stage-ctrl{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dw-stage-time{font-size:11px;color:var(--text2);font-variant-numeric:tabular-nums;margin-left:auto}

.dw-inspector{display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 200px);overflow-y:auto;padding-right:2px}
.dw-inspector .dw-card{margin-bottom:0}

/* ===== 三轨时间轴 ===== */
.dw-timeline{display:grid;grid-template-columns:40px minmax(0,1fr);gap:4px 8px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:10px;position:relative}
.dw-playhead{position:absolute;top:6px;bottom:6px;width:2px;background:var(--accent);pointer-events:none;box-shadow:0 0 6px rgba(255,90,60,.7);transition:left .04s linear}
.dw-timeline-hud{grid-column:1/-1;display:flex;gap:14px;font-size:11px;color:var(--text3)}
.dw-track-head{font-size:11px;color:var(--text2);display:flex;align-items:center}
.dw-track{display:flex;height:22px;border-radius:6px;overflow:hidden;background:var(--bg);border:1px solid var(--border)}
.dw-clip{position:relative;display:flex;align-items:center;justify-content:center;min-width:2px;background:rgba(74,168,255,.22);border-right:1px solid rgba(0,0,0,.4);color:var(--text2);font-size:10px;cursor:pointer;overflow:hidden;transition:background .15s}
.dw-track-audio .dw-clip{background:rgba(61,220,132,.2)}
.dw-track-subtitle .dw-clip{background:rgba(245,196,81,.18)}
.dw-clip.empty{background:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 6px,transparent 6px 12px)}
.dw-clip.on{outline:2px solid var(--accent);outline-offset:-2px;background:rgba(255,90,60,.3)}
.dw-clip.dw-st-failed{background:rgba(255,95,109,.25)}

/* ===== 项目中心 ===== */
.dw-grid-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.dw-pcard{background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column}
.dw-pcard:hover{border-color:var(--accent);transform:translateY(-2px)}
.dw-pcard-cover{width:100%;aspect-ratio:9/16;background:#0d1420;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px;overflow:hidden}
.dw-pcard-cover img{width:100%;height:100%;object-fit:cover}
.dw-pcard-body{padding:8px 10px;display:flex;flex-direction:column;gap:4px}
.dw-pcard-title{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dw-pcard-meta{font-size:11px;color:var(--text3);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dw-pcard-acts{display:flex;gap:6px;padding:0 10px 10px}
.dw-tpl{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.dw-tpl-card{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--card);cursor:pointer;transition:border-color .15s}
.dw-tpl-card:hover{border-color:var(--accent)}
.dw-tpl-name{font-size:13px;font-weight:600;margin-bottom:4px}
.dw-tpl-tag{font-size:11px;color:var(--accent2);margin-bottom:6px}
.dw-tpl-desc{font-size:11px;color:var(--text3);line-height:1.6}
.dw-skel{border-radius:8px;background:linear-gradient(90deg,var(--bg) 25%,var(--panel2) 50%,var(--bg) 75%);background-size:200% 100%;animation:dwSkel 1.2s infinite}
.dw-shotgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}
.dw-shotgrid .dw-rail-item img,.dw-shotgrid .dw-rail-item video{aspect-ratio:9/16}
@keyframes dwSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ===== 模型选择条 ===== */
.dw-modelbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:6px 8px}
.dw-modelbar.off{border-style:dashed;border-color:var(--yellow)}
.dw-modelbar-name{font-size:11px;color:var(--text2);min-width:56px}
.dw-modelbar select,.dw-modelbar input{width:auto;min-width:110px;padding:4px 8px;font-size:12px}
.dw-modelbar-dot{width:8px;height:8px;border-radius:50%;background:var(--text3);flex:0 0 auto}
.dw-modelbar-dot.ok{background:var(--green)}
.dw-modelbar-dot.bad{background:var(--yellow)}

/* ===== 整段模式：镜头段分组 ===== */
.dw-take{border:1px solid var(--border);border-radius:10px;padding:6px;background:var(--bg)}
.dw-take.on{border-color:var(--accent)}
.dw-take.done{border-color:#2b5a3a}
.dw-take-head{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);padding:2px 2px 6px}
.dw-take-head b{color:var(--accent2)}
.dw-take-shots{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
.dw-take-shots .dw-rail-item{flex:0 0 72px}
.dw-take-shots .dw-rail-item img,.dw-take-shots .dw-rail-item video{aspect-ratio:9/16}
.dw-take-marks{display:flex;width:100%;gap:2px;margin:2px 0 4px}
.dw-take-mark{box-sizing:border-box;border:1px dashed var(--accent2);border-radius:6px;font-size:10px;color:var(--accent2);text-align:center;overflow:hidden;white-space:nowrap;cursor:pointer;padding:1px 0}
.dw-take-list{display:flex;flex-direction:column;gap:8px}
.dw-take-list .dw-take>button{margin-top:6px}

@media (max-width:900px){
  .dw-console{grid-template-columns:1fr}
  .dw-rail{flex-direction:row;max-height:none;overflow-x:auto;overflow-y:hidden}
  .dw-rail-item{flex:0 0 92px}
  .dw-inspector{max-height:none;overflow:visible}
  .dw-rail.drawer-off,.dw-inspector.drawer-off{display:none}
}
`;

  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaWorkbenchCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function esc(s) { return U.esc(String(s == null ? "" : s)); }

  function opts(list, value, valueKey, labelKey) {
    valueKey = valueKey || "id";
    labelKey = labelKey || "name";
    return (list || []).map(x =>
      '<option value="' + esc(x[valueKey]) + '"' + (String(x[valueKey]) === String(value) ? " selected" : "") + ">" + esc(x[labelKey]) + "</option>"
    ).join("");
  }

  function statusBadge(shot) {
    const map = {
      pending: ['<span class="dw-badge">待生成</span>'],
      generating: ['<span class="dw-badge wait">生成中…</span>'],
      done: ['<span class="dw-badge ok">已完成</span>'],
      failed: ['<span class="dw-badge bad">失败</span>']
    };
    let html = (map[shot.status] || map.pending)[0];
    if (shot.stale) html += '<span class="dw-badge stale">需重绘</span>';
    return html;
  }

  function roleChips(project, shot) {
    if (!(project.characters || []).length) return "";
    return '<div class="dw-role-chips">' + project.characters.map(c =>
      '<span class="dw-chip' + ((shot.roleIds || []).indexOf(c.id) >= 0 ? " on" : "") + '" data-act="role" data-shot="' + shot.id + '" data-role="' + c.id + '">' + esc(c.name) + "</span>"
    ).join("") + "</div>";
  }

  function previewHtml(shot, realistic) {
    if (realistic) {
      if (shot.lipsyncUrl || shot.videoUrl) return '<video class="dw-thumb wide" src="' + esc(shot.lipsyncUrl || shot.videoUrl) + '" muted playsinline controls></video>';
    } else if (shot.imageUrl) {
      return '<img class="dw-thumb" src="' + esc(shot.imageUrl) + '" alt="">';
    }
    if (shot.imageUrl) return '<img class="dw-thumb" src="' + esc(shot.imageUrl) + '" alt="">';
    return '<div class="dw-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px">无画面</div>';
  }

  function shotCard(project, shot, opts2) {
    opts2 = opts2 || {};
    const realistic = D.engine.isRealistic(project);
    const readonly = !!opts2.readonly;
    return '<div class="dw-shot ' + esc(shot.status || "pending") + '" data-card="' + shot.id + '">' +
      '<div class="dw-shot-head">' +
        '<span class="dw-seq">第 ' + shot.seq + ' 镜</span>' +
        '<input class="inp" style="width:150px;padding:4px 8px;font-size:12px" data-act="field" data-shot="' + shot.id + '" data-field="name" value="' + esc(shot.name || "") + '" placeholder="分镜名">' +
        '<span data-status="' + shot.id + '">' + statusBadge(shot) + "</span>" +
        '<span style="margin-left:auto"></span>' +
        '<button class="btn small ghost" data-act="move" data-shot="' + shot.id + '" data-dir="-1">上移</button>' +
        '<button class="btn small ghost" data-act="move" data-shot="' + shot.id + '" data-dir="1">下移</button>' +
        (readonly ? "" : '<button class="btn small ghost danger" data-act="remove" data-shot="' + shot.id + '">删除</button>') +
      "</div>" +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
        '<div>' + previewHtml(shot, realistic) + "</div>" +
        '<div style="flex:1;min-width:220px">' +
          '<label class="label" style="margin-top:0">画面提示词</label>' +
          '<textarea class="inp" style="min-height:54px;font-size:12px" data-act="field" data-shot="' + shot.id + '" data-field="prompt" placeholder="这一镜的画面描述">' + esc(shot.prompt) + "</textarea>" +
          '<label class="label">台词（留空则无配音）</label>' +
          '<textarea class="inp" style="min-height:44px;font-size:12px" data-act="field" data-shot="' + shot.id + '" data-field="line" placeholder="角色要说的话">' + esc(shot.line) + "</textarea>" +
          '<div class="dw-grid" style="margin-top:8px">' +
            '<div><label class="label" style="margin-top:0">运镜</label><select class="inp" data-act="field" data-shot="' + shot.id + '" data-field="motion">' + opts(D.MOTIONS, shot.motion) + "</select></div>" +
            '<div><label class="label" style="margin-top:0">时长（秒）</label><select class="inp" data-act="field" data-shot="' + shot.id + '" data-field="duration">' + opts(D.DURATIONS.map(d => ({ id: d, name: d + " 秒" })), shot.duration) + "</select></div>" +
          "</div>" +
          roleChips(project, shot) +
          (readonly ? "" :
            '<div class="dw-shot-actions">' +
              '<button class="btn small primary" data-act="gen" data-shot="' + shot.id + '">' + (realistic ? "生成视频" : "生成画面") + "</button>" +
              (realistic ? '<button class="btn small" data-act="lipsync" data-shot="' + shot.id + '">只做口型</button>' : "") +
              '<button class="btn small" data-act="tts" data-shot="' + shot.id + '">配音</button>' +
              '<button class="btn small" data-act="upload" data-shot="' + shot.id + '">换封面图</button>' +
              (shot.status === "failed" ? '<span class="dw-hint" style="color:var(--red)">' + esc(shot.error || "") + "</span>" : "") +
            "</div>") +
          '<div class="dw-progress" data-prog="' + shot.id + '"></div>' +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function renderShots(container, project, handlers) {
    handlers = handlers || {};
    if (!(project.shots || []).length) {
      container.innerHTML = '<div class="dw-empty">还没有分镜，点下面「加一镜」或先用半自动台生成</div>';
      return;
    }
    container.innerHTML = project.shots.map(s => shotCard(project, s, handlers)).join("");
  }

  function refreshShot(project, shot) {
    const card = document.querySelector('[data-card="' + shot.id + '"]');
    if (!card) return;
    card.className = "dw-shot " + (shot.status || "pending");
    const st = card.querySelector('[data-status="' + shot.id + '"]');
    if (st) st.innerHTML = statusBadge(shot);
    const img = card.querySelector("img.dw-thumb, video.dw-thumb");
    if (img && (shot.lipsyncUrl || shot.videoUrl || shot.imageUrl)) {
      if (img.tagName === "IMG") { if (shot.imageUrl) img.src = shot.imageUrl; }
      else { const u = shot.lipsyncUrl || shot.videoUrl; if (u) img.src = u; }
    }
  }

  function progress(shotId, text) {
    const el = document.querySelector('[data-prog="' + shotId + '"]');
    if (el) el.textContent = text || "";
  }

  /* 事件委托：card 内的 data-act 按钮与字段 */
  function bindShots(root, project, handlers) {
    handlers = handlers || {};
    root.onclick = (e) => {
      const role = e.target.closest('[data-act="role"]');
      if (role) {
        const shot = project.shots.find(s => s.id === role.dataset.shot);
        if (!shot) return;
        const cid = role.dataset.role;
        shot.roleIds = shot.roleIds || [];
        const i = shot.roleIds.indexOf(cid);
        if (i >= 0) shot.roleIds.splice(i, 1); else shot.roleIds.push(cid);
        role.classList.toggle("on");
        if (handlers.onChange) handlers.onChange(project, shot);
        return;
      }
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      const sid = b.dataset.shot;
      if (act === "field") return;
      if (handlers[act]) handlers[act](sid, b, project);
    };
    root.onchange = (e) => {
      const f = e.target.closest('[data-act="field"]');
      if (!f) return;
      const shot = project.shots.find(s => s.id === f.dataset.shot);
      if (!shot) return;
      const field = f.dataset.field;
      shot[field] = field === "duration" ? Number(f.value) : f.value;
      if (handlers.onChange) handlers.onChange(project, shot);
    };
  }

  function shotIds(project, only) {
    return (project.shots || []).filter(only || (() => true)).map(s => s.id);
  }

  /* ============ 合规与授权区（手搓台、半自动台共用） ============ */
  function complianceCard(project, o) {
    o = o || {};
    const px = o.prefix || "dw";
    if (!project.compliance) project.compliance = { aigcMarked: true, consentIds: [] };
    if (!Array.isArray(project.compliance.consentIds)) project.compliance.consentIds = [];
    const cp = project.compliance;
    const need = D.compliance.needsConsent(project);
    const mine = D.compliance.consents().filter(c => cp.consentIds.indexOf(c.id) >= 0);
    const v = D.compliance.verify(project);
    let html = '<div class="dw-card"><h3>合规与授权 <span class="dw-hint">（发布前必看）</span></h3>';
    html += '<label class="dw-chip' + (cp.aigcMarked ? " on" : "") + '" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">' +
      '<input type="checkbox" id="' + px + 'Aigc"' + (cp.aigcMarked ? " checked" : "") + "> AI 生成标注（平台要求，关闭将无法合成导出）</label>";
    html += '<div class="dw-hint" style="margin:8px 0">' + (need ? "本作品涉及真人形象，必须登记肖像授权后才能合成与导出。" : "当前剧种为漫剧，无需真人肖像授权。") + "</div>";
    if (mine.length) {
      html += '<div class="dw-hint">已登记授权：</div>';
      html += mine.map(c =>
        '<div class="dw-char" style="align-items:center"><div style="flex:1">' +
          '<div style="font-size:13px">' + esc(c.subject) + "</div>" +
          '<div class="dw-hint">' + esc(c.scope) + " · " + new Date(c.confirmedAt).toLocaleString() + "</div>" +
        "</div>" +
        '<button class="btn small ghost danger" data-act="delconsent" data-cid="' + esc(c.id) + '">移除</button></div>'
      ).join("");
    }
    html += '<div class="dw-bar" style="margin-top:6px">' +
      '<button class="btn small" data-act="addconsent">＋ 登记肖像授权</button>' +
      '<button class="btn small" data-act="checkcompliance">检查合规</button>' +
    "</div>";
    html += '<div id="' + px + 'ConsentForm" style="display:none;margin-top:8px">' +
      '<input class="inp" id="' + px + 'ConsentName" placeholder="授权人姓名（本人或已获授权的模特）">' +
      '<input class="inp" id="' + px + 'ConsentScope" style="margin-top:6px" value="本人肖像用于 AI 短剧生成">' +
      '<div class="dw-bar" style="margin-top:6px"><button class="btn small primary" id="' + px + 'ConsentSave">确认登记</button>' +
      '<button class="btn small" id="' + px + 'ConsentCancel">取消</button></div>' +
    "</div>";
    html += '<div class="dw-hint" style="margin-top:8px;color:' + (v.ok ? "var(--green)" : "var(--red)") + '">' +
      (v.ok ? "合规检查通过，可以合成与导出。" : "待处理：" + v.blockers.join("；")) + "</div>";
    html += "</div>";
    return html;
  }

  function bindCompliance(root, project, o) {
    o = o || {};
    const px = o.prefix || "dw";
    const after = o.onChange || noop;
    const onCheck = o.onCheck || noop;
    const cp = project.compliance || (project.compliance = { aigcMarked: true, consentIds: [] });
    if (!Array.isArray(cp.consentIds)) cp.consentIds = [];
    const aigc = root.querySelector("#" + px + "Aigc");
    if (aigc) aigc.onchange = async () => { cp.aigcMarked = !!aigc.checked; await after(); };
    const form = root.querySelector("#" + px + "ConsentForm");
    const show = (on) => { if (form) form.style.display = on ? "" : "none"; };
    root.querySelectorAll('[data-act="addconsent"]').forEach(b => { b.onclick = () => show(true); });
    root.querySelectorAll('[data-act="delconsent"]').forEach(b => {
      b.onclick = async () => { cp.consentIds = cp.consentIds.filter(x => x !== b.dataset.cid); await after(); };
    });
    root.querySelectorAll('[data-act="checkcompliance"]').forEach(b => { b.onclick = () => onCheck(); });
    const save = root.querySelector("#" + px + "ConsentSave");
    if (save) save.onclick = async () => {
      const nameEl = root.querySelector("#" + px + "ConsentName");
      const scopeEl = root.querySelector("#" + px + "ConsentScope");
      const subject = ((nameEl && nameEl.value) || "").trim();
      if (!subject) { U.toast("请填写授权人姓名", "warn"); return; }
      const scope = ((scopeEl && scopeEl.value) || "").trim() || "本人肖像用于 AI 短剧生成";
      const rec = D.compliance.recordConsent(subject, scope);
      cp.consentIds = cp.consentIds.concat([rec.id]);
      await after();
    };
    const cancel = root.querySelector("#" + px + "ConsentCancel");
    if (cancel) cancel.onclick = () => show(false);
  }

  /* ============ 跨工程角色库面板（共用） ============ */
  function libPanel(project, o) {
    o = o || {};
    const px = o.prefix || "dw";
    const list = D.character.libAll();
    let html = '<div id="' + px + 'LibPanel" style="display:none;margin-top:8px">';
    html += '<div class="dw-hint">角色库（跨工程复用，共 ' + list.length + ' 个）：</div>';
    if (!list.length) {
      html += '<div class="dw-empty">库里还没有角色。在角色卡上点「存入角色库」即可收藏。</div>';
    } else {
      html += list.map(e =>
        '<div class="dw-char" data-lib="' + esc(e.id) + '">' +
          '<div style="flex:1">' +
            '<div style="font-size:13px">' + esc(e.name) + (e.realPerson ? ' <span class="dw-badge bad">真人</span>' : "") + "</div>" +
            '<div class="dw-hint">' + esc(e.identity || "未填身份") + "</div>" +
            '<div class="dw-hint">' + esc(e.appearance || "未填外观") + "</div>" +
            '<div class="dw-char-refs">' + (e.refImages || []).map(u => '<img class="dw-char-ref" data-ref="' + esc(u) + '" alt="">').join("") + "</div>" +
          "</div>" +
          '<div>' +
            '<button class="btn small primary" data-act="libadd" data-id="' + esc(e.id) + '">加入本工程</button>' +
            '<button class="btn small ghost danger" style="margin-top:6px" data-act="libdel" data-id="' + esc(e.id) + '">删除</button>' +
          "</div>" +
        "</div>"
      ).join("");
    }
    html += "</div>";
    return html;
  }

  function bindLib(root, project, o) {
    o = o || {};
    const px = o.prefix || "dw";
    const after = o.onChange || noop;
    const panel = root.querySelector("#" + px + "LibPanel");
    const toggle = (on) => { if (panel) panel.style.display = on ? "" : "none"; };
    root.querySelectorAll('[data-act="charload"]').forEach(b => {
      b.onclick = async () => { toggle(true); await hydrateThumbs(root, px); };
    });
    root.querySelectorAll('[data-act="libadd"]').forEach(b => {
      b.onclick = async () => {
        const entry = D.character.libGet(b.dataset.id);
        if (!entry) { U.toast("角色库记录不存在", "err"); return; }
        await D.character.libToProject(project, entry);
        U.toast("已加入「" + entry.name + "」", "ok");
        await after();
      };
    });
    root.querySelectorAll('[data-act="libdel"]').forEach(b => {
      b.onclick = async () => { D.character.libRemove(b.dataset.id); await after(); };
    });
    root.querySelectorAll('[data-act="charsave"]').forEach(b => {
      b.onclick = async () => {
        try {
          const rec = await D.character.libFromProject(project, b.dataset.cid);
          U.toast("「" + rec.name + "」已存入角色库", "ok");
        } catch (e) { U.toast((e && e.message) || "存入失败", "warn"); return; }
        await after();
      };
    });
  }

  /* 库面板里的 asset: 参考图是懒加载的，打开面板时再换成可显示的 blob: 地址 */
  async function hydrateThumbs(root, px) {
    const imgs = root.querySelectorAll("#" + px + "LibPanel img[data-ref]");
    for (const img of imgs) {
      if (!img.dataset.ref || img.src) continue;
      const h = await D.project.assets.hydrateRef(img.dataset.ref);
      if (h) img.src = h;
    }
  }

  /* ============ 角色外观细分（共用组件） ============ */
  /* 固定顺序的可选子字段，留空不参与提示词；文字变化会被版本化引用，降低人物跑偏。 */
  const CHAR_DETAILS = [
    { key: "age", label: "年龄", ph: "27 岁" },
    { key: "hair", label: "发型发色", ph: "黑色短发，利落" },
    { key: "eyes", label: "瞳色", ph: "深棕" },
    { key: "outfit", label: "服装", ph: "黑色高领毛衣" },
    { key: "accessory", label: "配饰", ph: "银色腕表" }
  ];

  function charDetails(c) {
    const d = (c && c.details) || {};
    return '<div class="dw-grid">' + CHAR_DETAILS.map(f =>
      '<div><label class="label">' + esc(f.label) + "</label>" +
      '<input class="inp" data-cd="' + esc(f.key) + '" data-cid="' + esc(c.id) + '" value="' + esc(d[f.key] || "") + '" placeholder="' + esc(f.ph) + '">' +
      "</div>"
    ).join("") + "</div>";
  }

  /* ===== 专业创作台共用部件 ===== */

  function emptyBox(text, act) {
    return '<div class="dw-empty"><p>' + esc(text) + "</p>" +
      (act ? '<button class="btn primary" data-act="' + esc(act.id) + '">' + esc(act.label) + "</button>" : "") + "</div>";
  }

  function skeleton(h) {
    return '<div class="dw-skel" style="height:' + (Number(h) > 0 ? Number(h) : 120) + 'px"></div>';
  }

  /* 分镜缩略图：优先成片，其次视频，再退静帧 */
  function thumb(shot, o) {
    o = o || {};
    const video = shot.lipsyncUrl || shot.videoUrl || "";
    const img = shot.imageUrl || "";
    const cls = "dw-thumb" + (o.cls ? " " + o.cls : "");
    if (video) return '<video class="' + cls + '" src="' + esc(video) + '" muted playsinline preload="metadata"></video>';
    if (img) return '<img class="' + cls + '" src="' + esc(img) + '" alt="">';
    return '<div class="' + cls + '" style="display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px">' + esc(o.ph || "无画面") + "</div>";
  }

  /* 左栏分镜列表项 */
  function railItem(shot, currentId) {
    const video = shot.lipsyncUrl || shot.videoUrl || "";
    const img = shot.imageUrl || "";
    let media;
    if (video) media = '<video src="' + esc(video) + '" muted playsinline preload="metadata"></video>';
    else if (img) media = '<img src="' + esc(img) + '" alt="">';
    else media = '<div class="dw-rail-ph">第 ' + esc(shot.seq) + " 镜</div>";
    const st = shot.status || "pending";
    return '<div class="dw-rail-item' + (shot.id === currentId ? " on" : "") + '" data-rail="' + esc(shot.id) + '">' +
      media +
      '<div class="dw-rail-meta"><span class="dw-rail-idx">' + esc(shot.seq) + '</span><span class="dw-dot ' + esc(st) + '"></span></div>' +
      "</div>";
  }

  /* 模型选择条（委托给 D.models） */
  function modelBar(kind, o) {
    return (D.models && D.models.render) ? D.models.render(kind, o) : "";
  }

  /* 项目中心卡片 */
  function projectCard(p, coverUrl) {
    const genre = (D.GENRES.find(g => g.id === p.genre) || {}).name || p.genre || "未定剧种";
    const mode = p.mode === "pipeline" ? "流水线" : "导演台";
    const shots = (p.shots || []).length;
    const cover = coverUrl || p.thumb || "";
    const coverHtml = cover
      ? '<img src="' + esc(cover) + '" alt="">'
      : "<span>暂无封面</span>";
    const when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "";
    return '<div class="dw-pcard" data-pid="' + esc(p.id) + '">' +
      '<div class="dw-pcard-cover">' + coverHtml + "</div>" +
      '<div class="dw-pcard-body">' +
        '<div class="dw-pcard-title">' + esc(p.title || "未命名工程") + "</div>" +
        '<div class="dw-pcard-meta"><span>' + esc(genre) + "</span><span>" + shots + " 镜</span><span>" + esc(mode) + "</span>" +
        (when ? "<span>" + esc(when) + "</span>" : "") + "</div>" +
      "</div>" +
      '<div class="dw-pcard-acts">' +
        '<button class="btn small primary" data-pcard-open="' + esc(p.id) + '">打开</button>' +
        '<button class="btn small" data-pcard-makeup="' + esc(p.id) + '">造型</button>' +
        '<button class="btn small" data-pcard-copy="' + esc(p.id) + '">复制</button>' +
        '<button class="btn small ghost" data-pcard-del="' + esc(p.id) + '">删除</button>' +
      "</div>" +
      "</div>";
  }

  D.ui = { ensureCss, esc, opts, statusBadge, shotCard, renderShots, refreshShot, progress, bindShots, shotIds, complianceCard, bindCompliance, libPanel, bindLib, charDetails, emptyBox, skeleton, thumb, railItem, modelBar, projectCard };
})();
