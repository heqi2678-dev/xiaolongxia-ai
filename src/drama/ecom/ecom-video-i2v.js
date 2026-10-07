/* 铜龙电商ai助手 · 电商工作台 · AI 视频 · 图生视频（参考图 + AI 帮写脚本 + 商品讲解视频） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const CHANNELS = ["灵动演绎", "极速出片"];
  const DURATIONS = ["5", "10", "15"];
  const RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const RESOLUTIONS = ["480P", "720P"];
  const LANGS = ["中文", "English", "日本語", "한국어", "Español", "Bahasa Melayu", "Bahasa Indonesia", "Tiếng Việt"];
  const MAX_MB = 3;

  const HTML = `<div class="inner">
    <div class="page-head">
      <h1>图生视频</h1>
      <p>上传一张参考图（≤3M），描述视频内容或让 AI 帮写脚本，生成商品讲解视频。</p>
    </div>

    <div class="split" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-video"/></svg>视频设置</div>
        <div class="panel-body">
          <div class="field">
            <label>参考图（JPG / PNG / WEBP，≤3M）</label>
            <div class="dropzone" data-ref>
              <div class="dz-ic"><svg class="ic"><use href="#i-upload"/></svg></div>
              <b>点击上传参考图</b>
              <p>建议使用商品主图或人物图</p>
            </div>
          </div>

          <div class="field">
            <label>视频脚本 <button class="btn btn-ghost" data-ai-write style="width:auto;padding:2px 10px;font-size:12px;margin-left:6px">AI 帮写</button></label>
            <textarea class="inp" data-prompt rows="4" placeholder="描述画面：主体、动作、场景、运镜…"></textarea>
          </div>

          <div class="field">
            <label>生成通道</label>
            <div class="chips" data-group="channel">
              <div class="chip on">灵动演绎</div>
              <div class="chip">极速出片</div>
            </div>
          </div>
          <div class="field">
            <label>视频时长</label>
            <div class="chips" data-group="duration">
              <div class="chip on">5s</div>
              <div class="chip">10s</div>
              <div class="chip">15s</div>
            </div>
          </div>
          <div class="field">
            <label>视频比例</label>
            <div class="chips" data-group="ratio">
              <div class="chip">1:1</div>
              <div class="chip on">9:16</div>
              <div class="chip">16:9</div>
              <div class="chip">3:4</div>
              <div class="chip">4:3</div>
            </div>
          </div>
          <div class="field">
            <label>视频分辨率</label>
            <div class="chips" data-group="resolution">
              <div class="chip">480P</div>
              <div class="chip on">720P</div>
            </div>
          </div>
          <div class="field">
            <label>视频语言</label>
            <div class="select" data-lang>中文 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
          </div>

          <button class="btn btn-primary" data-run><svg class="ic sm"><use href="#i-spark"/></svg>生成视频</button>
          <button class="btn btn-ghost" data-save style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>保存到作品库</button>
        </div>
      </div>

      <div class="phone-wrap" style="display:flex;flex-direction:column;gap:14px;align-items:stretch;min-height:520px">
        <div class="phone" style="margin:0 auto">
          <div class="phone-screen">
            <div class="notch"></div>
            <video data-player controls playsinline style="width:100%;height:100%;object-fit:cover;display:none"></video>
            <div class="video-scene" data-scene><svg class="ic lg" style="width:44px;height:44px;color:#fff;opacity:.7"><use href="#i-play"/></svg></div>
            <div class="gen-tag">AI 生成</div>
          </div>
        </div>
        <div data-bar hidden>
          <div style="height:6px;border-radius:6px;background:#eef0f4;overflow:hidden"><i data-bar-fill style="display:block;height:100%;width:0;background:linear-gradient(90deg,var(--primary),var(--primary-2));transition:.2s"></i></div>
          <div class="note" data-bar-text style="margin-top:6px;font-size:12px;color:var(--muted)">准备中…</div>
        </div>
        <div class="note" data-hint style="font-size:12px;color:var(--muted)">视频生成较慢，通常需要 1–3 分钟，请保持页面打开。</div>
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

  async function aiWrite(el, btn) {
    const ref = el.__i2v && el.__i2v.ref;
    if (!EC.gen.llmConfigured()) { EC.toast("请先到「设置」配置语言模型"); return; }
    EC.ui.busy(btn, true, "写作中…");
    try {
      const r = await EC.gen.ask(
        "你是电商短视频脚本策划，输出一段 2-3 句的中文分镜脚本，直接可读，不要解释、不要引号。",
        "为商品参考图写一段吸引人的短视频讲解脚本" + (ref ? "，突出商品卖点与使用场景" : "")
      );
      const ta = el.querySelector("[data-prompt]");
      if (ta) ta.value = String(r || "").trim();
      EC.toast("脚本已生成");
    } catch (e) { EC.toast((e && e.message) || "生成失败"); }
    finally { EC.ui.busy(btn, false); }
  }

  async function run(el, btn) {
    const ref = el.__i2v && el.__i2v.ref;
    if (!ref) { EC.toast("请先上传参考图"); return; }
    if (!EC.gen.videoConfigured()) { EC.toast("请到「设置 → 短剧服务」配置视频模型"); return; }
    const prompt = ((el.querySelector("[data-prompt]") || {}).value || "").trim() || "商品展示视频";
    EC.ui.busy(btn, true, "生成中…"); bar(el, 6, "上传参考图…");
    try {
      const firstFrame = await EC.store.publicUrl(ref);
      bar(el, 18, "提交视频任务…");
      const r = await EC.gen.video({
        firstFrame: firstFrame, prompt: prompt,
        duration: Number(pick(el, "duration").replace("s", "")) || 5,
        ratio: pick(el, "ratio") || "9:16",
        resolution: pick(el, "resolution") || "720P",
        channel: pick(el, "channel"), lang: (el.querySelector("[data-lang]") || {}).textContent.trim()
      }, function (st) {
        const p = st && st.progress != null ? st.progress : null;
        bar(el, p != null ? 18 + Math.round(p * 0.8) : 60, "生成中…" + (st && st.status ? "（" + st.status + "）" : ""));
      });
      bar(el, 100, "完成");
      const asset = await EC.store.addFromUrl(r.url, {
        name: "图生视频", kind: "video",
        meta: { mode: "i2v", prompt: prompt, ratio: pick(el, "ratio"), resolution: pick(el, "resolution"), channel: pick(el, "channel"), provider: r.provider }
      });
      el.__i2v.result = asset;
      const player = el.querySelector("[data-player]");
      if (player) { player.src = EC.store.src(asset); player.style.display = "block"; }
      const scene = el.querySelector("[data-scene]"); if (scene) scene.style.display = "none";
      if (EC.addUsage) EC.addUsage({ generated: 1 });
      EC.toast("视频生成完成");
    } catch (e) {
      bar(el, 100, "失败"); EC.toast((e && e.message) || "生成失败");
    } finally { EC.ui.busy(btn, false); }
  }

  EC.register("ecomVideoI2V", function (el) {
    if (!el.__i2v) el.__i2v = { ref: null, result: null };
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
    if (el.__i2v.ref) {
      const dz = el.querySelector("[data-ref]");
      if (dz) dz.innerHTML = '<img src="' + esc(EC.store.src(el.__i2v.ref)) + '" alt="" style="width:100%;border-radius:10px">';
    }
    if (el.__i2v.result) {
      const player = el.querySelector("[data-player]");
      if (player) { player.src = EC.store.src(el.__i2v.result); player.style.display = "block"; }
      const scene = el.querySelector("[data-scene]"); if (scene) scene.style.display = "none";
    }
    if (el.__ecomI2vBound) return;
    el.__ecomI2vBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const ref = e.target.closest("[data-ref]");
      if (ref) {
        EC.ui.pickFiles("image/*", false).then(function (files) {
          if (!files.length) return;
          const f = files[0];
          if (f.size > MAX_MB * 1024 * 1024) { EC.toast("参考图超过 " + MAX_MB + "M，请压缩后再上传"); return; }
          EC.store.addFile(f, { kind: "upload" }).then(function (a) {
            el.__i2v.ref = a;
            ref.innerHTML = '<img src="' + esc(EC.store.src(a)) + '" alt="" style="width:100%;border-radius:10px">';
          });
        });
        return;
      }
      const aw = e.target.closest("[data-ai-write]");
      if (aw) { aiWrite(el, aw); return; }
      const lang = e.target.closest("[data-lang]");
      if (lang) {
        e.stopPropagation();
        const cur = lang.textContent.trim();
        EC.ui.menu(lang, LANGS.map(function (o) {
          return { label: o, on: o === cur, pick: function () { lang.innerHTML = esc(o) + ' <svg class="ic sm"><use href="#i-arrow"/></svg>'; } };
        }));
        return;
      }
      const runBtn = e.target.closest("[data-run]");
      if (runBtn) { run(el, runBtn); return; }
      const sv = e.target.closest("[data-save]");
      if (sv) {
        if (!el.__i2v.result) { EC.toast("请先生成视频"); return; }
        EC.toast("已保存到作品库"); EC.go("ecomGallery");
      }
    });
  });
})();
