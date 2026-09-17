/* 铜龙电商 · AI 短剧工作台 · 口型适配器 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  /* 火山智能视觉必须用 AccessKey 签名，且签名头不在浏览器 CORS 白名单内，
     统一走同源网关 /dian/api/drama/visual 由服务端代签名转发。
     实测契约：host visual.volcengineapi.com、Action CVSubmitTask / CVGetResult、
     Version 2022-08-31、service cv、region cn-north-1、
     req_key jimeng_realman_avatar_picture_omni_v15（即梦 OmniHuman1.5 数字人）。
     入参只收公网 URL：image_url + audio_url（音频须 <60 秒），可选 mask_url / prompt /
     output_resolution(720|1080) / pe_fast_mode / seed。成片 video_url 有效期仅 1 小时。 */
  const PROXY = "/dian/api/drama/visual";
  const DEFAULT_MODEL = "jimeng_realman_avatar_picture_omni_v15";

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
    const b = { req_key: c.model || DEFAULT_MODEL };
    if (opts.videoUrl) b.video_url = opts.videoUrl;
    if (opts.imageUrl) b.image_url = opts.imageUrl;
    if (opts.audioUrl) b.audio_url = opts.audioUrl;
    if (opts.maskUrl) b.mask_url = Array.isArray(opts.maskUrl) ? opts.maskUrl : [opts.maskUrl];
    if (opts.prompt) b.prompt = String(opts.prompt).slice(0, 300);
    if (!opts.taskId) {
      b.output_resolution = c.resolution === 720 ? 720 : 1080;
      b.pe_fast_mode = b.output_resolution === 720;
    }
    return b;
  }

  /* 火山视觉返回 code=10000 表示成功，业务错误码集中在这里翻译成中文 */
  function volcOk(j) {
    return !j || !j.code || j.code === 0 || j.code === 10000;
  }

  function volcError(j) {
    const code = j && j.code;
    const msg = (j && (j.message || U.pick(j, "data.message"))) || "";
    const table = {
      50411: "输入图片未通过内容审核，请更换画面",
      50511: "输出图片未通过内容审核，可重试",
      50412: "输入文本未通过内容审核",
      50512: "输出文本未通过内容审核",
      50413: "输入文本含敏感词或版权词，请修改台词",
      50513: "输入视频未通过内容审核",
      50514: "输入音频未通过内容审核，请更换配音",
      50429: "火山口型请求过于频繁（QPS 超限），稍后重试即可",
      50430: "火山口型并发已满（该模型并发上限 1），请等上一条生成完再试",
      50400: "火山口型未开通或无权限（Access Denied），请到火山控制台开通「OmniHuman1.5」",
      50200: "火山口型参数不被接受：" + msg,
      50215: "输入无效：常见原因为音频超过 60 秒，请把台词缩短到 15 秒内",
      50500: "火山口型内部错误，可重试",
      50501: "火山口型内部算法错误，可重试"
    };
    return table[code] || msg || ("火山口型报错 code " + code);
  }

  function volcJobId(j) {
    if (!j) return "";
    return j.task_id || j.id || U.pick(j, "data.task_id") || U.pick(j, "Result.task_id") || U.pick(j, "data.id") || "";
  }

  /* 并发上限只有 1，提交时撞上 50429/50430 属于常态，退避后重试 */
  const RETRYABLE = { 50429: 1, 50430: 1, 50500: 1, 50501: 1 };

  /* 火山只收公网 URL，http(s) 直接用，本地 blob/asset: 先上传到网关换公网地址 */
  async function needPublic(url) {
    if (!url) return "";
    const s = String(url);
    if (/^https?:\/\//i.test(s)) return s;
    if (!D.project || !D.project.toPublicUrl) throw D.err("NO_UPLOAD", "当前版本不支持上传本地素材");
    return D.project.toPublicUrl(s);
  }

  async function volcCreate(c, opts) {
    if (!opts.audioUrl) throw D.err("NO_AUDIO", "口型同步需要先有配音");
    if (!opts.imageUrl && !opts.videoUrl) throw D.err("NO_MEDIA", "口型同步需要先有画面");
    const pub = Object.assign({}, opts);
    pub.audioUrl = await needPublic(opts.audioUrl);
    pub.imageUrl = await needPublic(opts.imageUrl);
    pub.videoUrl = await needPublic(opts.videoUrl);
    pub.maskUrl = Array.isArray(opts.maskUrl) ? opts.maskUrl : await needPublic(opts.maskUrl);
    let j;
    const wait = c.retryDelay === undefined ? 8000 : Number(c.retryDelay) || 0;
    for (let i = 0; i < 5; i++) {
      j = await visual(c, c.action, volcInput(c, pub));
      if (volcOk(j) || !RETRYABLE[j && j.code]) break;
      await U.sleep(wait);
    }
    if (!volcOk(j)) throw D.err("VISUAL_FAIL", volcError(j));
    const id = volcJobId(j);
    if (!id) throw D.err("BAD_RESP", "口型任务创建失败：" + JSON.stringify(j).slice(0, 160));
    return { jobId: id, provider: c.provider };
  }

  async function volcPoll(c, jobId) {
    const body = volcInput(c, { taskId: jobId });
    body.task_id = jobId;
    const j = await visual(c, c.pollAction || "CVGetResult", body);
    const code = j && j.code;
    if (code && code !== 0 && code !== 10000) {
      if (RETRYABLE[code]) return { status: "running", url: "", error: "", raw: j };
      return { status: "failed", url: "", error: volcError(j), raw: j };
    }
    const inner = (j && j.data) || {};
    const raw = String(inner.status || "");
    const url = inner.video_url || "";
    if (raw === "done") {
      return url
        ? { status: "done", url: url, usedFast: inner.used_fast_mode, raw: j }
        : { status: "failed", url: "", error: "火山口型任务已完成但未返回视频", raw: j };
    }
    if (raw === "not_found") return { status: "failed", url: "", error: "火山口型任务未找到或已过期（12 小时），请重新生成", raw: j };
    if (raw === "expired") return { status: "failed", url: "", error: "火山口型任务已过期，请重新生成", raw: j };
    return { status: "running", url: "", raw: j };
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
