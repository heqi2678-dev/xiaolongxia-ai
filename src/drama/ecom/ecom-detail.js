/* 电商工作台 · AI 详情图（三槽上传 + 详情图模块 + AI 规划 + 真实生图 + 导出长图） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;
  const C = EC.const || {};

  const PRODUCTS = ["pot.jpg", "lipstick.jpg", "detergent.jpg", "dress.jpg"].map(function (f) {
    return '<div class="gd-p"><img src="assets/ecom/' + f + '" alt="" loading="lazy"></div>';
  }).join("");

  const ARROW = '<svg class="gd-arrow" viewBox="0 0 64 46" fill="none" aria-hidden="true">'
    + '<path d="M6 40C22 44 30 30 22 24 14 18 6 26 14 31 26 38 42 32 52 16" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>'
    + '<path d="M44 15L54 15L50 25" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const DEMO_COLLAGE = [
    { img: "pot.jpg", tint: "warm", ti: "经典珐琅 凝聚美味", su: "一锅多用 · 锁温聚能" },
    { img: "lipstick.jpg", tint: "pink", ti: "玫瑰绽放 邂逅芳华", su: "丝绒质地 · 显白持色" },
    { img: "detergent.jpg", tint: "blue", ti: "洁净如新 守护全家", su: "浓缩配方 · 强效去渍" }
  ];
  function demoCols() {
    return DEMO_COLLAGE.map(function (p) {
      return '<div class="gd-col"><div class="gd-panel hero t-' + p.tint + '"><img src="assets/ecom/' + p.img + '" alt="" loading="lazy">'
        + '<span class="gd-cap"><b>' + p.ti + '</b><i>' + p.su + '</i></span></div></div>';
    }).join("");
  }

  function sel(icon, text, key) {
    return '<div class="select" data-sel="' + key + '"><span class="sel-val"><span class="sel-ic"><svg class="ic sm"><use href="#i-' + icon + '"/></svg></span>' + esc(text) + '</span>'
      + '<svg class="ic sm"><use href="#i-arrow"/></svg></div>';
  }

  /* 选项取值对齐 51aic，集中来自 EC.const */
  const PLATFORMS = C.PLATFORMS || ["智能匹配", "1688", "阿里国际站", "淘宝", "天猫", "拼多多", "京东", "抖音", "亚马逊", "TEMU", "eBay", "SHEIN", "Shopee", "Lazada", "TikTok", "Ozon", "速卖通", "独立站", "美客多", "小红书", "快手"];
  const LANGS = C.LANGS || ["简体中文", "繁体中文", "英语", "日语", "韩语", "德语", "法语", "阿拉伯语", "俄语", "泰语", "印尼语", "越南语", "马来语", "西班牙语", "葡萄牙语", "巴西葡萄牙语"];
  const CLARITY = ["1K 标准", "2K 高清", "4K 超清"];
  const RATIO_LABELS = (C.DETAIL_RATIOS || [
    { label: "1:1 正方形", value: "1:1" }, { label: "2:3 竖版", value: "2:3" }, { label: "3:2 横版", value: "3:2" },
    { label: "3:4 竖版", value: "3:4" }, { label: "4:3 横版", value: "4:3" }, { label: "4:5 竖版", value: "4:5" },
    { label: "5:4 横版", value: "5:4" }, { label: "9:16 手机竖版", value: "9:16" }, { label: "16:9 宽屏", value: "16:9" },
    { label: "21:9 超宽屏", value: "21:9" }
  ]).map(function (r) { return r.label; });
  const COUNT_NUMS = C.DETAIL_COUNTS || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const COUNTS = COUNT_NUMS.map(function (n) { return n + " 张"; });

  const PLATFORM_DEF = "智能匹配";
  const LANG_DEF = "简体中文";
  const CLARITY_DEF = "1K 标准";
  const RATIO_DEF = "3:4 竖版";
  const COUNT_DEF = "1 张";

  const SLOTS = [
    { key: "main", title: "产品图", tip: "上传产品图和同一产品的多角度图片", note: "必填 · 展示商品外观与关键信息", req: true },
    { key: "sku", title: "商品SKU图", tip: "不同颜色/款式 · 用于SKU展示", note: "用于生成 SKU 展示图，如果商品只有一个规格，可不上传", req: false },
    { key: "detail", title: "商品细节图", tip: "材质/工艺/局部 · 用于细节展示", note: "用于参考商品局部、材质和工艺细节，生成更准确的细节展示图", req: false }
  ];

  function defaultModules() {
    return [
      { name: "主图", desc: "展示商品首屏视觉图", selected: true, count: 1, maxCount: 5 },
      { name: "卖点图", desc: "展示商品的核心卖点", selected: true, count: 1, maxCount: 5 },
      { name: "细节图", desc: "放大材质与工艺", selected: true, count: 1, maxCount: 5 },
      { name: "场景图", desc: "呈现真实使用场景", selected: true, count: 1, maxCount: 5 },
      { name: "白底图", desc: "纯白色展示商品主体", selected: true, count: 1, maxCount: 1 },
      { name: "尺寸图", desc: "展示商品尺寸图", selected: false, count: 1, maxCount: 5 }
    ];
  }

  function slotHTML(s) {
    return '<div class="field sec gd-slot" data-slot="' + s.key + '">'
      + '<div class="label-row"><label>' + esc(s.title) + (s.req ? ' <span style="color:#ff4d4f">*</span>' : "") + '</label>'
      + '<span style="color:var(--muted);font-weight:500;font-size:12px"><b data-upcount="' + s.key + '">0</b>/6</span></div>'
      + '<div class="dropzone gd-drop" data-up="' + s.key + '" style="margin-bottom:12px">'
      + '<div class="dz-ic"><svg class="ic lg"><use href="#i-upload"/></svg></div>'
      + '<b>' + esc(s.tip) + '</b>'
      + '<p>' + esc(s.note) + '</p>'
      + '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">'
      + '<button class="btn btn-primary" style="width:auto;padding:8px 16px;font-size:12.5px"><svg class="ic sm"><use href="#i-upload"/></svg>本地上传</button>'
      + '<button class="btn btn-ghost" data-history="' + s.key + '" style="padding:8px 16px;font-size:12.5px"><svg class="ic sm"><use href="#i-lib"/></svg>历史上传</button>'
      + '</div>'
      + (s.key === "main" ? '<p class="gd-fmt">支持JPG，JPEG，PNG，WEBP</p><span class="gd-help" data-help><i>?</i>产品图片上传建议</span>' : '')
      + '</div>'
      + '<div class="gd-thumbs" data-thumbs="' + s.key + '"></div>'
      + '</div>';
  }

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>AI 详情图</h1>
            <p>上传产品图，AI 解析卖点，自动生成整套电商详情图，可导出长图。</p>
          </div>

          <div class="split" style="grid-template-columns:400px 1fr">
            <div class="panel gen-form">
              <div class="panel-head">产品图</div>
              <div class="panel-body">
                ${slotHTML(SLOTS[0])}

                <div class="field sec gd-extra">
                  <div class="label-row">
                    <label>补充参考素材（选传）</label>
                    <span class="gd-extra-toggle" data-extra-toggle>展开</span>
                  </div>
                  <div class="gd-extra-body" data-extra-body hidden>
                    ${SLOTS.slice(1).map(slotHTML).join("")}
                  </div>
                </div>

                <div class="field sec">
                  <div class="label-row"><label>详情图模块</label></div>
                  <div class="seg wide" data-mod-mode-group>
                    <button type="button" data-mod-mode="ai" class="on"><svg class="ic sm"><use href="#i-spark"/></svg>AI规划</button>
                    <button type="button" data-mod-mode="manual"><svg class="ic sm"><use href="#i-layers"/></svg>自选组合</button>
                  </div>
                  <div class="gd-modules" data-modules></div>
                  <div class="gd-mod-total" data-mod-total hidden></div>
                </div>

                <div class="field sec">
                  <div class="label-row">
                    <label>详情图要求</label>
                    <div class="ai-write" data-aiwrite style="cursor:pointer"><svg class="ic sm"><use href="#i-spark"/></svg>AI 帮写</div>
                  </div>
                  <textarea placeholder="建议输入以下信息：产品名称、核心卖点、适用人群、规格参数、详情图风格等"></textarea>
                  <div class="chips" style="margin-top:10px">
                    <div class="chip">专业质感</div>
                    <div class="chip">科技感</div>
                    <div class="chip">突出核心卖点</div>
                    <div class="chip">突出使用场景</div>
                    <div class="chip">简约高级</div>
                    <div class="chip">文案简洁</div>
                  </div>
                </div>

                <div class="grid2">
                  <div class="field"><label>目标平台</label>${sel("globe", PLATFORM_DEF, "platform")}</div>
                  <div class="field"><label>语言要求</label>${sel("translate", LANG_DEF, "lang")}</div>
                  <div class="field"><label>清晰度</label>${sel("grid-img", CLARITY_DEF, "clarity")}</div>
                  <div class="field"><label>尺寸比例</label>${sel("crop", RATIO_DEF, "ratio")}</div>
                </div>

                <div class="field" data-count-field>
                  <label>生成张数</label>
                  ${sel("layers", COUNT_DEF, "count")}
                </div>

                <button class="btn btn-primary" data-gen disabled style="margin-top:6px"><svg class="ic sm"><use href="#i-spark"/></svg>生成设计规划方案</button>
                <button class="btn btn-ghost" data-export style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>导出详情长图</button>
              </div>
            </div>

            <div class="gen-side">
              <h2>一键生成电商详情图</h2>
              <p data-side-desc>上传产品图，AI 深度解析产品亮点，自动生成多角度、多场景的整套电商详情图</p>
              <div class="badge-row">
                <div class="mini-badge"><svg class="ic sm" style="color:var(--primary)"><use href="#i-spark"/></svg>卖点解析</div>
                <div class="mini-badge"><svg class="ic sm" style="color:var(--primary)"><use href="#i-image"/></svg>多场景生成</div>
                <div class="mini-badge"><svg class="ic sm" style="color:var(--primary)"><use href="#i-layers"/></svg>整套排版</div>
              </div>
              <div class="gen-demo">
                <div class="gd-products">
                  <div class="gd-pgrid">${PRODUCTS}</div>
                  <span class="gd-label">产品图</span>
                </div>
                ${ARROW}
                <div class="gd-collage">${demoCols()}</div>
              </div>
            </div>
          </div>
        </div>`;

  function now() { return Date.now(); }

  function newState() {
    return { slots: { main: [], sku: [], detail: [] }, moduleMode: "ai", modules: defaultModules(), uploads: [] };
  }

  function selectedModuleCount(st) {
    return st.modules.filter(function (m) { return m.selected; })
      .reduce(function (n, m) { return n + (Number(m.count) || 0); }, 0);
  }

  function renderThumbs(el) {
    const st = el.__gd;
    SLOTS.forEach(function (s) {
      const list = st.slots[s.key] || [];
      const cnt = el.querySelector('[data-upcount="' + s.key + '"]');
      if (cnt) cnt.textContent = String(list.length);
      const box = el.querySelector('[data-thumbs="' + s.key + '"]');
      if (!box) return;
      box.innerHTML = list.map(function (a, i) {
        return '<div class="gd-thumb" data-slot="' + s.key + '" data-i="' + i + '"><img src="' + esc(EC.store.src(a)) + '" alt=""><button class="up-del">&times;</button></div>';
      }).join("");
    });
    const pg = el.querySelector(".gd-pgrid");
    const main = st.slots.main || [];
    if (pg && main.length) {
      pg.innerHTML = main.map(function (a) { return '<div class="gd-p"><img src="' + esc(EC.store.src(a)) + '" alt=""></div>'; }).join("");
    }
    const gb = el.querySelector("[data-gen]");
    if (gb) gb.disabled = !main.length;
  }

  function renderModules(el) {
    const st = el.__gd;
    const box = el.querySelector("[data-modules]");
    const total = el.querySelector("[data-mod-total]");
    if (!box) return;
    if (st.moduleMode === "ai") {
      box.innerHTML = '<div class="gd-mod-hint">AI 将依据商品信息自动规划详情图结构。</div>';
    } else {
      box.innerHTML = st.modules.map(function (m, i) {
        return '<div class="gd-mod' + (m.selected ? " on" : "") + '" data-mod="' + i + '">'
          + '<div class="gd-mod-main"><span class="gd-check' + (m.selected ? " on" : "") + '"></span>'
          + '<b>' + esc(m.name) + '</b><span class="gd-mod-desc">' + esc(m.desc) + '</span></div>'
          + '<div class="stepper" data-mod-step="' + i + '"><button type="button" data-mod-dec>&minus;</button><span data-mod-count>' + m.count + '</span><button type="button" data-mod-inc>+</button></div>'
          + '</div>';
      }).join("");
    }
    if (total) {
      if (st.moduleMode === "manual") {
        total.hidden = false;
        total.textContent = "合计 " + selectedModuleCount(st) + " 张";
      } else {
        total.hidden = true;
      }
    }
    const cf = el.querySelector("[data-count-field]");
    if (cf) cf.hidden = st.moduleMode === "manual";
  }

  function fieldValue(el, key) {
    const s = el.querySelector('[data-sel="' + key + '"]');
    return s ? s.querySelector(".sel-val").textContent.replace(/\s+/g, " ").trim() : "";
  }

  async function buildPlan(el, req) {
    const text = req || "";
    const styleChip = (el.querySelector(".chips .chip.on") || {}).textContent || "";
    if (EC.gen.llmConfigured()) {
      try {
        const out = await EC.gen.ask(
          "你是资深电商详情页策划。根据产品信息输出 JSON，字段：title(产品标题,<=14字), points(3条卖点,每条<=12字)。只输出 JSON。",
          "产品信息：" + text + " 风格：" + styleChip
        );
        const j = EC.gen.extractJson(out);
        if (j && j.points && j.points.length) return { title: j.title || "精选好物", points: j.points.slice(0, 4) };
      } catch (e) {}
    }
    const parts = text.split(/[，,。.\n；;]/).map(function (s) { return s.trim(); }).filter(Boolean);
    return {
      title: (parts[0] || "精选好物").slice(0, 14),
      points: [parts[0] || "品质优选", parts[1] || "细节出众", parts[2] || "安心之选"].map(function (s) { return s.slice(0, 12); })
    };
  }

  async function generate(el, btn) {
    const st = el.__gd;
    const ta = el.querySelector("textarea");
    const req = (ta.value || "").trim();
    if (!(st.slots.main || []).length) { EC.toast("请先上传产品图"); return; }

    let points;
    if (st.moduleMode === "manual") {
      const mods = st.modules.filter(function (m) { return m.selected; });
      if (!mods.length) { EC.toast("至少选择一个详情图模块"); return; }
      points = [];
      mods.forEach(function (m) { for (let i = 0; i < m.count; i++) points.push(m.name); });
    }

    EC.ui.busy(btn, true, "规划中…");
    try {
      const plan = await buildPlan(el, req || "上传的商品图片");
      if (!points) {
        const n = Math.max(1, Math.min(15, parseInt(fieldValue(el, "count"), 10) || 3));
        points = plan.points.slice(0, n);
        while (points.length < n) points.push(plan.title);
      }
      const ratio = fieldValue(el, "ratio").split(" ")[0]; // "1:1"
      const collage = el.querySelector(".gd-collage");
      collage.innerHTML = points.map(function (p, i) {
        return '<div class="gd-col" data-i="' + i + '"><div class="gd-panel hero t-blue"><div class="gd-load">生成中…</div>'
          + '<span class="gd-cap"><b>' + esc(p) + '</b><i>' + esc(plan.title) + '</i></span></div></div>';
      }).join("");
      const side = el.querySelector("[data-side-desc]");
      if (side) side.textContent = "正在生成：" + plan.title;

      for (let i = 0; i < points.length; i++) {
        const prompt = "电商详情图设计，产品： " + plan.title + " ，画面： " + points[i] + " ，专业棚拍，干净简洁背景，高级质感，留出文字排版空间";
        try {
          const r = await EC.gen.image({ prompt: prompt, ratio: ratio });
          const asset = await EC.store.addFromUrl(r.url, { name: plan.title + "·" + points[i], kind: "detail", meta: { provider: r.provider, prompt: prompt } });
          const col = collage.querySelector('.gd-col[data-i="' + i + '"] .gd-panel');
          if (col) {
            col.innerHTML = '<img src="' + esc(EC.store.src(asset)) + '" alt="" data-id="' + esc(asset.id) + '">'
              + '<span class="gd-cap"><b>' + esc(points[i]) + '</b><i>' + esc(plan.title) + '</i></span>';
          }
          if (EC.addUsage) EC.addUsage({ generated: 1 });
        } catch (e) {
          const col = collage.querySelector('.gd-col[data-i="' + i + '"] .gd-panel');
          if (col) col.innerHTML = '<div class="gd-load">生成失败：' + esc((e && e.message) || "") + '</div><span class="gd-cap"><b>' + esc(points[i]) + '</b></span>';
        }
      }
      if (side) side.textContent = "已生成《" + plan.title + "》整套详情图，可导出长图或到作品库查看";
      EC.toast("详情图生成完成");
    } catch (e) {
      EC.toast((e && e.message) || "生成失败");
    } finally { EC.ui.busy(btn, false); }
  }

  async function exportLong(el) {
    const imgs = Array.prototype.slice.call(el.querySelectorAll(".gd-collage .gd-panel img"));
    if (!imgs.length) { EC.toast("请先生成详情图"); return; }
    const W = 750;
    try {
      const loaded = [];
      for (let i = 0; i < imgs.length; i++) {
        try { loaded.push(await EC.store.loadImage(imgs[i].getAttribute("src"))); } catch (e) {}
      }
      if (!loaded.length) { EC.toast("图片无法导出（可能跨域限制）"); return; }
      const heights = loaded.map(function (im) { return W * (im.naturalHeight / im.naturalWidth); });
      const total = heights.reduce(function (a, b) { return a + b; }, 0);
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = total;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, total);
      let y = 0;
      loaded.forEach(function (im, i) { ctx.drawImage(im, 0, y, W, heights[i]); y += heights[i]; });
      const blob = await EC.store.canvasToBlob(cv, "image/png");
      EC.store.downloadBlob(blob, "详情长图_" + now() + ".png");
      await EC.store.addAsset({ blob: blob, mime: "image/png", name: "详情长图", kind: "detail" });
      if (EC.addUsage) EC.addUsage({ exported: 1 });
      EC.toast("已导出详情长图");
    } catch (e) { EC.toast((e && e.message) || "导出失败"); }
  }

  async function aiWrite(el) {
    const ta = el.querySelector("textarea");
    if (!EC.gen.llmConfigured()) { EC.toast("未配置语言模型，请到设置填写 API Key"); return; }
    EC.toast("AI 正在撰写…");
    try {
      const out = await EC.gen.ask(
        "你是电商运营，用一句话中文列出该产品的核心卖点、适用人群与规格，120字以内，直接输出正文。",
        "已上传商品图，请帮我补齐详情图要求。用户已填：" + (ta.value || "（空）")
      );
      if (out) { ta.value = String(out).trim(); EC.toast("已帮写，可继续修改"); }
    } catch (e) { EC.toast((e && e.message) || "AI 帮写失败"); }
  }

  EC.register("ecomDetail", function (el) {
    if (!el.__gd || !el.__gd.slots) el.__gd = newState();
    const st = el.__gd;
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    renderThumbs(el);
    renderModules(el);

    if (el.__ecomGdBound) return;
    el.__ecomGdBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const state = el.__gd;

      const extraToggle = e.target.closest("[data-extra-toggle]");
      if (extraToggle) {
        const body = el.querySelector("[data-extra-body]");
        if (body) {
          body.hidden = !body.hidden;
          extraToggle.textContent = body.hidden ? "展开" : "收起";
        }
        return;
      }

      const help = e.target.closest("[data-help]");
      if (help) { helpDialog(); return; }

      const del = e.target.closest(".gd-thumb .up-del");
      if (del) {
        e.stopPropagation();
        const t = del.closest(".gd-thumb");
        const key = t.getAttribute("data-slot");
        state.slots[key].splice(Number(t.getAttribute("data-i")), 1);
        renderThumbs(el); return;
      }

      const up = e.target.closest("[data-up]");
      if (up) { addFiles(el, up.getAttribute("data-up")); return; }

      const hist = e.target.closest("[data-history]");
      if (hist) { showHistory(el, hist.getAttribute("data-history")); return; }

      const mm = e.target.closest("[data-mod-mode]");
      if (mm) {
        state.moduleMode = mm.getAttribute("data-mod-mode");
        const g = mm.closest("[data-mod-mode-group]");
        if (g) g.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        mm.classList.add("on");
        renderModules(el); return;
      }

      const stepBtn = e.target.closest("[data-mod-inc], [data-mod-dec]");
      if (stepBtn) {
        e.stopPropagation();
        const i = Number(stepBtn.closest("[data-mod-step]").getAttribute("data-mod-step"));
        const m = state.modules[i];
        if (m) {
          const d = stepBtn.hasAttribute("data-mod-inc") ? 1 : -1;
          m.count = Math.max(1, Math.min(m.maxCount, (Number(m.count) || 1) + d));
          renderModules(el);
        }
        return;
      }

      const mod = e.target.closest(".gd-mod");
      if (mod) {
        const i = Number(mod.getAttribute("data-mod"));
        const m = state.modules[i];
        if (m) { m.selected = !m.selected; }
        renderModules(el); return;
      }

      const aiw = e.target.closest("[data-aiwrite]");
      if (aiw) { aiWrite(el); return; }
      const gen = e.target.closest("[data-gen]");
      if (gen) { generate(el, gen); return; }
      const exp = e.target.closest("[data-export]");
      if (exp) { exportLong(el); return; }
      const s = e.target.closest("[data-sel]");
      if (s) {
        e.stopPropagation(); e.preventDefault();
        const key = s.getAttribute("data-sel");
        const labelNode = s.querySelector(".sel-val");
        const map = { platform: PLATFORMS, lang: LANGS, clarity: CLARITY, ratio: RATIO_LABELS, count: COUNTS };
        const idx = (map[key] || []).indexOf(labelNode.textContent.replace(/\s+/g, " ").trim());
        EC.ui.menu(s, (map[key] || []).map(function (o, i) {
          return { label: o, on: i === idx, pick: function () { labelNode.innerHTML = labelNode.querySelector(".sel-ic").outerHTML + esc(o); } };
        }));
        return;
      }
    });

    function addFiles(el2, key) {
      EC.ui.pickFiles("image/*", true).then(async function (files) {
        if (!files.length) return;
        const list = el2.__gd.slots[key];
        let added = 0;
        for (let i = 0; i < files.length && list.length < 6; i++) {
          const a = await EC.store.addFile(files[i], { kind: "upload" }).catch(function () { return { id: EC.ui.uid("as"), kind: "upload", name: files[i].name, blob: files[i], mime: files[i].type }; });
          list.push(a); added++;
        }
        renderThumbs(el2);
        if (added < files.length) EC.toast("已达到 6 张上限，仅添加前 " + added + " 张");
        else EC.toast("已上传 " + added + " 张");
      });
    }
  });

  function helpDialog() {
    const body = '<div class="gd-help-box">'
      + '<div class="gd-help-tip"><b>1. 主体清晰</b><span>产品图请保证主体完整、无遮挡，建议使用纯色或简洁背景。</span></div>'
      + '<div class="gd-help-tip"><b>2. 多角度更佳</b><span>可上传正面、侧面、背面等多角度图片，AI 生成更准确。</span></div>'
      + '<div class="gd-help-samples">'
      + ['pot.jpg', 'lipstick.jpg', 'detergent.jpg', 'dress.jpg'].map(function (f) {
          return '<img src="assets/ecom/' + f + '" alt="">';
        }).join("")
      + '</div></div>';
    EC.ui.modal({ title: "产品图片上传建议", body: body });
  }

  async function showHistory(el, key) {
    const items = (await EC.store.list().catch(function () { return []; })).filter(function (a) { return a.kind === "upload" || a.kind === "image"; });
    const body = items.length
      ? '<div class="hist-grid">' + items.slice(0, 40).map(function (a) {
          return '<div class="hist-item" data-id="' + esc(a.id) + '"><img src="' + esc(EC.store.src(a)) + '" alt=""><span>' + esc(a.name || "素材") + '</span></div>';
        }).join("") + '</div>'
      : '<div class="ed-empty">还没有历史上传。</div>';
    const m = EC.ui.modal({ title: "历史上传", body: body, wide: true });
    m.body.addEventListener("click", function (e) {
      const it = e.target.closest(".hist-item");
      if (!it) return;
      EC.store.get(it.getAttribute("data-id")).then(function (a) {
        if (!a) return;
        const list = el.__gd.slots[key] || (el.__gd.slots[key] = []);
        if (list.length >= 6) { EC.toast("最多 6 张"); return; }
        list.push(a); renderThumbs(el); m.close();
      });
    });
  }
})();
