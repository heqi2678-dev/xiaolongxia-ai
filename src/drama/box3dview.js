/* 铜龙电商 · AI 短剧工作台 · 3D-BOX 独立页（LibTV 形态） */
/* 顶部：一句话空间提示词 → 生成；场景灵感轮播；下方「我的 3D-BOX」自选工程与分镜，挂载统一取景工具。 */
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

  const state = { pid: "", shotId: "", view: null };

  const CSS = `
.bv-wrap{max-width:1160px;margin:0 auto;padding:20px 16px 60px;width:100%;display:flex;flex-direction:column;gap:22px}
.bv-hero h1{font-size:26px;font-weight:800;margin:0 0 6px}
.bv-hero p{margin:0;font-size:13px;color:var(--text3);line-height:1.7}
.bv-scenes{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
.bv-scene{flex:none;width:190px;border-radius:14px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:border-color .15s,transform .15s;background:var(--panel)}
.bv-scene:hover{border-color:var(--accent);transform:translateY(-3px)}
.bv-scene .bv-scover{aspect-ratio:16/10;display:flex;align-items:center;justify-content:center}
.bv-scene .bv-scover svg{width:26px;height:26px}
.bv-scene .bv-sn{padding:8px 10px;font-size:12.5px;font-weight:700}
.bv-prompt{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:14px}
.bv-prompt textarea{width:100%;background:none;border:none;outline:none;color:var(--text);font-size:14px;resize:none;min-height:64px;line-height:1.6;font-family:inherit}
.bv-prow{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.bv-sel{background:var(--card);border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:12.5px;padding:7px 9px}
.bv-auto{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:9px;padding:7px 12px;font-size:12.5px;cursor:pointer}
.bv-auto.on{border-color:var(--accent);color:var(--accent2)}
.bv-gen{margin-left:auto;border:none;border-radius:999px;background:var(--accent-grad);color:var(--accent-ink);font-size:13.5px;font-weight:700;padding:9px 24px;cursor:pointer}
.bv-egs{display:flex;gap:8px;flex-wrap:wrap}
.bv-eg{border:1px solid var(--border);background:var(--card);color:var(--text2);border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer}
.bv-eg:hover{border-color:var(--accent);color:var(--text)}
.bv-sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
.bv-sec-h h2{font-size:16px;font-weight:800;margin:0}
.bv-sec-h span{font-size:12px;color:var(--text3)}
.bv-picks{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.bv-field{display:flex;flex-direction:column;gap:4px}
.bv-field label{font-size:11px;color:var(--text3)}
.bv-field select{background:var(--card);border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:12.5px;padding:8px 10px;min-width:180px}
.bv-empty{background:var(--panel);border:1px dashed var(--border);border-radius:14px;padding:40px 24px;text-align:center;color:var(--text3);font-size:13px}
@media(max-width:600px){
  .bv-wrap{padding:18px 12px 46px;gap:18px}
  .bv-hero h1{font-size:20px}
  .bv-scene{width:150px}
  .bv-picks{margin-left:0;width:100%}
  .bv-field{flex:1}
  .bv-field select{min-width:0;width:100%}
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
      + '<p>把平面分镜变成可运镜的 3D 空间：多机位 9 宫格 · 大师运镜 · 灯光相机 · 多角度 · 精准编辑</p></div>';
  }

  function scenesHtml() {
    return '<div class="bv-scenes">' + SCENES.map(s =>
      '<div class="bv-scene" data-bv-scene="' + D.ui.esc(s.id) + '" data-bv-prompt="' + D.ui.esc(s.prompt) + '">' +
        '<div class="bv-scover" style="background:linear-gradient(135deg,' + s.color + '33,' + s.color + '0d);color:' + s.color + '">' + svg("box", 26) + "</div>" +
        '<div class="bv-sn">' + D.ui.esc(s.name) + "</div>" +
      "</div>"
    ).join("") + "</div>";
  }

  function promptHtml() {
    return '<div class="bv-prompt">' +
      '<textarea id="bvPrompt" placeholder="描述你想拍的空间镜头，例如：雨夜街头，霓虹灯下人物回头，慢镜头推进"></textarea>' +
      '<div class="bv-prow">' +
        '<select class="bv-sel" id="bvRatio"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option></select>' +
        '<button class="bv-auto on" id="bvAuto">自动</button>' +
        '<button class="bv-gen" id="bvGen">生成</button>' +
      "</div>" +
    "</div>";
  }

  function examplesHtml() {
    return '<div class="bv-egs">' + EXAMPLES.map(t =>
      '<button class="bv-eg" data-bv-eg="' + D.ui.esc(t) + '">' + D.ui.esc(t) + "</button>"
    ).join("") + "</div>";
  }

  function consoleHtml(projects, cur, shots) {
    return '<div class="bv-sec"><div class="bv-sec-h"><h2>我的 3D-BOX</h2><span>选工程与分镜，进入导演工具</span></div>'
      + '<div class="bv-picks">'
      + '<div class="bv-field"><label>工程</label><select id="bvProj">'
      + projects.map(p => '<option value="' + D.ui.esc(p.id) + '"' + (p.id === state.pid ? " selected" : "") + '>' + D.ui.esc(p.title || "未命名") + "</option>").join("")
      + '</select></div>'
      + '<div class="bv-field"><label>分镜</label><select id="bvShot">'
      + (shots.length ? shots.map((s, i) => '<option value="' + D.ui.esc(s.id) + '"' + (s.id === state.shotId ? " selected" : "") + ">" + ("镜 " + (i + 1) + (s.prompt ? " · " + String(s.prompt).slice(0, 16) : "")) + "</option>").join("")
          : '<option value="">（该工程还没有分镜）</option>')
      + "</select></div>"
      + '</div>'
      + '<div id="bvBox"></div>'
      + "</div>";
  }

  function render() {
    ensureCss();
    const v = view();
    if (!v) return;
    const projects = D.project.list();
    const head = heroHtml() + scenesHtml() + promptHtml() + examplesHtml();
    if (!projects.length) {
      state.pid = ""; state.shotId = ""; state.view = null;
      v.innerHTML = '<div class="bv-wrap">' + head
        + '<div class="bv-sec"><div class="bv-sec-h"><h2>我的 3D-BOX</h2></div>'
        + '<div class="bv-empty">还没有工程，先用上方提示词生成一个，或去「项目」创建一个。</div></div></div>';
      bind(v);
      return;
    }
    const cur = projects.find(p => p.id === state.pid) || projects[0];
    state.pid = cur.id;
    const shots = cur.shots || [];
    if (!shots.some(s => s.id === state.shotId)) state.shotId = shots[0] ? shots[0].id : "";

    v.innerHTML = '<div class="bv-wrap">' + head + consoleHtml(projects, cur, shots) + "</div>";
    bind(v);
    mountBox();
  }

  function bind(v) {
    const ta = v.querySelector("#bvPrompt");
    v.querySelectorAll("[data-bv-scene]").forEach(c => {
      c.onclick = () => { if (ta) ta.value = c.dataset.bvPrompt; };
    });
    v.querySelectorAll("[data-bv-eg]").forEach(b => {
      b.onclick = () => { if (ta) ta.value = b.dataset.bvEg; };
    });
    const auto = v.querySelector("#bvAuto");
    if (auto) auto.onclick = () => auto.classList.toggle("on");
    const gen = v.querySelector("#bvGen");
    if (gen) gen.onclick = () => generate(ta, v.querySelector("#bvRatio"));
    const ps = v.querySelector("#bvProj");
    if (ps) ps.onchange = () => { state.pid = ps.value; state.shotId = ""; render(); };
    const ss = v.querySelector("#bvShot");
    if (ss) ss.onchange = () => { state.shotId = ss.value; mountBox(); };
  }

  async function generate(ta, ratio) {
    const text = ta ? ta.value.trim() : "";
    if (!text) { U.toast("先描述你想拍的空间镜头", "warn"); return; }
    try {
      const p = D.project.blank({ title: text.length > 16 ? text.slice(0, 16) + "…" : text });
      if (D.canvas) {
        D.canvas.addNode(p, "text", 60, 120, { text: text, title: "3D-BOX 提示词" });
        D.canvas.addNode(p, "video", 420, 120, { title: "空间镜头" });
      }
      p.output = p.output || {};
      p.output.ratio = (ratio && ratio.value) || "16:9";
      await D.project.save(p);
      if (D.manual && D.manual.load) await D.manual.load(p.id);
      if (XLX.app && XLX.app.go) XLX.app.go("drama");
    } catch (e) {
      U.toast((e && e.message) || "生成失败", "err");
    }
  }

  function mountBox() {
    const host = document.getElementById("bvBox");
    if (!host) return;
    const p = D.project.get(state.pid);
    if (!p || !state.shotId) { host.innerHTML = ""; state.view = null; return; }
    state.view = D.box3d.mount(host, p, {
      shotId: state.shotId,
      tool: "grid",
      onChange: () => D.project.save(p)
    });
  }

  async function load(pid, shotId) {
    if (pid) state.pid = pid;
    if (shotId) state.shotId = shotId;
    render();
  }

  D.box3dview = { render, load, state };
})();
