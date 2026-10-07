/* 电商工作台 · 主图编辑（真实画布编辑器：拖拽/缩放/图层/属性/导出/去白底） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const TYPE_NAME = { bg: "背景", image: "商品主体", title: "主标题", price: "价格标签", badge: "促销角标", text: "文字" };
  const SWATCHES = ["#111827", "#ff4d2e", "#12b76a", "#1c64f4", "#ffffff"];

  function uid() { return EC.ui ? EC.ui.uid("el") : "el" + Math.random().toString(36).slice(2, 7); }

  function defaults() {
    return [
      { id: "bg", type: "bg", cls: "", grad: ["#e8f0fe", "#cfe0ff"] },
      { id: "prod", type: "image", cls: "sq-prod", src: "assets/ecom/pot.jpg", x: 50, y: 54, w: 56, h: 56 },
      { id: "title", type: "title", cls: "sq-title", text: "夏日清凉好物", x: 50, y: 14, w: 84, size: 32, color: "#1a1a1a", weight: 800 },
      { id: "badge", type: "badge", cls: "sq-badge", text: "限时特惠", x: 82, y: 8, w: 30, size: 15, color: "#ffffff", bg: "#ff4d2e", radius: 20 },
      { id: "price", type: "price", cls: "sq-price", text: "¥ 199", x: 26, y: 88, w: 40, size: 24, color: "#ffffff", bg: "#1c64f4", radius: 10 }
    ];
  }
  function byId(st, id) { return st.els.filter(function (e) { return e.id === id; })[0]; }
  function sel(st) { return byId(st, st.sel); }

  function listThumb(e) {
    if (e.type === "image") return '<div class="m-thumb"><img src="' + esc(e.src) + '" alt=""></div>';
    if (e.type === "bg") return '<div class="m-thumb" style="background:linear-gradient(135deg,' + e.grad[0] + "," + e.grad[1] + ')"><svg class="ic sm"><use href="#i-image"/></svg></div>';
    const bg = e.bg || "transparent";
    const col = e.bg ? "#fff" : (e.color || "#1a1a1a");
    return '<div class="m-thumb" style="background:' + esc(bg) + ';color:' + esc(col) + ';border:1px solid var(--border)"><svg class="ic sm"><use href="#i-text"/></svg></div>';
  }
  function listSub(e) {
    if (e.type === "image") return "图片 " + Math.round(e.w) + "% · 可拖动";
    if (e.type === "bg") return "渐变背景 · 铺满画布";
    return e.text || "";
  }

  /* ---------------- 渲染 ---------------- */
  function renderList(el) {
    const st = el.__me;
    const box = el.querySelector(".list-editor");
    if (!box) return;
    let html = '<div class="mode-tip"><svg class="ic sm"><use href="#i-layers"/></svg>列表模式：逐元素编辑，改文案／换图／调位置</div>';
    st.els.forEach(function (e) {
      html += '<div class="module-row' + (e.id === st.sel ? " on" : "") + '" data-el="' + e.id + '">'
        + '<div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>'
        + listThumb(e)
        + '<div class="m-info"><b>' + esc(TYPE_NAME[e.type] || "元素") + '</b><span>' + esc(listSub(e)) + '</span></div>'
        + '<div class="m-actions">'
        + '<button data-row-act="up" title="上移"><svg class="ic sm"><use href="#i-arrow"/></svg></button>'
        + '<button data-row-act="del" title="删除"><svg class="ic sm"><use href="#i-trash"/></svg></button>'
        + '</div></div>';
    });
    html += '<div class="add-module">+ 添加元素</div>';
    box.innerHTML = html;
  }

  function renderCanvas(el) {
    const st = el.__me;
    const art = el.querySelector(".sq-art");
    if (!art) return;
    const bg = st.els.filter(function (e) { return e.type === "bg"; })[0];
    art.style.background = bg ? (bg.src ? "center/cover no-repeat url(" + bg.src + ")" : "linear-gradient(135deg," + bg.grad[0] + "," + bg.grad[1] + ")") : "#fff";
    const parts = st.els.filter(function (e) { return e.type !== "bg"; }).map(function (e) {
      const on = e.id === st.sel ? " sel" : "";
      const pos = "left:" + e.x + "%;top:" + e.y + "%;transform:translate(-50%,-50%);width:" + e.w + "%";
      if (e.type === "image") {
        const h = e.h ? ";height:" + e.h + "%" : "";
        return '<div class="sq-el ' + e.cls + on + '" data-el="' + e.id + '" style="' + pos + h + '"><img src="' + esc(e.src) + '" alt="" draggable="false">'
          + (on ? '<span class="sq-handle" data-role="resize"></span>' : "") + '</div>';
      }
      const stl = pos + ";color:" + (e.color || "#1a1a1a") + ";font-size:" + (e.size || 22) + "px;font-weight:" + (e.weight || 700) + ";"
        + (e.bg ? "background:" + e.bg + ";padding:6px 14px;border-radius:" + (e.radius || 10) + "px;" : "");
      return '<div class="sq-el ' + e.cls + on + '" data-el="' + e.id + '" style="' + stl + '">' + esc(e.text || "")
        + (on ? '<span class="sq-handle" data-role="resize"></span>' : "") + '</div>';
    }).join("");
    art.innerHTML = parts;
  }

  function renderInspector(el) {
    const st = el.__me;
    const e = sel(st);
    const box = el.querySelector(".inspector");
    if (!box) return;
    if (!e) { box.innerHTML = '<h4>属性</h4><div class="ed-empty">未选中元素</div>'; return; }
    let html = '<h4>属性</h4>'
      + '<div class="field"><label>元素类型</label><div class="select">' + esc(TYPE_NAME[e.type] || e.type) + ' <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>';
    if (e.type === "bg") {
      html += '<div class="field"><label>背景</label><div class="select bg-pick" style="cursor:pointer">' + (e.src ? "自定义图片" : "渐变蓝底") + ' <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>';
    } else {
      html += '<div class="field"><label>文本内容</label>'
        + '<input class="inp mini" data-bind="text" value="' + esc(e.text || "") + '" placeholder="输入文案"></div>';
    }
    html += '<div class="field"><label>位置 X / Y</label><div style="display:flex;gap:8px">'
      + '<input class="inp mini" type="number" data-bind="x" value="' + Math.round(e.x) + '">'
      + '<input class="inp mini" type="number" data-bind="y" value="' + Math.round(e.y) + '"></div></div>';
    html += '<div class="field"><label>宽度 %</label><input class="inp mini" type="number" data-bind="w" value="' + Math.round(e.w) + '"></div>';
    if (e.type !== "image" && e.type !== "bg") {
      html += '<div class="field"><label>字号</label><input class="inp mini" type="number" data-bind="size" value="' + Math.round(e.size || 22) + '"></div>';
    }
    html += '<div class="field"><label>颜色</label><div class="swatches">'
      + SWATCHES.map(function (c) { return '<div class="sw' + (String(e.color || "").toLowerCase() === c ? " on" : "") + '" data-color="' + c + '" style="background:' + c + '"></div>'; }).join("")
      + '</div></div>';
    html += '<div class="field"><label>图层</label><div class="layers">'
      + st.els.slice().reverse().map(function (x) {
        return '<div class="layer' + (x.id === st.sel ? " on" : "") + '" data-layer="' + x.id + '"><svg class="ic sm"><use href="#i-layers"/></svg>' + esc(TYPE_NAME[x.type] || x.type) + '</div>';
      }).join("") + '</div></div>';
    box.innerHTML = html;
  }

  function apply(el) { renderList(el); renderCanvas(el); renderInspector(el); }

  /* ---------------- 交互 ---------------- */
  function bindInspector(el) {
    const box = el.querySelector(".inspector");
    if (!box || box.__meInspBound) return;
    box.__meInspBound = true;
    box.addEventListener("input", function (ev) {
      const st = el.__me;
      const e = sel(st);
      const b = ev.target.closest("[data-bind]");
      if (!e || !b) return;
      const k = b.getAttribute("data-bind");
      const v = b.value;
      if (k === "text") e.text = v;
      else { const n = Number(v); if (!isNaN(n)) e[k] = n; }
      renderCanvas(el); renderList(el);
    });
    box.addEventListener("click", function (ev) {
      const st = el.__me;
      const e = sel(st);
      const sw = ev.target.closest("[data-color]");
      if (sw && e) { e.color = sw.getAttribute("data-color"); apply(el); return; }
      const layer = ev.target.closest("[data-layer]");
      if (layer) { st.sel = layer.getAttribute("data-layer"); apply(el); return; }
      const bgPick = ev.target.closest(".bg-pick");
      if (bgPick) { pickBackground(el); return; }
    });
  }

  function pickBackground(el) {
    const e = byId(el.__me, "bg");
    EC.ui.menu(el.querySelector(".bg-pick"), [
      { label: "渐变蓝底", pick: function () { e.src = ""; apply(el); } },
      { label: "纯白背景", pick: function () { e.grad = ["#ffffff", "#ffffff"]; e.src = ""; apply(el); } },
      { label: "纯黑背景", pick: function () { e.grad = ["#111827", "#111827"]; e.src = ""; apply(el); } },
      { label: "上传背景图", pick: function () {
        EC.ui.pickFiles("image/*", false).then(function (f) {
          if (!f.length) return;
          EC.store.addFile(f[0], { kind: "upload" }).then(function (a) { e.src = EC.store.src(a); e.grad = ["#ffffff", "#ffffff"]; apply(el); });
        });
      } },
      { label: "AI 生成背景", pick: function () { aiBackground(el); } }
    ]);
  }

  function aiBackground(el) {
    const e = byId(el.__me, "bg");
    const m = EC.ui.modal({ title: "AI 换背景", body: '<div class="field"><label>背景描述</label><textarea class="inp" data-bg style="min-height:88px" placeholder="例如：夏日海边、木纹桌面、纯色渐变棚拍背景"></textarea></div>' });
    const btn = EC.ui.el("button", "btn btn-primary", '<svg class="ic sm"><use href="#i-spark"/></svg>生成背景');
    btn.style.marginTop = "12px";
    m.body.appendChild(btn);
    btn.addEventListener("click", async function () {
      const p = (m.body.querySelector("[data-bg]").value || "").trim();
      if (!p) { EC.toast("请描述想要的背景"); return; }
      EC.ui.busy(btn, true);
      try {
        const r = await EC.gen.image({ prompt: "电商产品背景：" + p + "，干净通透、适合放商品", ratio: "1:1" });
        e.src = r.url; apply(el); m.close();
        if (EC.addUsage) EC.addUsage({ generated: 1 });
        EC.toast("背景已生成");
      } catch (err) { EC.toast((err && err.message) || "生成失败"); } finally { EC.ui.busy(btn, false); }
    });
  }

  function addText(el, text) {
    const st = el.__me;
    st.els.push({ id: uid(), type: "text", cls: "", text: text || "双击修改文字", x: 50, y: 40, w: 50, size: 20, color: "#1a1a1a", weight: 700 });
    st.sel = st.els[st.els.length - 1].id; apply(el);
  }
  function addImage(el, asset) {
    const st = el.__me;
    st.els.push({ id: uid(), type: "image", cls: "", src: EC.store.src(asset), x: 50, y: 50, w: 50, h: 50 });
    st.sel = st.els[st.els.length - 1].id; apply(el);
  }

  async function removeWhite(el) {
    const st = el.__me;
    const e = sel(st);
    if (!e || e.type !== "image") { EC.toast("请先选中商品主体图"); return; }
    EC.toast("正在抠图…");
    try {
      const im = await EC.store.loadImage(EC.store.src(e));
      const cv = document.createElement("canvas");
      const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.drawImage(im, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const p = data.data;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i] > 238 && p[i + 1] > 238 && p[i + 2] > 238) p[i + 3] = 0;
      }
      ctx.putImageData(data, 0, 0);
      const blob = await EC.store.canvasToBlob(cv, "image/png");
      const asset = await EC.store.addFile(new File([blob], "cutout.png", { type: "image/png" }), { kind: "edit", name: "抠图主体" });
      e.src = EC.store.src(asset); apply(el);
      if (EC.addUsage) EC.addUsage({ generated: 1 });
      EC.toast("抠图完成，白底已去除");
    } catch (err) { EC.toast((err && err.message) || "抠图失败"); }
  }

  async function exportPNG(el) {
    const st = el.__me;
    const art = el.querySelector(".sq-art");
    const W = art.clientWidth || 460;
    const SIZE = 1024, k = SIZE / W;
    const cv = document.createElement("canvas");
    cv.width = SIZE; cv.height = SIZE;
    const ctx = cv.getContext("2d");
    const bg = byId(st, "bg");
    if (bg && bg.src) {
      try { const im = await EC.store.loadImage(bg.src); ctx.drawImage(im, 0, 0, SIZE, SIZE); } catch (err) {}
    } else if (bg) {
      const g = ctx.createLinearGradient(0, 0, SIZE, SIZE); g.addColorStop(0, bg.grad[0]); g.addColorStop(1, bg.grad[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
    }
    const ordered = st.els.filter(function (e) { return e.type !== "bg"; });
    for (let i = 0; i < ordered.length; i++) {
      const e = ordered[i];
      const cx = e.x / 100 * SIZE, cy = e.y / 100 * SIZE;
      if (e.type === "image") {
        try {
          const im = await EC.store.loadImage(EC.store.src(e));
          const w = e.w / 100 * SIZE, h = (e.h || e.w) / 100 * SIZE;
          ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
        } catch (err) {}
      } else {
        const fs = (e.size || 22) * k;
        ctx.font = (e.weight || 700) + " " + fs + "px 'PingFang SC','Microsoft YaHei',sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const tw = ctx.measureText(e.text || "").width;
        if (e.bg) {
          const pw = 28 * k, ph = 18 * k, r = (e.radius || 10) * k;
          roundRect(ctx, cx - tw / 2 - pw / 2, cy - fs / 2 - ph / 2, tw + pw, fs + ph, r);
          ctx.fillStyle = e.bg; ctx.fill();
        }
        ctx.fillStyle = e.color || "#1a1a1a";
        ctx.fillText(e.text || "", cx, cy);
      }
    }
    try {
      const blob = await EC.store.canvasToBlob(cv, "image/png");
      EC.store.downloadBlob(blob, "主图_" + Date.now() + ".png");
      await EC.store.addAsset({ blob: blob, mime: "image/png", name: "主图导出", kind: "edit" });
      if (EC.addUsage) EC.addUsage({ exported: 1 });
      EC.toast("已导出主图");
    } catch (err) { EC.toast((err && err.message) || "导出失败（图片可能不允许跨域导出）"); }
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 拖拽 / 缩放 ---------------- */
  function bindDrag(el) {
    const art = el.querySelector(".sq-art");
    if (!art || art.__meDragBound) return;
    art.__meDragBound = true;
    let drag = null;
    art.addEventListener("pointerdown", function (ev) {
      const handle = ev.target.closest('[data-role="resize"]');
      const node = ev.target.closest(".sq-el");
      if (!node) return;
      const st = el.__me;
      const id = node.getAttribute("data-el");
      st.sel = id;
      renderList(el); renderInspector(el);
      renderCanvas(el);
      const e = byId(st, id);
      if (!e || e.type === "bg") return;
      const rect = art.getBoundingClientRect();
      drag = { e: e, rect: rect, mode: handle ? "resize" : "move", sx: ev.clientX, sy: ev.clientY, ox: e.x, oy: e.y, ow: e.w };
      ev.preventDefault();
      try { art.setPointerCapture(ev.pointerId); } catch (err) {}
    });
    art.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      const r = drag.rect;
      if (drag.mode === "move") {
        drag.e.x = clamp(drag.ox + (ev.clientX - drag.sx) / r.width * 100, 2, 98);
        drag.e.y = clamp(drag.oy + (ev.clientY - drag.sy) / r.height * 100, 2, 98);
      } else {
        drag.e.w = clamp(drag.ow + (ev.clientX - drag.sx) / r.width * 100, 6, 100);
        if (drag.e.type === "image") drag.e.h = drag.e.w;
      }
      positionCanvas(el);
    });
    function up(ev) {
      if (!drag) return;
      drag = null;
      renderList(el); renderInspector(el);
    }
    art.addEventListener("pointerup", up);
    art.addEventListener("pointercancel", up);
  }
  function positionCanvas(el) {
    const st = el.__me;
    el.querySelectorAll(".sq-el").forEach(function (node) {
      const e = byId(st, node.getAttribute("data-el"));
      if (!e) return;
      node.style.left = e.x + "%"; node.style.top = e.y + "%"; node.style.width = e.w + "%";
      if (e.type === "image" && e.h) node.style.height = e.h + "%";
    });
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  const HTML_PRE = `<div class="inner">
          <div class="page-head">
            <h1>主图编辑</h1>
            <p>同一张主图，列表模式调元素，画布模式自由拖拽，随时切换。所有改动都在本机实时保存。</p>
          </div>

          <div class="editor-wrap">
            <div class="toolbar">
              <div class="tool on" data-tool="select"><svg class="ic sm"><use href="#i-arrow"/></svg>选择</div>
              <div class="tool" data-tool="text"><svg class="ic sm"><use href="#i-text"/></svg>文字</div>
              <div class="tool" data-tool="cut"><svg class="ic sm"><use href="#i-crop"/></svg>抠图</div>
              <div class="tool" data-tool="ai-bg"><svg class="ic sm"><use href="#i-spark"/></svg>AI 换背景</div>
              <div class="tool" data-tool="upload"><svg class="ic sm"><use href="#i-upload"/></svg>上传图片</div>
              <div class="seg" data-mode-group style="margin-left:auto">
                <button class="on" data-mode="list"><svg class="ic sm"><use href="#i-layers"/></svg>列表</button>
                <button data-mode="canvas"><svg class="ic sm"><use href="#i-crop"/></svg>画布</button>
              </div>
              <button class="btn btn-primary" data-export style="width:auto;padding:8px 18px;font-size:13px;margin-left:10px"><svg class="ic sm"><use href="#i-download"/></svg>导出主图</button>
            </div>

            <div class="editor-body">
              <div class="epanel">
                <h4>元素库</h4>
                <div class="block" data-add="bg"><svg class="ic sm"><use href="#i-image"/></svg>背景</div>
                <div class="block" data-add="image"><svg class="ic sm"><use href="#i-crop"/></svg>商品主体</div>
                <div class="block" data-add="title"><svg class="ic sm"><use href="#i-text"/></svg>主标题</div>
                <div class="block" data-add="price"><svg class="ic sm"><use href="#i-layers"/></svg>价格标签</div>
                <div class="block" data-add="badge"><svg class="ic sm"><use href="#i-heart"/></svg>促销角标</div>
              </div>

              <div class="stage">
                <div class="ed-view view-list">
                  <div class="list-editor"></div>
                </div>
                <div class="ed-view view-canvas" hidden>
                  <div class="square-canvas"><div class="sq-art"></div></div>
                </div>
              </div>

              <div class="epanel right inspector"></div>
            </div>
          </div>
        </div>`;

  EC.register("ecomMainEdit", function (el) {
    if (!el.__me) el.__me = { els: defaults(), sel: "prod" };
    if (!el.__me.sel && el.__me.els.length) el.__me.sel = el.__me.els[0].id;
    el.innerHTML = '<div class="ecom-ui">' + HTML_PRE + '</div>';
    apply(el);
    bindInspector(el);
    bindDrag(el);

    if (el.__ecomMeBound) return;
    el.__ecomMeBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const st = el.__me;

      const row = e.target.closest(".module-row");
      if (row) {
        const act = e.target.closest("[data-row-act]");
        const id = row.getAttribute("data-el");
        if (act) {
          e.stopPropagation();
          const what = act.getAttribute("data-row-act");
          if (what === "del") { st.els = st.els.filter(function (x) { return x.id !== id; }); if (st.sel === id) st.sel = (st.els[st.els.length - 1] || {}).id; }
          else { moveUp(st, st.els.filter(function (x) { return x.id === id; })[0]); }
          apply(el); return;
        }
        st.sel = id; renderCanvas(el); renderInspector(el); bindInspector(el); return;
      }

      const add = e.target.closest(".add-module");
      if (add) { addText(el); return; }

      const block = e.target.closest(".block");
      if (block) { addByType(el, block.getAttribute("data-add")); return; }

      const tool = e.target.closest(".toolbar .tool");
      if (tool) {
        const t = tool.getAttribute("data-tool");
        if (t === "text") addText(el);
        else if (t === "cut") removeWhite(el);
        else if (t === "ai-bg") aiBackground(el);
        else if (t === "upload") uploadImage(el);
        return;
      }

      const exp = e.target.closest("[data-export]");
      if (exp) { exportPNG(el); return; }
    });
  });

  function moveUp(st, e) {
    if (!e) return;
    const i = st.els.indexOf(e);
    if (i < st.els.length - 1) { st.els.splice(i, 1); st.els.splice(i + 1, 0, e); }
  }
  function addByType(el, type) {
    const st = el.__me;
    if (type === "bg") { pickBackground(el); return; }
    if (type === "image") { uploadImage(el); return; }
    if (type === "title") { const e = { id: uid(), type: "title", cls: "", text: "新品上市", x: 50, y: 18, w: 84, size: 30, color: "#1a1a1a", weight: 800 }; st.els.push(e); st.sel = e.id; apply(el); return; }
    if (type === "price") { const e = { id: uid(), type: "price", cls: "", text: "¥ 99", x: 30, y: 82, w: 36, size: 24, color: "#fff", bg: "#1c64f4", radius: 10 }; st.els.push(e); st.sel = e.id; apply(el); return; }
    if (type === "badge") { const e = { id: uid(), type: "badge", cls: "", text: "爆款", x: 82, y: 10, w: 28, size: 15, color: "#fff", bg: "#ff4d2e", radius: 20 }; st.els.push(e); st.sel = e.id; apply(el); return; }
  }
  function uploadImage(el) {
    EC.ui.pickFiles("image/*", false).then(function (f) {
      if (!f.length) return;
      EC.store.addFile(f[0], { kind: "upload" }).then(function (a) { addImage(el, a); EC.toast("已添加商品图"); });
    });
  }
})();
