/* 铜龙电商 · AI 短剧工作台 · 全局配置与适配器目录 */
/* 只放数据与预设，无副作用。外部服务全部走适配器，便于替换或本地化。 */
(function () {
  XLX.drama = XLX.drama || {};

  XLX.drama.VERSION = "v1";

  /* 存储键（与既有 XLX.K 并列，独立命名空间） */
  XLX.drama.K = {
    SETTINGS: "xlx_drama_settings",
    PROJECTS: "xlx_drama_projects",
    CONSENTS: "xlx_drama_consents",
    LIBRARY: "xlx_drama_library"
  };

  /* ===== 图像适配器目录 ===== */
  XLX.drama.IMAGE_PROVIDERS = [
    {
      id: "seedream",
      name: "豆包 Seedream（火山方舟）",
      base: "https://ark.cn-beijing.volces.com/api/v3",
      model: "doubao-seedream-4-5-251128",
      models: ["doubao-seedream-4-5-251128", "doubao-seedream-5-0-260128", "doubao-seedream-4-0-250828"],
      keyHint: "火山方舟 API Key",
      keyLink: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
      ref: true,
      ratios: { "1:1": [2048, 2048], "9:16": [1440, 2560], "16:9": [2560, 1440], "3:4": [1728, 2304] },
      color: "#3370ff"
    },
    {
      id: "wanx",
      name: "通义万相（阿里云百炼）",
      base: "https://dashscope.aliyuncs.com",
      model: "qwen-image-3.0-pro",
      models: ["qwen-image-3.0-pro", "wan2.2-t2i-flash"],
      keyHint: "阿里云百炼 API Key",
      keyLink: "https://bailian.console.aliyun.com/",
      ref: true,
      ratios: { "1:1": [1024, 1024], "9:16": [768, 1344], "16:9": [1344, 768], "3:4": [896, 1152] },
      color: "#ff6a3d"
    },
    {
      id: "pollinations",
      name: "Pollinations（免费兜底）",
      base: "https://image.pollinations.ai",
      model: "",
      models: [],
      keyHint: "无需 Key",
      keyLink: "",
      ref: false,
      free: true,
      ratios: { "1:1": [1024, 1024], "9:16": [768, 1344], "16:9": [1344, 768], "3:4": [896, 1152] },
      color: "#9aa7bd"
    },
    {
      id: "custom-image",
      name: "自定义生图接口",
      base: "",
      model: "",
      models: [],
      keyHint: "OpenAI 兼容 /images/generations",
      keyLink: "",
      ref: true,
      ratios: { "1:1": [1024, 1024], "9:16": [768, 1344], "16:9": [1344, 768], "3:4": [896, 1152] },
      color: "#10b981"
    }
  ];

  /* ===== 视频适配器目录（仿真人）===== */
  XLX.drama.VIDEO_PROVIDERS = [
    {
      id: "seedance",
      name: "火山方舟 Seedance",
      base: "https://ark.cn-beijing.volces.com",
      model: "doubao-seedance-1-0-pro-fast-251015",
      models: [
        "doubao-seedance-1-0-pro-fast-251015",
        "doubao-seedance-1-0-pro-250528",
        "doubao-seedance-2-0-mini-260615",
        "doubao-seedance-2-0-fast-260128",
        "doubao-seedance-2-0-260128",
        "doubao-seedance-2-5-260628"
      ],
      keyHint: "火山方舟 API Key（即梦同源）",
      keyLink: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
      protocol: "task",
      firstLastFrame: true,
      ratios: ["9:16", "16:9", "1:1"],
      durations: [5, 10],
      color: "#3370ff"
    },
    {
      id: "kling",
      name: "可灵 Kling（阿里云百炼）",
      base: "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com",
      model: "kling/kling-v3-turbo-video-generation",
      models: [
        "kling/kling-v3-turbo-video-generation",
        "kling/kling-v3-video-generation",
        "kling/kling-v3-omni-video-generation"
      ],
      keyHint: "阿里云百炼 API Key，base 需替换 {WorkspaceId}",
      keyLink: "https://bailian.console.aliyun.com/",
      protocol: "task",
      firstLastFrame: true,
      ratios: ["9:16", "16:9"],
      durations: [5, 10],
      color: "#ff6a3d"
    },
    {
      id: "custom-video",
      name: "自定义视频服务（自托管预留）",
      base: "",
      model: "",
      models: [],
      keyHint: "任务式或同步式，兼容 selfhost-server 协议",
      keyLink: "",
      protocol: "task",
      firstLastFrame: true,
      ratios: ["9:16", "16:9"],
      durations: [5, 10],
      color: "#10b981"
    }
  ];

  /* ===== 语音适配器目录 ===== */
  XLX.drama.TTS_PROVIDERS = [
    {
      id: "volc",
      name: "火山引擎语音合成",
      base: "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
      cluster: "seed-tts-2.0",
      voices: [
        { id: "zh_female_vv_uranus_bigtts", name: "女声·Vivi 2.0" },
        { id: "zh_male_m191_uranus_bigtts", name: "男声·云舟 2.0" },
        { id: "zh_female_xiaohe_uranus_bigtts", name: "女声·小何 2.0" },
        { id: "zh_male_taocheng_uranus_bigtts", name: "男声·小天 2.0" },
        { id: "zh_female_tianmeitaozi_uranus_bigtts", name: "女声·甜美桃子 2.0" },
        { id: "zh_female_cancan_uranus_bigtts", name: "女声·知性灿灿 2.0" },
        { id: "zh_male_sunwukong_uranus_bigtts", name: "男声·猴哥 2.0" },
        { id: "zh_female_peiqi_uranus_bigtts", name: "女声·佩奇猪 2.0" },
        { id: "zh_male_dayi_uranus_bigtts", name: "男声·大壹 2.0" }
      ],
      keyHint: "火山语音 API Key（新版控制台，需先开通「语音合成2.0」）",
      keyLink: "https://console.volcengine.com/speech/new/setting/apikeys",
      color: "#3370ff"
    },
    {
      id: "custom-tts",
      name: "自定义语音接口",
      base: "",
      cluster: "",
      voices: [],
      keyHint: "POST 返回音频 URL 或 base64",
      keyLink: "",
      color: "#10b981"
    }
  ];

  /* ===== 口型适配器目录 ===== */
  XLX.drama.LIPSYNC_PROVIDERS = [
    {
      id: "volc-koubo",
      name: "火山即梦数字人（口型）",
      base: "https://visual.volcengineapi.com",
      model: "jimeng_realman_avatar_picture_omni_v15",
      action: "CVSubmitTask",
      pollAction: "CVGetResult",
      version: "2022-08-31",
      resolution: 1080,
      keyHint: "AccessKey ID",
      secretHint: "Secret Access Key",
      keyLink: "https://console.volcengine.com/iam/keymanage/",
      mode: "image",
      color: "#3370ff"
    },
    {
      id: "custom-lipsync",
      name: "自定义口型服务",
      base: "",
      keyHint: "任务式：创建任务 + 轮询",
      keyLink: "",
      mode: "video",
      color: "#10b981"
    }
  ];

  /* ===== 画风预设（漫剧）===== */
  XLX.drama.STYLES = [
    { id: "jp-anime", name: "日式动漫", prompt: "日式漫画风格，干净线条，色彩明快，动漫分镜，高完成度插画" },
    { id: "cn-manhua", name: "国漫写实", prompt: "国漫写实风格，厚涂质感，电影级光影，东方审美，精细五官" },
    { id: "us-comic", name: "美式漫画", prompt: "美式漫画风格，写实笔触，高对比，网点，戏剧化光影" },
    { id: "ink", name: "水墨古风", prompt: "国风水墨，写意留白，淡彩晕染，古风意境" },
    { id: "3d", name: "3D 动画", prompt: "3D 渲染动画风格，皮克斯质感，柔和全局光，细腻材质" },
    { id: "realistic", name: "仿真人写实", prompt: "电影级写实摄影，真实皮肤质感，自然光，浅景深，专业布光" }
  ];

  /* ===== 剧种预设 ===== */
  XLX.drama.GENRES = [
    { id: "comic", name: "AI 漫剧", engine: "image", desc: "图片为主画面 + 微动效 + 配音字幕，成本低产能高" },
    { id: "realistic", name: "AI 仿真人剧", engine: "video", desc: "AI 生视频 + 口型同步，观感接近真人短剧，成本较高" }
  ];

  /* ===== 运镜预设 ===== */
  XLX.drama.MOTIONS = [
    { id: "zoom-in", name: "缓慢推近" },
    { id: "zoom-out", name: "缓慢拉远" },
    { id: "pan-left", name: "向左平移" },
    { id: "pan-right", name: "向右平移" },
    { id: "static", name: "静止" }
  ];

  /* ===== 时长与画幅 ===== */
  XLX.drama.DURATIONS = [3, 4, 5, 6, 8, 10];
  XLX.drama.RATIOS = [
    { id: "9:16", name: "竖屏 9:16（抖音）", size: [1080, 1920] },
    { id: "16:9", name: "横屏 16:9", size: [1920, 1080] },
    { id: "1:1", name: "方形 1:1", size: [1080, 1080] }
  ];

  /* ===== 适配器注册表与解析 ===== */
  XLX.drama.adapterList = function (kind) {
    return { image: XLX.drama.IMAGE_PROVIDERS, video: XLX.drama.VIDEO_PROVIDERS, tts: XLX.drama.TTS_PROVIDERS, lipsync: XLX.drama.LIPSYNC_PROVIDERS }[kind] || [];
  };

  XLX.drama.adapterDef = function (kind, id) {
    const list = XLX.drama.adapterList(kind);
    return list.find(x => x.id === id) || list[0];
  };

  /* 读取短剧服务配置（含各适配器的 Key 等），Key 只存本地 */
  XLX.drama.getSettings = function () {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(XLX.drama.K.SETTINGS) || "{}"); } catch (e) { s = {}; }
    return s;
  };

  XLX.drama.saveSettings = function (s) {
    localStorage.setItem(XLX.drama.K.SETTINGS, JSON.stringify(s || {}));
  };

  XLX.drama.getAdapterConfig = function (kind) {
    const s = XLX.drama.getSettings();
    const map = s.adapters || {};
    const cur = map[kind] || {};
    const def = XLX.drama.adapterDef(kind, cur.provider);
    return {
      kind,
      provider: def.id,
      def,
      base: ((cur.base || "").trim() || def.base || "").replace(/\/+$/, ""),
      key: cur.key || cur.secret || "",
      secret: cur.secret || "",
      appId: cur.appId || "",
      cluster: (cur.cluster || def.cluster || "").trim(),
      model: (cur.model || def.model || "").trim(),
      resolution: cur.resolution || def.resolution || 0,
      retryDelay: (cur.retryDelay === undefined) ? def.retryDelay : cur.retryDelay,
      action: (cur.action || def.action || "").trim(),
      pollAction: (cur.pollAction || def.pollAction || "").trim(),
      version: (cur.version || def.version || "").trim(),
      voice: cur.voice || ((def.voices && def.voices[0]) ? def.voices[0].id : "")
    };
  };

  XLX.drama.setAdapterConfig = function (kind, cfg) {
    const s = XLX.drama.getSettings();
    s.adapters = s.adapters || {};
    s.adapters[kind] = Object.assign({}, s.adapters[kind] || {}, cfg || {});
    XLX.drama.saveSettings(s);
  };

  XLX.drama.isConfigured = function (kind) {
    const c = XLX.drama.getAdapterConfig(kind);
    if (c.provider === "pollinations") return true;
    if (!c.base || c.base.indexOf("your") === 0 || c.base.indexOf("{") >= 0) return false;
    return !!c.key || !!c.appId;
  };

  /* 统一错误码 */
  XLX.drama.err = function (code, msg, extra) {
    const e = new Error(msg || code);
    e.code = code;
    if (extra) Object.assign(e, extra);
    return e;
  };
})();
