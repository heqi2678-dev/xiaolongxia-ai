/* 铜龙电商ai助手 · 电商工作台 · AI 工具箱（16 项：本地 Canvas 即改即存 + AI 生成） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  /* 16 项，顺序对齐 51aic：生成型在前 */
  const TOOLS = [
    { id: "eraser", label: "消除笔", kind: "gen", icon: "wand", hint: "涂抹/框选要消除的区域，AI 智能抹除", fields: ["prompt"] },
    { id: "aiproduct", label: "AI 商品图", kind: "gen", icon: "poster", hint: "用 AI 生成商品展示图", fields: ["prompt", "ratio"] },
    { id: "aimodel", label: "AI 模特", kind: "gen", icon: "spark", hint: "给商品换上 AI 模特", fields: ["prompt", "ratio"] },
    { id: "outpaint", label: "AI 扩图", kind: "gen", icon: "crop", hint: "向四周扩展画布并由 AI 补全", fields: ["ratio", "prompt"] },
    { id: "crop", label: "尺寸裁剪", kind: "canvas", icon: "crop", hint: "按区域裁剪图片", fields: ["crop"] },
    { id: "resize", label: "修改尺寸", kind: "canvas", icon: "crop", hint: "调整图片宽高", fields: ["size"] },
    { id: "sizelabel", label: "尺码标注", kind: "gen", icon: "layers", hint: "生成带尺码标注的图片", fields: ["prompt"] },
    { id: "watermark", label: "加水印", kind: "canvas", icon: "layers", hint: "平铺文字水印", fields: ["watermark"] },
    { id: "text", label: "加文字", kind: "canvas", icon: "layers", hint: "在指定位置添加文字", fields: ["text"] },
    { id: "frame", label: "加边框", kind: "canvas", icon: "crop", hint: "为图片添加边框", fields: ["frame"] },
    { id: "filter", label: "滤镜", kind: "canvas", icon: "wand", hint: "一键套用滤镜", fields: ["filter"] },
    { id: "material", label: "素材", kind: "canvas", icon: "layers", hint: "叠加素材图片", fields: ["material"] },
    { id: "mosaic", label: "打马赛克", kind: "canvas", icon: "grid", hint: "对区域做马赛克处理", fields: ["mosaic"] },
    { id: "rotate", label: "翻转旋转", kind: "canvas", icon: "rotate", hint: "旋转或镜像翻转", fields: ["rotate"] },
    { id: "adjust", label: "色彩调节", kind: "canvas", icon: "wand", hint: "调节亮度/对比度/饱和度", fields: ["adjust"] },
    { id: "doodle", label: "涂鸦", kind: "canvas", icon: "wand", hint: "用画笔在图片上自由涂画", fields: ["doodle"] }
  ];
  const RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16"];

  const HTML = `<div class="inner" style="display:flex;flex-direction:column;height:100%;min-height:0">
    <div class="page-head">
      <h1>AI 工具箱</h1>
      <p>16 项图片编辑，本地 Canvas 即改即存，需要 AI 的走已配置图像服务。</p>
    </div>
    <div class="tool-grid" data-tools style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-bottom:16px"></div>
    <div class="split" style="grid-template-columns:1.3fr .7fr;align-items:start">
      <div class="panel" style="display:flex;flex-direction:column;min-height:0">
        <div class="panel-head"><svg class="ic sm"><use href="#i-crop"/></svg><span data-tool-name>编辑器</span>
          <button class="btn btn-ghost" data-undo style="width:auto;padding:2px 10px;font-size:12px;margin-left:auto">撤销</button>
          <button class="btn btn-ghost" data-reset style="width:auto;padding:2px 10px;font-size:12px">重置</button>
        </div>
        <div class="panel-body" style="display:flex;justify-content:center;align-items:center;min-height:360px;background:#f5f6f8">
          <div data-drop class="dropzone" style="max-width:420px">
            <div class="dz-ic"><svg class="ic"><use href="#i-upload"/></svg></div>
            <b>点击上传图片开始编辑</b>
            <p>支持 JPG / PNG / WEBP</p>
          </div>
          <canvas data-canvas style="max-width:100%;max-height:520px;display:none;border-radius:10px;box-shadow:0 8px 24px rgba(16,24,40,.16);cursor:default"></canvas>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-spark"/></svg>参数</div>
        <div class="panel-body">
          <div class="note" data-hint style="font-size:12px;color:var(--muted);margin-bottom:12px">先上传图片，再选择左侧工具。</div>
          <div data-inspector></div>
          <button class="btn btn-primary" data-apply disabled style="margin-top:12px">应用</button>
          <button class="btn btn-ghost" data-download style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>导出到作品库</button>
        </div>
      </div>
    </div>
  </div>`;

  function fieldChips(name, label, options, def) {
    return '<div class="field" data-f="' + name + '"><label>' + label + "</label><div class=\"chips\" data-group=\"" + name + "\">"
      + options.map((o, i) => '<div class="chip' + (o === def ? " on" : "") + '">' + o + "</div>").join("") + "</div></div>";
  }
  function fieldInput(name, label, value, attrs) {
    return '<div class="field" data-f="' + name + '"><label>' + label + '</label><input class="inp" data-k="' + name + '" ' + (attrs || "") + ' value="' + esc(value || "") + '"></div>';
  }
  function fieldArea(name, label, ph) {
    return '<div class="field" data-f="' + name + '"><label>' + label + '</label><textarea class="inp" data-k="' + name + '" rows="3" placeholder="' + esc(ph || "") + '"></textarea></div>';
  }

  function inspector(tool) {
    const f = tool.fields;
    let h = "";
    if (f.indexOf("prompt") >= 0) h += fieldArea("prompt", "描述 / 提示词", "描述想要的效果…");
    if (f.indexOf("ratio") >= 0) h += fieldChips("ratio", "比例", RATIOS, "1:1");
    if (f.indexOf("crop") >= 0) h += fieldInput("cropRegion", "裁剪区域（%，左,上,宽,高）", "0,0,100,100");
    if (f.indexOf("size") >= 0) h += fieldInput("sizeWH", "目标尺寸（宽,高 px）", "");
    if (f.indexOf("watermark") >= 0) h += fieldInput("wmText", "水印文字", "铜龙电商") + fieldChips("wmOpacity", "不透明度", ["20%", "40%", "60%"], "40%") + fieldChips("wmAngle", "角度", ["0", "30", "-30"], "-30");
    if (f.indexOf("text") >= 0) h += fieldInput("textVal", "文字内容", "") + fieldChips("textSize", "字号", ["24", "48", "72"], "48") + fieldChips("textPos", "位置", ["左上", "居中", "右下"], "居中") + fieldChips("textColor", "颜色", ["白", "黑", "红", "黄", "蓝"], "白");
    if (f.indexOf("frame") >= 0) h += fieldChips("frameW", "边框粗细", ["4", "8", "16"], "8") + fieldChips("frameColor", "颜色", ["黑", "白", "金"], "黑");
    if (f.indexOf("filter") >= 0) h += fieldChips("filterPreset", "滤镜", ["原图", "黑白", "复古", "冷色", "暖色", "高对比"], "黑白");
    if (f.indexOf("material") >= 0) h += '<div class="field"><label>叠加素材</label><div class="upload-slot" data-add-material><svg class="ic"><use href="#i-upload"/></svg><span>选择</span></div><div class="note" data-material-name style="font-size:12px;color:var(--muted);margin-top:6px">未选择</div></div>' + fieldInput("matPos", "位置（%,左,上）", "50,50") + fieldInput("matScale", "缩放（%）", "40");
    if (f.indexOf("mosaic") >= 0) h += fieldInput("mosaicRegion", "区域（%，左,上,宽,高）", "0,0,50,50") + fieldChips("mosaicBlock", "马赛克块", ["8", "16", "32"], "16");
    if (f.indexOf("rotate") >= 0) h += fieldChips("rotateDeg", "旋转", ["0", "90", "180", "270"], "90") + fieldChips("flipDir", "翻转", ["不翻转", "水平", "垂直"], "不翻转");
    if (f.indexOf("adjust") >= 0) h += fieldInput("adjBri", "亮度 %", "100") + fieldInput("adjCon", "对比度 %", "100") + fieldInput("adjSat", "饱和度 %", "100");
    if (f.indexOf("doodle") >= 0) h += fieldChips("doodleColor", "画笔颜色", ["红", "蓝", "黄", "绿"], "红") + fieldChips("doodleWidth", "粗细", ["4", "8", "16"], "8") + '<div class="note" style="font-size:12px;color:var(--muted)">在左侧图片上按住鼠标即可绘制。</div>';
    return h;
  }

  function colorOf(name) {
    return { 白: "#ffffff", 黑: "#111111", 红: "#e5484d", 黄: "#f5c518", 蓝: "#3370ff", 金: "#d4af37", 绿: "#22a06b" }[name] || "#111111";
  }
  function pick(el, group) {
    const n = el.querySelector('.chips[data-group="' + group + '"] .chip.on');
    return n ? n.textContent.trim() : "";
  }
  function val(el, key) { const n = el.querySelector('[data-k="' + key + '"]'); return n ? n.value.trim() : ""; }

  /* ---------------- canvas 工具实现 ---------------- */
  function ctxOf(cv) { return cv.getContext("2d"); }
  function drawFiltered(el, filter) {
    const src = el.__tb.snapshot;
    const base = EC.ui.el("canvas"); base.width = src.width; base.height = src.height;
    ctxOf(base).drawImage(src, 0, 0);
    const out = EC.ui.el("canvas"); out.width = src.width; out.height = src.height;
    const c = ctxOf(out); c.filter = filter || "none"; c.drawImage(base, 0, 0);
    el.__tb.snapshot = out;
  }
  function render(el) {
    const cv = el.querySelector("[data-canvas]");
    const snap = el.__tb.snapshot;
    if (!cv || !snap) return;
    cv.width = snap.width; cv.height = snap.height;
    ctxOf(cv).drawImage(snap, 0, 0);
  }

  function applyCanvas(el, tool) {
    const s = el.__tb;
    const cv = el.querySelector("[data-canvas]");
    if (!cv || !s.snapshot) { EC.toast("请先上传图片"); return false; }
    const W = s.snapshot.width, H = s.snapshot.height;
    if (tool.id === "crop") {
      const p = val(el, "cropRegion").split(",").map(Number);
      const [x, y, w, h] = [p[0] || 0, p[1] || 0, p[2] || 100, p[3] || 100];
      const px = Math.round(W * x / 100), py = Math.round(H * y / 100), pw = Math.round(W * w / 100), ph = Math.round(H * h / 100);
      const out = EC.ui.el("canvas"); out.width = pw; out.height = ph;
      ctxOf(out).drawImage(s.snapshot, px, py, pw, ph, 0, 0, pw, ph);
      s.snapshot = out;
    } else if (tool.id === "resize") {
      const p = val(el, "sizeWH").split(",").map(Number);
      const w = p[0] || W, h = p[1] || H;
      const out = EC.ui.el("canvas"); out.width = w; out.height = h;
      ctxOf(out).drawImage(s.snapshot, 0, 0, w, h);
      s.snapshot = out;
    } else if (tool.id === "rotate") {
      const deg = Number(pick(el, "rotateDeg")) || 0;
      const flip = pick(el, "flipDir");
      const out = EC.ui.el("canvas");
      const swap = deg % 180 !== 0;
      out.width = swap ? H : W; out.height = swap ? W : H;
      const c = ctxOf(out);
      c.translate(out.width / 2, out.height / 2);
      if (flip === "水平") c.scale(-1, 1);
      if (flip === "垂直") c.scale(1, -1);
      c.rotate(deg * Math.PI / 180);
      c.drawImage(s.snapshot, -W / 2, -H / 2);
      s.snapshot = out;
    } else if (tool.id === "filter") {
      const f = pick(el, "filterPreset");
      const map = { 原图: "none", 黑白: "grayscale(1)", 复古: "sepia(.8) contrast(1.05)", 冷色: "hue-rotate(180deg) saturate(1.1)", 暖色: "sepia(.35) saturate(1.2)", 高对比: "contrast(1.5)" };
      drawFiltered(el, map[f] || "none");
    } else if (tool.id === "adjust") {
      const b = (Number(val(el, "adjBri")) || 100), ct = (Number(val(el, "adjCon")) || 100), st = (Number(val(el, "adjSat")) || 100);
      drawFiltered(el, "brightness(" + b + "%) contrast(" + ct + "%) saturate(" + st + "%)");
    } else if (tool.id === "watermark") {
      const out = EC.ui.el("canvas"); out.width = W; out.height = H;
      const c = ctxOf(out); c.drawImage(s.snapshot, 0, 0);
      const txt = val(el, "wmText") || "铜龙电商";
      const alpha = (Number((pick(el, "wmOpacity") || "40%").replace("%", "")) || 40) / 100;
      const deg = Number(pick(el, "wmAngle")) || 0;
      c.save(); c.globalAlpha = alpha; c.fillStyle = "#ffffff"; c.font = Math.round(W / 22) + "px sans-serif";
      c.translate(W / 2, H / 2); c.rotate(deg * Math.PI / 180);
      for (let y = -H; y < H; y += Math.round(H / 6)) for (let x = -W; x < W; x += Math.round(W / 3)) c.fillText(txt, x, y);
      c.restore();
      s.snapshot = out;
    } else if (tool.id === "text") {
      const out = EC.ui.el("canvas"); out.width = W; out.height = H;
      const c = ctxOf(out); c.drawImage(s.snapshot, 0, 0);
      const size = Number(pick(el, "textSize")) || 48;
      const pos = pick(el, "textPos");
      c.fillStyle = colorOf(pick(el, "textColor"));
      c.font = "700 " + size + "px sans-serif";
      c.textAlign = "center"; c.textBaseline = "middle";
      const x = pos === "左上" ? W * 0.22 : pos === "右下" ? W * 0.78 : W / 2;
      const y = pos === "左上" ? size : pos === "右下" ? H - size : H / 2;
      c.fillText(val(el, "textVal") || "文字", x, y);
      s.snapshot = out;
    } else if (tool.id === "frame") {
      const out = EC.ui.el("canvas"); out.width = W; out.height = H;
      const c = ctxOf(out); c.drawImage(s.snapshot, 0, 0);
      const w = Number(pick(el, "frameW")) || 8;
      c.strokeStyle = colorOf(pick(el, "frameColor")); c.lineWidth = w;
      c.strokeRect(w / 2, w / 2, W - w, H - w);
      s.snapshot = out;
    } else if (tool.id === "mosaic") {
      const p = val(el, "mosaicRegion").split(",").map(Number);
      const x = Math.round(W * (p[0] || 0) / 100), y = Math.round(H * (p[1] || 0) / 100);
      const w = Math.round(W * (p[2] || 50) / 100), h = Math.round(H * (p[3] || 50) / 100);
      const block = Number(pick(el, "mosaicBlock")) || 16;
      const out = EC.ui.el("canvas"); out.width = W; out.height = H;
      const c = ctxOf(out); c.drawImage(s.snapshot, 0, 0);
      for (let yy = y; yy < y + h; yy += block) for (let xx = x; xx < x + w; xx += block) {
        const d = c.getImageData(xx, yy, Math.min(block, x + w - xx), Math.min(block, y + h - yy)).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        c.fillStyle = "rgb(" + Math.round(r / n) + "," + Math.round(g / n) + "," + Math.round(b / n) + ")";
        c.fillRect(xx, yy, Math.min(block, x + w - xx), Math.min(block, y + h - yy));
      }
      s.snapshot = out;
    } else if (tool.id === "material") {
      if (!s.material) { EC.toast("请先选择叠加素材"); return false; }
      const p = val(el, "matPos").split(",").map(Number);
      const scale = (Number(val(el, "matScale")) || 40) / 100;
      const mw = W * scale, mh = mw * (s.material.height / s.material.width);
      const x = W * (p[0] != null ? p[0] : 50) / 100 - mw / 2, y = H * (p[1] != null ? p[1] : 50) / 100 - mh / 2;
      const out = EC.ui.el("canvas"); out.width = W; out.height = H;
      const c = ctxOf(out); c.drawImage(s.snapshot, 0, 0); c.drawImage(s.material, x, y, mw, mh);
      s.snapshot = out;
    } else { return false; }
    render(el);
    return true;
  }

  async function applyGen(el, tool) {
    const s = el.__tb;
    if (!s.src) { EC.toast("请先上传图片"); return; }
    if (!EC.gen.configured("image")) { EC.toast("请到「设置 → 短剧服务」配置图像模型"); return; }
    const hintMap = { eraser: "智能抹除框选区域并自然补全背景", aiproduct: "生成商品展示图", aimodel: "为商品添加 AI 模特", outpaint: "扩展画布并补全画面", sizelabel: "生成带尺码标注的图片" };
    const userPrompt = val(el, "prompt");
    const ratio = pick(el, "ratio") || "1:1";
    const prompt = [hintMap[tool.id], userPrompt].filter(Boolean).join("。");
    EC.ui.busy(el.querySelector("[data-apply]"), true, "生成中…");
    try {
      const src = await EC.store.publicUrl(s.src);
      const r = await EC.gen.image({ prompt: prompt, ratio: ratio, refImages: [src] });
      const img = await EC.store.loadImage(r.url);
      const out = EC.ui.el("canvas"); out.width = img.naturalWidth || img.width; out.height = img.naturalHeight || img.height;
      ctxOf(out).drawImage(img, 0, 0);
      s.snapshot = out; render(el);
      EC.toast("生成完成，可继续编辑或导出");
    } catch (e) { EC.toast((e && e.message) || "生成失败"); }
    finally { EC.ui.busy(el.querySelector("[data-apply]"), false); }
  }

  function selectTool(el, id) {
    el.__tb.tool = id;
    el.querySelectorAll(".tool-card").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-id") === id); });
    const tool = TOOLS.find(t => t.id === id);
    el.querySelector("[data-tool-name]").textContent = tool.label;
    el.querySelector("[data-hint]").textContent = tool.hint;
    el.querySelector("[data-inspector]").innerHTML = inspector(tool);
    const ap = el.querySelector("[data-apply]");
    ap.disabled = !el.__tb.snapshot;
    const cv = el.querySelector("[data-canvas]");
    if (cv) cv.style.cursor = id === "doodle" ? "crosshair" : "default";
  }

  EC.register("ecomToolbox", function (el) {
    if (!el.__tb) el.__tb = {
      src: null, snapshot: null, tool: "crop", material: null, undo: [],
      push: function (c) { this.undo.push(c); if (this.undo.length > 12) this.undo.shift(); },
      undoPop: function () { return this.undo.pop() || null; }
    };
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
    const grid = el.querySelector("[data-tools]");
    grid.innerHTML = TOOLS.map(t =>
      '<div class="tool-card' + (t.id === el.__tb.tool ? " on" : "") + '" data-id="' + t.id + '" title="' + t.hint + '" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border:1px solid var(--border);border-radius:10px;cursor:pointer">'
      + '<svg class="ic sm"><use href="#i-' + t.icon + '"/></svg><span style="font-size:11px">' + t.label + "</span></div>").join("");
    selectTool(el, el.__tb.tool);
    if (el.__tb.snapshot) render(el);
    if (el.__tb.src) {
      const cv = el.querySelector("[data-canvas]"); if (cv) cv.style.display = "block";
      el.querySelector("[data-drop]").style.display = "none";
    }
    if (el.__ecomTbBound) return;
    el.__ecomTbBound = true;

    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const card = e.target.closest(".tool-card");
      if (card) { selectTool(el, card.getAttribute("data-id")); return; }
      const drop = e.target.closest("[data-drop]");
      if (drop) {
        EC.ui.pickFiles("image/*", false).then(function (files) {
          if (!files.length) return;
          EC.store.addFile(files[0], { kind: "upload" }).then(function (a) { loadSrc(el, a); });
        });
        return;
      }
      const addMat = e.target.closest("[data-add-material]");
      if (addMat) {
        EC.ui.pickFiles("image/*", false).then(function (files) {
          if (!files.length) return;
          const fr = new FileReader();
          fr.onload = function () {
            EC.store.loadImage(fr.result).then(function (img) {
              el.__tb.material = img;
              const n = el.querySelector("[data-material-name]"); if (n) n.textContent = files[0].name || "已选择";
            });
          };
          fr.readAsDataURL(files[0]);
        });
        return;
      }
      const apply = e.target.closest("[data-apply]");
      if (apply) {
        const tool = TOOLS.find(t => t.id === el.__tb.tool);
        if (!tool) return;
        if (!el.__tb.snapshot) { EC.toast("请先上传图片"); return; }
        el.__tb.push(el.__tb.snapshot);
        if (tool.kind === "gen") applyGen(el, tool);
        else applyCanvas(el, tool);
        return;
      }
      const undo = e.target.closest("[data-undo]");
      if (undo) {
        const prev = el.__tb.undoPop && el.__tb.undoPop();
        if (prev) { el.__tb.snapshot = prev; render(el); }
        else EC.toast("没有可撤销的操作");
        return;
      }
      const reset = e.target.closest("[data-reset]");
      if (reset) { if (el.__tb.src) loadSrc(el, el.__tb.src); return; }
      const dl = e.target.closest("[data-download]");
      if (dl) {
        if (!el.__tb.snapshot) { EC.toast("请先上传并编辑图片"); return; }
        el.__tb.snapshot.toBlob(function (b) {
          EC.store.addAsset({ blob: b, mime: "image/png", name: "工具箱产物", kind: "toolbox" }).then(function () {
            EC.toast("已导出到作品库"); if (EC.addUsage) EC.addUsage({ generated: 1 });
          });
        }, "image/png");
        return;
      }
    });

    /* 涂鸦画笔 */
    let drawing = false;
    const canvas = el.querySelector("[data-canvas]");
    canvas.addEventListener("mousedown", function (e) {
      if (el.__tb.tool !== "doodle" || !el.__tb.snapshot) return;
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      const c = ctxOf(el.__tb.snapshot);
      c.lineCap = "round"; c.lineJoin = "round";
      c.strokeStyle = colorOf(pick(el, "doodleColor"));
      c.lineWidth = Number(pick(el, "doodleWidth")) || 8;
      c.beginPath();
      c.moveTo((e.clientX - rect.left) * canvas.width / rect.width, (e.clientY - rect.top) * canvas.height / rect.height);
    });
    canvas.addEventListener("mousemove", function (e) {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const c = ctxOf(el.__tb.snapshot);
      c.lineTo((e.clientX - rect.left) * canvas.width / rect.width, (e.clientY - rect.top) * canvas.height / rect.height);
      c.stroke();
      render(el);
    });
    canvas.addEventListener("mouseup", function () { drawing = false; });
    canvas.addEventListener("mouseleave", function () { drawing = false; });
  });

  async function loadSrc(el, asset) {
    const img = await EC.store.loadImage(EC.store.src(asset));
    const out = EC.ui.el("canvas"); out.width = img.naturalWidth || img.width; out.height = img.naturalHeight || img.height;
    ctxOf(out).drawImage(img, 0, 0);
    el.__tb.src = asset; el.__tb.snapshot = out; el.__tb.undo = [];
    const cv = el.querySelector("[data-canvas]");
    cv.style.display = "block";
    const drop = el.querySelector("[data-drop]"); if (drop) drop.style.display = "none";
    render(el);
    el.querySelector("[data-apply]").disabled = false;
  }
})();
