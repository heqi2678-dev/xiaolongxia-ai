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

  async function volc(c, opts) {
    if (!c.appId || !c.key) throw D.err("NO_KEY", "火山语音需要 App ID 与 Access Token，请到「设置 → 短剧服务」填写");
    const j = await U.httpJson(c.base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer;" + c.key },
      body: JSON.stringify({
        app: { appid: c.appId, token: c.key, cluster: c.cluster || "volcano_tts" },
        user: { uid: "xlx-drama" },
        audio: {
          voice_type: opts.voice || c.voice,
          encoding: opts.format || "mp3",
          speed_ratio: Number(opts.speed || 1),
          pitch_ratio: Number(opts.pitch || 1),
          volume_ratio: 1
        },
        request: {
          reqid: XLX.util && XLX.util.uid ? XLX.util.uid() : String(Date.now()),
          text: opts.text,
          text_type: "plain",
          operation: "query"
        }
      })
    });
    if (!j || !j.data) throw D.err("BAD_RESP", "语音合成返回异常：" + JSON.stringify(j).slice(0, 160));
    const url = U.b64ToBlobUrl(j.data, "audio/mpeg");
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
