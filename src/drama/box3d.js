/* 铜龙电商 · AI 短剧工作台 · 3D-BOX 导演工具 */
/* 把「机位 / 灯光 / 角度」抽成统一取景接口（spec + provider），
   AI 生成是它的第一种实现；将来接真 3D 引擎时只需 register 一种新实现，上层不动。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  /* ============ 取景预设 ============ */

  /* 景别：多机位 9 宫格的行 */
  const SCALES = [
    { id: "wide", name: "全景", prompt: "全景，人物全身与环境，交代空间关系" },
    { id: "medium", name: "中景", prompt: "中景，人物半身，突出表演与动作" },
    { id: "close", name: "近景", prompt: "近景，人物面部特写，强化情绪" }
  ];

  /* 机位：9 宫格的列 */
  const CAMERAS = [
    { id: "eye", name: "平视", prompt: "平视机位，与人物视线齐平" },
    { id: "high", name: "俯拍", prompt: "俯拍机位，高角度向下俯视" },
    { id: "low", name: "仰拍", prompt: "仰拍机位，低角度向上仰视" }
  ];

  /* 大师运镜 */
  const MOVES = [
    { id: "push", name: "推近", prompt: "镜头缓慢推近，逐渐聚焦主体" },
    { id: "pull", name: "拉远", prompt: "镜头缓慢拉远，带出环境全貌" },
    { id: "pan", name: "横摇", prompt: "镜头水平横摇，平稳扫过场景" },
    { id: "tilt", name: "竖摇", prompt: "镜头垂直竖摇，自下而上" },
    { id: "track", name: "跟移", prompt: "镜头跟随人物平移，主体保持在画面中" },
    { id: "crane", name: "升降", prompt: "镜头升降运动，带出空间纵深" },
    { id: "orbit", name: "环绕", prompt: "镜头环绕主体旋转，多角度立体呈现" },
    { id: "handheld", name: "手持", prompt: "手持镜头，轻微晃动，纪实临场感" },
    { id: "dollyzoom", name: "希区柯克变焦", prompt: "希区柯克式变焦，主体不变、背景透视压缩" }
  ];

  /* 灯光 */
  const LIGHTS = [
    { id: "three-point", name: "三点布光", prompt: "标准三点布光，主光、辅光、轮廓光层次分明" },
    { id: "rembrandt", name: "伦勃朗光", prompt: "伦勃朗光，面部三角光，戏剧质感" },
    { id: "backlight", name: "逆光", prompt: "逆光拍摄，人物边缘发光，背景压暗" },
    { id: "top", name: "顶光", prompt: "顶部硬光，眼窝阴影，压迫感" },
    { id: "side", name: "侧光", prompt: "侧面光，明暗对比强，立体感突出" },
    { id: "neon", name: "霓虹", prompt: "霓虹灯光，冷暖撞色，都市夜色氛围" },
    { id: "golden", name: "黄金时刻", prompt: "黄金时刻自然光，暖金色调，柔和通透" },
    { id: "blue", name: "蓝调时刻", prompt: "蓝调时刻冷光，静谧克制" },
    { id: "candle", name: "烛光", prompt: "烛光照明，暖黄微光，明暗摇曳" }
  ];

  /* 多角度 */
  const ANGLES = [
    { id: "front", name: "正面", prompt: "正面视角" },
    { id: "face34", name: "3/4 侧", prompt: "四分之三侧脸视角" },
    { id: "side", name: "正侧", prompt: "正侧面视角" },
    { id: "back", name: "背面", prompt: "背面视角，展示背身与服装" },
    { id: "top", name: "俯视", prompt: "正上方俯视视角" },
    { id: "hero", name: "英雄低角", prompt: "低角度仰视，突出人物气势" }
  ];

  /* 9 宫格：景别 × 机位 */
  const GRID = [];
  SCALES.forEach(sc => CAMERAS.forEach(cm => {
    GRID.push({ id: sc.id + "-" + cm.id, scale: sc.id, camera: cm.id, name: sc.name + " · " + cm.name, prompt: sc.prompt + "，" + cm.prompt });
  }));

  /* 五个导演工具（面板 tab） */
  const TOOLS = [
    { id: "grid", name: "多机位 9 宫格", media: "image", desc: "同一主体，九种景别×机位并行出图，先定调再挑镜头" },
    { id: "move", name: "大师运镜", media: "video", desc: "按运镜模板生成带运镜的视频片段" },
    { id: "light", name: "灯光相机", media: "image", desc: "换布光方案，重塑画面氛围" },
    { id: "angle", name: "多角度", media: "image", desc: "同一主体多角度并行出图，补足不可见视角" },
    { id: "edit", name: "精准编辑", media: "video", desc: "按指令局部改写已有视频（依赖 Seedance 2.5）" }
  ];

  function toolOf(id) { return TOOLS.find(t => t.id === id) || TOOLS[0]; }
  function byId(list, id) { return list.find(x => x.id === id) || null; }

  /* ============ 统一取景接口 ============ */
  /* spec：无论机位/灯光/角度/运镜，都是同一种结构，provider 只认它。 */
  function spec(kind, item, extra) {
    item = item || {};
    return Object.assign({
      kind: kind,
      id: item.id || "",
      name: item.name || "",
      prompt: item.prompt || ""
    }, extra || {});
  }

  /* 新实现（真 3D 引擎等）在初始化时 register；未注册则用默认 AI 实现。 */
  const providers = {};
  let active = "ai";

  function register(id, impl) { if (id && impl) providers[id] = impl; }
  function setProvider(id) { if (providers[id]) active = id; }
  function currentProvider() { return providers[active] || providers.ai; }

  function mediaFor(toolId, project) {
    return toolOf(toolId).media;
  }

  /* 取景方案 → 完整提示词（统一接口的输入侧） */
  function promptFor(project, shot, sp) {
    const base = sp.kind === "move"
      ? D.character.buildVideoPrompt(project, shot)
      : D.character.buildImagePrompt(project, shot);
    return [base, sp.prompt].filter(Boolean).join("。");
  }

  /* 主体参考：优先本镜首帧，再补角色参考，最多 3 张，保证多角度/多机位是同一主体 */
  function refImagesFor(project, shot) {
    const out = [];
    if (shot.firstFrame) out.push(shot.firstFrame);
    D.character.refImagesForShot(project, shot).forEach(u => { if (u && out.indexOf(u) < 0) out.push(u); });
    return out.filter(Boolean).slice(0, 3);
  }

  const aiProvider = {
    id: "ai",
    label: "AI 生成（满血）",
    async render(project, shot, sp, opts) {
      opts = opts || {};
      const media = opts.media || (sp.kind === "move" ? "video" : "image");
      const prompt = promptFor(project, shot, sp);
      const ratio = opts.ratio || (project.output && project.output.ratio) || "9:16";
      if (media === "video") {
        if (!D.isConfigured("video")) throw D.err("NO_KEY", "尚未配置视频服务，请到「设置 → 短剧服务」填写");
        const refs = refImagesFor(project, shot);
        const r = await D.adapters.video.generate({
          prompt,
          firstFrame: shot.firstFrame || refs[0] || "",
          refImages: refs,
          refGroups: D.character.refGroupsForShot(project, shot),
          ratio,
          duration: opts.duration || shot.duration || 5,
          resolution: (project.output && project.output.resolution) === "1080p" ? "1080p" : "720p",
          model: project.videoModel
        }, opts.onProgress, opts.signal);
        return { url: await D.project.cacheRemote(r.url, { role: "box3dVideo" }), media: "video" };
      }
      if (!D.isConfigured("image")) throw D.err("NO_KEY", "尚未配置生图服务，请到「设置 → 短剧服务」填写");
      const r = await D.adapters.image.generate({
        prompt,
        ratio,
        refImages: refImagesFor(project, shot),
        refGroups: D.character.refGroupsForShot(project, shot),
        model: project.imageModel
      });
      return { url: await D.project.cacheRemote(r.url, { role: "box3dImage" }), media: "image" };
    }
  };
  register("ai", aiProvider);

  /* 执行单个取景方案（走当前实现） */
  function render(project, shot, sp, opts) {
    return currentProvider().render(project, shot, sp, opts);
  }

  /* 一组取景方案：并行调用，结果按传入顺序返回 */
  async function run(project, shot, specs, opts) {
    opts = opts || {};
    const list = (specs || []).slice();
    const results = new Array(list.length);
    const limit = Math.max(1, Math.min(opts.concurrency || 3, 5));
    let next = 0;
    let done = 0;
    async function worker() {
      while (next < list.length) {
        if (opts.signal && opts.signal.aborted) return;
        const i = next++;
        const sp = list[i];
        try {
          const r = await render(project, shot, sp, opts);
          results[i] = { spec: sp, url: r.url, media: r.media, error: "" };
        } catch (e) {
          results[i] = { spec: sp, url: "", media: opts.media || "", error: (e && e.message) || "生成失败" };
        }
        done++;
        if (opts.onStep) opts.onStep(done, list.length, sp);
      }
    }
    const workers = [];
    for (let k = 0; k < limit; k++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  /* 工具 → 取景方案列表 */
  function specsFor(toolId, opt) {
    opt = opt || {};
    if (toolId === "grid") return GRID.map(g => spec("camera", g, { scale: g.scale, camera: g.camera }));
    if (toolId === "move") {
      const m = byId(MOVES, opt.id) || MOVES[0];
      return [spec("move", m)];
    }
    if (toolId === "light") {
      const l = byId(LIGHTS, opt.id) || LIGHTS[0];
      return [spec("light", l)];
    }
    if (toolId === "angle") {
      const ids = (opt.angles && opt.angles.length) ? opt.angles : ANGLES.slice(0, 4).map(a => a.id);
      const list = ids.map(id => byId(ANGLES, id)).filter(Boolean);
      return (list.length ? list : ANGLES.slice(0, 4)).map(a => spec("angle", a));
    }
    return [];
  }

  /* ============ 本镜的 3D-BOX 记录 ============ */
  function emptyBox3d() {
    return {
      grid: [], angle: [],
      move: { id: "", name: "", url: "" },
      light: { id: "", name: "", url: "" },
      edit: { instruction: "", url: "" },
      updatedAt: 0
    };
  }

  function ensure(shot) {
    if (!shot) return emptyBox3d();
    if (!shot.box3d || typeof shot.box3d !== "object") shot.box3d = emptyBox3d();
    const b = shot.box3d;
    if (!Array.isArray(b.grid)) b.grid = [];
    if (!Array.isArray(b.angle)) b.angle = [];
    ["move", "light"].forEach(k => {
      if (!b[k] || typeof b[k] !== "object") b[k] = { id: "", name: "", url: "" };
      if (typeof b[k].id !== "string") b[k].id = "";
      if (typeof b[k].name !== "string") b[k].name = "";
      if (typeof b[k].url !== "string") b[k].url = "";
    });
    if (!b.edit || typeof b.edit !== "object") b.edit = { instruction: "", url: "" };
    if (typeof b.edit.instruction !== "string") b.edit.instruction = "";
    if (typeof b.edit.url !== "string") b.edit.url = "";
    if (typeof b.updatedAt !== "number") b.updatedAt = 0;
    return b;
  }

  function mapCells(items, nameOf) {
    return (items || []).filter(Boolean).map(r => ({
      id: (r.spec && r.spec.id) || "",
      name: nameOf(r.spec) || (r.spec && r.spec.name) || "",
      url: r.url || "",
      error: r.error || ""
    }));
  }

  /* 执行一个工具：编译取景方案 → 并行生成 → 落到本镜记录 */
  async function runTool(project, shot, toolId, opt) {
    opt = opt || {};
    if (toolId === "edit") return runEdit(project, shot, opt);
    const b = ensure(shot);
    const media = opt.media || mediaFor(toolId, project);
    const specs = specsFor(toolId, opt);
    if (!specs.length) throw D.err("BAD_PARAM", "这个工具还没有可用的取景方案");
    const res = await run(project, shot, specs, Object.assign({}, opt, { media }));
    if (toolId === "grid") {
      b.grid = mapCells(res, sp => sp.name);
    } else if (toolId === "angle") {
      b.angle = mapCells(res, sp => sp.name);
    } else if (toolId === "move" || toolId === "light") {
      const r = res[0] || {};
      b[toolId] = { id: (r.spec && r.spec.id) || "", name: (r.spec && r.spec.name) || "", url: r.url || "", error: r.error || "" };
    }
    b.updatedAt = Date.now();
    return res;
  }

  /* 精准编辑：以本镜既有视频为参考，按指令局部改写（依赖 Seedance 2.x） */
  async function runEdit(project, shot, opt) {
    opt = opt || {};
    const b = ensure(shot);
    const instruction = String((opt.instruction !== undefined && opt.instruction !== null ? opt.instruction : b.edit.instruction) || "").trim();
    if (!instruction) throw D.err("BAD_PARAM", "请先填写编辑指令");
    const cfg = D.getAdapterConfig("video");
    if (!/seedance-2/.test(String(cfg.model || ""))) {
      throw D.err("NEED_SEEDANCE2", "精准编辑依赖 Seedance 2.x（2.5），请把视频模型切到 Seedance 2.x");
    }
    if (!D.isConfigured("video")) throw D.err("NO_KEY", "尚未配置视频服务，请到「设置 → 短剧服务」填写");
    const ref = shot.videoUrl || (b.move && b.move.url) || "";
    if (!ref) throw D.err("NO_VIDEO", "本镜还没有视频素材，无法精准编辑");
    const r = await D.adapters.video.edit({
      prompt: instruction,
      referenceVideo: await D.project.toPublicUrl(ref),
      refDuration: Number(shot.duration) > 0 ? Number(shot.duration) : 5,
      model: cfg.model
    }, opt.onProgress, opt.signal);
    b.edit = { instruction, url: await D.project.cacheRemote(r.url, { role: "box3dEdit" }) };
    b.updatedAt = Date.now();
    return [{ spec: { id: "edit", name: instruction }, url: b.edit.url, error: "" }];
  }

  /* ============ 面板 ============ */
  const CSS = `
.bx-wrap{border:1px solid var(--border);border-radius:14px;background:var(--bg);overflow:hidden;display:flex;flex-direction:column;height:680px}
.bx-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);background:var(--panel)}
.bx-head b{font-size:14px}
.bx-head .bx-shot{font-size:12px;color:var(--text3)}
.bx-head .bx-impl{font-size:11px;color:var(--text3);margin-left:auto;border:1px solid var(--border);border-radius:99px;padding:3px 10px}
.bx-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--panel)}
.bx-tab{font-size:12px;padding:7px 13px;border-radius:9px;background:var(--card);border:1px solid var(--border);color:var(--text);cursor:pointer}
.bx-tab.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.bx-body{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
.bx-desc{font-size:12px;color:var(--text3);line-height:1.6}
.bx-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bx-chips{display:flex;flex-wrap:wrap;gap:6px}
.bx-chip{font-size:12px;padding:6px 11px;border-radius:99px;background:var(--card);border:1px solid var(--border);color:var(--text);cursor:pointer}
.bx-chip.on{border-color:var(--accent);color:var(--accent)}
.bx-grid{display:grid;gap:8px}
.bx-grid.g3{grid-template-columns:repeat(3,1fr)}
.bx-grid.g4{grid-template-columns:repeat(4,1fr)}
.bx-cell{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#0d1017;aspect-ratio:9/16;display:flex;flex-direction:column}
.bx-cell-media{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden}
.bx-cell-media img{width:100%;height:100%;object-fit:cover}
.bx-cell-cap{font-size:10px;color:var(--text3);text-align:center;padding:4px 2px;border-top:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bx-cell.err .bx-cell-media{color:#ff8080;font-size:10px;padding:6px;text-align:center}
.bx-preview{border:1px solid var(--border);border-radius:10px;background:#0d1017;overflow:hidden;min-height:180px;display:flex;align-items:center;justify-content:center}
.bx-preview img,.bx-preview video{max-width:100%;max-height:420px;display:block}
.bx-preview .bx-ph{color:var(--text3);font-size:12px;padding:18px}
.bx-prog{font-size:12px;color:var(--text3);padding:0 14px 10px}
.bx-note{font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding:8px 14px;background:var(--panel)}
`;

  function ensureCss() {
    if (document.getElementById("dramaBoxCss")) return;
    const s = document.createElement("style");
    s.id = "dramaBoxCss";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) { return D.ui.esc(s == null ? "" : String(s)); }

  function cellHTML(cell, emptyLabel) {
    if (cell && cell.error) {
      return '<div class="bx-cell err" title="' + esc(cell.error) + '"><div class="bx-cell-media">' + esc(cell.error) + "</div>" +
        '<div class="bx-cell-cap">' + esc(cell.name || emptyLabel || "") + "</div></div>";
    }
    const media = (cell && cell.url)
      ? '<img src="' + esc(cell.url) + '" alt="">'
      : '<span class="bx-ph">' + esc(emptyLabel || "待生成") + "</span>";
    const cap = (cell && cell.name) || emptyLabel || "";
    return '<div class="bx-cell"><div class="bx-cell-media">' + media + "</div>" +
      '<div class="bx-cell-cap">' + esc(cap) + "</div></div>";
  }

  function gridHTML(ctx) {
    const b = ensure(ctx.shot);
    const map = {};
    b.grid.forEach(c => { map[c.id] = c; });
    const cells = GRID.map(g => cellHTML(map[g.id], g.name)).join("");
    return '<div class="bx-desc">' + esc(toolOf("grid").desc) + "</div>" +
      '<div class="bx-row"><button class="btn small primary" data-bx-run="grid"' + (ctx.busy ? " disabled" : "") + ">" + (ctx.busy ? "生成中" : "九格并行出图") + "</button></div>" +
      '<div class="bx-grid g3">' + cells + "</div>";
  }

  function moveHTML(ctx) {
    const b = ensure(ctx.shot);
    const cur = b.move.url;
    const opts = MOVES.map(m => '<option value="' + esc(m.id) + '"' + (m.id === ctx.sel.move ? " selected" : "") + ">" + esc(m.name) + "</option>").join("");
    return '<div class="bx-desc">' + esc(toolOf("move").desc) + "</div>" +
      '<div class="bx-row"><select class="inp" id="bxMoveSel" style="width:auto">' + opts + "</select>" +
      '<button class="btn small primary" data-bx-run="move"' + (ctx.busy ? " disabled" : "") + ">" + (ctx.busy ? "生成中" : "生成运镜视频") + "</button></div>" +
      '<div class="bx-preview">' + (cur ? '<video src="' + esc(cur) + '" controls></video>' : '<span class="bx-ph">' + (b.move.error ? esc(b.move.error) : "尚未生成运镜视频") + "</span>") + "</div>";
  }

  function lightHTML(ctx) {
    const b = ensure(ctx.shot);
    const cur = b.light.url;
    const opts = LIGHTS.map(l => '<option value="' + esc(l.id) + '"' + (l.id === ctx.sel.light ? " selected" : "") + ">" + esc(l.name) + "</option>").join("");
    return '<div class="bx-desc">' + esc(toolOf("light").desc) + "</div>" +
      '<div class="bx-row"><select class="inp" id="bxLightSel" style="width:auto">' + opts + "</select>" +
      '<button class="btn small primary" data-bx-run="light"' + (ctx.busy ? " disabled" : "") + ">" + (ctx.busy ? "生成中" : "生成布光画面") + "</button></div>" +
      '<div class="bx-preview">' + (cur ? '<img src="' + esc(cur) + '" alt="">' : '<span class="bx-ph">' + (b.light.error ? esc(b.light.error) : "尚未生成布光画面") + "</span>") + "</div>";
  }

  function angleHTML(ctx) {
    const b = ensure(ctx.shot);
    const map = {};
    b.angle.forEach(c => { map[c.id] = c; });
    const chips = ANGLES.map(a => '<span class="bx-chip' + (ctx.sel.angles.indexOf(a.id) >= 0 ? " on" : "") + '" data-bx-angle="' + esc(a.id) + '">' + esc(a.name) + "</span>").join("");
    const selected = ANGLES.filter(a => ctx.sel.angles.indexOf(a.id) >= 0);
    const show = selected.length ? selected : ANGLES.slice(0, 4);
    const cells = show.map(a => cellHTML(map[a.id], a.name)).join("");
    return '<div class="bx-desc">' + esc(toolOf("angle").desc) + "</div>" +
      '<div class="bx-chips">' + chips + "</div>" +
      '<div class="bx-row"><button class="btn small primary" data-bx-run="angle"' + (ctx.busy ? " disabled" : "") + ">" + (ctx.busy ? "生成中" : "生成所选角度") + "</button></div>" +
      '<div class="bx-grid g4">' + cells + "</div>";
  }

  function editHTML(ctx) {
    const b = ensure(ctx.shot);
    const cur = b.edit.url;
    const ref = ctx.shot.videoUrl || (b.move && b.move.url) || "";
    return '<div class="bx-desc">' + esc(toolOf("edit").desc) + "</div>" +
      '<label class="label" style="margin-top:0">编辑指令</label>' +
      '<textarea class="inp" id="bxEditText" style="min-height:60px;font-size:12px" placeholder="例如：把外套换成红色，其余保持不变">' + esc(ctx.editText || b.edit.instruction) + "</textarea>" +
      '<div class="bx-row"><button class="btn small primary" data-bx-run="edit"' + (ctx.busy ? " disabled" : "") + ">" + (ctx.busy ? "生成中" : "生成编辑结果") + "</button>" +
      '<span class="bx-desc">' + (ref ? "将以本镜现有视频为参考" : "本镜还没有视频素材") + "</span></div>" +
      '<div class="bx-preview">' + (cur ? '<video src="' + esc(cur) + '" controls></video>' : '<span class="bx-ph">尚未生成编辑结果</span>') + "</div>";
  }

  function bodyHTML(ctx) {
    if (ctx.tool === "grid") return gridHTML(ctx);
    if (ctx.tool === "move") return moveHTML(ctx);
    if (ctx.tool === "light") return lightHTML(ctx);
    if (ctx.tool === "angle") return angleHTML(ctx);
    return editHTML(ctx);
  }

  function shellHTML(ctx) {
    const shot = ctx.shot;
    const tabs = TOOLS.map(t => '<button class="bx-tab' + (t.id === ctx.tool ? " on" : "") + '" data-bx-tab="' + esc(t.id) + '">' + esc(t.name) + "</button>").join("");
    const prov = currentProvider();
    return '<div class="bx-wrap">' +
      '<div class="bx-head"><b>3D-BOX 导演工具</b>' +
        '<span class="bx-shot">' + (shot ? "第 " + esc(shot.seq) + " 镜" : "无分镜") + "</span>" +
        '<span class="bx-impl">实现：' + esc((prov && (prov.label || prov.id)) || "AI 生成（满血）") + "</span></div>" +
      '<div class="bx-tabs">' + tabs + "</div>" +
      '<div class="bx-body" id="bxBody">' + bodyHTML(ctx) + "</div>" +
      '<div class="bx-prog" id="bxProg"></div>' +
      '<div class="bx-note">机位 / 灯光 / 角度 走同一套取景接口，当前实现为 AI 生成；接入真 3D 引擎时只需注册一种新实现，上层工具不变。</div>' +
    "</div>";
  }

  function setProg(ctx, text) {
    const el = ctx.el.querySelector("#bxProg");
    if (el) el.textContent = text || "";
  }

  function refresh(ctx) {
    ctx.el.innerHTML = shellHTML(ctx);
    bind(ctx);
  }

  function setBusy(ctx, on) {
    ctx.busy = !!on;
    refresh(ctx);
  }

  async function doRun(ctx, toolId) {
    const shot = ctx.shot;
    if (!shot) { U.toast("还没有分镜", "warn"); return; }
    if (ctx.busy) return;
    if (toolId === "move" || toolId === "light") {
      const sel = ctx.el.querySelector(toolId === "move" ? "#bxMoveSel" : "#bxLightSel");
      if (sel) ctx.sel[toolId] = sel.value;
    }
    if (toolId === "edit") {
      const ta = ctx.el.querySelector("#bxEditText");
      ctx.editText = ta ? ta.value : ctx.editText;
    }
    setBusy(ctx, true);
    setProg(ctx, "正在提交生成任务…");
    try {
      const opt = {
        media: mediaFor(toolId, ctx.p),
        id: ctx.sel[toolId],
        angles: ctx.sel.angles.slice(),
        instruction: ctx.editText,
        onStep: (done, total) => setProg(ctx, "生成中…（" + done + "/" + total + "）")
      };
      const res = await runTool(ctx.p, shot, toolId, opt);
      const failed = (res || []).filter(r => r && r.error).length;
      U.toast(failed ? "完成，失败 " + failed + " 项" : "生成完成", failed ? "warn" : "ok");
      if (ctx.opts.onChange) ctx.opts.onChange();
      setBusy(ctx, false);
      setProg(ctx, failed ? "失败 " + failed + " 项，可重试" : "完成");
    } catch (e) {
      setBusy(ctx, false);
      setProg(ctx, "");
      U.toast((e && e.message) || "生成失败", "err");
    }
  }

  function bind(ctx) {
    ctx.el.querySelectorAll("[data-bx-tab]").forEach(b => {
      b.onclick = () => { if (ctx.busy) return; ctx.tool = b.dataset.bxTab; refresh(ctx); };
    });
    ctx.el.querySelectorAll("[data-bx-run]").forEach(b => {
      b.onclick = () => doRun(ctx, b.dataset.bxRun);
    });
    ctx.el.querySelectorAll("[data-bx-angle]").forEach(c => {
      c.onclick = () => {
        if (ctx.busy) return;
        const id = c.dataset.bxAngle;
        const i = ctx.sel.angles.indexOf(id);
        if (i >= 0) ctx.sel.angles.splice(i, 1); else ctx.sel.angles.push(id);
        refresh(ctx);
      };
    });
    const ms = ctx.el.querySelector("#bxMoveSel");
    if (ms) ms.onchange = () => { ctx.sel.move = ms.value; };
    const ls = ctx.el.querySelector("#bxLightSel");
    if (ls) ls.onchange = () => { ctx.sel.light = ls.value; };
    const et = ctx.el.querySelector("#bxEditText");
    if (et) et.oninput = () => { ctx.editText = et.value; };
  }

  function shotById(p, sid) {
    return (p.shots || []).find(s => s.id === sid) || (p.shots || [])[0] || null;
  }

  function mount(el, project, opts) {
    if (!el) return null;
    try { ensureCss(); } catch (e) {}
    opts = opts || {};
    const ctx = {
      el, p: project, opts,
      tool: opts.tool || "grid",
      shotId: opts.shotId || "",
      busy: false,
      editText: "",
      sel: { move: MOVES[0].id, light: LIGHTS[0].id, angles: ANGLES.slice(0, 4).map(a => a.id) }
    };
    Object.defineProperty(ctx, "shot", { get: () => shotById(ctx.p, ctx.shotId) });
    refresh(ctx);
    return {
      refresh: () => refresh(ctx),
      setShot: (sid) => { ctx.shotId = sid; ctx.editText = ""; refresh(ctx); },
      setTool: (t) => { if (toolOf(t)) { ctx.tool = t; refresh(ctx); } },
      ctx
    };
  }

  D.box3d = {
    SCALES, CAMERAS, MOVES, LIGHTS, ANGLES, GRID, TOOLS,
    spec, promptFor, refImagesFor, render, run, specsFor, runTool, runEdit, ensure,
    register, setProvider, currentProvider,
    mount
  };
})();
