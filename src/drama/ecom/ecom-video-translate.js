/* 铜龙电商ai助手 · 电商工作台 · AI 视频 · 视频翻译（STT + LLM 翻译 + TTS 配音 + 字幕 + 画面文字 OCR） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const LANGS = (EC.const && EC.const.VIDEO_LANGS) || ["简体中文", "繁体中文", "英语", "泰语", "俄语", "越南语", "马来语", "葡萄牙语", "西班牙语", "日语", "韩语", "德语", "法语", "荷兰语", "波兰语", "土耳其语", "印尼语", "菲律宾语"];
  const LANG_EN = { "简体中文": "zh", "繁体中文": "zh-TW", "英语": "en", "泰语": "th", "俄语": "ru", "越南语": "vi",
    "马来语": "ms", "葡萄牙语": "pt", "西班牙语": "es", "日语": "ja", "韩语": "ko", "德语": "de", "法语": "fr",
    "荷兰语": "nl", "波兰语": "pl", "土耳其语": "tr", "印尼语": "id", "菲律宾语": "fil" };
  /* 预设字幕样式（对齐 51aic video_translation_config）：文字颜色 + 描边颜色 */
  const SUB_STYLES = [
    { name: "经典白", color: "#FFFFFF", outline: "#8E8A87", w: 1 },
    { name: "天蓝白", color: "#B6D9F2", outline: "#000000", w: 1 },
    { name: "浪漫粉", color: "#FFFFFF", outline: "#E899A1", w: 1 },
    { name: "纯黑字", color: "#000000", outline: "", w: 0 },
    { name: "描边白", color: "#FFFFFF", outline: "#000000", w: 1 }
  ];
  const SUB_POS = ["底部", "中部", "顶部"];
  const SUB_POS_EN = { "底部": "bottom", "中部": "middle", "顶部": "top" };
  const MAX_MB = 100;

  const HTML = `<div class="inner">
    <div class="page-head">
      <h1>视频翻译</h1>
      <p>上传原视频，自动识别语音、翻译成目标语言、生成配音与新字幕，可选对口型与画面文字翻译。</p>
    </div>

    <div class="split" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-globe"/></svg>翻译设置</div>
        <div class="panel-body">
          <div class="field">
            <label>原视频（MP4 / WebM，≤100MB）</label>
            <div class="dropzone" data-src>
              <div class="dz-ic"><svg class="ic"><use href="#i-upload"/></svg></div>
              <b>点击/拖拽/粘贴上传原视频</b>
              <p>本地上传，或粘贴下方链接</p>
            </div>
            <div class="ref-row" style="margin-top:8px;display:flex;gap:8px">
              <input class="inp" data-link placeholder="粘贴视频链接 https://…" style="flex:1">
              <button class="btn btn-ghost" data-link-load style="width:auto;padding:0 14px">载入</button>
            </div>
          </div>

          <div class="field">
            <label>翻译模式</label>
            <div class="chips" data-group="mode">
              <div class="chip on" data-mode="voice">仅翻译语音</div>
              <div class="chip" data-mode="dub">翻译语音+对口型</div>
            </div>
          </div>

          <div class="field">
            <label>目标语言</label>
            <div class="select" data-lang>请选择目标语言 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
          </div>

          <div class="field">
            <label>视频时长</label>
            <div class="chips" data-group="dur">
              <div class="chip on">自然语速优先</div>
              <div class="chip">与原视频时长一致</div>
            </div>
          </div>

          <div class="field">
            <label>配音音色</label>
            <div class="select" data-voice>自动匹配音色 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
          </div>
          <div class="field">
            <div class="switch-row">
              <div><b>原声处理 / 去除背景音乐</b><span>仅保留人声用于识别与翻译</span></div>
              <div class="switch"></div>
            </div>
          </div>
          <div class="field">
            <div class="switch-row">
              <div><b>画面文字翻译</b><span>识别视频画面文字并翻译（OCR）</span></div>
              <div class="switch off" data-ocr></div>
            </div>
          </div>

          <div class="field">
            <div class="label-row"><label>是否需要新字幕</label><span class="note" style="font-size:12px;color:var(--muted)">按识别结果生成目标语言字幕</span></div>
            <div class="chips" data-group="subneed">
              <div class="chip on">需要</div>
              <div class="chip">不需要</div>
            </div>
          </div>
          <div class="field" data-subbox>
            <label>预设字幕样式</label>
            <div class="chips sub-style-chips" data-group="substyle">
              ${SUB_STYLES.map(function (s, i) {
                return '<div class="chip sub-style' + (i === 0 ? " on" : "") + '" data-substyle="' + esc(s.name) + '">'
                  + '<span class="sub-prev" style="color:' + s.color + ';' + (s.w ? '-webkit-text-stroke:' + s.w + 'px ' + s.outline + ';text-shadow:0 0 ' + s.w + 'px ' + s.outline : '') + '">字幕</span>'
                  + '<em>' + esc(s.name) + '</em></div>';
              }).join("")}
            </div>
            <div class="chips" data-group="subpos" style="margin-top:8px">
              <div class="chip on">底部</div>
              <div class="chip">中部</div>
              <div class="chip">顶部</div>
            </div>
            <button class="btn btn-ghost sub-pos-entry" data-subpos-open style="width:auto;margin-top:10px;padding:6px 12px;font-size:12.5px"><svg class="ic sm"><use href="#i-layers"/></svg>字幕位置 · 可点击进入详细设置</button>
            <label style="margin-top:10px;display:block">字幕字号</label>
            <div class="stepper" data-stepper="subfont" data-min="32" data-max="128" data-step="8" data-val="64">
              <button class="step-btn" data-step-dec>-</button>
              <span class="step-val" data-step-val>64</span>
              <button class="step-btn" data-step-inc>+</button>
            </div>
            <label style="margin-top:10px;display:block">行间距</label>
            <div class="stepper" data-stepper="subline" data-min="1" data-max="2" data-step="0.1" data-val="1.2">
              <button class="step-btn" data-step-dec>-</button>
              <span class="step-val" data-step-val>1.2</span>
              <button class="step-btn" data-step-inc>+</button>
            </div>
          </div>

          <div class="field" data-fallback hidden>
            <label>语音识别未配置 · 可手动填写口播脚本</label>
            <textarea class="inp" data-script rows="4" placeholder="粘贴或输入视频口播文字，留空则仅做画面/字幕处理"></textarea>
          </div>

          <button class="btn btn-primary" data-run><svg class="ic sm"><use href="#i-spark"/></svg>生成视频</button>
          <button class="btn btn-ghost" data-save style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>保存到作品库</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-play"/></svg>翻译结果</div>
        <div class="panel-body">
          <div class="stage" data-stage style="position:relative;min-height:220px;display:flex;align-items:center;justify-content:center;background:#0e0f13;border-radius:12px;overflow:hidden;color:#8a94a6">
            <span data-empty>上传原视频后开始翻译</span>
            <video data-player controls playsinline style="width:100%;max-height:320px;display:none"></video>
            <button type="button" class="unmute-hint" data-unmute hidden><svg class="ic sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>点击开启声音</button>
          </div>
          <div data-bar hidden style="margin-top:12px">
            <div style="height:6px;border-radius:6px;background:#eef0f4;overflow:hidden"><i data-bar-fill style="display:block;height:100%;width:0;background:linear-gradient(90deg,var(--primary),var(--primary-2));transition:.2s"></i></div>
            <div class="note" data-bar-text style="margin-top:6px;font-size:12px;color:var(--muted)">准备中…</div>
          </div>
          <audio data-audio controls style="width:100%;margin-top:12px;display:none"></audio>
          <div data-subs style="margin-top:12px;max-height:220px;overflow-y:auto"></div>
          <div data-log style="margin-top:14px"></div>
          <div class="note" data-hint style="margin-top:12px;font-size:12px;color:var(--muted)">支持 18 种语言；缺少语音识别或配音配置时会在流程中给出提示。</div>
        </div>
      </div>
    </div>
  </div>`;

  function pickChip(el, group) {
    const n = el.querySelector('.chips[data-group="' + group + '"] .chip.on');
    return n ? n.textContent.trim() : "";
  }
  function pickStyle(el) {
    const n = el.querySelector('.chips[data-group="substyle"] .chip.on');
    return (n && n.getAttribute("data-substyle")) || SUB_STYLES[0].name;
  }
  function stepVal(el, name, dflt) {
    const n = el.querySelector('[data-stepper="' + name + '"]');
    if (!n) return dflt;
    const v = Number(n.getAttribute("data-val"));
    return isFinite(v) ? v : dflt;
  }
  function stepBy(el, name, dir) {
    const n = el.querySelector('[data-stepper="' + name + '"]');
    if (!n) return;
    const min = Number(n.getAttribute("data-min")), max = Number(n.getAttribute("data-max"));
    const step = Number(n.getAttribute("data-step")) || 1;
    let v = Number(n.getAttribute("data-val"));
    if (!isFinite(v)) v = min;
    v = Math.min(max, Math.max(min, v + dir * step));
    v = Math.round(v * 100) / 100;
    n.setAttribute("data-val", String(v));
    const out = n.querySelector("[data-step-val]"); if (out) out.textContent = String(v);
  }
  function set(el, sel, text) { const n = el.querySelector(sel); if (n) n.textContent = text; }
  function bar(el, pct, text) {
    const wrap = el.querySelector("[data-bar]"); if (wrap) wrap.hidden = false;
    const fill = el.querySelector("[data-bar-fill]"); if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    if (text != null) set(el, "[data-bar-text]", text);
  }
  function log(el, text) {
    const box = el.querySelector("[data-log]"); if (!box) return;
    const line = EC.ui.el("div", "note", esc(text));
    line.style.cssText = "font-size:12px;color:var(--text2);padding:4px 0;border-bottom:1px dashed var(--border)";
    box.appendChild(line);
  }
  function renderSubs(el, utterances) {
    const box = el.querySelector("[data-subs]"); if (!box) return;
    box.innerHTML = "";
    (utterances || []).forEach(function (u, i) {
      const row = EC.ui.el("div", "", '<span style="color:var(--muted);font-size:11px">#' + (i + 1) + " " + fmt(u.start) + "</span>"
        + '<div style="font-size:13px">' + esc(u.text || "") + "</div>"
        + (u.target ? '<div style="font-size:13px;color:var(--primary);font-weight:600">' + esc(u.target) + "</div>" : ""));
      row.style.cssText = "padding:7px 0;border-bottom:1px dashed var(--border)";
      box.appendChild(row);
    });
  }
  function fmt(sec) {
    const s = Number(sec) || 0;
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* 抽帧：把视频首帧画到 canvas，返回 base64（不带前缀） */
  function grabFrame(video) {
    return new Promise(function (res, rej) {
      try {
        const w = video.videoWidth || 720, h = video.videoHeight || 1280;
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(video, 0, 0, w, h);
        res(cv.toDataURL("image/jpeg", 0.88).split(",")[1]);
      } catch (e) { rej(e); }
    });
  }
  function seekTo(video, t) {
    return new Promise(function (res) {
      var done = false;
      function fin() { if (done) return; done = true; video.removeEventListener("seeked", fin); res(); }
      video.addEventListener("seeked", fin);
      try { video.currentTime = t; } catch (e) { fin(); }
      setTimeout(fin, 1500);
    });
  }
  /* 沿时间轴均匀抽帧，用于画面文字识别（最多 4 帧，去重后翻译） */
  async function grabFrames(video, n) {
    const dur = Number(video.duration);
    const count = Math.max(1, Math.min(4, n || 4));
    const out = [];
    if (!isFinite(dur) || dur <= 0) { out.push(await grabFrame(video)); return out; }
    for (let i = 0; i < count; i++) {
      const t = Math.min(Math.max(0.1, dur * (i + 0.5) / count), Math.max(0.1, dur - 0.1));
      await seekTo(video, t);
      try { out.push(await grabFrame(video)); } catch (e) {}
    }
    return out;
  }
  async function translateLines(lines, lang) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const t = String(lines[i] || "").trim();
      if (!t) { out.push(""); continue; }
      try {
        const r = await EC.gen.ask(
          "你是专业视频字幕翻译，只输出翻译结果，不要解释、不要引号、不要编号。",
          "把下面这句口播翻译成" + lang + "：" + t
        );
        out.push(String(r || "").trim().split("\n")[0] || t);
      } catch (e) { out.push(t); }
    }
    return out;
  }

  async function run(el, btn) {
    const video = el.querySelector("[data-player]");
    const modeChip = el.querySelector('.chips[data-group="mode"] .chip.on');
    const mode = (modeChip && modeChip.getAttribute("data-mode")) || "voice";
    const langNode = el.querySelector("[data-lang]");
    const lang = langNode ? langNode.textContent.split("\n")[0].trim() : "";
    if (!lang || lang === "请选择目标语言") { EC.toast("请选择目标语言"); return; }
    const subOn = pickChip(el, "subneed") !== "不需要";
    const ocrOn = el.querySelector("[data-ocr]") && !el.querySelector("[data-ocr]").classList.contains("off");
    const srcAsset = el.__vt && el.__vt.src;
    if (!srcAsset) { EC.toast("请先上传原视频"); return; }
    EC.ui.busy(btn, true, "翻译中…");
    el.querySelector("[data-log]").innerHTML = "";
    bar(el, 4, "上传原视频到公网…");
    try {
      const url = await EC.store.publicUrl(srcAsset);
      if (video) video.src = EC.store.src(srcAsset);

      let text = "";
      let utterances = [];
      if (EC.gen.sttConfigured()) {
        bar(el, 20, "识别语音（STT）…");
        const r = await EC.gen.stt({ url: url, language: "" });
        text = r.text || "";
        utterances = r.utterances || [];
        log(el, "语音识别完成：" + (utterances.length || (text ? 1 : 0)) + " 段");
      } else {
        const manual = (el.querySelector("[data-script]") || {}).value || "";
        text = manual.trim();
        log(el, text ? "未配置 STT，使用手动脚本" : "未配置 STT，跳过语音翻译");
      }

      let translated = "";
      if (text && EC.gen.llmConfigured()) {
        bar(el, 42, "翻译成" + lang + "…");
        const lines = utterances.length ? utterances.map(u => u.text) : String(text).split(/[。！？\n]/).filter(Boolean);
        const outs = await translateLines(lines, lang);
        translated = outs.join(" ");
        if (utterances.length) utterances = utterances.map((u, i) => Object.assign({}, u, { target: outs[i] || "" }));
        log(el, "翻译完成：" + lang);
      } else {
        translated = text;
        if (text) log(el, "未配置语言模型，保留原文");
      }

      let audioUrl = "";
      if (translated && EC.gen.ttsConfigured()) {
        bar(el, 62, "生成目标语言配音…");
        try {
          const a = await EC.gen.tts({ text: translated });
          audioUrl = a.url || "";
          log(el, "配音已生成");
        } catch (e) { log(el, "配音失败：" + ((e && e.message) || e)); }
      } else if (translated) {
        log(el, "未配置语音合成，跳过配音");
      }

      let outUrl = url;
      if (mode === "dub" && EC.gen.lipsyncConfigured() && audioUrl) {
        bar(el, 78, "对口型合成…");
        try {
          const ls = await EC.gen.lipsync({ videoUrl: url, audioUrl: audioUrl }, function (d, t) {
            if (t) bar(el, 78 + Math.round(d / t * 12), "对口型 " + d + "/" + t);
          });
          outUrl = (ls && ls.url) || url;
          log(el, "对口型完成");
        } catch (e) { log(el, "对口型失败：" + ((e && e.message) || e)); }
      } else if (mode === "dub") {
        log(el, "未配置对口型，输出翻译语音与原视频");
      }

      let textTranslate = [];
      if (ocrOn && EC.gen.ocrConfigured() && video) {
        bar(el, 86, "识别画面文字（OCR）…");
        try {
          const frames = await grabFrames(video, 4);
          const seen = {}, items = [];
          for (let fi = 0; fi < frames.length; fi++) {
            let ocr;
            try { ocr = await EC.gen.ocr({ imageBase64: frames[fi] }); } catch (e) { continue; }
            const list = (ocr.items && ocr.items.length ? ocr.items : (ocr.text ? String(ocr.text).split(/\n+/) : []))
              .map(function (s) { return String(s || "").trim(); }).filter(Boolean);
            list.forEach(function (s) { if (!seen[s]) { seen[s] = 1; items.push(s); } });
          }
          if (items.length) {
            const picks = items.slice(0, 12);
            const outs = await translateLines(picks, lang);
            textTranslate = picks.map((s, i) => ({ src: s, dst: outs[i] || "" }));
            log(el, "画面文字翻译：" + textTranslate.length + " 条（抽帧 " + frames.length + " 张）");
          } else { log(el, "画面未识别到文字"); }
        } catch (e) { log(el, "画面文字翻译失败：" + ((e && e.message) || e)); }
      }

      const fontPx = stepVal(el, "subfont", 64);
      const lineVal = stepVal(el, "subline", 1.2);
      const subStyle = {
        preset: pickStyle(el),
        pos: SUB_POS_EN[pickChip(el, "subpos")] || "bottom",
        size: (fontPx / 64) * 0.046,
        lineHeight: lineVal
      };
      if (el.__vt && el.__vt.subXY) { subStyle.x = el.__vt.subXY.x; subStyle.y = el.__vt.subXY.y; }
      let cues = [];
      if (subOn) {
        if (utterances.length) {
          cues = utterances.map(function (u) {
            return { start: Number(u.start) || 0, end: Number(u.end) || 0, text: u.target || u.text || "" };
          }).filter(function (c) { return c.text; });
        } else if (translated) {
          const dur = (video && isFinite(video.duration) && video.duration > 0) ? video.duration : 8;
          cues = [{ start: 0, end: dur, text: translated }];
        }
      }
      const overlays = textTranslate.map(function (t) { return { text: t.dst || "" }; }).filter(function (o) { return o.text; });

      let burned = false;
      if (outUrl && (cues.length || overlays.length)) {
        bar(el, 94, "烧制字幕与画面文字…");
        try {
          const r = await EC.gen.subtitle({ video: outUrl, cues: cues, overlays: overlays, style: subStyle, id: "translate" });
          if (r && r.url) { outUrl = r.url; burned = true; log(el, "字幕烧制完成"); }
        } catch (e) { log(el, "字幕烧制失败：" + ((e && e.message) || e)); }
      }

      bar(el, 100, "完成");
      const asset = await EC.store.addFromUrl(outUrl, {
        name: "视频翻译 · " + lang, kind: "video",
        meta: {
          mode: "translate", mode2: mode, lang: lang, source: url, audio: audioUrl,
          utterances: utterances,
          subtitle: subOn ? {
            style: subStyle.preset, pos: pickChip(el, "subpos"), font: fontPx,
            line: lineVal, size: subStyle.size, lineHeight: subStyle.lineHeight,
            burned: burned, text: translated
          } : null,
          textTranslate: textTranslate, provider: "translate"
        }
      });
      el.__vt.result = asset;
      const player = el.querySelector("[data-player]");
      if (player && outUrl && outUrl !== url) player.src = outUrl;
      const empty = el.querySelector("[data-empty]"); if (empty) empty.style.display = "none";
      if (player) {
        player.style.display = "block";
        const un = el.querySelector("[data-unmute]");
        if (un) {
          player.muted = true;
          try { const p = player.play(); if (p && p.catch) p.catch(function () {}); } catch (e2) {}
          un.hidden = false;
        }
      }
      const audioBox = el.querySelector("[data-audio]");
      if (audioUrl && audioBox) { audioBox.src = audioUrl; audioBox.style.display = "block"; }
      renderSubs(el, utterances);
      if (EC.addUsage) EC.addUsage({ generated: 1 });
      EC.toast("视频翻译完成");
    } catch (e) {
      bar(el, 100, "失败");
      EC.toast((e && e.message) || "翻译失败");
      log(el, "失败：" + ((e && e.message) || e));
    } finally { EC.ui.busy(btn, false); }
  }

  async function save(el) {
    if (!el.__vt || !el.__vt.result) { EC.toast("请先完成视频翻译"); return; }
    EC.toast("已保存到作品库");
    EC.go("ecomGallery");
  }

  function subPosDialog(el) {
    if (!el.__vt) return;
    const chipPos = SUB_POS_EN[pickChip(el, "subpos")] || "bottom";
    const fallback = chipPos === "top" ? { x: 0.5, y: 0.1 } : chipPos === "middle" ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.9 };
    let sel = el.__vt.subXY ? { x: el.__vt.subXY.x, y: el.__vt.subXY.y } : fallback;
    const PX = [0.08, 0.5, 0.92], PY = [0.1, 0.5, 0.9];
    const grid = PY.map(function (y) {
      return PX.map(function (x) {
        return '<div class="subpos-cell" data-px="' + x + '" data-py="' + y + '"><i></i></div>';
      }).join("");
    }).join("");
    const body = '<div class="subpos-wrap">'
      + '<div class="subpos-preview"><div class="subpos-frame"><span class="subpos-bar" data-subpos-bar>字幕位置预览</span></div></div>'
      + '<div><div class="subpos-grid">' + grid + '</div><div class="subpos-tip">点击九宫格选择字幕所在位置，左侧预览实时更新。</div></div>'
      + '</div>'
      + '<div class="subpos-foot"><button class="btn btn-ghost" data-subpos-cancel style="width:auto;padding:8px 20px">取消</button>'
      + '<button class="btn btn-primary" data-subpos-ok style="width:auto;padding:8px 20px">确定</button></div>';
    const m = EC.ui.modal({ title: "字幕位置 · 详细设置", body: body, wide: true });
    const bar = m.body.querySelector("[data-subpos-bar]");
    function paint() {
      if (bar) { bar.style.left = (sel.x * 100) + "%"; bar.style.top = (sel.y * 100) + "%"; }
      m.body.querySelectorAll(".subpos-cell").forEach(function (c) {
        c.classList.toggle("on", Number(c.getAttribute("data-px")) === sel.x && Number(c.getAttribute("data-py")) === sel.y);
      });
    }
    paint();
    m.body.addEventListener("click", function (e) {
      const cell = e.target.closest(".subpos-cell");
      if (cell) { sel = { x: Number(cell.getAttribute("data-px")), y: Number(cell.getAttribute("data-py")) }; paint(); return; }
      if (e.target.closest("[data-subpos-cancel]")) { m.close(); return; }
      if (e.target.closest("[data-subpos-ok]")) {
        el.__vt.subXY = { x: sel.x, y: sel.y };
        m.close();
        EC.toast("字幕位置已更新");
      }
    });
  }

  EC.register("ecomVideoTranslate", function (el) {
    if (!el.__vt) el.__vt = { src: null, result: null };
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
    const fb = el.querySelector("[data-fallback]");
    if (fb) fb.hidden = EC.gen.sttConfigured();
    if (el.__vt.src) {
      const dz = el.querySelector("[data-src]");
      if (dz) dz.innerHTML = '<video src="' + esc(EC.store.src(el.__vt.src)) + '" muted playsinline style="width:100%;border-radius:10px"></video>';
    }
    if (el.__ecomVtBound) return;
    el.__ecomVtBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const un = e.target.closest("[data-unmute]");
      if (un) {
        const player = el.querySelector("[data-player]");
        if (player) { player.muted = false; player.volume = 1; try { const p = player.play(); if (p && p.catch) p.catch(function () {}); } catch (e2) {} }
        un.hidden = true;
        return;
      }
      const inc = e.target.closest("[data-step-inc]");
      if (inc) { stepBy(el, inc.closest("[data-stepper]").getAttribute("data-stepper"), 1); return; }
      const dec = e.target.closest("[data-step-dec]");
      if (dec) { stepBy(el, dec.closest("[data-stepper]").getAttribute("data-stepper"), -1); return; }
      const voice = e.target.closest("[data-voice]");
      if (voice) {
        e.stopPropagation();
        const cur = voice.textContent.split("\n")[0].trim();
        EC.ui.menu(voice, ["自动匹配音色", "活力女声", "沉稳男声", "温柔女声"].map(function (o) {
          return { label: o, on: o === cur, pick: function () { voice.innerHTML = esc(o) + ' <svg class="ic sm"><use href="#i-arrow"/></svg>'; } };
        }));
        return;
      }
      const spo = e.target.closest("[data-subpos-open]");
      if (spo) { subPosDialog(el); return; }
      const needChip = e.target.closest('.chips[data-group="subneed"] .chip');
      if (needChip) {
        const box = el.querySelector("[data-subbox]");
        if (box) box.hidden = needChip.textContent.trim() === "不需要";
        return;
      }
      const subChip = e.target.closest('.chips[data-group="subpos"] .chip');
      if (subChip) { if (el.__vt) el.__vt.subXY = null; return; }
      const src = e.target.closest("[data-src]");
      if (src) {
        EC.ui.pickFiles("video/mp4,video/webm", false).then(function (files) {
          if (!files.length) return;
          const f = files[0];
          if (f.size > MAX_MB * 1024 * 1024) { EC.toast("视频超过 " + MAX_MB + "MB，请压缩后再上传"); return; }
          EC.store.addFile(f, { kind: "upload" }).then(function (a) {
            el.__vt.src = a;
            src.innerHTML = '<video src="' + esc(EC.store.src(a)) + '" muted playsinline style="width:100%;border-radius:10px"></video>';
            const empty = el.querySelector("[data-empty]"); if (empty) empty.style.display = "none";
            const player = el.querySelector("[data-player]"); if (player) { player.src = EC.store.src(a); player.style.display = "block"; }
            EC.toast("原视频已载入");
          });
        });
        return;
      }
      const loadBtn = e.target.closest("[data-link-load]");
      if (loadBtn) {
        const link = (el.querySelector("[data-link]") || {}).value || "";
        if (!/^https?:\/\//i.test(link.trim())) { EC.toast("请填写有效的视频链接"); return; }
        EC.store.addFromUrl(link.trim(), { kind: "upload", name: "链接视频" }).then(function (a) {
          el.__vt.src = a;
          const dz = el.querySelector("[data-src]");
          if (dz) dz.innerHTML = '<video src="' + esc(EC.store.src(a)) + '" muted playsinline style="width:100%;border-radius:10px"></video>';
          EC.toast("链接视频已载入");
        });
        return;
      }
      const lang = e.target.closest("[data-lang]");
      if (lang) {
        e.stopPropagation();
        const cur = lang.textContent.split("\n")[0].trim();
        EC.ui.menu(lang, LANGS.map(function (o) {
          return { label: o, on: o === cur, pick: function () { lang.innerHTML = esc(o) + ' <svg class="ic sm"><use href="#i-arrow"/></svg>'; } };
        }));
        return;
      }
      const runBtn = e.target.closest("[data-run]");
      if (runBtn) { run(el, runBtn); return; }
      const sv = e.target.closest("[data-save]");
      if (sv) { save(el); return; }
    });
  });
})();
