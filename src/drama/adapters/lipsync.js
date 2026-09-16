/* 铜龙电商 · AI 短剧工作台 · 口型适配器 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  const lipsync = {
    async create(opts) {
      const c = D.getAdapterConfig("lipsync");
      if (!c.base || c.base.indexOf("{") >= 0) throw D.err("NO_BASE", "尚未配置口型服务地址，请到「设置 → 短剧服务」填写");
      const headers = { "Content-Type": "application/json" };
      if (c.key) headers["Authorization"] = "Bearer " + c.key;
      const j = await U.httpJson(c.base + "/api/v1/tools/lipsync", {
        method: "POST",
        headers,
        body: JSON.stringify({ video_url: opts.videoUrl, audio_url: opts.audioUrl, image_url: opts.imageUrl || "" })
      });
      const id = j && (j.task_id || j.id);
      if (!id) throw D.err("BAD_RESP", "口型任务创建失败：" + JSON.stringify(j).slice(0, 160));
      return { jobId: id, provider: c.provider };
    },

    async poll(jobId) {
      const c = D.getAdapterConfig("lipsync");
      const headers = { "Content-Type": "application/json" };
      if (c.key) headers["Authorization"] = "Bearer " + c.key;
      const j = await U.httpJson(c.base + "/api/v1/tasks/" + jobId, { headers });
      const raw = String((j && (j.status || j.state)) || "");
      const done = /succeed|success|done|completed/i.test(raw);
      const failed = /fail|error|cancel/i.test(raw);
      const url = (j && (j.video_url || j.result_url)) || U.pick(j, "data.video_url") || U.pick(j, "data.url") || "";
      return { status: failed ? "failed" : (done && url ? "done" : "running"), url, error: j && j.message, raw: j };
    },

    async generate(opts, onProgress, signal) {
      const created = await lipsync.create(opts);
      for (let i = 0; i < 240; i++) {
        if (signal && signal.aborted) throw D.err("ABORTED", "已取消");
        const st = await lipsync.poll(created.jobId);
        if (onProgress) onProgress(st);
        if (st.status === "done") return { url: st.url, provider: created.provider };
        if (st.status === "failed") throw D.err("TASK_FAILED", st.error || "口型同步失败");
        await U.sleep(3000);
      }
      throw D.err("TIMEOUT", "口型同步超时");
    }
  };

  D.adapters.lipsync = lipsync;
})();
