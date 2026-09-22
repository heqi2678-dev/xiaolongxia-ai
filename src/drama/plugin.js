/* 铜龙电商 · AI 短剧工作台 · 插件页 */
/* 聚合软件工坊 / 工具箱 / 客户端下载三个入口，复用原能力与存储键。 */
(function () {
  const D = XLX.drama;

  function view() { return document.getElementById("dramaPlugin"); }

  const ENTRIES = [
    { go: "studio", icon: "hammer", color: "#38d9e6", name: "软件工坊", desc: "用一句话开发完整软件 → 预览 → 一键打包下载" },
    { go: "tools", icon: "cart", color: "#ff8f5a", name: "工具箱", desc: "商品图下载、去水印、视频提取文案等免费工具" },
    { go: "download", icon: "download", color: "#3ddc84", name: "客户端下载", desc: "手机 / 电脑客户端与离线版下载" }
  ];

  const CSS = `
.pl-wrap{max-width:900px;margin:0 auto;padding:26px 16px 60px;width:100%}
.pl-head{margin-bottom:20px}
.pl-head h1{font-size:22px;font-weight:800;margin:0 0 4px}
.pl-head p{margin:0;font-size:12px;color:var(--text3)}
.pl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@media(max-width:720px){.pl-grid{grid-template-columns:1fr}}
.pl-card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;gap:10px}
.pl-card:hover{border-color:var(--accent);transform:translateY(-3px)}
.pl-ic{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center}
.pl-ic svg{width:24px;height:24px}
.pl-name{font-size:15px;font-weight:700}
.pl-desc{font-size:12px;color:var(--text3);line-height:1.65}
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

  function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    v.innerHTML = '<div class="pl-wrap">' +
      '<div class="pl-head"><h1>插件</h1><p>短剧之外的创作能力，都在这里</p></div>' +
      '<div class="pl-grid">' + ENTRIES.map(e =>
        '<div class="pl-card" data-pl-go="' + e.go + '">' +
          '<div class="pl-ic" style="background:' + e.color + '22;color:' + e.color + '">' + svg(e.icon) + "</div>" +
          '<div class="pl-name">' + e.name + "</div>" +
          '<div class="pl-desc">' + e.desc + "</div>" +
        "</div>"
      ).join("") + "</div>" +
    "</div>";
    v.querySelectorAll("[data-pl-go]").forEach(c => { c.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go(c.dataset.plGo); }; });
  }

  D.plugin = { render };
})();
