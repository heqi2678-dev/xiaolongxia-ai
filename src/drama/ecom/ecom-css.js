/* 铜龙电商 · 电商工作台 · 分区样式 */
/* 工作台切换器（外壳）+ 电商视图占位。加载即注入，幂等。 */
(function () {
  if (document.getElementById("ecomCss")) return;
  const s = document.createElement("style");
  s.id = "ecomCss";
  s.textContent = `
/* 顶层工作台切换器：短剧 / 电商 */
.shell-zones{display:flex;gap:6px;padding:12px 10px 2px}
.shell-zone{flex:1;padding:7px 4px;border:1px solid var(--border);background:transparent;color:var(--text3);border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
.shell-zone:hover{color:var(--text1);border-color:var(--accent)}
.shell-zone.active{background:var(--accent-grad);color:var(--accent-ink);border-color:transparent}

/* 电商视图占位 */
.ecom-ph{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:70px 24px;text-align:center}
.ecom-ph-ic{width:54px;height:54px;border-radius:16px;background:color-mix(in srgb,var(--accent) 14%,transparent);display:flex;align-items:center;justify-content:center;color:var(--accent2)}
.ecom-ph-ic svg{width:26px;height:26px}
.ecom-ph-t{font-size:16px;font-weight:800;color:var(--text1)}
.ecom-ph-d{font-size:12.5px;color:var(--text3)}

@media(max-width:600px){.shell-zones{padding:10px 8px 0}}
`;
  document.head.appendChild(s);
})();
