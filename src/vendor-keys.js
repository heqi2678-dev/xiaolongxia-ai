/* 铜龙电商 · 厂商钥匙库（地基层）
 * 一处填、全站用：按「厂商」分组保存钥匙，智能对话 / 短剧工作台 / 模型库 / 店员大脑共用。
 * 旧输入框保留兜底：厂商钥匙库有值优先；没填则各回落到原来的旧配置。
 * 纯前端，仅存 localStorage，不上传服务器。 */
(function () {
  const SETTINGS = "xlx_vendor_keys";
  const MIGRATED = "xlx_vendor_keys_migrated";

  /* ===== 厂商目录：一处填、全站用 ===== */
  const VENDORS = [
    {
      id: "volc-ark", name: "火山方舟", color: "#3370ff",
      services: "对话·豆包 / 短剧·生图 Seedream / 短剧·生视频 Seedance",
      link: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
      fields: [{ k: "key", label: "API Key", type: "password", ph: "火山方舟 API Key" }]
    },
    {
      id: "aliyun-bailian", name: "阿里云百炼", color: "#ff6a3d",
      services: "对话·通义千问 / 短剧·生图 万相 / 短剧·生视频 万相",
      link: "https://bailian.console.aliyun.com/",
      fields: [{ k: "key", label: "API Key", type: "password", ph: "阿里云百炼 API Key" }]
    },
    {
      id: "kling", name: "快手可灵", color: "#7c5cff",
      services: "短剧·生视频 可灵",
      link: "https://app.klingai.com/",
      fields: [
        { k: "accessKey", label: "AccessKey", type: "password" },
        { k: "secretKey", label: "SecretKey", type: "password" },
        { k: "workspaceId", label: "WorkspaceId", type: "text", ph: "base 地址里的 {WorkspaceId}" }
      ]
    },
    {
      id: "volc-speech", name: "火山语音", color: "#3370ff",
      services: "短剧·配音",
      link: "https://console.volcengine.com/speech/new/setting/apikeys",
      fields: [
        { k: "key", label: "API Key", type: "password" },
        { k: "cluster", label: "资源 ID", type: "text", ph: "seed-tts-2.0" }
      ]
    },
    {
      id: "volc-vision", name: "火山视觉智能", color: "#3370ff",
      services: "短剧·口型",
      link: "https://console.volcengine.com/iam/keymanage/",
      fields: [
        { k: "accessKeyId", label: "AccessKey ID", type: "password" },
        { k: "secret", label: "Secret Access Key", type: "password" }
      ]
    },
    {
      id: "deepseek", name: "DeepSeek", color: "#4D6BFE",
      services: "对话 / AI 帮写 / 软件工坊",
      link: "https://platform.deepseek.com/",
      fields: [{ k: "key", label: "API Key", type: "password" }]
    },
    {
      id: "openrouter", name: "OpenRouter", color: "#8A63D2",
      services: "对话",
      link: "https://openrouter.ai/keys",
      fields: [{ k: "key", label: "API Key", type: "password" }]
    },
    {
      id: "moonshot", name: "Kimi 月之暗面", color: "#0E6FFF",
      services: "对话",
      link: "https://platform.moonshot.cn/",
      fields: [{ k: "key", label: "API Key", type: "password" }]
    },
    {
      id: "zhipu", name: "智谱 GLM", color: "#1E7BFF",
      services: "对话",
      link: "https://open.bigmodel.cn/",
      fields: [{ k: "key", label: "API Key", type: "password" }]
    },
    {
      id: "siliconflow", name: "硅基流动", color: "#00C3FF",
      services: "对话",
      link: "https://cloud.siliconflow.cn/",
      fields: [{ k: "key", label: "API Key", type: "password" }]
    },
    {
      id: "openai", name: "OpenAI", color: "#10A37F",
      services: "对话",
      link: "https://platform.openai.com/api-keys",
      fields: [{ k: "key", label: "API Key", type: "password" }]
    },
    {
      id: "custom", name: "自定义接口", color: "#9aa7bd",
      services: "对话 / 生图 / 生视频 / 配音 / 口型 各自一份",
      link: "",
      fields: [
        { k: "llm_key", label: "对话 Key", type: "password" },
        { k: "image_key", label: "生图 Key", type: "password" },
        { k: "video_key", label: "生视频 Key", type: "password" },
        { k: "tts_key", label: "配音 Key", type: "password" },
        { k: "lipsync_key", label: "口型 Key", type: "password" }
      ]
    }
  ];

  /* 服务 → 厂商+字段 映射。sid 形如 "llm.deepseek" / "video.kling" */
  const SERVICE = {
    "llm.deepseek": ["deepseek", "key"],
    "llm.openrouter": ["openrouter", "key"],
    "llm.moonshot": ["moonshot", "key"],
    "llm.qwen": ["aliyun-bailian", "key"],
    "llm.doubao": ["volc-ark", "key"],
    "llm.zhipu": ["zhipu", "key"],
    "llm.siliconflow": ["siliconflow", "key"],
    "llm.openai": ["openai", "key"],
    "llm.custom": ["custom", "llm_key"],
    "image.seedream": ["volc-ark", "key"],
    "image.wanx": ["aliyun-bailian", "key"],
    "image.custom": ["custom", "image_key"],
    "video.seedance": ["volc-ark", "key"],
    "video.kling": ["kling", "accessKey"],
    "video.custom": ["custom", "video_key"],
    "tts.volc": ["volc-speech", "key"],
    "tts.custom": ["custom", "tts_key"],
    "lipsync.volc-koubo": ["volc-vision", "accessKeyId"],
    "lipsync.custom": ["custom", "lipsync_key"]
  };

  /* 短剧 provider → 服务 sid */
  const DRAMA_SID = {
    seedream: "image.seedream",
    wanx: "image.wanx",
    seedance: "video.seedance",
    kling: "video.kling",
    volc: "tts.volc",
    "volc-koubo": "lipsync.volc-koubo"
  };

  /* 店员大脑 → 服务 sid */
  const BRAIN_SID = {
    deepseek: "llm.deepseek",
    qwen: "llm.qwen",
    doubao: "llm.doubao",
    custom: "llm.custom"
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(SETTINGS) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(SETTINGS, JSON.stringify(o || {})); } catch (e) {}
  }
  function trim(v) { return String(v == null ? "" : v).trim(); }
  function get(id) { return load()[id] || {}; }
  function set(id, patch) {
    const o = load();
    o[id] = Object.assign({}, o[id] || {}, patch || {});
    save(o);
    return o[id];
  }
  function field(id, k) { return trim((get(id) || {})[k]); }
  function vendorDef(id) { return VENDORS.find(v => v.id === id) || null; }
  function all() { return VENDORS; }
  function isConfigured(id) {
    const v = get(id) || {};
    return Object.keys(v).some(k => trim(v[k]));
  }
  /* 某服务当前生效的钥匙值（厂商钥匙库优先） */
  function serviceValue(sid, k) {
    const m = SERVICE[sid];
    if (!m) return "";
    return field(m[0], k || m[1]);
  }

  /* 对话 / 店员：厂商钥匙库里的对话钥匙 */
  function llmKey(vendorId) {
    const sid = "llm." + (vendorId || "");
    return serviceValue(sid);
  }
  function llmKeyOfPid(pid) { return llmKey(pid); }
  function llmKeyOfBrain(brain) { return serviceValue(BRAIN_SID[brain] || ""); }

  /* 短剧：按 provider 返回厂商钥匙库里的覆盖值（key/secret/appId/cluster/base） */
  function dramaResolve(provider) {
    const sid = DRAMA_SID[provider];
    const out = {};
    if (!sid) return out;
    const m = SERVICE[sid];
    const v = get(m[0]);
    if (m[0] === "kling") {
      if (trim(v.accessKey)) out.key = trim(v.accessKey);
      if (trim(v.secretKey)) out.secret = trim(v.secretKey);
      const w = trim(v.workspaceId);
      if (w) out.base = "https://" + w + ".cn-beijing.maas.aliyuncs.com";
    } else if (m[0] === "volc-vision") {
      if (trim(v.accessKeyId)) { out.key = trim(v.accessKeyId); out.appId = trim(v.accessKeyId); }
      if (trim(v.secret)) out.secret = trim(v.secret);
    } else if (m[0] === "volc-speech") {
      if (trim(v.key)) out.key = trim(v.key);
      if (trim(v.cluster)) out.cluster = trim(v.cluster);
    } else if (m[0] === "custom") {
      if (trim(v[m[1]])) out.key = trim(v[m[1]]);
    } else {
      if (trim(v.key)) out.key = trim(v.key);
    }
    return out;
  }

  /* 旧输入框写穿：存旧框时同步一份进厂商钥匙库（非空才写，避免清空误伤） */
  function syncLlm(pid, key) {
    const sid = "llm." + (pid || "");
    const m = SERVICE[sid];
    if (!m) return;
    const v = trim(key);
    if (v) set(m[0], { [m[1]]: v });
  }
  function syncBrain(brain, key) {
    const sid = BRAIN_SID[brain];
    const m = sid && SERVICE[sid];
    if (!m) return;
    const v = trim(key);
    if (v) set(m[0], { [m[1]]: v });
  }
  function syncDrama(provider, cfg) {
    const sid = DRAMA_SID[provider];
    const m = sid && SERVICE[sid];
    if (!m) return;
    cfg = cfg || {};
    if (m[0] === "kling") {
      if (trim(cfg.key)) set(m[0], { accessKey: trim(cfg.key) });
      if (trim(cfg.secret)) set(m[0], { secretKey: trim(cfg.secret) });
      const w = workspaceFromBase(cfg.base);
      if (w) set(m[0], { workspaceId: w });
    } else if (m[0] === "volc-vision") {
      if (trim(cfg.key)) set(m[0], { accessKeyId: trim(cfg.key) });
      if (trim(cfg.secret)) set(m[0], { secret: trim(cfg.secret) });
    } else if (m[0] === "volc-speech") {
      if (trim(cfg.key)) set(m[0], { key: trim(cfg.key) });
      if (trim(cfg.cluster)) set(m[0], { cluster: trim(cfg.cluster) });
    } else if (m[0] === "custom") {
      if (trim(cfg.key)) set(m[0], { [m[1]]: trim(cfg.key) });
    } else {
      if (trim(cfg.key)) set(m[0], { key: trim(cfg.key) });
    }
  }

  function workspaceFromBase(base) {
    const s = trim(base);
    const m = s.match(/^https?:\/\/([a-z0-9-]+)\./i);
    if (!m) return "";
    if (m[1] === "{WorkspaceId}" || m[1].toLowerCase() === "api" || /^cn-/.test(m[1])) return "";
    return m[1];
  }

  /* ===== 旧数据一次性迁移：四本账已有的钥匙，搬进厂商钥匙库 ===== */
  function parse(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "");
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function migrate() {
    try {
      if (localStorage.getItem(MIGRATED)) return;
      const o = load();
      let changed = false;
      const put = (id, k, val) => {
        val = trim(val);
        if (!val) return;
        o[id] = o[id] || {};
        if (!trim(o[id][k])) { o[id][k] = val; changed = true; }
      };
      const LLM_VENDOR = {
        deepseek: "deepseek", openrouter: "openrouter", moonshot: "moonshot",
        qwen: "aliyun-bailian", zhipu: "zhipu", siliconflow: "siliconflow", openai: "openai"
      };

      /* 1) 短剧四类 */
      const ds = parse("xlx_drama_settings", {}) || {};
      const ad = ds.adapters || {};
      if (ad.image) {
        if (ad.image.provider === "seedream") put("volc-ark", "key", ad.image.key);
        if (ad.image.provider === "wanx") put("aliyun-bailian", "key", ad.image.key);
        if (ad.image.provider === "custom") put("custom", "image_key", ad.image.key);
      }
      if (ad.video) {
        if (ad.video.provider === "seedance") put("volc-ark", "key", ad.video.key);
        if (ad.video.provider === "kling") {
          put("kling", "accessKey", ad.video.key);
          put("kling", "secretKey", ad.video.secret);
          put("kling", "workspaceId", workspaceFromBase(ad.video.base));
        }
        if (ad.video.provider === "custom") put("custom", "video_key", ad.video.key);
      }
      if (ad.tts) {
        if (ad.tts.provider === "volc") {
          put("volc-speech", "key", ad.tts.key || ad.tts.secret);
          put("volc-speech", "cluster", ad.tts.cluster);
        }
        if (ad.tts.provider === "custom") put("custom", "tts_key", ad.tts.key);
      }
      if (ad.lipsync) {
        if (ad.lipsync.provider === "volc-koubo") {
          put("volc-vision", "accessKeyId", ad.lipsync.key || ad.lipsync.appId);
          put("volc-vision", "secret", ad.lipsync.secret);
        }
        if (ad.lipsync.provider === "custom") put("custom", "lipsync_key", ad.lipsync.key);
      }

      /* 2) 对话·单配置 xlx_settings.providers[] */
      const st = parse("xlx_settings", {}) || {};
      (st.providers || []).forEach(p => {
        const v = LLM_VENDOR[p && p.id];
        if (v) put(v, "key", p.key);
        if (p && p.id === "custom") put("custom", "llm_key", p.key);
      });

      /* 3) 对话·模型库 xlx_models[] */
      (parse("xlx_models", []) || []).forEach(m => {
        const v = LLM_VENDOR[m && m.vendor];
        if (v) put(v, "key", m.key);
        if (m && m.vendor === "custom") put("custom", "llm_key", m.key);
      });

      /* 4) 店员 Hermes 大脑 xlx_clerk_brain.keys{} */
      const br = parse("xlx_clerk_brain", {}) || {};
      Object.keys(br.keys || {}).forEach(b => {
        const sid = BRAIN_SID[b];
        const m = sid && SERVICE[sid];
        if (m) put(m[0], m[1], br.keys[b]);
      });

      if (changed) save(o);
      localStorage.setItem(MIGRATED, "1");
    } catch (e) {}
  }

  XLX.vendorKeys = {
    SETTINGS,
    MIGRATED,
    all,
    vendorDef,
    get,
    set,
    field,
    isConfigured,
    serviceValue,
    llmKey,
    llmKeyOfPid,
    llmKeyOfBrain,
    dramaResolve,
    syncLlm,
    syncBrain,
    syncDrama,
    workspaceFromBase,
    migrate
  };

  /* 加载即尝试迁移旧钥匙 */
  migrate();
})();
