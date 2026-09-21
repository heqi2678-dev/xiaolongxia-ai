/* 铜龙电商 · AI 短剧工作台 · 角色卡与一致性提示词 */
(function () {
  const D = XLX.drama;

  function styleDef(styleId) {
    return (D.STYLES || []).find(s => s.id === styleId) || (D.STYLES || [])[0] || { prompt: "" };
  }

  function stylePrompt(styleId) {
    return styleDef(styleId).prompt || "";
  }

  function motionPrompt(motionId) {
    const m = (D.MOTIONS || []).find(x => x.id === motionId);
    return m ? m.name : "";
  }

  function rolesForShot(project, shot) {
    const ids = shot.roleIds || [];
    return (project.characters || []).filter(c => ids.indexOf(c.id) >= 0);
  }

  /* 外观细分子字段：固定顺序，让「每次描述一模一样」在结构上可控 */
  const DETAIL_FIELDS = [
    { key: "age", label: "年龄" },
    { key: "hair", label: "发型发色" },
    { key: "eyes", label: "瞳色" },
    { key: "outfit", label: "服装" },
    { key: "accessory", label: "配饰" }
  ];

  function details(c) { return (c && c.details) || {}; }

  function detailText(c) {
    const d = details(c);
    return DETAIL_FIELDS.map(f => {
      const v = String(d[f.key] || "").trim();
      return v ? f.label + "：" + v : "";
    }).filter(Boolean).join("，");
  }

  /* 外观总述 + 细分，供提示词与完整性检查共用 */
  function displayAppearance(c) {
    const base = String((c && c.appearance) || "").trim();
    const det = detailText(c);
    return [base, det].filter(Boolean).join("，");
  }

  function characterBlock(c) {
    const bits = [];
    if (c.name) bits.push(c.name);
    if (c.identity) bits.push("身份：" + c.identity);
    const ap = displayAppearance(c);
    if (ap) bits.push("外观：" + ap);
    return bits.join("，");
  }

  /* 漫剧/图片：画风 + 角色设定 + 本镜动作，供图像适配器 */
  function buildImagePrompt(project, shot) {
    const parts = [];
    const sp = stylePrompt(project.style);
    if (sp) parts.push(sp);
    const roles = rolesForShot(project, shot);
    if (roles.length) parts.push("角色设定：" + roles.map(characterBlock).join("；"));
    if (shot.prompt) parts.push(shot.prompt);
    const note = refNote(project, shot);
    if (note) parts.push(note);
    const mo = motionPrompt(shot.motion);
    if (mo) parts.push("画面构图便于" + mo);
    parts.push("竖屏短剧分镜，人物五官稳定，同一角色前后一致");
    return parts.filter(Boolean).join("。");
  }

  /* 仿真人/视频：真实感 + 角色设定 + 本镜动作，供视频适配器 */
  function buildVideoPrompt(project, shot) {
    const parts = [];
    parts.push("电影级写实摄影，真实皮肤质感，自然光，浅景深，表演自然连贯");
    const roles = rolesForShot(project, shot);
    if (roles.length) parts.push("人物：" + roles.map(characterBlock).join("；"));
    if (shot.prompt) parts.push(shot.prompt);
    const note = refNote(project, shot);
    if (note) parts.push(note);
    const mo = motionPrompt(shot.motion);
    if (mo) parts.push("镜头" + mo);
    parts.push("口型自然，避免面部畸变与手指畸变，保持角色一致");
    return parts.filter(Boolean).join("。");
  }

  /* 参考图按角色分组：每个角色最多 3 张，附角色名，供适配器按角色拼接 */
  function refGroupsForShot(project, shot) {
    return rolesForShot(project, shot).map(c => ({
      cid: c.id,
      name: c.name || "",
      urls: (c.refImages || []).filter(Boolean).slice(0, 3)
    })).filter(g => g.urls.length);
  }

  /* 轮询式摊平：多角色同框时每个角色都能拿到名额，避免第一个角色占满 3 张 */
  function flattenRefs(groups, max) {
    const out = [];
    const cap = max || 3;
    let i = 0;
    let more = true;
    while (out.length < cap && more) {
      more = false;
      for (const g of groups) {
        if (out.length >= cap) break;
        if (g.urls[i]) { out.push(g.urls[i]); more = true; }
      }
      i++;
    }
    return out;
  }

  /* 扁平参考图（兼容只收图片数组的适配器），顺序即分组顺序 */
  function refImagesForShot(project, shot) {
    return flattenRefs(refGroupsForShot(project, shot), 3);
  }

  /* 多角色同框时给模型一张「角色-参考图」对应表 */
  function refNote(project, shot) {
    const groups = refGroupsForShot(project, shot);
    if (groups.length < 2) return "";
    return "参考图与角色对应：" + groups.map((g, i) => (g.name || ("角色" + (i + 1))) + "（参考图 " + (i + 1) + "）").join("，");
  }

  /* 改了某角色的参考图后，找出受影响的分镜 */
  function affectedShots(project, cid) {
    return (project.shots || []).filter(s => (s.roleIds || []).indexOf(cid) >= 0);
  }

  function markAffected(project, cid) {
    const hit = affectedShots(project, cid);
    hit.forEach(s => { if (s.status === "done") s.stale = true; });
    return hit;
  }

  /* 角色卡完整性检查 */
  function check(c) {
    if (!c || !c.name || !c.name.trim()) return "角色还没有名字";
    if (!displayAppearance(c)) return "「" + c.name + "」还没写外观，画面会跑偏";
    return "";
  }

  /* ============ 角色定妆图 ============ */
  /* 先用外观描述出一张标准参考图，作为全片角色形象的基准，省去外部出图再上传。 */
  function sheetPrompt(project, c) {
    const parts = [];
    const sp = stylePrompt(project.style);
    if (sp) parts.push(sp);
    parts.push("角色定妆图，角色设定图");
    parts.push(characterBlock(c));
    parts.push("正面半身，中性站姿，纯色背景，居中构图，五官清晰，服装细节完整，用于全片角色形象参考");
    return parts.filter(Boolean).join("。");
  }

  async function generateSheet(project, cid) {
    const c = (project.characters || []).find(x => x.id === cid);
    if (!c) throw D.err("NO_CHAR", "找不到这个角色");
    const bad = check(c);
    if (bad) throw D.err("CHAR_INCOMPLETE", bad);
    if (!D.isConfigured("image")) throw D.err("NO_KEY", "尚未配置生图服务，请到「设置 → 短剧服务」填写");
    const r = await D.adapters.image.generate({
      prompt: sheetPrompt(project, c),
      ratio: "3:4",
      refImages: (c.refImages || []).filter(Boolean).slice(0, 1),
      model: project.imageModel
    });
    const ref = await D.project.cacheRemote(r.url, { role: "character" });
    c.refImages = (c.refImages || []).filter(Boolean).concat([ref]).slice(0, 6);
    const hit = markAffected(project, cid);
    return { ref, affected: hit.length };
  }

  /* ============ 跨工程角色库 ============ */
  /* 一次建卡，多个短剧复用；参考图存 asset: 引用，多个工程可共享同一份资源。 */
  function libAll() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(D.K.LIBRARY) || "[]") || []; } catch (e) { list = []; }
    return Array.isArray(list) ? list : [];
  }

  function libWrite(list) {
    localStorage.setItem(D.K.LIBRARY, JSON.stringify(list || []));
  }

  function libGet(lid) {
    return libAll().find(x => x.id === lid) || null;
  }

  /* 存卡：同名同外观视为同一角色，原地更新，避免库里堆重复 */
  function libSave(card) {
    card = card || {};
    const list = libAll();
    const name = (card.name || "").trim() || "未命名角色";
    const hit = list.findIndex(x => x.name === name && (x.appearance || "") === (card.appearance || ""));
    const rec = {
      id: hit >= 0 ? list[hit].id : "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      identity: card.identity || "",
      appearance: card.appearance || "",
      details: Object.assign({}, details(card)),
      realPerson: !!card.realPerson,
      refImages: (card.refImages || []).filter(Boolean).slice(0, 3),
      updatedAt: Date.now()
    };
    if (hit >= 0) list[hit] = rec; else list.unshift(rec);
    libWrite(list);
    return rec;
  }

  function libRemove(lid) {
    libWrite(libAll().filter(x => x.id !== lid));
  }

  /* 把工程里的角色存入库；先把 blob: 参考图落进资源仓，拿到可跨工程复用的 asset: 引用 */
  async function libFromProject(project, cid) {
    const c = (project.characters || []).find(x => x.id === cid);
    if (!c) return null;
    const bad = check(c);
    if (bad) throw D.err("CHAR_INCOMPLETE", bad);
    const refs = [];
    for (const u of (c.refImages || [])) refs.push(await D.project.assets.toRef(u, { role: "character" }));
    return libSave({ name: c.name, identity: c.identity, appearance: c.appearance, realPerson: c.realPerson, refImages: refs });
  }

  /* 从库导入工程：复制一份，改库里的卡不影响已有工程 */
  async function libToProject(project, entry) {
    if (!entry) return null;
    const c = D.project.newCharacter(entry.name);
    c.identity = entry.identity || "";
    c.appearance = entry.appearance || "";
    c.details = Object.assign({}, entry.details || {});
    c.realPerson = !!entry.realPerson;
    c.libraryId = entry.id;
    c.refImages = [];
    for (const u of (entry.refImages || [])) {
      const h = await D.project.assets.hydrateRef(u);
      if (h) c.refImages.push(h);
    }
    project.characters = project.characters || [];
    project.characters.push(c);
    return c;
  }

  D.character = {
    styleDef, stylePrompt, motionPrompt,
    rolesForShot, buildImagePrompt, buildVideoPrompt, refImagesForShot,
    refGroupsForShot, flattenRefs, refNote, DETAIL_FIELDS, details, detailText, displayAppearance,
    affectedShots, markAffected, check, sheetPrompt, generateSheet,
    libAll, libGet, libSave, libRemove, libFromProject, libToProject
  };
})();
