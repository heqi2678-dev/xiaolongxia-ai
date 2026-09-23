/* 铜龙电商 · AI 短剧工作台 · 首页（LibTV 形态） */
/* 新建画布大框 + 一排创作模型/工具卡（含「更多功能」）+ 最近项目 + 最近上新（5 张独家技能卡）+ 成片库横幅。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  /* 固定工具卡（无模型绑定）：与模型卡拼在同一行 */
  const TOOL_FIXED = [
    { id: "audio", name: "音频生成", node: "audio", icon: "mic" },
    { id: "script", name: "剧本生成", node: "script", icon: "book" },
    { id: "edit", name: "智能剪辑", node: "video", icon: "wand" },
    { id: "more", name: "更多功能", node: "", icon: "grid" }
  ];

  /* 模型卡：从短剧服务目录（config.js 的 IMAGE/VIDEO_PROVIDERS）读取，点哪张卡就把该模型写进新工程并切换服务 */
  function modelTools() {
    const out = [];
    ["image", "video"].forEach(kind => {
      let list = [];
      try { list = D.adapterList(kind) || []; } catch (e) { list = []; }
      list.forEach(def => {
        if (!def || !def.id || def.id.indexOf("custom") === 0) return;
        const models = (def.models && def.models.length) ? def.models : (def.model ? [def.model] : []);
        if (!models.length && def.free) { models.push(""); }
        models.forEach(m => out.push({
          id: def.id + "::" + m,
          name: m || def.name,
          sub: def.name,
          kind,
          provider: def.id,
          model: m || "",
          node: kind,
          icon: kind === "image" ? "image" : "video"
        }));
      });
    });
    return out;
  }

  function tools() { return modelTools().concat(TOOL_FIXED); }

  /* 首页「最近上新」展示的独家技能（按 id 取内置技能卡） */
  const FEATURED = ["director-shots", "script-studio", "title-intro"];

  const state = { busy: false };

  function view() { return document.getElementById("dramaHome"); }

  const CSS = `
.hx-wrap{max-width:1080px;margin:0 auto;padding:26px 16px 60px;width:100%;display:flex;flex-direction:column;gap:26px}
.hx-hero{width:100%;border:1.5px dashed var(--border);border-radius:18px;min-height:172px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 8%,transparent),transparent);transition:border-color .15s,background .15s}
.hx-hero:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.hx-hero .hx-plus{width:52px;height:52px;border-radius:16px;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center}
.hx-hero .hx-plus svg{width:26px;height:26px}
.hx-hero .hx-ht{font-size:17px;font-weight:800}
.hx-hero .hx-hd{font-size:12.5px;color:var(--text3)}
.hx-sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
.hx-sec-h h2{font-size:16px;font-weight:800;margin:0}
.hx-sec-h .hx-more{margin-left:auto;font-size:12px;color:var(--text3);cursor:pointer}
.hx-sec-h .hx-more:hover{color:var(--accent2)}
.hx-tools{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.hx-tool{flex:0 0 186px;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .15s,transform .15s}
@media(max-width:560px){.hx-tool{flex-basis:156px}}
.hx-tool:hover{border-color:var(--accent);transform:translateY(-3px)}
.hx-tool .hx-tic{width:38px;height:38px;border-radius:11px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent2);display:flex;align-items:center;justify-content:center;flex:none}
.hx-tool .hx-tic svg{width:20px;height:20px}
.hx-tool .hx-tinfo{display:flex;flex-direction:column;gap:2px;min-width:0}
.hx-tool .hx-tn{font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hx-tool .hx-ts{font-size:10.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hx-projs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media(max-width:820px){.hx-projs{grid-template-columns:repeat(2,minmax(0,1fr))}}
.hx-proj{background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
.hx-proj:hover{border-color:var(--accent);transform:translateY(-3px)}
.hx-proj .hx-cover{aspect-ratio:16/9;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 22%,transparent),transparent);display:flex;align-items:center;justify-content:center;color:var(--accent2)}
.hx-proj .hx-cover svg{width:24px;height:24px}
.hx-proj .hx-pb{padding:9px 11px 11px}
.hx-proj .hx-pn{font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hx-proj .hx-pm{font-size:10.5px;color:var(--text3);margin-top:3px}
.hx-new{grid-column:span 4}
.hx-newcard{width:100%;background:var(--panel);border:1px solid var(--border);border-radius:16px;min-height:170px;display:flex;align-items:center;gap:22px;padding:20px;cursor:pointer;transition:border-color .15s,transform .15s}
.hx-newcard:hover{border-color:var(--accent);transform:translateY(-2px)}
.hx-newcard .hx-ncover{width:230px;aspect-ratio:16/9;border-radius:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 30%,transparent),color-mix(in srgb,#a78bfa 26%,transparent));flex:none;display:flex;align-items:center;justify-content:center;color:var(--accent-ink)}
.hx-newcard .hx-ncover svg{width:30px;height:30px}
.hx-newcard .hx-nt{font-size:16px;font-weight:800;margin-bottom:6px}
.hx-newcard .hx-nd{font-size:12.5px;color:var(--text3);line-height:1.7}
.hx-skills{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
@media(max-width:980px){.hx-skills{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:560px){.hx-skills{grid-template-columns:repeat(2,minmax(0,1fr))}}
.hx-skill{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
.hx-skill:hover{border-color:var(--accent);transform:translateY(-3px)}
.hx-skill .hx-sc{aspect-ratio:16/10;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 24%,transparent),color-mix(in srgb,#a78bfa 20%,transparent));display:flex;align-items:center;justify-content:center;color:var(--accent2)}
.hx-skill .hx-sc svg{width:26px;height:26px}
.hx-skill .hx-sb{padding:9px 11px 11px}
.hx-skill .hx-sn{font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hx-skill .hx-sd{font-size:10.5px;color:var(--text3);margin-top:3px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hx-skill .hx-snew{position:absolute;top:8px;left:8px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--accent-grad);color:var(--accent-ink)}
.hx-banner{display:flex;align-items:center;gap:18px;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;cursor:pointer;transition:border-color .15s,transform .15s}
.hx-banner:hover{border-color:var(--accent);transform:translateY(-2px)}
.hx-banner .hx-bic{width:48px;height:48px;border-radius:14px;background:var(--accent-grad);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;flex:none}
.hx-banner .hx-bic svg{width:24px;height:24px}
.hx-banner .hx-bt{font-size:15px;font-weight:800;margin-bottom:4px}
.hx-banner .hx-bd{font-size:12.5px;color:var(--text3);line-height:1.65}
.hx-banner .hx-bgo{margin-left:auto;font-size:12px;color:var(--accent2);white-space:nowrap}
@media(max-width:640px){
  .hx-wrap{padding:18px 12px 46px;gap:20px}
  .hx-hero{min-height:140px}
  .hx-newcard{flex-direction:column;align-items:flex-start;gap:14px}
  .hx-newcard .hx-ncover{width:100%}
}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaHomeCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:' + (size || 16) + "px;height:" + (size || 16) + 'px">' + ((XLX.ICONS && XLX.ICONS[name]) || "") + '</svg>';
  }

  function heroHtml() {
    return '<div class="hx-hero" id="hxCreate">' +
      '<span class="hx-plus">' + svg("plus", 26) + "</span>" +
      '<div class="hx-ht">新建画布创作</div>' +
      '<div class="hx-hd">从一句灵感开始，节点式自由掌控每一帧</div>' +
    "</div>";
  }

  function toolsHtml() {
    return '<div class="hx-sec"><div class="hx-sec-h"><h2>开始创作</h2><span style="font-size:12px;color:var(--text3)">选一个模型或工具，直接开画布</span></div>' +
      '<div class="hx-tools">' + tools().map(t =>
        '<div class="hx-tool" data-hx-tool="' + D.ui.esc(t.id) + '" data-hx-node="' + D.ui.esc(t.node) + '" data-hx-name="' + D.ui.esc(t.name) + '"'
        + (t.kind ? ' data-hx-kind="' + D.ui.esc(t.kind) + '" data-hx-provider="' + D.ui.esc(t.provider) + '" data-hx-model="' + D.ui.esc(t.model) + '"' : "") + '>' +
          '<span class="hx-tic">' + svg(t.icon, 20) + "</span>" +
          '<span class="hx-tinfo"><span class="hx-tn">' + D.ui.esc(t.name) + "</span>" +
            (t.sub ? '<span class="hx-ts">' + D.ui.esc(t.sub) + "</span>" : "") + "</span>" +
        "</div>"
      ).join("") + "</div></div>";
  }

  function projectsHtml() {
    let list = [];
    try { list = (D.project.list() || []).slice(0, 4); } catch (e) { list = []; }
    const body = list.length
      ? '<div class="hx-projs">' + list.map(p =>
          '<div class="hx-proj" data-hx-proj="' + D.ui.esc(p.id) + '">' +
            '<div class="hx-cover">' + svg("film", 24) + "</div>" +
            '<div class="hx-pb"><div class="hx-pn">' + D.ui.esc(p.title || "未命名工程") + "</div>" +
              '<div class="hx-pm">画布 · ' + (p.shots ? p.shots.length : 0) + " 分镜</div></div>" +
          "</div>"
        ).join("") + "</div>"
      : D.ui.emptyBox("还没有项目，点上方「新建画布创作」开始。");
    return '<div class="hx-sec"><div class="hx-sec-h"><h2>最近项目</h2><span class="hx-more" id="hxMore">查看全部</span></div>' + body + "</div>";
  }

  function featuredSkills() {
    let all = [];
    try { all = (D.skill && D.skill.all && D.skill.all()) || []; } catch (e) { all = []; }
    const picked = FEATURED.map(id => all.find(s => s.id === id)).filter(Boolean);
    if (picked.length) return picked;
    return all.slice(0, 5);
  }

  function releasesHtml() {
    const list = featuredSkills().slice(0, 5);
    const body = list.length
      ? '<div class="hx-skills">' + list.map(s =>
          '<div class="hx-skill" data-hx-skill="' + D.ui.esc(s.id) + '">' +
            '<span class="hx-snew">独家</span>' +
            '<div class="hx-sc">' + svg(s.icon || "star", 26) + "</div>" +
            '<div class="hx-sb"><div class="hx-sn">' + D.ui.esc(s.name) + "</div>" +
              '<div class="hx-sd">' + D.ui.esc(s.desc || "") + "</div></div>" +
          "</div>"
        ).join("") + "</div>"
      : D.ui.emptyBox("技能即将上新。");
    return '<div class="hx-sec"><div class="hx-sec-h"><h2>最近上新</h2><span class="hx-more" id="hxSkillsMore">全部技能</span></div>' + body + "</div>";
  }

  function bannerHtml() {
    return '<div class="hx-banner" id="hxTvshow">' +
      '<span class="hx-bic">' + svg("clapper", 24) + "</span>" +
      '<div><div class="hx-bt">全网爆款成片库</div>' +
        '<div class="hx-bd">新上线的短剧 / TV Show 成片都在这里，点开就能看别人的镜头怎么排。</div></div>' +
      '<span class="hx-bgo">去看看</span>' +
    "</div>";
  }

  async function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    v.innerHTML = '<div class="hx-wrap">' + heroHtml() + toolsHtml() + projectsHtml() + releasesHtml() + bannerHtml() + "</div>";
    bind(v);
  }

  function bind(v) {
    const create = v.querySelector("#hxCreate");
    if (create) create.onclick = () => newCanvas("", "");
    v.querySelectorAll("[data-hx-tool]").forEach(c => {
      c.onclick = () => {
        if (c.dataset.hxTool === "more") { if (XLX.app && XLX.app.go) XLX.app.go("toolkit"); return; }
        const bind = c.dataset.hxKind
          ? { kind: c.dataset.hxKind, provider: c.dataset.hxProvider, model: c.dataset.hxModel }
          : null;
        newCanvas(c.dataset.hxNode, c.dataset.hxName, bind);
      };
    });
    v.querySelectorAll("[data-hx-proj]").forEach(c => {
      c.onclick = () => openProject(c.dataset.hxProj);
    });
    v.querySelectorAll("[data-hx-skill]").forEach(c => {
      c.onclick = () => openSkill(c.dataset.hxSkill);
    });
    const more = v.querySelector("#hxMore");
    if (more) more.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("projects"); };
    const skMore = v.querySelector("#hxSkillsMore");
    if (skMore) skMore.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("toolkit"); };
    const tv = v.querySelector("#hxTvshow");
    if (tv) tv.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("tvshow"); };
  }

  async function newCanvas(nodeType, title, bind) {
    if (state.busy) return;
    state.busy = true;
    try {
      const p = D.project.blank({ title: title || "未命名画布" });
      if (bind && bind.kind) {
        if (bind.kind === "image") p.imageModel = bind.model || "";
        else if (bind.kind === "video") p.videoModel = bind.model || "";
        /* 切换该类型的短剧服务到所选模型，出片链路（engine/canvas/box3d）按此模型生成 */
        try { D.setAdapterConfig(bind.kind, { provider: bind.provider, model: bind.model || "" }); } catch (e) {}
      }
      if (nodeType && D.canvas && D.canvas.addNode) D.canvas.addNode(p, nodeType, 60, 120, { title: title || "" });
      await D.project.save(p);
      await openProject(p.id);
      if (bind && bind.kind) U.toast("已选模型 " + (bind.model || bind.provider) + "，出片将使用该模型", "ok");
    } catch (e) {
      U.toast((e && e.message) || "新建失败", "err");
    } finally {
      state.busy = false;
    }
  }

  async function openProject(pid) {
    if (D.projects && D.projects.open) return D.projects.open(pid);
    if (D.manual && D.manual.load) await D.manual.load(pid);
    if (XLX.app && XLX.app.go) XLX.app.go("drama");
  }

  /* 技能分流与技能墙已迁到「工具包」页，这里做转发，保持旧入口可用 */
  function openSkill(s) {
    if (D.toolkit && D.toolkit.openSkill) return D.toolkit.openSkill(s);
  }
  function kind(s) {
    if (D.toolkit && D.toolkit.kind) return D.toolkit.kind(s);
    return { id: "chat", label: "对话" };
  }

  D.home = { render, openSkill, kind, state };
})();
