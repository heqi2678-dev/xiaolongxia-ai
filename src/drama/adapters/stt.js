/* 铜龙电商ai助手 · AI 短剧工作台 · 语音识别适配器 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  const stt = {
    async transcribe(opts) {
      const c = D.getAdapterConfig("stt");
      if (c.provider === "volc") return volc(c, opts);
      return custom(c, opts);
    }
  };

  function normalize(j) {
    return {
      text: String((j && j.text) || "").trim(),
      language: String((j && j.language) || "").trim(),
      utterances: Array.isArray(j && j.utterances) ? j.utterances : []
    };
  }

  /* 火山录音文件识别大模型同样需要 X-Api-Key，浏览器无法直连，
     统一走同源网关 /dian/api/drama/stt 由服务端代发并轮询。 */
  async function volc(c, opts) {
    if (!c.key) throw D.err("NO_KEY", "火山语音识别需要 API Key，请到「设置 → 短剧服务」填写");
    if (!opts.url) throw D.err("NO_URL", "缺少待识别的音视频地址");
    const j = await U.httpJson("/dian/api/drama/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: c.key,
        resource: c.cluster || "volc.bigasr.auc",
        url: opts.url,
        format: opts.format || "",
        language: opts.language || ""
      })
    });
    if (!j || !j.ok || !j.data) throw D.err("BAD_RESP", (j && j.error) || "语音识别返回异常");
    return Object.assign(normalize(j.data), { provider: c.provider });
  }

  async function custom(c, opts) {
    if (!c.base) throw D.err("NO_BASE", "尚未配置语音识别服务地址");
    if (!opts.url) throw D.err("NO_URL", "缺少待识别的音视频地址");
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: opts.url, language: opts.language || "" })
    });
    if (j && (j.text || j.utterances)) return Object.assign(normalize(j), { provider: c.provider });
    if (j && j.data) return Object.assign(normalize(j.data), { provider: c.provider });
    throw D.err("BAD_RESP", "语音识别返回异常：" + JSON.stringify(j).slice(0, 160));
  }

  D.adapters.stt = stt;
})();
