/* 铜龙电商 · AI 短剧工作台 · 口型适配器 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  /* 火山智能视觉必须用 AccessKey 签名，且签名头不在浏览器 CORS 白名单内，
     统一走同源网关 /dian/api/drama/visual 由服务端代签名转发。
     实测契约：host visual.volcengineapi.com、Action CVSubmitTask、Version 2022-08-31、
     service cv、region cn-north-1、模型 realman_avatar_picture_omni_v2。 */
  const PROXY = "/dian/api/drama/visual";

  const lipsync = {
    async create(opts) {
      const c = D.getAdapterConfig("lipsync");
      if (c.provider === "volc-koubo") return volcCreate(c, opts);
      return customCreate(c, opts);
    },

    async poll(jobId) {
      const c = D.getAdapterConfig("lipsync");
      if (c.provider === "volc-koubo") return volcPoll(c, jobId);
      return customPoll(c, jobId);
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

  /* ===== 火山即梦数字人（签名代理）===== */
  async function visual(c, action, body) {
    if (!c.key) throw D.err("NO_KEY", "火山口型需要 AccessKey ID，请到「设置 → 短剧服务」填写");
    if (!c.secret) throw D.err("NO_SECRET", "火山口型需要 Secret Access Key，请到「设置 → 短剧服务」填写");
    if (!action) throw D.err("NO_ACTION", "火山口型缺少接口 Action 配置");
    const payload = {
      key: c.key,
      secret: c.secret,
      action: action,
      version: c.version || "2022-08-31",
      service: "cv",
      region: "cn-north-1",
      body: body
    };
    const j = await U.httpJson(PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (j && j.ok === false) throw D.err("VISUAL_FAIL", j.error || "火山口型调用失败");
    return (j && j.data !== undefined) ? j.data : j;
  }

  function volcInput(c, opts) {
    const b = { req_key: c.model || "realman_avatar_picture_omni_v2" };
    if (opts.videoUrl) b.video_url = opts.videoUrl;
    if (opts.imageUrl) b.image_url = opts.imageUrl;
    if (opts.audioUrl) b.audio_url = opts.audioUrl;
    return b;
  }

  /* 火山视觉返回 code=10000 表示成功，业务错误码集中在这里翻译成中文 */
  function volcOk(j) {
    return !j || !j.code || j.code === 0 || j.code === 10000;
  }

  function volcError(j) {
    const code = j && j.code;
    const msg = (j && (j.message || U.pick(j, "data.message"))) || "";
    if (code === 50400) return "火山口型未开通或无权限（Access Denied），请到火山控制台开通「即梦数字人」口型服务";
    if (code === 50430) return "火山口型当前并发额度为 0，模型可能未开通或额度用尽，请到火山控制台开通模型或申请并发";
    if (code === 50200) return "火山口型参数不被接受：" + msg;
    return msg || ("火山口型报错 code " + code);
  }

  function volcJobId(j) {
    if (!j) return "";
    return j.task_id || j.id || U.pick(j, "data.task_id") || U.pick(j, "Result.task_id") || U.pick(j, "data.id") || "";
  }

  async function volcCreate(c, opts) {
    if (!opts.audioUrl) throw D.err("NO_AUDIO", "口型同步需要先有配音");
    if (!opts.imageUrl && !opts.videoUrl) throw D.err("NO_MEDIA", "口型同步需要先有画面");
    const j = await visual(c, c.action, volcInput(c, opts));
    if (!volcOk(j)) throw D.err("VISUAL_FAIL", volcError(j));
    const id = volcJobId(j);
    if (!id) throw D.err("BAD_RESP", "口型任务创建失败：" + JSON.stringify(j).slice(0, 160));
    return { jobId: id, provider: c.provider };
  }

  async function volcPoll(c, jobId) {
    const body = volcInput(c, {});
    body.task_id = jobId;
    const j = await visual(c, c.pollAction || "CVGetResult", body);
    if (!volcOk(j)) return { status: "failed", url: "", error: volcError(j), raw: j };
    const inner = (j && j.data) || {};
    const raw = String(inner.status || U.pick(j, "status") || "");
    const url = inner.video_url || inner.image_url || U.pick(j, "data.video_url") || "";
    const failed = /fail|error|cancel|reject/i.test(raw);
    const done = /succeed|success|done|complete|finish|^2$/i.test(raw) || (!!url && !failed);
    return {
      status: failed ? "failed" : (done ? "done" : "running"),
      url: url,
      error: failed ? (inner.resp_data || raw) : "",
      raw: j
    };
  }

  /* ===== 自定义任务式口型服务 ===== */
  async function customCreate(c, opts) {
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
  }

  async function customPoll(c, jobId) {
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base + "/api/v1/tasks/" + jobId, { headers });
    const raw = String((j && (j.status || j.state)) || "");
    const done = /succeed|success|done|completed/i.test(raw);
    const failed = /fail|error|cancel/i.test(raw);
    const url = (j && (j.video_url || j.result_url)) || U.pick(j, "data.video_url") || U.pick(j, "data.url") || "";
    return { status: failed ? "failed" : (done && url ? "done" : "running"), url, error: j && j.message, raw: j };
  }

  D.adapters.lipsync = lipsync;
})();
