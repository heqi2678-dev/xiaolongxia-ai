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

/* 电商视图通用布局 */
.ecom-wrap{display:flex;flex-direction:column;gap:14px;padding:16px 18px 40px;max-width:1180px;margin:0 auto;width:100%}
.ecom-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ecom-spacer{flex:1}
.ecom-hint{font-size:12px;color:var(--text3)}
.ecom-link{background:none;border:none;color:var(--accent2);font-size:12.5px;font-weight:700;cursor:pointer;padding:2px 4px}
.ecom-link:hover{text-decoration:underline}
.ecom-mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--text2)}
.ecom-err{color:#e5533d;font-size:12.5px}
.ecom-empty{padding:22px 10px;text-align:center;color:var(--text3);font-size:12.5px}

/* 能力卡 */
.ecom-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.ecom-card{border:1px solid var(--border);border-radius:13px;background:var(--panel,rgba(255,255,255,.03));padding:14px;cursor:pointer;transition:border-color .15s,transform .15s}
.ecom-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.ecom-card-ic{width:38px;height:38px;border-radius:11px;background:color-mix(in srgb,var(--accent) 14%,transparent);display:flex;align-items:center;justify-content:center;color:var(--accent2);margin-bottom:9px}
.ecom-card-ic svg{width:20px;height:20px}
.ecom-card-t{font-size:14px;font-weight:800;color:var(--text1)}
.ecom-card-d{font-size:12px;color:var(--text3);margin-top:3px;line-height:1.5}

/* 概览数字 */
.ecom-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.ecom-tile{border:1px solid var(--border);border-radius:11px;background:var(--panel,rgba(255,255,255,.03));padding:12px 14px}
.ecom-tile-v{font-size:22px;font-weight:800;color:var(--text1);line-height:1.1}
.ecom-tile-k{font-size:12px;color:var(--text3);margin-top:4px}

/* 面板 */
.ecom-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ecom-panel{border:1px solid var(--border);border-radius:13px;background:var(--panel,rgba(255,255,255,.03));overflow:hidden}
.ecom-panel-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:800;color:var(--text1)}
.ecom-panel-b{padding:12px 14px;display:flex;flex-direction:column;gap:10px}

/* 行 */
.ecom-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--border);border-radius:10px}
.ecom-task-row{cursor:pointer}
.ecom-task-row:hover,.ecom-task-row.active{border-color:var(--accent)}
.ecom-row-main{flex:1;min-width:0}
.ecom-row-t{font-size:13px;font-weight:700;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ecom-row-d{font-size:11.5px;color:var(--text3);margin-top:2px}
.ecom-row-prog{width:120px;flex:none}

/* 进度条 */
.ecom-progress{height:7px;border-radius:6px;background:color-mix(in srgb,var(--text3) 22%,transparent);overflow:hidden}
.ecom-progress i{display:block;height:100%;background:var(--accent-grad,linear-gradient(90deg,var(--accent),var(--accent2)));border-radius:6px;transition:width .3s}

/* 状态徽标 */
.ecom-badge{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:color-mix(in srgb,var(--text3) 16%,transparent);color:var(--text2);white-space:nowrap}
.ecom-badge.st-running,.ecom-badge.st-queued,.ecom-badge.st-scheduled{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent2)}
.ecom-badge.st-succeeded,.ecom-badge.st-done{background:rgba(46,160,90,.16);color:#2ea05a}
.ecom-badge.st-partial,.ecom-badge.st-paused{background:rgba(214,158,46,.18);color:#d69e2e}
.ecom-badge.st-failed{background:rgba(229,83,61,.16);color:#e5533d}

/* 表单 */
.ecom-field{display:flex;flex-direction:column;gap:6px}
.ecom-label{font-size:12px;font-weight:700;color:var(--text2)}
.ecom-textarea{resize:vertical;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
.ecom-tabs{display:flex;gap:6px}
.ecom-tab{border:1px solid var(--border);background:transparent;color:var(--text3);border-radius:9px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer}
.ecom-tab.active{background:var(--accent-grad);color:var(--accent-ink);border-color:transparent}

/* 表格 */
.ecom-table{width:100%;border-collapse:collapse;font-size:12.5px}
.ecom-table th{text-align:left;color:var(--text3);font-weight:700;padding:7px 8px;border-bottom:1px solid var(--border)}
.ecom-table td{padding:8px;border-bottom:1px solid var(--border);color:var(--text1);vertical-align:middle}
.ecom-table tr:last-child td{border-bottom:none}

/* 商品库筛选与批量栏 */
.ecom-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ecom-filters .inp{max-width:200px}
.ecom-batchbar{flex-wrap:wrap}
.ecom-batchbar .inp{max-width:150px}
.ecom-ck{width:34px;text-align:center}
.ecom-cell-t{font-weight:700;color:var(--text1);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ecom-thumb{width:42px;height:42px;border-radius:8px;object-fit:cover;background:color-mix(in srgb,var(--text3) 14%,transparent);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3)}
.ecom-thumb-ph{font-size:10px}
.ecom-thumb-lg{width:120px;height:120px}
.ecom-ptable td .inp{max-width:120px}

/* 商品详情 */
.ecom-detail{display:flex;gap:14px;align-items:flex-start}
.ecom-detail-form{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ecom-sub-h{font-size:12.5px;font-weight:800;color:var(--text2);margin-top:6px}
.ecom-thumbs{display:flex;flex-wrap:wrap;gap:8px}

/* 素材库 */
.ecom-assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.ecom-asset{border:1px solid var(--border);border-radius:11px;overflow:hidden;position:relative;background:var(--panel,rgba(255,255,255,.03))}
.ecom-asset-ck{position:absolute;top:7px;left:7px;z-index:1;background:rgba(0,0,0,.4);border-radius:6px;padding:2px 4px}
.ecom-asset-thumb .ecom-thumb{width:100%;height:120px;border-radius:0}
.ecom-asset-meta{padding:8px 10px}
.ecom-asset-meta .ecom-row-t{font-size:12.5px}

/* 一键铺货向导 */
.ecom-steps{display:flex;gap:6px;flex-wrap:wrap}
.ecom-stepchip{display:flex;align-items:center;gap:7px;border:1px solid var(--border);background:transparent;border-radius:20px;padding:5px 13px;font-size:12.5px;font-weight:700;color:var(--text3);cursor:pointer}
.ecom-stepchip .n{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;background:color-mix(in srgb,var(--text3) 18%,transparent)}
.ecom-stepchip.active{border-color:var(--accent);color:var(--text1)}
.ecom-stepchip.active .n{background:var(--accent-grad);color:var(--accent-ink)}
.ecom-stepchip.done{color:var(--accent2)}
.ecom-choice{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--border);border-radius:10px;cursor:pointer}
.ecom-choice.active{border-color:var(--accent)}
.ecom-choice.disabled{opacity:.5;cursor:not-allowed}
.ecom-choice-main{min-width:0;display:flex;flex-direction:column;gap:2px}
.ecom-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:8px;max-height:360px;overflow:auto;padding:2px}
.ecom-lv{font-size:11.5px;font-weight:800;border-radius:7px;padding:2px 8px;white-space:nowrap}
.ecom-lv-pass{background:rgba(46,160,90,.16);color:#2ea05a}
.ecom-lv-warn{background:rgba(214,158,46,.18);color:#d69e2e}
.ecom-lv-fail{background:rgba(229,83,61,.16);color:#e5533d}
.ecom-pre{display:flex;flex-direction:column;gap:10px}
.ecom-pre-item{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;color:var(--text1)}
.ecom-kv{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--text2);border-bottom:1px dashed var(--border);padding:6px 0}
.ecom-kv b{color:var(--text1)}
.ecom-kv:last-child{border-bottom:none}

@media(max-width:760px){.ecom-detail{flex-direction:column}.ecom-detail-form{grid-template-columns:1fr}}

@media(max-width:760px){.ecom-grid2{grid-template-columns:1fr}.ecom-row-prog{display:none}}

@media(max-width:600px){.shell-zones{padding:10px 8px 0}}
`;
  document.head.appendChild(s);
})();
