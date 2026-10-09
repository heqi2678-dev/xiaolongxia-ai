/* 短剧 Agent：AI 短剧工作台的独立智能体入口。
 * 结构对齐 LibTV 首页：大标题 + 想法输入框 + Skill/收藏/我的 + 分类 pills + 技能卡网格。
 * 不再保留左侧对话列表与消息流；配色沿用工作台主题变量，不覆盖主题色。
 * 与「日常ai助手 Agent」相互独立：独立存储键、独立收藏，不写入通用对话历史。
 * 需要感知当前画布：明确的画布指令直接落到 XLX.drama.agent，不占用对话。 */
(function () {
  const D = XLX.drama = XLX.drama || {};
  const U = XLX.util || {};
  const K_FAV = "xlx_drama_agent_fav";
  const K_USED = "xlx_drama_agent_used";

  /* 分类 pills：与 LibTV 首页一致，映射到技能清单的 cat 字段 */
  const CATS = [
    { id: "reco", name: "推荐", match: null },
    { id: "film", name: "专业影视", match: ["video"] },
    { id: "ad", name: "商业广告", match: ["design", "ecom"] },
    { id: "drama", name: "短剧漫剧", match: ["video", "media"] },
    { id: "anime", name: "动漫游戏", match: ["design"] },
    { id: "mv", name: "音乐MV", match: ["media"] },
    { id: "creator", name: "自媒体创作", match: ["media"] },
    { id: "general", name: "通用技能", match: ["office", "dev"] },
    { id: "discover", name: "发现", match: null }
  ];

  const TABS = [
    { id: "skill", name: "Skill" },
    { id: "fav", name: "收藏" },
    { id: "mine", name: "我的" }
  ];

  const VIDEO_CATS = { video: 1, media: 1 };

  const state = { tab: "skill", cat: "reco", q: "", busy: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function icon(n, size) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:' + (size || 18) + "px;height:" + (size || 18) + 'px">'
      + ((XLX.ICONS && XLX.ICONS[n]) || "") + '</svg>';
  }
  function toast(msg, type) { if (U.toast) U.toast(msg, type); }

  /* ---------- 存储（独立于通用对话 xlx_conversations） ---------- */
  function readArr(key) {
    try { const a = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeArr(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function favorites() { return readArr(K_FAV); }
  function isFav(id) { return favorites().indexOf(id) >= 0; }
  function toggleFav(id) {
    let list = favorites();
    if (list.indexOf(id) >= 0) list = list.filter(x => x !== id);
    else list.push(id);
    writeArr(K_FAV, list);
    return list.indexOf(id) >= 0;
  }
  function markUsed(id) {
    const list = readArr(K_USED);
    if (list.indexOf(id) < 0) { list.push(id); writeArr(K_USED, list); }
  }

  /* ---------- 技能数据 ---------- */
  function allSkills() { return (D.skill && D.skill.all ? D.skill.all() : (XLX.SKILLS || [])).slice(); }
  function catColor(cat) { const c = (XLX.CATS || []).find(x => x.id === cat); return c ? c.color : "#4aa8ff"; }

  function skillKind(s) {
    if (D.skill && D.skill.kind) return D.skill.kind(s);
    if (!s) return { id: "chat", label: "对话" };
    if (s.action === "tool") return { id: "tool", label: "工具" };
    if (s.action === "search") return { id: "search", label: "搜索" };
    if (s.action === "chat") return { id: "chat", label: "对话" };
    return { id: "gen", label: VIDEO_CATS[s.cat] ? "视频" : "图片" };
  }

  function skillList() {
    let list = allSkills();
    const cat = CATS.find(c => c.id === state.cat);
    if (cat && cat.match) list = list.filter(s => cat.match.indexOf(s.cat) >= 0);
    if (state.tab === "fav") list = list.filter(s => isFav(s.id));
    if (state.tab === "mine") {
      const used = readArr(K_USED);
      list = list.filter(s => used.indexOf(s.id) >= 0 || s.custom);
    }
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(s => (String(s.name) + " " + String(s.desc || "")).toLowerCase().indexOf(q) >= 0);
    return list;
  }

  /* ---------- DOM ---------- */
  function host() { return document.getElementById("dramaAgent"); }

  function layoutHtml() {
    return ''
      + '<div class="da-wrap">'
      +   '<div class="da-hero">'
      +     '<div class="da-hero-ic">' + icon("film", 34) + '</div>'
      +     '<div class="da-hero-t">说个想法。或者，选个 Skill</div>'
      +     '<div class="da-hero-d">短剧创作智能体 · 一句话起剧 · 分幕大纲 · 人物小传 · 分镜脚本 · 台词润色 · 画面提示词</div>'
      +   '</div>'
      +   '<div class="da-inputbox">'
      +     '<textarea id="daInput" rows="2" placeholder="描述你想拍的短剧，例如：一个外卖员穿越到古代当皇帝；也可以直接说画布操作，例如「加一个 5 秒的雨夜镜头」"></textarea>'
      +     '<div class="da-inputfoot">'
      +       '<button class="da-icbtn" title="附件">' + icon("plus", 15) + "</button>"
      +       '<button class="da-icbtn" title="模型">' + icon("sparkle", 15) + "</button>"
      +       '<button class="da-icbtn" title="文档">' + icon("book", 15) + "</button>"
      +       '<button class="da-icbtn" title="图片">' + icon("palette", 15) + "</button>"
      +       '<span class="da-spacer"></span>'
      +       '<button class="da-send" id="daSend" title="开始创作">' + icon("arrow", 17) + "</button>"
      +     "</div>"
      +   "</div>"
      +   '<div class="da-tabs">' + TABS.map(t =>
            '<div class="da-tab' + (state.tab === t.id ? " on" : "") + '" data-da-tab="' + t.id + '">' + esc(t.name) + "</div>"
          ).join("") + "</div>"
      +   '<div class="da-filterbar">'
      +     '<div class="da-cats">' + CATS.map(c =>
              '<button class="da-cat' + (state.cat === c.id ? " on" : "") + '" data-da-cat="' + c.id + '">' + esc(c.name) + "</button>"
            ).join("") + "</div>"
      +     '<div class="da-search">' + icon("search", 13) + '<input id="daQ" placeholder="搜索 Skill" value="' + esc(state.q) + '"></div>'
      +   "</div>"
      +   '<div class="da-grid" id="daGrid" style="width:100%">' + grid() + "</div>"
      + "</div>";
  }

  function card(s) {
    const color = catColor(s.cat);
    const kind = skillKind(s);
    const thumb = (XLX.skillThumb ? XLX.skillThumb(s) : "");
    const media = thumb
      ? '<img class="da-img" src="' + esc(thumb) + '" alt="" loading="lazy">'
      : '<span class="da-tic" style="color:' + color + '">' + icon(s.icon, 23) + "</span>";
    const isVideo = kind.id === "gen" && VIDEO_CATS[s.cat];
    return '<div class="da-card" data-da-skill="' + esc(s.id) + '">'
      + '<div class="da-thumb' + (thumb ? " has-img" : "") + '" style="background:linear-gradient(135deg,' + color + '33,' + color + '0d)">'
      +   media
      +   (isVideo ? '<span class="da-play">' + icon("play", 16) + "</span>" : "")
      +   '<span class="da-badge">' + kind.label + "</span>"
      +   '<button class="da-fav' + (isFav(s.id) ? " on" : "") + '" data-da-fav="' + esc(s.id) + '">'
      +     '<svg viewBox="0 0 24 24" fill="' + (isFav(s.id) ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9z"/></svg>'
      +   "</button>"
      + "</div>"
      + '<div class="da-cbody">'
      +   '<div class="da-cname">' + esc(s.name) + "</div>"
      +   '<div class="da-cdesc">' + esc(s.desc || "") + "</div>"
      +   '<div class="da-cfoot"><span class="da-avatar"></span><span>' + esc(s.author || "铜龙电商ai助手官方") + "</span></div>"
      + "</div>"
      + "</div>";
  }

  function grid() {
    const list = skillList();
    if (!list.length) {
      const msg = state.tab === "fav" ? "还没有收藏的 Skill，点卡片右上角星标收藏。"
        : state.tab === "mine" ? "还没有用过 Skill，挑一个开始创作吧。"
        : "没有匹配的 Skill，换个关键词试试。";
      return '<div class="da-empty-note">' + esc(msg) + "</div>";
    }
    return list.map(card).join("");
  }

  function render() {
    injectStyle();
    const el = host();
    if (!el) return;
    el.innerHTML = layoutHtml();
    bind(el);
    const inp = el.querySelector("#daInput");
    if (inp) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 0);
  }

  function bind(root) {
    const send = root.querySelector("#daSend");
    if (send) send.onclick = () => {
      const inp = root.querySelector("#daInput");
      if (!inp) return;
      const v = inp.value.trim();
      if (!v) { toast("先写下你的想法", "warn"); return; }
      inp.value = "";
      start(v);
    };
    const inp = root.querySelector("#daInput");
    if (inp) inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (send) send.onclick(); } };
    const q = root.querySelector("#daQ");
    if (q) q.oninput = e => { state.q = e.target.value; rerenderGrid(); };
    root.querySelectorAll("[data-da-tab]").forEach(t => { t.onclick = () => { state.tab = t.dataset.daTab; render(); }; });
    root.querySelectorAll("[data-da-cat]").forEach(c => { c.onclick = () => { state.cat = c.dataset.daCat; render(); }; });
    bindCards(root);
  }

  function bindCards(root) {
    root.querySelectorAll("[data-da-fav]").forEach(b => {
      b.onclick = e => { e.stopPropagation(); toggleFav(b.dataset.daFav); rerenderGrid(); };
    });
    root.querySelectorAll("[data-da-skill]").forEach(c => {
      c.onclick = () => {
        const s = XLX.getSkill ? XLX.getSkill(c.dataset.daSkill) : allSkills().find(x => x.id === c.dataset.daSkill);
        if (!s) return;
        markUsed(s.id);
        if (D.toolkit && D.toolkit.openSkill) D.toolkit.openSkill(s);
        else if (D.skill && D.skill.run) D.skill.run(s, "", { generate: true });
      };
    });
  }

  function rerenderGrid() {
    const el = host();
    if (!el) return;
    const box = el.querySelector("#daGrid");
    if (!box) return;
    box.innerHTML = grid();
    bindCards(box);
  }

  /* ---------- 发送：画布指令直连；否则把想法落成画布工程 ---------- */
  async function start(text) {
    text = String(text == null ? "" : text).trim();
    if (!text || state.busy) return;
    const ag = D.agent;
    if (ag && typeof ag.canHandle === "function" && ag.canHandle(text)) {
      try {
        const out = (await ag.handle(text)) || {};
        toast(out.reply || "已按指令更新画布", "ok");
        if (out && out.changed && D.manual && D.manual.refreshCanvas) { try { D.manual.refreshCanvas(); } catch (e) {} }
      } catch (e) { toast((e && e.message) || "画布操作失败", "err"); }
      return;
    }
    await startFromIdea(text);
  }

  async function startFromIdea(text) {
    if (!(D.project && D.project.blank)) { toast("请先进入短剧工作台新建工程", "warn"); return; }
    if (state.busy) return;
    state.busy = true;
    try {
      const title = text.length > 16 ? text.slice(0, 16) + "…" : text;
      const p = D.project.blank({ title: title || "未命名项目" });
      if (D.canvas && D.canvas.addNode) D.canvas.addNode(p, "text", 60, 120, { text: text, title: "灵感" });
      await D.project.save(p);
      if (D.manual && D.manual.load) await D.manual.load(p.id);
      if (XLX.app && XLX.app.go) XLX.app.go("drama");
    } catch (e) {
      toast((e && e.message) || "启动创作失败", "err");
    } finally {
      state.busy = false;
    }
  }

  function stop() { state.busy = false; }

  /* 兼容旧入口：回到首屏（清空搜索与分类） */
  function newConv() {
    state.q = "";
    state.tab = "skill";
    state.cat = "reco";
    render();
  }

  /* ---------- 样式（仅作用于短剧 Agent 容器，配色沿用主题变量） ---------- */
  function injectStyle() {
    if (document.getElementById("dramaAgentStyle")) return;
    const st = document.createElement("style");
    st.id = "dramaAgentStyle";
    st.textContent = ''
      + '#dramaAgentView{flex-direction:column;min-height:0}'
      + '#dramaAgent{flex:1;min-height:0;width:100%;overflow-y:auto}'
      + '.da-wrap{max-width:1080px;margin:0 auto;padding:40px 16px 60px;width:100%;display:flex;flex-direction:column;align-items:center}'
      + '.da-hero{display:flex;flex-direction:column;align-items:center;text-align:center;margin:10px 0 20px}'
      + '.da-hero-ic{width:64px;height:64px;border-radius:20px;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;margin-bottom:14px}'
      + '.da-hero-t{font-size:28px;font-weight:800;letter-spacing:.5px}'
      + '.da-hero-d{font-size:12.5px;color:var(--text3);max-width:560px;margin-top:8px;line-height:1.6}'
      + '.da-inputbox{width:100%;max-width:760px;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:12px 14px;transition:border-color .15s}'
      + '.da-inputbox:focus-within{border-color:var(--accent)}'
      + '.da-inputbox textarea{width:100%;background:none;border:none;outline:none;color:var(--text);font-size:14px;resize:none;min-height:56px;line-height:1.6;font-family:inherit}'
      + '.da-inputfoot{display:flex;align-items:center;gap:6px;margin-top:8px}'
      + '.da-icbtn{width:32px;height:32px;border-radius:9px;border:1px solid var(--border);background:var(--card);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,color .15s}'
      + '.da-icbtn:hover{border-color:var(--accent);color:var(--accent2)}'
      + '.da-spacer{flex:1}'
      + '.da-send{width:36px;height:36px;border-radius:50%;border:none;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;cursor:pointer}'
      + '.da-tabs{display:flex;gap:22px;margin:26px 0 14px}'
      + '.da-tab{font-size:14px;color:var(--text3);cursor:pointer;padding-bottom:6px;border-bottom:2px solid transparent}'
      + '.da-tab.on{color:var(--text);border-bottom-color:var(--accent)}'
      + '.da-filterbar{width:100%;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}'
      + '.da-cats{display:flex;gap:8px;flex-wrap:wrap;flex:1}'
      + '.da-cat{border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:999px;padding:5px 13px;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}'
      + '.da-cat:hover{border-color:var(--accent);color:var(--text)}'
      + '.da-cat.on{border-color:var(--accent);color:var(--accent2);background:color-mix(in srgb,var(--accent) 12%,transparent)}'
      + '.da-search{display:flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:0 12px;height:32px}'
      + '.da-search input{background:none;border:none;outline:none;color:var(--text);font-size:12.5px;width:130px}'
      + '.da-grid{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}'
      + '@media(max-width:820px){.da-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
      + '@media(max-width:560px){.da-grid{grid-template-columns:1fr}}'
      + '@media(max-width:600px){.da-wrap{padding:20px 12px 46px}.da-hero-t{font-size:21px}.da-search input{width:96px}}'
      + '.da-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column}'
      + '.da-card:hover{border-color:var(--accent);transform:translateY(-3px)}'
      + '.da-thumb{position:relative;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;overflow:hidden}'
      + '.da-thumb .da-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}'
      + '.da-card:hover .da-thumb .da-img{transform:scale(1.06)}'
      + '.da-thumb.has-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.42))}'
      + '.da-thumb .da-tic{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28)}'
      + '.da-badge{position:absolute;left:9px;bottom:9px;font-size:10.5px;padding:2px 8px;border-radius:6px;background:rgba(0,0,0,.62);color:#fff;z-index:2;backdrop-filter:blur(2px)}'
      + '.da-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;color:#fff;z-index:2;pointer-events:none}'
      + '.da-fav{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s;z-index:2}'
      + '.da-card:hover .da-fav{opacity:1}'
      + '.da-fav.on{opacity:1;color:#f5c451}'
      + '.da-cbody{padding:11px 12px 12px;display:flex;flex-direction:column;gap:5px}'
      + '.da-cname{font-size:13.5px;font-weight:700}'
      + '.da-cdesc{font-size:11.5px;color:var(--text3);line-height:1.6;min-height:34px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
      + '.da-cfoot{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px;border-top:1px solid var(--border);padding-top:8px;margin-top:2px}'
      + '.da-avatar{width:16px;height:16px;border-radius:50%;background:var(--accent-grad);flex:none}'
      + '.da-empty-note{width:100%;text-align:center;color:var(--text3);font-size:13px;padding:36px 0}';
    document.head.appendChild(st);
  }

  D.dramaAgent = {
    render, start, send: start, stop, newConv,
    skillList, skillKind, state: state,
    K_FAV, K_USED
  };
})();
