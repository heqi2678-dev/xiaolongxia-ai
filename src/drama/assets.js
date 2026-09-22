/* 铜龙电商 · AI 短剧工作台 · 资产页 */
/* 承载造型室的三视图 / 场景卡 / 多参考，资产卡片网格 + 类型筛选；并提供画布节点引用入口。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  /* 当前被画布节点引用的资产（供详情面板取用） */
  let picked = null;

  function view() { return document.getElementById("dwMakeup"); }

  const CSS = `
.as-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.as-head .as-title{font-size:16px;font-weight:700}
.as-head .as-sub{font-size:11.5px;color:var(--text3)}
.as-picked{font-size:11.5px;color:var(--accent2);border:1px solid var(--border);border-radius:999px;padding:4px 11px}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaAssetsCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  async function render() {
    D.ui.ensureCss();
    ensureCss();
    const v = view();
    if (!v) return;
    /* 造型室自带类型筛选（三视图 / 场景卡 / 多参考）与资产卡片网格，直接复用 */
    if (D.makeup && D.makeup.render) {
      await D.makeup.render();
      return;
    }
    v.innerHTML = '<div class="dw-wrap"><div class="dw-card">' + D.ui.esc("资产模块未加载") + "</div></div>";
  }

  async function load(pid) {
    if (D.makeup && D.makeup.load) return D.makeup.load(pid);
    return null;
  }

  /* 画布节点引用：记录所选资产，供详情面板作为参考图传入生成 */
  function pick(asset) {
    picked = asset || null;
    if (asset) U.toast("已选择资产，可在画布节点中引用", "ok");
    return picked;
  }
  function pickedRef() { return picked; }
  function clearPicked() { picked = null; }

  D.assets = {
    render, load, pick, pickedRef, clearPicked,
    get state() { return (D.makeup && D.makeup.state) || {}; }
  };
})();
