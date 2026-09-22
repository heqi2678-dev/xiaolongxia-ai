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
      const headers = { "Content-Type": "application/json", ...(c.key ? { "Authorization": "Bearer " + c.key } : {}) };
      if (c.provider === "kling") return klingPoll(c, jobId, headers);
      return U.taskPoll(
        c.base + "/api/v3/contents/generations/tasks/" + jobId,
        headers,
        "content.video_url"
      );
    },

    async generate(opts, onProgress, signal) {
      const created = await video.create(opts);
      if (created.syncUrl) return { url: created.syncUrl, provider: created.provider, degraded: created.degraded || null };
      for (let i = 0; i < 240; i++) {
        if (signal && signal.aborted) throw D.err("ABORTED", "已取消");
        const st = await video.poll(created.jobId);
        if (onProgress) onProgress(st);
        if (st.status === "done") return { url: st.url, provider: created.provider, degraded: created.degraded || null };
        if (st.status === "failed") throw D.err("TASK_FAILED", st.error || "视频生成失败");
        await U.sleep(3000);
      }
      throw D.err("TIMEOUT", "视频生成超时");
    }
  };

  /* 只有 Seedance 2.x 支持参考生视频（r2v / reference_image）；1.0 仅支持文生视频与首帧驱动 */
  function supportsRefVideo(model) {
    return /seedance-2/.test(String(model || ""));
  }

  async function taskCreate(c, opts) {
    const model = opts.model || c.model;
    assertTaskParams(opts, model);
    const allowRef = supportsRefVideo(model);
    const refs = (opts.referenceImages || opts.refImages || []).filter(Boolean);
    const dropped = [];
    let firstFrame = opts.firstFrame || "";
    if (!opts.referenceVideo && !allowRef && refs.length) {
      /* 不支持 r2v 的模型：退化为首帧驱动（i2v），用首张参考图保住角色一致性，其余丢弃并提示降级 */
      if (!firstFrame) firstFrame = refs[0];
      refs.forEach(u => { if (u !== firstFrame) dropped.push(u); });
    }
    const content = [{ type: "text", text: seedanceText(opts) }];
    if (opts.referenceVideo) {
      content.push({ type: "video_url", video_url: { url: opts.referenceVideo }, role: "reference_video" });
      if (opts.referenceAudio) content.push({ type: "audio_url", audio_url: { url: opts.referenceAudio }, role: "reference_audio" });
    } else {
      if (firstFrame) content.push({ type: "image_url", image_url: { url: firstFrame } });
      if (opts.lastFrame) content.push({ type: "image_url", image_url: { url: opts.lastFrame }, role: "last_frame" });
    }
    /* 角色参考图作为 reference_image 一起送，保证多角色同框时人物一致；首帧已用的图不重复送 */
    const seen = {};
    if (firstFrame) seen[firstFrame] = true;
    if (opts.lastFrame) seen[opts.lastFrame] = true;
    if (opts.referenceVideo) seen[opts.referenceVideo] = true;
    if (allowRef) {
      refs.forEach(u => {
        if (seen[u]) return;
        seen[u] = true;
        content.push({ type: "image_url", image_url: { url: u }, role: "reference_image" });
      });
    }
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base + "/api/v3/contents/generations/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ model, content })
    });
    const id = j && (j.id || j.task_id);
    if (!id) throw D.err("BAD_RESP", "视频任务创建失败：" + JSON.stringify(j).slice(0, 160));
    return {
      jobId: id,
      provider: c.provider,
      degraded: (!allowRef && refs.length)
        ? { reason: "R2V_UNSUPPORTED", model, dropped: dropped.length, asFirstFrame: !!firstFrame && refs.indexOf(firstFrame) >= 0 }
        : null
    };
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

  /* 可灵走 DashScope 任务协议：查询 /api/v1/tasks/{id}，状态在 output.task_status，成片在 output.video_url */
  async function klingPoll(c, jobId, headers) {
    const j = await U.httpJson(c.base + "/api/v1/tasks/" + jobId, { headers });
    const raw = String(U.pick(j, "output.task_status") || "");
    const url = U.pick(j, "output.video_url") || "";
    const failed = /FAILED|CANCELED|UNKNOWN/i.test(raw);
    const done = /SUCCEEDED|SUCCESS/i.test(raw);
    return {
      status: failed ? "failed" : (done && url ? "done" : "running"),
      url,
      error: failed ? (U.pick(j, "output.message") || U.pick(j, "output.code")) : undefined,
      raw: j
    };
  }

  D.adapters.video = video;
})();
