/* 电商工作台 · 分区样式（作用域 .ecom-ui，来自 UI 原型） */
/* 加载即注入，幂等。同时提供外壳的短剧/电商分区切换器样式。 */
(function () {
  if (document.getElementById("ecomCss")) return;
  const s = document.createElement("style");
  s.id = "ecomCss";
  s.textContent = `
/* 分区切换器 */
.shell-zones{display:flex;gap:6px;padding:14px 10px 4px}
.shell-zone{flex:1;padding:9px 4px;border:1px solid var(--border);background:transparent;color:var(--text3);border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
#sidebar[data-zone='ecom'] .shell-zones{flex-direction:column;gap:4px;padding:12px 8px 4px}
#sidebar[data-zone='ecom'] .shell-zone{width:100%;padding:8px 2px;border-radius:9px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shell-zone:hover{color:var(--text1);border-color:var(--accent)}
.shell-zone.active{background:var(--accent-grad);color:var(--accent-ink);border-color:transparent}

/* 工厂页面样式 */
.ecom-ui{--primary:#1c64f4;
    --primary-2:#3eb0ff;
    --primary-soft:rgba(28,100,244,.10);
    --bg:#ffffff;
    --card:#ffffff;
    --border:#ededed;
    --border-2:#e4e7ed;
    --text:#1a1a1a;
    --sub:#606266;
    --muted:#909399;
    --ok:#12b76a;
    --ok-soft:rgba(18,183,106,.10);
    --warn:#ff6000;
    --warn-soft:rgba(255,96,0,.10);
    --info:#1c64f4;
    --info-soft:rgba(28,100,244,.10);
    --glow:rgba(28,100,244,.18);
    --radius:14px;
    --shadow:0 1px 2px rgba(16,24,40,.04),0 10px 30px rgba(16,24,40,.06);
    --shadow-sm:0 1px 2px rgba(16,24,40,.05);}
.ecom-ui,.ecom-ui *,.ecom-ui *::before,.ecom-ui *::after{box-sizing:border-box}
.ecom-ui{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;padding:22px 26px 56px;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.ecom-ui .ic{width:18px;height:18px;flex:none;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ecom-ui .ic.sm{width:15px;height:15px}
.ecom-ui .ic.lg{width:22px;height:22px}
.ecom-ui /* ---------- sidebar ---------- */
  .sidebar{
    width:236px;flex:none;background:#fff;border-right:1px solid var(--border);
    display:flex;flex-direction:column;padding:16px 12px;
  }
.ecom-ui /* ---------- main ---------- */
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.ecom-ui .search{
    display:flex;align-items:center;gap:9px;background:var(--bg);border:1px solid transparent;
    border-radius:10px;padding:8px 13px;width:320px;color:var(--muted);
  }
.ecom-ui .search input{border:0;background:transparent;outline:0;font-size:13px;color:var(--text);width:100%}
.ecom-ui .search input::placeholder{color:var(--muted)}
.ecom-ui .top-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.ecom-ui .icon-btn:hover{background:#F7F8FA}
.ecom-ui .avatar{
    width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6D8BFF,#9B6DFF);
    color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px;flex:none;
  }
.ecom-ui .screen.active{display:block}
.ecom-ui .page-head{margin-bottom:20px}
.ecom-ui .page-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.2px}
.ecom-ui .page-head p{margin:5px 0 0;color:var(--sub);font-size:13px}
.ecom-ui .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}
.ecom-ui .sec-title{display:flex;align-items:center;justify-content:space-between;margin:26px 0 13px}
.ecom-ui .sec-title h2{margin:0;font-size:15.5px;font-weight:700}
.ecom-ui .sec-title a{color:var(--primary);font-size:13px;font-weight:600;text-decoration:none;cursor:pointer}
.ecom-ui /* ---------- dashboard ---------- */
  .feature-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.ecom-ui .feature{
    background:#fff;border:1px solid var(--border);border-radius:18px;padding:24px;
    box-shadow:var(--shadow);cursor:pointer;transition:transform .16s,box-shadow .16s,border-color .16s;
  }
.ecom-ui .feature:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(16,24,40,.10);border-color:#FFD9D0}
.ecom-ui .feature .fi{
    width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin-bottom:16px;
  }
.ecom-ui .fi.a{background:var(--primary-soft);color:var(--primary)}
.ecom-ui .fi.b{background:var(--info-soft);color:var(--info)}
.ecom-ui .fi.c{background:#F3ECFE;color:#8B5CF6}
.ecom-ui .fi.d{background:var(--ok-soft);color:var(--ok)}
.ecom-ui .feature h3{margin:0 0 6px;font-size:17px}
.ecom-ui .feature p{margin:0;color:var(--muted);font-size:13.5px;line-height:1.55}
.ecom-ui .feature .go{margin-top:14px;color:var(--primary);font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:5px}
.ecom-ui .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:16px}
.ecom-ui .stat{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow-sm)}
.ecom-ui .stat span{color:var(--muted);font-size:12.5px}
.ecom-ui .stat b{display:block;font-size:24px;font-weight:800;margin-top:6px;letter-spacing:-.5px}
.ecom-ui .stat .trend{font-size:12px;margin-top:5px;font-weight:600;color:var(--muted)}
.ecom-ui .trend.up{color:var(--ok)}
.ecom-ui .trend.down{color:var(--primary)}
.ecom-ui .proj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.ecom-ui .proj-empty{grid-column:1/-1;background:#fff;border:1px dashed var(--border-2);border-radius:var(--radius);padding:44px 18px;text-align:center;color:var(--muted);font-size:13.5px}
.ecom-ui .proj{background:#fff;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);cursor:pointer;transition:transform .16s,box-shadow .16s}
.ecom-ui .proj:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(16,24,40,.10)}
.ecom-ui .thumb{height:130px;position:relative;display:grid;place-items:center;color:#fff}
.ecom-ui .t1{background:linear-gradient(135deg,#FF9A6B,#FF4D2E)}
.ecom-ui .t2{background:linear-gradient(135deg,#6D8BFF,#9B6DFF)}
.ecom-ui .t3{background:linear-gradient(135deg,#41D1A6,#12B76A)}
.ecom-ui .proj-meta{padding:13px 15px}
.ecom-ui .proj-meta b{display:block;font-size:13.5px}
.ecom-ui .proj-meta span{font-size:11.5px;color:var(--muted)}
.ecom-ui .badge{position:absolute;top:10px;left:10px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;backdrop-filter:blur(4px)}
.ecom-ui .badge.ok{background:rgba(255,255,255,.9);color:var(--ok)}
.ecom-ui .badge.warn{background:rgba(255,255,255,.9);color:var(--warn)}
.ecom-ui .badge.info{background:rgba(255,255,255,.9);color:var(--info)}
.ecom-ui /* ---------- generic 2-col layout ---------- */
  .split{display:grid;grid-template-columns:360px 1fr;gap:18px;align-items:start}
.ecom-ui .panel{background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}
.ecom-ui .panel-body{padding:18px}
.ecom-ui .panel-head{padding:15px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px}
.ecom-ui .field{margin-bottom:17px}
.ecom-ui .field:last-child{margin-bottom:0}
.ecom-ui .field > label{display:block;font-size:12.5px;font-weight:600;color:var(--sub);margin-bottom:8px}
.ecom-ui .dropzone{
    border:1.5px dashed var(--border-2);border-radius:12px;background:#FAFBFC;padding:20px;text-align:center;cursor:pointer;transition:.16s;
  }
.ecom-ui .dropzone:hover{border-color:var(--primary);background:var(--primary-soft)}
.ecom-ui .dropzone .dz-ic{width:42px;height:42px;border-radius:11px;background:#fff;border:1px solid var(--border);display:grid;place-items:center;margin:0 auto 9px;color:var(--primary)}
.ecom-ui .dropzone b{font-size:13px}
.ecom-ui .dropzone p{margin:4px 0 0;font-size:11.5px;color:var(--muted)}
.ecom-ui .thumb-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.ecom-ui .slot{height:56px;border-radius:9px;background:linear-gradient(135deg,#FFE0D6,#FFC9B8);border:1px solid #FFD9D0;display:grid;place-items:center;color:var(--primary);font-size:18px}
.ecom-ui .slot.add{background:#FAFBFC;border:1.5px dashed var(--border-2);color:var(--muted)}
.ecom-ui .select{
    width:100%;border:1px solid var(--border-2);border-radius:10px;padding:9px 12px;font-size:13px;
    background:#fff;color:var(--text);display:flex;align-items:center;justify-content:space-between;cursor:pointer;
  }
.ecom-ui .chips{display:flex;flex-wrap:wrap;gap:8px}
.ecom-ui .chip{
    border:1px solid var(--border-2);border-radius:9px;padding:7px 12px;font-size:12.5px;cursor:pointer;color:var(--sub);
    background:#fff;transition:.14s;display:flex;align-items:center;gap:6px;
  }
.ecom-ui .chip:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .chip.on{background:var(--primary-soft);border-color:var(--primary);color:var(--primary);font-weight:600}
.ecom-ui .stepper{display:flex;align-items:center;gap:12px}
.ecom-ui .stepper button{width:32px;height:32px;border-radius:8px;border:1px solid var(--border-2);background:#fff;cursor:pointer;font-size:16px;color:var(--sub)}
.ecom-ui .stepper button:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .stepper span{font-weight:700;min-width:20px;text-align:center}
.ecom-ui .btn{
    border:0;border-radius:11px;padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer;transition:.15s;
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
  }
.ecom-ui .btn-primary{background:linear-gradient(135deg,var(--primary),var(--primary-2));color:#fff;width:100%;box-shadow:0 8px 18px rgba(255,77,46,.28)}
.ecom-ui .btn-primary:hover{filter:brightness(1.05)}
.ecom-ui .btn-ghost{background:#fff;border:1px solid var(--border-2);color:var(--sub)}
.ecom-ui .btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .result-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.ecom-ui .result-head h3{margin:0;font-size:15px}
.ecom-ui .result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.ecom-ui .result{
    aspect-ratio:1/1;border-radius:12px;border:1px solid var(--border);position:relative;overflow:hidden;
    box-shadow:var(--shadow-sm);
  }
.ecom-ui .result .ov{
    position:absolute;inset:auto 0 0 0;padding:10px;background:linear-gradient(transparent,rgba(0,0,0,.6));
    display:flex;gap:6px;justify-content:flex-end;opacity:0;transition:.15s;
  }
.ecom-ui .result:hover .ov{opacity:1}
.ecom-ui .ov button{width:30px;height:30px;border-radius:8px;border:0;background:rgba(255,255,255,.92);color:#333;display:grid;place-items:center;cursor:pointer}
.ecom-ui .ov button:hover{background:#fff;color:var(--primary)}
.ecom-ui .r1{background:linear-gradient(135deg,#FFD7A8,#FF9A6B)}
.ecom-ui .r2{background:linear-gradient(135deg,#CFE3FF,#7FA8FF)}
.ecom-ui .r3{background:linear-gradient(135deg,#D6F5E6,#6FD9AE)}
.ecom-ui .r4{background:linear-gradient(135deg,#E9DDFE,#B18CF5)}
.ecom-ui .r5{background:linear-gradient(135deg,#FFD9D0,#FF8A6B)}
.ecom-ui .r6{background:linear-gradient(135deg,#FFE9B8,#FFC44D)}
.ecom-ui .skeleton{background:#FBFBFC;border:1px dashed var(--border-2);display:grid;place-items:center;color:var(--muted);font-size:12px;gap:8px}
.ecom-ui .spinner{width:26px;height:26px;border:3px solid #EEE;border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.ecom-ui /* ---------- editor ---------- */
  .editor-wrap{background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.ecom-ui .toolbar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid var(--border);background:#fff}
.ecom-ui .tool{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:9px;border:1px solid transparent;color:var(--sub);cursor:pointer;font-size:12.5px;font-weight:500}
.ecom-ui .tool:hover{background:#F7F8FA;color:var(--text)}
.ecom-ui .tool.on{background:var(--primary-soft);color:var(--primary);border-color:#FFD9D0;font-weight:600}
.ecom-ui .tool-sep{width:1px;height:22px;background:var(--border);margin:0 6px}
.ecom-ui .editor-body{display:grid;grid-template-columns:210px 1fr 250px;height:560px}
.ecom-ui .epanel{border-right:1px solid var(--border);overflow:auto;padding:14px}
.ecom-ui .epanel.right{border-right:0;border-left:1px solid var(--border)}
.ecom-ui .epanel h4{margin:0 0 11px;font-size:12.5px;color:var(--muted);font-weight:700;letter-spacing:.3px}
.ecom-ui .block{
    display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:grab;
    background:#fff;font-size:12.5px;box-shadow:var(--shadow-sm);
  }
.ecom-ui .block:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .block .ic{color:var(--muted)}
.ecom-ui .canvas{background:#EDEFF3;overflow:auto;padding:26px;display:flex;justify-content:center}
.ecom-ui .artboard{width:330px;background:#fff;border-radius:6px;box-shadow:0 12px 34px rgba(16,24,40,.16);overflow:hidden}
.ecom-ui .ab-block{position:relative;border:2px solid transparent}
.ecom-ui .ab-block.sel{border-color:var(--primary)}
.ecom-ui .ab-block.sel::after{content:"";position:absolute;right:-5px;bottom:-5px;width:9px;height:9px;background:var(--primary);border-radius:2px}
.ecom-ui .ab-img{height:200px;background:linear-gradient(135deg,#FFE0C4,#FFB08A);display:grid;place-items:center;color:#B8654A;font-size:26px;font-weight:800}
.ecom-ui .ab-hero{padding:18px;text-align:center}
.ecom-ui .ab-hero h3{margin:0;font-size:19px;letter-spacing:.5px}
.ecom-ui .ab-hero p{margin:6px 0 0;font-size:12px;color:var(--muted)}
.ecom-ui .ab-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:14px;background:#FAFAFB}
.ecom-ui .ab-cell{background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;font-size:11px;color:var(--sub)}
.ecom-ui .ab-cell b{display:block;font-size:14px;color:var(--text);margin-bottom:2px}
.ecom-ui .ab-param{padding:14px}
.ecom-ui .ab-param .line{height:9px;border-radius:5px;background:#EEF0F3;margin-bottom:9px}
.ecom-ui .ab-param .line.s{width:60%}
.ecom-ui .inspector .field{margin-bottom:14px}
.ecom-ui .swatches{display:flex;gap:8px;flex-wrap:wrap}
.ecom-ui .sw{width:26px;height:26px;border-radius:8px;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1px var(--border-2)}
.ecom-ui .sw.on{box-shadow:0 0 0 2px var(--primary)}
.ecom-ui .layer{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:8px;font-size:12.5px;color:var(--sub);cursor:pointer}
.ecom-ui .layer:hover{background:#F7F8FA}
.ecom-ui .layer.on{background:var(--primary-soft);color:var(--primary);font-weight:600}
.ecom-ui /* ---------- detail-image generator ---------- */
  .gen-form textarea{width:100%;min-height:116px;border:1px solid var(--border-2);border-radius:10px;padding:11px 13px;font-family:inherit;font-size:13px;line-height:1.6;resize:vertical;outline:0;color:var(--text);background:#fff}
.ecom-ui .gen-form textarea::placeholder{color:var(--muted)}
.ecom-ui .gen-form textarea:focus{border-color:var(--primary)}
.ecom-ui .label-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.ecom-ui .label-row label{margin:0}
.ecom-ui .ai-write{color:var(--primary);font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;cursor:pointer}
.ecom-ui .ref-row{display:flex;align-items:center;gap:10px;border:1px solid var(--border-2);border-radius:10px;padding:10px 12px;margin-bottom:9px;cursor:pointer;transition:.14s}
.ecom-ui .ref-row:hover{border-color:var(--primary)}
.ecom-ui .ref-row .ri{width:30px;height:30px;border-radius:8px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;flex:none}
.ecom-ui .ref-row b{font-size:12.5px;display:block}
.ecom-ui .ref-row span{font-size:11px;color:var(--muted)}
.ecom-ui .ref-row .cnt{margin-left:auto;font-size:12px;color:var(--muted);font-weight:600}
.ecom-ui .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ecom-ui .gen-side{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px;min-height:520px}
.ecom-ui .gen-side h2{font-size:28px;font-weight:800;letter-spacing:-.4px;margin:0}
.ecom-ui .gen-side p{color:var(--sub);max-width:430px;margin:14px 0 0;font-size:13.5px;line-height:1.7}
.ecom-ui .gen-side .badge-row{display:flex;gap:8px;margin-top:28px;flex-wrap:wrap;justify-content:center}
.ecom-ui .mini-badge{background:#fff;border:1px solid var(--border);border-radius:20px;padding:7px 14px;font-size:12px;color:var(--sub);box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:6px}
.ecom-ui /* ---------- AI 作图 workspace ---------- */
  .genai{max-width:1080px;margin:0 auto}
.ecom-ui .genai-top{display:flex;align-items:center;justify-content:center;position:relative;margin:6px 0 32px}
.ecom-ui .genai-top .hist{position:absolute;left:0}
.ecom-ui .genai-brand{display:flex;align-items:center;gap:12px;font-size:26px;font-weight:800;letter-spacing:-.4px}
.ecom-ui .genai-brand .brand-mark{width:auto;min-width:42px;height:42px;padding:0 11px;font-size:15px;letter-spacing:.5px}
.ecom-ui .accent{background:linear-gradient(90deg,var(--primary),var(--primary-2));-webkit-background-clip:text;background-clip:text;color:transparent}
.ecom-ui .tool-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:28px}
.ecom-ui .tool-card{display:flex;align-items:center;gap:11px;justify-content:center;border:1px solid var(--border-2);background:#fff;border-radius:14px;padding:18px 14px;font-size:14.5px;font-weight:600;color:var(--sub);cursor:pointer;transition:.14s;box-shadow:var(--shadow-sm)}
.ecom-ui .tool-card:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .tool-card.on{background:var(--primary-soft);border-color:var(--primary);color:var(--primary)}
.ecom-ui .prompt-box{border:1.5px solid var(--primary);border-radius:16px;padding:16px;background:#fff;box-shadow:0 10px 30px rgba(255,77,46,.10)}
.ecom-ui .prompt-main{display:flex;gap:12px}
.ecom-ui .upload-slot{width:72px;height:72px;border-radius:12px;border:1.5px dashed var(--border-2);flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);gap:3px;cursor:pointer;font-size:11px;transition:.14s}
.ecom-ui .upload-slot:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .prompt-box textarea{flex:1;border:0;outline:0;resize:none;min-height:72px;font-family:inherit;font-size:14px;line-height:1.6;color:var(--text);background:transparent}
.ecom-ui .prompt-box textarea::placeholder{color:var(--muted)}
.ecom-ui .prompt-bar{display:flex;align-items:center;gap:10px;margin-top:14px}
.ecom-ui .pill{border:1px solid var(--border-2);border-radius:10px;padding:7px 12px;font-size:12.5px;color:var(--sub);display:flex;align-items:center;gap:6px;cursor:pointer;transition:.14s}
.ecom-ui .pill:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .send-btn{margin-left:auto;display:flex;align-items:center;gap:12px;width:auto;height:auto;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:inherit}
.ecom-ui .send-btn:hover,.ecom-ui .send-btn:disabled{transform:none;box-shadow:none;opacity:1}
.ecom-ui .send-btn .cost{color:var(--warn);font-weight:700;font-size:13px;white-space:nowrap;flex:none}
.ecom-ui .send-arrow{width:42px;height:42px;border-radius:50%;border:0;background:linear-gradient(135deg,var(--primary),var(--primary-2));color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 18px rgba(255,77,46,.32)}
.ecom-ui .send-arrow:hover{filter:brightness(1.05)}
.ecom-ui .insp-row{display:flex;gap:10px;flex-wrap:wrap}
.ecom-ui .insp-card{border:1px solid var(--border);background:#fff;border-radius:12px;padding:11px 15px;font-size:12.5px;color:var(--sub);box-shadow:var(--shadow-sm);cursor:pointer;transition:.14s}
.ecom-ui .insp-card:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui /* ---------- dual-mode editor ---------- */
  .seg{display:flex;background:#F2F3F5;border-radius:10px;padding:3px;gap:2px}
.ecom-ui .seg button{border:0;background:transparent;padding:7px 15px;border-radius:8px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;display:flex;align-items:center;gap:6px;transition:.14s}
.ecom-ui .seg button:hover{color:var(--text)}
.ecom-ui .seg button.on{background:#fff;color:var(--primary);box-shadow:var(--shadow-sm)}
.ecom-ui .stage{background:#EDEFF3;overflow:auto;min-width:0}
.ecom-ui .stage .ed-view{min-height:100%}
.ecom-ui .list-editor{padding:20px;display:flex;flex-direction:column;gap:10px}
.ecom-ui .module-row{display:flex;align-items:center;gap:12px;padding:12px 13px;border:1px solid var(--border);border-radius:12px;background:#fff;cursor:pointer;box-shadow:var(--shadow-sm);transition:.14s}
.ecom-ui .module-row:hover{border-color:var(--primary)}
.ecom-ui .module-row.on{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.ecom-ui .drag{color:#C2C7D0;cursor:grab;display:grid;place-items:center}
.ecom-ui .m-thumb{width:52px;height:52px;border-radius:9px;flex:none;display:grid;place-items:center;color:#fff}
.ecom-ui .m-info{min-width:0}
.ecom-ui .m-info b{font-size:13px;display:block}
.ecom-ui .m-info span{font-size:11.5px;color:var(--muted)}
.ecom-ui .m-actions{margin-left:auto;display:flex;gap:6px}
.ecom-ui .m-actions button{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--sub);display:grid;place-items:center;cursor:pointer}
.ecom-ui .m-actions button:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .add-module{border:1.5px dashed var(--border-2);border-radius:12px;padding:15px;text-align:center;color:var(--primary);cursor:pointer;font-weight:600;font-size:13px;background:#FAFBFC}
.ecom-ui .add-module:hover{background:var(--primary-soft)}
.ecom-ui .mode-tip{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;padding:0 0 14px}
.ecom-ui .square-canvas{padding:28px;display:flex;justify-content:center;align-items:flex-start}
.ecom-ui .sq-art{width:380px;height:380px;border-radius:8px;position:relative;overflow:hidden;box-shadow:0 12px 34px rgba(16,24,40,.16);background:linear-gradient(135deg,#FFF3EC,#FFE0D2)}
.ecom-ui .sq-el{position:absolute;border:1.5px dashed transparent;border-radius:6px;cursor:pointer}
.ecom-ui .sq-el:hover{border-color:#FFB9A6}
.ecom-ui .sq-el.sel{border-color:var(--primary)}
.ecom-ui .sq-prod{width:200px;height:200px;left:90px;top:92px;border-radius:50%;background:linear-gradient(135deg,#FF9A6B,#FF4D2E);display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px;box-shadow:0 18px 34px rgba(255,77,46,.32)}
.ecom-ui .sq-title{left:30px;top:26px;font-size:20px;font-weight:800;letter-spacing:.5px;color:#2A2A33}
.ecom-ui .sq-price{left:30px;bottom:28px;background:#111;color:#fff;padding:9px 15px;border-radius:10px;font-weight:800;font-size:18px}
.ecom-ui .sq-badge{top:26px;right:30px;background:var(--primary);color:#fff;padding:6px 12px;border-radius:20px;font-weight:700;font-size:12px}
.ecom-ui /* ---------- gallery ---------- */
  .filterbar{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.ecom-ui .grid-masonry{columns:4;column-gap:14px}
.ecom-ui .g-item{break-inside:avoid;margin-bottom:14px;border-radius:12px;overflow:hidden;position:relative;box-shadow:var(--shadow-sm);cursor:pointer;border:1px solid var(--border)}
.ecom-ui .g-item .ph{display:grid;place-items:center;color:#fff}
.ecom-ui .h1{height:190px}
.ecom-ui .h2{height:130px}
.ecom-ui .h3{height:240px}
.ecom-ui .h4{height:160px}
.ecom-ui .g-overlay{
    position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.62));
    opacity:0;transition:.18s;display:flex;align-items:flex-end;justify-content:space-between;padding:12px;color:#fff;
  }
.ecom-ui .g-item:hover .g-overlay{opacity:1}
.ecom-ui .g-overlay .acts{display:flex;gap:6px}
.ecom-ui .g-overlay .acts button{width:30px;height:30px;border-radius:8px;border:0;background:rgba(255,255,255,.94);color:#333;display:grid;place-items:center;cursor:pointer}
.ecom-ui .g-overlay .acts button:hover{color:var(--primary)}
.ecom-ui .g-overlay .tag{font-size:11px;background:rgba(0,0,0,.42);padding:3px 8px;border-radius:20px}
.ecom-ui .vbadge{position:absolute;top:9px;right:9px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 7px;border-radius:20px;display:flex;align-items:center;gap:4px}
.ecom-ui .pager{display:flex;justify-content:center;align-items:center;gap:6px;margin-top:24px}
.ecom-ui .pager button{min-width:34px;height:34px;border-radius:9px;border:1px solid var(--border-2);background:#fff;cursor:pointer;color:var(--sub);font-weight:600}
.ecom-ui .pager button.on{background:var(--primary);border-color:var(--primary);color:#fff}
.ecom-ui .pager button:hover:not(.on){border-color:var(--primary);color:var(--primary)}
.ecom-ui /* ---------- localization ---------- */
  .avatar-chips{display:flex;gap:8px;flex-wrap:wrap}
.ecom-ui .avchip{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--sub)}
.ecom-ui .avchip .bubble{width:46px;height:46px;border-radius:50%;border:2px solid transparent;display:grid;place-items:center;font-size:18px;color:#fff;background:linear-gradient(135deg,#FFB27A,#FF6B4A)}
.ecom-ui .avchip:nth-child(2) .bubble{background:linear-gradient(135deg,#9BB4FF,#6D8BFF)}
.ecom-ui .avchip:nth-child(3) .bubble{background:linear-gradient(135deg,#7FD8B4,#12B76A)}
.ecom-ui .avchip:nth-child(4) .bubble{background:linear-gradient(135deg,#C6A5FF,#8B5CF6)}
.ecom-ui .avchip.on .bubble{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.ecom-ui .avchip.on{color:var(--primary);font-weight:600}
.ecom-ui .switch{width:44px;height:25px;border-radius:20px;background:var(--primary);position:relative;cursor:pointer;flex:none}
.ecom-ui .switch::after{content:"";position:absolute;top:3px;right:3px;width:19px;height:19px;border-radius:50%;background:#fff;transition:.15s}
.ecom-ui .switch.off{background:#D7DAE0}
.ecom-ui .switch.off::after{right:calc(100% - 22px)}
.ecom-ui .switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ecom-ui .switch-row div b{font-size:13px;display:block}
.ecom-ui .switch-row div span{font-size:11.5px;color:var(--muted)}
.ecom-ui .phone-wrap{background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:24px;display:flex;justify-content:center;align-items:center;min-height:520px}
.ecom-ui .phone{width:270px;height:520px;border-radius:34px;background:#0E0F13;padding:10px;box-shadow:0 24px 60px rgba(16,24,40,.28)}
.ecom-ui .phone-screen{width:100%;height:100%;border-radius:26px;overflow:hidden;position:relative;background:linear-gradient(160deg,#2A1B14,#4A2A1C)}
.ecom-ui .notch{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:78px;height:20px;background:#0E0F13;border-radius:14px;z-index:3}
.ecom-ui .video-scene{position:absolute;inset:0;display:grid;place-items:center}
.ecom-ui .model{width:150px;height:300px;border-radius:80px 80px 30px 30px;background:linear-gradient(160deg,#FFC9A8,#E8875C);opacity:.92;box-shadow:0 20px 40px rgba(0,0,0,.35)}
.ecom-ui .vid-badges{position:absolute;top:16px;left:14px;display:flex;gap:5px;z-index:3}
.ecom-ui .flag{width:26px;height:18px;border-radius:4px;background:#fff;display:grid;place-items:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.ecom-ui .vid-side{position:absolute;right:11px;bottom:70px;display:flex;flex-direction:column;gap:15px;align-items:center;color:#fff;z-index:3}
.ecom-ui .vid-side .vb{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px}
.ecom-ui .vid-side .vb .ic{width:20px;height:20px;stroke-width:2}
.ecom-ui .caption{position:absolute;left:14px;right:60px;bottom:24px;color:#fff;z-index:3}
.ecom-ui .caption .sub{
    display:inline-block;background:rgba(255,255,255,.92);color:#111;font-size:12px;font-weight:700;
    padding:4px 9px;border-radius:7px;margin-bottom:6px;
  }
.ecom-ui .caption .name{font-weight:700;font-size:12.5px;display:block}
.ecom-ui .caption .desc{font-size:11px;color:rgba(255,255,255,.82);margin-top:2px}
.ecom-ui .gen-tag{position:absolute;top:16px;right:12px;background:var(--primary);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;z-index:3}
.ecom-ui .inner{max-width:1180px;margin:0 auto}

/* ===== 爱创AI 浅色主题（白底蓝字）===== */
.ecom-ui{--primary:#1c64f4;--primary-2:#3eb0ff;--primary-soft:rgba(28,100,244,.10);--bg:#ffffff;--card:#ffffff;--border:#ededed;--border-2:#e4e7ed;--text:#1a1a1a;--sub:#606266;--muted:#909399;--ok:#12b76a;--ok-soft:rgba(18,183,106,.10);--warn:#ff6000;--warn-soft:rgba(255,96,0,.10);--info:#1c64f4;--info-soft:rgba(28,100,244,.10);--glow:rgba(28,100,244,.18);--shadow:0 1px 2px rgba(16,24,40,.04),0 10px 30px rgba(16,24,40,.06);--shadow-sm:0 1px 2px rgba(16,24,40,.05);background:#f8f9fb;color:var(--text)}
.ecom-ui ::selection{background:rgba(28,100,244,.18);color:#1a1a1a}
.ecom-ui .sidebar,.ecom-ui .panel,.ecom-ui .card,.ecom-ui .feature,.ecom-ui .stat,
.ecom-ui .proj,.ecom-ui .editor-wrap,.ecom-ui .toolbar,.ecom-ui .block,.ecom-ui .artboard,
.ecom-ui .ab-cell,.ecom-ui .mini-badge,.ecom-ui .tool-card,.ecom-ui .insp-card,
.ecom-ui .module-row,.ecom-ui .m-actions button,.ecom-ui .pager button,.ecom-ui .phone-wrap,
.ecom-ui .ref-row,.ecom-ui .upload-slot,.ecom-ui .select,.ecom-ui .seg button.on{background:#fff;border:1px solid var(--border);-webkit-backdrop-filter:none;backdrop-filter:none}
.ecom-ui .feature:hover,.ecom-ui .proj:hover{border-color:rgba(28,100,244,.35);box-shadow:0 12px 30px rgba(28,100,244,.10)}
.ecom-ui .search,.ecom-ui .search input{background:#f5f7fa;color:var(--text)}
.ecom-ui .search{border:1px solid var(--border-2)}
.ecom-ui .gen-form textarea,.ecom-ui .prompt-box textarea{background:#fff;color:var(--text);border:1px solid var(--border-2)}
.ecom-ui .gen-form textarea:focus,.ecom-ui .prompt-box textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.ecom-ui .chip,.ecom-ui .pill,.ecom-ui .stepper button,.ecom-ui .btn-ghost,.ecom-ui .tool,
.ecom-ui .layer,.ecom-ui .m-actions button,.ecom-ui .pager button,
.ecom-ui .tool-card,.ecom-ui .insp-card{background:#fff;border-color:var(--border-2);color:var(--sub)}
.ecom-ui .chip:hover,.ecom-ui .pill:hover,.ecom-ui .stepper button:hover,.ecom-ui .btn-ghost:hover,
.ecom-ui .tool:hover,.ecom-ui .m-actions button:hover,.ecom-ui .pager button:hover:not(.on){border-color:var(--primary);color:var(--primary)}
.ecom-ui .tool:hover,.ecom-ui .layer:hover,.ecom-ui .icon-btn:hover{background:#f5f7fa}
.ecom-ui .chip.on,.ecom-ui .tool-card.on,.ecom-ui .tool.on,.ecom-ui .seg button.on,
.ecom-ui .layer.on,.ecom-ui .module-row.on,.ecom-ui .avchip.on .bubble{background:var(--primary-soft);border-color:var(--primary);color:var(--primary)}
.ecom-ui .seg{background:#f2f3f5}
.ecom-ui .seg button.on{background:#fff;color:var(--primary);box-shadow:var(--shadow-sm)}
.ecom-ui .canvas,.ecom-ui .stage{background:#f5f7fa;background-image:linear-gradient(rgba(28,100,244,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(28,100,244,.05) 1px,transparent 1px);background-size:22px 22px}
.ecom-ui .ab-row,.ecom-ui .list-editor{background:transparent}
.ecom-ui .ab-param .line{background:#eceef2}
.ecom-ui .ab-cell{background:#fff}
.ecom-ui .canvas .artboard{border:1px solid var(--border)}
.ecom-ui .sq-el:hover{border-color:rgba(28,100,244,.4)}
.ecom-ui .btn-primary{background:linear-gradient(135deg,var(--primary),var(--primary-2));color:#fff;box-shadow:0 8px 18px rgba(28,100,244,.28)}
.ecom-ui .send-arrow{background:linear-gradient(135deg,var(--primary),var(--primary-2));color:#fff;box-shadow:0 8px 18px rgba(28,100,244,.30)}
.ecom-ui .prompt-box{border:1.5px solid rgba(28,100,244,.45);background:#fff;box-shadow:0 10px 30px rgba(28,100,244,.10)}
.ecom-ui .dropzone{border:1.5px dashed var(--border-2);background:#fafbfc}
.ecom-ui .dropzone:hover{border-color:var(--primary);background:var(--primary-soft)}
.ecom-ui .dropzone .dz-ic{background:#fff;border:1px solid var(--border)}
.ecom-ui .feature:hover{border-color:#cfe0ff}
.ecom-ui .thumb{background:#eef1f5}
.ecom-ui .t1{background:linear-gradient(135deg,#1c64f4,#2e59ff)}
.ecom-ui .t2{background:linear-gradient(135deg,#6d8bff,#9b6dff)}
.ecom-ui .t3{background:linear-gradient(135deg,#3eb0ff,#3b82f6)}
.ecom-ui .r1{background:linear-gradient(135deg,#3b82f6,#1c64f4)}
.ecom-ui .r2{background:linear-gradient(135deg,#6d5cf6,#1c64f4)}
.ecom-ui .r3{background:linear-gradient(135deg,#3eb0ff,#3b82f6)}
.ecom-ui .r4{background:linear-gradient(135deg,#bc9eff,#1c64f4)}
.ecom-ui .r5{background:linear-gradient(135deg,#1c64f4,#3b82f6)}
.ecom-ui .r6{background:linear-gradient(135deg,#3eb0ff,#8eb2fa)}
.ecom-ui .slot{background:linear-gradient(135deg,#e8f0fe,#d7e6ff);border-color:#cfe0ff}
.ecom-ui .slot.add{background:#fafbfc;border:1.5px dashed var(--border-2)}
.ecom-ui .ab-img{background:linear-gradient(135deg,#e8f0fe,#cfe0ff);color:#3b6bd6}
.ecom-ui .sq-art{background:linear-gradient(135deg,#eef4ff,#e0ecff)}
.ecom-ui .sq-prod{background:linear-gradient(135deg,#1c64f4,#2e59ff);box-shadow:0 18px 34px rgba(28,100,244,.28)}
.ecom-ui .sq-title{color:#1a1a1a}
.ecom-ui .sq-price{background:#1a1a1a;color:#fff}
.ecom-ui .phone{background:#e9edf2}
.ecom-ui .phone-screen{background:linear-gradient(160deg,#dbe7ff,#eef4ff)}
.ecom-ui .model{background:linear-gradient(160deg,#7ea6ff,#3b82f6);opacity:.9}
.ecom-ui .avchip .bubble{background:linear-gradient(135deg,#1c64f4,#2e59ff)}
.ecom-ui .avchip:nth-child(2) .bubble{background:linear-gradient(135deg,#9bb4ff,#6d8bff)}
.ecom-ui .avatar{background:linear-gradient(135deg,#1c64f4,#6d5cf6)}
.ecom-ui .sw{border-color:#fff;box-shadow:0 0 0 1px var(--border-2)}
.ecom-ui .sw.on{box-shadow:0 0 0 2px var(--primary)}
.ecom-ui .skeleton{background:#f5f7fa;border:1px dashed var(--border-2)}
.ecom-ui .spinner{border:3px solid #e6e9ef;border-top-color:var(--primary)}
.ecom-ui .badge.ok,.ecom-ui .badge.warn,.ecom-ui .badge.info{background:rgba(255,255,255,.92)}.ecom-ui .brand-mark{width:42px;height:42px;border-radius:12px;flex:none;background:linear-gradient(135deg,var(--primary),var(--primary-2));display:grid;place-items:center;color:#fff;font-weight:800;font-size:20px;box-shadow:0 6px 14px rgba(28,100,244,.30)}
/* 艺术字：品牌/大标题渐变 + 加粗 */
.ecom-ui .genai-brand,.ecom-ui .gen-side h2,.ecom-ui .page-head h1{font-weight:900;letter-spacing:.5px}
.ecom-ui .accent,.ecom-ui .genai-brand .accent{background:linear-gradient(120deg,#1c64f4 0%,#3eb0ff 45%,#6d8bff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:.4px rgba(28,100,244,.10)}
.ecom-ui ::-webkit-scrollbar{width:10px;height:10px}
.ecom-ui ::-webkit-scrollbar-thumb{background:#d3d8e0;border-radius:8px}
.ecom-ui ::-webkit-scrollbar-thumb:hover{background:#b9c0cc}
.ecom-ui ::-webkit-scrollbar-track{background:transparent}
/* 电商视图滚动容器：桌面端默认被 .view{overflow:hidden} 裁掉，这里补回纵向滚动 */
#ecomHomeView,#ecomDrawView,#ecomDetailView,#ecomMainEditView,#ecomDetailEditView,#ecomLocalizeView,#ecomGalleryView{overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
#ecomHomeView>.ecom-ui,#ecomDrawView>.ecom-ui,#ecomDetailView>.ecom-ui,#ecomMainEditView>.ecom-ui,#ecomDetailEditView>.ecom-ui,#ecomLocalizeView>.ecom-ui,#ecomGalleryView>.ecom-ui{flex-shrink:0}
.ecom-ui .feature .fi .ic{width:26px;height:26px}
.ecom-ui .tool-card .ic{width:20px;height:20px}
/* 彩色双色填充：功能卡浅底 + 双色填充图标 */
.ecom-ui .feature .fi{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin-bottom:16px}
.ecom-ui .fi.a{color:#1c64f4;background:color-mix(in srgb,#1c64f4 13%,#fff)}
.ecom-ui .fi.b{color:#0ea5b7;background:color-mix(in srgb,#0ea5b7 13%,#fff)}
.ecom-ui .fi.c{color:#7c3aed;background:color-mix(in srgb,#7c3aed 13%,#fff)}
.ecom-ui .fi.d{color:#10b981;background:color-mix(in srgb,#10b981 13%,#fff)}
.ecom-ui .feature .fi-art{width:32px;height:32px;display:block}
.ecom-ui .feature .fi-art .t1{fill:currentColor}
.ecom-ui .feature .fi-art .t2{fill:currentColor;fill-opacity:.36}
.ecom-ui .tool-card .ic{width:20px;height:20px;color:var(--primary)}
.ecom-ui .g-empty,.ecom-ui .module-empty,.ecom-ui .layer-empty,.ecom-ui .sq-empty,.ecom-ui .ab-empty,.ecom-ui .phone-empty{color:var(--muted);font-size:13.5px}
.ecom-ui .g-empty{column-span:all;background:#fff;border:1px dashed var(--border-2);border-radius:var(--radius);padding:60px 18px;text-align:center}
.ecom-ui .module-empty{border:1px dashed var(--border-2);border-radius:var(--radius);padding:34px 18px;text-align:center}
.ecom-ui .layer-empty{padding:8px 2px}
.ecom-ui .sq-empty{width:380px;height:380px;border-radius:8px;border:1px dashed var(--border-2);background:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:18px}
.ecom-ui .ab-empty{padding:64px 20px;text-align:center}
.ecom-ui .phone-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:26px;color:rgba(255,255,255,.72);line-height:1.6}
.ecom-ui .page-head.hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 28px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(120deg,#f2f7ff 0%,#fbfdff 55%,#eef4ff 100%);box-shadow:var(--shadow);margin-bottom:22px;overflow:hidden}
.ecom-ui .page-head.hero .hero-copy{min-width:0}
.ecom-ui .hero-eyebrow{display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;color:var(--primary);background:var(--primary-soft);border-radius:20px;padding:5px 12px;margin-bottom:12px}
.ecom-ui .page-head.hero h1{font-size:24px}
.ecom-ui .page-head.hero p{margin-top:8px;max-width:520px}
.ecom-ui .hero-art{flex:none;width:320px;max-width:42%}
.ecom-ui .hero-art svg{width:100%;height:auto;display:block}
.ecom-ui .feature{padding:14px 14px 20px}
.ecom-ui .feature .fi-scene{border-radius:14px;overflow:hidden;margin-bottom:16px;aspect-ratio:8/5}
.ecom-ui .feature .fi-scene svg{width:100%;height:100%;display:block}
.ecom-ui .feature .fi-scene.has-photo{display:flex;align-items:center;gap:8px;padding:10px;background:linear-gradient(135deg,#eef4ff,#e5efff)}
.ecom-ui .fi-photo{flex:1 1 auto;height:100%;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 8px 20px rgba(28,100,244,.14)}
.ecom-ui .fi-photo img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .feature .fi-scene.has-photo .fi-arrow{flex:0 0 auto;width:26px;height:26px;display:block}
.ecom-ui .fi-thumb{flex:0 0 30%;height:72%;background:#fff;border-radius:12px;box-shadow:0 8px 20px rgba(28,100,244,.14);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:7px}
.ecom-ui .fi-thumb img{width:100%;flex:1;min-height:0;object-fit:contain;display:block}
.ecom-ui .fi-thumb em{font-style:normal;font-size:11px;font-weight:600;color:var(--muted);line-height:1}
.ecom-ui .feat-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.ecom-ui .feat-head .fi{width:40px;height:40px;border-radius:12px;margin:0}
.ecom-ui .feat-head .fi .fi-art{width:24px;height:24px}
.ecom-ui .feat-head h3{margin:0}
@media (max-width:1080px){.ecom-ui .hero-art{display:none}}

/* 真实商品照片：示例作品 / 详情拼贴 / 缩略图 / 瀑布流 / 手机预览 */
.ecom-ui .draw-gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.ecom-ui .draw-item{aspect-ratio:1/1;border-radius:14px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow-sm);cursor:pointer;background:#f5f7fa}
.ecom-ui .draw-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}
.ecom-ui .draw-item:hover img{transform:scale(1.05)}
.ecom-ui .gen-visual{display:flex;align-items:center;gap:14px;margin-top:34px}
.ecom-ui .gv-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:0 0 96px}
.ecom-ui .gv-inputs img{width:44px;height:44px;object-fit:cover;border-radius:9px;border:1px solid var(--border);background:#fff;display:block}
.ecom-ui .gv-arrow{flex:0 0 auto;color:#9db8e8;display:grid;place-items:center}
.ecom-ui .gv-output{flex:0 1 186px;border-radius:12px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow)}
.ecom-ui .gv-output img{width:100%;height:76px;object-fit:cover;display:block}
.ecom-ui .gv-output .gv-line{height:7px;border-radius:4px;background:#eef1f6;margin:9px 11px}
.ecom-ui .gv-output .gv-line.s{width:58%}
.ecom-ui .m-thumb img{width:100%;height:100%;object-fit:cover;display:block;border-radius:9px}
.ecom-ui .sq-prod img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.ecom-ui .ab-img img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .g-item .ph img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .phone-shot{position:absolute;inset:0;z-index:1}
.ecom-ui .phone-shot img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .phone-screen::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 45%,rgba(0,0,0,.55));z-index:2;pointer-events:none}
@media (max-width:1080px){.ecom-ui .draw-gallery{grid-template-columns:repeat(3,1fr)}}
/* ---------- AI 详情图：分区强调条 + 选择器图标 + 整套详情图拼贴 ---------- */
.ecom-ui .panel-head::before{content:"";width:3px;height:14px;border-radius:2px;background:var(--primary);flex:none}
.ecom-ui .field.sec>label::before,.ecom-ui .field.sec .label-row>label::before{content:"";display:inline-block;width:3px;height:12px;border-radius:2px;background:var(--primary);margin-right:7px;vertical-align:-1px}
.ecom-ui .select .sel-val{display:flex;align-items:center;gap:8px;min-width:0}
.ecom-ui .select .sel-ic{width:20px;height:20px;border-radius:6px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;flex:none}
.ecom-ui .select .sel-ic .ic{width:13px;height:13px}
.ecom-ui .seg.wide{width:100%}
.ecom-ui .seg.wide button{flex:1;justify-content:center}
.ecom-ui .gen-demo{display:flex;align-items:center;justify-content:center;gap:22px;margin-top:30px;flex-wrap:wrap}
.ecom-ui .gd-products{background:#fff;border:1px solid var(--border);border-radius:16px;padding:12px 12px 9px;box-shadow:var(--shadow);flex:none}
.ecom-ui .gd-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ecom-ui .gd-p{width:62px;height:62px;border-radius:12px;overflow:hidden;background:#f5f7fa;border:1px solid var(--border)}
.ecom-ui .gd-p img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .gd-label{display:block;text-align:center;font-size:12px;font-weight:700;color:var(--sub);margin-top:9px}
.ecom-ui .gd-arrow{width:56px;height:40px;color:var(--primary);flex:none}
.ecom-ui .gd-collage{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:440px;max-width:100%;background:#fff;border:1px solid var(--border);border-radius:16px;padding:8px;box-shadow:var(--shadow)}
.ecom-ui .gd-col{display:flex;flex-direction:column;gap:8px}
.ecom-ui .gd-panel{position:relative;border-radius:10px;overflow:hidden;background:#eef1f6}
.ecom-ui .gd-panel.hero{height:150px}
.ecom-ui .gd-panel.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .gd-panel.hero .gd-cap{position:absolute;inset:auto 0 0 0;padding:11px 10px;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff;text-align:left;z-index:2}
.ecom-ui .gd-panel.hero .gd-cap b{display:block;font-size:12px;font-weight:800;letter-spacing:.2px}
.ecom-ui .gd-panel.hero .gd-cap i{font-style:normal;font-size:10px;opacity:.86;margin-top:2px;display:block}
.ecom-ui .gd-panel.photo{height:120px}
.ecom-ui .gd-panel.photo img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .gd-panel.note{padding:11px 10px;min-height:96px;display:flex;flex-direction:column;justify-content:center;text-align:left}
.ecom-ui .gd-panel.note b{font-size:11.5px;font-weight:800;color:#23262d}
.ecom-ui .gd-panel.note>span{font-size:10px;color:#7a8291;margin-top:3px;line-height:1.4}
.ecom-ui .gd-panel.note em{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;font-style:normal}
.ecom-ui .gd-panel.note em i{font-style:normal;font-size:9.5px;font-weight:600;color:var(--primary);background:rgba(28,100,244,.10);border-radius:20px;padding:2px 7px}
.ecom-ui .gd-panel.t-warm{background:linear-gradient(135deg,#fff6e8,#fdeccf)}
.ecom-ui .gd-panel.t-pink{background:linear-gradient(135deg,#fdeef4,#fbdcea)}
.ecom-ui .gd-panel.t-blue{background:linear-gradient(135deg,#eef4ff,#dce8ff)}
.ecom-ui .gd-panel.t-green{background:linear-gradient(135deg,#eef8f1,#d8f0e1)}
@media (max-width:1080px){.ecom-ui .gd-arrow{display:none}.ecom-ui .gd-collage{width:100%}}

/* ===== 真实交互补充：输入框 / 图层 / 上传 / 结果卡 / 菜单 / 弹窗 / 项目卡 ===== */

/* 编辑器列表/画布视图 */
.ecom-ui .ed-view[hidden]{display:none !important}
.ecom-ui .ed-view.view-list,.ecom-ui .ed-view.view-canvas{display:block;min-height:100%}

/* 通用输入框 */
.ecom-ui .inp{
    width:100%;border:1px solid var(--border-2);border-radius:10px;padding:9px 12px;font-size:13px;
    color:var(--text);background:#fff;outline:0;font-family:inherit;line-height:1.5;resize:vertical;
  }
.ecom-ui .inp::placeholder{color:var(--muted)}
.ecom-ui .inp:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.ecom-ui .inp.mini{padding:8px 11px;font-size:12.5px}
.ecom-ui textarea.inp{min-height:72px}

/* 属性面板：图层列表 */
.ecom-ui .layers{display:flex;flex-direction:column;gap:4px;border:1px solid var(--border);border-radius:10px;padding:6px;background:#fff}
.ecom-ui .ed-empty{padding:26px 12px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--border-2);border-radius:10px;background:#fafbfc}
.ecom-ui .editor-body .block{cursor:pointer}
.ecom-ui .bg-pick{background:#fff}

/* 画布元素缩放手柄 */
.ecom-ui .sq-handle{
    position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;border-radius:3px;
    background:var(--primary);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.22);
    cursor:nwse-resize;z-index:5;
  }

/* 作图：参考图缩略条 */
.ecom-ui .up-strip{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ecom-ui .up-strip:empty{display:none}
.ecom-ui .up-thumb{position:relative;width:56px;height:56px;border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#f5f7fa}
.ecom-ui .up-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .up-del{
    position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:0;padding:0;
    background:rgba(0,0,0,.55);color:#fff;font-size:12px;line-height:1;display:grid;place-items:center;cursor:pointer;
  }
.ecom-ui .up-del:hover{background:var(--primary)}

/* 作图：结果区 + 生成态覆盖层 + 服务提示 */
.ecom-ui .draw-results{min-height:0}
.ecom-ui .draw-results:empty{display:none}
.ecom-ui .draw-item.gen{position:relative}
.ecom-ui .gen-overlay{
    position:absolute;inset:0;background:linear-gradient(transparent 45%,rgba(0,0,0,.62));opacity:0;transition:.18s;
    display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:10px;color:#fff;
  }
.ecom-ui .draw-item.gen:hover .gen-overlay{opacity:1}
.ecom-ui .gen-overlay .tag{font-size:11px;background:rgba(0,0,0,.42);padding:3px 8px;border-radius:20px;max-width:62%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ecom-ui .gen-overlay .acts{display:flex;gap:6px;flex:none}
.ecom-ui .gen-overlay .acts button{width:30px;height:30px;border-radius:8px;border:0;background:rgba(255,255,255,.94);color:#333;display:grid;place-items:center;cursor:pointer}
.ecom-ui .gen-overlay .acts button:hover{color:var(--primary)}
.ecom-ui .gen-hint{margin-left:auto;font-size:11.5px;color:var(--muted);max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ecom-ui .prompt-bar .send-btn{margin-left:10px}

/* 详情图：上传缩略图 + 加载态 */
.ecom-ui .gd-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px}
.ecom-ui .gd-thumbs:empty{display:none}
.ecom-ui .gd-thumb{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#f5f7fa}
.ecom-ui .gd-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .gd-load{
    position:absolute;inset:0;z-index:1;display:grid;place-items:center;padding:8px;text-align:center;
    font-size:12px;color:var(--sub);background:linear-gradient(135deg,#eef4ff,#dce8ff);
  }

/* 详情图：模块选择（AI规划 / 自选组合） */
.ecom-ui .gd-modules{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.ecom-ui .gd-mod-hint{font-size:12px;color:var(--muted);line-height:1.6;padding:10px 12px;background:#f7f9fc;border-radius:10px}
.ecom-ui .gd-mod{display:flex;align-items:center;gap:10px;border:1px solid var(--border-2);border-radius:10px;padding:9px 11px;cursor:pointer;transition:.14s;background:#fff}
.ecom-ui .gd-mod:hover{border-color:var(--primary)}
.ecom-ui .gd-mod.on{border-color:var(--primary);background:var(--primary-soft)}
.ecom-ui .gd-mod-main{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.ecom-ui .gd-mod-main b{font-size:12.5px;white-space:nowrap}
.ecom-ui .gd-mod-desc{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ecom-ui .gd-check{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--border-2);flex:none;display:grid;place-items:center;transition:.14s}
.ecom-ui .gd-check.on{background:var(--primary);border-color:var(--primary)}
.ecom-ui .gd-check.on::after{content:"";width:8px;height:4px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg);margin-top:-1px}
.ecom-ui .gd-mod .stepper{gap:8px;flex:none}
.ecom-ui .gd-mod .stepper button{width:26px;height:26px;font-size:14px}
.ecom-ui .gd-mod .stepper span{min-width:16px;font-size:13px}
.ecom-ui .gd-mod-total{margin-top:9px;font-size:12px;font-weight:700;color:var(--primary);text-align:right}

/* 历史上传 / 生成记录 */
.ecom-ui .hist-grid,.modal .hist-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.ecom-ui .hist-item,.modal .hist-item{border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;background:#fff;box-shadow:var(--shadow-sm);transition:.14s}
.ecom-ui .hist-item:hover,.modal .hist-item:hover{border-color:var(--primary);box-shadow:0 8px 20px rgba(28,100,244,.12)}
.ecom-ui .hist-item img,.modal .hist-item img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#f5f7fa}
.ecom-ui .hist-item span,.modal .hist-item span{display:block;font-size:11.5px;color:var(--sub);padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* 首页：CTA 行 + 最近项目卡 */
.ecom-ui .hero-cta{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.ecom-ui .project{background:#fff;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);cursor:pointer;transition:transform .16s,box-shadow .16s,border-color .16s}
.ecom-ui .project:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(28,100,244,.10);border-color:rgba(28,100,244,.35)}
.ecom-ui .proj-thumb{height:132px;display:grid;place-items:center;background:#eef2f7;color:var(--muted);overflow:hidden}
.ecom-ui .proj-thumb img{width:100%;height:100%;object-fit:cover;display:block}

/* 本地化：素材来源 */
.ecom-ui .loc-src{display:flex;align-items:center;gap:10px}
.ecom-ui .loc-thumb{
    width:56px;height:56px;border-radius:12px;flex:none;display:grid;place-items:center;overflow:hidden;
    border:1.5px dashed var(--border-2);background:#fafbfc;color:var(--muted);cursor:pointer;transition:.14s;
  }
.ecom-ui .loc-thumb:hover{border-color:var(--primary);color:var(--primary)}
.ecom-ui .loc-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .loc-src .inp{flex:1}

/* 作品库：排序选择器 */
.ecom-ui .sortsel{width:130px}
.ecom-ui .sortsel .ic{color:var(--muted)}

/* 按钮内加载指示 */
.ecom-ui .btn-spin{
    width:15px;height:15px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;
    display:inline-block;animation:spin .7s linear infinite;
  }
.ecom-ui .btn-ghost .btn-spin{border-color:rgba(28,100,244,.25);border-top-color:var(--primary)}

/* 弹出菜单（EC.ui.menu，挂在 body 下） */
.ecmenu{
    position:fixed;z-index:3000;min-width:150px;max-height:320px;overflow:auto;padding:6px;
    background:#fff;border:1px solid #ededed;border-radius:12px;box-shadow:0 12px 34px rgba(16,24,40,.16);
    color:#1a1a1a;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  }
.ecmenu-mi{padding:9px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;color:#606266}
.ecmenu-mi:hover{background:#f5f7fa;color:#1c64f4}
.ecmenu-mi.on{background:rgba(28,100,244,.10);color:#1c64f4;font-weight:600}
.ecmenu-sep{height:1px;background:#ededed;margin:5px 6px}

/* 弹窗（EC.ui.modal，挂在 body 下，独立变量作用域） */
.modal-mask{position:fixed;inset:0;z-index:3001;background:rgba(16,24,40,.45);display:flex;align-items:center;justify-content:center;padding:24px}
.modal{
    --primary:#1c64f4;--border:#ededed;--border-2:#e4e7ed;--text:#1a1a1a;--sub:#606266;--muted:#909399;
    --primary-soft:rgba(28,100,244,.10);--shadow-sm:0 1px 2px rgba(16,24,40,.05);
    width:100%;max-width:460px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;
    background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(16,24,40,.28);color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.5;
    animation:ecpop .16s ease-out;
  }
.modal,.modal *,.modal *::before,.modal *::after{box-sizing:border-box}
.modal-wide{max-width:760px}
@keyframes ecpop{from{transform:translateY(8px) scale(.98);opacity:0}to{transform:none;opacity:1}}
.modal-head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--border)}
.modal-head h3{margin:0;font-size:15.5px;font-weight:700}
.modal-close{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--sub);font-size:18px;line-height:1;cursor:pointer}
.modal-close:hover{color:var(--primary);border-color:var(--primary)}
.modal-body{padding:18px;overflow:auto}
.modal .field{margin-bottom:16px}
.modal .field>label{display:block;font-size:12.5px;font-weight:600;color:var(--sub);margin-bottom:8px}
.modal .inp{width:100%;border:1px solid var(--border-2);border-radius:10px;padding:9px 12px;font-size:13px;color:var(--text);background:#fff;outline:0;font-family:inherit;line-height:1.5;resize:vertical}
.modal .inp::placeholder{color:var(--muted)}
.modal .inp:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.modal .btn{border:0;border-radius:11px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.15s}
.modal .btn-primary{background:linear-gradient(135deg,var(--primary),#3eb0ff);color:#fff;box-shadow:0 6px 14px rgba(28,100,244,.22)}
.modal .btn-primary:hover{filter:brightness(1.05)}
.modal .btn-ghost{background:#fff;border:1px solid var(--border-2);color:var(--sub)}
.modal .btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
.modal-actions .btn{width:auto}
/* 组合类的补充/收敛 */
.ecom-ui .dropzone.gd-drop{margin-bottom:0}
.ecom-ui .pill.ratio{min-width:150px}
.ecom-ui .filterbar .g-dl-all,.ecom-ui .filterbar .g-clear{flex:none}
.ecom-ui .g-clear:hover{border-color:#ff4d4f;color:#ff4d4f}

/* 作图：模式模板 composer + 行内下拉 */
.ecom-ui .comp-line{flex:1;min-width:0;font-size:14px;line-height:2.15;color:var(--text)}
.ecom-ui .comp-sub{margin-top:8px;font-size:12.5px;color:var(--muted);line-height:1.6}
.ecom-ui .comp-extra{width:100%;border:1px solid var(--border-2);border-radius:10px;padding:9px 12px;margin-top:8px;font-family:inherit;font-size:13px;line-height:1.6;color:var(--text);resize:vertical;min-height:54px;outline:0;background:#fff}
.ecom-ui .comp-extra:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.ecom-ui .comp-extra::placeholder{color:var(--muted)}
.ecom-ui .comp-slots{display:flex;flex:none}
.ecom-ui .upload-slot.detail{margin-left:-10px}
.ecom-ui .inl-pill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:8px;background:rgba(28,100,244,.09);color:var(--primary);font-weight:600;font-size:13.5px;cursor:pointer;white-space:nowrap;transition:.14s}
.ecom-ui .inl-pill:hover{background:rgba(28,100,244,.17)}
.ecom-ui .inl-input{display:inline-block;min-width:72px;padding:2px 9px;border-radius:8px;border:1px dashed var(--border-2);color:var(--text);font-size:13.5px;text-align:center;outline:0;cursor:text}
.ecom-ui .inl-input:empty::before{content:attr(data-placeholder);color:var(--muted)}
.ecom-ui .inl-input:focus{border-color:var(--primary);border-style:solid}

/* 作图：比例 / 技能库浮层（挂在 body 下，class 复用 .ecmenu） */
.dc-pop{min-width:290px;max-height:min(70vh,520px);padding:14px}
.dc-pop .dc-title{font-size:12.5px;font-weight:700;color:#606266;margin:2px 0 9px}
.dc-pop .dc-title:not(:first-child){margin-top:15px}
.dc-pop .ratio-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.dc-pop .ratio-item{border:1px solid #e4e7ed;border-radius:9px;padding:8px 0;text-align:center;font-size:12.5px;color:#606266;cursor:pointer;transition:.14s}
.dc-pop .ratio-item:hover{border-color:#1c64f4;color:#1c64f4}
.dc-pop .ratio-item.on{background:rgba(28,100,244,.10);border-color:#1c64f4;color:#1c64f4;font-weight:700}
.dc-pop .quality-switch{display:flex;gap:8px}
.dc-pop .quality-item{flex:1;border:1px solid #e4e7ed;border-radius:9px;padding:8px 0;text-align:center;font-size:12.5px;color:#606266;cursor:pointer}
.dc-pop .quality-item.on{background:rgba(28,100,244,.10);border-color:#1c64f4;color:#1c64f4;font-weight:700}
.dc-pop .quality-item.is-disabled{opacity:.5;cursor:not-allowed}
.dc-pop .skill-lib{width:452px;max-width:74vw}
.dc-pop .skill-section{margin-bottom:14px}
.dc-pop .skill-section:last-child{margin-bottom:2px}
.dc-pop .skill-section-title{font-size:12.5px;font-weight:700;color:#1c64f4;margin:4px 0 9px}
.dc-pop .skill-list{display:flex;flex-wrap:wrap;gap:8px}
.dc-pop .skill-card{width:calc(50% - 4px);border:1px solid #e4e7ed;border-radius:10px;padding:9px 11px;cursor:pointer;transition:.14s;background:#fff}
.dc-pop .skill-card:hover{border-color:#1c64f4;background:rgba(28,100,244,.05)}
.dc-pop .skill-card-name{font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:3px}
.dc-pop .skill-card-preview{font-size:11.5px;color:#909399;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* 图生视频：发现灵感 · 一键同款 */
.ecom-ui .insp-section{border-top:1px solid var(--border);margin-top:20px;padding-top:6px}
.ecom-ui .insp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ecom-ui .i2v-insp{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;box-shadow:var(--shadow-sm);cursor:pointer;transition:.14s}
.ecom-ui .i2v-insp:hover{border-color:var(--primary);box-shadow:0 8px 20px rgba(28,100,244,.12);transform:translateY(-2px)}
.ecom-ui .i2v-insp-thumb{position:relative;aspect-ratio:4/3;background:#eef2f7;overflow:hidden}
.ecom-ui .i2v-insp-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .i2v-insp-play{position:absolute;right:8px;bottom:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;display:grid;place-items:center}
.ecom-ui .i2v-insp b{display:block;font-size:12.5px;font-weight:700;color:var(--text);padding:9px 11px}
@media (max-width:900px){.ecom-ui .insp-grid{grid-template-columns:repeat(2,1fr)}}

/* AI 作图：灵感推荐（一键同款） */
.ecom-ui .sec-sub{font-size:12px;color:var(--text-3);margin-left:8px}
.ecom-ui .insp-gallery{grid-template-columns:repeat(6,1fr)}
.ecom-ui .insp-card{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;box-shadow:var(--shadow-sm);cursor:pointer;transition:.14s;position:relative}
.ecom-ui .insp-card:hover{border-color:var(--primary);box-shadow:0 8px 20px rgba(28,100,244,.12);transform:translateY(-2px)}
.ecom-ui .insp-thumb{position:relative;aspect-ratio:1/1;background:#eef2f7;overflow:hidden}
.ecom-ui .insp-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ecom-ui .insp-tag{position:absolute;left:8px;bottom:8px;padding:2px 8px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;font-size:11px;line-height:1.6}
@media (max-width:900px){.ecom-ui .insp-gallery{grid-template-columns:repeat(3,1fr)}}

/* 工作台：AI 作图快捷模式条 */
.ecom-ui .mode-strip{margin:4px 0 22px}
.ecom-ui .mode-strip-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.ecom-ui .mode-strip-head h2{font-size:15px;font-weight:800;color:var(--text)}
.ecom-ui .mode-strip-head a{font-size:12.5px;color:var(--primary);cursor:pointer}
.ecom-ui .mode-strip-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.ecom-ui .mode-card{display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 6px;border:1px solid var(--border);border-radius:11px;background:#fff;color:var(--text2);font-size:12.5px;font-weight:700;cursor:pointer;transition:.14s}
.ecom-ui .mode-card:hover{border-color:var(--primary);color:var(--primary);box-shadow:0 8px 20px rgba(28,100,244,.10);transform:translateY(-2px)}
@media (max-width:900px){.ecom-ui .mode-strip-grid{grid-template-columns:repeat(3,1fr)}}

/* 视频翻译：字幕位置详细设置 */
.ecom-ui .sub-pos-entry{margin-top:10px}
.subpos-wrap{display:grid;grid-template-columns:1fr 210px;gap:20px;align-items:start}
.subpos-preview{border:1px solid var(--border);border-radius:12px;background:#0e0f13;padding:16px;display:flex;justify-content:center}
.subpos-frame{position:relative;width:180px;aspect-ratio:9/16;border-radius:8px;background:linear-gradient(160deg,#1d2433,#0e0f13)}
.subpos-bar{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.92);color:#101828;font-size:11px;font-weight:700;transition:left .12s,top .12s}
.subpos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.subpos-cell{aspect-ratio:1/1;border:1px solid #e4e7ed;border-radius:10px;display:grid;place-items:center;cursor:pointer;transition:.14s}
.subpos-cell i{width:9px;height:9px;border-radius:50%;background:#c7ccd6;transition:.14s}
.subpos-cell:hover{border-color:#1c64f4}
.subpos-cell.on{border-color:#1c64f4;background:rgba(28,100,244,.08)}
.subpos-cell.on i{background:#1c64f4}
.subpos-tip{margin-top:10px;font-size:12px;color:var(--muted);line-height:1.6}
.subpos-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}

/* 生成记录：视频缩略 */
.ecom-ui .hist-item video,.modal .hist-item video{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#0e0f13}
`;
  document.head.appendChild(s);
})();
