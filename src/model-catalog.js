/* 铜龙电商 · 统一模型目录（地基层 · 1.4）
 * 一份清单，对话与短剧共用：按「厂商」归组，每个厂商声明它在各能力
 * （llm / image / video / tts / lipsync）下提供的模型。
 * 对话平台预设与短剧适配器都从这里取模型名，避免两处各维护一份。
 * 纯数据 + 查询，无副作用；厂商 id 与「厂商钥匙库」一致，钥匙由 vendorKeys 按 id 取。 */
(function () {
  const KINDS = ["llm", "image", "video", "tts", "lipsync"];

  /* ===== 厂商目录：id 与厂商钥匙库一致 ===== */
  const VENDORS = [
    {
      id: "volc-ark",
      name: "火山方舟",
      color: "#3370ff",
      base: {
        llm: "https://ark.cn-beijing.volces.com/api/v3",
        image: "https://ark.cn-beijing.volces.com/api/v3",
        video: "https://ark.cn-beijing.volces.com"
      },
      caps: {
        llm: [
          { id: "doubao-seed-1-6-250615", label: "豆包 Seed 1.6" }
        ],
        image: [
          { id: "doubao-seedream-4-5-251128", label: "Seedream 4.5" },
          { id: "doubao-seedream-5-0-260128", label: "Seedream 5.0" },
          { id: "doubao-seedream-4-0-250828", label: "Seedream 4.0" }
        ],
        video: [
          { id: "doubao-seedance-1-0-pro-fast-251015", label: "Seedance 1.0 Pro Fast" },
          { id: "doubao-seedance-1-0-pro-250528", label: "Seedance 1.0 Pro" },
          { id: "doubao-seedance-2-0-mini-260615", label: "Seedance 2.0 Mini" },
          { id: "doubao-seedance-2-0-fast-260128", label: "Seedance 2.0 Fast" },
          { id: "doubao-seedance-2-0-260128", label: "Seedance 2.0" },
          { id: "doubao-seedance-2-5-260628", label: "Seedance 2.5" }
        ]
      }
    },
    {
      id: "aliyun-bailian",
      name: "阿里云百炼",
      color: "#ff6a3d",
      base: {
        llm: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        image: "https://dashscope.aliyuncs.com",
        video: "https://dashscope.aliyuncs.com"
      },
      caps: {
        llm: [
          { id: "qwen-plus", label: "千问 Plus" },
          { id: "qwen-turbo", label: "千问 Turbo" },
          { id: "qwen-max", label: "千问 Max" },
          { id: "qwen-long", label: "千问 Long" },
          { id: "qwen3-coder-plus", label: "千问 Coder" },
          { id: "qwen2.5-coder-32b-instruct", label: "千问 Coder 2.5" }
        ],
        image: [
          { id: "qwen-image-3.0-pro", label: "通义万相 3.0 Pro" },
          { id: "wan2.2-t2i-flash", label: "万相 2.2 T2I Flash" }
        ],
        /* 百炼是否提供生视频（万相视频）待确认，先留空见总方案附录 B */
        video: []
      }
    },
    {
      id: "kling",
      name: "快手可灵",
      color: "#7c5cff",
      base: { video: "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com" },
      caps: {
        video: [
          { id: "kling/kling-v3-turbo-video-generation", label: "可灵 v3 Turbo" },
          { id: "kling/kling-v3-video-generation", label: "可灵 v3" },
          { id: "kling/kling-v3-omni-video-generation", label: "可灵 v3 Omni" }
        ]
      }
    },
    {
      id: "volc-speech",
      name: "火山语音",
      color: "#3370ff",
      base: { tts: "https://openspeech.bytedance.com/api/v3/tts/unidirectional" },
      caps: {
        tts: [
          { id: "seed-tts-2.0", label: "语音合成 2.0" }
        ]
      }
    },
    {
      id: "volc-vision",
      name: "火山视觉智能",
      color: "#3370ff",
      base: { lipsync: "https://visual.volcengineapi.com" },
      caps: {
        lipsync: [
          { id: "jimeng_realman_avatar_picture_omni_v15", label: "即梦 OmniHuman 1.5" }
        ]
      }
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      color: "#4D6BFE",
      base: { llm: "https://api.deepseek.com/v1" },
      caps: {
        llm: [
          { id: "deepseek-chat", label: "DeepSeek Chat" },
          { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
          { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
          { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" }
        ]
      }
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      color: "#8A63D2",
      base: { llm: "https://openrouter.ai/api/v1" },
      caps: {
        llm: [
          "deepseek/deepseek-chat-v3-0324:free",
          "meta-llama/llama-3.3-70b-instruct:free",
          "qwen/qwen-2.5-72b-instruct:free",
          "google/gemini-2.5-flash",
          "anthropic/claude-3.5-sonnet",
          "openai/gpt-4o-mini"
        ]
      }
    },
    {
      id: "moonshot",
      name: "Kimi 月之暗面",
      color: "#0E6FFF",
      base: { llm: "https://api.moonshot.cn/v1" },
      caps: {
        llm: [
          { id: "moonshot-v1-8k", label: "Kimi 8K" },
          { id: "moonshot-v1-32k", label: "Kimi 32K" },
          { id: "moonshot-v1-128k", label: "Kimi 128K" },
          { id: "kimi-latest", label: "Kimi Latest" }
        ]
      }
    },
    {
      id: "zhipu",
      name: "智谱 GLM",
      color: "#1E7BFF",
      base: { llm: "https://open.bigmodel.cn/api/paas/v4" },
      caps: {
        llm: [
          { id: "glm-4-flash", label: "GLM-4-Flash（免费）" },
          { id: "glm-4-flashx", label: "GLM-4-FlashX" },
          { id: "glm-4-plus", label: "GLM-4-Plus" },
          { id: "glm-4-long", label: "GLM-4-Long" },
          { id: "glm-4-air", label: "GLM-4-Air" }
        ]
      }
    },
    {
      id: "siliconflow",
      name: "硅基流动",
      color: "#00C3FF",
      base: { llm: "https://api.siliconflow.cn/v1" },
      caps: {
        llm: [
          "Qwen/Qwen2.5-7B-Instruct",
          "THUDM/glm-4-9b-chat",
          "deepseek-ai/DeepSeek-V3",
          "meta-llama/Llama-3.3-70B-Instruct"
        ]
      }
    },
    {
      id: "openai",
      name: "OpenAI",
      color: "#10A37F",
      base: { llm: "https://api.openai.com/v1" },
      caps: {
        llm: [
          { id: "gpt-4o-mini", label: "GPT-4o mini" },
          { id: "gpt-4o", label: "GPT-4o" },
          { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
          { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
        ]
      }
    },
    {
      id: "custom",
      name: "自定义接口",
      color: "#9aa7bd",
      base: {},
      caps: { llm: [], image: [], video: [], tts: [], lipsync: [] }
    }
  ];

  /* 平台 id / 短剧 provider id / 店员大脑 id → 厂商 id（同名可省略） */
  const ALIAS = {
    qwen: "aliyun-bailian",
    doubao: "volc-ark",
    seedream: "volc-ark",
    seedance: "volc-ark",
    wanx: "aliyun-bailian",
    kling: "kling",
    volc: "volc-speech",
    "volc-koubo": "volc-vision"
  };

  function vendor(id) {
    return VENDORS.find(v => v.id === id) || null;
  }

  /* 任意 id（厂商 / 平台 / provider）→ 厂商 id；找不到原样返回 */
  function vendorFor(id) {
    if (vendor(id)) return id;
    return ALIAS[id] || id || "";
  }

  function vendorOf(id) {
    return vendor(vendorFor(id));
  }

  function normalize(v, kind, item) {
    const raw = (item && typeof item === "object") ? item : { id: String(item || "") };
    return {
      id: raw.id,
      label: raw.label || raw.id,
      vendor: v.id,
      vendorName: v.name,
      kind: kind
    };
  }

  function capsOf(v, kind) {
    if (!v || !v.caps || !v.caps[kind]) return [];
    return v.caps[kind];
  }

  /* 某厂商在某能力下的模型（id 可为厂商 id，也可为平台/provider 别名） */
  function models(kind, id) {
    const v = vendorOf(id);
    if (!v) return [];
    return capsOf(v, kind).map(item => normalize(v, kind, item));
  }

  /* 某能力下全部厂商的模型 */
  function all(kind) {
    const out = [];
    VENDORS.forEach(v => { out.push.apply(out, capsOf(v, kind).map(item => normalize(v, kind, item))); });
    return out;
  }

  /* 提供某能力的厂商 */
  function vendors(kind) {
    return VENDORS.filter(v => capsOf(v, kind).length > 0);
  }

  function find(kind, modelId) {
    return all(kind).find(m => m.id === modelId) || null;
  }

  function modelIds(kind, id) {
    return models(kind, id).map(m => m.id);
  }

  function base(kind, id) {
    const v = vendorOf(id);
    return (v && v.base && v.base[kind]) || "";
  }

  /* 把目录里的模型并进对话平台预设（XLX.PROVIDERS），目录在前、原清单去重后兜底 */
  function applyToChat() {
    if (typeof XLX === "undefined" || !XLX.PROVIDERS) return;
    XLX.PROVIDERS.forEach(p => {
      const ids = modelIds("llm", p.id);
      if (!ids.length) return;
      const rest = (p.models || []).filter(x => ids.indexOf(x) < 0);
      p.models = ids.concat(rest);
      if (!p.base) p.base = base("llm", p.id);
      if (!p.model && p.models.length) p.model = p.models[0];
    });
  }

  XLX.catalog = {
    KINDS,
    VENDORS,
    ALIAS,
    vendor,
    vendorFor,
    vendorOf,
    models,
    modelIds,
    all,
    vendors,
    find,
    base,
    applyToChat
  };

  /* 加载即把目录并入对话预设，保证「一份清单」生效 */
  applyToChat();
})();
