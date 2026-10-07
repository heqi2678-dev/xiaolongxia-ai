/* 铜龙电商ai助手 · AI 短剧工作台 · 文字识别适配器（画面文字翻译） */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  const ocr = {
    async recognize(opts) {
      const c = D.getAdapterConfig("ocr");
      if (c.provider === "volc") return volc(c, opts);
      return custom(c, opts);
    }
  };

  function normalize(j) {
    const text = String((j && j.text) || "").trim();
    let items = Array.isArray(j && j.items) ? j.items.slice() : [];
    if (!items.length && text) items = text.split(/\n+/).filter(Boolean);
    return { text, items };
  }

  /* 火山智能视觉文字识别需 AK/SK 签名，浏览器无法直连，
     统一走同源网关 /dian/api/drama/ocr 由服务端代签。 */
  async function volc(c, opts) {
    if (!c.key || !c.secret) throw D.err("NO_KEY", "火山文字识别需要 AccessKey ID + Secret Access Key，请到「设置 → 短剧服务」填写");
    const body = {};
    if (opts.imageBase64) body.image_base64 = opts.imageBase64;
    else if (opts.imageUrl) body.image_url = opts.imageUrl;
    if (opts.extra && typeof opts.extra === "object") Object.assign(body, opts.extra);
    if (!body.image_base64 && !body.image_url) throw D.err("NO_IMAGE", "缺少待识别的图片");
    const j = await U.httpJson("/dian/api/drama/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: c.key,
        secret: c.secret,
        action: c.action || "OCRNormal",
        version: c.version || "",
        region: c.region || "",
        service: c.service || "",
        body: body
      })
    });
    if (!j || !j.ok || !j.data) throw D.err("BAD_RESP", (j && j.error) || "文字识别返回异常");
    return Object.assign(normalize(j.data), { provider: c.provider });
  }

  async function custom(c, opts) {
    if (!c.base) throw D.err("NO_BASE", "尚未配置文字识别服务地址");
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const payload = {};
    if (opts.imageBase64) payload.image_base64 = opts.imageBase64;
    if (opts.imageUrl) payload.image_url = opts.imageUrl;
    if (opts.language) payload.language = opts.language;
    const j = await U.httpJson(c.base, { method: "POST", headers, body: JSON.stringify(payload) });
    if (j && (j.text || j.items)) return Object.assign(normalize(j), { provider: c.provider });
    if (j && j.data) return Object.assign(normalize(j.data), { provider: c.provider });
    throw D.err("BAD_RESP", "文字识别返回异常：" + JSON.stringify(j).slice(0, 160));
  }

  D.adapters.ocr = ocr;
})();
