/* 铜龙电商 · AI 短剧工作台 · 3D-BOX 独立页（LibTV 形态） */
/* 上：场景灵感轮播 + 居中提示词（一句话进画布）。
   下：导演工具台，挂载 D.box3d 的五工具面板（多机位 9 宫格 / 大师运镜 / 灯光相机 / 多角度 / 精准编辑）。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  function view() { return document.getElementById("dramaBox3d"); }

  /* 场景灵感：点一下把句式填进提示词框 */
  const SCENES = [
    { id: "street", name: "雨夜街头", color: "#4aa8ff", prompt: "雨夜街头，霓虹灯下的孤身身影，慢镜头推进" },
    { id: "palace", name: "古风宫廷", color: "#ff7aa8", prompt: "古风宫廷大殿，金色烛光，对称构图缓慢横移" },
    { id: "office", name: "现代都市", color: "#38d9e6", prompt: "现代写字楼落地窗前，人物侧脸，环绕镜头" },
    { id: "desert", name: "荒漠公路", color: "#ff8f5a", prompt: "荒漠公路，越野车扬起尘土，航拍跟拍" },
    { id: "studio", name: "影棚布光", color: "#a78bfa", prompt: "专业影棚三点布光，产品特写，微距环绕" }
  ];

  const EXAMPLES = [
    "把这场对手戏拆成 9 个机位，做一组多机位 9 宫格",
    "给主角加一个从远景推到特写的大师运镜",
    "切换夜景灯光，再补两个多角度机位"
  ];

  const state = { ratio: "16:9", auto: true, pid: "", shotId: "", tool: "grid", impl: "ai" };

  const CSS = `
.bv-page{width:100%;display:flex;flex-direction:column;gap:24px;padding-bottom:60px}
.bv-scenes{display:flex;gap:10px;overflow-x:auto;padding:16px 16px 4px;scrollbar-width:thin}
.bv-scenes::-webkit-scrollbar{height:6px}
.bv-scenes::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}
.bv-scene{flex:none;width:232px;aspect-ratio:16/10;border-radius:10px;overflow:hidden;position:relative;cursor:pointer;border:1px solid var(--border);transition:border-color .15s,transform .15s}
.bv-scene:hover{border-color:var(--accent);transform:translateY(-2px)}
.bv-scene .bv-scover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.bv-scene .bv-scover svg{width:30px;height:30px}
.bv-scene .bv-sn{position:absolute;left:0;right:0;bottom:0;padding:18px 10px 8px;font-size:12.5px;font-weight:700;color:#fff;background:linear-gradient(to top,rgba(0,0,0,.6),transparent)}
.bv-main{width:100%;max-width:820px;margin:0 auto;padding:0 16px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.bv-hero h1{font-size:27px;font-weight:800;margin:0 0 10px}
.bv-hero p{margin:0;font-size:13px;color:var(--text3);line-height:1.7}
.bv-prompt{width:100%;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:14px 16px;text-align:left}
.bv-prompt textarea{width:100%;background:none;border:none;outline:none;color:var(--text);font-size:14px;resize:none;min-height:58px;line-height:1.6;font-family:inherit;display:block}
.bv-prow{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.bv-plus{width:34px;height:34px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0}
.bv-plus:hover{border-color:var(--accent);color:var(--accent2)}
.bv-plus svg{width:16px;height:16px}
.bv-model{display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:9px;padding:0 8px 0 9px;height:34px;color:var(--text)}
.bv-model>svg{width:14px;height:14px;color:var(--text2);flex:none}
.bv-model select{background:none;border:none;outline:none;color:var(--text);font-size:12.5px;padding:0 2px;height:32px;cursor:pointer;max-width:170px}
.bv-sel{background:var(--card);border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:12.5px;padding:0 8px;height:34px;cursor:pointer}
.bv-auto{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:9px;height:34px;padding:0 12px;font-size:12.5px;cursor:pointer}
.bv-auto svg{width:14px;height:14px}
.bv-auto.on{border-color:var(--accent);color:var(--accent2)}
.bv-gen{margin-left:auto;border:none;border-radius:999px;background:var(--accent-grad);color:var(--accent-ink);font-size:13.5px;font-weight:700;padding:9px 26px;cursor:pointer}
.bv-gen:hover{filter:brightness(1.06)}
.bv-egs{width:100%;display:flex;flex-direction:column;gap:11px;text-align:left;margin-top:2px}
.bv-eg{display:flex;align-items:center;gap:8px;background:none;border:none;color:var(--text2);font-size:12.5px;cursor:pointer;padding:0;text-align:left;line-height:1.5}
.bv-eg:hover{color:var(--accent2)}
.bv-eg i{font-style:normal;color:var(--text3);flex:none;font-size:14px}
.bv-tools{width:100%;max-width:1080px;margin:0 auto;padding:0 16px;display:flex;flex-direction:column;gap:12px}
.bv-tools-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bv-tools-head b{font-size:15px;font-weight:800}
.bv-tools-head .bv-sel{max-width:240px;height:32px}
.bv-tools-head .bv-sp{flex:1}
.bv-impl{display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden;flex:none}
.bv-impl button{border:none;background:var(--card);color:var(--text2);font-size:12px;padding:0 12px;height:32px;cursor:pointer}
.bv-impl button+button{border-left:1px solid var(--border)}
.bv-impl button.on{background:var(--accent-grad);color:var(--accent-ink);font-weight:700}
.bv-impl button:disabled{opacity:.45;cursor:not-allowed}
.bv-stage{margin-top:4px}
.bv-empty{font-size:12.5px;color:var(--text3);border:1px dashed var(--border);border-radius:12px;padding:18px;text-align:center;line-height:1.8}
@media(max-width:600px){
  .bv-page{gap:18px}
  .bv-scenes{padding:12px 12px 2px}
  .bv-scene{width:164px}
  .bv-main{gap:14px}
  .bv-hero h1{font-size:20px}
  .bv-model select{max-width:104px}
  .bv-gen{padding:9px 20px}
  .bv-tools-head .bv-sel{max-width:none;flex:1}
}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaBox3dViewCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:' + (size || 16) + "px;height:" + (size || 16) + 'px">' + ((XLX.ICONS && XLX.ICONS[name]) || "") + '</svg>';
  }

  function heroHtml() {
    return '<div class="bv-hero"><h1>3D-BOX · 你的专业影视空间</h1>'
      + '<p>Agent 轻松搭景，精准调度站位，一句话生成大片级运镜预演</p></div>';
  }

  function scenesHtml() {
    return '<div class="bv-scenes">' + SCENES.map(s =>
      '<div class="bv-scene" data-bv-scene="' + D.ui.esc(s.id) + '" data-bv-prompt="' + D.ui.esc(s.prompt) + '" title="' + D.ui.esc(s.name) + '">' +
        '<div class="bv-scover" style="background:linear-gradient(135deg,' + s.color + '33,' + s.color + '0d);color:' + s.color + '">' + svg("box", 30) + "</div>" +
        '<div class="bv-sn">' + D.ui.esc(s.name) + "</div>" +
      "</div>"
    ).join("") + "</div>";
  }

  function promptHtml() {
    return '<div class="bv-prompt">' +
      '<textarea id="bvPrompt" placeholder="描述场景、人物动作和镜头怎么动，例如：雨夜街头，霓虹灯下人物回头，慢镜头推进"></textarea>' +
      '<div class="bv-prow">' +
        '<button class="bv-plus" id="bvAttach" title="添加参考素材">' + svg("plus", 16) + "</button>" +
        '<span class="bv-model">' + svg("box", 14) +
          '<select id="bvModel"><option>3D-BOX Model Pro</option><option>3D-BOX Model Lite</option></select>' +
        "</span>" +
        '<select class="bv-sel" id="bvRatio"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option></select>' +
        '<button class="bv-auto on" id="bvAuto">' + svg("clock", 14) + "自动</button>" +
        '<button class="bv-gen" id="bvGen">生成</button>' +
      "</div>" +
    "</div>";
  }

  function examplesHtml() {
    return '<div class="bv-egs">' + EXAMPLES.map(t =>
      '<button class="bv-eg" data-bv-eg="' + D.ui.esc(t) + '"><i>↳</i>' + D.ui.esc(t) + "</button>"
    ).join("") + "</div>";
  }

  /* ============ 导演工具台 ============ */
  function projects() { return D.project.list(); }

  function ensureProject() {
    const list = projects();
    if (!list.length) return null;
    let p = (state.pid && D.project.get(state.pid)) || list[0];
    state.pid = p.id;
    try { D.project.migrate(p); } catch (e) {}
    return p;
  }

  function ensureShot(p) {
    if (!p) return;
    if (!Array.isArray(p.shots)) p.shots = [];
    if (!p.shots.length) D.project.addShot(p);
    if (!state.shotId || !p.shots.some(s => s.id === state.shotId)) {
      state.shotId = p.shots[0] ? p.shots[0].id : "";
    }
  }

  function sceneReady() {
    return !!(D.box3dscene && D.box3dscene.supported && D.box3dscene.supported());
  }

  function implSwitchHtml() {
    const ok3d = sceneReady();
    const impl = ok3d ? state.impl : "ai";
    return '<span class="bv-impl">' +
      '<button data-bv-impl="ai" class="' + (impl === "ai" ? "on" : "") + '">AI 取景</button>' +
      '<button data-bv-impl="real3d" class="' + (impl === "real3d" ? "on" : "") + '"' + (ok3d ? "" : ' disabled title="当前环境不支持 WebGL"') + ">真 3D 视口</button>" +
    "</span>";
  }

  function toolsHeadHtml(p) {
    const proj = projects().map(x => '<option value="' + D.ui.esc(x.id) + '"' + (p && x.id === p.id ? " selected" : "") + ">" + D.ui.esc(x.title || "未命名工程") + "</option>").join("");
    const shots = p ? (p.shots || []).map(s => '<option value="' + D.ui.esc(s.id) + '"' + (s.id === state.shotId ? " selected" : "") + ">第 " + D.ui.esc(s.seq) + " 镜</option>").join("") : "";
    return '<div class="bv-tools-head"><b>导演工具台</b>' +
      '<select class="bv-sel" id="bvProj">' + proj + "</select>" +
      (p ? '<select class="bv-sel" id="bvShot">' + shots + "</select>" : "") +
      '<span class="bv-sp"></span>' +
      implSwitchHtml() +
      (p ? '<button class="btn small" id="bvAddShot">＋ 分镜</button>' : "") +
    "</div>";
  }

  function stageHtml() {
    return sceneReady() ? '<div class="bv-stage" id="bvStage"></div>' : "";
  }

  function toolsHtml(p) {
    if (!p) return toolsHeadHtml(null) + '<div class="bv-empty">还没有工程。先在上面的提示词框「生成」一个 3D-BOX 工程，或去节点工作台新建工程。</div>';
    return toolsHeadHtml(p) + stageHtml() + '<div id="bvPanel"></div>';
  }

  let panel = null;
  let scene = null;

  function currentShot(p) {
    if (!p) return null;
    const shots = p.shots || [];
    return shots.find(s => s.id === state.shotId) || shots[0] || null;
  }

  function render() {
    ensureCss();
    const v = view();
    if (!v) return;
    const p = ensureProject();
    if (p) ensureShot(p);
    v.innerHTML = '<div class="bv-page">' + scenesHtml()
      + '<div class="bv-main">' + heroHtml() + promptHtml() + examplesHtml() + "</div>"
      + '<div class="bv-tools">' + toolsHtml(p) + "</div>"
      + "</div>";
    bindPrompt(v);
    bindTools(v, p);
    mountScene(p);
    mountPanel(p);
  }

  function mountScene(p) {
    scene = null;
    const host = view() && view().querySelector("#bvStage");
    const shot = currentShot(p);
    if (!host || !p || !shot || !sceneReady()) return;
    try {
      scene = D.box3dscene.mount(host, p, shot, {
        onChange: async () => {
          try { await D.project.save(p); } catch (e) {}
        }
      });
    } catch (e) {
      host.innerHTML = '<div class="bv-empty">' + D.ui.esc((e && e.message) || "真 3D 视口加载失败") + "</div>";
    }
  }

  function mountPanel(p) {
    panel = null;
    const host = view() && view().querySelector("#bvPanel");
    if (!host || !p || !D.box3d) return;
    try {
      panel = D.box3d.mount(host, p, {
        tool: state.tool,
        shotId: state.shotId,
        provider: state.impl === "real3d" ? "real3d" : "",
        onChange: async () => {
          try { await D.project.save(p); } catch (e) {}
        }
      });
    } catch (e) {
      host.innerHTML = '<div class="bv-empty">' + D.ui.esc((e && e.message) || "导演工具台加载失败") + "</div>";
    }
  }

  function bindPrompt(v) {
    const ta = v.querySelector("#bvPrompt");
    v.querySelectorAll("[data-bv-scene]").forEach(c => {
      c.onclick = () => { if (ta) { ta.value = c.dataset.bvPrompt; ta.focus(); } };
    });
    v.querySelectorAll("[data-bv-eg]").forEach(b => {
      b.onclick = () => { if (ta) { ta.value = b.dataset.bvEg; ta.focus(); } };
    });
    const auto = v.querySelector("#bvAuto");
    if (auto) auto.onclick = () => { state.auto = auto.classList.toggle("on"); };
    const ratio = v.querySelector("#bvRatio");
    if (ratio) ratio.onchange = () => { state.ratio = ratio.value; };
    const att = v.querySelector("#bvAttach");
    if (att) att.onclick = () => U.toast("参考素材上传开发中", "info");
    const gen = v.querySelector("#bvGen");
    if (gen) gen.onclick = () => generate(ta, v.querySelector("#bvRatio"));
  }

  function bindTools(v, p) {
    const proj = v.querySelector("#bvProj");
    if (proj) proj.onchange = () => { state.pid = proj.value; state.shotId = ""; render(); };
    const shot = v.querySelector("#bvShot");
    if (shot) shot.onchange = () => { state.shotId = shot.value; if (panel) panel.setShot(state.shotId); mountScene(p); };
    v.querySelectorAll("[data-bv-impl]").forEach(b => {
      b.onclick = () => {
        if (b.disabled) return;
        state.impl = b.getAttribute("data-bv-impl");
        render();
      };
    });
    const add = v.querySelector("#bvAddShot");
    if (add) add.onclick = async () => {
      if (!p) return;
      const s = D.project.addShot(p);
      state.shotId = s.id;
      try { await D.project.save(p); } catch (e) {}
      render();
    };
  }

  async function generate(ta, ratio) {
    const text = ta ? ta.value.trim() : "";
    if (!text) { U.toast("先描述你想拍的空间镜头", "warn"); return; }
    try {
      const p = D.project.blank({ title: text.length > 16 ? text.slice(0, 16) + "…" : text });
      state.pid = p.id;
      if (D.canvas) {
        D.canvas.addNode(p, "text", 60, 120, { text: text, title: "3D-BOX 提示词" });
        D.canvas.addNode(p, "video", 420, 120, { title: "空间镜头" });
      }
      p.output = p.output || {};
      p.output.ratio = (ratio && ratio.value) || state.ratio || "16:9";
      await D.project.save(p);
      if (D.manual && D.manual.load) await D.manual.load(p.id);
      if (XLX.app && XLX.app.go) XLX.app.go("drama");
    } catch (e) {
      U.toast((e && e.message) || "生成失败", "err");
    }
  }

  D.box3dview = { render, state, ensureProject, mountScene, currentShot, sceneReady, implSwitchHtml };
})();
