/* 铜龙电商ai助手 · 电商工作台 · AI 视频 · 视频复刻（爆款参考视频 + 产品图 → 同款带货视频） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const CHANNELS = ["灵动演绎", "极速出片"];
  const DURATIONS = ["5", "10", "15"];
  const RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const RESOLUTIONS = ["480P", "720P"];
  const LANGS = (EC.const && EC.const.VIDEO_LANGS) || ["简体中文", "繁体中文", "英语", "泰语", "俄语", "越南语", "马来语", "葡萄牙语", "西班牙语", "日语", "韩语", "德语", "法语", "荷兰语", "波兰语", "土耳其语", "印尼语", "菲律宾语"];
  const VIDEO_MAX_MB = 100, IMG_MAX_MB = 10;

  const HTML = `<div class="inner">
    <div class="page-head">
      <h1>视频复刻</h1>
      <p>上传一条爆款参考视频和你的产品图，AI 复用原视频的节奏与运镜，生成同款带货视频。</p>
    </div>

    <div class="split" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-film"/></svg>复刻设置</div>
        <div class="panel-body">
          <div class="field">
            <label>原视频（MP4 / MOV / MKV，≤100MB）</label>
            <div class="dropzone" data-video>
              <div class="dz-ic"><svg class="ic"><use href="#i-upload"/></svg></div>
              <b>点击上传参考视频</b>
              <p>爆款视频或竞品视频</p>
            </div>
          </div>
          <div class="field">
            <label>产品图（JPG / PNG / WEBP，≤10MB）</label>
            <div class="dropzone" data-product>
              <div class="dz-ic"><svg class="ic"><use href="#i-upload"/></svg></div>
              <b>点击上传产品图</b>
              <p>用于替换视频中的商品</p>
            </div>
          </div>
          <div class="field">
            <label>产品信息（选填）<button class="btn btn-ghost" data-ai-write style="width:auto;padding:2px 10px;font-size:12px;margin-left:6px">AI 帮写</button></label>
            <textarea class="inp" data-prompt rows="3" placeholder="产品名、卖点、目标人群…"></textarea>
          </div>
          <div class="field">
            <label>复刻要求（选填）</label>
            <textarea class="inp" data-req rows="2" placeholder="例如：保留原视频运镜，换成我们的产品"></textarea>
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
              <div class="chip">3:4</div>
              <div class="chip">4:3</div>
              <div class="chip on">9:16</div>
              <div class="chip">16:9</div>
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
            <div class="select" data-lang>简体中文 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
          </div>

          <button class="btn btn-primary" data-run><svg class="ic sm"><use href="#i-spark"/></svg>生成同款视频</button>
          <button class="btn btn-ghost" data-save style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>保存到作品库</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-play"/></svg>预览</div>
        <div class="panel-body">
          <div style="background:#0e0f13;border-radius:12px;padding:14px">
            <div style="font-size:12px;color:#8a94a6;margin-bottom:8px">参考视频</div>
            <video data-ref-player controls playsinline style="width:100%;max-height:240px;border-radius:10px;display:none"></video>
            <div class="note" data-ref-empty style="font-size:12px;color:#5b6474">未上传参考视频</div>
          </div>
          <div style="margin-top:14px">
            <div style="font-size:12px;color:var(--muted);margin-bottom:8px">生成结果</div>
            <video data-player controls playsinline style="width:100%;max-height:280px;border-radius:10px;background:#0e0f13;display:none"></video>
            <div class="note" data-out-empty style="font-size:12px;color:var(--muted)">生成后在此预览</div>
          </div>
          <div data-bar hidden style="margin-top:12px">
            <div style="height:6px;border-radius:6px;background:#eef0f4;overflow:hidden"><i data-bar-fill style="display:block;height:100%;width:0;background:linear-gradient(90deg,var(--primary),var(--primary-2));transition:.2s"></i></div>
            <div class="note" data-bar-text style="margin-top:6px;font-size:12px;color:var(--muted)">准备中…</div>
          </div>
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
  function setImg(slot, asset) {
    slot.innerHTML = '<img src="' + esc(EC.store.src(asset)) + '" alt="" style="width:100%;border-radius:10px">';
  }

  async function aiWrite(el, btn) {
    if (!EC.gen.llmConfigured()) { EC.toast("请先到「设置」配置语言模型"); return; }
    EC.ui.busy(btn, true, "写作中…");
    try {
      const r = await EC.gen.ask(
        "你是电商带货脚本策划，输出 2-3 句中文产品卖点与演绎要求，直接可读，不要解释、不要引号。",
        "根据产品信息写一段适合复刻爆款视频的带货要求"
      );
      const ta = el.querySelector("[data-prompt]");
      if (ta) ta.value = String(r || "").trim();
      EC.toast("已生成");
    } catch (e) { EC.toast((e && e.message) || "生成失败"); }
    finally { EC.ui.busy(btn, false); }
  }

  async function run(el, btn) {
    const v = el.__vc && el.__vc.video, p = el.__vc && el.__vc.product;
    if (!v) { EC.toast("请上传参考视频"); return; }
    if (!p) { EC.toast("请上传产品图"); return; }
    if (!EC.gen.videoConfigured()) { EC.toast("请到「设置 → 短剧服务」配置视频模型"); return; }
    const prompt = ((el.querySelector("[data-prompt]") || {}).value || "").trim() || "复刻参考视频节奏，生成同款带货视频";
    const req = ((el.querySelector("[data-req]") || {}).value || "").trim();
    EC.ui.busy(btn, true, "生成中…"); bar(el, 6, "上传素材到公网…");
    try {
      const refVideo = await EC.store.publicUrl(v);
      const product = await EC.store.publicUrl(p);
      bar(el, 18, "提交视频任务…");
      const r = await EC.gen.video({
        referenceVideo: refVideo, referenceImages: [product],
        prompt: prompt + (req ? "，" + req : ""),
        ratio: pick(el, "ratio") || "9:16",
        duration: Number(pick(el, "duration").replace("s", "")) || 5,
        resolution: pick(el, "resolution") || "720P",
        channel: pick(el, "channel"), lang: (el.querySelector("[data-lang]") || {}).textContent.trim()
      }, function (st) {
        const pr = st && st.progress != null ? st.progress : null;
        bar(el, pr != null ? 18 + Math.round(pr * 0.8) : 60, "生成中…" + (st && st.status ? "（" + st.status + "）" : ""));
      });
      bar(el, 100, "完成");
      const asset = await EC.store.addFromUrl(r.url, {
        name: "视频复刻", kind: "video",
        meta: { mode: "copy", prompt: prompt, req: req, ratio: pick(el, "ratio"), duration: Number(pick(el, "duration").replace("s", "")) || 5, resolution: pick(el, "resolution"), channel: pick(el, "channel"), provider: r.provider }
      });
      el.__vc.result = asset;
      const player = el.querySelector("[data-player]");
      if (player) { player.src = EC.store.src(asset); player.style.display = "block"; }
      const oe = el.querySelector("[data-out-empty]"); if (oe) oe.style.display = "none";
      if (EC.addUsage) EC.addUsage({ generated: 1 });
      EC.toast("视频复刻完成");
    } catch (e) {
      bar(el, 100, "失败"); EC.toast((e && e.message) || "生成失败");
    } finally { EC.ui.busy(btn, false); }
  }

  EC.register("ecomVideoCopy", function (el) {
    if (!el.__vc) el.__vc = { video: null, product: null, result: null };
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
    if (el.__vc.video) {
      const vp = el.querySelector("[data-ref-player]");
      if (vp) { vp.src = EC.store.src(el.__vc.video); vp.style.display = "block"; }
      const re = el.querySelector("[data-ref-empty]"); if (re) re.style.display = "none";
    }
    if (el.__vc.product) setImg(el.querySelector("[data-product]"), el.__vc.product);
    if (el.__vc.result) {
      const player = el.querySelector("[data-player]");
      if (player) { player.src = EC.store.src(el.__vc.result); player.style.display = "block"; }
      const oe = el.querySelector("[data-out-empty]"); if (oe) oe.style.display = "none";
    }
    if (el.__ecomVcBound) return;
    el.__ecomVcBound = true;
    el.addEventListener("click", function (e) {
      if (!EC.ui) return;
      const v = e.target.closest("[data-video]");
      if (v) {
        EC.ui.pickFiles("video/*", false).then(function (files) {
          if (!files.length) return;
          const f = files[0];
          if (f.size > VIDEO_MAX_MB * 1024 * 1024) { EC.toast("视频超过 " + VIDEO_MAX_MB + "MB"); return; }
          EC.store.addFile(f, { kind: "upload" }).then(function (a) {
            el.__vc.video = a;
            const vp = el.querySelector("[data-ref-player]");
            if (vp) { vp.src = EC.store.src(a); vp.style.display = "block"; }
            const re = el.querySelector("[data-ref-empty]"); if (re) re.style.display = "none";
          });
        });
        return;
      }
      const p = e.target.closest("[data-product]");
      if (p) {
        EC.ui.pickFiles("image/*", false).then(function (files) {
          if (!files.length) return;
          const f = files[0];
          if (f.size > IMG_MAX_MB * 1024 * 1024) { EC.toast("产品图超过 " + IMG_MAX_MB + "MB"); return; }
          EC.store.addFile(f, { kind: "upload" }).then(function (a) { el.__vc.product = a; setImg(p, a); });
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
        if (!el.__vc.result) { EC.toast("请先生成视频"); return; }
        EC.toast("已保存到作品库"); EC.go("ecomGallery");
      }
    });
  });
})();
