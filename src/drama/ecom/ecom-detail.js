/* 电商工作台 · AI 详情图（真实上传 + AI 规划 + 真实生图 + 导出长图） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

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

  const PLATFORMS = ["智能匹配", "淘宝天猫", "京东", "拼多多", "抖音商城", "TikTok Shop", "Amazon"];
  const LANGS = ["简体中文", "English", "Bahasa Melayu", "日本語", "繁體中文"];
  const CLARITY = ["1K 标准", "2K 高清", "4K 超清"];
  const RATIOS = ["3:4 竖版", "1:1 方形", "4:3 横版", "9:16 长图"];
  const COUNTS = ["1 张", "2 张", "3 张", "4 张"];

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>AI 详情图</h1>
            <p>上传产品图，AI 解析卖点，自动生成整套电商详情图，可导出长图。</p>
          </div>

          <div class="split" style="grid-template-columns:400px 1fr">
            <div class="panel gen-form">
              <div class="panel-head">产品图 <span style="margin-left:auto;color:var(--muted);font-weight:500;font-size:12px"><b data-upcount>0</b>/6</span></div>
              <div class="panel-body">
                <div class="dropzone gd-drop" style="margin-bottom:18px">
                  <div class="dz-ic"><svg class="ic lg"><use href="#i-upload"/></svg></div>
                  <b>点击上传主商品图和同一产品的多角度图片</b>
                  <p>支持 JPG、JPEG、PNG、WEBP</p>
                  <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
                    <button class="btn btn-primary" data-up style="width:auto;padding:8px 16px;font-size:12.5px"><svg class="ic sm"><use href="#i-upload"/></svg>本地上传</button>
                    <button class="btn btn-ghost" data-history style="padding:8px 16px;font-size:12.5px"><svg class="ic sm"><use href="#i-lib"/></svg>历史上传</button>
                  </div>
                </div>
                <div class="gd-thumbs"></div>

                <div class="field sec">
                  <div class="label-row">
                    <label>详情图要求</label>
                    <div class="ai-write" data-aiwrite style="cursor:pointer"><svg class="ic sm"><use href="#i-spark"/></svg>AI 帮写</div>
                  </div>
                  <textarea placeholder="建议输入以下信息：产品名称、核心卖点、适用人群、规格参数、详情图风格等"></textarea>
                  <div class="chips" style="margin-top:10px">
                    <div class="chip">+ 专业质感</div>
                    <div class="chip">+ 科技感</div>
                    <div class="chip on">+ 突出核心卖点</div>
                    <div class="chip">+ 突出使用场景</div>
                    <div class="chip">+ 简约高级</div>
                    <div class="chip">+ 文案简洁</div>
                  </div>
                </div>

                <div class="grid2">
                  <div class="field"><label>目标平台</label>${sel("globe", "智能匹配", "platform")}</div>
                  <div class="field"><label>语言要求</label>${sel("translate", "简体中文", "lang")}</div>
                  <div class="field"><label>清晰度</label>${sel("grid-img", "1K 标准", "clarity")}</div>
                  <div class="field"><label>尺寸比例</label>${sel("crop", "3:4 竖版", "ratio")}</div>
                </div>

                <div class="field">
                  <label>生成张数</label>
                  ${sel("layers", "3 张", "count")}
                </div>

                <button class="btn btn-primary" data-gen style="margin-top:6px"><svg class="ic sm"><use href="#i-spark"/></svg>生成设计规划方案</button>
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

  function renderThumbs(el) {
    const st = el.__gd;
    const box = el.querySelector(".gd-thumbs");
    const cnt = el.querySelector("[data-upcount]");
    if (cnt) cnt.textContent = String(st.uploads.length);
    if (!box) return;
    box.innerHTML = st.uploads.map(function (a, i) {
      return '<div class="gd-thumb" data-i="' + i + '"><img src="' + esc(EC.store.src(a)) + '" alt=""><button class="up-del">&times;</button></div>';
    }).join("");
    const pg = el.querySelector(".gd-pgrid");
    if (pg && st.uploads.length) {
      pg.innerHTML = st.uploads.map(function (a) { return '<div class="gd-p"><img src="' + esc(EC.store.src(a)) + '" alt=""></div>'; }).join("");
    }
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
    if (!req && !st.uploads.length) { EC.toast("请先上传产品图或填写产品信息"); return; }
    EC.ui.busy(btn, true, "规划中…");
    try {
      const plan = await buildPlan(el, req || (st.uploads.length ? "上传的商品图片" : ""));
      const n = Math.max(1, parseInt(fieldValue(el, "count"), 10) || 3);
      const points = plan.points.slice(0, n);
      while (points.length < n) points.push(plan.title);
      const ratio = fieldValue(el, "ratio").split(" ")[0]; // 3:4
      const collage = el.querySelector(".gd-collage");
      collage.innerHTML = points.map(function (p, i) {
        return '<div class="gd-col" data-i="' + i + '"><div class="gd-panel hero t-blue"><div class="gd-load">生成中…</div>'
          + '<span class="gd-cap"><b>' + esc(p) + '</b><i>' + esc(plan.title) + '</i></span></div></div>';
      }).join("");
      const side = el.querySelector("[data-side-desc]");
      if (side) side.textContent = "正在生成：" + plan.title;

      for (let i = 0; i < points.length; i++) {
        const prompt = "电商详情图设计，产品： " + plan.title + " ，核心卖点： " + points[i] + " ，专业棚拍，干净简洁背景，高级质感，留出文字排版空间";
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

  function openSelect(el, key, options, labelNode) {
    const anchor = el.querySelector('[data-sel="' + key + '"]');
    EC.ui.menu(anchor, options.map(function (o) {
      return { label: o, pick: function () { labelNode.textContent = o; } };
    }));
  }

  EC.register("ecomDetail", function (el) {
    if (!el.__gd) el.__gd = { uploads: [] };
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    renderThumbs(el);
    const seg = el.querySelector("[data-mod-group]");
    if (seg) seg.addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
    });

    if (el.__ecomGdBound) return;
    el.__ecomGdBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const st = el.__gd;
      const del = e.target.closest(".gd-thumb .up-del");
      if (del) { e.stopPropagation(); st.uploads.splice(Number(del.closest(".gd-thumb").getAttribute("data-i")), 1); renderThumbs(el); return; }
      const up = e.target.closest("[data-up], .gd-drop");
      if (up) { addFiles(el); return; }
      const hist = e.target.closest("[data-history]");
      if (hist) { showHistory(el); return; }
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
        const map = { platform: PLATFORMS, lang: LANGS, clarity: CLARITY, ratio: RATIOS, count: COUNTS };
        const idx = (map[key] || []).indexOf(labelNode.textContent.replace(/\s+/g, " ").trim());
        EC.ui.menu(s, (map[key] || []).map(function (o, i) {
          return { label: o, on: i === idx, pick: function () { labelNode.innerHTML = labelNode.querySelector(".sel-ic").outerHTML + esc(o); } };
        }));
        return;
      }
    });

    function addFiles(el2) {
      EC.ui.pickFiles("image/*", true).then(async function (files) {
        if (!files.length) return;
        for (let i = 0; i < files.length && el2.__gd.uploads.length < 6; i++) {
          const a = await EC.store.addFile(files[i], { kind: "upload" }).catch(function () { return { id: EC.ui.uid("as"), kind: "upload", name: files[i].name, blob: files[i], mime: files[i].type }; });
          el2.__gd.uploads.push(a);
        }
        renderThumbs(el2);
        EC.toast("已上传 " + files.length + " 张产品图");
      });
    }
  });

  async function showHistory(el) {
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
        if (el.__gd.uploads.length >= 6) { EC.toast("最多 6 张"); return; }
        el.__gd.uploads.push(a); renderThumbs(el); m.close();
      });
    });
  }
})();
