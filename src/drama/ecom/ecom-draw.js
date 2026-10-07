/* 电商工作台 · AI 作图 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const TOOLS = [
    ["agent", "Agent 模式", "智能体自动完成修图与合成"],
    ["grid-img", "主图套图", "生成成套电商主图，白底+场景+卖点"],
    ["eraser", "精修白底图", "抠出主体并更换为纯白背景"],
    ["shirt", "AI 试衣", "把服装自然地穿在模特身上"],
    ["hanger", "万物穿戴", "让模特试戴任意商品（鞋包配饰）"],
    ["swap", "商品替换", "保持场景不变，替换其中的商品"],
    ["translate", "图片翻译", "保留排版将图中文字翻译为其他语言"],
    ["watermark-off", "去除水印", "移除图片上的水印与多余文字"],
    ["pose", "姿势裂变", "同一主体生成多个自然姿势"],
    ["palette", "商品换色", "保持质感更换商品配色"],
    ["wand", "商品精修", "提升清晰度与质感，专业级修图"],
    ["poster", "海报设计", "生成带文案与排版的营销海报"]
  ];
  const WORKS = ["pot.jpg", "dress.jpg", "detergent.jpg", "skincare.jpg", "shoes.jpg", "lipstick.jpg", "toothbrush.jpg", "dress.jpg"];
  const GALLERY = WORKS.map(function (f) {
    return '<div class="draw-item"><img src="assets/ecom/' + f + '" alt="" loading="lazy"></div>';
  }).join("");

  const HTML = `<div class="inner">
          <div class="genai">
            <div class="genai-top">
              <button class="btn btn-ghost hist" style="padding:8px 14px;font-size:12.5px"><svg class="ic sm"><use href="#i-lib"/></svg>生成记录</button>
              <div class="genai-brand">
                <div class="brand-mark">铜龙</div>
                <div>铜龙AI · <span class="accent">一站式电商 AI 作图</span></div>
              </div>
            </div>

            <div class="tool-grid">
              ${TOOLS.map(function (t, i) {
                return '<div class="tool-card' + (i === 0 ? " on" : "") + '" data-tool="' + t[0] + '" data-hint="' + esc(t[2]) + '"><svg class="ic sm"><use href="#i-' + t[0] + '"/></svg>' + esc(t[1]) + '</div>';
              }).join("")}
            </div>

            <div class="prompt-box">
              <div class="prompt-main">
                <div class="upload-slot" title="上传参考图（最多 10 张）"><svg class="ic"><use href="#i-plus"/></svg><span data-upcount>0/10</span></div>
                <textarea placeholder="描述你想要生成的图片，例如：将衣服、裤子、鞋子搭配穿在模特身上，生成自然的试衣效果"></textarea>
              </div>
              <div class="up-strip"></div>
              <div class="prompt-bar">
                <div class="pill ratio" data-ratio="1:1" title="选择出图比例"><svg class="ic sm"><use href="#i-spark"/></svg><span>智能比例 · 1:1</span></div>
                <div class="pill"><svg class="ic sm"><use href="#i-layers"/></svg>技能库</div>
                <div class="gen-hint" data-provider></div>
                <div class="send-btn">
                  <span class="cost">5 / 张</span>
                  <button class="send-arrow" title="开始生成"><svg class="ic"><use href="#i-arrow"/></svg></button>
                </div>
              </div>
            </div>

            <div class="sec-title" style="margin-top:28px"><h2>生成结果</h2><a data-href="ecomGallery">查看全部</a></div>
            <div class="draw-gallery draw-results"></div>

            <div class="sec-title" style="margin-top:28px"><h2>示例作品</h2></div>
            <div class="draw-gallery">${GALLERY}</div>
          </div>
        </div>`;

  function toolHint(el, name) {
    const c = el.querySelector('.tool-card[data-tool="' + name + '"]');
    return c ? (c.getAttribute("data-hint") || "") : "";
  }

  function renderUploads(el) {
    const st = el.__draw;
    const strip = el.querySelector(".up-strip");
    const cnt = el.querySelector("[data-upcount]");
    if (cnt) cnt.textContent = st.files.length + "/10";
    if (!strip) return;
    strip.innerHTML = st.files.map(function (a, i) {
      const src = EC.store.src(a);
      return '<div class="up-thumb" data-i="' + i + '"><img src="' + esc(src) + '" alt=""><button class="up-del" title="移除">&times;</button></div>';
    }).join("");
  }

  function addResult(el, asset, meta) {
    const box = el.querySelector(".draw-results");
    if (!box) return;
    const src = EC.store.src(asset);
    const node = document.createElement("div");
    node.className = "draw-item gen";
    node.setAttribute("data-id", asset.id);
    node.innerHTML = '<img src="' + esc(src) + '" alt="">'
      + '<div class="gen-overlay"><span class="tag">' + esc((meta && meta.provider) || asset.kind || "生成") + '</span>'
      + '<div class="acts"><button data-act="dl" title="下载"><svg class="ic sm"><use href="#i-download"/></svg></button>'
      + '<button data-act="edit" title="去编辑"><svg class="ic sm"><use href="#i-layers"/></svg></button></div></div>';
    box.insertBefore(node, box.firstChild);
    while (box.children.length > 16) box.removeChild(box.lastChild);
  }

  async function doGenerate(el, btn) {
    const st = el.__draw;
    const ta = el.querySelector(".prompt-box textarea");
    const text = (ta && ta.value || "").trim();
    if (!text) { EC.toast("请先用大白话描述你想要的图片"); if (ta) ta.focus(); return; }
    const hint = toolHint(el, st.tool);
    const prompt = (hint ? hint + "；" : "") + text;
    EC.ui.busy(btn, true, "");
    try {
      const refImages = st.files.map(function (a) { return EC.store.src(a); }).filter(Boolean);
      const r = await EC.gen.image({ prompt: prompt, ratio: st.ratio, refImages: refImages });
      const asset = await EC.store.addFromUrl(r.url, {
        name: text.slice(0, 20), kind: "image",
        meta: { tool: st.tool, provider: r.provider, prompt: prompt, ratio: st.ratio }
      });
      addResult(el, asset, { provider: r.provider });
      if (EC.addUsage) EC.addUsage({ generated: 1 });
      EC.toast("生成成功 · " + (r.provider || "AI"));
    } catch (e) {
      EC.toast((e && e.message) || "生成失败，请稍后重试");
    } finally {
      EC.ui.busy(btn, false);
    }
  }

  async function showHistory(el) {
    const items = await EC.store.list().catch(function () { return []; });
    const gen = items.filter(function (a) { return a.kind === "image" || a.kind === "upload"; });
    const body = gen.length
      ? '<div class="hist-grid">' + gen.slice(0, 40).map(function (a) {
          const src = EC.store.src(a);
          return '<div class="hist-item" data-id="' + esc(a.id) + '"><img src="' + esc(src) + '" alt="">'
            + '<span>' + esc(a.name || "作品") + '</span></div>';
        }).join("") + '</div>'
      : '<div class="ed-empty">还没有生成记录，先试着生成一张吧。</div>';
    const m = EC.ui.modal({ title: "生成记录", body: body, wide: true });
    m.body.addEventListener("click", function (e) {
      const it = e.target.closest(".hist-item");
      if (!it) return;
      EC.store.get(it.getAttribute("data-id")).then(function (a) {
        if (!a) return;
        EC.store.download(a);
        if (EC.addUsage) EC.addUsage({ exported: 1 });
      });
    });
  }

  EC.register("ecomDraw", function (el) {
    if (!el.__draw) el.__draw = { files: [], ratio: "1:1", ratioLabel: "智能比例 · 1:1", tool: "agent" };
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    const prov = el.querySelector("[data-provider]");
    if (prov) prov.textContent = EC.gen ? "出图服务：" + EC.gen.providerName() : "";
    if (EC.store && EC.store.ready) EC.store.ready();
    renderUploads(el);

    if (el.__ecomDrawBound) { return; }
    el.__ecomDrawBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const st = el.__draw;
      const root = e.target.closest(".ecom-ui") || el;

      const del = e.target.closest(".up-del");
      if (del) { e.stopPropagation(); const i = Number(del.closest(".up-thumb").getAttribute("data-i")); st.files.splice(i, 1); renderUploads(el); return; }

      const slot = e.target.closest(".upload-slot");
      if (slot) { EC.ui.pickFiles("image/*", true).then(function (files) { if (files.length) addFiles(el, files); }); return; }

      const tool = e.target.closest(".tool-card");
      if (tool) { st.tool = tool.getAttribute("data-tool"); return; }

      const ratio = e.target.closest(".pill.ratio");
      if (ratio) {
        e.stopPropagation();
        const opts = [["1:1", "智能比例 · 1:1"], ["3:4", "竖版 · 3:4"], ["4:3", "横版 · 4:3"], ["16:9", "宽屏 · 16:9"], ["9:16", "短视频 · 9:16"]];
        EC.ui.menu(ratio, opts.map(function (o) { return { label: o[1], on: o[0] === st.ratio, pick: function () { st.ratio = o[0]; ratio.querySelector("span").textContent = o[1]; } }; }));
        return;
      }

      const send = e.target.closest(".send-arrow");
      if (send) { doGenerate(el, send); return; }

      const hist = e.target.closest(".hist");
      if (hist) { showHistory(el); return; }

      const goEl = e.target.closest("[data-href]");
      if (goEl) { EC.go(goEl.getAttribute("data-href")); return; }

      const gitem = e.target.closest(".draw-item.gen");
      if (gitem) {
        const act = e.target.closest("[data-act]");
        const id = gitem.getAttribute("data-id");
        EC.store.get(id).then(function (a) {
          if (!a) return;
          if (act && act.getAttribute("data-act") === "dl") { EC.store.download(a); if (EC.addUsage) EC.addUsage({ exported: 1 }); }
          else { EC.go("ecomMainEdit"); }
        });
        return;
      }
    });

    async function addFiles(el2, files) {
      for (let i = 0; i < files.length && el2.__draw.files.length < 10; i++) {
        const a = await EC.store.addFile(files[i], { kind: "upload" }).catch(function () {
          return { id: EC.ui.uid("as"), kind: "upload", name: files[i].name, blob: files[i], mime: files[i].type };
        });
        el2.__draw.files.push(a);
      }
      renderUploads(el2);
      EC.toast("已添加 " + files.length + " 张参考图");
    }
  });
})();
