/* 铜龙电商 · AI 短剧工作台 · 版本更新记录 */
/* 对齐 LibTV：时间线式更新日志，展示每次迭代的新功能与修复。 */
(function () {
  const D = XLX.drama;

  function view() { return document.getElementById("dramaChangelog"); }

  /* 更新记录（最新在上）。version + date + 标签 + 条目。 */
  const RELEASES = [
    {
      version: "v1.8.0", date: "2026-09-23", tag: "新版",
      items: [
        "首页对齐 LibTV：新增「更多功能」入口与 5 张独家能力卡（剧本原创与改编 / 导演执导 / 角色造型室 / 创意片头）",
        "新增「版本更新记录」页",
        "资产页补齐角色 / 主体 / 场景 / 风格分类；画布工作台只保留节点画布"
      ]
    },
    {
      version: "v1.7.0", date: "2026-09-22", tag: "功能",
      items: [
        "字幕精修：支持中英双语字幕与逐镜英文台词",
        "创意片头：输入主题生成片头文案、横屏标题板与 4 秒片头视频",
        "剧本设定器：一键生成分幕大纲、人物设定与世界观并铺进画布"
      ]
    },
    {
      version: "v1.6.0", date: "2026-09-21", tag: "功能",
      items: [
        "Skill 执行引擎：内置技能一键建工程并按流水线铺节点",
        "导演分身：输入梗概自动拆解逐镜分镜并铺进画布"
      ]
    },
    {
      version: "v1.5.0", date: "2026-09-20", tag: "体验",
      items: [
        "3D-BOX 独立页：多机位 / 大师运镜 / 灯光相机 / 多角度 / 精准编辑",
        "Agent 画布联动：对话指令直接落到当前画布"
      ]
    },
    {
      version: "v1.0.0", date: "2026-09-17", tag: "首发",
      items: [
        "节点画布工作台：自由编排文本 / 图片 / 视频 / 音频 / 口型节点",
        "成片库、创作者挑战赛与 Blender 插件落地页"
      ]
    }
  ];

  const CSS = `
.cl-wrap{max-width:860px;margin:0 auto;padding:26px 16px 60px;width:100%}
.cl-head{margin-bottom:22px}
.cl-head h1{font-size:24px;font-weight:800;margin:0 0 8px}
.cl-head p{margin:0;font-size:13px;color:var(--text3);line-height:1.75}
.cl-tl{position:relative;padding-left:22px}
.cl-tl::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:var(--border)}
.cl-item{position:relative;margin-bottom:18px}
.cl-item::before{content:"";position:absolute;left:-20px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.cl-ver{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.cl-ver b{font-size:15px;font-weight:800}
.cl-ver i{font-size:12px;color:var(--text3);font-style:normal}
.cl-tag{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent2)}
.cl-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:13px 15px}
.cl-card ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px}
.cl-card li{font-size:12.5px;color:var(--text2);line-height:1.7}
@media(max-width:600px){.cl-wrap{padding:18px 12px 46px}.cl-head h1{font-size:20px}}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaChangelogCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function itemHtml(r) {
    return '<div class="cl-item">'
      + '<div class="cl-ver"><b>' + D.ui.esc(r.version) + "</b>"
      + (r.tag ? '<span class="cl-tag">' + D.ui.esc(r.tag) + "</span>" : "")
      + '<i>' + D.ui.esc(r.date) + "</i></div>"
      + '<div class="cl-card"><ul>' + r.items.map(t => "<li>" + D.ui.esc(t) + "</li>").join("") + "</ul></div>"
      + "</div>";
  }

  function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    v.innerHTML = '<div class="cl-wrap">'
      + '<div class="cl-head"><h1>版本更新记录</h1>'
      + "<p>铜龙电商 AI 短剧工作台的每次迭代记录。新功能、体验优化与问题修复都会更新在这里。</p></div>"
      + '<div class="cl-tl">' + RELEASES.map(itemHtml).join("") + "</div>"
      + "</div>";
  }

  D.changelog = { render, RELEASES };
})();
