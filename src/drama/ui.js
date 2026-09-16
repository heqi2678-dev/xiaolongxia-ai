/* 铜龙电商 · AI 短剧工作台 · 共用界面部件 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;
  let cssDone = false;

  const CSS = `
.dw-wrap{max-width:1180px;margin:0 auto;padding:0 4px;width:100%}
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
.dw-steps{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.dw-step{font-size:11px;padding:4px 10px;border-radius:20px;background:var(--panel);border:1px solid var(--border);color:var(--text2)}
.dw-step.on{border-color:var(--accent);color:var(--accent2)}
.dw-step.done{color:var(--green);border-color:#2b5a3a}
.dw-preview{width:100%;max-width:300px;border-radius:10px;background:#000;display:block}
.dw-char{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;background:var(--bg)}
.dw-char-refs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.dw-char-ref{width:44px;height:44px;border-radius:6px;object-fit:cover;border:1px solid var(--border)}
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

  D.ui = { ensureCss, esc, opts, statusBadge, shotCard, renderShots, refreshShot, progress, bindShots, shotIds };
})();
