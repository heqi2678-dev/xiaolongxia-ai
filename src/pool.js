/* 铜龙电商 · 统一适配器接口（地基层 · 1.4）
 * 所有厂商能力（对话 / 生图 / 生视频 / 配音 / 口型）实现同一份契约：
 *   { kind, id, vendor, label, run(opts, ctx) }
 * pool 负责登记与按 kind + id 派发；模型清单统一从 XLX.catalog 取。
 * 现有四类短剧适配器与对话能力原样保留，通过 syncDrama() / registerLlm() 接入，不重写实现。 */
(function () {
  const KINDS = ["llm", "image", "video", "tts", "lipsync"];
  const reg = {};

  function bucket(kind) {
    reg[kind] = reg[kind] || {};
    return reg[kind];
  }

  /* 登记一个适配器：run 为唯一执行入口，签名 (opts, ctx) => Promise */
  function register(a) {
    if (!a || !a.kind || !a.id) return null;
    const entry = {
      kind: a.kind,
      id: a.id,
      vendor: a.vendor || a.id,
      label: a.label || a.id,
      run: typeof a.run === "function" ? a.run : async () => { throw new Error("适配器未实现 run：" + a.kind + "." + a.id); }
    };
    bucket(a.kind)[a.id] = entry;
    return entry;
  }

  function get(kind, id) {
    return (reg[kind] || {})[id] || null;
  }

  function list(kind) {
    const b = reg[kind] || {};
    return Object.keys(b).map(k => b[k]);
  }

  /* 某能力当前选中的适配器 id：对话固定 chat；短剧读设置里的 provider */
  function currentId(kind) {
    if (kind === "llm") return "chat";
    if (XLX.drama && XLX.drama.getAdapterConfig) return XLX.drama.getAdapterConfig(kind).provider;
    return "";
  }

  /* 统一执行入口：不传 id 时用当前适配器 */
  function run(kind, opts, ctx, id) {
    const useId = id || currentId(kind);
    const a = get(kind, useId) || list(kind)[0];
    if (!a) throw new Error("没有可用的适配器：" + kind + (useId ? "." + useId : ""));
    return a.run(opts || {}, ctx || {});
  }

  /* 该适配器的模型清单：统一走模型目录 */
  function models(kind, id) {
    const useId = id || currentId(kind);
    if (XLX.catalog && XLX.catalog.models) return XLX.catalog.models(kind, useId);
    return [];
  }

  function descriptor(kind, id) {
    const a = get(kind, id);
    if (!a) return null;
    return Object.assign({}, a, { models: models(kind, id) });
  }

  /* ===== 接入现有四类短剧适配器 ===== */
  function dramaRun(kind, opts, ctx) {
    const A = XLX.drama.adapters[kind];
    if (kind === "image") return A.generate(opts);
    if (kind === "tts") return A.synth(opts);
    return A.generate(opts, ctx.onProgress, ctx.signal);
  }

  function syncDrama() {
    const D = XLX.drama;
    if (!D || !D.adapters || !D.adapterList) return;
    ["image", "video", "tts", "lipsync"].forEach(kind => {
      D.adapterList(kind).forEach(def => {
        register({
          kind: kind,
          id: def.id,
          vendor: (XLX.catalog && XLX.catalog.vendorFor) ? XLX.catalog.vendorFor(def.id) : def.id,
          label: def.name || def.id,
          run: (opts, ctx) => dramaRun(kind, opts, ctx)
        });
      });
    });
  }

  /* ===== 接入对话能力（OpenAI 兼容）===== */
  function registerLlm() {
    if (!XLX.llm || !XLX.llm.chat) return;
    register({
      kind: "llm",
      id: "chat",
      vendor: "openai-compatible",
      label: "对话（OpenAI 兼容）",
      run: (opts) => XLX.llm.chat(opts.messages || [], opts.chat || {})
    });
  }

  function auto() {
    registerLlm();
    syncDrama();
  }

  XLX.pool = {
    KINDS,
    register,
    get,
    list,
    run,
    models,
    currentId,
    descriptor,
    syncDrama,
    registerLlm,
    auto
  };
})();
