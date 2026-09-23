/* 铜龙电商 · AI 短剧工作台 · Blender 插件落地页 */
/* 3D 白模一键成片：介绍 + 真下载 + 连接账户 + 安装指南 + 作品展示；右上角直达 3D 导演台。 */
(function () {
  const D = XLX.drama;

  const VERSION = "1.0.0";
  const DOWNLOAD_URL = "/dian/api/drama/blender/download";

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
    "在铜龙插件页点「生成插件令牌」，复制站点地址、令牌与工程 ID。",
    "在 Blender 4.5 中安装并启用「铜龙电商 Blender 插件」，粘贴站点地址、令牌与工程 ID。",
    "点「拉取分镜」，把铜龙工程的分镜与提示词带进 Blender，据此搭建白模场景。",
    "点「导出白模到铜龙」，白模 GLB 与视口预览自动回到 3D-BOX，继续做多机位与运镜。"
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
.pl-btn{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text);text-decoration:none}
.pl-btn.primary{border:none;background:var(--accent-grad);color:var(--accent-ink)}
.pl-btn svg{width:16px;height:16px}
.pl-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:26px}
@media(max-width:820px){.pl-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.pl-steps{grid-template-columns:1fr}}
.pl-step{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:14px}
.pl-step .pl-sn{width:26px;height:26px;border-radius:8px;background:var(--accent-grad);color:var(--accent-ink);font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:9px}
.pl-step .pl-st{font-size:12.5px;color:var(--text2);line-height:1.65}
.pl-acct{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:26px}
.pl-acct-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.pl-acct-h h2{font-size:16px;font-weight:800;margin:0}
.pl-acct-h .pl-ver{font-size:12px;color:var(--text3);margin-left:auto}
.pl-acct p{margin:0 0 12px;font-size:12.5px;color:var(--text3);line-height:1.7}
.pl-plist{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.pl-prow{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 12px}
.pl-prow .pl-pn{flex:1;min-width:0;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-prow code{font-size:11.5px;color:var(--text3);background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:6px;padding:2px 7px;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-mini{font-size:12px;font-weight:700;border-radius:8px;padding:5px 11px;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text)}
.pl-token{display:none;margin-top:12px;border-top:1px dashed var(--border);padding-top:12px}
.pl-token.open{display:block}
.pl-field{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.pl-field label{font-size:12px;color:var(--text3);width:74px;flex:none}
.pl-field input{flex:1;min-width:0;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 9px}
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
.pl-foot{margin-top:26px;font-size:12px;color:var(--text3);text-align:center}
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

  function toast(msg, kind) {
    if (XLX.util && XLX.util.toast) XLX.util.toast(msg, kind || "ok");
  }

  function copyText(text, msg) {
    const done = () => toast(msg || "已复制");
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) {
        toast("复制失败，请手动选中", "err");
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function origin() {
    try { return (window.location && window.location.origin) || ""; } catch (e) { return ""; }
  }

  async function loadProjects() {
    try {
      const r = await fetch("/dian/api/drama/blender/projects", { credentials: "same-origin" });
      const j = await r.json();
      return j && j.ok ? (j.projects || []) : [];
    } catch (e) {
      return [];
    }
  }

  function projectsHtml(list) {
    if (!list.length) return '<p>还没有工程。先去「项目」新建一个短剧工程，再回来生成令牌。</p>';
    return '<div class="pl-plist">' + list.map(p =>
      '<div class="pl-prow"><span class="pl-pn">' + D.ui.esc(p.title || p.id) + '</span>'
      + '<code title="' + D.ui.esc(p.id) + '">' + D.ui.esc(p.id) + '</code>'
      + '<button class="pl-mini" data-pl-copy="' + D.ui.esc(p.id) + '">复制 ID</button></div>'
    ).join("") + "</div>";
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
      +     '<p>在 Blender 内完成白模视频，一键导出到铜龙创作成片。'
      +     '白模场景与视口预览会自动回到 3D-BOX，继续做多机位、大师运镜与精准编辑。</p></div>'
      +   '<div class="pl-cta">'
      +     '<a class="pl-btn primary" id="plDownload" href="' + DOWNLOAD_URL + '">' + svg("download") + "下载 Blender 插件</a>"
      +     '<button class="pl-btn" id="plGuide">' + svg("book") + "安装指南</button>"
      +     '<button class="pl-btn" id="plDirector">' + svg("grid") + "体验 3D 导演台</button>"
      +   "</div>"
      + "</div>"
      + '<div class="pl-steps">' + STEPS.map((t, i) =>
          '<div class="pl-step"><div class="pl-sn">' + (i + 1) + '</div><div class="pl-st">' + D.ui.esc(t) + "</div></div>"
        ).join("") + "</div>"
      + '<div class="pl-acct"><div class="pl-acct-h"><h2>连接账户</h2>'
      +   '<span class="pl-ver">v' + VERSION + ' · 支持 Blender 4.5+</span></div>'
      +   '<p>先生成插件令牌，再在 Blender 里粘贴站点地址、令牌与工程 ID。令牌可用 180 天，仅代表你本人的账号。</p>'
      +   '<div id="plProjects"><p>正在读取工程…</p></div>'
      +   '<button class="pl-btn primary" id="plToken">' + svg("key") + "生成插件令牌</button>"
      +   '<div class="pl-token" id="plTokenBox"></div>'
      + "</div>"
      + '<div class="pl-sec"><div class="pl-sec-h"><h2>作品展示</h2><span>用插件产出的 3D 镜头</span></div>'
      +   '<div class="pl-show">' + SHOWCASE.map(c =>
            '<div class="pl-card"><div class="pl-cover" style="background:linear-gradient(135deg,' + c.color + '33,' + c.color + '0d);color:' + c.color + '">' + svg("box", 26) + '</div>'
            + '<div class="pl-cn">' + D.ui.esc(c.name) + "</div></div>"
          ).join("") + "</div>"
      + "</div>"
      + '<div class="pl-foot">应用内不提供插件安装，请在浏览器打开本站插件页下载；安装包同名 ' + D.ui.esc("xlx-blender-plugin.zip") + "。</div>"
      + "</div>";
    bind(v);
    loadProjects().then(list => {
      const host = v.querySelector("#plProjects");
      if (host) host.innerHTML = projectsHtml(list);
      v.querySelectorAll("[data-pl-copy]").forEach(b => {
        b.onclick = () => copyText(b.getAttribute("data-pl-copy"), "已复制工程 ID");
      });
    });
  }

  function bind(v) {
    const dl = v.querySelector("#plDownload");
    if (dl) dl.onclick = () => toast("开始下载 Blender 插件包", "ok");
    const gd = v.querySelector("#plGuide");
    if (gd) gd.onclick = openGuide;
    const di = v.querySelector("#plDirector");
    if (di) di.onclick = () => { if (XLX.app && XLX.app.go) XLX.app.go("box3d"); };
    const tk = v.querySelector("#plToken");
    if (tk) tk.onclick = () => issueToken(v, tk);
  }

  async function issueToken(v, btn) {
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = svg("key") + "生成中…";
    try {
      const r = await fetch("/dian/api/drama/blender/token", { method: "POST", credentials: "same-origin" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok || !j.token) throw new Error((j && j.error) || "生成失败");
      const box = v.querySelector("#plTokenBox");
      box.className = "pl-token open";
      box.innerHTML = '<div class="pl-field"><label>站点地址</label><input id="plSite" readonly value="' + D.ui.esc(origin()) + '"></div>'
        + '<div class="pl-field"><label>插件令牌</label><input id="plTk" readonly value="' + D.ui.esc(j.token) + '"></div>'
        + '<button class="pl-mini" id="plCopyAll">复制站点与令牌</button>';
      box.querySelector("#plCopyAll").onclick = () => copyText(origin() + "\n" + j.token, "已复制站点与令牌");
      toast("插件令牌已生成，180 天内有效", "ok");
    } catch (e) {
      toast(e.message || "生成失败", "err");
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  function openGuide() {
    const m = document.getElementById("modal");
    if (!m) return;
    m.innerHTML = '<div class="modal-box">'
      + '<div class="modal-head"><div><div class="mt">Blender 插件安装指南</div><div class="ms">3D 白模 一键成片 · 支持 Blender 4.5+</div></div></div>'
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

  D.plugin = { render, VERSION };
})();
