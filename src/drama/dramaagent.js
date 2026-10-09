/* 短剧 Agent：AI 短剧工作台的独立智能体入口。
 * 结构对齐 LibTV Agent（左侧对话列表 + 中部消息流 + 首屏建议卡 + 底部输入），
 * 配色沿用工作台现有主题变量，不覆盖任何主题色。
 * 与「日常ai助手 Agent」相互独立：独立存储键、独立历史、独立会话。
 * 需要感知当前画布：明确的画布指令直接落到 XLX.drama.agent，不占用对话模型。 */
(function () {
  const D = XLX.drama = XLX.drama || {};
  const U = XLX.util || {};
  const K_CONVS = (XLX.K && XLX.K.DRAMA_AGENT_CONVS) || "xlx_drama_agent_convs";
  const K_CUR = (XLX.K && XLX.K.DRAMA_AGENT_CURRENT) || "xlx_drama_agent_current";

  const SYS = "你是「短剧 Agent」，铜龙电商ai助手 AI 短剧工作台里的短剧创作智能体。"
    + "你擅长短剧选题、故事梗概 logline、分幕大纲、人物小传、分镜脚本、台词润色与画面提示词。"
    + "回答用简体中文，专业、直接、可落地，优先给出可直接用于创作的成品；"
    + "当用户提到当前画布或工程时，结合实况给出可执行的操作建议。";

  const SUGGESTS = [
    { icon: "film", c: "#4aa8ff", t: "一句话起剧", d: "一个梗概，帮你起一部长篇", q: "帮我起一个短剧项目，题材是：" },
    { icon: "user", c: "#3ddc84", t: "角色小传", d: "主角动机、弧光、关系网", q: "帮我写主角的人物小传，角色特点：" },
    { icon: "chat", c: "#f5c451", t: "台词润色", d: "更口语、更抓人、更有钩子", q: "帮我润色这段台词：" },
    { icon: "grid", c: "#9aa7bd", t: "分镜提示词", d: "按镜头输出画面提示词", q: "帮我写分镜画面提示词，场景是：" },
    { icon: "trend", c: "#ff8f5a", t: "爆款选题", d: "5 个高完播率短剧选题", q: "帮我出 5 个短剧爆款选题，方向是：" }
  ];

  const state = { busy: false, aborter: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function icon(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
      + ((XLX.ICONS && XLX.ICONS[n]) || "") + '</svg>';
  }
  function toast(msg, type) { if (U.toast) U.toast(msg, type); }
  function uid() { return U.uid ? U.uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); }
  function fmtTime(ts) { return U.fmtTime ? U.fmtTime(ts) : ""; }

  /* ---------- 存储（独立于通用对话的 xlx_conversations） ---------- */
  function readConvs() {
    try { const a = JSON.parse(localStorage.getItem(K_CONVS) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeConvs(list) { try { localStorage.setItem(K_CONVS, JSON.stringify((list || []).slice(0, 60))); } catch (e) {} }
  function currentId() { try { return localStorage.getItem(K_CUR) || ""; } catch (e) { return ""; } }
  function setCurrentId(id) { try { if (id) localStorage.setItem(K_CUR, id); else localStorage.removeItem(K_CUR); } catch (e) {} }
  function current() {
    const list = readConvs();
    const id = currentId();
    return list.find(c => c.id === id) || list[0] || null;
  }
  function saveConv(conv) {
    const list = readConvs();
    const i = list.findIndex(c => c.id === conv.id);
    if (i >= 0) list[i] = conv; else list.unshift(conv);
    writeConvs(list);
  }
  function newConv() {
    const conv = { id: uid(), title: "新对话", time: Date.now(), messages: [] };
    const list = readConvs();
    list.unshift(conv);
    writeConvs(list);
    setCurrentId(conv.id);
    render();
    const i = document.getElementById("daInput");
    if (i) i.focus();
    return conv;
  }
  function ensureConv() { return current() || newConv(); }

  /* ---------- DOM ---------- */
  function host() { return document.getElementById("dramaAgent"); }
  function bodyEl() { return document.getElementById("daBody"); }
  function scrollDown() { const b = bodyEl(); if (b) b.scrollTop = b.scrollHeight; }

  function layoutHtml() {
    return ''
      + '<div class="da-wrap">'
      +   '<aside class="da-side">'
      +     '<button class="da-new" id="daNew">' + icon("plus") + '<span>新建对话</span></button>'
      +     '<div class="da-list" id="daList"></div>'
      +   '</aside>'
      +   '<section class="da-main">'
      +     '<div class="da-body" id="daBody"></div>'
      +     '<div class="da-foot">'
      +       '<div class="chat-input-wrap">'
      +         '<div class="chat-input-row">'
      +           '<textarea id="daInput" rows="1" placeholder="描述你想拍的短剧，或直接说画布操作，例如「加一个 5 秒的雨夜镜头」"></textarea>'
      +           '<button class="send-btn" id="daSend" title="发送">' + icon("arrow") + '</button>'
      +           '<button class="send-btn da-stop" id="daStop" title="停止" style="display:none">' + icon("stop") + '</button>'
      +         '</div>'
      +         '<div class="chat-hint">Enter 发送 · Shift+Enter 换行 · 可直接操作当前画布</div>'
      +       '</div>'
      +     '</div>'
      +   '</section>'
      + '</div>';
  }

  function emptyHtml() {
    return ''
      + '<div class="da-empty">'
      +   '<div class="da-hero">'
      +     '<div class="da-hero-ic">' + icon("film") + '</div>'
      +     '<div class="da-hero-t">短剧 Agent</div>'
      +     '<div class="da-hero-d">直接读当前画布 · 一句话起剧 · 分幕大纲 · 人物小传 · 分镜脚本 · 台词润色 · 画面提示词</div>'
      +   '</div>'
      +   '<div class="suggest-grid">'
      +     SUGGESTS.map((s, i) =>
              '<div class="suggest-card" data-i="' + i + '">'
              + '<div class="ic" style="background:' + s.c + '22;color:' + s.c + '">' + icon(s.icon) + '</div>'
              + '<div class="t">' + esc(s.t) + '</div><div class="d">' + esc(s.d) + '</div></div>').join("")
      +   '</div>'
      + '</div>';
  }

  function buildMsg(role, content, time) {
    const d = document.createElement("div");
    d.className = "msg " + (role === "user" ? "user" : "ai");
    const userIc = ((XLX.ICONS && XLX.ICONS.user) || "").replace(/(stroke="#[^"]+")/g, 'stroke="#1c64f4"');
    const av = role === "user"
      ? '<div class="avatar" style="background:linear-gradient(135deg,#dbe7ff,#c7dbff)">' + userIc + '</div>'
      : '<div class="avatar">' + (U.logo ? U.logo(21) : "") + '</div>';
    const body = role === "user"
      ? '<div class="bubble"><div class="text">' + esc(content) + '</div></div>'
      : '<div class="bubble"><div class="md" data-role="md"></div></div>';
    d.innerHTML = av + body;
    const mdEl = d.querySelector("[data-role=md]");
    if (role === "ai" && mdEl) {
      if (U.renderFull) U.renderFull(mdEl, content || ""); else mdEl.textContent = content || "";
      if (!content) mdEl.innerHTML = '<div class="typing-dots"><i></i><i></i><i></i></div>';
    }
    return d;
  }

  function msgsEl() {
    const body = bodyEl();
    if (!body) return null;
    let m = body.querySelector("#daMsgs");
    if (!m) { body.innerHTML = '<div class="chat-inner" id="daMsgs"></div>'; m = body.querySelector("#daMsgs"); }
    return m;
  }

  function renderList() {
    const el = document.getElementById("daList");
    if (!el) return;
    const list = readConvs();
    const cur = current();
    el.innerHTML = (list.length
      ? list.map(c =>
          '<div class="da-item' + (cur && c.id === cur.id ? " active" : "") + '" data-id="' + c.id + '">'
          + '<div class="da-item-t">' + esc(c.title || "新对话") + '</div>'
          + '<div class="da-item-d">' + fmtTime(c.time) + '</div></div>').join("")
      : '<div class="da-list-empty">暂无对话</div>');
    el.querySelectorAll(".da-item").forEach(it => {
      it.onclick = () => { setCurrentId(it.dataset.id); renderMsgs(); renderList(); };
    });
  }

  function renderMsgs() {
    const body = bodyEl();
    if (!body) return;
    const conv = current();
    if (!conv || !conv.messages.length) {
      body.innerHTML = emptyHtml();
      body.querySelectorAll(".suggest-card").forEach(card => {
        card.onclick = () => {
          const s = SUGGESTS[+card.dataset.i];
          const inp = document.getElementById("daInput");
          if (s && inp) { inp.value = s.q; inp.focus(); }
        };
      });
      return;
    }
    body.innerHTML = '<div class="chat-inner" id="daMsgs"></div>';
    const box = body.querySelector("#daMsgs");
    conv.messages.forEach(m => box.appendChild(buildMsg(m.role, m.content, m.time)));
    body.scrollTop = body.scrollHeight;
  }

  function setBusy(on) {
    const s = document.getElementById("daSend");
    const t = document.getElementById("daStop");
    if (s) s.style.display = on ? "none" : "flex";
    if (t) t.style.display = on ? "flex" : "none";
  }

  function render() {
    injectStyle();
    const el = host();
    if (!el) return;
    el.innerHTML = layoutHtml();
    const nw = el.querySelector("#daNew");
    if (nw) nw.onclick = () => newConv();
    const inp = el.querySelector("#daInput");
    const doSend = () => {
      if (!inp) return;
      const v = inp.value.trim();
      if (!v || state.busy) return;
      inp.value = "";
      inp.style.height = "auto";
      send(v);
    };
    const snd = el.querySelector("#daSend");
    if (snd) snd.onclick = doSend;
    const stp = el.querySelector("#daStop");
    if (stp) stp.onclick = () => stop();
    if (inp) {
      inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } };
      inp.oninput = () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 140) + "px"; };
    }
    renderList();
    renderMsgs();
    setBusy(state.busy);
  }

  /* ---------- 发送管线 ---------- */
  async function send(text) {
    text = String(text == null ? "" : text).trim();
    if (!text || state.busy) return;
    const conv = ensureConv();
    const box = msgsEl();
    if (!box) return;
    if (!conv.messages.length) conv.title = text.slice(0, 24);
    conv.messages.push({ role: "user", content: text, time: Date.now() });
    box.appendChild(buildMsg("user", text, Date.now()));
    saveConv(conv);
    renderList();
    scrollDown();

    const ag = D.agent;

    /* 画布感知：明确指令直接操作当前画布，不占用对话模型，无 Key 也能用 */
    if (ag && typeof ag.canHandle === "function" && ag.canHandle(text)) {
      const node = buildMsg("assistant", "", Date.now());
      box.appendChild(node);
      const mdEl = node.querySelector("[data-role=md]");
      let out = { reply: "" };
      try { out = (await ag.handle(text)) || out; }
      catch (e) { out = { reply: "⚠ " + ((e && e.message) || e) }; }
      if (U.renderFull) U.renderFull(mdEl, out.reply || ""); else mdEl.textContent = out.reply || "";
      conv.messages.push({ role: "assistant", content: out.reply || "", time: Date.now() });
      saveConv(conv);
      scrollDown();
      if (out && out.changed && D.manual && D.manual.refreshCanvas) { try { D.manual.refreshCanvas(); } catch (e) {} }
      return;
    }

    if (!XLX.llm || typeof XLX.llm.isConfigured !== "function" || !XLX.llm.isConfigured()) {
      toast("请先在「设置」中填写 API Key", "warn");
      return;
    }

    let sys = "";
    try { sys = (XLX.memory && XLX.memory.systemPrompt) ? XLX.memory.systemPrompt() : (XLX.DEFAULT_SYSTEM || ""); } catch (e) {}
    const canvasCtx = (ag && ag.promptContext) ? ag.promptContext() : "";
    const sysFinal = (sys ? sys + "\n\n" : "") + SYS + canvasCtx;
    const history = conv.messages.slice(0, -1).slice(-14).map(m => ({ role: m.role, content: m.content }));
    const msgs = [{ role: "system", content: sysFinal }].concat(history, [{ role: "user", content: text }]);

    const node = buildMsg("assistant", "", Date.now());
    box.appendChild(node);
    const mdEl = node.querySelector("[data-role=md]");
    scrollDown();

    state.busy = true;
    setBusy(true);
    const aborter = new AbortController();
    state.aborter = aborter;
    let finalText = "";
    try {
      if (U.mdStream) U.mdStream(mdEl); else mdEl.innerHTML = "";
      finalText = await XLX.llm.chat(msgs, {
        signal: aborter.signal,
        onDelta: (piece) => {
          if (U.appendDelta) U.appendDelta(mdEl, piece); else mdEl.textContent += piece;
          scrollDown();
        }
      });
      if (U.finalizeDelta) U.finalizeDelta(mdEl); else if (U.renderFull) U.renderFull(mdEl, finalText || "");
      conv.messages.push({ role: "assistant", content: finalText || "", time: Date.now() });
      saveConv(conv);
    } catch (e) {
      const aborted = e && e.name === "AbortError";
      if (aborted) {
        if (U.finalizeDelta) U.finalizeDelta(mdEl);
      } else if (U.renderFull) {
        U.renderFull(mdEl, "⚠ " + ((e && e.message) || e));
      } else {
        mdEl.textContent = "⚠ " + ((e && e.message) || e);
      }
      const txt = (mdEl.textContent || "").trim();
      conv.messages.push({ role: "assistant", content: txt || "（已停止）", time: Date.now() });
      saveConv(conv);
      if (!aborted) toast((e && e.message) || String(e), "err");
    }
    state.busy = false;
    state.aborter = null;
    setBusy(false);
    scrollDown();
  }

  function stop() {
    if (state.aborter) { try { state.aborter.abort(); } catch (e) {} }
  }

  /* ---------- 样式（仅作用于短剧 Agent 容器，配色沿用主题变量） ---------- */
  function injectStyle() {
    if (document.getElementById("dramaAgentStyle")) return;
    const st = document.createElement("style");
    st.id = "dramaAgentStyle";
    st.textContent = ''
      + '#dramaAgentView{flex-direction:column;min-height:0}'
      + '#dramaAgent,#dramaAgentView .da-wrap{flex:1;min-height:0;display:flex;width:100%}'
      + '.da-side{width:238px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:10px;padding:14px 12px;overflow:hidden}'
      + '.da-new{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 12px;border-radius:11px;border:none;cursor:pointer;background:var(--accent-grad);color:var(--accent-ink);font-size:13px;font-weight:600}'
      + '.da-new svg{width:16px;height:16px}'
      + '.da-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px}'
      + '.da-list-empty{font-size:12px;color:var(--text3);text-align:center;padding:18px 0}'
      + '.da-item{padding:9px 11px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:.15s}'
      + '.da-item:hover{background:var(--panel2)}'
      + '.da-item.active{background:var(--panel2);border-color:var(--accent)}'
      + '.da-item-t{font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.da-item-d{font-size:10.5px;color:var(--text3);margin-top:2px}'
      + '.da-main{flex:1;min-width:0;display:flex;flex-direction:column}'
      + '.da-body{flex:1;min-height:0;overflow-y:auto;padding:22px 24px 8px}'
      + '.da-foot{flex-shrink:0;padding:0 24px 18px}'
      + '.da-foot .chat-input-wrap{max-width:820px;margin:0 auto;width:100%}'
      + '.da-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:60%;gap:22px}'
      + '.da-hero{display:flex;flex-direction:column;align-items:center}'
      + '.da-hero-ic{width:64px;height:64px;border-radius:20px;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;margin-bottom:14px}'
      + '.da-hero-ic svg{width:34px;height:34px}'
      + '.da-hero-t{font-size:22px;font-weight:700}'
      + '.da-hero-d{font-size:12.5px;color:var(--text3);max-width:520px;margin-top:8px;line-height:1.6}'
      + '.da-stop{background:var(--red)!important;color:#fff!important}'
      + '.da-body .chat-inner{max-width:820px;margin:0 auto}'
      + '@media(max-width:820px){.da-side{display:none}.da-body{padding:16px 14px 6px}.da-foot{padding:0 14px 14px}}';
    document.head.appendChild(st);
  }

  D.dramaAgent = {
    render, send, stop, newConv, ensureConv, current, readConvs, saveConv, buildMsg,
    K_CONVS, K_CUR, state: state
  };
})();
