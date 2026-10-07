/* 电商工作台 · 详情页编辑（真实模块编辑器：增删/排序/编辑/导出长图） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const TYPES = {
    image: "主图区", hero: "卖点区", params: "参数表", compare: "对比图", review: "买家口碑"
  };
  const SWATCHES = ["#ff4d2e", "#3b82f6", "#12b76a", "#8b5cf6", "#111827"];

  function uid() { return EC.ui ? EC.ui.uid("md") : "md" + Math.random().toString(36).slice(2, 7); }
  function defaults() {
    return [
      { id: "m1", type: "image", src: "assets/ecom/detergent.jpg", title: "主图区" },
      { id: "m2", type: "hero", title: "超能洗衣液", sub: "植萃去渍 · 持久留香 · 母婴可用", color: "#1a1a1a" },
      { id: "m3", type: "params", cells: [["3kg", "大容量"], ["8x", "洁净力"], ["0", "荧光剂"]], color: "#ff4d2e" },
      { id: "m4", type: "image", src: "assets/ecom/toothbrush.jpg", title: "使用场景" }
    ];
  }
  function byId(st, id) { return st.mods.filter(function (m) { return m.id === id; })[0]; }
  function sel(st) { return byId(st, st.sel); }

  function addByType(el, type) {
    const st = el.__de;
    let m;
    if (type === "image") m = { id: uid(), type: "image", src: "assets/ecom/pot.jpg", title: "图片模块" };
    else if (type === "hero") m = { id: uid(), type: "hero", title: "新品卖点标题", sub: "一句话说明核心优势", color: "#1a1a1a" };
    else if (type === "params") m = { id: uid(), type: "params", cells: [["100%", "纯棉"], ["A类", "标准"], ["可机洗", "易打理"]], color: "#3b82f6" };
    else if (type === "compare") m = { id: uid(), type: "compare", title: "对比图", sub: "使用前后对比", color: "#12b76a" };
    else m = { id: uid(), type: "review", title: "买家口碑", sub: "真实好评展示", color: "#8b5cf6" };
    st.mods.push(m); st.sel = m.id; apply(el);
  }
  function thumb(m) {
    if (m.type === "image") return '<div class="m-thumb"><img src="' + esc(m.src) + '" alt=""></div>';
    const c = m.color || "#1c64f4";
    return '<div class="m-thumb" style="background:' + esc(c) + ';color:#fff"><svg class="ic sm"><use href="#i-text"/></svg></div>';
  }
  function sub(m) {
    if (m.type === "image") return m.title || "图片";
    if (m.type === "params") return (m.cells || []).map(function (c) { return c[0]; }).join(" / ");
    return m.title || "";
  }

  function renderList(el) {
    const st = el.__de;
    const box = el.querySelector(".list-editor");
    if (!box) return;
    let html = '<div class="mode-tip"><svg class="ic sm"><use href="#i-layers"/></svg>列表模式：纵向模块堆叠，拖拽排序、逐块编辑</div>';
    st.mods.forEach(function (m) {
      html += '<div class="module-row' + (m.id === st.sel ? " on" : "") + '" data-el="' + m.id + '">'
        + '<div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>'
        + thumb(m)
        + '<div class="m-info"><b>' + esc(TYPES[m.type] || "模块") + '</b><span>' + esc(sub(m)) + '</span></div>'
        + '<div class="m-actions">'
        + '<button data-row-act="up" title="上移"><svg class="ic sm"><use href="#i-arrow"/></svg></button>'
        + '<button data-row-act="down" title="下移"><svg class="ic sm"><use href="#i-arrow"/></svg></button>'
        + '<button data-row-act="del" title="删除"><svg class="ic sm"><use href="#i-trash"/></svg></button>'
        + '</div></div>';
    });
    html += '<div class="add-module">+ 添加模块</div>';
    box.innerHTML = html;
  }

  function blockHtml(st, m) {
    const on = m.id === st.sel ? " sel" : "";
    if (m.type === "image") return '<div class="ab-block' + on + '" data-el="' + m.id + '"><div class="ab-img"><img src="' + esc(m.src) + '" alt=""></div></div>';
    if (m.type === "hero") return '<div class="ab-block' + on + '" data-el="' + m.id + '"><div class="ab-hero"><h3 style="color:' + esc(m.color || "#1a1a1a") + '">' + esc(m.title || "") + '</h3><p>' + esc(m.sub || "") + '</p></div></div>';
    if (m.type === "params") return '<div class="ab-block' + on + '" data-el="' + m.id + '"><div class="ab-row">'
      + (m.cells || []).map(function (c) { return '<div class="ab-cell"><b style="color:' + esc(m.color || "#1c64f4") + '">' + esc(c[0]) + '</b>' + esc(c[1]) + '</div>'; }).join("")
      + '</div></div>';
    return '<div class="ab-block' + on + '" data-el="' + m.id + '"><div class="ab-param"><b style="color:' + esc(m.color || "#1c64f4") + '">' + esc(m.title || "") + '</b><span style="display:block;color:var(--muted);font-size:12px;margin-bottom:6px">' + esc(m.sub || "") + '</span><div class="line"></div><div class="line"></div><div class="line s"></div></div></div>';
  }
  function renderCanvas(el) {
    const st = el.__de;
    const art = el.querySelector(".artboard");
    if (!art) return;
    art.innerHTML = st.mods.map(function (m) { return blockHtml(st, m); }).join("");
  }

  function renderInspector(el) {
    const st = el.__de;
    const m = sel(st);
    const box = el.querySelector(".inspector");
    if (!box) return;
    if (!m) { box.innerHTML = '<h4>属性</h4><div class="ed-empty">未选中模块</div>'; return; }
    let html = '<h4>属性</h4><div class="field"><label>模块类型</label><div class="select">' + esc(TYPES[m.type] || m.type) + ' <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>';
    if (m.type === "image") {
      html += '<div class="field"><label>图片</label><div class="select" data-act="reimg" style="cursor:pointer">更换图片 <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>';
    } else if (m.type === "params") {
      html += '<div class="field"><label>参数（每行：数值|说明）</label><textarea class="inp" data-bind="cells" style="min-height:80px">'
        + esc((m.cells || []).map(function (c) { return c[0] + "|" + c[1]; }).join("\n")) + '</textarea></div>';
    } else {
      html += '<div class="field"><label>标题文案</label><input class="inp mini" data-bind="title" value="' + esc(m.title || "") + '"></div>';
      html += '<div class="field"><label>副标题</label><input class="inp mini" data-bind="sub" value="' + esc(m.sub || "") + '"></div>';
    }
    html += '<div class="field"><label>主色</label><div class="swatches">'
      + SWATCHES.map(function (c) { return '<div class="sw' + (String(m.color).toLowerCase() === c ? " on" : "") + '" data-color="' + c + '" style="background:' + c + '"></div>'; }).join("")
      + '</div></div>';
    html += '<div class="field"><label>图层</label><div class="layers">'
      + st.mods.slice().reverse().map(function (x) {
        return '<div class="layer' + (x.id === st.sel ? " on" : "") + '" data-layer="' + x.id + '"><svg class="ic sm"><use href="#i-layers"/></svg>' + esc(TYPES[x.type] || x.type) + '</div>';
      }).join("") + '</div></div>';
    box.innerHTML = html;
  }

  function apply(el) { renderList(el); renderCanvas(el); renderInspector(el); }

  function bindInspector(el) {
    const box = el.querySelector(".inspector");
    if (!box || box.__deBound) return;
    box.__deBound = true;
    box.addEventListener("input", function (ev) {
      const st = el.__de, m = sel(st);
      const b = ev.target.closest("[data-bind]");
      if (!m || !b) return;
      const k = b.getAttribute("data-bind");
      if (k === "cells") {
        m.cells = b.value.split("\n").map(function (l) { return l.split("|"); }).filter(function (a) { return a[0] && a[0].length; });
      } else m[k] = b.value;
      renderCanvas(el); renderList(el);
    });
    box.addEventListener("click", function (ev) {
      const st = el.__de, m = sel(st);
      const sw = ev.target.closest("[data-color]");
      if (sw && m) { m.color = sw.getAttribute("data-color"); apply(el); return; }
      const layer = ev.target.closest("[data-layer]");
      if (layer) { st.sel = layer.getAttribute("data-layer"); apply(el); return; }
      const reimg = ev.target.closest('[data-act="reimg"]');
      if (reimg && m) {
        EC.ui.pickFiles("image/*", false).then(function (f) {
          if (!f.length) return;
          EC.store.addFile(f[0], { kind: "upload" }).then(function (a) { m.src = EC.store.src(a); apply(el); });
        });
      }
    });
  }

  async function exportLong(el) {
    const st = el.__de;
    const W = 750;
    const cv = document.createElement("canvas");
    const ctx0 = cv.getContext("2d");
    const imgs = {};
    for (let i = 0; i < st.mods.length; i++) {
      const m = st.mods[i];
      if (m.type === "image") { try { imgs[m.id] = await EC.store.loadImage(m.src); } catch (e) {} }
    }
    let y = 0;
    const measure = st.mods.map(function (m) {
      if (m.type === "image") { const im = imgs[m.id]; const h = im ? W * (im.naturalHeight / im.naturalWidth) : W; return h; }
      if (m.type === "hero") return 170;
      if (m.type === "params") return 180;
      return 150;
    });
    const total = measure.reduce(function (a, b) { return a + b; }, 0);
    cv.width = W; cv.height = total;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, total);
    for (let i = 0; i < st.mods.length; i++) {
      const m = st.mods[i];
      const h = measure[i];
      if (m.type === "image") {
        const im = imgs[m.id];
        if (im) ctx.drawImage(im, 0, y, W, h);
        else { ctx.fillStyle = "#eef2f7"; ctx.fillRect(0, y, W, h); }
      } else if (m.type === "hero") {
        ctx.textAlign = "center";
        ctx.fillStyle = m.color || "#1a1a1a";
        ctx.font = "800 42px 'PingFang SC','Microsoft YaHei',sans-serif";
        ctx.fillText(m.title || "", W / 2, y + 70);
        ctx.fillStyle = "#606266";
        ctx.font = "22px 'PingFang SC','Microsoft YaHei',sans-serif";
        ctx.fillText(m.sub || "", W / 2, y + 118);
      } else if (m.type === "params") {
        const cells = m.cells || [];
        const cw = W / Math.max(cells.length, 1);
        cells.forEach(function (c, j) {
          ctx.textAlign = "center";
          ctx.fillStyle = m.color || "#1c64f4";
          ctx.font = "800 46px 'PingFang SC',sans-serif";
          ctx.fillText(c[0] || "", cw * j + cw / 2, y + 80);
          ctx.fillStyle = "#909399";
          ctx.font = "20px 'PingFang SC',sans-serif";
          ctx.fillText(c[1] || "", cw * j + cw / 2, y + 122);
        });
      } else {
        ctx.textAlign = "left";
        ctx.fillStyle = m.color || "#1c64f4";
        ctx.font = "800 30px 'PingFang SC',sans-serif";
        ctx.fillText(m.title || "", 40, y + 70);
        ctx.fillStyle = "#606266";
        ctx.font = "20px 'PingFang SC',sans-serif";
        ctx.fillText(m.sub || "", 40, y + 108);
      }
      y += h;
    }
    try {
      const blob = await EC.store.canvasToBlob(cv, "image/png");
      EC.store.downloadBlob(blob, "详情页_" + Date.now() + ".png");
      await EC.store.addAsset({ blob: blob, mime: "image/png", name: "详情页导出", kind: "detail" });
      if (EC.addUsage) EC.addUsage({ exported: 1 });
      EC.toast("已导出详情长图");
    } catch (err) { EC.toast((err && err.message) || "导出失败"); }
  }

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>详情页编辑</h1>
            <p>列表模式管结构，画布模式精修细节，同一份内容随时手动切换，导出一张完整长图。</p>
          </div>

          <div class="editor-wrap">
            <div class="toolbar">
              <div class="tool on" data-tool="select"><svg class="ic sm"><use href="#i-arrow"/></svg>选择</div>
              <div class="tool" data-tool="text"><svg class="ic sm"><use href="#i-text"/></svg>文字</div>
              <div class="tool" data-tool="upload"><svg class="ic sm"><use href="#i-image"/></svg>图片</div>
              <div class="tool-sep"></div>
              <div class="tool" data-tool="ai"><svg class="ic sm"><use href="#i-spark"/></svg>AI 重写</div>
              <div class="seg" data-mode-group style="margin-left:auto">
                <button class="on" data-mode="list"><svg class="ic sm"><use href="#i-layers"/></svg>列表</button>
                <button data-mode="canvas"><svg class="ic sm"><use href="#i-crop"/></svg>画布</button>
              </div>
              <button class="btn btn-primary" data-export style="width:auto;padding:8px 18px;font-size:13px;margin-left:10px"><svg class="ic sm"><use href="#i-download"/></svg>导出详情页</button>
            </div>

            <div class="editor-body">
              <div class="epanel">
                <h4>模块库</h4>
                <div class="block" data-add="image"><svg class="ic sm"><use href="#i-image"/></svg>主图区</div>
                <div class="block" data-add="hero"><svg class="ic sm"><use href="#i-text"/></svg>卖点区</div>
                <div class="block" data-add="params"><svg class="ic sm"><use href="#i-layers"/></svg>参数表</div>
                <div class="block" data-add="compare"><svg class="ic sm"><use href="#i-image"/></svg>对比图</div>
                <div class="block" data-add="review"><svg class="ic sm"><use href="#i-heart"/></svg>买家口碑</div>
              </div>

              <div class="stage">
                <div class="ed-view view-list">
                  <div class="list-editor"></div>
                </div>
                <div class="ed-view view-canvas" hidden>
                  <div class="canvas"><div class="artboard"></div></div>
                </div>
              </div>

              <div class="epanel right inspector"></div>
            </div>
          </div>
        </div>`;

  EC.register("ecomDetailEdit", function (el) {
    if (!el.__de) el.__de = { mods: defaults(), sel: "m1" };
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    apply(el);
    bindInspector(el);
    if (el.__ecomDeBound) return;
    el.__ecomDeBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const st = el.__de;
      const row = e.target.closest(".module-row");
      if (row) {
        const id = row.getAttribute("data-el");
        const act = e.target.closest("[data-row-act]");
        if (act) {
          e.stopPropagation();
          const what = act.getAttribute("data-row-act");
          const i = st.mods.map(function (m) { return m.id; }).indexOf(id);
          if (what === "del") { st.mods.splice(i, 1); if (st.sel === id) st.sel = (st.mods[0] || {}).id; }
          else if (what === "up" && i > 0) { const t = st.mods.splice(i, 1)[0]; st.mods.splice(i - 1, 0, t); }
          else if (what === "down" && i < st.mods.length - 1) { const t = st.mods.splice(i, 1)[0]; st.mods.splice(i + 1, 0, t); }
          apply(el); return;
        }
        st.sel = id; renderCanvas(el); renderInspector(el); return;
      }
      const add = e.target.closest(".add-module");
      if (add) {
        e.stopPropagation();
        EC.ui.menu(add, Object.keys(TYPES).map(function (t) { return { label: TYPES[t], pick: function () { addByType(el, t); } }; }));
        return;
      }
      const block = e.target.closest(".block");
      if (block) { addByType(el, block.getAttribute("data-add")); return; }
      const tool = e.target.closest(".toolbar .tool");
      if (tool) {
        const t = tool.getAttribute("data-tool");
        if (t === "text") addByType(el, "hero");
        else if (t === "upload") addByType(el, "image");
        else if (t === "ai") aiRewrite(el);
        return;
      }
      const exp = e.target.closest("[data-export]");
      if (exp) { exportLong(el); return; }
    });
  });

  function aiRewrite(el) {
    const st = el.__de, m = sel(st);
    if (!m || m.type === "image") { EC.toast("请先选中一个文案模块"); return; }
    const m2 = EC.ui.modal({ title: "AI 重写文案", body: '<div class="field"><label>补充说明（选填）</label><textarea class="inp" data-note style="min-height:70px" placeholder="例如：面向宝妈人群，突出安全无荧光剂"></textarea></div>' });
    const btn = EC.ui.el("button", "btn btn-primary", '<svg class="ic sm"><use href="#i-spark"/></svg>重写');
    btn.style.marginTop = "12px"; m2.body.appendChild(btn);
    btn.addEventListener("click", async function () {
      const note = m2.body.querySelector("[data-note]").value.trim();
      EC.ui.busy(btn, true);
      try {
        const out = await EC.gen.ask(
          "你是资深电商详情页文案，只输出一行简洁中文标题（不超过18字），不要引号不要解释。",
          "产品模块：" + (TYPES[m.type] || "") + "。当前标题：" + (m.title || "") + "。" + (note ? "要求：" + note : "")
        );
        const t = String(out || "").trim().split("\n")[0].replace(/^["“]|["”]$/g, "").slice(0, 18);
        if (t) { m.title = t; apply(el); EC.toast("已重写"); m2.close(); }
      } catch (err) {
        EC.toast(err && err.message === "NO_LLM" ? "未配置语言模型，请到设置填写 API Key" : ((err && err.message) || "重写失败"));
      } finally { EC.ui.busy(btn, false); }
    });
  }
})();
