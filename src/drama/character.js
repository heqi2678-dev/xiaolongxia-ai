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

  function characterBlock(c) {
    const bits = [];
    if (c.name) bits.push(c.name);
    if (c.identity) bits.push("身份：" + c.identity);
    if (c.appearance) bits.push("外观：" + c.appearance);
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
    const mo = motionPrompt(shot.motion);
    if (mo) parts.push("镜头" + mo);
    parts.push("口型自然，避免面部畸变与手指畸变，保持角色一致");
    return parts.filter(Boolean).join("。");
  }

  /* 角色参考图（第一张）作为图生图/首帧参考 */
  function refImagesForShot(project, shot) {
    const out = [];
    rolesForShot(project, shot).forEach(c => {
      (c.refImages || []).forEach(u => { if (u) out.push(u); });
    });
    return out.slice(0, 3);
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
    if (!c.appearance || !c.appearance.trim()) return "「" + c.name + "」还没写外观，画面会跑偏";
    return "";
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
    affectedShots, markAffected, check,
    libAll, libGet, libSave, libRemove, libFromProject, libToProject
  };
})();
