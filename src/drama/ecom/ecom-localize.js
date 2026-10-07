/* 电商工作台 · 跨境本地化（真实翻译 + 真实生图 + 预览 + 保存） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const PLATFORMS = ["TikTok Shop", "Shopee", "Lazada", "Amazon", "Temu", "SHEIN"];
  const LANG_EN = { "English": "en", "Bahasa Melayu": "ms", "中文": "zh", "日本語": "ja", "繁體中文": "zh-TW" };

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>跨境本地化</h1>
            <p>选市场、语言、模特，把一套素材适配到海外平台，文案自动翻译、图片真实生成。</p>
          </div>

          <div class="split" style="grid-template-columns:1fr 1fr">
            <div class="panel">
              <div class="panel-head"><svg class="ic sm"><use href="#i-globe"/></svg>本地化设置</div>
              <div class="panel-body">
                <div class="field">
                  <label>素材来源</label>
                  <div class="loc-src">
                    <div class="loc-thumb" data-src><svg class="ic"><use href="#i-upload"/></svg></div>
                    <input class="inp mini" data-name placeholder="产品名称，例如：便携榨汁杯" style="flex:1">
                  </div>
                </div>
                <div class="field">
                  <label>目标市场</label>
                  <div class="chips" data-group="market">
                    <div class="chip on">马来西亚</div>
                    <div class="chip">美国</div>
                    <div class="chip">欧洲</div>
                    <div class="chip">东南亚</div>
                  </div>
                </div>
                <div class="field">
                  <label>文案语言</label>
                  <div class="chips" data-group="lang">
                    <div class="chip on">English</div>
                    <div class="chip">Bahasa Melayu</div>
                    <div class="chip">中文</div>
                    <div class="chip">日本語</div>
                  </div>
                </div>
                <div class="field">
                  <label>模特族裔</label>
                  <div class="avatar-chips">
                    <div class="avchip on"><div class="bubble">亚</div>亚裔</div>
                    <div class="avchip"><div class="bubble">欧</div>欧美</div>
                    <div class="avchip"><div class="bubble">非</div>非裔</div>
                    <div class="avchip"><div class="bubble">拉</div>拉美</div>
                  </div>
                </div>
                <div class="field">
                  <label>目标平台</label>
                  <div class="select" data-platform>TikTok Shop <svg class="ic sm"><use href="#i-arrow"/></svg></div>
                </div>
                <div class="field">
                  <div class="switch-row">
                    <div><b>视频本地化配音</b><span>自动翻译字幕并生成目标语言配音</span></div>
                    <div class="switch"></div>
                  </div>
                </div>
                <button class="btn btn-primary" data-gen><svg class="ic sm"><use href="#i-spark"/></svg>生成本地化素材</button>
                <button class="btn btn-ghost" data-save style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>保存到作品库</button>
              </div>
            </div>

            <div class="phone-wrap">
              <div class="phone">
                <div class="phone-screen">
                  <div class="notch"></div>
                  <div class="phone-shot" data-shot><img src="assets/ecom/dress.jpg" alt=""></div>
                  <div class="vid-badges"><div class="flag" data-flag>MY</div></div>
                  <div class="gen-tag">AI 本地化</div>
                  <div class="caption">
                    <span class="sub" data-cap-sub>English + Bahasa Melayu</span>
                    <span class="name" data-cap-name>Localized Video · Malaysia</span>
                    <span class="desc" data-cap-desc>字幕与配音已自动翻译</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;

  const FLAG = { "马来西亚": "MY", "美国": "US", "欧洲": "EU", "东南亚": "SEA" };

  function pick(group, el) {
    const node = el.querySelector('.chips[data-group="' + group + '"] .chip.on');
    return node ? node.textContent.trim() : "";
  }
  function pickModel(el) {
    const node = el.querySelector(".avchip.on .bubble");
    return node ? node.textContent.trim() : "亚";
  }

  async function translateName(name, lang) {
    if (!EC.gen.llmConfigured()) return name;
    try {
      const code = LANG_EN[lang] || lang;
      const out = await EC.gen.ask(
        "你是电商翻译，只输出翻译结果，不要解释、不要引号。",
        "把下面的商品名称翻译成 " + lang + "（" + code + "）：" + name
      );
      const t = String(out || "").trim().split("\n")[0].replace(/^["“]|["”]$/g, "");
      return t || name;
    } catch (e) { return name; }
  }

  async function gen(el, btn) {
    const nameEl = el.querySelector("[data-name]");
    const name = (nameEl.value || "").trim() || "精选好物";
    const market = pick("market", el) || "马来西亚";
    const lang = pick("lang", el) || "English";
    const model = pickModel(el);
    const platform = (el.querySelector("[data-platform]") || {}).textContent || "TikTok Shop";
    const shot = el.querySelector("[data-shot] img");
    EC.ui.busy(btn, true, "生成中…");
    try {
      const srcAsset = el.__loc && el.__loc.src;
      const prompt = "跨境电商商品主图，产品：" + name + "，模特：" + model + "裔，市场：" + market + "，平台：" + platform
        + "，明亮清新，生活方式场景，高级质感，适合社媒投放";
      const r = await EC.gen.image({ prompt: prompt, ratio: "1:1", refImages: srcAsset ? [EC.store.src(srcAsset)] : [] });
      const asset = await EC.store.addFromUrl(r.url, { name: name + " · " + market, kind: "localize", meta: { market: market, lang: lang, model: model, provider: r.provider, prompt: prompt } });
      el.__loc = el.__loc || {};
      el.__loc.result = asset;
      if (shot) shot.src = EC.store.src(asset);
      const translated = await translateName(name, lang);
      set(el, "[data-flag]", FLAG[market] || market.slice(0, 2).toUpperCase());
      set(el, "[data-cap-sub]", lang + (el.querySelector(".switch.off") ? " · 无配音" : " · AI 配音"));
      set(el, "[data-cap-name]", translated + " · " + market);
      set(el, "[data-cap-desc]", "已按 " + platform + " 规格适配，" + model + "裔模特");
      if (EC.addUsage) EC.addUsage({ generated: 1 });
      EC.toast("本地化素材生成完成");
    } catch (e) {
      EC.toast((e && e.message) || "生成失败");
    } finally { EC.ui.busy(btn, false); }
  }
  function set(el, sel, text) { const n = el.querySelector(sel); if (n) n.textContent = text; }

  async function save(el) {
    if (!el.__loc || !el.__loc.result) { EC.toast("请先生成本地化素材"); return; }
    EC.toast("素材已在作品库中");
    EC.go("ecomGallery");
  }

  EC.register("ecomLocalize", function (el) {
    if (!el.__loc) el.__loc = { src: null, result: null };
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    if (el.__loc.src) {
      const t = el.querySelector(".loc-thumb");
      t.innerHTML = '<img src="' + esc(EC.store.src(el.__loc.src)) + '" alt="">';
    }
    if (el.__loc.result) { const shot = el.querySelector("[data-shot] img"); if (shot) shot.src = EC.store.src(el.__loc.result); }
    if (el.__ecomLocBound) return;
    el.__ecomLocBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const av = e.target.closest(".avchip");
      if (av) { el.querySelectorAll(".avchip").forEach(function (x) { x.classList.remove("on"); }); av.classList.add("on"); return; }
      const src = e.target.closest("[data-src]");
      if (src) {
        EC.ui.pickFiles("image/*", false).then(function (f) {
          if (!f.length) return;
          EC.store.addFile(f[0], { kind: "upload" }).then(function (a) {
            el.__loc.src = a;
            src.innerHTML = '<img src="' + esc(EC.store.src(a)) + '" alt="">';
          });
        });
        return;
      }
      const pl = e.target.closest("[data-platform]");
      if (pl) {
        e.stopPropagation();
        const cur = pl.textContent.replace(/\s+/g, " ").trim();
        EC.ui.menu(pl, PLATFORMS.map(function (o) {
          return { label: o, on: o === cur, pick: function () { pl.innerHTML = esc(o) + ' <svg class="ic sm"><use href="#i-arrow"/></svg>'; } };
        }));
        return;
      }
      const gen2 = e.target.closest("[data-gen]");
      if (gen2) { gen(el, gen2); return; }
      const sv = e.target.closest("[data-save]");
      if (sv) { save(el); return; }
    });
  });
})();
