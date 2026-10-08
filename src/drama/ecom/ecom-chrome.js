/* 电商工作台 · 展示层（顶部工具条 + 页脚 + 说明弹层）
 * 单一来源：工具条与页脚仅挂载到电商首页（ecomHome）；其余功能页保持纯工具形态。
 * 由 ecom.js 的 render() 在视图渲染后调用 mount()。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC || EC.chrome) return;
  const esc = EC.esc;

  /* 页脚产品入口（与电商导航同键，点击跳转） */
  const FOOT_PRODUCTS = [
    { label: "AI 作图", go: "ecomDraw" },
    { label: "AI 详情图", go: "ecomDetail" },
    { label: "风格复刻", go: "ecomStyle" },
    { label: "图生视频", go: "ecomVideoI2V" },
    { label: "视频复刻", go: "ecomVideoCopy" },
    { label: "视频翻译", go: "ecomVideoTranslate" },
    { label: "AI 工具箱", go: "ecomToolbox" },
    { label: "主图编辑", go: "ecomMainEdit" },
    { label: "详情页编辑", go: "ecomDetailEdit" },
    { label: "跨境本地化", go: "ecomLocalize" },
    { label: "作品库", go: "ecomGallery" }
  ];

  const TOP_LINKS = [
    { key: "member", label: "会员套餐" },
    { key: "usage", label: "积分扣减明细" },
    { key: "tutorial", label: "教程" },
    { key: "faq", label: "FAQ" },
    { key: "plugin", label: "插件", badge: "NEW" }
  ];

  function topbar() {
    return '<div class="pp-topbar">'
      + '<div class="pp-brand">'
      +   '<span class="pp-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 14l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg></span>'
      +   '<span class="pp-brand-t"><b>铜龙电商ai助手</b><i>电商 AI 创作平台</i></span>'
      + '</div>'
      + '<div class="pp-links">'
      +   TOP_LINKS.map(function (l) {
        return '<button class="pp-link" data-pp="' + l.key + '">' + esc(l.label)
          + (l.badge ? '<em class="pp-new">' + esc(l.badge) + '</em>' : '') + '</button>';
      }).join("")
      +   '<button class="pp-link" data-pp="support">客服</button>'
      + '</div>'
      + '<div class="pp-top-right">'
      +   '<button class="pp-btn ghost pp-notice-btn" data-pp="notice"><svg class="ic sm" viewBox="0 0 24 24"><use href="#i-bell"/></svg>提示<i class="pp-dot"></i></button>'
      +   '<button class="pp-btn ghost" data-pp="fav"><svg class="ic sm" viewBox="0 0 24 24"><use href="#i-lib"/></svg>收藏本页</button>'
      +   '<button class="pp-btn primary" data-pp="member">开通会员</button>'
      + '</div>'
      + '</div>';
  }

  function footer() {
    return '<footer class="pp-foot">'
      + '<div class="pp-foot-main">'
      +   '<div class="pp-foot-brand">'
      +     '<div class="pp-foot-logo"><span class="pp-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg></span><b>铜龙电商ai助手</b></div>'
      +     '<p>致力于通过前沿 AI 技术，为电商卖家提供高质量、高效率的视觉内容生产服务，轻松生成商品图、详情页与爆款视频。</p>'
      +   '</div>'
      +   '<div class="pp-foot-col"><h4>产品能力</h4><ul>'
      +     FOOT_PRODUCTS.map(function (p) { return '<li><a data-pp-go="' + p.go + '">' + esc(p.label) + '</a></li>'; }).join("")
      +   '</ul></div>'
      +   '<div class="pp-foot-col"><h4>关于与支持</h4><ul>'
      +     '<li><a data-pp="tutorial">使用教程</a></li>'
      +     '<li><a data-pp="faq">常见问题</a></li>'
      +     '<li><a data-pp="usage">积分明细</a></li>'
      +     '<li><a data-pp="support">联系我们</a></li>'
      +   '</ul></div>'
      +   '<div class="pp-foot-col"><h4>联系我们</h4><ul class="pp-foot-contact">'
      +     '<li>微信客服：铜龙电商ai助手</li>'
      +     '<li>客服邮箱：support@tonglong.ai</li>'
      +     '<li>工作时间：周一至周五 9:00-18:00</li>'
      +   '</ul></div>'
      + '</div>'
      + '<div class="pp-foot-bottom"><span>铜龙电商ai助手 © 2026 版权所有</span><span>本页面由 AI 生成内容，请注意甄别</span></div>'
      + '</footer>';
  }

  function usageBody() {
    const s = (EC.stats ? EC.stats() : {}) || {};
    function n(v) { const x = Number(v) || 0; try { return x.toLocaleString("en-US"); } catch (e) { return String(x); } }
    const rows = [
      { k: "本月生成", v: s.generated, d: "本地累计" },
      { k: "导出素材", v: s.exported, d: "本地累计" },
      { k: "Token 消耗", v: s.tokens, d: "累计消耗" },
      { k: "累计项目", v: s.projects, d: "作品库素材" }
    ];
    return '<div class="pp-usage">'
      + rows.map(function (r) {
        return '<div class="pp-usage-row"><span>' + esc(r.k) + '</span><b>' + n(r.v) + '</b><i>' + esc(r.d) + '</i></div>';
      }).join("")
      + '<p class="pp-note">数据统计自本机浏览器，仅用于预览；正式额度以账号为准。</p></div>';
  }

  const TUTORIAL = [
    ["上传商品图", "进入「AI 作图 / AI 详情图」，上传清晰的产品图。"],
    ["设定风格与比例", "选择目标平台、比例与清晰度，填写大白话需求。"],
    ["一键生成", "点击「生成」，AI 自动完成构图、文案与排版。"],
    ["保存与导出", "作品自动进入「作品库」，可批量下载或继续编辑。"]
  ];
  function tutorialBody() {
    return '<ol class="pp-steps">' + TUTORIAL.map(function (t) {
      return '<li><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></li>';
    }).join("") + '</ol>';
  }

  const FAQ = [
    ["生成的图片版权归谁？", "生成内容归您所有，可商用；请确保上传素材拥有合法授权。"],
    ["支持哪些电商平台？", "覆盖淘宝、天猫、京东、拼多多、抖音、亚马逊、TEMU、SHEIN 等主流平台规范。"],
    ["视频翻译支持哪些语言？", "支持十八种语言，含中英日韩及多国小语种，自动匹配配音与字幕。"],
    ["额度如何计算？", "按生成次数与清晰度扣减，明细可在「积分扣减明细」查看。"]
  ];
  function faqBody() {
    return '<div class="pp-faq">' + FAQ.map(function (q) {
      return '<div class="pp-faq-item"><b>' + esc(q[0]) + '</b><p>' + esc(q[1]) + '</p></div>';
    }).join("") + '</div>';
  }

  function supportBody() {
    return '<div class="pp-faq">'
      + '<div class="pp-faq-item"><b>微信客服</b><p>搜索「铜龙电商ai助手」，工作日 9:00-18:00 在线。</p></div>'
      + '<div class="pp-faq-item"><b>客服邮箱</b><p>support@tonglong.ai，24 小时内回复。</p></div>'
      + '<div class="pp-faq-item"><b>问题反馈</b><p>遇到生成异常，请附上作品 ID 与截图，便于快速定位。</p></div>'
      + '</div>';
  }

  const NOTICES = [
    ["新功能上线", "视频翻译支持 5 款预设字幕样式，可在「字幕样式」中直接选择。"],
    ["额度提醒", "本月免费生成额度充足，可放心创作。"],
    ["平台规范更新", "已同步淘宝 / 天猫 / 亚马逊最新主图与详情图规范。"],
    ["作品库升级", "支持按类型与时间筛选，一键下载全部素材。"]
  ];
  function noticeBody() {
    return '<div class="pp-faq">' + NOTICES.map(function (q, i) {
      return '<div class="pp-faq-item"><b>' + esc(q[0]) + (i === 0 ? '<em class="pp-new">NEW</em>' : '') + '</b><p>' + esc(q[1]) + '</p></div>';
    }).join("") + '</div>';
  }

  function favBody() {
    return '<div class="pp-faq">'
      + '<div class="pp-faq-item"><b>方式一 · 快捷键收藏</b><p>按 Ctrl+D（Mac 为 ⌘+D）将本页加入书签，下次一键直达。</p></div>'
      + '<div class="pp-faq-item"><b>方式二 · 添加到桌面</b><p>在浏览器菜单中选择「安装应用 / 添加到主屏幕」，像 App 一样打开。</p></div>'
      + '</div>';
  }

  function openModal(title, body) {
    if (!EC.ui || !EC.ui.modal) { EC.toast(title); return; }
    EC.ui.modal({ title: title, body: body });
  }

  const ACTIONS = {
    usage: function () { openModal("积分扣减明细", usageBody()); },
    tutorial: function () { openModal("使用教程", tutorialBody()); },
    faq: function () { openModal("常见问题 FAQ", faqBody()); },
    support: function () { openModal("联系我们", supportBody()); },
    notice: function () { openModal("提示 · 通知", noticeBody()); },
    fav: function () { openModal("收藏铜龙电商ai助手", favBody()); },
    plugin: function () { EC.toast("插件即将上线，敬请期待", "warn"); },
    member: function () { EC.toast("当前为体验版，额度充足，会员套餐即将开放", "ok"); }
  };

  function onAction(key) { const fn = ACTIONS[key]; if (fn) fn(); }

  function mount(el, view) {
    if (!el || view !== "ecomHome") return;
    const ui = el.querySelector(".ecom-ui");
    if (!ui || ui.__ppMounted) return;
    ui.__ppMounted = true;
    ui.insertAdjacentHTML("afterbegin", topbar());
    ui.insertAdjacentHTML("beforeend", footer());
  }

  if (!window._ppChromeBound) {
    window._ppChromeBound = true;
    document.addEventListener("click", function (e) {
      const act = e.target.closest ? e.target.closest("[data-pp]") : null;
      if (act) { e.preventDefault(); onAction(act.getAttribute("data-pp")); return; }
      const go = e.target.closest ? e.target.closest("[data-pp-go]") : null;
      if (go) { e.preventDefault(); EC.go(go.getAttribute("data-pp-go")); return; }
    });
  }

  EC.chrome = { topbar: topbar, footer: footer, mount: mount, openModal: openModal, FOOT_PRODUCTS: FOOT_PRODUCTS };
})();
