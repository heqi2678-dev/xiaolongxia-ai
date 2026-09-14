/* 铜龙电商 · 全局配置（从 index.html 拆出的第 1 块，纯数据，无副作用） */
/* ===== 铜龙电商 全局配置 ===== */
const XLX = {};

XLX.VERSION = "v71";
XLX.APP_NAME = "铜龙电商";

/* ===== 暂缓功能开关（主人要求先摘掉，后续重新加入） =====
 * 摘掉的是「AI 生图」与「AI 剧作」两块：界面入口全部隐藏，实现代码原样保留。
 * 想恢复：把下面 image / drama 改成 false，并清空 XLX.PARKED_SKILLS 即可。
 */
XLX.PARKED = { image: true, drama: true };
XLX.PARKED_SKILLS = [
  "product-img", "text2img", "logo-design", "detail-longimg", "ecom-mainimg",
  "comic-story", "short-drama", "comic-drama", "live-drama", "ai-video-gen"
];

/* 存储键 */
XLX.K = {
  SETTINGS: "xlx_settings",
  CONVS: "xlx_conversations",
  MEMORY: "xlx_memory",
  COMMANDS: "xlx_commands",
  PROJECT: "xlx_project",
  IMAGES: "xlx_images",
  CHATS: "xlx_chat_meta",
  MODELS: "xlx_models",
  COMIC: "xlx_comic_draft"
};

/* 免费/低价模型平台预设（用户自带Key，按 OpenAI 兼容接口 /chat/completions 调用） */
XLX.PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    base: "https://api.deepseek.com/v1",
    key: "",
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    desc: "国内大模型，价格极低，速度快，适合日常对话与开发",
    color: "#4D6BFE",
    free: false
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    key: "",
    model: "deepseek/deepseek-chat-v3-0324:free",
    models: [
      "deepseek/deepseek-chat-v3-0324:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-72b-instruct:free",
      "google/gemini-2.5-flash",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini"
    ],
    desc: "聚合平台，内置大量完全免费模型(:free后缀)，一个Key通用",
    color: "#8A63D2",
    free: true
  },
  {
    id: "moonshot",
    name: "Kimi 月之暗面",
    base: "https://api.moonshot.cn/v1",
    key: "",
    model: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-latest"],
    desc: "Kimi 超长上下文，适合长文档分析",
    color: "#0E6FFF",
    free: false
  },
  {
    id: "qwen",
    name: "通义千问 Qwen",
    base: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    key: "",
    model: "qwen-plus",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-long", "qwen2.5-coder-32b-instruct"],
    desc: "阿里云百炼，新用户有免费额度，qwen-long可处理超长文本",
    color: "#615CED",
    free: false
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    base: "https://open.bigmodel.cn/api/paas/v4",
    key: "",
    model: "glm-4-flash",
    models: ["glm-4-flash", "glm-4-flashx", "glm-4-plus", "glm-4-long", "glm-4-air"],
    desc: "GLM-4-Flash 完全免费，新用户另送额度，编程能力出色",
    color: "#1E7BFF",
    free: true
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    base: "https://api.siliconflow.cn/v1",
    key: "",
    model: "Qwen/Qwen2.5-7B-Instruct",
    models: ["Qwen/Qwen2.5-7B-Instruct", "THUDM/glm-4-9b-chat", "deepseek-ai/DeepSeek-V3", "meta-llama/Llama-3.3-70B-Instruct"],
    desc: "聚合平台，多个开源模型完全免费，注册即送额度",
    color: "#00C3FF",
    free: true
  },
  {
    id: "openai",
    name: "OpenAI",
    base: "https://api.openai.com/v1",
    key: "",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    desc: "官方接口，全球通用",
    color: "#10A37F",
    free: false
  },
  {
    id: "custom",
    name: "自定义接口",
    base: "",
    key: "",
    model: "",
    models: [],
    desc: "任意 OpenAI 兼容接口，输入 Base URL + Key + 模型名",
    color: "#9aa7bd",
    free: true
  }
];

/* 免费模型推荐标签 */
XLX.FREE_MODELS = ["openrouter", "zhipu", "siliconflow"];

/* ===== 联网搜索渠道（可多选）===== */
XLX.SEARCH_ENGINES = [
  { id: "bing", name: "必应" },
  { id: "so360", name: "360" },
  { id: "wikipedia_zh", name: "维基百科" },
  { id: "github", name: "GitHub" },
];

/* ===== 计费网关配置（端口）=====
 * 未来接入付费技能时只需在此填写真实网关配置，无需改动业务代码。
 * - enabled: 是否启用付费校验（false=全部技能免费放行，当前阶段）
 * - endpoint: 支付/点数服务端接口地址（预留）
 * - pointsName: 点数名称（如 虾币/积分）
 * - plans: 会员方案定义 { pro: { name, price } }
 * - currency: 币种
 * - freeCode: 免费访问码。输入正确访问码的用户视为「自己人」，
 *   解锁全部技能（免费使用）；未输入的用户视为普通用户，付费技能需扣点数/会员。 */
/* ===== 计费配置 =====
 * enabled=false：全部技能免费，不做任何付费校验。
 * 未来若想加付费技能，只需将此开关置 true，并按 skills.js 末尾说明给技能加字段。
 * 纯前端无法安全收款（支付必须服务端），付费能力仅作预留。 */
XLX.BILLING = {
  enabled: false,
  endpoint: "",
  pointsName: "虾币",
  currency: "CNY",
  freeCode: "",
  plans: {
    pro: { name: "会员", price: 9.9, desc: "解锁全部付费技能" }
  }
};

XLX.DEFAULT_SYSTEM = "你是" + XLX.APP_NAME + "，一个功能强大的国产AI助手，搭载了数十个免费实用技能（电商、新媒体、视频创作、办公、编程开发等）。回答请始终使用简体中文，要专业、清晰、直接、实用，必要时给出可直接复制使用的成品（文案/代码/脚本/表格）。";

/* 默认快捷指令（解决日常重复工作） */
XLX.DEFAULT_COMMANDS = [
  { name: "写今日周报", icon: "report", prompt: "请根据我下面提供的工作内容，帮我写一份专业、简洁的今日工作周报：\n\n" },
  { name: "写工作总结", icon: "sum", prompt: "请帮我撰写一份结构化的工作总结报告，包含：工作概况、核心成果、存在问题、经验教训、下一步计划。内容要点：\n\n" },
  { name: "会议纪要", icon: "meeting", prompt: "请把下面的会议内容整理成一份规范的会议纪要（时间、参会人、议题、讨论要点、结论、待办事项）：\n\n" },
  { name: "商品标题优化", icon: "title", prompt: "请为我的商品优化一个高转化的电商标题，要求包含核心关键词、卖点、信任词，控制在30字内。商品信息：\n\n" },
  { name: "生成小红书笔记", icon: "redbook", prompt: "请写一篇小红书爆款笔记，包含吸睛标题、正文、话题标签（#），语气亲切有网感：\n\n" },
  { name: "回复买家消息", icon: "reply", prompt: "请帮我撰写一条专业、礼貌、能解决问题的买家回复。买家消息/场景：\n\n" }
];

/* 模型预设说明（供设置页提示） */
XLX.MODEL_HINTS = {
  openrouter: "在 OpenRouter 官网 models 页选任意 :free 结尾的模型即可免费使用",
  zhipu: "glm-4-flash 完全免费，无需付费即可使用",
  siliconflow: "部分开源模型免费，注册送 2000 万 token",
  deepseek: "价格极低，适合日常使用",
  qwen: "阿里云百炼新用户送免费额度",
  moonshot: "新用户送免费额度"
};

