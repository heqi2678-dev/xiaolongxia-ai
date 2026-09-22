/* 铜龙电商 · AI 短剧工作台 · 首页（LibTV Skill 墙） */
/* 居中灵感输入 + Skill 分栏 + 分类条 + 三列 Skill 卡；提交灵感或点选 Skill 建工程并进入画布。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const K_FAV = "xlx_home_fav";
  const K_USED = "xlx_home_used";

  /* LibTV 分类条。分类过滤映射到现有技能清单的 cat 字段（需求 5.3 / 5.7） */
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
    { id: "reco", name: "推荐" },
    { id: "fav", name: "收藏" },
    { id: "mine", name: "我的" }
  ];

  const VIDEO_CATS = { video: 1, media: 1 };

  const state = { tab: "reco", cat: "reco", q: "", busy: false };

  function view() { return document.getElementById("dramaHome"); }

  const CSS = `
.hs-wrap{max-width:1080px;margin:0 auto;padding:26px 16px 60px;width:100%;display:flex;flex-direction:column;align-items:center}
.hs-title{font-size:30px;font-weight:800;letter-spacing:1px;text-align:center;margin:18px 0 6px;background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.hs-sub{font-size:12.5px;color:var(--text3);margin-bottom:22px}
.hs-inputbox{width:100%;max-width:760px;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:12px 14px;transition:border-color .15s}
.hs-inputbox:focus-within{border-color:var(--accent)}
.hs-inputbox textarea{width:100%;background:none;border:none;outline:none;color:var(--text);font-size:14px;resize:none;min-height:56px;line-height:1.6;font-family:inherit}
.hs-inputfoot{display:flex;align-items:center;gap:6px;margin-top:8px}
.hs-icbtn{width:32px;height:32px;border-radius:9px;border:1px solid var(--border);background:var(--card);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,color .15s}
.hs-icbtn:hover{border-color:var(--accent);color:var(--accent2)}
.hs-spacer{flex:1}
.hs-send{width:36px;height:36px;border-radius:11px;border:none;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;cursor:pointer}
.hs-send:disabled{opacity:.5;cursor:default}
.hs-tabs{display:flex;gap:22px;margin:26px 0 14px}
.hs-tab{font-size:14px;color:var(--text3);cursor:pointer;padding-bottom:6px;border-bottom:2px solid transparent}
.hs-tab.on{color:var(--text);border-bottom-color:var(--accent)}
.hs-filterbar{width:100%;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.hs-cats{display:flex;gap:8px;flex-wrap:wrap;flex:1}
.hs-cat{border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:999px;padding:5px 13px;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}
.hs-cat:hover{border-color:var(--accent);color:var(--text)}
.hs-cat.on{border-color:var(--accent);color:var(--accent2);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.hs-search{display:flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:0 12px;height:32px}
.hs-search input{background:none;border:none;outline:none;color:var(--text);font-size:12.5px;width:130px}
.hs-grid{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@media(max-width:820px){.hs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.hs-grid{grid-template-columns:1fr}}
.hs-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column}
.hs-card:hover{border-color:var(--accent);transform:translateY(-3px)}
.hs-thumb{position:relative;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hs-thumb .hs-tic{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28)}
.hs-thumb .hs-tic svg{width:23px;height:23px}
.hs-badge{position:absolute;left:9px;bottom:9px;font-size:10.5px;padding:2px 8px;border-radius:6px;background:rgba(0,0,0,.55);color:#fff}
.hs-fav{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s}
.hs-card:hover .hs-fav{opacity:1}
.hs-fav.on{opacity:1;color:#f5c451}
.hs-cbody{padding:11px 12px 12px;display:flex;flex-direction:column;gap:5px}
.hs-cname{font-size:13.5px;font-weight:700}
.hs-cdesc{font-size:11.5px;color:var(--text3);line-height:1.6;min-height:34px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hs-cfoot{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px;border-top:1px solid var(--border);padding-top:8px;margin-top:2px}
.hs-avatar{width:16px;height:16px;border-radius:50%;background:var(--accent-grad);flex:none}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaHomeWallCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function readArr(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeArr(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }
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

  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:' + (size || 16) + "px;height:" + (size || 16) + 'px">' + ((XLX.ICONS && XLX.ICONS[name]) || "") + '</svg>';
  }

  function catColor(cat) {
    const c = (XLX.CATS || []).find(x => x.id === cat);
    return c ? c.color : "#38d9e6";
  }

  function skillList() {
    let list = (XLX.SKILLS || []).slice();
    const cat = CATS.find(c => c.id === state.cat);
    if (cat && cat.match) list = list.filter(s => cat.match.indexOf(s.cat) >= 0);
    if (state.tab === "fav") list = list.filter(s => isFav(s.id));
    if (state.tab === "mine") {
      const used = readArr(K_USED);
      list = list.filter(s => used.indexOf(s.id) >= 0);
    }
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(s => (String(s.name) + " " + String(s.desc || "")).toLowerCase().indexOf(q) >= 0);
    return list;
  }

  function hero() {
    return '<div class="hs-title">今天想做点什么？</div>' +
      '<div class="hs-sub">一句话或一个 Skill，直接开一部片</div>' +
      '<div class="hs-inputbox">' +
        '<textarea id="hsInput" rows="2" placeholder="描述你的灵感，例如：一个关于外卖小哥逆袭成短剧导演的15秒爽片"></textarea>' +
        '<div class="hs-inputfoot">' +
          '<button class="hs-icbtn" title="附件">' + svg("plus", 15) + "</button>" +
          '<button class="hs-icbtn" title="模型">' + svg("sparkle", 15) + "</button>" +
          '<button class="hs-icbtn" title="文档">' + svg("book", 15) + "</button>" +
          '<button class="hs-icbtn" title="图片">' + svg("palette", 15) + "</button>" +
          '<span class="hs-spacer"></span>' +
          '<button class="hs-send" id="hsSend" title="开始创作">' + svg("arrow", 17) + "</button>" +
        "</div>" +
      "</div>";
  }

  function tabs() {
    return '<div class="hs-tabs">' + TABS.map(t =>
      '<div class="hs-tab' + (state.tab === t.id ? " on" : "") + '" data-hs-tab="' + t.id + '">' + D.ui.esc(t.name) + "</div>"
    ).join("") + "</div>";
  }

  function filterBar() {
    return '<div class="hs-filterbar">' +
      '<div class="hs-cats">' + CATS.map(c =>
        '<button class="hs-cat' + (state.cat === c.id ? " on" : "") + '" data-hs-cat="' + c.id + '">' + D.ui.esc(c.name) + "</button>"
      ).join("") + "</div>" +
      '<div class="hs-search">' + svg("search", 13) +
        '<input id="hsQ" placeholder="搜索 Skill" value="' + D.ui.esc(state.q) + '">' +
      "</div>" +
    "</div>";
  }

  function card(s) {
    const color = catColor(s.cat);
    const video = !!VIDEO_CATS[s.cat];
    return '<div class="hs-card" data-hs-skill="' + D.ui.esc(s.id) + '">' +
      '<div class="hs-thumb" style="background:linear-gradient(135deg,' + color + '33,' + color + '0d)">' +
        '<span class="hs-tic" style="color:' + color + '">' + svg(s.icon, 23) + "</span>" +
        '<span class="hs-badge">' + (video ? "视频" : "图片") + "</span>" +
        '<button class="hs-fav' + (isFav(s.id) ? " on" : "") + '" data-hs-fav="' + D.ui.esc(s.id) + '">' +
          '<svg viewBox="0 0 24 24" fill="' + (isFav(s.id) ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9z"/></svg>' +
        "</button>" +
      "</div>" +
      '<div class="hs-cbody">' +
        '<div class="hs-cname">' + D.ui.esc(s.name) + "</div>" +
        '<div class="hs-cdesc">' + D.ui.esc(s.desc || "") + "</div>" +
        '<div class="hs-cfoot"><span class="hs-avatar"></span><span>' + D.ui.esc(s.author || "铜龙电商官方") + "</span></div>" +
      "</div>" +
    "</div>";
  }

  function grid() {
    const list = skillList();
    if (!list.length) {
      return D.ui.emptyBox(state.tab === "fav" ? "还没有收藏的 Skill，点卡片右上角星标收藏。"
        : state.tab === "mine" ? "还没有用过 Skill，从下方挑一个开始吧。"
        : "没有匹配的 Skill，换个关键词试试。");
    }
    return '<div class="hs-grid">' + list.map(card).join("") + "</div>";
  }

  async function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    v.innerHTML = '<div class="hs-wrap">' + hero() + tabs() + filterBar() + '<div id="hsGrid" style="width:100%">' + grid() + "</div></div>";
    bind(v);
  }

  function bind(v) {
    const send = v.querySelector("#hsSend");
    if (send) send.onclick = submit;
    const inp = v.querySelector("#hsInput");
    if (inp) inp.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } };
    const q = v.querySelector("#hsQ");
    if (q) q.oninput = (e) => { state.q = e.target.value; rerenderGrid(); };
    v.querySelectorAll("[data-hs-tab]").forEach(t => { t.onclick = () => { state.tab = t.dataset.hsTab; render(); }; });
    v.querySelectorAll("[data-hs-cat]").forEach(c => { c.onclick = () => { state.cat = c.dataset.hsCat; render(); }; });
    bindCards(v);
  }

  function bindCards(root) {
    root.querySelectorAll("[data-hs-fav]").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        toggleFav(b.dataset.hsFav);
        rerenderGrid();
      };
    });
    root.querySelectorAll("[data-hs-skill]").forEach(c => {
      c.onclick = () => {
        const s = XLX.getSkill ? XLX.getSkill(c.dataset.hsSkill) : null;
        if (s) openSkill(s);
      };
    });
  }

  function rerenderGrid() {
    const v = view();
    if (!v) return;
    const box = v.querySelector("#hsGrid");
    if (!box) return;
    box.innerHTML = grid();
    bindCards(box);
  }

  function submit() {
    const v = view();
    if (!v) return;
    const inp = v.querySelector("#hsInput");
    const text = inp ? inp.value.trim() : "";
    if (!text) { U.toast("先写下你的灵感", "warn"); return; }
    startBlank(text);
  }

  /* 点选 Skill：建工程 + 铺首节点 + 进入画布（需求 5.6 / D7） */
  async function openSkill(skill) {
    if (!skill) return;
    if (XLX.billing && XLX.billing.check) {
      const chk = XLX.billing.check(skill);
      if (!chk.ok) { U.toast(chk.reason, "warn"); return; }
    }
    if (state.busy) return;
    if (skill.action === "tool" && skill.tool) {
      if (XLX.app && XLX.app.go) XLX.app.go("tools");
      setTimeout(() => { if (XLX.tools && XLX.tools.openTool) XLX.tools.openTool(skill.tool); }, 80);
      return;
    }
    state.busy = true;
    try {
      markUsed(skill.id);
      const p = D.project.blank({ title: skill.name + "·" + new Date().toLocaleDateString(), genre: skill.cat === "video" ? "realistic" : "comic" });
      const F = fillPrompt(skill, "");
      const textNode = D.canvas.addNode(p, "text", 60, 120, { text: F, title: skill.name });
      const gen = buildGenChain(p, skill, textNode.id);
      await D.project.save(p);
      await enterCanvas(p.id);
      kickGenerate(p, gen);
    } catch (e) {
      U.toast((e && e.message) || "启动创作失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function startBlank(text) {
    if (state.busy) return;
    state.busy = true;
    try {
      const title = text.length > 16 ? text.slice(0, 16) + "…" : text;
      const p = D.project.blank({ title: title || "未命名项目" });
      D.canvas.addNode(p, "text", 60, 120, { text: text, title: "灵感" });
      await D.project.save(p);
      await enterCanvas(p.id);
    } catch (e) {
      U.toast((e && e.message) || "新建失败", "err");
    } finally {
      state.busy = false;
    }
  }

  /* 按 Skill 生成下游节点：影视/设计类追加图片节点，串到文本节点后 */
  function buildGenChain(p, skill, fromId) {
    const video = !!VIDEO_CATS[skill.cat];
    const n = D.canvas.addNode(p, "image", 420, 120, {
      prompt: "",
      ratio: (p.output && p.output.ratio) || "9:16",
      title: skill.name
    });
    try { D.canvas.addEdge(p, fromId, n.id); } catch (e) {}
    return { id: n.id, video };
  }

  function kickGenerate(p, gen) {
    if (!gen) return;
    if (!D.isConfigured || !D.isConfigured("image")) return;
    setTimeout(async () => {
      try {
        await D.canvas.runNode(p, gen.id, {});
        await D.project.save(p);
        if (D.manual && D.manual.state && D.manual.state.pid === p.id && D.manual.render) D.manual.render();
      } catch (e) {}
    }, 300);
  }

  async function enterCanvas(pid) {
    if (D.manual && D.manual.load) await D.manual.load(pid);
    if (XLX.app && XLX.app.go) XLX.app.go("drama");
  }

  function fillPrompt(skill, input) {
    let s = String(skill.prompt || "").replace(/\{input\}/g, input || "（待补充）");
    if (input && s.indexOf(input) < 0 && !skill.prompt) s = skill.name + "：" + input;
    return s || (skill.name + (input ? "：" + input : ""));
  }

  D.home = { render, openSkill, state };
})();
