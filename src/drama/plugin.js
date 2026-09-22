/* 铜龙电商 · AI 短剧工作台 · 插件页 */
/* 聚合软件工坊 / 工具箱 / 客户端下载三个入口，并提供全部技能库（按类型分流后从这里开）。 */
(function () {
  const D = XLX.drama;

  function view() { return document.getElementById("dramaPlugin"); }

  const ENTRIES = [
    { go: "studio", icon: "hammer", color: "#38d9e6", name: "软件工坊", desc: "用一句话开发完整软件 → 预览 → 一键打包下载" },
    { go: "tools", icon: "cart", color: "#ff8f5a", name: "工具箱", desc: "商品图下载、去水印、视频提取文案等免费工具" },
    { go: "download", icon: "download", color: "#3ddc84", name: "客户端下载", desc: "手机 / 电脑客户端与离线版下载" }
  ];

  const state = { cat: "all", q: "" };

  const CSS = `
.pl-wrap{max-width:900px;margin:0 auto;padding:26px 16px 60px;width:100%}
.pl-head{margin-bottom:20px}
.pl-head h1{font-size:22px;font-weight:800;margin:0 0 4px}
.pl-head p{margin:0;font-size:12px;color:var(--text3)}
.pl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@media(max-width:720px){.pl-grid{grid-template-columns:1fr}}
@media(max-width:600px){
  .pl-wrap{padding:18px 12px 46px}
  .pl-head h1{font-size:19px}
  .pl-card{padding:16px}
  .pl-sec{margin-top:26px}
}
.pl-card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;gap:10px}
.pl-card:hover{border-color:var(--accent);transform:translateY(-3px)}
.pl-ic{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center}
.pl-ic svg{width:24px;height:24px}
.pl-name{font-size:15px;font-weight:700}
.pl-desc{font-size:12px;color:var(--text3);line-height:1.65}
.pl-sec{margin-top:34px}
.pl-sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
.pl-sec-h h2{font-size:16px;font-weight:800;margin:0}
.pl-sec-h span{font-size:12px;color:var(--text3)}
.pl-filter{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pl-cats{display:flex;gap:8px;flex-wrap:wrap;flex:1}
.pl-cat{border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:999px;padding:5px 13px;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}
.pl-cat:hover{border-color:var(--accent);color:var(--text)}
.pl-cat.on{border-color:var(--accent);color:var(--accent2);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.pl-search{display:flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:0 12px;height:32px}
.pl-search svg{width:13px;height:13px;color:var(--text3)}
.pl-search input{background:none;border:none;outline:none;color:var(--text);font-size:12.5px;width:130px}
.pl-skills{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(max-width:720px){.pl-skills{grid-template-columns:1fr}}
.pl-skill{display:flex;align-items:center;gap:12px;background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:12px 14px;cursor:pointer;transition:border-color .15s,transform .15s}
.pl-skill:hover{border-color:var(--accent);transform:translateX(3px)}
.pl-skill .pl-ic{width:38px;height:38px;border-radius:11px;flex:none}
.pl-skill .pl-ic svg{width:19px;height:19px}
.pl-skill-txt{flex:1;min-width:0}
.pl-skill-n{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-skill-d{font-size:11.5px;color:var(--text3);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-skill-tag{font-size:10.5px;color:var(--text3);border:1px solid var(--border);border-radius:999px;padding:3px 9px;flex:none}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaPluginCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ((XLX.ICONS && XLX.ICONS[name]) || "") + "</svg>";
  }

  function catColor(cat) {
    const c = (XLX.CATS || []).find(x => x.id === cat);
    return c ? c.color : "#38d9e6";
  }

  function skillKind(s) {
    return D.home && D.home.kind ? D.home.kind(s) : { id: "chat", label: "对话" };
  }

  function skillList() {
    let list = (XLX.SKILLS || []).slice();
    if (state.cat !== "all") list = list.filter(s => s.cat === state.cat);
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(s => (String(s.name) + " " + String(s.desc || "")).toLowerCase().indexOf(q) >= 0);
    return list;
  }

  function skillsHtml() {
    const list = skillList();
    if (!list.length) return D.ui.emptyBox("没有匹配的技能，换个关键词试试。");
    return '<div class="pl-skills">' + list.map(s => {
      const color = catColor(s.cat);
      return '<div class="pl-skill" data-pl-skill="' + D.ui.esc(s.id) + '">' +
        '<div class="pl-ic" style="background:' + color + '22;color:' + color + '">' + svg(s.icon) + "</div>" +
        '<div class="pl-skill-txt"><div class="pl-skill-n">' + D.ui.esc(s.name) + "</div>" +
          '<div class="pl-skill-d">' + D.ui.esc(s.desc || "") + "</div></div>" +
        '<span class="pl-skill-tag">' + skillKind(s).label + "</span>" +
      "</div>";
    }).join("") + "</div>";
  }

  function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    const cats = (XLX.CATS && XLX.CATS.length ? XLX.CATS : [{ id: "all", name: "全部" }]);
    v.innerHTML = '<div class="pl-wrap">' +
      '<div class="pl-head"><h1>插件</h1><p>短剧之外的创作能力，都在这里</p></div>' +
      '<div class="pl-grid">' + ENTRIES.map(e =>
        '<div class="pl-card" data-pl-go="' + e.go + '">' +
          '<div class="pl-ic" style="background:' + e.color + '22;color:' + e.color + '">' + svg(e.icon) + "</div>" +
          '<div class="pl-name">' + e.name + "</div>" +
          '<div class="pl-desc">' + e.desc + "</div>" +
        "</div>"
      ).join("") + "</div>" +
      '<div class="pl-sec">' +
        '<div class="pl-sec-h"><h2>技能库</h2><span>共 ' + (XLX.SKILLS || []).length + ' 个 · 点开即用</span></div>' +
        '<div class="pl-filter">' +
          '<div class="pl-cats">' + cats.map(c =>
            '<button class="pl-cat' + (state.cat === c.id ? " on" : "") + '" data-pl-cat="' + c.id + '">' + D.ui.esc(c.name) + "</button>"
          ).join("") + "</div>" +
          '<div class="pl-search">' + svg("search") +
            '<input id="plQ" placeholder="搜索技能" value="' + D.ui.esc(state.q) + '">' +
          "</div>" +
        "</div>" +
        '<div id="plSkills">' + skillsHtml() + "</div>" +
      "</div>" +
    "</div>";
    v.querySelectorAll("[data-pl-go]").forEach(c => { c.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go(c.dataset.plGo); }; });
    v.querySelectorAll("[data-pl-cat]").forEach(c => { c.onclick = () => { state.cat = c.dataset.plCat; render(); }; });
    const q = v.querySelector("#plQ");
    if (q) q.oninput = (e) => { state.q = e.target.value; rerenderSkills(); };
    bindSkills(v);
  }

  function rerenderSkills() {
    const v = view();
    if (!v) return;
    const box = v.querySelector("#plSkills");
    if (!box) return;
    box.innerHTML = skillsHtml();
    bindSkills(box);
  }

  function bindSkills(root) {
    root.querySelectorAll("[data-pl-skill]").forEach(el => {
      el.onclick = () => {
        const s = XLX.getSkill ? XLX.getSkill(el.dataset.plSkill) : null;
        if (s && D.home && D.home.openSkill) D.home.openSkill(s);
      };
    });
  }

  D.plugin = { render };
})();
