/* 铜龙电商ai助手 · 电商工作台 · AI 视频 · 图生视频（参考图 + AI 帮写脚本 + 商品讲解视频） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const CHANNELS = ["灵动演绎", "极速出片"];
  const CHANNEL_INFO = [
    { name: "灵动演绎", desc: "动作自然、画面生动，细节表现更丰富", stability: "高稳定", credits: "5秒 150 · 10秒 200 · 15秒 260" },
    { name: "极速出片", desc: "生成速度快，适合批量快速出片", stability: "极速", credits: "5秒 100 · 10秒 150 · 15秒 200" }
  ];
  const DURATIONS = ["5", "10", "15"];
  const RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const RESOLUTIONS = ["480P", "720P"];
  const LANGS = (EC.const && EC.const.VIDEO_LANGS) || ["简体中文", "繁体中文", "英语", "泰语", "俄语", "越南语", "马来语", "葡萄牙语", "西班牙语", "日语", "韩语", "德语", "法语", "荷兰语", "波兰语", "土耳其语", "印尼语", "菲律宾语"];
  const MAX_MB = 3;

  /* 发现灵感 · 一键同款（本地示例：参考图 + 脚本） */
  const INSPIRATIONS = [
    { img: "pot.jpg", title: "珐琅锅 · 使用场景", script: "镜头缓缓推近珐琅锅，热气腾腾的汤汁翻滚。旁白：一锅多用，锁温聚能，烹饪更省心。" },
    { img: "lipstick.jpg", title: "口红 · 上色展示", script: "特写口红丝滑涂抹，唇部显色饱满。旁白：丝绒质地，显白持色，一抹倾心。" },
    { img: "detergent.jpg", title: "洗衣液 · 洁净演示", script: "对比镜头展示衣物由脏到净。旁白：浓缩配方，强效去渍，守护全家洁净。" },
    { img: "dress.jpg", title: "连衣裙 · 模特走动", script: "模特身着连衣裙自信走位，裙摆轻盈摆动。旁白：优雅版型，通勤约会都合适。" }
  ];

  const HTML = `<div class="inner">
    <div class="page-head">
      <h1>图生视频</h1>
      <p>上传一张参考图（≤3M），描述视频内容或让 AI 帮写脚本，生成商品讲解视频。</p>
      <button class="btn btn-ghost" data-history style="width:auto;padding:8px 14px;font-size:12.5px;margin-top:10px"><svg class="ic sm"><use href="#i-lib"/></svg>生成记录</button>
    </div>

    <div class="split" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="panel">
        <div class="panel-head"><svg class="ic sm"><use href="#i-video"/></svg>视频设置</div>
        <div class="panel-body">
          <div class="field">
            <label>参考图（JPG / PNG / WEBP，≤3M）</label>
            <div class="dropzone" data-ref>
              <div class="dz-ic"><svg class="ic"><use href="#i-upload"/></svg></div>
              <b>点击/拖拽/粘贴上传参考图</b>
              <p>支持 3M 以内的 JPG / PNG / WEBP 图片</p>
            </div>
            <p class="note" style="margin-top:8px;font-size:11.5px;color:var(--muted)">不支持上传包含真人脸或成人用品的图片</p>
          </div>

          <div class="field">
            <label>视频脚本 <button class="btn btn-ghost" data-ai-write style="width:auto;padding:2px 10px;font-size:12px;margin-left:6px">AI优质帮写视频脚本</button><span class="cost-badge">优质帮写 200 积分</span></label>
            <textarea class="inp" data-prompt rows="4" placeholder="描述画面：主体、动作、场景、运镜…"></textarea>
          </div>

          <div class="field">
            <div class="label-row"><label>选择通道</label><span class="ch-link" data-channel-info>查看通道说明</span></div>
            <div class="chips" data-group="channel">
              <div class="chip on">灵动演绎</div>
              <div class="chip">极速出片</div>
            </div>
          </div>
          <div class="field">
            <label>视频时长</label>
            <div class="chips" data-group="duration">
              <div class="chip">5秒</div>
              <div class="chip on">10秒</div>
              <div class="chip">15秒</div>
            </div>
          </div>
          <div class="field">
            <label>视频比例</label>
            <div class="chips" data-group="ratio">
              <div class="chip">1:1</div>
              <div class="chip">3:4</div>
              <div class="chip">4:3</div>
              <div class="chip">9:16</div>
              <div class="chip on">16:9</div>
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

          <button class="btn btn-primary" data-run><svg class="ic sm"><use href="#i-spark"/></svg>生成视频</button>
          <button class="btn btn-ghost" data-save style="margin-top:8px"><svg class="ic sm"><use href="#i-download"/></svg>保存到作品库</button>
          <p class="note cost-note" style="margin-top:8px;font-size:12px;color:var(--muted)">生成消耗按通道与时长计费，点击「查看通道说明」查看详情。</p>
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

    <div class="insp-section">
      <div class="label-row" style="margin:22px 0 12px"><label style="font-size:15px;font-weight:800">发现灵感 · 一键同款</label><span style="font-size:12px;color:var(--muted)">点击示例，一键套用参考图与脚本</span></div>
      <div class="insp-grid">
        ${INSPIRATIONS.map(function (it, i) {
          return '<div class="i2v-insp" data-insp="' + i + '">'
            + '<div class="i2v-insp-thumb"><img src="assets/ecom/' + it.img + '" alt="" loading="lazy"><span class="i2v-insp-play"><svg class="ic sm"><use href="#i-play"/></svg></span></div>'
            + '<b>' + esc(it.title) + '</b></div>';
        }).join("")}
      </div>
    </div>

    <div class="i2v-recent" data-history-panel>
      <div class="label-row" style="margin:24px 0 12px"><label style="font-size:15px;font-weight:800">30天内生成记录</label><span style="font-size:12px;color:var(--muted)" data-recent-count></span></div>
      <div class="i2v-recent-grid" data-recent-list><div class="ed-empty">正在加载…</div></div>
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

  function channelDialog() {
    const body = '<div class="ch-cards">' + CHANNEL_INFO.map(function (c, i) {
      return '<div class="ch-card' + (i === 0 ? ' on' : '') + '">'
        + '<div class="ch-card-ic"><svg class="ic"><use href="#i-video"/></svg></div>'
        + '<div class="ch-card-main"><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span>'
        + '<em>' + esc(c.credits) + '</em></div>'
        + '<span class="ch-card-tag">' + esc(c.stability) + '</span></div>';
    }).join("") + '</div>';
    EC.ui.modal({ title: "选择通道", body: body });
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
        duration: Number(pick(el, "duration").replace(/[s秒]/g, "")) || 5,
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
      renderRecent(el);
      EC.toast("视频生成完成");
    } catch (e) {
      bar(el, 100, "失败"); EC.toast((e && e.message) || "生成失败");
    } finally { EC.ui.busy(btn, false); }
  }

  async function showHistory(el) {
    const items = await EC.store.list().catch(function () { return []; });
    const cutoff = Date.now() - 30 * 86400 * 1000;
    const vids = items.filter(function (a) {
      return a.kind === "video" && (!a.createdAt || a.createdAt >= cutoff);
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    const body = vids.length
      ? '<div class="hist-grid">' + vids.slice(0, 40).map(function (a) {
          return '<div class="hist-item" data-id="' + esc(a.id) + '"><video src="' + esc(EC.store.src(a)) + '" muted playsinline></video>'
            + '<span>' + esc(a.name || "视频") + '</span></div>';
        }).join("") + '</div>'
      : '<div class="ed-empty">暂无记录，先生成一个视频吧。</div>';
    const m = EC.ui.modal({ title: "生成记录 · 30天内", body: body, wide: true });
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

  async function renderRecent(el) {
    const box = el.querySelector("[data-recent-list]");
    if (!box) return;
    const items = await EC.store.list().catch(function () { return []; });
    const cutoff = Date.now() - 30 * 86400 * 1000;
    const vids = items.filter(function (a) {
      return a.kind === "video" && (!a.createdAt || a.createdAt >= cutoff);
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 12);
    const cnt = el.querySelector("[data-recent-count]");
    if (cnt) cnt.textContent = vids.length ? "共 " + vids.length + " 条" : "";
    if (!vids.length) { box.innerHTML = '<div class="ed-empty">暂无记录，先生成一个视频吧。</div>'; return; }
    box.innerHTML = vids.map(function (a) {
      return '<div class="hist-item" data-id="' + esc(a.id) + '"><video src="' + esc(EC.store.src(a)) + '" muted playsinline></video><span>' + esc(a.name || "视频") + '</span></div>';
    }).join("");
  }

  EC.register("ecomVideoI2V", function (el) {
    if (!el.__i2v) el.__i2v = { ref: null, result: null };
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
    renderRecent(el);
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
      const recent = e.target.closest(".i2v-recent .hist-item");
      if (recent) {
        EC.store.get(recent.getAttribute("data-id")).then(function (a) {
          if (!a) return;
          EC.store.download(a);
          if (EC.addUsage) EC.addUsage({ exported: 1 });
        });
        return;
      }
      const histBtn = e.target.closest("[data-history]");
      if (histBtn) { showHistory(el); return; }
      if (e.target.closest("[data-channel-info]")) { channelDialog(); return; }
      const insp = e.target.closest("[data-insp]");
      if (insp) {
        const it = INSPIRATIONS[Number(insp.getAttribute("data-insp"))];
        if (it) {
          el.__i2v.ref = { id: "demo-i2v-" + it.img, url: "assets/ecom/" + it.img, name: it.title };
          const dz = el.querySelector("[data-ref]");
          if (dz) dz.innerHTML = '<img src="' + esc(EC.store.src(el.__i2v.ref)) + '" alt="" style="width:100%;border-radius:10px">';
          const ta = el.querySelector("[data-prompt]");
          if (ta) ta.value = it.script;
          EC.toast("已套用示例：" + it.title);
        }
        return;
      }
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
