/* 铜龙电商ai助手 · AI 短剧工作台 · 抠图适配器（商品锁定合成用）
 * local：网关 rembg（免费兜底）；removebg：remove.bg 云端（边缘更佳）；custom-matting：自定义接口。
 * 入参 opts.image：商品图地址（http(s) 公网地址 / data:URL / 网关相对地址）。
 * 返回：可绘制的抠图地址（remove.bg 与自定义返回 blob URL，网关返回 http url）。 */
(function () {
  const D = XLX.drama;
  const U = D.adapterUtil;
  D.adapters = D.adapters || {};

  const matting = {
    async run(opts) {
      opts = opts || {};
      const image = opts.image || "";
      if (!image) throw D.err("NO_IMAGE", "缺少商品图片");
      const c = D.getAdapterConfig("matting");
      if (c.provider === "removebg") return removebg(c, image, opts);
      if (c.provider === "custom-matting") return custom(c, image, opts);
      return local(c, image);
    }
  };

  /* 网关 rembg：默认路径可由 c.base 覆盖（便于自托管/联调）。 */
  function local(c, image) {
    const url = (c && c.base) || "/dian/api/drama/matting";
    return fetch(url, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: image })
    }).then(r => r.json().catch(() => null).then(j => ({ r, j })))
      .then(o => {
        if (!o.r.ok || !o.j || !o.j.ok || !o.j.url) {
          throw D.err("MATTING_FAIL", (o.j && o.j.error) || "AI 抠图不可用");
        }
        return o.j.url;
      });
  }

  /* remove.bg：公网地址走 image_url（服务端拉取），data:URL 走 image_file 直传。 */
  function removebg(c, image, opts) {
    if (!c.key) throw D.err("NO_KEY", "尚未配置 remove.bg 钥匙，请到「设置 → 厂商钥匙库」填写");
    const abs = absUrl(image);
    const form = new FormData();
    if (/^https?:\/\//i.test(abs)) form.append("image_url", abs);
    else {
      const blob = dataUrlToBlob(image);
      if (!blob) throw D.err("BAD_IMAGE", "商品图地址无法用于抠图");
      form.append("image_file", blob, "image.png");
    }
    form.append("size", opts.size || "auto");
    form.append("format", "png");
    if (opts.bgColor) form.append("bg_color", opts.bgColor);
    if (opts.type) form.append("type", opts.type);
    return U.httpBlobUrl(c.base + "/removebg",
      { method: "POST", headers: { "X-Api-Key": c.key }, body: form }, "image/png");
  }

  /* 自定义抠图接口：POST {image}，兼容图片二进制 / {url} / OpenAI 风格 {data[0].url|b64_json}。 */
  async function custom(c, image, opts) {
    if (!c.base) throw D.err("NO_BASE", "尚未配置自定义抠图接口地址");
    const headers = { "Content-Type": "application/json" };
    if (c.key) headers["Authorization"] = "Bearer " + c.key;
    const r = await fetch(c.base, { method: "POST", headers, body: JSON.stringify({ image: image, format: "png" }) });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw D.err("HTTP_" + r.status, t.slice(0, 200) || ("HTTP " + r.status));
    }
    const ct = (r.headers && r.headers.get && r.headers.get("content-type")) || "";
    if (ct.indexOf("image/") === 0) { const b = await r.blob(); return URL.createObjectURL(b); }
    const j = await r.json().catch(() => null);
    const item = j && j.data && j.data[0];
    const u = (j && j.url)
      || (item && item.url)
      || (item && item.b64_json ? "data:image/png;base64," + item.b64_json : "");
    if (!u) throw D.err("BAD_RESP", "自定义抠图返回无图片");
    return u;
  }

  function absUrl(u) {
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\//.test(u)) return (typeof location !== "undefined" && location.origin ? location.origin : "") + u;
    return u;
  }

  function dataUrlToBlob(dataUrl) {
    const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(String(dataUrl));
    if (!m) return null;
    const mime = m[1] || "image/png";
    if (m[2]) {
      try {
        const bin = atob(m[3]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
      } catch (e) { return null; }
    }
    try { return new Blob([decodeURIComponent(m[3])], { type: mime }); } catch (e) { return null; }
  }

  D.adapters.matting = matting;
})();
