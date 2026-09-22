/* 铜龙电商 · AI 短剧工作台 · 图像适配器 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  const image = {
    async generate(opts) {
      const c = D.getAdapterConfig("image");
      const ref = (opts.refImages || []).filter(Boolean);
      if (!D.isConfigured("image")) throw D.err("NO_KEY", "尚未配置生图服务，请到「设置 → 短剧服务」填写");
      if (c.provider === "pollinations") return pollinations(c, opts);
      if (c.provider === "seedream") return seedream(c, opts, ref);
      if (c.provider === "wanx") return wanx(c, opts, ref);
      return custom(c, opts, ref);
    }
  };

  function pollinations(c, opts) {
    const size = opts.hires ? U.hiresRatio(c.def, opts.ratio) : (c.def.ratios[opts.ratio] || c.def.ratios["1:1"]);
    const seed = Math.floor(Math.random() * 1e9);
    const url = c.base + "/prompt/" + encodeURIComponent(opts.prompt) +
      "?width=" + size[0] + "&height=" + size[1] + "&seed=" + seed + "&nologo=true";
    return { url, provider: c.provider };
  }

  async function seedream(c, opts, ref) {
    const body = {
      model: c.model,
      prompt: opts.prompt,
      size: opts.hires ? U.hiresSize(c.def, opts.ratio) : U.ratioSize(c.def, opts.ratio),
      response_format: "url",
      watermark: false
    };
    if (ref.length) body.image = ref.length === 1 ? ref[0] : ref;
    const j = await U.httpJson(c.base + "/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.key },
      body: JSON.stringify(body)
    });
    return pickImage(j, c.provider);
  }

  async function wanx(c, opts, ref) {
    const size = (opts.hires ? U.hiresRatio(c.def, opts.ratio) : c.def.ratios[opts.ratio]) || [1024, 1024];
    const input = { prompt: opts.prompt };
    if (ref.length) input.ref_images = ref.slice(0, 3);
    const j = await U.httpJson(c.base + "/api/v1/services/aigc/text2image/image-synthesis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + c.key,
        "X-DashScope-Async": "enable"
      },
      body: JSON.stringify({ model: c.model, input, parameters: { size: size[0] + "*" + size[1], n: 1 } })
    });
    if (U.pick(j, "output.results.0.url")) return { url: j.output.results[0].url, provider: c.provider };
    const taskId = U.pick(j, "output.task_id");
    if (!taskId) throw D.err("BAD_RESP", "生图任务创建失败：" + JSON.stringify(j).slice(0, 160));
    for (let i = 0; i < 60; i++) {
      await U.sleep(2000);
      const s = await U.httpJson(c.base + "/api/v1/tasks/" + taskId, { headers: { "Authorization": "Bearer " + c.key } });
      const st = U.pick(s, "output.task_status");
      if (st === "SUCCEEDED") {
        const u = U.pick(s, "output.results.0.url");
        if (u) return { url: u, provider: c.provider };
        throw D.err("BAD_RESP", "生图任务成功但无图片");
      }
      if (st === "FAILED" || st === "CANCELED") {
        throw D.err("TASK_FAILED", U.pick(s, "output.message") || U.pick(s, "output.code") || "生图任务失败");
      }
    }
    throw D.err("TIMEOUT", "生图任务超时");
  }

  async function custom(c, opts, ref) {
    if (!c.base) throw D.err("NO_BASE", "尚未配置生图服务地址");
    const body = {
      model: c.model,
      prompt: opts.prompt,
      size: opts.hires ? U.hiresSize(c.def, opts.ratio) : U.ratioSize(c.def, opts.ratio),
      response_format: "url",
      n: 1
    };
    if (ref.length) body.image = ref.length === 1 ? ref[0] : ref;
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base + "/images/generations", { method: "POST", headers, body: JSON.stringify(body) });
    return pickImage(j, c.provider);
  }

  function pickImage(j, provider) {
    const item = j && j.data && j.data[0];
    if (!item) throw D.err("BAD_RESP", "生图返回异常：" + JSON.stringify(j).slice(0, 160));
    const out = item.url || (item.b64_json ? "data:image/png;base64," + item.b64_json : "");
    if (!out) throw D.err("BAD_RESP", "生图返回无图片");
    return { url: out, provider };
  }

  D.adapters.image = image;
})();
