/* 铜龙电商 · 设置视图（从 index.html 拆出的第 3 块） */
/* ===== 设置视图：多平台 Key 管理与参数 ===== */

XLX.settings = (function () {
  let curProvider = null;

  function render() {
    const s = XLX.llm.getSettings();
    if (!curProvider) curProvider = s.provider || "openrouter";
    const box = document.getElementById("settingsContent");
    const provList = s.providers || [];
    const p = provList.find(x => x.id === curProvider) || XLX.PROVIDERS.find(x => x.id === curProvider) || XLX.PROVIDERS[0];

    box.innerHTML = ''
      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("grid", 15) + '</span>功能配置总览</h3>'
      + '<p class="sd">铜龙电商 的每个功能对应一个配置板块，按下方对照去填即可：</p>'
      + '<div class="feat-map">'
      + '<div class="fm"><span class="fm-ic" style="background:rgba(74,168,255,.15);color:var(--blue)">' + svg("chat", 15) + '</span><div><b>智能对话 / AI帮写 / 软件工坊 / 技能市场</b><span>用「语言模型」板块的 Key（下方第一个）</span></div></div>'
      + '<div class="fm"><span class="fm-ic" style="background:rgba(245,196,81,.15);color:var(--yellow)">' + svg("search", 15) + '</span><div><b>联网搜索</b><span>用「联网搜索」板块（默认免费内置，可自行增强）</span></div></div>'
      + '</div>'
      + '</div>'

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("box", 15) + '</span>模型库（可添加多个模型，一键切换当前使用）</h3>'
      + '<p class="sd">你可以把 <b>语言模型</b>（对话/AI帮写）保存多套配置，<b>每套都是独立的模型库条目</b>（名称 + 服务商 + Base URL + Key + 模型名）。标记 ⭐ 的即「当前使用」，对话时自动用它，<b style="color:var(--green)">以后想换模型只需点一下「设为当前」，无需来回改配置</b>。</p>'
      + '<div class="set-row"><div class="lab"><div class="t">语言模型库（对话 / AI帮写 / 软件工坊）</div><div class="d">当前：<b style="color:var(--green)" id="hubCurLlm">—</b></div></div>'
      + '<div class="val"><div id="hubLlmList" style="display:flex;flex-direction:column;gap:6px"></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
      + '<input class="inp" id="hubLlmName" placeholder="名称，如 我的DeepSeek" style="flex:1;min-width:90px">'
      + '<select class="inp" id="hubLlmVendor" style="flex:1;min-width:110px">'
      + XLX.PROVIDERS.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join("")
      + '</select>'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:6px">'
      + '<input class="inp" id="hubLlmBase" placeholder="Base URL（选择平台自动填，可改）" style="flex:2;min-width:180px">'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:6px">'
      + '<input class="inp" id="hubLlmKey" type="password" placeholder="API Key (sk-...)" style="flex:2;min-width:140px">'
      + '<input class="inp" id="hubLlmModel" placeholder="模型名" style="flex:1;min-width:100px">'
      + '<button class="btn small primary" id="hubLlmAdd">添加</button>'
      + '</div></div></div>'

      + '</div>'

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("key", 15) + '</span>语言模型（智能对话 / AI帮写 / 软件工坊）</h3>'
      + '<p class="sd">这个板块驱动：<b>智能对话</b>（左下角）· <b>AI帮写</b> · <b>软件工坊</b>（AI开发软件）· <b>技能市场</b> 的全部技能。<br>选择一个平台，填入你在该平台申请的 API Key。推荐 <b style="color:var(--green)">DeepSeek</b>（国内直连·响应快·价格极低），或免费平台：<b style="color:var(--green)">智谱GLM-4-Flash / 硅基流动</b>。Key 只保存在你的浏览器本地，不会上传。</p>'
      + '<div class="provider-tabs">'
      + XLX.PROVIDERS.map(pr => {
        const saved = provList.find(x => x.id === pr.id);
        const isOn = !!(saved && saved.key);
        return '<button class="provider-tab' + (pr.id === curProvider ? " active" : "") + '" data-pid="' + pr.id + '">'
          + '<span class="plogo" style="background:' + pr.color + '">' + pr.name.charAt(0) + '</span>' + pr.name
          + (isOn ? ' <span style="color:var(--green)">●</span>' : (pr.free ? ' <span style="color:var(--green)">免费</span>' : ''))
          + '</button>';
      }).join("")
      + '</div>'
      + '<div class="set-row"><div class="lab"><div class="t">' + p.name + ' · API Key</div><div class="d">' + (p.desc || "") + '</div></div>'
      + '<div class="val"><input class="inp" id="setKey" type="password" placeholder="sk-..." value="' + XLX.util.esc((provList.find(x => x.id === p.id) || {}).key || "") + '"></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">Base URL</div><div class="d">' + (p.id === "custom"
          ? "OpenAI 兼容接口地址，例如 https://api.example.com/v1"
          : "官方接口地址已预置，通常无需修改；如需自建代理可在此覆盖") + '</div></div>'
      + '<div class="val"><input class="inp" id="setBase" placeholder="https://..." value="' + XLX.util.esc((provList.find(x => x.id === p.id) || {}).base || (XLX.PROVIDERS.find(x => x.id === p.id) || {}).base || "") + '"></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">模型</div><div class="d">' + (XLX.MODEL_HINTS[p.id] || "选择或输入模型名称") + '</div></div>'
      + '<div class="val">'
      + (p.models && p.models.length ? '<select class="inp" id="setModel">' + p.models.map(m => '<option' + (m === (s.model || p.model) ? " selected" : "") + '>' + m + '</option>').join("") + '</select>'
          : '<input class="inp" id="setModel" placeholder="输入模型名，如 my-model" value="' + XLX.util.esc(s.model || "") + '">')
      + '</div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">设为当前使用平台</div><div class="d">对话默认使用该平台</div></div>'
      + '<div class="val"><button class="btn primary small" id="setUse">使用此平台</button> <button class="btn small" id="setTest">测试连接</button></div></div>'
      + '</div>'

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("settings", 15) + '</span>语言模型 · 对话参数</h3>'
      + '<div class="set-row"><div class="lab"><div class="t">AI 角色设定（System Prompt）</div><div class="d">决定 AI 的回复风格与能力范围</div></div>'
      + '<div class="val"><textarea class="inp" id="setSystem" style="min-height:90px">' + XLX.util.esc(s.system || XLX.DEFAULT_SYSTEM) + '</textarea></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">创造度（Temperature）</div><div class="d">越低越严谨，越高越有创意</div></div>'
      + '<div class="val"><input class="inp" id="setTemp" type="number" min="0" max="1.5" step="0.1" value="' + (s.temperature != null ? s.temperature : 0.7) + '"></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">最大回复长度</div><div class="d">控制单次回复的 token 上限，调小可加快响应</div></div>'
      + '<div class="val"><input class="inp" id="setMax" type="number" min="500" max="16000" step="100" value="' + (s.maxTokens || 800) + '"></div></div>'
      + '</div>'

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("search", 15) + '</span>联网搜索（可选）</h3>'
      + '<p class="sd">搜索已内置免费渠道，无需配置即可使用。可勾选启用哪些渠道（默认全开）。若你申请到 <b>360 智搜官方 API</b>（<a href="https://ai.360.com/api-apply" target="_blank" rel="noopener" style="color:var(--green)">点此申请</a>），填入下面的 Key 可让「360」渠道优先走官方接口，结果更准确。Key 仅保存在浏览器本地。</p>'
      + '<div class="set-row"><div class="lab"><div class="t">搜索渠道（可多选）</div><div class="d">勾选的渠道会在搜索时启用</div></div>'
      + '<div class="val" style="display:flex;flex-wrap:wrap;gap:6px">'
      + XLX.SEARCH_ENGINES.map(eg => {
        const on = !s.searchEngines || s.searchEngines.indexOf(eg.id) >= 0;
        return '<label class="chk"><input type="checkbox" class="se-eng" value="' + eg.id + '"' + (on ? " checked" : "") + '> ' + eg.name + '</label>';
      }).join("")
      + '</div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">360 智搜 API Key（可选）</div><div class="d">留空则使用内置免费渠道</div></div>'
      + '<div class="val"><input class="inp" id="set360Key" type="password" placeholder="sk-..." value="' + XLX.util.esc(s.so360Key || "") + '"></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">自定义搜索渠道</div><div class="d">接入你自己的任意搜索 API（支持 URL 模板与 Key，可多条）</div></div>'
      + '<div class="val"><div id="custEngList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<input class="inp" id="ceName" placeholder="渠道名称，如 智谱搜索" style="flex:1;min-width:90px">'
      + '<input class="inp" id="ceUrl" placeholder="URL模板（含{q}），如 https://api.example.com/search?q={q}" style="flex:3;min-width:200px">'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:6px">'
      + '<input class="inp" id="ceKey" type="password" placeholder="API Key（可选）" style="flex:2;min-width:140px">'
      + '<button class="btn small" id="ceAdd">添加</button>'
      + '</div></div></div>'
      + '</div>'

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("link", 15) + '</span>短视频解析服务（抖音等平台链接直转）</h3>'
      + '<p class="sd">在「视频转文案」的链接提取中，抖音/B站等平台链接无法被浏览器直接访问。可在此填入一个<b>支持跨域(CORS)的解析服务</b>，实现贴链接直接转写。<br>服务地址含 <b>{url}</b> 占位符（填入链接的位置）。返回需为 JSON，如 <code>{"url":"https://...mp4"}</code> 或 <code>{"data":{"url":"..."},"code":0}</code>。<br>获取方式：自建开源 <b>Douyin_TikTok_Download_API</b>（GitHub 搜索），或购买稳定的第三方解析 API（注意选支持 CORS 的）。未配置则维持「先下载再上传」。</p>'
      + '<div class="set-row"><div class="lab"><div class="t">解析服务地址</div><div class="d">含 {url} 占位符，如 https://api.example.com/parse?url={url}</div></div>'
      + '<div class="val"><input class="inp" id="setResolveUrl" placeholder="https://api.example.com/parse?url={url}" value="' + XLX.util.esc(s.resolveUrl || "") + '"></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">API Key（可选）</div><div class="d">服务需要鉴权时填写，以 Authorization: Bearer 头发送</div></div>'
      + '<div class="val"><input class="inp" id="setResolveKey" type="password" placeholder="sk-...（可选）" value="' + XLX.util.esc(s.resolveKey || "") + '"></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">保存</div><div class="d">保存解析服务配置</div></div>'
      + '<div class="val"><button class="btn primary small" id="setResolveSave">保存</button> <button class="btn small" id="setResolveTest">测试解析</button></div></div>'
      + '</div>'

      + dramaServiceCard()

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("shield", 15) + '</span>数据与安全</h3>'
      + '<p class="sd">所有数据（Key、对话、记忆、项目）只保存在当前浏览器本地，清理浏览器数据前请做好备份。</p>'
      + '<div class="set-row"><div class="lab"><div class="t">导出数据备份</div><div class="d">将设置与记忆导出为文件</div></div><div class="val"><button class="btn small" id="setExport">导出</button></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">导入数据备份</div><div class="d">从备份文件恢复</div></div><div class="val"><button class="btn small" id="setImport">导入</button></div></div>'
      + '<div class="set-row"><div class="lab"><div class="t">清除全部本地数据</div><div class="d">清空所有对话、记忆、项目与设置</div></div><div class="val"><button class="btn small danger" id="setClear">清除</button></div></div>'
      + '</div>'

      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("crown", 15) + '</span>关于免费</h3>'
      + '<p class="sd">本应用全部技能完全免费使用。采用 BYOK 模式（自带 Key），Key 只保存在你的浏览器本地，不会上传。付费能力仅作预留，当前不会收取任何费用。</p>'
      + '</div>';

    /* 事件绑定 */
    box.querySelectorAll(".provider-tab").forEach(b => b.onclick = () => { curProvider = b.dataset.pid; render(); });
    document.getElementById("setUse").onclick = saveAndUse;
    document.getElementById("setTest").onclick = testConnection;
    document.getElementById("setExport").onclick = exportData;
    document.getElementById("setImport").onclick = importData;
    document.getElementById("setClear").onclick = clearAll;
    renderCustEngines();
    document.getElementById("ceAdd").onclick = addCustomEngine;
    renderModelHub();
    const hubLlmAdd = document.getElementById("hubLlmAdd");
    if (hubLlmAdd) hubLlmAdd.onclick = addHubModel;
    document.getElementById("hubLlmVendor").onchange = applyHubVendorPreset;
    const rvSave = document.getElementById("setResolveSave");
    if (rvSave) rvSave.onclick = saveResolveConfig;
    const rvTest = document.getElementById("setResolveTest");
    if (rvTest) rvTest.onclick = testResolveConfig;
    const dsSave = document.getElementById("dramaSave");
    if (dsSave) dsSave.onclick = saveDramaServices;
    const dsGuide = document.getElementById("dramaOpenGuide");
    if (dsGuide) dsGuide.onclick = () => { if (XLX.drama && XLX.drama.guide) XLX.drama.guide.open("basics"); };
    DRAMA_KINDS.forEach(k => {
      const sel = document.getElementById("ds-" + k.id + "-provider");
      if (!sel) return;
      sel.onchange = () => {
        const def = XLX.drama.adapterDef(k.id, sel.value);
        const base = document.getElementById("ds-" + k.id + "-base");
        if (base && def && def.base) base.value = def.base;
      };
    });
  }

  const DRAMA_KINDS = [
    { id: "image", name: "文生图（漫剧画面）", desc: "生成每个分镜的画面，漫剧的核心。" },
    { id: "video", name: "图生视频（仿真人剧）", desc: "用首帧生成视频，仿真人剧的核心。推荐火山方舟 Seedance。" },
    { id: "tts", name: "语音合成（配音）", desc: "把台词转成自然的配音。推荐火山语音。" },
    { id: "lipsync", name: "口型驱动（对口型）", desc: "让画面嘴型与配音对齐，仿真人剧用。" }
  ];

  function dramaKindBlock(kind) {
    const meta = DRAMA_KINDS.find(k => k.id === kind.id) || kind;
    const cfg = XLX.drama.getAdapterConfig(meta.id);
    const list = XLX.drama.adapterList(meta.id);
    const isTts = meta.id === "tts";
    const def = XLX.drama.adapterDef(meta.id, cfg.provider);
    const voices = (def && def.voices) || [];
    return ''
      + '<div class="set-row" style="flex-direction:column;align-items:stretch;gap:8px">'
      + '<div class="lab"><div class="t">' + meta.name + '</div><div class="d">' + meta.desc + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<select class="inp" id="ds-' + meta.id + '-provider" style="flex:1;min-width:150px">'
      + list.map(x => '<option value="' + x.id + '"' + (x.id === cfg.provider ? " selected" : "") + '>' + XLX.util.esc(x.name) + '</option>').join("")
      + '</select>'
      + '<input class="inp" id="ds-' + meta.id + '-base" placeholder="Base URL（选平台自动填）" style="flex:2;min-width:180px" value="' + XLX.util.esc(cfg.base) + '">'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + (isTts
        ? '<input class="inp" id="ds-' + meta.id + '-appId" placeholder="App ID" style="flex:1;min-width:110px" value="' + XLX.util.esc(cfg.appId) + '">'
          + '<input class="inp" id="ds-' + meta.id + '-secret" type="password" placeholder="Access Token" style="flex:2;min-width:130px" value="' + XLX.util.esc(cfg.secret || cfg.key) + '">'
          + '<input class="inp" id="ds-' + meta.id + '-cluster" placeholder="cluster，如 volcano_tts" style="flex:1;min-width:110px" value="' + XLX.util.esc(cfg.cluster) + '">'
        : '<input class="inp" id="ds-' + meta.id + '-key" type="password" placeholder="API Key" style="flex:2;min-width:140px" value="' + XLX.util.esc(cfg.key) + '">'
          + '<input class="inp" id="ds-' + meta.id + '-model" placeholder="模型名（可选）" style="flex:1;min-width:110px" value="' + XLX.util.esc(cfg.model) + '">')
      + '</div>'
      + (isTts && voices.length
        ? '<select class="inp" id="ds-' + meta.id + '-voice">' + voices.map(v => '<option value="' + v.id + '"' + (v.id === cfg.voice ? " selected" : "") + '>' + XLX.util.esc(v.name) + '</option>').join("") + '</select>'
        : (isTts ? '<input class="inp" id="ds-' + meta.id + '-voice" placeholder="音色 ID（可选）" value="' + XLX.util.esc(cfg.voice) + '">' : ''))
      + '<div class="d" style="color:var(--text3);font-size:11px">' + XLX.util.esc((def && def.keyHint) || "") + ((def && def.keyLink) ? ' · <a href="' + def.keyLink + '" target="_blank" rel="noopener" style="color:var(--green)">去申请</a>' : '') + '</div>'
      + '</div>';
  }

  function dramaServiceCard() {
    return ''
      + '<div class="set-card">'
      + '<h3><span class="hic">' + svg("film", 15) + '</span>短剧服务（手搓台 / 半自动台）</h3>'
      + '<p class="sd">两个 AI 短剧工作台用这里的四类服务。<b>漫剧</b>只需「文生图 + 语音」；<b>仿真人剧</b>还需「图生视频 + 口型」。所有 Key 只保存在浏览器本地，不会上传。填之前可先看工作台里的「看教程」。<b style="color:var(--green)">没有 API Key 也能用半自动台出剧本</b>，但生成画面/配音必须配置对应服务。</p>'
      + DRAMA_KINDS.map(dramaKindBlock).join("")
      + '<div class="set-row"><div class="lab"><div class="t">保存短剧服务</div><div class="d">保存后立即在短剧工作台生效</div></div>'
      + '<div class="val"><button class="btn primary small" id="dramaSave">保存</button> <button class="btn small" id="dramaOpenGuide">看教程</button></div></div>'
      + '</div>';
  }

  function saveDramaServices() {
    if (!XLX.drama) return;
    DRAMA_KINDS.forEach(k => {
      const kind = k.id;
      const providerEl = document.getElementById("ds-" + kind + "-provider");
      if (!providerEl) return;
      const cfg = { provider: providerEl.value };
      const base = document.getElementById("ds-" + kind + "-base");
      if (base) cfg.base = base.value.trim();
      const key = document.getElementById("ds-" + kind + "-key");
      if (key) cfg.key = key.value.trim();
      const model = document.getElementById("ds-" + kind + "-model");
      if (model) cfg.model = model.value.trim();
      const appId = document.getElementById("ds-" + kind + "-appId");
      if (appId) cfg.appId = appId.value.trim();
      const secret = document.getElementById("ds-" + kind + "-secret");
      if (secret) cfg.secret = secret.value.trim();
      const cluster = document.getElementById("ds-" + kind + "-cluster");
      if (cluster) cfg.cluster = cluster.value.trim();
      const voice = document.getElementById("ds-" + kind + "-voice");
      if (voice) cfg.voice = voice.value;
      XLX.drama.setAdapterConfig(kind, cfg);
    });
    XLX.util.toast("短剧服务已保存", "ok");
  }

  function saveResolveConfig() {
    const s = XLX.llm.getSettings();
    s.resolveUrl = document.getElementById("setResolveUrl").value.trim();
    s.resolveKey = document.getElementById("setResolveKey").value.trim();
    XLX.llm.saveSettings(s);
    XLX.util.toast(s.resolveUrl ? "短视频解析服务已保存" : "已清空解析服务配置", "ok");
    render();
  }

  async function testResolveConfig() {
    const url = document.getElementById("setResolveUrl").value.trim();
    if (!url) { XLX.util.toast("请先填写解析服务地址", "warn"); return; }
    if (!url.includes("{url}")) { XLX.util.toast("服务地址需包含 {url} 占位符", "warn"); return; }
    const btn = document.getElementById("setResolveTest");
    btn.disabled = true; btn.textContent = "测试中…";
    try {
      const r = await XLX.tools.tryResolve("https://example.com/test", url, document.getElementById("setResolveKey").value.trim());
      const ok = !!(r && (r.url || r.data || r.playUrl));
      XLX.util.toast(ok ? "解析服务可连通（返回了视频地址）" : "服务可连通，但返回格式未识别", ok ? "ok" : "warn");
    } catch (e) {
      XLX.util.toast("解析服务测试失败：" + (e.message || e), "err");
    }
    btn.disabled = false; btn.textContent = "测试解析";
  }

  const HUB_VENDOR_PRESETS = {
    deepseek: { base: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    openrouter: { base: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-chat-v3-0324:free" },
    moonshot: { base: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
    qwen: { base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
    zhipu: { base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
    siliconflow: { base: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct" },
    openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    custom: { base: "", model: "" }
  };
  const HUB_KNOWN_BASES = Object.values(HUB_VENDOR_PRESETS).map(x => x.base).filter(Boolean);

  function applyHubVendorPreset() {
    const sel = document.getElementById("hubLlmVendor");
    const bEl = document.getElementById("hubLlmBase");
    const mEl = document.getElementById("hubLlmModel");
    if (!sel || !bEl || !mEl) return;
    const cur = HUB_VENDOR_PRESETS[sel.value];
    if (!cur) return;
    const bv = bEl.value.trim(), mv = mEl.value.trim();
    if (!bv || HUB_KNOWN_BASES.indexOf(bv) >= 0) bEl.value = cur.base;
    if (!mv || cur.model) mEl.value = cur.model;
  }

  function renderModelHub() {
    const listEl = document.getElementById("hubLlmList");
    const curEl = document.getElementById("hubCurLlm");
    if (!listEl) return;
    const list = XLX.modelHub.all("llm");
    const cur = XLX.modelHub.current("llm");
    if (curEl) curEl.textContent = cur ? (cur.name || cur.model || cur.vendor) : "未添加（使用下方单配置）";
    if (!list.length) {
      listEl.innerHTML = '<div style="color:var(--text3);font-size:12px">还没有保存的语言模型，在下面添加一个。</div>';
      return;
    }
    listEl.innerHTML = list.map((m, i) =>
      '<div style="display:flex;gap:6px;align-items:center;background:var(--bg);border:1px solid ' + (m.marked ? "var(--green)" : "var(--border)") + ';border-radius:8px;padding:6px 9px;font-size:12px">'
      + (m.marked ? '<span style="color:var(--green);flex:0 0 auto">⭐</span>' : '')
      + '<b style="flex:0 0 auto;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + XLX.util.esc(m.name || "") + '">' + XLX.util.esc(m.name || m.vendor) + '</b>'
      + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text3)" title="' + XLX.util.esc(m.base + " · " + m.model) + '">' + XLX.util.esc((m.model || "") + (m.base ? " · " + m.base : "")) + '</span>'
      + (m.marked ? '<span style="flex:0 0 auto;color:var(--green)">当前使用</span>'
        : '<button class="btn small" data-hm="use" data-i="' + i + '" style="padding:3px 8px">设为当前</button>')
      + '<button class="btn small danger" data-hm="del" data-i="' + i + '" style="padding:3px 8px">删除</button>'
      + '</div>').join("");
    listEl.querySelectorAll("[data-hm]").forEach(b => b.onclick = () => {
      const item = XLX.modelHub.all("llm")[parseInt(b.dataset.i, 10)];
      if (!item) return;
      if (b.dataset.hm === "use") { XLX.modelHub.mark(item.id); XLX.util.toast("已设为当前使用：" + (item.name || item.vendor), "ok"); render(); }
      else { XLX.modelHub.remove(item.id); XLX.util.toast("已删除模型", "info"); render(); }
    });
  }

  function addHubModel() {
    const nameEl = document.getElementById("hubLlmName");
    const vendorEl = document.getElementById("hubLlmVendor");
    const baseEl = document.getElementById("hubLlmBase");
    const keyEl = document.getElementById("hubLlmKey");
    const modelEl = document.getElementById("hubLlmModel");
    if (!vendorEl || !baseEl || !keyEl || !modelEl) return;
    const base = baseEl.value.trim();
    const key = keyEl.value.trim();
    const model = modelEl.value.trim();
    if (!key) { XLX.util.toast("请填写语言模型的 API Key", "warn"); return; }
    const item = XLX.modelHub.add({
      kind: "llm",
      name: nameEl.value.trim(),
      vendor: vendorEl.value,
      base,
      key,
      model
    });
    XLX.util.toast("已添加「" + (item.name || item.vendor) + "」到模型库" + (item.marked ? "，并设为当前使用" : ""), "ok");
    render();
  }

  function getCustomEngines(s) {
    return (s && Array.isArray(s.customEngines)) ? s.customEngines : [];
  }

  function renderCustEngines() {
    const box = document.getElementById("custEngList");
    if (!box) return;
    const s = XLX.llm.getSettings();
    const list = getCustomEngines(s);
    box.innerHTML = list.map((ce, i) =>
      '<div style="display:flex;gap:6px;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 9px;font-size:12px">'
      + '<b style="flex:0 0 auto;color:var(--green)">' + XLX.util.esc(ce.name || "渠道" + (i + 1)) + '</b>'
      + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text3)" title="' + XLX.util.esc(ce.url || "") + '">' + XLX.util.esc(ce.url || "") + '</span>'
      + (ce.key ? '<span style="flex:0 0 auto;color:var(--text3)">Key已填</span>' : '')
      + '<button class="btn small danger" data-del="' + i + '" style="padding:3px 8px">删除</button>'
      + '</div>'
    ).join("") || '<div style="color:var(--text3);font-size:12px">暂无自定义渠道</div>';
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => removeCustomEngine(parseInt(b.dataset.del, 10)));
  }

  function saveCustomEngines(list) {
    const s = XLX.llm.getSettings();
    s.customEngines = list;
    XLX.llm.saveSettings(s);
    renderCustEngines();
  }

  function addCustomEngine() {
    const name = document.getElementById("ceName").value.trim();
    const url = document.getElementById("ceUrl").value.trim();
    const key = document.getElementById("ceKey").value.trim();
    if (!name || !url) { XLX.util.toast("请填写渠道名称与 URL 模板", "err"); return; }
    if (url.indexOf("{q}") < 0 && url.indexOf("{query}") < 0) {
      if (!confirm("URL 中未包含 {q} 占位符，搜索关键词将无法替换，仍要保存吗？")) return;
    }
    const s = XLX.llm.getSettings();
    const list = getCustomEngines(s);
    list.push({ name: name, url: url, key: key });
    saveCustomEngines(list);
    document.getElementById("ceName").value = "";
    document.getElementById("ceUrl").value = "";
    document.getElementById("ceKey").value = "";
    XLX.util.toast("已添加自定义渠道：" + name, "ok");
  }

  function removeCustomEngine(i) {
    const s = XLX.llm.getSettings();
    const list = getCustomEngines(s);
    const ce = list[i];
    if (!ce) return;
    if (!confirm("删除自定义渠道「" + ce.name + "」？")) return;
    list.splice(i, 1);
    saveCustomEngines(list);
    XLX.util.toast("已删除", "ok");
  }

  function saveAndUse() {
    const s = XLX.llm.getSettings();
    const key = document.getElementById("setKey").value.trim();
    const model = document.getElementById("setModel").value.trim();
    const base = document.getElementById("setBase") ? document.getElementById("setBase").value.trim() : null;
    const provList = s.providers || [];
    let entry = provList.find(x => x.id === curProvider);
    if (!entry) { entry = { id: curProvider, key: "", model: "", base: "" }; provList.push(entry); }
    entry.key = key;
    if (model) entry.model = model;
    /* Base URL：预置平台存空串时按预置值兜底；自定义平台必须填 */
    if (base != null) {
      const presetBase = (XLX.PROVIDERS.find(x => x.id === curProvider) || {}).base || "";
      if (curProvider === "custom") entry.base = base;
      else if (base && base !== presetBase) entry.base = base;
      else entry.base = "";
    }
    s.providers = provList;
    s.provider = curProvider;
    if (model) s.model = model;
    s.system = document.getElementById("setSystem").value;
    s.temperature = parseFloat(document.getElementById("setTemp").value) || 0.7;
    s.maxTokens = parseInt(document.getElementById("setMax").value) || 4000;
    const k360 = document.getElementById("set360Key");
    if (k360) s.so360Key = k360.value.trim();
    const engBoxes = document.querySelectorAll(".se-eng");
    if (engBoxes.length) {
      s.searchEngines = Array.from(engBoxes).filter(b => b.checked).map(b => b.value);
    }
    XLX.llm.saveSettings(s);
    XLX.util.toast("设置已保存，当前平台：" + (XLX.PROVIDERS.find(x => x.id === curProvider) || {}).name, "ok");
    XLX.app.refreshStatus();
  }

  async function testConnection() {
    saveAndUse();
    XLX.util.toast("正在测试连接…", "info");
    try {
      const provider = XLX.llm.currentProvider();
      const res = await XLX.llm.ask(undefined, "你好，请回复：连接成功", { provider: provider.id });
      XLX.util.toast("连接成功！模型回复：" + res.slice(0, 30), "ok");
    } catch (e) {
      XLX.util.toast("连接失败：" + e.message, "err");
    }
  }

  function exportData() {
    const data = {};
    ["xlx_settings", "xlx_memory", "xlx_commands", "xlx_project", "xlx_images", "xlx_conversations", "xlx_chat_meta"].forEach(k => {
      const v = localStorage.getItem(k);
      if (v) data[k] = v;
    });
    XLX.util.download("xiaolongxia-backup.json", JSON.stringify(data, null, 2), "application/json");
    XLX.util.toast("备份已导出", "ok");
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
          XLX.util.toast("备份已恢复", "ok");
          setTimeout(() => location.reload(), 600);
        } catch (e) { XLX.util.toast("备份文件格式错误", "err"); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function clearAll() {
    if (!confirm("确定清除全部本地数据？此操作不可恢复！")) return;
    localStorage.removeItem("xlx_settings");
    localStorage.removeItem("xlx_memory");
    localStorage.removeItem("xlx_commands");
    localStorage.removeItem("xlx_project");
    localStorage.removeItem("xlx_images");
    localStorage.removeItem("xlx_conversations");
    localStorage.removeItem("xlx_chat_meta");
    XLX.util.toast("已清除，正在刷新…", "ok");
    setTimeout(() => location.reload(), 600);
  }

  function svg(n, s) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:' + s + 'px;height:' + s + 'px">' + (XLX.ICONS[n] || "") + '</svg>'; }

  return { render };
})();

