/* 铜龙电商ai助手 · AI 短剧工作台 · 技能缩略图映射
 * 为技能卡提供真实的本地缩略图（assets/skills/*.jpg，联网搜集后落入本地，离线可用）。
 * 未显式配置的技能按所属分类回退到一张同类主题图，保证每张卡都有画面。 */
(function () {
  const DIR = "assets/skills/";
  const BY_ID = {
    /* 电商 */
    "ecom-copy": "product-real",
    "title-opt": "shopping-sale",
    "keyword-heat": "data-analytics",
    "store-data": "report-summary",
    "competitor": "planner-strategy",
    "live-talk": "livestream-sell",
    "review-reply": "social-media",
    "detail-plan": "product-real",
    /* 新媒体 */
    "gzh-article": "writing-article",
    "xhs-note": "social-media",
    "short-copy": "video-creator",
    "hot-title": "video-creator",
    "hot-topic": "data-analytics",
    "douyin-script": "storyboard-sketch",
    /* 视频创作 */
    "storyboard": "storyboard-sketch",
    "director-shots": "film-director",
    "script-studio": "writing-article",
    "title-intro": "film-cinema",
    "research-script": "data-analytics",
    "video-plan": "planner-strategy",
    "dubbing": "dubbing-mic",
    /* 办公 */
    "weekly-report": "report-summary",
    "work-sum": "report-summary",
    "ppt-outline": "presentation-slides",
    "excel-helper": "data-analytics",
    "meeting-notes": "meeting-team",
    "email": "office-work",
    "plan": "planner-strategy",
    "resume": "resume-interview",
    "speech": "speech-talk",
    "contract": "office-work",
    /* 编程开发 */
    "code-gen": "coding-dev",
    "code-explain": "coding-dev",
    "code-review": "coding-dev",
    "bug-fix": "coding-dev",
    "code-translate": "coding-dev",
    "regex": "coding-dev",
    "shell": "coding-dev",
    /* AI设计 */
    "poster-copy": "poster-design",
    "prompt-enhance": "ai-art",
    /* 工具箱 */
    "item-img-dl": "ecom-download",
    "img-watermark": "watermark-remove",
    "video-watermark": "watermark-remove",
    "video-text": "dubbing-mic"
  };
  const BY_CAT = {
    ecom: "shopping-sale",
    media: "social-media",
    video: "film-cinema",
    office: "office-work",
    dev: "coding-dev",
    design: "design-graphic"
  };
  XLX.SKILL_THUMBS = BY_ID;
  XLX.skillThumb = function (skill) {
    if (!skill) return DIR + "product-real.jpg";
    let name = BY_ID[skill.id];
    if (!name) name = BY_CAT[skill.cat] || "product-real";
    return DIR + name + ".jpg";
  };
})();
