/* 铜龙电商 · AI 短剧工作台 · 模型选择器 */
/* 四类模型（图像/视频/语音/口型）的统一选择条，配置写入 settings.adapters，Key 只存本地。 */
(function () {
  const D = XLX.drama;

  const KINDS = ["image", "video", "tts", "lipsync"];
  const NAMES = { image: "生图模型", video: "视频模型", tts: "语音模型", lipsync: "口型模型" };

  function kinds() { return KINDS.slice(); }
  function label(kind) { return NAMES[kind] || kind; }
  function current(kind) { return D.getAdapterConfig(kind); }
  function def(kind) { return current(kind).def; }
  function ready(kind) { return D.isConfigured(kind); }

  function setProvider(kind, provider) { D.setAdapterConfig(kind, { provider }); }
  function setModel(kind, model) { D.setAdapterConfig(kind, { model }); }
  function setVoice(kind, voice) { D.setAdapterConfig(kind, { voice }); }

  /* 缺配置时的统一引导：回到设置页补齐 */
  function gotoSettings() {
    if (typeof XLX !== "undefined" && XLX.app && XLX.app.go) { XLX.app.go("settings"); return true; }
    return false;
  }

  function render(kind, o) {
    o = o || {};
    const c = current(kind);
    const ok = ready(kind);
    const models = (c.def && c.def.models) || [];
    const voices = (c.def && c.def.voices) || [];
    let html = '<div class="dw-modelbar' + (ok ? "" : " off") + '" data-kind="' + D.ui.esc(kind) + '">' +
      '<span class="dw-modelbar-name">' + D.ui.esc(label(kind)) + "</span>" +
      '<select class="inp dw-model-provider" data-modelsel="' + D.ui.esc(kind) + '">' + D.ui.opts(D.adapterList(kind), c.provider) + "</select>";

    if (models.length) {
      html += '<select class="inp dw-model-model" data-modelmodel="' + D.ui.esc(kind) + '">' +
        models.map(m => '<option value="' + D.ui.esc(m) + '"' + (m === c.model ? " selected" : "") + ">" + D.ui.esc(m) + "</option>").join("") +
        "</select>";
    } else {
      html += '<input class="inp dw-model-model" data-modelmodel="' + D.ui.esc(kind) + '" value="' + D.ui.esc(c.model) + '" placeholder="模型名">';
    }

    if (kind === "tts" && voices.length) {
      html += '<select class="inp dw-model-voice" data-modelvoice="tts">' +
        voices.map(v => '<option value="' + D.ui.esc(v.id) + '"' + (v.id === c.voice ? " selected" : "") + ">" + D.ui.esc(v.name) + "</option>").join("") +
        "</select>";
    }

    html += '<span class="dw-modelbar-dot' + (ok ? " ok" : " bad") + '" title="' + (ok ? "已配置" : "未配置") + '"></span>';
    if (!ok) html += '<button class="btn small ghost" data-modelcfg="' + D.ui.esc(kind) + '">去配置</button>';
    html += "</div>";
    return html;
  }

  function bar(kind, o) { return render(kind, o); }

  function bind(root, o) {
    o = o || {};
    root.querySelectorAll("[data-modelsel]").forEach(el => {
      el.onchange = async () => {
        setProvider(el.dataset.modelsel, el.value);
        if (o.onChange) await o.onChange(el.dataset.modelsel);
      };
    });
    root.querySelectorAll("[data-modelmodel]").forEach(el => {
      el.onchange = async () => {
        setModel(el.dataset.modelmodel, el.value.trim());
        if (o.onChange) await o.onChange(el.dataset.modelmodel);
      };
    });
    root.querySelectorAll("[data-modelvoice]").forEach(el => {
      el.onchange = async () => {
        setVoice(el.dataset.modelvoice, el.value);
        if (o.onChange) await o.onChange(el.dataset.modelvoice);
      };
    });
    root.querySelectorAll("[data-modelcfg]").forEach(el => {
      el.onclick = () => { gotoSettings(); };
    });
  }

  D.models = { kinds, label, current, def, ready, setProvider, setModel, setVoice, render, bar, bind, gotoSettings };
})();
