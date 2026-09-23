/* 铜龙电商 · AI 短剧工作台 · Blender 插件落地页 */
/* 3D 白模一键成片：介绍 + 下载 + 安装指南 + 作品展示；右上角可直达 3D 导演台。 */
(function () {
  const D = XLX.drama;

  function view() { return document.getElementById("dramaPlugin"); }

  const SHOWCASE = [
    { name: "机甲白模 · 转场动画", color: "#38d9e6" },
    { name: "角色循环动作", color: "#a78bfa" },
    { name: "产品旋转展示", color: "#ff8f5a" },
    { name: "场景漫游镜头", color: "#4aa8ff" },
    { name: "粒子特效合成", color: "#ff7aa8" },
    { name: "多机位渲染", color: "#3ddc84" }
  ];

  const STEPS = [
    "在 Blender 中打开你的白模工程，确认模型与相机的命名规范。",
    "安装并启用「铜龙电商 Blender 插件」，插件会读取当前场景与相机。",
    "在插件里填写镜头描述，选择画幅与模型，点击生成。",
    "生成结果自动回传 3D-BOX，可继续做多机位、运镜与灯光调整。"
  ];

  const CSS = `
.pl-wrap{max-width:1000px;margin:0 auto;padding:26px 16px 60px;width:100%}
.pl-top{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:22px}
.pl-logo{width:60px;height:60px;border-radius:17px;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent2);display:flex;align-items:center;justify-content:center;flex:none}
.pl-logo svg{width:32px;height:32px}
.pl-head{flex:1;min-width:220px}
.pl-head h1{font-size:26px;font-weight:800;margin:0 0 8px}
.pl-head p{margin:0;font-size:13px;color:var(--text3);line-height:1.75}
.pl-cta{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto;align-self:flex-start}
.pl-btn{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text)}
.pl-btn.primary{border:none;background:var(--accent-grad);color:var(--accent-ink)}
.pl-btn svg{width:16px;height:16px}
.pl-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:26px}
@media(max-width:820px){.pl-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.pl-steps{grid-template-columns:1fr}}
.pl-step{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px}
.pl-step .pl-sn{width:26px;height:26px;border-radius:8px;background:var(--accent-grad);color:var(--accent-ink);font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:9px}
.pl-step .pl-st{font-size:12.5px;color:var(--text2);line-height:1.65}
.pl-sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
.pl-sec-h h2{font-size:16px;font-weight:800;margin:0}
.pl-sec-h span{font-size:12px;color:var(--text3)}
.pl-show{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:720px){.pl-show{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.pl-show{grid-template-columns:1fr}}
.pl-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color .15s,transform .15s}
.pl-card:hover{border-color:var(--accent);transform:translateY(-3px)}
.pl-card .pl-cover{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center}
.pl-card .pl-cover svg{width:26px;height:26px}
.pl-card .pl-cn{padding:9px 11px;font-size:12.5px;font-weight:700}
@media(max-width:600px){
  .pl-wrap{padding:18px 12px 46px}
  .pl-head h1{font-size:20px}
  .pl-cta{margin-left:0;width:100%}
}
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

  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:' + (size || 16) + "px;height:" + (size || 16) + 'px">' + ((XLX.ICONS && XLX.ICONS[name]) || "") + '</svg>';
  }

  function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    v.innerHTML = '<div class="pl-wrap">'
      + '<div class="pl-top">'
      +   '<div class="pl-logo">' + svg("box", 32) + "</div>"
      +   '<div class="pl-head"><h1>3D 白模 一键成片</h1>'
      +     '<p>把 Blender 里的白模场景一键交给 AI：自动补全材质、灯光与运镜，直接产出可用的镜头片段。'
      +     '生成的镜头会回到 3D-BOX，继续做多机位、大师运镜与精准编辑。</p></div>'
      +   '<div class="pl-cta">'
      +     '<button class="pl-btn primary" id="plDownload">' + svg("download") + "下载 Blender 插件</button>"
      +     '<button class="pl-btn" id="plGuide">' + svg("book") + "安装指南</button>"
      +     '<button class="pl-btn" id="plDirector">' + svg("grid") + "体验 3D 导演台</button>"
      +   "</div>"
      + "</div>"
      + '<div class="pl-steps">' + STEPS.map((t, i) =>
          '<div class="pl-step"><div class="pl-sn">' + (i + 1) + '</div><div class="pl-st">' + D.ui.esc(t) + "</div></div>"
        ).join("") + "</div>"
      + '<div class="pl-sec"><div class="pl-sec-h"><h2>作品展示</h2><span>用插件产出的 3D 镜头</span></div>'
      +   '<div class="pl-show">' + SHOWCASE.map(c =>
            '<div class="pl-card"><div class="pl-cover" style="background:linear-gradient(135deg,' + c.color + '33,' + c.color + '0d);color:' + c.color + '">' + svg("box", 26) + '</div>'
            + '<div class="pl-cn">' + D.ui.esc(c.name) + "</div></div>"
          ).join("") + "</div>"
      + "</div>"
      + "</div>";
    bind(v);
  }

  function bind(v) {
    const dl = v.querySelector("#plDownload");
    if (dl) dl.onclick = () => {
      if (XLX.app && XLX.app.go) XLX.app.go("download");
      if (XLX.util && XLX.util.toast) XLX.util.toast("前往客户端下载页获取 Blender 插件", "ok");
    };
    const gd = v.querySelector("#plGuide");
    if (gd) gd.onclick = openGuide;
    const di = v.querySelector("#plDirector");
    if (di) di.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("box3d"); };
  }

  function openGuide() {
    const m = document.getElementById("modal");
    if (!m) return;
    m.innerHTML = '<div class="modal-box">'
      + '<div class="modal-head"><div><div class="mt">Blender 插件安装指南</div><div class="ms">3D 白模 一键成片</div></div></div>'
      + '<div class="modal-body"><ol style="margin:0;padding-left:20px;font-size:17px;line-height:2;color:var(--text2)">'
      + STEPS.map(t => "<li>" + D.ui.esc(t) + "</li>").join("")
      + "</ol></div>"
      + '<div class="modal-foot"><button class="btn ghost" id="plGuideClose">关闭</button></div></div>';
    m.classList.add("open");
    const close = () => m.classList.remove("open");
    m.onclick = (e) => { if (e.target === m) close(); };
    const c = document.getElementById("plGuideClose");
    if (c) c.onclick = close;
  }

  D.plugin = { render };
})();
