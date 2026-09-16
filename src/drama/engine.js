/* 铜龙电商 · AI 短剧工作台 · 剧种引擎（漫剧 / 仿真人） */
/* 负责单镜生成、批量生成、配音、口型，以及半自动台的剧本分镜规划。 */
(function () {
  const D = XLX.drama;
  const jobs = {};

  function findShot(project, sid) {
    return (project.shots || []).find(s => s.id === sid);
  }

  async function save(project) {
    try { await D.project.save(project); } catch (e) { /* 存草稿失败不阻断生成 */ }
  }

  function isRealistic(project) {
    return project.genre === "realistic" || project.engine === "video";
  }

  async function synthShot(project, shot) {
    if (!shot.line || !shot.line.trim()) return shot;
    const r = await D.adapters.tts.synth({
      text: shot.line,
      voice: shot.voice,
      speed: project.ttsSpeed || 1,
      pitch: project.ttsPitch || 1
    });
    shot.audioUrl = r.url;
    if (r.duration) shot.audioDuration = r.duration;
    if (!shot.duration || shot.duration < Math.ceil(r.duration || 0)) {
      shot.duration = Math.max(shot.duration || 5, Math.ceil(r.duration || 0));
    }
    return shot;
  }

  async function lipsyncShot(project, shot) {
    if (!shot.videoUrl || !shot.audioUrl) return shot;
    const r = await D.adapters.lipsync.generate({ videoUrl: shot.videoUrl, audioUrl: shot.audioUrl, imageUrl: shot.imageUrl });
    shot.lipsyncUrl = r.url;
    return shot;
  }

  async function generateShot(project, sid, opts) {
    opts = opts || {};
    const shot = findShot(project, sid);
    if (!shot) throw D.err("NO_SHOT", "找不到这个分镜");
    const ctrl = new AbortController();
    jobs[sid] = ctrl;
    D.project.setStatus(shot, "generating");
    await save(project);
    try {
      if (isRealistic(project)) {
        const refs = D.character.refImagesForShot(project, shot);
        const r = await D.adapters.video.generate({
          prompt: D.character.buildVideoPrompt(project, shot),
          firstFrame: shot.firstFrame || refs[0] || "",
          ratio: project.output.ratio,
          duration: shot.duration || 5,
          resolution: project.output.resolution === "1080p" ? "1080p" : "720p",
          model: project.videoModel
        }, opts.onProgress, ctrl.signal);
        shot.videoUrl = r.url;
        shot.imageUrl = shot.imageUrl || shot.firstFrame || "";
        if (shot.line) {
          await synthShot(project, shot);
          if (shot.videoUrl && shot.audioUrl) await lipsyncShot(project, shot);
        }
      } else {
        const refs = D.character.refImagesForShot(project, shot);
        const r = await D.adapters.image.generate({
          prompt: D.character.buildImagePrompt(project, shot),
          ratio: project.output.ratio,
          refImages: refs,
          model: project.imageModel
        });
        shot.imageUrl = r.url;
        if (shot.line) await synthShot(project, shot);
      }
      D.project.setStatus(shot, "done");
      shot.stale = false;
      await save(project);
      return shot;
    } catch (e) {
      if (e && e.code === "ABORTED") D.project.setStatus(shot, "pending");
      else D.project.setStatus(shot, "failed", e && e.message);
      await save(project);
      throw e;
    } finally {
      delete jobs[sid];
    }
  }

  async function generateMany(project, sids, opts) {
    opts = opts || {};
    const queue = (sids || []).slice();
    const limit = Math.max(1, Math.min(opts.concurrency || 2, 4));
    const errors = [];
    let done = 0;
    async function worker() {
      while (queue.length) {
        if (opts.signal && opts.signal.aborted) return;
        const sid = queue.shift();
        try {
          await generateShot(project, sid, { onProgress: opts.onProgress });
        } catch (e) {
          errors.push({ shotId: sid, error: e && e.message });
        }
        done++;
        if (opts.onEach) opts.onEach(done, sids.length, sid);
      }
    }
    const workers = [];
    for (let i = 0; i < limit; i++) workers.push(worker());
    await Promise.all(workers);
    return { done, errors };
  }

  async function synthMany(project, sids, opts) {
    opts = opts || {};
    const errors = [];
    for (const sid of sids || []) {
      const shot = findShot(project, sid);
      if (!shot || !shot.line) continue;
      try {
        await synthShot(project, shot);
        if (isRealistic(project) && shot.videoUrl) await lipsyncShot(project, shot);
        shot.status = "done";
      } catch (e) {
        errors.push({ shotId: sid, error: e && e.message });
      }
      if (opts.onEach) opts.onEach(shot);
      await save(project);
    }
    return { errors };
  }

  function abort(sid) {
    if (jobs[sid]) { jobs[sid].abort(); delete jobs[sid]; }
  }
  function abortAll() {
    Object.keys(jobs).forEach(k => { jobs[k].abort(); delete jobs[k]; });
  }

  /* ============ 半自动台：题材 -> 剧本分镜 ============ */
  function extractJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }

  function localPlan(input) {
    const topic = (input.topic || "都市逆袭").trim();
    const n = Math.max(3, Math.min(input.shotCount || 6, 20));
    const roles = ["主角", "对手", "旁白"];
    const beats = ["开场钩子", "冲突升级", "反转", "高潮", "收尾"];
    const shots = [];
    for (let i = 0; i < n; i++) {
      const beat = beats[Math.min(beats.length - 1, Math.floor(i / Math.max(1, n / beats.length)))];
      shots.push({
        prompt: topic + "，" + beat + "，第 " + (i + 1) + " 镜，情绪饱满，构图讲究",
        line: i === 0 ? topic + "，事情，远没有看上去那么简单。" : "",
        duration: 5,
        motion: "zoom-in"
      });
    }
    return {
      logline: topic + "：一个小人物在困境中翻盘的故事。",
      outline: "围绕「" + topic + "」展开，从钩子到反转再到收尾，节奏紧凑。",
      characters: [
        { name: "主角", identity: "故事核心，逆境翻盘", appearance: "二十多岁，干净利落，眼神坚定" },
        { name: "对手", identity: "制造冲突的一方", appearance: "气场强，穿着讲究，表情冷峻" }
      ],
      shots
    };
  }

  async function planScript(input) {
    input = input || {};
    const genreName = (D.GENRES.find(g => g.id === input.genre) || {}).name || "AI 短剧";
    const styleName = (D.STYLES.find(s => s.id === input.style) || {}).name || "";
    const n = Math.max(3, Math.min(input.shotCount || 6, 20));
    const llm = XLX.llm;
    if (!llm || !llm.isConfigured || !llm.isConfigured()) {
      const p = localPlan(input);
      p._fallback = true;
      return p;
    }
    const sys = "你是短视频短剧的编剧与分镜师。只输出 JSON，不要解释，不要多余文字。";
    const user =
      "题材：" + (input.topic || "") + "\n" +
      "剧种：" + genreName + "，画风：" + styleName + "\n" +
      "分镜数量：" + n + "\n" +
      "要求：适合抖音竖屏短剧，前 3 秒有强钩子，节奏快，台词口语化。\n" +
      "输出 JSON 结构：{\"logline\":\"一句话故事\",\"outline\":\"剧情大纲\",\"characters\":[{\"name\":\"\",\"identity\":\"\",\"appearance\":\"外貌细节\"}],\"shots\":[{\"prompt\":\"画面描述\",\"line\":\"台词，可为空\",\"duration\":5,\"motion\":\"zoom-in|zoom-out|pan-left|pan-right|static\"}]}";
    let text = "";
    try {
      text = await llm.ask(sys, user);
    } catch (e) {
      const p = localPlan(input);
      p._fallback = true;
      p._error = e && e.message;
      return p;
    }
    const j = extractJson(text);
    if (!j || !Array.isArray(j.shots) || !j.shots.length) {
      const p = localPlan(input);
      p._fallback = true;
      return p;
    }
    j.shots = j.shots.slice(0, n).map((s, i) => ({
      prompt: String(s.prompt || (input.topic || "") + " 第 " + (i + 1) + " 镜"),
      line: String(s.line || ""),
      duration: Number(s.duration) || 5,
      motion: D.MOTIONS.some(m => m.id === s.motion) ? s.motion : "zoom-in"
    }));
    j.characters = (Array.isArray(j.characters) ? j.characters : []).slice(0, 6).map(c => ({
      name: String(c.name || "角色"),
      identity: String(c.identity || ""),
      appearance: String(c.appearance || "")
    }));
    j.logline = String(j.logline || "");
    j.outline = String(j.outline || "");
    return j;
  }

  /* 把规划结果写进工程 */
  function applyPlan(project, plan) {
    project.script.logline = plan.logline || "";
    project.script.outline = plan.outline || "";
    project.characters = (plan.characters || []).map(c => {
      const card = D.project.newCharacter(c.name);
      card.identity = c.identity || "";
      card.appearance = c.appearance || "";
      return card;
    });
    const main = project.characters[0] ? [project.characters[0].id] : [];
    project.shots = (plan.shots || []).map((s, i) => {
      const shot = D.project.newShot(i + 1);
      shot.name = "分镜 " + (i + 1);
      shot.prompt = s.prompt;
      shot.line = s.line;
      shot.duration = s.duration;
      shot.motion = s.motion;
      shot.roleIds = main.slice();
      return shot;
    });
    if (!project.shots.length) project.shots = [D.project.newShot(1)];
    return project;
  }

  D.engine = {
    generateShot, generateMany, synthShot, synthMany, lipsyncShot,
    abort, abortAll, isRealistic,
    planScript, applyPlan, extractJson, localPlan
  };
})();
