/* 铜龙电商 · AI 短剧工作台 · 合成器与素材包导出 */
/* 浏览器合成：Canvas + WebAudio + MediaRecorder，输出 WebM（本地资源可用）。 */
/* 服务端合成：全部素材为公网 http(s) 时交给 ffmpeg，输出 mp4。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  function canvasSize(ratio) {
    const r = (D.RATIOS.find(x => x.id === ratio) || D.RATIOS[0]);
    const [w, h] = r.size;
    if (w >= h) { const nw = 1280; return { w: nw, h: Math.round(nw * h / w) }; }
    const nh = 1280; return { w: Math.round(nh * w / h), h: nh };
  }

  function pickMime() {
    const list = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    for (const m of list) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return "";
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(D.err("IMG_LOAD", "图片加载失败"));
      img.src = url;
    });
  }

  function loadVideo(url) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.onloadeddata = () => resolve(v);
      v.onerror = () => reject(D.err("VIDEO_LOAD", "视频加载失败"));
      v.src = url;
    });
  }

  function wrapText(ctx, text, maxWidth) {
    const chars = String(text || "").split("");
    const lines = [];
    let cur = "";
    for (const ch of chars) {
      if (ch === "\n") { lines.push(cur); cur = ""; continue; }
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = ch; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.slice(-3);
  }

  function drawCover(ctx, media, w, h, motion, t) {
    const mw = media.videoWidth || media.naturalWidth || media.width;
    const mh = media.videoHeight || media.naturalHeight || media.height;
    if (!mw || !mh) return;
    let scale = Math.max(w / mw, h / mh);
    let dx = (w - mw * scale) / 2;
    let dy = (h - mh * scale) / 2;
    const ease = t * t * (3 - 2 * t);
    if (motion === "zoom-in") scale *= 1 + 0.06 * ease;
    else if (motion === "zoom-out") scale *= 1.06 - 0.06 * ease;
    else if (motion === "pan-left") dx -= (w * 0.04) * (ease - 0.5);
    else if (motion === "pan-right") dx += (w * 0.04) * (ease - 0.5);
    const dw = mw * scale;
    const dh = mh * scale;
    ctx.drawImage(media, dx - (dw - w) / 2, dy - (dh - h) / 2, dw, dh);
  }

  function drawSubtitle(ctx, shot, w, h) {
    const text = (shot.line || "").trim();
    if (!text) return;
    const fs = Math.round(w * 0.038);
    ctx.save();
    ctx.font = "700 " + fs + "px system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineJoin = "round";
    const lines = wrapText(ctx, text, w * 0.86);
    const lh = fs * 1.35;
    let y = h - h * 0.09 - (lines.length - 1) * lh;
    lines.forEach(line => {
      ctx.lineWidth = Math.max(4, fs * 0.16);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(line, w / 2, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line, w / 2, y);
      y += lh;
    });
    ctx.restore();
  }

  function redraw(ctx, w, h, shot, media, motion, t, project) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    if (media) {
      try { drawCover(ctx, media, w, h, motion, t); } catch (e) {}
    }
    if (project.subtitle && project.subtitle.enabled !== false) drawSubtitle(ctx, shot, w, h);
    D.compliance.drawBadge(ctx, w, h);
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* 浏览器合成主流程：返回 WebM Blob */
  async function client(project, opts) {
    opts = opts || {};
    if (!window.MediaRecorder) throw D.err("NO_RECORDER", "当前浏览器不支持录制，请用服务端合成或换 Chrome/Edge");
    const v = D.project.validate(project);
    if (!v.ok) throw D.err("NOT_READY", "还不能合成，缺：" + v.missing.map(m => "第" + m.seq + "镜" + m.reason).join("、"));
    const c = D.compliance.verify(project);
    if (!c.ok) throw D.err("COMPLIANCE", c.blockers.join("；"));

    const { w, h } = canvasSize(project.output.ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");

    const fps = 30;
    const stream = canvas.captureStream(fps);
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const dest = ac.createMediaStreamDestination();

    const items = [];
    for (const shot of project.shots) {
      let media = null;
      if (shot.videoUrl) {
        try { media = await loadVideo(shot.videoUrl); } catch (e) { media = null; }
      }
      if (!media && shot.imageUrl) {
        try { media = await loadImage(shot.imageUrl); } catch (e) { media = null; }
      }
      let audio = null;
      if (shot.audioUrl) {
        audio = new Audio(shot.audioUrl);
        audio.crossOrigin = "anonymous";
        try {
          const node = ac.createMediaElementSource(audio);
          node.connect(dest);
          node.connect(ac.destination);
        } catch (e) { /* 已连接过则忽略 */ }
      }
      const dur = Math.max(1, Number(shot.duration) || (audio && isFinite(audio.duration) ? audio.duration : 3) || 3);
      items.push({ shot, media, audio, dur });
    }

    const combined = new MediaStream([].concat(stream.getVideoTracks(), dest.stream.getAudioTracks()));
    const mime = pickMime();
    const rec = new MediaRecorder(combined, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : { videoBitsPerSecond: 6000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    rec.start(200);

    if (ac.state === "suspended") { try { await ac.resume(); } catch (e) {} }

    const total = items.reduce((s, it) => s + it.dur, 0);
    let elapsed = 0;
    for (const it of items) {
      const start = performance.now();
      if (it.media && it.media.play && it.shot.videoUrl) { try { it.media.currentTime = 0; await it.media.play(); } catch (e) {} }
      if (it.audio) { try { it.audio.currentTime = 0; await it.audio.play(); } catch (e) {} }
      await new Promise(resolve => {
        function frame() {
          const dt = (performance.now() - start) / 1000;
          const t = Math.min(1, dt / it.dur);
          redraw(ctx, w, h, it.shot, it.media, it.shot.motion, t, project);
          if (opts.onProgress) opts.onProgress({ elapsed: elapsed + dt, total, shot: it.shot.seq });
          if (dt >= it.dur) { resolve(); return; }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      elapsed += it.dur;
      if (it.audio) { try { it.audio.pause(); } catch (e) {} }
      if (it.media && it.media.pause) { try { it.media.pause(); } catch (e) {} }
    }

    redraw(ctx, w, h, items[items.length - 1] ? items[items.length - 1].shot : { line: "" }, null, "static", 1, project);
    await wait(400);
    rec.stop();
    await stopped;
    try { ac.close(); } catch (e) {}
    return new Blob(chunks, { type: chunks[0] && chunks[0].type ? chunks[0].type : "video/webm" });
  }

  /* 服务端合成：素材必须都是公网 http(s)，由 ffmpeg 出 mp4 */
  async function server(project, opts) {
    opts = opts || {};
    const v = D.project.validate(project);
    if (!v.ok) throw D.err("NOT_READY", "还不能合成，缺：" + v.missing.map(m => "第" + m.seq + "镜" + m.reason).join("、"));
    const comp = D.compliance.verify(project);
    if (!comp.ok) throw D.err("COMPLIANCE", comp.blockers.join("；"));
    const allUrls = [];
    project.shots.forEach(s => { if (s.videoUrl) allUrls.push(s.videoUrl); if (s.imageUrl) allUrls.push(s.imageUrl); if (s.audioUrl) allUrls.push(s.audioUrl); if (s.lipsyncUrl) allUrls.push(s.lipsyncUrl); });
    const bad = allUrls.find(u => u.startsWith("asset:") || u.startsWith("blob:") || u.startsWith("data:"));
    if (bad) throw D.err("LOCAL_ASSET", "有本地素材，服务端合成需要先把素材上传或改用浏览器合成");
    const r = await fetch("/dian/api/drama/compose", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: sanitize(project) })
    });
    if (!r.ok) throw D.err("HTTP_" + r.status, "服务端合成失败");
    const j = await r.json();
    if (!j || !j.ok) throw D.err("COMPOSE_FAIL", (j && j.error) || "合成失败");
    return j;
  }

  function sanitize(project) {
    const copy = JSON.parse(JSON.stringify(project));
    copy.shots = (copy.shots || []).map(s => {
      const out = Object.assign({}, s);
      delete out.stale;
      return out;
    });
    delete copy._fallback;
    return copy;
  }

  function srt(project) {
    let t = 0;
    let out = "";
    const fmt = (sec) => {
      const ms = Math.round((sec % 1) * 1000);
      const s = Math.floor(sec) % 60;
      const m = Math.floor(sec / 60) % 60;
      const hh = Math.floor(sec / 3600);
      return String(hh).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(ms).padStart(3, "0");
    };
    project.shots.forEach((shot, i) => {
      const dur = Math.max(1, Number(shot.duration) || 3);
      if (shot.line && shot.line.trim()) {
        out += (i + 1) + "\n" + fmt(t) + " --> " + fmt(t + dur) + "\n" + shot.line.trim() + "\n\n";
      }
      t += dur;
    });
    return out;
  }

  function csv(project) {
    const rows = [["镜号", "名称", "画面提示词", "台词", "时长", "运镜", "角色", "状态"]];
    project.shots.forEach(s => {
      rows.push([
        s.seq, s.name || "", (s.prompt || "").replace(/\n/g, " "), (s.line || "").replace(/\n/g, " "),
        s.duration || "", s.motion || "",
        (s.roleIds || []).map(id => D.project.characterName(project, id)).join("/"),
        s.status || ""
      ]);
    });
    return rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(",")).join("\n");
  }

  async function fetchBlob(url) {
    if (!url) return null;
    try { return await fetch(url).then(r => r.blob()); } catch (e) { return null; }
  }

  /* 素材包：分镜画面/视频、配音、字幕、分镜表、合规说明、成片 */
  async function exportPack(project, composedBlob, opts) {
    opts = opts || {};
    const comp = D.compliance.verify(project);
    if (!comp.ok) throw D.err("COMPLIANCE", comp.blockers.join("；"));
    const files = [];
    for (const shot of project.shots) {
      const tag = String(shot.seq).padStart(2, "0");
      if (shot.videoUrl) {
        const b = await fetchBlob(shot.videoUrl);
        if (b) files.push({ name: "画面/" + tag + ".mp4", content: b });
      } else if (shot.imageUrl) {
        const b = await fetchBlob(shot.imageUrl);
        if (b) files.push({ name: "画面/" + tag + ".png", content: b });
      }
      if (shot.audioUrl) {
        const b = await fetchBlob(shot.audioUrl);
        if (b) files.push({ name: "配音/" + tag + ".mp3", content: b });
      }
    }
    files.push({ name: "字幕.srt", content: srt(project) });
    files.push({ name: "分镜表.csv", content: "\ufeff" + csv(project) });
    files.push({ name: "AI生成说明.txt", content: D.compliance.sidecar(project) });
    files.push({ name: "使用说明.txt", content: exportReadme(project) });
    if (composedBlob) {
      const ext = composedBlob.type.indexOf("mp4") >= 0 ? "mp4" : "webm";
      files.push({ name: "成片." + ext, content: composedBlob });
    }
    return U.ZIP.make(files);
  }

  function exportReadme(project) {
    return [
      "《" + project.title + "》AI 短剧素材包",
      "",
      "目录说明：",
      "- 画面/：每个分镜的画面或视频，按镜号排序",
      "- 配音/：每个分镜的配音 mp3",
      "- 字幕.srt：可直接导入剪映的字幕文件",
      "- 分镜表.csv：分镜提示词与台词对照表",
      "- AI生成说明.txt：本作品的 AI 生成标注信息",
      "- 成片：若已合成则附带成片文件",
      "",
      "二次剪辑提示：",
      "1. 打开剪映，新建草稿，导入「画面/」与「配音/」。",
      "2. 按镜号顺序排列，导入「字幕.srt」自动生成字幕。",
      "3. 导出前请保留 AI 生成标注，遵守平台规范。",
      "",
      "合规提醒：本作品含 AI 生成内容，发布时请按平台要求标注。"
    ].join("\n");
  }

  D.compose = { client, server, srt, csv, exportPack, canvasSize, drawCover, drawSubtitle };
})();
