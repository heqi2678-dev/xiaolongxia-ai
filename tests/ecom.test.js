/* 铜龙AI · 电商工作台（创作工作台 13 页）· 前端视图测试
 * 运行：node --test tests/ecom.test.js
 * 覆盖：导航/视图注册、13 页渲染结构、原型交互（卡片/chips/色板/开关/列表-画布切换）、共享通道。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("./dom-env.js");

const ROOT = path.resolve(__dirname, "..");
function src(file) { return fs.readFileSync(path.join(ROOT, "src/drama/ecom", file), "utf8"); }

const VIEW_FILES = ["ecom-home.js", "ecom-draw.js", "ecom-detail.js", "ecom-style.js", "ecom-video-i2v.js", "ecom-video-copy.js", "ecom-video-translate.js", "ecom-video.js", "ecom-toolbox.js", "ecom-mainedit.js", "ecom-detailedit.js", "ecom-localize.js", "ecom-gallery.js", "ecom-chrome.js"];
const STORE_FILE = "ecom-store.js";
const ICON_IDS = ["home", "wand", "poster", "crop", "layers", "translate", "grid", "palette", "video", "film", "globe", "play", "spark", "rotate"];

function boot(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="ecomHomeView" class="view"></div>'
    + '<div id="ecomDrawView" class="view"></div>'
    + '<div id="ecomDetailView" class="view"></div>'
    + '<div id="ecomStyleView" class="view"></div>'
    + '<div id="ecomVideoI2VView" class="view"></div>'
    + '<div id="ecomVideoCopyView" class="view"></div>'
    + '<div id="ecomVideoTranslateView" class="view"></div>'
    + '<div id="ecomVideoHomeView" class="view"></div>'
    + '<div id="ecomToolboxView" class="view"></div>'
    + '<div id="ecomMainEditView" class="view"></div>'
    + '<div id="ecomDetailEditView" class="view"></div>'
    + '<div id="ecomLocalizeView" class="view"></div>'
    + '<div id="ecomGalleryView" class="view"></div>'
    + '<div id="toasts"></div></body></html>',
    { runScripts: "outside-only", url: "http://localhost/dian/" });
  const w = dom.window;
  w.__go = null;
  w.__toasts = [];
  w.XLX = {};
  w.XLX.util = {
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    toast: (m) => { w.__toasts.push(m); },
    fmtTime: (ts) => "T" + ts
  };
  w.XLX.ICONS = {};
  ICON_IDS.forEach(id => { w.XLX.ICONS[id] = '<path d="M1 1"/>'; });
  w.XLX.app = { go: (v) => { w.__go = v; } };
  w.XLX.drama = {};
  w.fetch = fetchImpl || (() => Promise.resolve({ ok: false, status: 404, json: async () => ({ ok: false }) }));
  w.eval(src("ecom-sprite.js"));
  w.eval(src("ecom.js"));
  w.eval(src(STORE_FILE));
  VIEW_FILES.forEach(f => w.eval(src(f)));
  return { w, doc: w.document, EC: w.XLX.drama.ecom };
}

test("注册：导航 13 项、默认视图、视图容器齐备", () => {
  const { doc, EC } = boot();
  assert.equal(EC.NAV.length, 13, "导航 13 项");
  assert.deepEqual(EC.NAV.map(n => n.id),
    ["ecomHome", "ecomDraw", "ecomDetail", "ecomStyle", "ecomVideoI2V", "ecomVideoCopy", "ecomVideoTranslate", "ecomVideoHome", "ecomToolbox", "ecomMainEdit", "ecomDetailEdit", "ecomLocalize", "ecomGallery"]);
  assert.equal(EC.VIEWS.length, 13, "视图键 13 个");
  assert.equal(EC.DEFAULT_VIEW, "ecomHome", "默认视图为工作台");
  assert.equal(EC.ZONE, "ecom", "分区键 ecom");
  EC.VIEWS.forEach(v => assert.ok(doc.getElementById(v + "View"), "存在容器 #" + v + "View"));
  assert.ok(EC.TITLES.ecomDraw, "顶栏标题已注册");
});

test("缺口常量：EC.const 取值与爱创对齐", () => {
  const { EC } = boot();
  assert.ok(EC.const, "EC.const 已挂载");
  assert.equal(EC.const.PLATFORMS.length, 21, "平台 21");
  assert.equal(EC.const.LANGS.length, 16, "详情语言 16");
  assert.equal(EC.const.DETAIL_RATIOS.length, 10, "详情比例 10");
  assert.equal(EC.const.VIDEO_LANGS.length, 18, "视频语言 18");
  assert.deepEqual(EC.const.DETAIL_COUNTS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "详情张数 1-15");
});

test("工作台：10 大入口 + 4 数据块 + 最近项目 + 入口卡跳转", async () => {
  const { w, doc, EC } = boot();
  await EC.render("ecomHome");
  const el = doc.getElementById("ecomHomeView");
  assert.equal(el.querySelectorAll(".feature").length, 10, "10 个功能入口");
  assert.equal(el.querySelectorAll(".feature[data-go]").length, 10, "每个入口卡带 data-go");
  assert.equal(el.querySelectorAll(".stat").length, 4, "4 个数据块");
  assert.match(el.querySelector(".page-head h1").textContent, /下午好|你好|早上好/, "问候语");
  assert.match(el.textContent, /AI 作图/, "含 AI 作图入口");
  assert.match(el.textContent, /跨境本地化/, "含跨境本地化入口");
  assert.ok(el.querySelector(".proj-grid, .proj-list, .project"), "最近项目区已渲染");

  el.querySelector('.feature[data-go="ecomDetail"]').click();
  assert.equal(w.__go, "ecomDetail", "点击 AI 详情页入口卡跳转 ecomDetail");
  el.querySelector('.feature[data-go="ecomLocalize"]').click();
  assert.equal(w.__go, "ecomLocalize", "点击跨境本地化入口卡跳转 ecomLocalize");
  el.querySelector('.feature[data-go="ecomStyle"]').click();
  assert.equal(w.__go, "ecomStyle", "点击风格复刻入口卡跳转 ecomStyle");
  el.querySelector('.feature[data-go="ecomToolbox"]').click();
  assert.equal(w.__go, "ecomToolbox", "点击 AI 工具箱入口卡跳转 ecomToolbox");
});

test("AI 作图：12 工具卡 + prompt + 灵感推荐照片", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");
  assert.equal(el.querySelectorAll(".tool-card").length, 12, "12 个工具卡");
  assert.equal(el.querySelectorAll(".tool-card.on").length, 1, "默认选中 1 个工具");
  assert.equal(el.querySelectorAll(".insp-card").length, 6, "6 条灵感推荐");
  assert.ok(el.querySelector(".insp-card img"), "灵感推荐为真实照片");
  assert.match(el.textContent, /灵感推荐/, "含灵感推荐区块");
  el.querySelector(".insp-card").click();
  assert.match(el.querySelector(".comp-text").value, /板鞋/, "点击灵感回填提示词");
  assert.equal(el.querySelectorAll(".tool-card.on")[0].getAttribute("data-tool"), "agent", "点击灵感切到 Agent 模式");
  assert.ok(el.querySelector(".prompt-box textarea"), "大白话输入框");
  assert.match(el.textContent, /Agent模式/, "含 Agent模式工具卡");
  assert.ok(el.querySelector('.prompt-bar [data-opt="mode"]'), "底栏模式选择器");
  assert.ok(el.querySelector('.prompt-bar [data-opt="ratio"]'), "底栏比例/清晰度选择器");
  assert.ok(el.querySelector('.prompt-bar [data-opt="skill"]'), "底栏技能库入口");

  const cards = el.querySelectorAll(".tool-card");
  cards[3].click();
  assert.equal(cards[3].classList.contains("on"), true, "点击工具卡选中");
  assert.equal(el.querySelectorAll(".tool-card.on").length, 1, "工具卡同组单选");
});

test("AI 作图：切换模式改写模板与底栏（主图套图 / 图片翻译）", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");

  el.querySelector('.tool-card[data-tool="main"]').click();
  assert.equal(el.querySelector('.tool-card[data-tool="main"]').classList.contains("on"), true, "主图套图选中");
  assert.equal(el.querySelectorAll(".comp-slots .upload-slot").length, 2, "商品图 + 细节图双上传槽");
  assert.ok(el.querySelectorAll(".comp-line .inl-pill").length >= 4, "行内下拉占位");
  assert.match(el.querySelector(".comp-line").textContent, /请基于我的/, "主图套图模板文案");
  assert.match(el.querySelector(".comp-line").textContent, /主图套图/, "主图套图模板文案");
  assert.ok(el.querySelector('.prompt-bar [data-opt="quality"]'), "非 Agent 模式底栏为清晰度");
  assert.equal(el.querySelector('.prompt-bar [data-opt="skill"]'), null, "非 Agent 模式无技能库");

  el.querySelector('.tool-card[data-tool="trans"]').click();
  assert.match(el.querySelector(".comp-line").textContent, /将图片翻译成目标语言/, "图片翻译模板文案");
  assert.match(el.querySelector(".comp-line").textContent, /不翻译/, "图片翻译对象选项");

  el.querySelector('.tool-card[data-tool="agent"]').click();
  assert.ok(el.querySelector(".prompt-box textarea"), "切回 Agent 模式恢复大白话输入");
});

test("AI 作图：技能库浮层套用提示词", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");

  el.querySelector('.prompt-bar [data-opt="skill"]').click();
  const pop = doc.querySelector(".dc-pop");
  assert.ok(pop, "技能库浮层已弹出");
  assert.ok(pop.querySelectorAll(".skill-card").length >= 20, "技能库卡片齐备");
  assert.match(pop.textContent, /高端商品主图/, "含 商品展示 技能");

  pop.querySelector('.skill-card[data-name="高端商品主图"]').click();
  assert.match(el.querySelector(".comp-text").value, /高端电商主图/, "点击技能回填提示词");
});

test("AI 作图：比例浮层切换比例", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");

  el.querySelector('.prompt-bar [data-opt="ratio"]').click();
  const pop = doc.querySelector(".dc-pop");
  assert.ok(pop, "比例浮层已弹出");
  assert.equal(pop.querySelectorAll(".ratio-item").length, 8, "8 种比例");
  pop.querySelector('[data-ratio="16:9"]').click();
  assert.match(el.querySelector('.prompt-bar [data-opt="ratio"]').textContent, /16:9/, "比例已更新");
});

test("AI 详情图：三上传槽 + 模块双模式 + 张数步进 + 选择器", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDetail");
  const el = doc.getElementById("ecomDetailView");
  assert.equal(el.querySelectorAll(".gd-slot").length, 3, "主图/SKU/细节 三个上传槽");
  assert.ok(el.querySelector("textarea"), "补充要求文本框");
  assert.ok(el.querySelectorAll(".chip").length >= 4, "风格 chips");
  assert.equal(el.querySelectorAll(".gen-form [data-sel]").length, 5, "平台/语言/清晰度/比例/张数 五个选择器");
  assert.ok(el.querySelector(".gen-side"), "右侧空态说明");
  assert.ok(el.querySelector("[data-mod-mode-group]"), "详情图模块模式切换");
  assert.match(el.querySelector("[data-modules]").textContent, /AI 将依据/, "默认 AI 规划");
  assert.equal(el.querySelector("[data-mod-total]").hidden, true, "AI 模式隐藏合计");

  el.querySelector('[data-mod-mode="manual"]').click();
  const mods = el.querySelectorAll(".gd-mod");
  assert.equal(mods.length, 6, "6 个详情图模块");
  assert.equal(el.querySelectorAll(".gd-mod.on").length, 5, "默认选中 5 个模块（白底图选中、尺寸图未选）");
  assert.equal(el.querySelector("[data-mod-total]").hidden, false, "自选模式显示合计");
  assert.equal(el.querySelector("[data-count-field]").hidden, false, "自选模式仍常显张数选择器");

  const inc = el.querySelector('[data-mod-step="0"] [data-mod-inc]');
  inc.click();
  assert.equal(el.querySelector('[data-mod-step="0"] [data-mod-count]').textContent, "2", "模块张数 +1");
  const dec = el.querySelector('[data-mod-step="0"] [data-mod-dec]');
  dec.click(); dec.click();
  assert.equal(el.querySelector('[data-mod-step="0"] [data-mod-count]').textContent, "1", "模块张数下限为 1");
});

test("主图编辑：列表/画布双模式切换 + 工具/元素选中 + 色板 + 示例元素", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomMainEdit");
  const el = doc.getElementById("ecomMainEditView");
  const seg = el.querySelector("[data-mode-group]");
  assert.ok(seg, "模式切换段");
  assert.equal(seg.querySelectorAll("button").length, 2, "列表/画布两个按钮");
  assert.equal(el.querySelector(".view-list").hidden, false, "默认列表可见");
  assert.equal(el.querySelector(".view-canvas").hidden, true, "默认画布隐藏");
  assert.ok(el.querySelectorAll(".module-row").length >= 3, "列表含元素示例");
  assert.equal(el.querySelector(".module-empty"), null, "空态已移除");
  assert.ok(el.querySelector(".module-row .m-thumb img"), "元素缩略图为真实照片");
  assert.ok(el.querySelector(".swatches .sw"), "色板");

  const tools = el.querySelectorAll(".toolbar .tool");
  tools[1].click();
  assert.equal(tools[1].classList.contains("on"), true, "点击工具栏工具选中");
  assert.equal(el.querySelectorAll(".toolbar .tool.on").length, 1, "工具栏工具同组单选");

  const rows = el.querySelectorAll(".module-row");
  rows[0].click();
  assert.equal(rows[0].classList.contains("on"), true, "点击元素行选中");
  assert.equal(el.querySelectorAll(".module-row.on").length, 1, "元素行同组单选");

  seg.querySelector('[data-mode="canvas"]').click();
  assert.equal(el.querySelector(".view-list").hidden, true, "切画布后列表隐藏");
  assert.equal(el.querySelector(".view-canvas").hidden, false, "切画布后画布可见");
  assert.ok(el.querySelector(".view-canvas .sq-art"), "画布含示例");
  assert.ok(el.querySelector(".view-canvas .sq-prod img"), "画布商品为真实照片");
});

test("详情页编辑：模块库 + 双模式", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDetailEdit");
  const el = doc.getElementById("ecomDetailEditView");
  assert.ok(el.querySelector("[data-mode-group]"), "模式切换段");
  assert.ok(el.querySelectorAll(".module-row").length >= 3, "模块示例");
  assert.equal(el.querySelector(".module-empty"), null, "空态已移除");
  assert.ok(el.querySelector(".view-canvas .artboard .ab-block"), "画布含模块");
  assert.ok(el.querySelector(".ab-img img"), "画布图片为真实照片");
  const drows = el.querySelectorAll(".module-row");
  drows[2].click();
  assert.equal(drows[2].classList.contains("on"), true, "点击模块行选中");
  assert.equal(el.querySelectorAll(".module-row.on").length, 1, "模块行同组单选");
  el.querySelector('[data-mode="canvas"]').click();
  assert.equal(el.querySelector(".view-canvas").hidden, false, "切到画布");
});

test("跨境本地化：市场/语言 chips + 模特 + 配音开关 + 手机预览", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomLocalize");
  const el = doc.getElementById("ecomLocalizeView");
  assert.equal(el.querySelectorAll(".chips").length >= 2, true, "市场与语言两组 chips");
  assert.equal(el.querySelectorAll(".avchip").length, 4, "4 个模特族裔");
  assert.ok(el.querySelector(".switch"), "配音开关");
  assert.ok(el.querySelector(".phone"), "手机预览");

  const sw = el.querySelector(".switch");
  const before = sw.classList.contains("off");
  sw.click();
  assert.equal(sw.classList.contains("off"), !before, "开关可切换");
});

test("作品库：筛选 chips + 示例作品照片", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomGallery");
  const el = doc.getElementById("ecomGalleryView");
  assert.ok(el.querySelectorAll(".g-item").length >= 4, "作品示例已配图");
  assert.equal(el.querySelector(".g-empty"), null, "空态已移除");
  assert.ok(el.querySelector(".g-item .ph img"), "作品为真实照片");
  assert.ok(el.querySelectorAll(".chips .chip").length >= 4, "类型筛选");
  assert.ok(el.querySelector(".search"), "搜索框");
  assert.equal(el.querySelector(".pager"), null, "分页已移除");
});

test("风格复刻：参考设计图/商品图上传槽 + 尺寸/组数 chips + 生成条", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomStyle");
  const el = doc.getElementById("ecomStyleView");
  assert.ok(el.querySelector('[data-add-style]'), "参考设计图上传槽");
  assert.ok(el.querySelector('[data-add-product]'), "商品图上传槽");
  assert.ok(el.querySelectorAll(".chips .chip").length >= 4, "尺寸/组数 chips");
  const ratioBox = el.querySelector('[data-group="ratio"]');
  assert.equal(ratioBox.querySelectorAll(".chip").length, 10, "10 种比例");
  assert.match(ratioBox.textContent, /21:9/, "含 21:9");
  assert.doesNotMatch(ratioBox.textContent, /3:5/, "已移除 3:5");
  assert.ok(el.querySelector("[data-run]"), "生成按钮");
  assert.ok(el.querySelector("[data-bar]"), "进度条");
  assert.ok(el.querySelector(".result-grid"), "结果区");
});

test("AI 视频（入口）：3 个子页卡 + 点击跳转", async () => {
  const { w, doc, EC } = boot();
  await EC.render("ecomVideoHome");
  const el = doc.getElementById("ecomVideoHomeView");
  assert.equal(el.querySelectorAll(".feature[data-go]").length, 3, "3 个视频子入口");
  el.querySelector('.feature[data-go="ecomVideoI2V"]').click();
  assert.equal(w.__go, "ecomVideoI2V", "图生视频入口跳转");
  el.querySelector('.feature[data-go="ecomVideoTranslate"]').click();
  assert.equal(w.__go, "ecomVideoTranslate", "视频翻译入口跳转");
});

test("图生视频：参考图上传 + AI 帮写 + 时长/比例 chips + 手机预览", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomVideoI2V");
  const el = doc.getElementById("ecomVideoI2VView");
  assert.ok(el.querySelector(".dropzone"), "参考图上传槽");
  assert.ok(el.querySelector("[data-ai-write]"), "AI 帮写按钮");
  assert.ok(el.querySelectorAll(".chips .chip").length >= 3, "时长/比例 chips");
  assert.ok(el.querySelector(".phone"), "手机预览");
  assert.ok(el.querySelector("[data-run]"), "生成按钮");
  assert.equal(el.querySelectorAll(".i2v-insp").length, 4, "4 条发现灵感");
  assert.match(el.querySelector(".note").textContent, /成人用品/, "参考图限制提示");
  assert.match(el.querySelector("[data-hint]").textContent, /18 种语言|1–3 分钟/, "耗时提示");

  el.querySelector(".i2v-insp").click();
  assert.match(el.querySelector("[data-prompt]").value, /旁白/, "点击灵感回填脚本");
  assert.ok(el.querySelector("[data-ref] img"), "点击灵感套用参考图");
});

test("视频复刻：参考视频/产品图上传 + 生成按钮", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomVideoCopy");
  const el = doc.getElementById("ecomVideoCopyView");
  assert.ok(el.querySelectorAll(".dropzone").length >= 2, "参考视频与产品图上传槽");
  assert.ok(el.querySelector("[data-video]"), "参考视频选择");
  assert.ok(el.querySelector("[data-run]"), "生成按钮");
  assert.match(el.querySelector(".page-head h1").textContent, /爆款视频复刻/, "标题对齐 51aic");
  assert.match(el.innerHTML, /上传原视频/, "原视频槽文案对齐 51aic");
  assert.match(el.innerHTML, /上传产品图/, "产品图槽文案对齐 51aic");
  assert.equal(el.querySelectorAll("[data-uptab]").length, 2, "本地上传/链接上传 双 tab");
  el.querySelector('[data-uptab="link"]').click();
  assert.equal(el.querySelector('[data-uptab-pane="local"]').hidden, true, "切到链接上传隐藏本地");
  assert.equal(el.querySelector('[data-uptab-pane="link"]').hidden, false, "显示链接上传");
  assert.equal(el.querySelectorAll('[data-group="duration"] .chip').length, 3, "时长 5/10/15");
  assert.equal(el.querySelectorAll('[data-group="ratio"] .chip').length, 5, "比例 5 种");
  assert.equal(el.querySelectorAll('[data-group="resolution"] .chip').length, 2, "分辨率 480P/720P");
});

test("视频翻译：原视频上传 + 模式/语言 chips + 字幕开关 + 阶段日志", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomVideoTranslate");
  const el = doc.getElementById("ecomVideoTranslateView");
  assert.ok(el.querySelector(".dropzone"), "原视频上传槽");
  assert.ok(el.querySelectorAll("[data-mode] .chip").length >= 2 || el.querySelectorAll(".chips .chip").length >= 4, "模式/语言 chips");
  assert.ok(el.querySelector(".switch"), "字幕/开关项");
  assert.ok(el.querySelector("[data-stage]"), "阶段进度");
  assert.ok(el.querySelector("[data-log]"), "运行日志");
  assert.ok(el.querySelector("[data-run]"), "开始翻译按钮");
  const fontStep = el.querySelector('[data-stepper="subfont"]');
  assert.ok(fontStep && fontStep.getAttribute("data-val") === "64", "字幕字号步进器默认 64");
  assert.ok(el.querySelector('[data-stepper="subline"]'), "字幕行间距步进器");
  fontStep.querySelector("[data-step-inc]").click();
  assert.equal(fontStep.getAttribute("data-val"), "72", "字号步进 +8");
  assert.match(el.querySelector("[data-lang]").textContent, /请选择目标语言/, "目标语言无默认值");
  assert.match(el.querySelector("[data-hint]").textContent, /18 种语言/, "提示支持 18 种语言");
  assert.equal(el.querySelectorAll('.chips[data-group="subneed"] .chip').length, 2, "需要/不需要 二选一");
  assert.equal(el.querySelectorAll('.chips[data-group="substyle"] .chip').length, 5, "5 款预设字幕样式");
  assert.ok(el.querySelector('.chip[data-substyle] .sub-prev'), "字幕样式含可视化预览");
  assert.equal(el.querySelector("[data-subbox]").hidden, false, "默认需要新字幕，展示样式设置");
  const noSub = Array.from(el.querySelectorAll('.chips[data-group="subneed"] .chip')).find(c => c.textContent.trim() === "不需要");
  noSub.click();
  assert.equal(el.querySelector("[data-subbox]").hidden, true, "不需要新字幕时隐藏样式设置");
  const un = el.querySelector("[data-unmute]");
  assert.ok(un, "结果预览区含「点击开启声音」提示");
  assert.equal(un.hidden, true, "默认隐藏开声提示");
  assert.match(un.textContent, /点击开启声音/, "开声提示文案");
});

test("AI 工具箱：16 工具 + 画布 + 应用/撤销", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomToolbox");
  const el = doc.getElementById("ecomToolboxView");
  assert.ok(el.querySelector("[data-tools]"), "工具列表容器");
  assert.ok(el.querySelectorAll("[data-tools] .tool-card").length >= 16, "16 项工具");
  assert.ok(el.querySelector("[data-canvas]"), "画布");
  assert.ok(el.querySelector("[data-apply]"), "应用按钮");
  assert.ok(el.querySelector("[data-undo]"), "撤销按钮");
});

test("工作台：AI 作图快捷模式条 12 模式 + 跨页传参", async () => {
  const { w, doc, EC } = boot();
  await EC.render("ecomHome");
  const el = doc.getElementById("ecomHomeView");
  assert.ok(el.querySelector(".mode-strip"), "快捷模式条");
  const cards = el.querySelectorAll(".mode-card[data-draw-mode]");
  assert.equal(cards.length, 12, "12 个快捷模式");
  cards[0].click();
  assert.equal(w.__go, "ecomDraw", "点击快捷模式跳转 AI 作图");
  assert.equal(EC.pending.drawMode, cards[0].getAttribute("data-draw-mode"), "跨页写入待应用模式");
});

test("AI 作图：清晰度放开 2K/4K（hires 透传）", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");
  el.querySelector('.tool-card[data-tool="main"]').click();
  el.querySelector('.prompt-bar [data-opt="quality"]').click();
  const menu = doc.querySelector(".ecmenu");
  assert.ok(menu, "清晰度菜单已展开");
  const items = menu.querySelectorAll(".ecmenu-mi");
  assert.equal(items.length, 3, "三档清晰度");
  assert.equal(menu.querySelectorAll(".is-disabled").length, 0, "2K/4K 不再禁用");
  assert.match(menu.textContent, /1K 标准/, "含 1K 标准");
  assert.match(menu.textContent, /4K 超清/, "含 4K 超清");
  Array.from(items).find(x => /4K/.test(x.textContent)).click();
  assert.match(el.querySelector('.prompt-bar [data-opt="quality"]').textContent, /4K 超清/, "清晰度已切到 4K 超清");
});

test("视频复刻：支持粘贴视频链接载入", async () => {
  const { w, doc, EC } = boot();
  await EC.render("ecomVideoCopy");
  const el = doc.getElementById("ecomVideoCopyView");
  const input = el.querySelector("[data-link]");
  assert.ok(input, "链接输入框");
  assert.ok(el.querySelector("[data-link-load]"), "链接载入按钮");
  input.value = "not-a-url";
  el.querySelector("[data-link-load]").click();
  assert.ok(w.__toasts.some(m => /有效/.test(m)), "非法链接给出提示");
});

test("视频翻译：字幕位置详细设置九宫格弹窗", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomVideoTranslate");
  const el = doc.getElementById("ecomVideoTranslateView");
  const entry = el.querySelector("[data-subpos-open]");
  assert.ok(entry, "字幕位置详细设置入口");
  entry.click();
  const grid = doc.querySelector(".subpos-grid");
  assert.ok(grid, "九宫格弹窗已打开");
  assert.equal(grid.querySelectorAll(".subpos-cell").length, 9, "9 个候选位置");
  grid.querySelectorAll(".subpos-cell")[0].click();
  doc.querySelector("[data-subpos-ok]").click();
  assert.ok(el.__vt.subXY, "确定后写入自定义坐标");
  assert.equal(el.__vt.subXY.x, 0.08, "取九宫格左列 x");
  assert.equal(el.__vt.subXY.y, 0.1, "取九宫格顶行 y");
});

test("图生视频：生成记录入口 + 30天内含空态", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomVideoI2V");
  const el = doc.getElementById("ecomVideoI2VView");
  const btn = el.querySelector("[data-history]");
  assert.ok(btn, "生成记录入口");
  btn.click();
  await new Promise(r => setTimeout(r, 30));
  const empty = doc.querySelector(".ed-empty");
  assert.ok(empty, "无记录时展示空态");
  assert.match(empty.textContent, /暂无记录/, "空态文案含暂无记录");
});

test("上传槽：拖拽 / 粘贴接线（drop + paste 落到上传槽）", async () => {
  const { w, doc, EC } = boot();
  await EC.render("ecomVideoI2V");
  const el = doc.getElementById("ecomVideoI2VView");
  const dz = el.querySelector("[data-ref]");
  assert.match(dz.querySelector("b").textContent, /点击\/拖拽\/粘贴上传/, "上传槽提示含拖拽/粘贴");

  const file = new w.File([new Uint8Array([1, 2, 3])], "ref.png", { type: "image/png" });
  const drop = new w.Event("drop", { bubbles: true });
  Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } });
  dz.dispatchEvent(drop);
  await new Promise(r => setTimeout(r, 40));
  assert.ok(dz.querySelector("img"), "拖拽后参考图槽渲染图片");

  dz.dispatchEvent(new w.Event("mouseover", { bubbles: true }));
  const file2 = new w.File([new Uint8Array([4, 5, 6])], "paste.jpg", { type: "image/jpeg" });
  const paste = new w.Event("paste", { bubbles: true });
  Object.defineProperty(paste, "clipboardData", { value: { files: [file2] } });
  doc.dispatchEvent(paste);
  await new Promise(r => setTimeout(r, 40));
  assert.ok(dz.querySelector("img"), "粘贴后参考图槽仍渲染图片");
});

test("AI 工具箱：试试样片入口", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomToolbox");
  const el = doc.getElementById("ecomToolboxView");
  assert.ok(el.querySelector("[data-try]"), "试试样片按钮");
});

test("通道：api 走 /dian/api/ecom 且 go 委托 XLX.app", async () => {
  let seen = null;
  const { w, EC } = boot((url, opts) => {
    seen = { url, opts };
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, items: [] }) });
  });
  const j = await EC.api("GET", "/works");
  assert.equal(seen.url, "/dian/api/ecom/works", "接口前缀 /dian/api/ecom");
  assert.deepEqual(j, { ok: true, items: [] });
  EC.go("ecomDraw");
  assert.equal(w.__go, "ecomDraw", "go 委托给 app.go");
});

test("占位：未注册渲染器输出空态", () => {
  const { doc, w } = boot();
  w.document.body.insertAdjacentHTML("beforeend", '<div id="ecomGhostView" class="view"></div>');
  w.XLX.drama.ecom.render("ecomGhost");
  assert.match(doc.getElementById("ecomGhostView").textContent, /建设中/, "未注册视图显示空态");
});

test("存储层：资产 CRUD（IndexedDB 不可用时内存兜底）", async () => {
  const { EC } = boot();
  assert.ok(EC.store && EC.gen && EC.ui, "store/gen/ui 已挂载");
  const a = await EC.store.addDataUrl("data:image/png;base64,AAAA", { kind: "image", name: "测试图" });
  assert.ok(a.id, "新增返回资产 id");
  assert.equal((await EC.store.get(a.id)).name, "测试图", "get 命中记录");
  assert.equal((await EC.store.list()).length, 1, "list 返回全部");
  assert.equal((await EC.store.list({ kind: "image" })).length, 1, "按 kind 命中");
  assert.equal((await EC.store.list({ kind: "upload" })).length, 0, "kind 不匹配为空");
  await EC.store.remove(a.id);
  assert.equal(await EC.store.get(a.id), null, "remove 生效");
});

test("存储层：项目保存 / 读取 / 删除", async () => {
  const { EC } = boot();
  const p = await EC.store.saveProject({ name: "主图项目", view: "ecomMainEdit" });
  assert.ok(p.id && p.updatedAt, "项目含 id/updatedAt");
  const list = await EC.store.listProjects();
  assert.equal(list[0].name, "主图项目", "项目可读回");
  await EC.store.removeProject(p.id);
  assert.equal((await EC.store.listProjects()).length, 0, "项目可删除");
});

test("生成桥接：比例换算 + 未配置时 Pollinations 兜底", async () => {
  const { EC } = boot();
  assert.deepEqual(EC.gen.ratioWH("1:1"), [1024, 1024]);
  assert.deepEqual(EC.gen.ratioWH("16:9"), [1280, 720]);
  assert.deepEqual(EC.gen.ratioWH("3:4"), [768, 1024]);
  assert.deepEqual(EC.gen.ratioWH("乱写"), [1024, 1024], "未知比例回退 1:1");
  assert.equal(EC.gen.configured(), false, "未配置图像服务");
  assert.equal(EC.gen.providerName(), "Pollinations 免费", "兜底服务名");
  const u = EC.gen.pollinationsUrl("一只小龙虾", "1:1");
  assert.match(u, /^https:\/\/image\.pollinations\.ai\/prompt\//, "Pollinations 接口");
  assert.match(u, /width=1024&height=1024/, "按比例传宽高");
  assert.match(u, /model=flux/, "flux 模型");
  const r = await EC.gen.image({ prompt: "红色连衣裙", ratio: "3:4" });
  assert.equal(r.provider, "pollinations", "未配置走免费兜底");
  assert.match(r.url, /width=768&height=1024/, "兜底出图按比例");
});

test("生成桥接：extractJson 解析围栏 / 混排 / 数组 / 空值", () => {
  const { EC } = boot();
  assert.deepEqual(EC.gen.extractJson('```json\n{"a":1}\n```'), { a: 1 }, "剥离代码围栏");
  assert.deepEqual(EC.gen.extractJson('前缀 {"b":[1,2]} 后缀'), { b: [1, 2] }, "混排取对象");
  assert.deepEqual(EC.gen.extractJson('[{"c":3}]'), [{ c: 3 }], "数组根");
  assert.equal(EC.gen.extractJson("无 json"), null, "非 JSON 为 null");
  assert.equal(EC.gen.extractJson(""), null, "空串为 null");
});

test("生成桥接：OCR 未配置时 ocrConfigured 为 false 且拒绝", async () => {
  const { EC } = boot();
  assert.equal(EC.gen.ocrConfigured(), false, "未配置文字识别");
  await assert.rejects(() => EC.gen.ocr({ imageBase64: "x" }), /NO_OCR|文字识别/);
});

test("生成桥接：字幕烧制走 /dian/api/drama/subtitle", async () => {
  let seen = null;
  const { EC } = boot((url, opts) => {
    seen = { url, opts };
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, url: "/dian/api/drama/out/x.mp4", file: "x.mp4" }) });
  });
  const r = await EC.gen.subtitle({
    video: "https://x.test/a.mp4",
    cues: [{ start: 0, end: 1, text: "你好" }],
    style: { preset: "醒目黄", pos: "bottom", size: 0.05, lineHeight: 1.5 }
  });
  assert.equal(seen.url, "/dian/api/drama/subtitle", "字幕接口");
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.cues[0].text, "你好", "字幕透传");
  assert.equal(body.style.size, 0.05, "样式透传");
  assert.equal(r.url, "/dian/api/drama/out/x.mp4", "返回成片地址");
});

test("样式：电商根容器撑满视图并可纵向滚动", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/drama/ecom/ecom-css.js"), "utf8");
  assert.match(css, /\.ecom-ui\{[^}]*flex:1/, "根容器 flex:1 撑满视图");
  assert.match(css, /\.ecom-ui\{[^}]*min-height:0/, "根容器 min-height:0");
  assert.match(css, /\.ecom-ui\{[^}]*overflow-y:auto/, "根容器纵向可滚动");
});

test("通用 UI：modal 结构 / menu 构建 / el 生成 / uid 唯一", () => {
  const { doc, EC } = boot();
  const m = EC.ui.modal({ title: "标题<X>", body: "<p>hi</p>", wide: true });
  assert.ok(doc.querySelector(".modal-mask .modal.modal-wide"), "弹窗挂载且宽体");
  assert.equal(m.body.innerHTML, "<p>hi</p>", "body 注入");
  assert.ok(doc.querySelector(".modal-head h3").textContent.indexOf("<X>") >= 0, "标题 HTML 已转义");
  m.close();
  assert.equal(doc.querySelector(".modal-mask"), null, "close 移除弹窗");

  const anchor = doc.createElement("button");
  doc.body.appendChild(anchor);
  let picked = false;
  EC.ui.menu(anchor, [{ label: "下载", pick: () => { picked = true; } }, { sep: true }, { label: "删除", on: true }]);
  assert.equal(doc.querySelectorAll(".ecmenu .ecmenu-mi").length, 2, "两个可选菜单项");
  assert.ok(doc.querySelector(".ecmenu .ecmenu-sep"), "含分隔线");
  doc.querySelector(".ecmenu .ecmenu-mi").click();
  assert.equal(picked, true, "菜单项回调触发");
  assert.equal(doc.querySelector(".ecmenu"), null, "点击后关闭菜单");

  const n = EC.ui.el("span", "tag on", "<b>x</b>");
  assert.equal(n.tagName, "SPAN", "el 按标签创建");
  assert.equal(n.className, "tag on", "el 设置类名");
  assert.notEqual(EC.ui.uid("as"), EC.ui.uid("as"), "uid 唯一");
});

test("A+B 对齐：作图来源 / 详情图门控 / 通道弹层 / 复刻按钮 / 工具箱内联 / 作品库配额", async () => {
  {
    const { doc, EC } = boot();
    await EC.render("ecomDraw");
    const dr = doc.getElementById("ecomDrawView");
    assert.ok(dr.querySelector("[data-local-up]"), "作图 本地上传来源");
    assert.ok(dr.querySelector("[data-asset-pick]"), "作图 我的资产来源");
    assert.match(dr.querySelector(".cost").textContent, /5\/张/, "作图积分 5/张");
  }
  {
    const { doc, EC } = boot();
    await EC.render("ecomDetail");
    const de = doc.getElementById("ecomDetailView");
    assert.match(de.querySelector(".gen-form .panel-head").textContent, /产品图/, "详情图面板标题为产品图");
    assert.equal(de.querySelector(".gd-slot").getAttribute("data-slot"), "main", "首个槽为产品图");
    assert.equal(de.querySelector("[data-gen]").disabled, true, "未传产品图时生成按钮禁用");
    const body = de.querySelector("[data-extra-body]");
    assert.equal(body.hidden, true, "补充参考素材默认折叠");
    de.querySelector("[data-extra-toggle]").click();
    assert.equal(body.hidden, false, "点击展开补充参考素材");
    assert.ok(de.querySelector("[data-help]"), "产品图上传建议入口");
    de.querySelector("[data-help]").click();
    assert.ok(doc.querySelector(".gd-help-box"), "上传建议帮助弹层");
  }
  {
    const { doc, EC } = boot();
    await EC.render("ecomVideoI2V");
    const i2v = doc.getElementById("ecomVideoI2VView");
    assert.equal(i2v.querySelector('[data-group="duration"] .chip.on').textContent.trim(), "10秒", "图生视频默认 10 秒");
    assert.equal(i2v.querySelector('[data-group="ratio"] .chip.on').textContent.trim(), "16:9", "图生视频默认 16:9");
    assert.match(i2v.querySelector("[data-ai-write]").textContent, /AI优质帮写视频脚本/, "帮写按钮文案");
    assert.ok(i2v.querySelector("[data-channel-info]"), "通道说明入口");
    i2v.querySelector("[data-channel-info]").click();
    assert.equal(doc.querySelectorAll(".ch-card").length, 2, "通道弹层两张卡");
  }
  {
    const { doc, EC } = boot();
    await EC.render("ecomVideoCopy");
    const cp = doc.getElementById("ecomVideoCopyView");
    assert.match(cp.querySelector("[data-run]").textContent, /生成视频提示词/, "复刻主按钮文案");
    assert.equal(cp.querySelector('[data-group="duration"] .chip.on').textContent.trim(), "15秒", "复刻默认 15 秒");
    assert.ok(cp.querySelector("[data-channel-info]"), "复刻通道说明入口");
  }
  {
    const { doc, EC } = boot();
    await EC.render("ecomVideoTranslate");
    const vt = doc.getElementById("ecomVideoTranslateView");
    assert.ok(vt.querySelector("[data-voice]"), "配音音色下拉");
    assert.match(vt.querySelector("[data-voice]").textContent, /自动匹配音色/, "默认自动匹配音色");
    assert.match(vt.querySelector('[data-group="dur"]').textContent, /与原视频时长一致/, "时长第二项文案");
  }
  {
    const { doc, EC } = boot();
    await EC.render("ecomToolbox");
    const tb = doc.getElementById("ecomToolboxView");
    assert.ok(tb.querySelector("[data-top-upload]"), "工具箱顶部上传图片");
    assert.equal(tb.querySelectorAll("[data-card-upload]").length, 16, "16 张工具卡内联上传");
    assert.match(tb.querySelector(".page-head h1").textContent, /电商修图，一站搞定/, "工具箱页头标题");
    assert.match(tb.querySelector(".page-head p").textContent, /图片编辑的所有功能/, "工具箱页头综述");
  }
  {
    const { doc, EC } = boot();
    await EC.render("ecomGallery");
    const gl = doc.getElementById("ecomGalleryView");
    assert.match(gl.querySelector("[data-quota]").textContent, /\/ 100/, "作品库配额");
    assert.ok(gl.querySelector(".daterange"), "作品库日期筛选");
    assert.match(gl.querySelector(".g-dl-all").textContent, /下载全部/, "下载全部按钮");
  }
});

test("展示层（C）：工具条 / hero 入口 / 能力区 / 角色卡 / 平台 / CTA / 页脚 / 导航徽标", async () => {
  const { doc, EC } = boot();

  const nHome = EC.NAV.find(n => n.id === "ecomHome");
  const nGal = EC.NAV.find(n => n.id === "ecomGallery");
  assert.equal(nHome.label, "首页", "导航首项为首页");
  assert.equal(nGal.label, "资产", "导航末项为资产");
  assert.equal((EC.NAV.find(n => n.id === "ecomVideoTranslate") || {}).badge, "NEW", "视频翻译 NEW 徽标");
  assert.equal((EC.NAV.find(n => n.id === "ecomVideoHome") || {}).badge, "NEW", "AI 视频 NEW 徽标");

  await EC.render("ecomHome");
  const el = doc.getElementById("ecomHomeView");
  assert.ok(el.querySelector(".pp-topbar"), "顶部工具条");
  assert.equal(el.querySelectorAll(".pp-topbar .pp-link").length >= 6, true, "工具条入口不少于 6 个");
  assert.ok(el.querySelector('.pp-topbar [data-pp="usage"]'), "积分明细入口");
  assert.ok(el.querySelector('.pp-topbar [data-pp="notice"]'), "提示通知入口");
  assert.ok(el.querySelector(".pp-footer, .pp-foot"), "首页页脚");
  assert.ok(el.querySelector(".hero-collage"), "hero 商品缩略图拼贴");
  assert.equal(el.querySelectorAll(".hero-collage .hc-card").length, 4, "hero 拼贴 4 张商品图");
  assert.ok(el.querySelector(".hero-nav"), "hero 产品入口条");
  assert.equal(el.querySelectorAll(".hero-nav-item").length, 8, "hero 8 个产品入口");
  assert.ok(el.querySelector(".hero-points"), "hero 能力要点");
  assert.equal(el.querySelectorAll(".cap-block").length, 4, "4 个能力介绍块");
  assert.equal(el.querySelectorAll(".why-card").length, 4, "4 张为什么选择卡");
  assert.equal(el.querySelectorAll(".role-card").length, 4, "4 张角色卡");
  assert.equal(el.querySelectorAll(".plat-chip").length, 14, "14 个平台标签");
  assert.ok(el.querySelector(".cta-sec"), "底部 CTA");

  el.querySelector('.pp-topbar [data-pp="usage"]').click();
  assert.ok(doc.querySelector(".pp-usage"), "积分明细弹层");

  el.querySelector('.pp-topbar [data-pp="notice"]').click();
  assert.ok(doc.querySelector(".pp-faq"), "提示通知弹层");
  assert.ok(doc.querySelector(".pp-new"), "提示含 NEW 标记");

  const dr = doc.getElementById("ecomDrawView");
  await EC.render("ecomDraw");
  assert.equal(dr.querySelector(".pp-topbar"), null, "功能页不挂载工具条");
  assert.equal(dr.querySelector(".pp-foot"), null, "功能页不挂载页脚");
});

test("AI 作图：灵感推荐使用本地真实示例图（不再外链）", () => {
  const s = src("ecom-draw.js");
  assert.ok(!/oss\.fzputi\.com/.test(s), "灵感推荐不再引用外部 CDN");
  assert.match(s, /DEMO_BASE = "assets\/ecom\/demo\/"/, "灵感推荐指向本地素材目录");
  for (let i = 1; i <= 6; i++) {
    ["1", "2"].forEach((suf) => {
      const f = path.join(ROOT, "assets/ecom/demo", i + "-" + suf + ".jpg");
      assert.ok(fs.existsSync(f), "存在本地示例图 " + i + "-" + suf + ".jpg");
    });
  }
});

test("AI 作图：上传槽来源浮层可展开/关闭（排版修复）", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");
  const slot = el.querySelector(".upload-slot");
  assert.ok(slot.querySelector(".slot-src [data-local-up]"), "浮层含本地上传");
  assert.ok(slot.querySelector(".slot-src [data-asset-pick]"), "浮层含我的资产");
  slot.click();
  assert.ok(slot.classList.contains("open"), "点击上传槽展开来源浮层");
  const other = el.querySelector(".comp-text");
  other.click();
  assert.ok(!slot.classList.contains("open"), "点击别处关闭来源浮层");
});

test("成套一致性：resolveRefs 解析公网 URL + imageSet 锚图传递", async () => {
  const { EC } = boot();
  assert.equal(typeof EC.gen.resolveRefs, "function", "resolveRefs 编排原语");
  assert.equal(typeof EC.gen.imageSet, "function", "imageSet 编排原语");

  EC.store.publicUrl = async (a) => "https://cdn.test/" + a.id + ".png";
  const refs = await EC.gen.resolveRefs([{ id: "a" }, { id: "b" }]);
  assert.deepEqual(refs, ["https://cdn.test/a.png", "https://cdn.test/b.png"], "本地资产解析为公网 URL");
  assert.deepEqual(await EC.gen.resolveRefs(["https://x.test/z.png", "", null]), ["https://x.test/z.png"], "字符串直通、空值跳过");

  const calls = [];
  EC.gen.image = async (o) => { calls.push(o); return { url: "https://img.test/" + calls.length + ".png", provider: "stub" }; };
  const prog = [];
  const out = await EC.gen.imageSet({ prompt: "P", ratio: "1:1", refImages: refs, count: 3, onProgress: (i, t) => prog.push(i + "/" + t) });
  assert.equal(calls.length, 3, "按张数生成 3 张");
  assert.deepEqual(calls[0].refImages, refs, "首图仅用参考图");
  assert.deepEqual(calls[1].refImages, refs.concat(["https://img.test/1.png"]), "第二张追加首图锚图");
  assert.deepEqual(calls[2].refImages, refs.concat(["https://img.test/1.png"]), "第三张沿用锚图锁定一致");
  assert.deepEqual(out.map(x => x.index), [0, 1, 2], "返回逐张索引");
  assert.deepEqual(prog, ["1/3", "2/3", "3/3"], "进度回调");
});

test("AI 详情图：生成携带商品参考图与锚图", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDetail");
  const el = doc.getElementById("ecomDetailView");
  el.__gd.slots.main = [{ id: "m1" }];
  el.querySelector('[data-sel="count"] .sel-val').textContent = "3 张";

  const resolved = [];
  EC.gen.resolveRefs = async (arr) => { resolved.push(arr); return ["https://cdn.test/m1.png"]; };
  const sets = [];
  EC.gen.imageSet = async (o) => { sets.push(o); return [{ index: 0, url: "https://img.test/" + sets.length + ".png", provider: "stub", prompt: o.prompt }]; };

  el.querySelector("[data-gen]").disabled = false;
  el.querySelector("[data-gen]").click();
  await new Promise(r => setTimeout(r, 60));
  assert.equal(resolved.length, 1, "生成前解析上传的商品参考图");
  assert.ok(sets.length >= 2, "多张详情图逐张生成");
  assert.deepEqual(sets[0].refImages, ["https://cdn.test/m1.png"], "首张带商品参考图");
  assert.equal(sets[1].anchor, "https://img.test/1.png", "后续张带首图锚图");
  assert.match(String(sets[0].prompt), /保持商品/, "提示词含一致性约束");
});

test("AI 作图：主图套图按张数成套生成（参考图 + 锚图）", async () => {
  const { doc, EC } = boot();
  await EC.render("ecomDraw");
  const el = doc.getElementById("ecomDrawView");
  el.querySelector('.tool-card[data-tool="main"]').click();
  el.__draw.files = [{ id: "p1" }];

  EC.gen.resolveRefs = async () => ["https://cdn.test/p1.png"];
  const sets = [];
  EC.gen.imageSet = async (o) => { sets.push(o); return [{ index: 0, url: "https://img.test/1.png", provider: "stub", prompt: typeof o.prompt === "function" ? o.prompt(0) : o.prompt }]; };

  el.querySelector(".send-arrow").click();
  await new Promise(r => setTimeout(r, 60));
  assert.equal(sets.length, 1, "调用一次成套生成");
  assert.equal(sets[0].count, 5, "默认 5 张成套");
  assert.deepEqual(sets[0].refImages, ["https://cdn.test/p1.png"], "带商品参考图");
  assert.equal(typeof sets[0].prompt, "function", "逐张提示词工厂");
  assert.match(sets[0].prompt(0), /第 1\/5 张/, "提示词含张序");
  assert.notEqual(sets[0].prompt(0), sets[0].prompt(2), "逐张更换构图");
});

test("风格复刻：成套生成走 imageSet（参考图 + 锚图）", () => {
  const s = src("ecom-style.js");
  assert.match(s, /EC\.gen\.imageSet\(/, "风格复刻使用成套生成原语");
  assert.match(s, /onProgress: function \(\) \{ done\+\+;/, "进度按张累计");
});

