/* 铜龙电商 · AI 短剧工作台 · 三轨时间轴与逐帧播放 */
/* 计算部分为纯函数（便于单测）；渲染部分只依赖传入的工程对象。 */
(function () {
  const D = XLX.drama;

  function dur(s) { return D.project.effDuration(s); }

  function total(project) {
    return ((project && project.shots) || []).reduce((sum, s) => sum + dur(s), 0);
  }

  /* 镜头段区间：优先取工程已同步的 takes，按分镜时间轴换算段起止 */
  function takes(project, opts) {
    opts = opts || {};
    const segs = layout(project);
    if (!segs.length) return [];
    const byId = {};
    segs.forEach(s => { byId[s.sid] = s; });
    let src = (project && Array.isArray(project.takes)) ? project.takes : [];
    if (!src.length && D.takes && D.takes.group) {
      src = D.takes.group(project, opts).map((g, i) => ({ id: "t" + (i + 1), seq: i + 1, shotIds: g.shotIds }));
    }
    return src.map((t, i) => {
      const ids = (t.shotIds || []).slice();
      let start = null;
      let end = null;
      ids.forEach(id => {
        const s = byId[id];
        if (!s) return;
        if (start === null || s.start < start) start = s.start;
        if (end === null || s.end > end) end = s.end;
      });
      if (start === null) { start = 0; end = 0; }
      return { takeId: t.id || ("t" + (i + 1)), seq: t.seq || i + 1, start, end, shotIds: ids };
    });
  }

  /* 每镜在时间轴上的区间，start/end 单位秒，连续无缝 */
  function layout(project) {
    let t = 0;
    return ((project && project.shots) || []).map(s => {
      const d = dur(s);
      const tr = D.project.trimOf(s);
      const seg = {
        sid: s.id,
        seq: s.seq,
        name: s.name || ("分镜 " + s.seq),
        start: t,
        end: t + d,
        duration: d,
        footage: Number(s.duration) > 0 ? Number(s.duration) : d,
        trimmed: !!tr.on,
        hasAudio: !!s.audioUrl,
        hasSubtitle: !!(s.line && String(s.line).trim()),
        status: s.status || "pending"
      };
      t += d;
      return seg;
    });
  }

  /* 时间点归属：t 落在 [0,total) 内返回唯一分镜；越界夹到首尾 */
  function shotAt(project, time) {
    const segs = layout(project);
    if (!segs.length) return null;
    const t = Number(time) || 0;
    if (t < 0) return segs[0];
    for (const seg of segs) if (t >= seg.start && t < seg.end) return seg;
    return segs[segs.length - 1];
  }

  /* 逐帧步进（秒），dir>0 前进，dir<0 后退，下限 0 */
  function frameStep(current, dir, fps) {
    const f = Number(fps) > 0 ? Number(fps) : 30;
    const c = Number(current) || 0;
    const next = c + (Number(dir) >= 0 ? 1 : -1) / f;
    return next < 0 ? 0 : next;
  }

  function fmt(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function render(project, o) {
    o = o || {};
    const segs = layout(project);
    const tot = total(project) || 1;
    const cur = o.currentShotId || "";
    const row = (kind, head, pick) =>
      '<div class="dw-track-head">' + head + "</div>" +
      '<div class="dw-track dw-track-' + kind + '" data-track="' + kind + '">' +
      segs.map(seg => {
        const w = ((seg.end - seg.start) / tot) * 100;
        const has = pick(seg);
        return '<div class="dw-clip' + (seg.sid === cur ? " on" : "") + (has ? "" : " empty") +
          (seg.trimmed ? " trimmed" : "") +
          ' dw-st-' + D.ui.esc(seg.status) + '" data-sid="' + D.ui.esc(seg.sid) + '" data-start="' + seg.start +
          '" data-end="' + seg.end + '" style="width:' + w.toFixed(3) + '%" title="第' + seg.seq + "镜 " + D.ui.esc(seg.name) +
          (seg.trimmed ? "（裁剪后 " + seg.duration.toFixed(1) + "s / 原片 " + seg.footage.toFixed(1) + "s）" : "") + '">' +
          "<span>" + seg.seq + "</span></div>";
      }).join("") +
      "</div>";

    const takesRow = () => {
      const ts = takes(project);
      if (!ts.length) return "";
      const tot = total(project) || 1;
      return '<div class="dw-take-marks">' + ts.map(t => {
        const w = ((t.end - t.start) / tot) * 100;
        return '<div class="dw-take-mark" data-take="' + D.ui.esc(t.takeId) + '" data-start="' + t.start +
          '" data-end="' + t.end + '" data-sid="' + D.ui.esc(t.shotIds[0] || "") +
          '" style="width:' + w.toFixed(3) + '%" title="段' + t.seq + '"><span>段 ' + t.seq + "</span></div>";
      }).join("") + "</div>";
    };

    return '<div class="dw-timeline" data-total="' + total(project) + '">' +
      '<div class="dw-timeline-hud"><span>总时长 ' + fmt(total(project)) + "</span><span>共 " + segs.length + " 镜</span></div>" +
      takesRow() +
      row("video", "画面", () => true) +
      row("audio", "配音", (s) => s.hasAudio) +
      row("subtitle", "字幕", (s) => s.hasSubtitle) +
      "</div>";
  }

  /* 点击某轨片段：定位到该镜并按横向比例 seek */
  function bind(root, project, o) {
    o = o || {};
    root.querySelectorAll(".dw-take-mark").forEach(el => {
      el.onclick = (e) => {
        if (o.onTake) { o.onTake(el.dataset.take); return; }
        const sid = el.dataset.sid;
        const start = Number(el.dataset.start) || 0;
        if (o.onSeek) o.onSeek(sid, start);
        if (o.onSelect) o.onSelect(sid);
      };
    });
    root.querySelectorAll(".dw-clip").forEach(el => {
      el.onclick = (e) => {
        const sid = el.dataset.sid;
        const start = Number(el.dataset.start) || 0;
        const end = Number(el.dataset.end) || start;
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, width: 0 };
        const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0;
        if (o.onSeek) o.onSeek(sid, start + (end - start) * ratio);
        if (o.onSelect) o.onSelect(sid);
      };
    });
  }

  D.timeline = { total, layout, takes, shotAt, frameStep, fmt, render, bind };
})();
