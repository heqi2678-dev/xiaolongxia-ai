/* 电商工作台 · 工作台 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  /* hero 商品缩略图卡片拼贴（真实商品图） */
  const HERO_COLLAGE = [
    { img: "pot.jpg", name: "珐琅锅", tag: "主图生成" },
    { img: "lipstick.jpg", name: "丝绒口红", tag: "详情图" },
    { img: "detergent.jpg", name: "浓缩洗衣液", tag: "带货视频" },
    { img: "dress.jpg", name: "连衣裙", tag: "场景图" }
  ];
  function heroArt() {
    return '<div class="hero-collage">'
      + HERO_COLLAGE.map(function (c) {
        return '<div class="hc-card"><div class="hc-thumb"><img src="assets/ecom/' + c.img + '" alt="" loading="lazy"></div>'
          + '<div class="hc-cap"><b>' + esc(c.name) + '</b><i>' + esc(c.tag) + '</i></div></div>';
      }).join("")
      + '<span class="hc-badge"><svg class="ic sm"><use href="#i-spark"/></svg>AI 一键生成</span>'
      + '</div>';
  }

  const ICON_DRAW = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="3" y="4" width="18" height="16" rx="3"/><path class="t1" d="M6 17.4l3.7-4.4a1 1 0 0 1 1.5 0l2.1 2.5 1.6-1.8a1 1 0 0 1 1.5 0l1.6 1.8v.3a1.3 1.3 0 0 1-1.3 1.3H7.3A1.3 1.3 0 0 1 6 17.4z"/><circle class="t1" cx="8.5" cy="9" r="1.7"/></svg>`;
  const ICON_VIDEO = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="3" y="5" width="18" height="14" rx="3"/><path class="t1" d="M10.4 9.1v5.8a.7.7 0 0 0 1.06.6l4.5-2.9a.7.7 0 0 0 0-1.2l-4.5-2.9a.7.7 0 0 0-1.06.6z"/></svg>`;
  const ICON_DETAIL = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="5" y="3" width="14" height="18" rx="2.6"/><rect class="t1" x="8" y="7" width="8" height="1.9" rx=".95"/><rect class="t1" x="8" y="11" width="8" height="1.9" rx=".95"/><rect class="t1" x="8" y="15" width="5" height="1.9" rx=".95"/></svg>`;
  const ICON_LOCAL = `<svg class="fi-art" viewBox="0 0 24 24"><circle class="t2" cx="12" cy="12" r="9"/><path class="t1" d="M12 3.2c2.6 2.3 4 5.4 4 8.8s-1.4 6.5-4 8.8c-2.6-2.3-4-5.4-4-8.8s1.4-6.5 4-8.8z"/><rect class="t1" x="3.2" y="11" width="17.6" height="2" rx="1"/></svg>`;
  const ICON_STYLE = `<svg class="fi-art" viewBox="0 0 24 24"><path class="t2" d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.3-.5-.7-.5-1.2 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"/><circle class="t1" cx="7.8" cy="11.5" r="1"/><circle class="t1" cx="10" cy="7.8" r="1"/><circle class="t1" cx="14.5" cy="7.8" r="1"/></svg>`;
  const ICON_I2V = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="3" y="4" width="11" height="16" rx="2.6"/><circle class="t1" cx="8.5" cy="9" r="1.7"/><path class="t1" d="M5 17l2.8-3.2a1 1 0 0 1 1.5 0L11 16v1.2a.8.8 0 0 1-.8.8H5z"/><path class="t1" d="M17 8.5v7l5-3.5z"/></svg>`;
  const ICON_COPY = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="3" y="6" width="12" height="12" rx="2.4"/><path class="t1" d="M7.5 11v3l3-1.5z"/><rect class="t1" x="9" y="3" width="12" height="12" rx="2.4" fill="none"/></svg>`;
  const ICON_TRANS = `<svg class="fi-art" viewBox="0 0 24 24"><circle class="t2" cx="12" cy="12" r="9"/><path class="t1" d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>`;
  const ICON_TOOLBOX = `<svg class="fi-art" viewBox="0 0 24 24"><path class="t2" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path class="t1" d="M19 14l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>`;

  const ARROW = `<svg class="fi-arrow" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 32C16 32 30 26 33 12" stroke="#b7c8e8" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4"/><path d="M28 10l7 1-3 7" stroke="#b7c8e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function scene(img) {
    return '<div class="fi-scene has-photo">' +
      '<div class="fi-photo"><img src="' + img + '" alt="" loading="lazy"></div>' +
      ARROW +
      '<div class="fi-thumb"><img src="' + img + '" alt="" loading="lazy"><em>产品图</em></div>' +
      '</div>';
  }

  /* AI 作图快捷模式：与 AI 作图页 12 模式同键 */
  const SHORTCUTS = [
    { key: "agent", name: "Agent模式", icon: "spark" },
    { key: "main", name: "主图套图", icon: "grid" },
    { key: "white", name: "精修白底图", icon: "crop" },
    { key: "try", name: "AI试衣", icon: "layers" },
    { key: "wear", name: "万物穿戴", icon: "layers" },
    { key: "swap", name: "商品替换", icon: "grid" },
    { key: "trans", name: "图片翻译", icon: "translate" },
    { key: "wm", name: "去除水印", icon: "wand" },
    { key: "pose", name: "姿势裂变", icon: "spark" },
    { key: "recolor", name: "商品换色", icon: "palette" },
    { key: "retouch", name: "商品精修", icon: "wand" },
    { key: "poster", name: "海报设计", icon: "poster" }
  ];

  /* 首页产品横向入口（hero 下方） */
  const HERO_NAV = [
    { label: "AI 作图", go: "ecomDraw", icon: "wand" },
    { label: "AI 详情图", go: "ecomDetail", icon: "poster" },
    { label: "风格复刻", go: "ecomStyle", icon: "palette" },
    { label: "图生视频", go: "ecomVideoI2V", icon: "video" },
    { label: "视频复刻", go: "ecomVideoCopy", icon: "film" },
    { label: "视频翻译", go: "ecomVideoTranslate", icon: "globe" },
    { label: "AI 工具箱", go: "ecomToolbox", icon: "spark" },
    { label: "资产", go: "ecomGallery", icon: "grid" }
  ];

  /* 能力介绍 */
  const CAPS = [
    { title: "AI 作图", go: "ecomDraw", icon: "wand", desc: "支持 AI 自由创作生图，覆盖多款电商核心作图场景，无需复杂操作即可生成适配各环节的优质图片。", points: ["18 种作图场景模式", "Agent 模式批量生成", "一键生成高转化商品图"] },
    { title: "AI 详情图", go: "ecomDetail", icon: "poster", desc: "输入核心卖点，AI 自动完成从视觉设计、文案编写到长图排版的全过程。", points: ["智能规划详情模块", "智能卖点提炼与方案", "适配天猫 / 京东 / 亚马逊"] },
    { title: "风格复刻", go: "ecomStyle", icon: "palette", desc: "上传参考设计图，系统智能解析排版布局与配色方案，精准复刻风格到你的产品。", points: ["一键复刻爆款风格", "保持品牌调性统一", "灵活适配多品类场景"] },
    { title: "AI 视频", go: "ecomVideoHome", icon: "play", desc: "输入文字指令并上传参考图，无需剪辑技巧即可快速生成电商爆款短视频。", points: ["AI 智能帮写脚本", "一键生成讲解 / 带货视频", "多语言配音与字幕"] }
  ];

  /* 为什么选择 */
  const WHY = [
    { t: "智能高效，降本增效", d: "无需高昂的模特与摄影费，单人即可完成全店视觉焕新。" },
    { t: "适配全品类", d: "服装、饰品、数码、家居均可精准适配，满足主图与详情页多元需求。" },
    { t: "先体验，后付费", d: "可先免费试用核心功能，亲身体验效果后再决定是否付费。" },
    { t: "自建大模型", d: "专为电商场景打造，深度理解商品、视觉与用户需求。" }
  ];

  /* 赋能角色 */
  const ROLES = [
    { t: "电商 / 跨境商家", d: "单人完成全店视觉焕新，快速响应平台大促与趋势。" },
    { t: "电商 / 新媒体运营", d: "批量产出高点击图，高效铺设各平台内容。" },
    { t: "电商设计师", d: "从重复排版中解放，专注策略与品牌调性定义。" },
    { t: "电商周边服务从业者", d: "海量生成 A/B 素材，用 AI 寻找最优转化方案。" }
  ];

  /* 覆盖平台 */
  const PLATFORMS = ["淘宝", "天猫", "1688", "拼多多", "京东", "抖音", "亚马逊", "TEMU", "eBay", "SHEIN", "Shopee", "Lazada", "TikTok", "Ozon"];

  const HTML = `<div class="inner">
          <div class="page-head hero">
            <div class="hero-copy">
              <div class="hero-eyebrow">铜龙电商ai助手 · 领先的电商 AI 生成技术</div>
              <h1 data-greeting>你好</h1>
              <p class="hero-tag">一站式电商 AI 内容创作平台</p>
              <p>上传商品图，轻松生成高质量商品图、详情页与爆款视频，提升转化率与效率。</p>
              <div class="hero-cta">
                <button class="btn btn-primary" data-go="ecomDraw" style="width:auto;padding:10px 20px"><svg class="ic sm"><use href="#i-wand"/></svg>开始创作</button>
                <button class="btn btn-ghost" data-go="ecomGallery" style="width:auto;padding:10px 20px"><svg class="ic sm"><use href="#i-lib"/></svg>我的作品</button>
              </div>
              <div class="hero-points">
                <span><svg class="ic sm"><use href="#i-spark"/></svg>18 种作图场景</span>
                <span><svg class="ic sm"><use href="#i-poster"/></svg>一键生成详情页</span>
                <span><svg class="ic sm"><use href="#i-video"/></svg>多语言配音字幕</span>
              </div>
            </div>
            <div class="hero-art">${heroArt()}</div>
          </div>

          <div class="hero-nav">
            ${HERO_NAV.map(function (h) {
              return '<button class="hero-nav-item" data-go="' + h.go + '"><svg class="ic sm"><use href="#i-' + h.icon + '"/></svg><span>' + esc(h.label) + '</span></button>';
            }).join("")}
          </div>

          <div class="mode-strip">
            <div class="mode-strip-head"><h2>AI 作图 · 快捷模式</h2><a data-go="ecomDraw">全部模式</a></div>
            <div class="mode-strip-grid">
              ${SHORTCUTS.map(function (s) {
                return '<button class="mode-card" data-draw-mode="' + s.key + '" data-go="ecomDraw"><svg class="ic sm"><use href="#i-' + s.icon + '"/></svg><span>' + esc(s.name) + '</span></button>';
              }).join("")}
            </div>
          </div>

          <div class="feature-grid">
            <div class="feature" data-go="ecomDraw">
              ${scene("assets/ecom/pot.jpg")}
              <div class="feat-head"><div class="fi a">${ICON_DRAW}</div><h3>AI 作图</h3></div>
              <p>上传商品图，一键生成多平台主图与场景图</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomVideoHome">
              ${scene("assets/ecom/dress.jpg")}
              <div class="feat-head"><div class="fi b">${ICON_VIDEO}</div><h3>AI 生成视频</h3></div>
              <p>图生视频，自动加字幕与配音，适配短视频</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomStyle">
              ${scene("assets/ecom/pot.jpg")}
              <div class="feat-head"><div class="fi a">${ICON_STYLE}</div><h3>风格复刻</h3></div>
              <p>参考设计图定风格，批量套用到你的产品图</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomVideoI2V">
              ${scene("assets/ecom/dress.jpg")}
              <div class="feat-head"><div class="fi b">${ICON_I2V}</div><h3>图生视频</h3></div>
              <p>参考图 + AI 脚本，生成商品讲解视频</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomVideoCopy">
              ${scene("assets/ecom/detergent.jpg")}
              <div class="feat-head"><div class="fi c">${ICON_COPY}</div><h3>视频复刻</h3></div>
              <p>上传爆款参考视频，生成同款带货视频</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomVideoTranslate">
              ${scene("assets/ecom/toothbrush.jpg")}
              <div class="feat-head"><div class="fi d">${ICON_TRANS}</div><h3>视频翻译</h3></div>
              <p>语音 / 字幕 / 画面文字多语言出海</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomToolbox">
              ${scene("assets/ecom/pot.jpg")}
              <div class="feat-head"><div class="fi a">${ICON_TOOLBOX}</div><h3>AI 工具箱</h3></div>
              <p>16 项图片编辑，本地即改即存 + AI 生成</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomDetailEdit">
              ${scene("assets/ecom/detergent.jpg")}
              <div class="feat-head"><div class="fi c">${ICON_DETAIL}</div><h3>详情页编辑</h3></div>
              <p>模块库自由排版，长图整页导出</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomDetail">
              ${scene("assets/ecom/detergent.jpg")}
              <div class="feat-head"><div class="fi c">${ICON_DETAIL}</div><h3>AI 详情页</h3></div>
              <p>卖点文案 + 模块排版，一键生成整页详情</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomLocalize">
              ${scene("assets/ecom/toothbrush.jpg")}
              <div class="feat-head"><div class="fi d">${ICON_LOCAL}</div><h3>跨境本地化</h3></div>
              <p>多语言、多种族模特，素材一键出海</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
          </div>

          <div class="stat-row">
            <div class="stat"><span>本月生成</span><b data-stat="generated">0</b><div class="trend">本地累计</div></div>
            <div class="stat"><span>导出素材</span><b data-stat="exported">0</b><div class="trend">本地累计</div></div>
            <div class="stat"><span>Token 消耗</span><b data-stat="tokens">0</b><div class="trend">累计消耗</div></div>
            <div class="stat"><span>累计项目</span><b data-stat="projects">0</b><div class="trend">作品库素材</div></div>
          </div>

          <div class="sec-title"><h2>最近项目</h2><a data-go="ecomGallery">查看全部</a></div>
          <div class="proj-grid">
            <div class="proj-empty">还没有项目。从上方任选一个入口，开始你的第一个电商创作。</div>
          </div>

          <div class="cap-sec">
            <div class="sec-title"><h2>核心能力</h2><span class="sec-sub">从单图到成套素材，一站完成</span></div>
            ${CAPS.map(function (c, i) {
              return '<div class="cap-block' + (i % 2 ? " rev" : "") + '">'
                + '<div class="cap-copy"><div class="cap-idx">0' + (i + 1) + '</div>'
                + '<h3>' + esc(c.title) + '</h3><p>' + esc(c.desc) + '</p>'
                + '<ul>' + c.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join("") + '</ul>'
                + '<button class="btn btn-primary" data-go="' + c.go + '" style="width:auto;padding:9px 18px">立即体验<svg class="ic sm"><use href="#i-arrow"/></svg></button></div>'
                + '<div class="cap-art"><svg class="ic lg"><use href="#i-' + c.icon + '"/></svg></div>'
                + '</div>';
            }).join("")}
          </div>

          <div class="why-sec">
            <div class="sec-title"><h2>为什么选择铜龙电商ai助手</h2></div>
            <div class="why-grid">
              ${WHY.map(function (w) { return '<div class="why-card"><b>' + esc(w.t) + '</b><p>' + esc(w.d) + '</p></div>'; }).join("")}
            </div>
          </div>

          <div class="role-sec">
            <div class="sec-title"><h2>赋能不同角色</h2></div>
            <div class="role-grid">
              ${ROLES.map(function (r) { return '<div class="role-card"><b>' + esc(r.t) + '</b><p>' + esc(r.d) + '</p></div>'; }).join("")}
            </div>
          </div>

          <div class="plat-sec">
            <div class="plat-head"><h2>支持多语言，覆盖全平台</h2><p>一套素材，适配主流电商平台规范。</p></div>
            <div class="plat-chips">
              ${PLATFORMS.map(function (p) { return '<span class="plat-chip">' + esc(p) + '</span>'; }).join("")}
            </div>
          </div>

          <div class="cta-sec">
            <div><h2>立即体验 AI 创作，解锁电商高效新方式</h2><p>新用户即享免费生成额度，开启你的 AI 视觉升级。</p></div>
            <button class="btn btn-primary" data-go="ecomDraw" style="width:auto;padding:12px 26px">免费体验<svg class="ic sm"><use href="#i-arrow"/></svg></button>
          </div>
        </div>`;

  function fmtNum(n) {
    const v = Number(n) || 0;
    try { return v.toLocaleString("en-US"); } catch (e) { return String(v); }
  }
  function greet() {
    const h = new Date().getHours();
    if (h < 5) return "凌晨好";
    if (h < 9) return "早上好";
    if (h < 12) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }
  function ago(ts) {
    if (!ts) return "";
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return "刚刚";
    if (d < 3600) return Math.floor(d / 60) + " 分钟前";
    if (d < 86400) return Math.floor(d / 3600) + " 小时前";
    return Math.floor(d / 86400) + " 天前";
  }

  function projCard(a) {
    const src = EC.store ? EC.store.src(a) : (a.url || "");
    const img = src ? '<img src="' + esc(src) + '" alt="">' : '<svg class="ic sm"><use href="#i-image"/></svg>';
    const kindMap = { image: "AI 作图", detail: "详情页", localize: "本地化素材", upload: "本地上传", edit: "主图编辑" };
    return '<div class="project" data-id="' + esc(a.id) + '">'
      + '<div class="proj-thumb">' + img + '</div>'
      + '<div class="proj-meta"><b>' + esc(a.name || "未命名作品") + '</b>'
      + '<span>' + esc(kindMap[a.kind] || "素材") + ' · ' + esc(ago(a.createdAt)) + '</span></div></div>';
  }

  function hydrate(el) {
    const s = (EC.stats ? EC.stats() : {}) || {};
    ["generated", "exported", "tokens"].forEach(function (k) {
      const node = el.querySelector('[data-stat="' + k + '"]');
      if (node) node.textContent = fmtNum(s[k]);
    });
    if (!EC.store) return;
    EC.store.list().then(function (items) {
      const grid = el.querySelector(".proj-grid");
      if (!grid) return;
      if (!items.length) return;
      grid.innerHTML = items.slice(0, 6).map(projCard).join("");
      const pnode = el.querySelector('[data-stat="projects"]');
      if (pnode) pnode.textContent = fmtNum(items.length);
    }).catch(function () {});
  }

  EC.register("ecomHome", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    const gnode = el.querySelector("[data-greeting]");
    if (gnode) gnode.textContent = greet();
    const s = (EC.stats ? EC.stats() : {}) || {};
    ["generated", "exported", "tokens", "projects"].forEach(function (k) {
      const node = el.querySelector('[data-stat="' + k + '"]');
      if (node) node.textContent = fmtNum(s[k]);
    });
    hydrate(el);
    if (el.__ecomHomeBound) return;
    el.__ecomHomeBound = true;
    el.addEventListener("click", function (e) {
      const dmEl = e.target.closest("[data-draw-mode]");
      if (dmEl && el.contains(dmEl)) { EC.openDraw(dmEl.getAttribute("data-draw-mode")); return; }
      const goEl = e.target.closest("[data-go]");
      if (goEl && el.contains(goEl)) { EC.go(goEl.getAttribute("data-go")); return; }
      const proj = e.target.closest(".project");
      if (proj && EC.go) EC.go("ecomGallery");
    });
  });
})();
