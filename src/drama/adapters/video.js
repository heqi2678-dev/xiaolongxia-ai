/* 铜龙电商 · AI 短剧工作台 · 视频适配器（仿真人） */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  function seedanceText(opts) {
    const parts = [opts.prompt];
    if (opts.ratio) parts.push("--ratio " + opts.ratio);
    if (opts.duration) parts.push("--duration " + opts.duration);
    if (opts.resolution) parts.push("--resolution " + opts.resolution);
    return parts.join(" ");
  }

  /* 提交前校验参数组合：视频编辑必须 adaptive / -1，首尾帧必须 adaptive，单次不超过 30 秒 */
  function assertTaskParams(opts, model) {
    opts = opts || {};
    const m = String(model || opts.model || "");
    const next2 = /seedance-2/.test(m);
    const refVideo = opts.referenceVideo;
    const frames = opts.firstFrame || opts.lastFrame;
    if (refVideo) {
      if (!opts.prompt) throw D.err("BAD_PARAM", "视频编辑必须提供编辑意图提示词");
      if (opts.ratio !== "adaptive") throw D.err("BAD_PARAM", "视频编辑任务 ratio 必须为 adaptive");
      if (Number(opts.duration) !== -1) throw D.err("BAD_PARAM", "视频编辑任务 duration 必须为 -1");
      const rd = Number(opts.refDuration);
      if (rd && (rd < 4 || rd > 30)) throw D.err("BAD_PARAM", "参考视频时长需在 4 至 30 秒之间");
      if (opts.lastFrame) throw D.err("BAD_PARAM", "视频编辑任务不能同时使用尾帧");
    } else if (frames && next2) {
      if (opts.ratio !== "adaptive") throw D.err("BAD_PARAM", "Seedance 2.x 首尾帧任务 ratio 必须为 adaptive");
    }
    const d = Number(opts.duration);
    if (d > 30) throw D.err("BAD_PARAM", "单次生成时长不得超过 30 秒");
    return opts;
  }

  const video = {
    async create(opts) {
      const c = D.getAdapterConfig("video");
      if (!D.isConfigured("video")) throw D.err("NO_KEY", "尚未配置视频生成服务，请到「设置 → 短剧服务」填写");
      if (c.provider === "kling") return klingCreate(c, opts);
      if (c.provider === "custom-video" && c.def.protocol === "sync") return customSync(c, opts);
      return taskCreate(c, opts);
    },

    /* 局段重绘：以段素材为参考视频走视频编辑任务，产出仍为整段有声视频 */
    async edit(opts, onProgress, signal) {
      const c = D.getAdapterConfig("video");
      if (c.provider === "kling") throw D.err("BAD_PARAM", "当前视频服务不支持视频编辑");
      if (!opts || !opts.referenceVideo) throw D.err("BAD_PARAM", "视频编辑需要参考视频");
      const merged = Object.assign({}, opts, {
        mode: "edit",
        ratio: "adaptive",
        duration: -1,
        referenceImages: []
      });
      return video.generate(merged, onProgress, signal);
    },

    assertTaskParams,

    async poll(jobId) {
      const c = D.getAdapterConfig("video");
      return U.taskPoll(
        c.base + "/api/v3/contents/generations/tasks/" + jobId,
        { "Content-Type": "application/json", ...(c.key ? { "Authorization": "Bearer " + c.key } : {}) },
        "content.video_url"
      );
    },

    async generate(opts, onProgress, signal) {
      const created = await video.create(opts);
      if (created.syncUrl) return { url: created.syncUrl, provider: created.provider };
      for (let i = 0; i < 240; i++) {
        if (signal && signal.aborted) throw D.err("ABORTED", "已取消");
        const st = await video.poll(created.jobId);
        if (onProgress) onProgress(st);
        if (st.status === "done") return { url: st.url, provider: created.provider };
        if (st.status === "failed") throw D.err("TASK_FAILED", st.error || "视频生成失败");
        await U.sleep(3000);
      }
      throw D.err("TIMEOUT", "视频生成超时");
    }
  };

  async function taskCreate(c, opts) {
    const model = opts.model || c.model;
    assertTaskParams(opts, model);
    const content = [{ type: "text", text: seedanceText(opts) }];
    if (opts.referenceVideo) {
      content.push({ type: "video_url", video_url: { url: opts.referenceVideo }, role: "reference_video" });
      if (opts.referenceAudio) content.push({ type: "audio_url", audio_url: { url: opts.referenceAudio }, role: "reference_audio" });
    } else {
      if (opts.firstFrame) content.push({ type: "image_url", image_url: { url: opts.firstFrame } });
      if (opts.lastFrame) content.push({ type: "image_url", image_url: { url: opts.lastFrame }, role: "last_frame" });
    }
    /* 角色参考图作为 reference_image 一起送，保证多角色同框时人物一致；首帧已用的图不重复送 */
    const seen = {};
    if (opts.firstFrame) seen[opts.firstFrame] = true;
    if (opts.lastFrame) seen[opts.lastFrame] = true;
    if (opts.referenceVideo) seen[opts.referenceVideo] = true;
    (opts.referenceImages || opts.refImages || []).forEach(u => {
      if (!u || seen[u]) return;
      seen[u] = true;
      content.push({ type: "image_url", image_url: { url: u }, role: "reference_image" });
    });
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base + "/api/v3/contents/generations/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ model, content })
    });
    const id = j && (j.id || j.task_id);
    if (!id) throw D.err("BAD_RESP", "视频任务创建失败：" + JSON.stringify(j).slice(0, 160));
    return { jobId: id, provider: c.provider };
  }

  async function klingCreate(c, opts) {
    const input = { prompt: opts.prompt };
    if (opts.firstFrame) input.image_url = opts.firstFrame;
    const j = await U.httpJson(c.base + "/api/v1/services/aigc/video-generation/video-synthesis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + c.key,
        "X-DashScope-Async": "enable"
      },
      body: JSON.stringify({
        model: opts.model || c.model,
        input,
        parameters: { mode: "pro", duration: opts.duration || 5, aspect_ratio: opts.ratio || "9:16" }
      })
    });
    const id = U.pick(j, "output.task_id");
    if (!id) throw D.err("BAD_RESP", "视频任务创建失败：" + JSON.stringify(j).slice(0, 160));
    return { jobId: id, provider: c.provider };
  }

  async function customSync(c, opts) {
    if (opts.referenceVideo) throw D.err("BAD_PARAM", "当前视频服务不支持视频编辑");
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base + "/api/video", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: opts.model || c.model, prompt: opts.prompt, ratio: opts.ratio, resolution: opts.resolution, duration: opts.duration })
    });
    const u = j && (j.video_url || j.url);
    if (!u) throw D.err("BAD_RESP", "视频返回异常：" + JSON.stringify(j).slice(0, 160));
    return { jobId: "sync", syncUrl: u, provider: c.provider };
  }

  D.adapters.video = video;
})();
