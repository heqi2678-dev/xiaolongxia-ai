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

  const video = {
    async create(opts) {
      const c = D.getAdapterConfig("video");
      if (!D.isConfigured("video")) throw D.err("NO_KEY", "尚未配置视频生成服务，请到「设置 → 短剧服务」填写");
      if (c.provider === "kling") return klingCreate(c, opts);
      if (c.provider === "custom-video" && c.def.protocol === "sync") return customSync(c, opts);
      return taskCreate(c, opts);
    },

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
    const content = [{ type: "text", text: seedanceText(opts) }];
    if (opts.firstFrame) content.push({ type: "image_url", image_url: { url: opts.firstFrame } });
    if (opts.lastFrame) content.push({ type: "image_url", image_url: { url: opts.lastFrame }, role: "last_frame" });
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base + "/api/v3/contents/generations/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: opts.model || c.model, content })
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
