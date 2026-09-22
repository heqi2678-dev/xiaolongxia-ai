/* 铜龙电商 · AI 短剧工作台 · 3D-BOX 独立页 */
/* 页内自选工程与分镜，挂载统一取景工具（多机位 / 大师运镜 / 灯光相机 / 多角度 / 精准编辑），产出写回所选工程。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  function view() { return document.getElementById("dramaBox3d"); }

  const CSS = `
.bv-wrap{max-width:1160px;margin:0 auto;padding:20px 16px 60px;width:100%}
.bv-head{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:16px}
.bv-head h1{font-size:22px;font-weight:800;margin:0 0 4px}
.bv-head p{margin:0;font-size:12px;color:var(--text3)}
.bv-picks{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto}
.bv-field{display:flex;flex-direction:column;gap:4px}
.bv-field label{font-size:11px;color:var(--text3)}
.bv-field select{background:var(--card);border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:12.5px;padding:8px 10px;min-width:180px}
.bv-empty{background:var(--panel);border:1px dashed var(--border);border-radius:14px;padding:40px 24px;text-align:center;color:var(--text3);font-size:13px}
@media(max-width:600px){
  .bv-wrap{padding:18px 12px 46px}
  .bv-head h1{font-size:19px}
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

  const state = { pid: "", shotId: "", view: null };

  function render() {
    ensureCss();
    const v = view();
    if (!v) return;
    const projects = D.project.list();
    if (!projects.length) {
      v.innerHTML = '<div class="bv-wrap"><div class="bv-head"><div><h1>3D-BOX 导演台</h1>'
        + '<p>多机位 9 宫格 · 大师运镜 · 灯光相机 · 多角度 · 精准编辑</p></div></div>'
        + '<div class="bv-empty">还没有工程，先去「项目」创建一个，再回来做 3D-BOX。</div></div>';
      state.pid = ""; state.shotId = ""; state.view = null;
      return;
    }
    const cur = projects.find(p => p.id === state.pid) || projects[0];
    state.pid = cur.id;
    const shots = cur.shots || [];
    if (!shots.some(s => s.id === state.shotId)) state.shotId = shots[0] ? shots[0].id : "";

    v.innerHTML = '<div class="bv-wrap">'
      + '<div class="bv-head"><div><h1>3D-BOX 导演台</h1>'
      + '<p>多机位 9 宫格 · 大师运镜 · 灯光相机 · 多角度 · 精准编辑</p></div>'
      + '<div class="bv-picks">'
      + '<div class="bv-field"><label>工程</label><select id="bvProj">'
      + projects.map(p => '<option value="' + D.ui.esc(p.id) + '"' + (p.id === state.pid ? " selected" : "") + '>' + D.ui.esc(p.title || "未命名") + "</option>").join("")
      + '</select></div>'
      + '<div class="bv-field"><label>分镜</label><select id="bvShot">'
      + (shots.length ? shots.map((s, i) => '<option value="' + D.ui.esc(s.id) + '"' + (s.id === state.shotId ? " selected" : "") + ">" + ("镜 " + (i + 1) + (s.prompt ? " · " + String(s.prompt).slice(0, 16) : "")) + "</option>").join("")
          : '<option value="">（该工程还没有分镜）</option>')
      + "</select></div>"
      + '</div></div>'
      + '<div id="bvBox"></div>'
      + "</div>";

    const ps = v.querySelector("#bvProj");
    if (ps) ps.onchange = () => { state.pid = ps.value; state.shotId = ""; render(); };
    const ss = v.querySelector("#bvShot");
    if (ss) ss.onchange = () => { state.shotId = ss.value; mountBox(); };

    mountBox();
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
