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
    if (!c.key) throw D.err("NO_KEY", "火山语音需要 API Key，请到「设置 → 短剧服务」填写");
    const text = await U.httpText(c.base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": c.key,
        "X-Api-Resource-Id": c.cluster || "seed-tts-2.0"
      },
      body: JSON.stringify({
        user: { uid: "xlx-drama" },
        req_params: {
          text: opts.text,
          speaker: opts.voice || c.voice,
          audio_params: volcAudioParams(opts)
        }
      })
    });
    const chunks = [];
    let errMsg = "";
    String(text).split("\n").forEach((line) => {
      const s = line.trim();
      if (!s) return;
      let j = null;
      try { j = JSON.parse(s); } catch (e) { return; }
      if (!j) return;
      if (typeof j.code === "number" && j.code !== 0 && j.code !== 20000000) {
        errMsg = j.message || ("code " + j.code);
        return;
      }
      if (j.data) chunks.push(j.data);
    });
    if (!chunks.length) throw D.err("BAD_RESP", "语音合成未返回音频：" + (errMsg || "无数据"));
    const url = U.b64ToBlobUrl(chunks, "audio/mpeg");
    return { url, duration: await U.audioDuration(url), provider: c.provider };
  }

  /* 火山语音 v3 音频参数：语速用 speech_rate（[-50,100]，100 即 2 倍速）。 */
  function volcAudioParams(opts) {
    const a = { format: opts.format || "mp3", sample_rate: 24000 };
    const speed = Number(opts.speed || 1);
    if (isFinite(speed) && speed !== 1) {
      a.speech_rate = Math.max(-50, Math.min(100, Math.round((speed - 1) * 100)));
    }
    return a;
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
