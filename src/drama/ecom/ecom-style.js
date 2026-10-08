/* 铜龙电商ai助手 · 电商工作台 · 风格复刻（参考设计图定风格 · 结合产品图批量出图） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const MAX_STYLE = 16, MAX_PRODUCT = 6;

  const HTML = `<div class="inner">
    <div class="page-head">
      <h1>风格复刻</h1>
      <p>上传参考设计图与商品图，AI 提取设计风格并套用到你的商品，批量输出同风格图片。</p>
    </div>

    <div class="split" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-palette"/></svg>素材与要求</div>
        <div class="panel-body">
          <div class="field">
            <label>参考设计图（≤${MAX_STYLE} 张）</label>
            <div class="up-strip" data-strip-style style="display:flex;flex-wrap:wrap;gap:8px"></div>
            <div class="upload-slot" data-add-style style="margin-top:8px">
              <svg class="ic"><use href="#i-upload"/></svg><span>添加</span>
            </div>
          </div>
          <div class="field">
            <label>商品图（≤${MAX_PRODUCT} 张）</label>
            <div class="up-strip" data-strip-product style="display:flex;flex-wrap:wrap;gap:8px"></div>
            <div class="upload-slot" data-add-product style="margin-top:8px">
              <svg class="ic"><use href="#i-upload"/></svg><span>添加</span>
            </div>
          </div>
          <div class="field">
            <label>生图要求（选填）</label>
            <textarea class="inp" data-prompt rows="3" placeholder="例如：突出产品质感，暖色调，简约背景"></textarea>
          </div>
          <div class="field">
            <label>尺寸比例</label>
            <div class="chips" data-group="ratio">
              <div class="chip on">1:1</div>
              <div class="chip">2:3</div>
              <div class="chip">3:2</div>
              <div class="chip">3:4</div>
              <div class="chip">4:3</div>
              <div class="chip">4:5</div>
              <div class="chip">5:4</div>
              <div class="chip">9:16</div>
              <div class="chip">16:9</div>
              <div class="chip">21:9</div>
            </div>
          </div>
          <div class="field">
            <label>生成数量</label>
            <div class="chips" data-group="count">
              <div class="chip on">1 组</div>
              <div class="chip">2 组</div>
              <div class="chip">3 组</div>
            </div>
          </div>
          <div class="field">
            <label>清晰度</label>
            <div class="chips" data-group="quality">
              <div class="chip">1K</div>
              <div class="chip on">2K</div>
              <div class="chip">4K</div>
            </div>
          </div>
          <button class="btn btn-primary" data-run><svg class="ic sm"><use href="#i-spark"/></svg>开始生成</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-grid"/></svg>生成结果</div>
        <div class="panel-body">
          <div data-bar hidden style="margin-bottom:12px">
            <div style="height:6px;border-radius:6px;background:#eef0f4;overflow:hidden"><i data-bar-fill style="display:block;height:100%;width:0;background:linear-gradient(90deg,var(--primary),var(--primary-2));transition:.2s"></i></div>
            <div class="note" data-bar-text style="margin-top:6px;font-size:12px;color:var(--muted)">准备中…</div>
          </div>
          <div class="result-grid" data-out></div>
          <div class="note" data-empty style="font-size:12px;color:var(--muted)">上传参考设计图与商品图后开始生成。</div>
        </div>
      </div>
    </div>
  </div>`;

  function pick(el, group) {
    const n = el.querySelector('.chips[data-group="' + group + '"] .chip.on');
    return n ? n.textContent.trim() : "";
  }
  function bar(el, pct, text) {
    const w = el.querySelector("[data-bar]"); if (w) w.hidden = false;
    const f = el.querySelector("[data-bar-fill]"); if (f) f.style.width = Math.max(0, Math.min(100, pct)) + "%";
    const t = el.querySelector("[data-bar-text]"); if (t && text != null) t.textContent = text;
  }
  function renderStrip(el, which) {
    const strip = el.querySelector("[data-strip-" + which + "]");
    if (!strip) return;
    strip.innerHTML = "";
    (el.__style[which] || []).forEach(function (a, i) {
      const d = EC.ui.el("div", "", '<img src="' + esc(EC.store.src(a)) + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--border)">'
        + '<button class="up-del" data-del="' + which + '" data-i="' + i + '" title="移除">&times;</button>');
      d.style.cssText = "position:relative";
      strip.appendChild(d);
    });
  }

  async function run(el, btn) {
    const s = el.__style;
    if (!s.style.length) { EC.toast("请上传参考设计图"); return; }
    if (!s.product.length) { EC.toast("请上传商品图"); return; }
    const req = ((el.querySelector("[data-prompt]") || {}).value || "").trim();
    const ratio = pick(el, "ratio") || "1:1";
    const n = Number((pick(el, "count") || "1 组").replace(/\D/g, "")) || 1;
    const quality = pick(el, "quality") || "2K";
    EC.ui.busy(btn, true, "生成中…");
    try {
      const styleSrc = await EC.store.publicUrl(s.style[0]);
      const total = n * s.product.length;
      let done = 0;
      const out = el.querySelector("[data-out]");
      out.innerHTML = "";
      const empty = el.querySelector("[data-empty]"); if (empty) empty.style.display = "none";
      for (let i = 0; i < s.product.length; i++) {
        const productSrc = await EC.store.publicUrl(s.product[i]);
        for (let g = 0; g < n; g++) {
          const prompt = "参考设计图的美术风格与配色，应用到商品图上，保持商品主体一致，高质量商业摄影"
            + (req ? "。" + req : "") + "。清晰度 " + quality;
          const r = await EC.gen.image({ prompt: prompt, ratio: ratio, refImages: [styleSrc, productSrc] });
          const asset = await EC.store.addFromUrl(r.url, {
            name: "风格复刻", kind: "style",
            meta: { styleRef: styleSrc, prompt: prompt, ratio: ratio, quality: quality, provider: r.provider }
          });
          const card = EC.ui.el("div", "result", '<img src="' + esc(EC.store.src(asset)) + '" alt="" style="width:100%;border-radius:12px;cursor:pointer">');
          card.addEventListener("click", function () { EC.store.download(asset); });
          out.appendChild(card);
          done++;
          bar(el, Math.round(done / total * 100), "已生成 " + done + "/" + total);
          if (EC.addUsage) EC.addUsage({ generated: 1 });
        }
      }
      EC.toast("风格复刻完成");
    } catch (e) {
      EC.toast((e && e.message) || "生成失败");
    } finally { EC.ui.busy(btn, false); }
  }

  EC.register("ecomStyle", function (el) {
    if (!el.__style) el.__style = { style: [], product: [], result: null };
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
    renderStrip(el, "style"); renderStrip(el, "product");
    if (el.__ecomStyleBound) return;
    el.__ecomStyleBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const del = e.target.closest("[data-del]");
      if (del) {
        const which = del.getAttribute("data-del"), i = Number(del.getAttribute("data-i"));
        el.__style[which].splice(i, 1);
        renderStrip(el, which);
        return;
      }
      const addStyle = e.target.closest("[data-add-style]");
      if (addStyle) {
        if (el.__style.style.length >= MAX_STYLE) { EC.toast("参考设计图最多 " + MAX_STYLE + " 张"); return; }
        EC.ui.pickFiles("image/*", true).then(function (files) {
          const room = MAX_STYLE - el.__style.style.length;
          files.slice(0, room).forEach(function (f) {
            EC.store.addFile(f, { kind: "upload" }).then(function (a) {
              el.__style.style.push(a);
              renderStrip(el, "style");
            });
          });
          if (files.length > room) EC.toast("超出上限，仅添加前 " + room + " 张");
        });
        return;
      }
      const addProduct = e.target.closest("[data-add-product]");
      if (addProduct) {
        if (el.__style.product.length >= MAX_PRODUCT) { EC.toast("商品图最多 " + MAX_PRODUCT + " 张"); return; }
        EC.ui.pickFiles("image/*", true).then(function (files) {
          const room = MAX_PRODUCT - el.__style.product.length;
          files.slice(0, room).forEach(function (f) {
            EC.store.addFile(f, { kind: "upload" }).then(function (a) {
              el.__style.product.push(a);
              renderStrip(el, "product");
            });
          });
          if (files.length > room) EC.toast("超出上限，仅添加前 " + room + " 张");
        });
        return;
      }
      const runBtn = e.target.closest("[data-run]");
      if (runBtn) { run(el, runBtn); return; }
    });
  });
})();
