/* 铜龙电商 · AI 短剧工作台 · 镜头段划分与段计划（整段生成模式） */
/* 计算部分为纯函数（便于单测）；sync 只重建段集合，不发起网络请求。 */
(function () {
  const D = XLX.drama;

  const MIN_SECONDS = 4;
  const TARGET_SECONDS = 15;
  const MAX_SECONDS = 30;

  function dur(s) {
    const n = Number(s && s.duration);
    return n > 0 ? n : 0;
  }

  function clampTarget(n) {
    const t = Number(n);
    if (!(t > 0)) return TARGET_SECONDS;
    return Math.max(MIN_SECONDS, Math.min(t, MAX_SECONDS));
  }

  const DURATION_CHOICES = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

  /* 整段模式下分镜可用的时长档位，末位不超过硬上限，始终包含当前值 */
  function durationList(current) {
    const list = DURATION_CHOICES.slice();
    const c = Number(current);
    if (c > 0 && list.indexOf(c) < 0) list.push(c);
    return list.sort((a, b) => a - b);
  }

  function limits(project) {
    return {
      min: MIN_SECONDS,
      target: clampTarget(project && project.takeTarget),
      max: MAX_SECONDS
    };
  }

  /* 按分镜顺序贪心分段：命中分段目标即断段，段时长不超过硬上限，末段不足下限并入前段 */
  function group(project, opts) {
    opts = opts || {};
    const lim = limits(project);
    const target = clampTarget(opts.target || lim.target);
    const shots = ((project && project.shots) || []).slice();
    const out = [];
    let cur = null;
    const flush = () => {
      if (cur && cur.shotIds.length) out.push(cur);
      cur = null;
    };

    shots.forEach(s => {
      const d = dur(s);
      if (d > lim.max) {
        flush();
        out.push({ shotIds: [s.id], duration: d, oversized: true });
        return;
      }
      if (!cur) cur = { shotIds: [], duration: 0 };
      if (cur.shotIds.length && cur.duration + d > lim.max) {
        flush();
        cur = { shotIds: [], duration: 0 };
      }
      cur.shotIds.push(s.id);
      cur.duration += d;
      if (cur.duration >= target) flush();
    });
    flush();

    if (out.length > 1) {
      const last = out[out.length - 1];
      const prev = out[out.length - 2];
      if (!last.oversized && last.duration < lim.min && prev.duration + last.duration <= lim.max) {
        prev.shotIds = prev.shotIds.concat(last.shotIds);
        prev.duration += last.duration;
        out.pop();
      }
    }

    return out.map(g => ({ shotIds: g.shotIds, duration: g.duration, oversized: !!g.oversized }));
  }

  /* 段内分镜的起止时间，首镜 start 为 0，末镜 end 等于段时长 */
  function plan(project, shotIds) {
    const idx = {};
    ((project && project.shots) || []).forEach(s => { idx[s.id] = s; });
    let t = 0;
    return (shotIds || []).map(sid => {
      const s = idx[sid] || {};
      const d = dur(s);
      const seg = { sid, seq: s.seq || 0, start: t, end: t + d };
      t += d;
      return seg;
    });
  }

  function signature(shotIds) {
    return (shotIds || []).join("|");
  }

  /* 重建段集合：按 shotIds 签名复用既有段对象，原地更新段时长与段计划。
   * 必须保持对象身份：save() 会经 migrate() 调用本函数，若每次新建对象，
   * 生成流程持有的 take 引用会失效，导致 videoUrl/status 写进游离对象。 */
  function sync(project) {
    if (!project) return project;
    project.shots = project.shots || [];
    const groups = group(project);
    const old = Array.isArray(project.takes) ? project.takes : [];
    const used = {};
    project.takes = groups.map((g, i) => {
      const sig = signature(g.shotIds);
      let keep = null;
      for (const t of old) {
        if (t && !used[t.id] && signature(t.shotIds) === sig) { keep = t; used[t.id] = true; break; }
      }
      const segs = plan(project, g.shotIds);
      if (!keep) {
        return {
          id: D.project.id("t"),
          seq: i + 1,
          shotIds: g.shotIds.slice(),
          duration: g.duration,
          plan: segs,
          videoUrl: "",
          status: "pending",
          error: "",
          fallback: false,
          dirty: false,
          updatedAt: Date.now()
        };
      }
      const changed = JSON.stringify(keep.plan || []) !== JSON.stringify(segs) && !!keep.videoUrl;
      keep.seq = i + 1;
      keep.shotIds = g.shotIds.slice();
      keep.duration = g.duration;
      keep.plan = segs;
      keep.videoUrl = keep.videoUrl || "";
      keep.status = keep.status || "pending";
      keep.error = keep.error || "";
      keep.fallback = !!keep.fallback;
      keep.dirty = changed || !!keep.dirty;
      keep.updatedAt = keep.updatedAt || Date.now();
      return keep;
    });
    return project;
  }

  function takeOf(project, sid) {
    return ((project && project.takes) || []).find(t => (t.shotIds || []).indexOf(sid) >= 0) || null;
  }

  function segmentOf(project, sid) {
    const t = takeOf(project, sid);
    if (!t) return null;
    const seg = (t.plan || []).find(x => x.sid === sid);
    if (!seg) return null;
    return { takeId: t.id, start: seg.start, end: seg.end };
  }

  function markDirty(project, sid) {
    const t = takeOf(project, sid);
    if (t) t.dirty = true;
    return t;
  }

  /* 段内涉及的角色，按首次出场顺序去重 */
  function takeRoles(project, take) {
    const idx = {};
    const order = [];
    ((take && take.shotIds) || []).forEach(sid => {
      const s = ((project && project.shots) || []).find(x => x.id === sid);
      if (!s) return;
      D.character.rolesForShot(project, s).forEach(c => {
        if (!idx[c.id]) { idx[c.id] = c; order.push(c); }
      });
    });
    return order;
  }

  /* 段级参考图分组：每角色最多 3 张 */
  function refGroups(project, take) {
    return takeRoles(project, take).map(c => ({
      cid: c.id,
      name: c.name || "",
      urls: (c.refImages || []).filter(Boolean).slice(0, 3)
    })).filter(g => g.urls.length);
  }

  /* 段级扁平参考图：多角色轮询摊平，整段默认最多 9 张 */
  function refImages(project, take, max) {
    return D.character.flattenRefs(refGroups(project, take), max || 9);
  }

  /* 段提示词：角色设定 + 按秒标出段内分镜序列 + 参考图对应表 */
  function prompt(project, take) {
    const idx = {};
    ((project && project.shots) || []).forEach(s => { idx[s.id] = s; });
    const parts = ["电影级写实摄影，真实皮肤质感，自然光，浅景深，表演自然连贯"];

    const roles = takeRoles(project, take);
    if (roles.length) {
      parts.push("人物：" + roles.map(c => {
        const bits = [c.name || "角色"];
        if (c.identity) bits.push("身份：" + c.identity);
        const ap = D.character.displayAppearance(c);
        if (ap) bits.push("外观：" + ap);
        return bits.join("，");
      }).join("；"));
    }

    const segs = (take && take.plan ? take.plan.slice() : []).sort((a, b) => a.start - b.start);
    const lines = segs.map((seg, i) => {
      const s = idx[seg.sid] || {};
      const bits = ["第" + (i + 1) + "镜（" + seg.start + " 至 " + seg.end + " 秒）"];
      if (s.prompt) bits.push(s.prompt);
      const mo = D.character.motionPrompt(s.motion);
      if (mo) bits.push("镜头" + mo);
      return bits.join("：");
    });
    if (lines.length) parts.push("按顺序一镜到底：" + lines.join("；"));

    const groups = refGroups(project, take);
    if (groups.length >= 2) {
      parts.push("参考图与角色对应：" + groups.map((g, i) => (g.name || ("角色" + (i + 1))) + "（参考图 " + (i + 1) + "）").join("，"));
    }

    parts.push("一条连续长镜头，镜头之间自然衔接，人物五官稳定，同一角色前后一致，口型自然，避免面部畸变与手指畸变");
    return parts.filter(Boolean).join("。");
  }

  D.takes = {
    MIN_SECONDS, TARGET_SECONDS, MAX_SECONDS, DURATION_CHOICES,
    limits, durationList, group, plan, sync, takeOf, segmentOf, markDirty, signature,
    takeRoles, refGroups, refImages, prompt
  };
})();
