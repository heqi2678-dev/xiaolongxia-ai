/* 电商工作台 · AI 作图 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  /* 12 个工作模式：与爱创 AI 作图页一致（顺序、名称、描述） */
  const MODES = [
    { key: "agent", name: "Agent模式", desc: "描述需求，智能生成", icon: "agent", composer: "agent" },
    { key: "main", name: "主图套图", desc: "生成整套商品套图", icon: "grid-img", composer: "main" },
    { key: "white", name: "精修白底图", desc: "商品精修白底图", icon: "eraser", composer: "simple", ph: "上传商品图，生成一张纯白背景的商品精修图" },
    { key: "try", name: "AI试衣", desc: "服装一键上身", icon: "shirt", composer: "simple", ph: "上传服装与模特图，生成自然的试衣效果" },
    { key: "wear", name: "万物穿戴", desc: "商品智能穿戴", icon: "hanger", composer: "simple", ph: "上传商品与模特图，让模特自然穿戴该商品（鞋包配饰）" },
    { key: "swap", name: "商品替换", desc: "商品精准替换", icon: "swap", composer: "simple", ph: "上传场景图与商品图，将场景中的商品替换为目标商品" },
    { key: "trans", name: "图片翻译", desc: "图片文字翻译", icon: "translate", composer: "translate" },
    { key: "wm", name: "去除水印", desc: "无痕去除水印", icon: "watermark-off", composer: "simple", ph: "上传图片，无痕去除其中的水印与多余文字" },
    { key: "pose", name: "姿势裂变", desc: "智能生成多种姿势", icon: "pose", composer: "simple", ph: "上传人物图，智能生成多种自然姿势" },
    { key: "recolor", name: "商品换色", desc: "精准替换目标颜色", icon: "palette", composer: "simple", ph: "上传商品图，保持质感更换配色，例如：改为奶白色" },
    { key: "retouch", name: "商品精修", desc: "去瑕提质更清晰", icon: "wand", composer: "simple", ph: "上传商品图，去瑕提质、提升清晰度" },
    { key: "poster", name: "海报设计", desc: "多类型海报生成", icon: "poster", composer: "poster" }
  ];
  const CTRL = ["agent", "main", "trans", "poster"];

  const RATIOS = ["智能比例", "1:1", "2:3", "3:2", "3:4", "9:16", "16:9", "21:9"];
  const QUALITIES = ["1K 标准", "2K 高清", "4K 超清"];
  const COUNTS = ["3张", "5张", "8张", "10张", "15张"];
  const PLATFORMS = ["智能匹配", "1688", "阿里国际站", "淘宝", "天猫", "拼多多", "京东", "抖音", "亚马逊", "TEMU", "eBay", "SHEIN", "Shopee", "Lazada", "TikTok", "Ozon", "速卖通", "独立站", "美客多", "小红书", "快手"];
  const LANGS = ["简体中文", "繁体中文", "英语", "日语", "韩语", "德语", "法语", "阿拉伯语", "俄语", "泰语", "印尼语", "越南语", "马来语", "西班牙语", "葡萄牙语", "巴西葡萄牙语"];
  const TRANS_LANGS = ["简体中文", "英文", "韩语", "日语", "俄语", "西班牙语", "法语", "葡萄牙语", "意大利语", "越南语", "马来语", "泰语", "印尼语", "阿拉伯语"];
  const TRANS_SCOPES = ["Logo、品牌名、商品主体上的文字不翻译", "Logo、品牌名、商品主体上的文字也翻译"];
  const POSTER_TYPES = ["宣传海报", "促销海报", "节日海报", "社媒海报"];

  /* 技能库：商品展示 / 模特编辑 / 图像处理 */
  const SKILLS = [
    { cat: "商品展示", items: [
      ["高端商品主图", "生成一张高端电商主图。"],
      ["手持商品", "根据我上传的商品图，生成一名合适的模特自然手持该商品。"],
      ["商品平铺展示", "将商品自然平铺展示，保持款式、颜色、材质和细节不变。"],
      ["商品换场景", "帮我图片中的商品换一个场景，场景是【商品摆放在浅米色大理石桌面上，旁边点缀一小束白色鲜花，整体氛围温暖、优雅】。"],
      ["商品换角度", "生成多角度的商品图。"]
    ] },
    { cat: "模特编辑", items: [
      ["更换模特", "帮我把人物换成一个【欧美女模特，白皮肤，金发，服装不变】。"],
      ["更换表情", "将模特表情改为【微笑】。"],
      ["模特换场景", "将模特所在场景更换为【城市街道】，呈现场景氛围【自然街拍感】。"],
      ["模特试衣", "生成一个模特穿上这件衣服。"],
      ["发型", "将发型改为【短发】。"],
      ["美颜", "给图片中的人【瘦脸】。"],
      ["换装", "将服装改为【明制汉服】。"],
      ["动作", "将动作改为【摸头发】。"],
      ["AI试鞋", "将鞋子穿到模特脚上，使用【智能随机姿势】生成【5张】试鞋效果图，生成比例为【智能比例】。"]
    ] },
    { cat: "图像处理", items: [
      ["文字替换", "将图片中的【原文字】替换为【目标文字】。"],
      ["局部修改", "将图片中的【指定位置】修改为【具体修改要求】。"],
      ["添加文字", "在图片【位置】添加文字“【文字内容】”，使用【颜色/风格】，排版【要求】。"],
      ["消除元素", "消除图片中的【图标】。"],
      ["改变风格", "将画面改为【绘本】风格。"],
      ["改变光影", "将画面改为【逆光】。"],
      ["改变色调", "将画面改为【暖色调】。"],
      ["改变视角", "将视角改为【正面平视】。"],
      ["改变景别", "将景别改为【远景】。"],
      ["改变材质", "将材质改为【石头】。"],
      ["改变尺寸", "将画面比例调整为【3:4】。"],
      ["超清修复", "将画面变高清。"]
    ] }
  ];

  const WORKS = ["pot.jpg", "dress.jpg", "detergent.jpg", "skincare.jpg", "shoes.jpg", "lipstick.jpg", "toothbrush.jpg", "dress.jpg"];
  const GALLERY = WORKS.map(function (f) {
    return '<div class="draw-item"><img src="assets/ecom/' + f + '" alt="" loading="lazy"></div>';
  }).join("");

  function modeOf(key) {
    for (let i = 0; i < MODES.length; i++) if (MODES[i].key === key) return MODES[i];
    return MODES[0];
  }

  function defaultInl() {
    return { productName: "", count: "5张", platform: "淘宝", lang: "简体中文", tlang: "英文", scope: TRANS_SCOPES[0], ptype: "宣传海报" };
  }

  function slotHTML(kind, label) {
    return '<div class="upload-slot' + (kind === "detail" ? " detail" : "") + '" data-slot="' + kind + '" title="上传参考图（最多 10 张）">'
      + '<svg class="ic"><use href="#i-plus"/></svg>'
      + '<span data-upcount="' + kind + '">0/10</span>'
      + (label ? '<small>' + esc(label) + '</small>' : '') + '</div>';
  }
  function pill(label, key) { return '<span class="inl-pill" data-inl="' + key + '">' + esc(label) + '</span>'; }
  function nameInput() { return '<span class="inl-input" contenteditable="true" data-inl-input="productName" data-placeholder="商品名称"></span>'; }

  function composerHTML(m, st) {
    const extra = '<div class="comp-sub">可补充描述您的商品信息或其他生图要求。例如：产品卖点、适用人群、使用场景、商品材质等信息</div><textarea class="comp-extra" placeholder="补充描述（可选）"></textarea>';
    if (m.composer === "agent") {
      return slotHTML("main", "") + '<textarea class="comp-text" placeholder="描述你想要生成的图片，例如：帮我设计一套吸引顾客眼球的商品主图套图"></textarea>';
    }
    if (m.composer === "simple") {
      return slotHTML("main", "") + '<textarea class="comp-text" placeholder="' + esc(m.ph) + '"></textarea>';
    }
    if (m.composer === "main") {
      return '<div class="comp-slots">' + slotHTML("main", "商品图") + slotHTML("detail", "细节图") + '</div>'
        + '<div class="comp-line">请基于我的 ' + nameInput() + ' 生成一套 ' + pill(st.inl.count, "count")
        + ' 的主图套图，平台 ' + pill(st.inl.platform, "platform") + '，语言 ' + pill(st.inl.lang, "lang")
        + '，生成比例为 ' + pill(st.ratio, "ratio") + '。' + extra + '</div>';
    }
    if (m.composer === "translate") {
      return slotHTML("main", "") + '<div class="comp-line">将图片翻译成目标语言 ' + pill(st.inl.tlang, "tlang")
        + ' ，其中 ' + pill(st.inl.scope, "scope") + ' 。'
        + '<div class="comp-sub">可补充翻译要求，例如：金额和尺寸单位保持原样...</div><textarea class="comp-extra" placeholder="补充翻译要求（可选）"></textarea></div>';
    }
    if (m.composer === "poster") {
      return slotHTML("main", "") + '<div class="comp-line">请基于我的 ' + nameInput() + ' 设计一张 ' + pill(st.inl.ptype, "ptype")
        + '，平台 ' + pill(st.inl.platform, "platform") + '，语言 ' + pill(st.inl.lang, "lang")
        + '，生成比例为 ' + pill(st.ratio, "ratio") + '。'
        + '<div class="comp-sub">可补充设计风格、卖点、促销信息等要求</div><textarea class="comp-extra" placeholder="补充描述（可选）"></textarea></div>';
    }
    return "";
  }

  function barHTML(m, st) {
    const modePill = '<div class="pill mode-pill" data-opt="mode">' + esc(m.name) + ' <svg class="ic sm"><use href="#i-caret"/></svg></div>';
    const ratioPill = '<div class="pill ratio" data-opt="ratio" title="选择出图比例"><svg class="ic sm"><use href="#i-spark"/></svg><span>' + esc(st.ratio) + ' · ' + esc(st.quality) + '</span></div>';
    const qualityPill = '<div class="pill quality" data-opt="quality">' + esc(st.quality) + ' <svg class="ic sm"><use href="#i-caret"/></svg></div>';
    const skillPill = '<div class="pill skill" data-opt="skill"><svg class="ic sm"><use href="#i-layers"/></svg>技能库</div>';
    let left = modePill;
    if (CTRL.indexOf(m.key) >= 0 && m.key === "agent") left += ratioPill;
    else left += qualityPill;
    if (m.key === "agent") left += skillPill;
    return left + '<div class="gen-hint" data-provider></div>'
      + '<div class="send-btn"><span class="cost">5 / 张</span>'
      + '<button class="send-arrow" title="开始生成"><svg class="ic"><use href="#i-arrow"/></svg></button></div>';
  }

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
              ${MODES.map(function (m, i) {
                return '<div class="tool-card' + (i === 0 ? " on" : "") + '" data-tool="' + m.key + '" data-hint="' + esc(m.desc) + '"><svg class="ic sm"><use href="#i-' + m.icon + '"/></svg>' + esc(m.name) + '</div>';
              }).join("")}
            </div>

            <div class="prompt-box">
              <div class="prompt-main" data-composer></div>
              <div class="up-strip"></div>
              <div class="prompt-bar" data-bar></div>
            </div>

            <div class="sec-title" style="margin-top:28px"><h2>生成结果</h2><a data-href="ecomGallery">查看全部</a></div>
            <div class="draw-gallery draw-results"></div>

            <div class="sec-title" style="margin-top:28px"><h2>示例作品</h2></div>
            <div class="draw-gallery">${GALLERY}</div>
          </div>
        </div>`;

  function renderComposer(el) {
    const st = el.__draw;
    const m = modeOf(st.mode);
    const composer = el.querySelector("[data-composer]");
    const bar = el.querySelector("[data-bar]");
    if (composer) composer.innerHTML = composerHTML(m, st);
    if (bar) bar.innerHTML = barHTML(m, st);
    if (st.inl.productName) {
      const ni = el.querySelector('[data-inl-input="productName"]');
      if (ni) ni.textContent = st.inl.productName;
    }
    renderUploads(el);
  }

  function renderUploads(el) {
    const st = el.__draw;
    const strip = el.querySelector(".up-strip");
    const all = st.files.concat(st.detailFiles);
    el.querySelectorAll("[data-upcount]").forEach(function (c) {
      const kind = c.getAttribute("data-upcount");
      const n = kind === "detail" ? st.detailFiles.length : st.files.length;
      c.textContent = n + "/10";
    });
    if (!strip) return;
    strip.innerHTML = all.map(function (a, i) {
      const src = EC.store.src(a);
      const kind = i < st.files.length ? "main" : "detail";
      return '<div class="up-thumb" data-i="' + i + '" data-kind="' + kind + '"><img src="' + esc(src) + '" alt=""><button class="up-del" title="移除">&times;</button></div>';
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

  function buildPrompt(el, m, st) {
    const extraEl = el.querySelector(".comp-extra");
    const extra = (extraEl && extraEl.value || "").trim();
    if (m.composer === "agent" || m.composer === "simple") {
      const t = el.querySelector(".comp-text");
      return (t && t.value || "").trim();
    }
    const name = (st.inl.productName || "").trim();
    if (m.composer === "main") {
      let p = "请基于我的" + (name || "商品名称") + "生成一套" + st.inl.count + "的主图套图，平台" + st.inl.platform + "，语言" + st.inl.lang + "，生成比例为" + st.ratio;
      if (extra) p += "。" + extra;
      return p;
    }
    if (m.composer === "translate") {
      let p = "将图片翻译成目标语言" + st.inl.tlang + "，其中" + st.inl.scope;
      if (extra) p += "：" + extra;
      return p;
    }
    if (m.composer === "poster") {
      let p = "请基于我的" + (name || "商品名称") + "设计一张" + st.inl.ptype + "，平台" + st.inl.platform + "，语言" + st.inl.lang + "，生成比例为" + st.ratio;
      if (extra) p += "。" + extra;
      return p;
    }
    return "";
  }

  function genRatio(st) { return st.ratio === "智能比例" ? "1:1" : st.ratio; }

  async function doGenerate(el, btn) {
    const st = el.__draw;
    const m = modeOf(st.mode);
    const text = buildPrompt(el, m, st);
    if (m.composer === "agent" || m.composer === "simple") {
      if (!text) { EC.toast("请先用大白话描述你想要的图片"); const t = el.querySelector(".comp-text"); if (t) t.focus(); return; }
    }
    if (m.key !== "agent" && st.files.length + st.detailFiles.length === 0) {
      EC.toast("请先上传参考图"); return;
    }
    const name = (st.inl.productName || "").trim();
    EC.ui.busy(btn, true, "");
    try {
      const refImages = st.files.concat(st.detailFiles).map(function (a) { return EC.store.src(a); }).filter(Boolean);
      const r = await EC.gen.image({ prompt: text, ratio: genRatio(st), refImages: refImages });
      const asset = await EC.store.addFromUrl(r.url, {
        name: (name || text.slice(0, 20) || m.name), kind: "image",
        meta: { mode: m.key, provider: r.provider, prompt: text, ratio: genRatio(st) }
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

  function selectMode(el, key) {
    const st = el.__draw;
    st.mode = key;
    el.querySelectorAll(".tool-card").forEach(function (c) {
      c.classList.toggle("on", c.getAttribute("data-tool") === key);
    });
    renderComposer(el);
  }

  /* 自定义浮层（比例 / 技能库）：复用 .ecmenu 关闭机制（挂在 body 下） */
  function dcPop(anchor, html, onClick) {
    EC.ui.closeMenus();
    const p = document.createElement("div");
    p.className = "ecmenu dc-pop";
    p.innerHTML = html;
    p.addEventListener("click", function (e) { e.stopPropagation(); if (onClick) onClick(e, p); });
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 20, top: 200, bottom: 240 };
    const w = p.offsetWidth || 320, h = p.offsetHeight || 220;
    p.style.left = Math.max(8, Math.min(r.left, (window.innerWidth || 1200) - w - 10)) + "px";
    const top = r.top - h - 8;
    p.style.top = (top < 8 ? r.bottom + 8 : top) + "px";
    return p;
  }

  function ratioPop(el) {
    const st = el.__draw;
    const anchor = el.querySelector('[data-opt="ratio"]');
    const grid = '<div class="dc-title">比例</div><div class="ratio-grid">' + RATIOS.map(function (r) {
      return '<div class="ratio-item' + (r === st.ratio ? " on" : "") + '" data-ratio="' + esc(r) + '">' + esc(r) + '</div>';
    }).join("") + '</div>';
    const qual = '<div class="dc-title">清晰度</div><div class="quality-switch">' + QUALITIES.map(function (q) {
      const dis = q !== QUALITIES[0];
      return '<div class="quality-item' + (q === st.quality ? " on" : "") + (dis ? " is-disabled" : "") + '" data-quality="' + esc(q) + '">' + esc(q) + '</div>';
    }).join("") + '</div>';
    dcPop(anchor, grid + qual, function (e) {
      const ri = e.target.closest("[data-ratio]");
      if (ri) { st.ratio = ri.getAttribute("data-ratio"); EC.ui.closeMenus(); renderComposer(el); return; }
      const qi = e.target.closest("[data-quality]");
      if (qi) {
        if (qi.classList.contains("is-disabled")) { EC.toast("2K / 4K 清晰度即将开放"); return; }
        st.quality = qi.getAttribute("data-quality"); EC.ui.closeMenus(); renderComposer(el);
      }
    });
  }

  function skillPop(el) {
    const anchor = el.querySelector('[data-opt="skill"]');
    const html = '<div class="skill-lib">' + SKILLS.map(function (sec) {
      return '<div class="skill-section"><div class="skill-section-title">' + esc(sec.cat) + '</div><div class="skill-list">'
        + sec.items.map(function (it) {
          return '<div class="skill-card" data-skill="' + esc(it[1]) + '" data-name="' + esc(it[0]) + '"><div class="skill-card-name">' + esc(it[0]) + '</div><div class="skill-card-preview">' + esc(it[1]) + '</div></div>';
        }).join("") + '</div></div>';
    }).join("") + '</div>';
    dcPop(anchor, html, function (e) {
      const card = e.target.closest(".skill-card");
      if (!card) return;
      const t = el.querySelector(".comp-text");
      if (t) t.value = card.getAttribute("data-skill");
      EC.ui.closeMenus();
      EC.toast("已套用技能：" + card.getAttribute("data-name"));
      if (t) t.focus();
    });
  }

  function modeMenu(el, anchor) {
    EC.ui.menu(anchor, MODES.map(function (m) {
      return { label: m.name, on: m.key === el.__draw.mode, pick: function () { selectMode(el, m.key); } };
    }));
  }

  EC.register("ecomDraw", function (el) {
    if (!el.__draw) el.__draw = { mode: "agent", files: [], detailFiles: [], ratio: "智能比例", quality: "1K 标准", inl: defaultInl() };
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    const prov = el.querySelector("[data-provider]");
    if (prov) prov.textContent = EC.gen ? "出图服务：" + EC.gen.providerName() : "";
    if (EC.store && EC.store.ready) EC.store.ready();
    renderComposer(el);

    if (el.__ecomDrawBound) { return; }
    el.__ecomDrawBound = true;

    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const st = el.__draw;

      const del = e.target.closest(".up-del");
      if (del) {
        e.stopPropagation();
        const th = del.closest(".up-thumb");
        const kind = th.getAttribute("data-kind");
        const i = Number(th.getAttribute("data-i"));
        const arr = kind === "detail" ? st.detailFiles : st.files;
        const local = kind === "detail" ? i - st.files.length : i;
        arr.splice(local, 1);
        renderUploads(el);
        return;
      }

      const slot = e.target.closest(".upload-slot");
      if (slot) {
        const kind = slot.getAttribute("data-slot") || "main";
        EC.ui.pickFiles("image/*", true).then(function (files) { if (files.length) addFiles(el, files, kind); });
        return;
      }

      const tool = e.target.closest(".tool-card");
      if (tool) { selectMode(el, tool.getAttribute("data-tool")); return; }

      const opt = e.target.closest("[data-opt]");
      if (opt) {
        e.stopPropagation();
        const kind = opt.getAttribute("data-opt");
        if (kind === "mode") modeMenu(el, opt);
        else if (kind === "ratio") ratioPop(el);
        else if (kind === "quality") {
          EC.ui.menu(opt, QUALITIES.map(function (q) {
            return { label: q, on: q === st.quality, pick: function () { if (q !== QUALITIES[0]) { EC.toast("2K / 4K 清晰度即将开放"); return; } st.quality = q; renderComposer(el); } };
          }));
        } else if (kind === "skill") skillPop(el);
        return;
      }

      const inl = e.target.closest("[data-inl]");
      if (inl) {
        e.stopPropagation();
        const key = inl.getAttribute("data-inl");
        let opts = null;
        if (key === "count") opts = COUNTS;
        else if (key === "platform") opts = PLATFORMS;
        else if (key === "lang") opts = LANGS;
        else if (key === "ratio") opts = RATIOS;
        else if (key === "tlang") opts = TRANS_LANGS;
        else if (key === "scope") opts = TRANS_SCOPES;
        else if (key === "ptype") opts = POSTER_TYPES;
        if (!opts) return;
        EC.ui.menu(inl, opts.map(function (o) {
          const cur = key === "ratio" ? st.ratio : st.inl[key];
          return { label: o, on: o === cur, pick: function () {
            if (key === "ratio") st.ratio = o; else st.inl[key] = o;
            renderComposer(el);
          } };
        }));
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

    el.addEventListener("input", function (e) {
      const ni = e.target.closest('[data-inl-input="productName"]');
      if (ni) el.__draw.inl.productName = ni.textContent || "";
    });

    async function addFiles(el2, files, kind) {
      const arr = kind === "detail" ? el2.__draw.detailFiles : el2.__draw.files;
      for (let i = 0; i < files.length && arr.length < 10; i++) {
        const a = await EC.store.addFile(files[i], { kind: "upload" }).catch(function () {
          return { id: EC.ui.uid("as"), kind: "upload", name: files[i].name, blob: files[i], mime: files[i].type };
        });
        arr.push(a);
      }
      renderUploads(el2);
      EC.toast("已添加 " + files.length + " 张参考图");
    }
  });
})();
