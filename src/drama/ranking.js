/* 铜龙电商 · AI 短剧工作台 · 模板排行（创作者挑战赛） */
/* 排行榜列表（名次 / 标题 / 来源），数据取技能清单与题材模板；点选以该项启动创作。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  function view() { return document.getElementById("dramaRanking"); }

  const CSS = `
.rk-wrap{max-width:900px;margin:0 auto;padding:22px 16px 60px;width:100%}
.rk-head{margin-bottom:18px}
.rk-head h1{font-size:22px;font-weight:800;margin:0 0 4px}
.rk-head p{margin:0;font-size:12px;color:var(--text3)}
.rk-list{display:flex;flex-direction:column;gap:8px}
.rk-item{display:flex;align-items:center;gap:14px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:11px 14px;cursor:pointer;transition:border-color .15s,transform .15s}
.rk-item:hover{border-color:var(--accent);transform:translateX(3px)}
.rk-rank{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex:none;background:var(--card);color:var(--text3)}
.rk-item:hover .rk-rank{background:var(--accent-grad);color:var(--accent-ink)}
.rk-item:nth-child(1) .rk-rank{background:linear-gradient(135deg,#f5c451,#f59e0b);color:#1a1200}
.rk-item:nth-child(2) .rk-rank{background:linear-gradient(135deg,#cbd5e1,#94a3b8);color:#111}
.rk-item:nth-child(3) .rk-rank{background:linear-gradient(135deg,#f0a878,#c2703c);color:#1a0d00}
.rk-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.rk-ic svg{width:18px;height:18px}
.rk-txt{flex:1;min-width:0}
.rk-name{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-desc{font-size:11.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-src{font-size:11px;color:var(--text3);border:1px solid var(--border);border-radius:999px;padding:3px 10px;flex:none}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaRankingCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ((XLX.ICONS && XLX.ICONS[name]) || "") + "</svg>";
  }

  function entries() {
    const out = [];
    (XLX.SKILLS || []).forEach(s => {
      out.push({ kind: "skill", id: s.id, name: s.name, desc: s.desc || "", icon: s.icon || "sparkle", color: "#38d9e6", src: "技能" });
    });
    (D.templates && D.templates.list ? D.templates.list() : []).forEach(t => {
      out.push({ kind: "tpl", id: t.id, name: t.name, desc: t.logline || t.tag || "", icon: "film", color: "#a78bfa", src: "题材模板" });
    });
    return out;
  }

  function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    const list = entries();
    v.innerHTML = '<div class="rk-wrap">' +
      '<div class="rk-head"><h1>创作者挑战赛 · 模板排行</h1><p>热门 Skill 与题材模板榜 · 共 ' + list.length + " 项</p></div>" +
      '<div class="rk-list">' + list.map((it, i) =>
        '<div class="rk-item" data-rk-kind="' + it.kind + '" data-rk-id="' + D.ui.esc(it.id) + '">' +
          '<div class="rk-rank">' + (i + 1) + "</div>" +
          '<div class="rk-ic" style="background:' + it.color + '22;color:' + it.color + '">' + svg(it.icon) + "</div>" +
          '<div class="rk-txt"><div class="rk-name">' + D.ui.esc(it.name) + "</div>" +
            '<div class="rk-desc">' + D.ui.esc(it.desc) + "</div></div>" +
          '<div class="rk-src">' + D.ui.esc(it.src) + "</div>" +
        "</div>"
      ).join("") + "</div>" +
    "</div>";
    v.querySelectorAll("[data-rk-kind]").forEach(el => { el.onclick = () => start(el.dataset.rkKind, el.dataset.rkId); });
  }

  async function start(kind, id) {
    if (kind === "skill") {
      const s = XLX.getSkill ? XLX.getSkill(id) : null;
      if (s && D.home && D.home.openSkill) { await D.home.openSkill(s); return; }
    }
    if (kind === "tpl") { await startTemplate(id); return; }
    U.toast("该条目不可用", "warn");
  }

  async function startTemplate(tid) {
    const tpl = D.templates.get(tid);
    if (!tpl) { U.toast("模板不存在", "warn"); return; }
    try {
      const p = D.project.blank({ title: tpl.name + "·" + new Date().toLocaleDateString(), genre: tpl.genre, mode: "manual", templateId: tpl.id });
      D.templates.apply(p, tpl);
      D.project.migrate(p);
      await D.project.save(p);
      U.toast("已按「" + tpl.name + "」建好工程", "ok");
      if (D.manual && D.manual.load) await D.manual.load(p.id);
      if (XLX.app && XLX.app.go) XLX.app.go("drama");
    } catch (e) {
      U.toast((e && e.message) || "套用模板失败", "err");
    }
  }

  D.ranking = { render, start };
})();
