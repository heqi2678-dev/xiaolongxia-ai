/* 铜龙电商 · AI 短剧工作台 · 成片库（TV Show） */
/* 流水线产物与成片卡片网格；空态给「去流水线创作」入口。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  function view() { return document.getElementById("dwTvshow"); }

  const CSS = `
.tv-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.tv-head .tv-title{font-size:16px;font-weight:700}
.tv-head .tv-sub{font-size:11.5px;color:var(--text3)}
.tv-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
@media(max-width:980px){.tv-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:620px){.tv-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.tv-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column}
.tv-card:hover{border-color:var(--accent);transform:translateY(-2px)}
.tv-cover{width:100%;aspect-ratio:16/9;background:#0d1420;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px;overflow:hidden}
.tv-cover img{width:100%;height:100%;object-fit:cover}
.tv-body{padding:9px 11px 11px;display:flex;flex-direction:column;gap:4px}
.tv-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-time{font-size:11px;color:var(--text3)}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaTvshowCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function products() {
    return D.project.list().filter(p => p.mode === "pipeline" || p.source === "auto");
  }

  function card(p) {
    const cover = p.thumb && String(p.thumb).startsWith("asset:") ? "" : (p.thumb || "");
    const coverHtml = cover ? '<img src="' + D.ui.esc(cover) + '" alt="">' : "<span>暂无封面</span>";
    const when = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "";
    return '<div class="tv-card" data-tv-open="' + D.ui.esc(p.id) + '">' +
      '<div class="tv-cover">' + coverHtml + "</div>" +
      '<div class="tv-body">' +
        '<div class="tv-name">' + D.ui.esc(p.title || "未命名成片") + "</div>" +
        (when ? '<div class="tv-time">' + D.ui.esc(when) + "</div>" : "") +
      "</div>" +
    "</div>";
  }

  function head(count) {
    return '<div class="tv-head"><span class="tv-title">成片库</span>' +
      '<span class="tv-sub">流水线产物 · 共 ' + count + " 部</span>" +
      '<span style="flex:1"></span>' +
      '<button class="btn small primary" id="tvNew">去流水线创作</button>' +
    "</div>";
  }

  async function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    const list = products();
    const body = list.length
      ? '<div class="tv-grid">' + list.map(card).join("") + "</div>"
      : D.ui.emptyBox("成片库还是空的，去流水线跑一部吧。");
    v.innerHTML = '<div class="dw-wrap">' + head(list.length) + body + "</div>";
    bind(v);
  }

  function bind(v) {
    const nw = v.querySelector("#tvNew");
    if (nw) nw.onclick = createPipeline;
    v.querySelectorAll("[data-tv-open]").forEach(c => { c.onclick = () => open(c.dataset.tvOpen); });
  }

  async function open(pid) {
    try {
      if (D.auto && D.auto.open) await D.auto.open(pid);
      if (XLX.app && XLX.app.go) XLX.app.go("auto");
    } catch (e) {
      U.toast((e && e.message) || "打开成片失败", "err");
    }
  }

  async function createPipeline() {
    try {
      const p = D.project.blank({ title: "未命名成片", source: "auto", mode: "pipeline" });
      await D.project.save(p);
      if (D.auto && D.auto.open) await D.auto.open(p.id);
      if (XLX.app && XLX.app.go) XLX.app.go("auto");
    } catch (e) {
      U.toast((e && e.message) || "新建流水线失败", "err");
    }
  }

  D.tvshow = { render, open, createPipeline };
})();
