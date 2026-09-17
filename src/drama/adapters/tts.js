/* 铜龙电商 · AI 短剧工作台 · 语音适配器 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  const tts = {
    async synth(opts) {
      const c = D.getAdapterConfig("tts");
      if (c.provider === "volc") return volc(c, opts);
      return custom(c, opts);
    }
  };

  /* 火山语音新版协议要求 X-Api-Key，但该头不在浏览器 CORS 白名单内，
     故统一走同源网关 /dian/api/drama/tts 由服务端代发。 */
  async function volc(c, opts) {
    if (!c.key) throw D.err("NO_KEY", "火山语音需要 API Key，请到「设置 → 短剧服务」填写");
    const url = await U.httpBlobUrl("/dian/api/drama/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: c.key,
        resource: c.cluster || "seed-tts-2.0",
        text: opts.text,
        speaker: opts.voice || c.voice,
        speed: Number(opts.speed || 1),
        format: opts.format || "mp3"
      })
    }, "audio/mpeg");
    return { url, duration: await U.audioDuration(url), provider: c.provider };
  }

  async function custom(c, opts) {
    if (!c.base) throw D.err("NO_BASE", "尚未配置语音服务地址");
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const j = await U.httpJson(c.base, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: opts.text, voice: opts.voice || c.voice, speed: opts.speed, pitch: opts.pitch, format: opts.format || "mp3" })
    });
    if (j && j.url) return { url: j.url, duration: await U.audioDuration(j.url), provider: c.provider };
    if (j && j.data) {
      const url = U.b64ToBlobUrl(j.data, "audio/mpeg");
      return { url, duration: await U.audioDuration(url), provider: c.provider };
    }
    throw D.err("BAD_RESP", "语音返回异常：" + JSON.stringify(j).slice(0, 160));
  }

  D.adapters.tts = tts;
})();
