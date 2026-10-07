/* 电商工作台 · 工作台 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const HERO_ART = `<svg viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="160" cy="160" rx="118" ry="13" fill="#e3edff"/>
          <rect x="66" y="26" width="152" height="122" rx="14" fill="#fff" stroke="#cdddfb"/>
          <rect x="66" y="26" width="152" height="34" rx="14" fill="#f2f6ff"/>
          <rect x="66" y="44" width="152" height="16" fill="#f2f6ff"/>
          <circle cx="82" cy="40" r="3" fill="#c7d9f7"/>
          <circle cx="93" cy="40" r="3" fill="#d7e4f8"/>
          <circle cx="104" cy="40" r="3" fill="#e2ebf8"/>
          <rect x="80" y="68" width="62" height="42" rx="9" fill="#dbe7ff"/>
          <circle cx="111" cy="89" r="13" fill="#1c64f4"/>
          <rect x="150" y="68" width="54" height="42" rx="9" fill="#e6efff"/>
          <circle cx="177" cy="89" r="13" fill="#3eb0ff"/>
          <rect x="80" y="120" width="124" height="7" rx="3.5" fill="#dbe7ff"/>
          <rect x="80" y="133" width="88" height="7" rx="3.5" fill="#e9f1fd"/>
          <rect x="232" y="50" width="54" height="92" rx="13" fill="#fff" stroke="#cdddfb"/>
          <rect x="240" y="62" width="38" height="56" rx="8" fill="#eaf1ff"/>
          <circle cx="259" cy="90" r="13" fill="#1c64f4"/>
          <rect x="249" y="128" width="20" height="5" rx="2.5" fill="#dbe7ff"/>
          <path d="M48 44l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#3eb0ff"/>
          <path d="M284 140l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#6d8bff"/>
          <circle cx="44" cy="122" r="5" fill="#cfe0ff"/>
          <circle cx="292" cy="34" r="6" fill="#dbe7ff"/>
          <circle cx="288" cy="112" r="4" fill="#e3edff"/>
        </svg>`;

  const ICON_DRAW = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="3" y="4" width="18" height="16" rx="3"/><path class="t1" d="M6 17.4l3.7-4.4a1 1 0 0 1 1.5 0l2.1 2.5 1.6-1.8a1 1 0 0 1 1.5 0l1.6 1.8v.3a1.3 1.3 0 0 1-1.3 1.3H7.3A1.3 1.3 0 0 1 6 17.4z"/><circle class="t1" cx="8.5" cy="9" r="1.7"/></svg>`;
  const ICON_VIDEO = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="3" y="5" width="18" height="14" rx="3"/><path class="t1" d="M10.4 9.1v5.8a.7.7 0 0 0 1.06.6l4.5-2.9a.7.7 0 0 0 0-1.2l-4.5-2.9a.7.7 0 0 0-1.06.6z"/></svg>`;
  const ICON_DETAIL = `<svg class="fi-art" viewBox="0 0 24 24"><rect class="t2" x="5" y="3" width="14" height="18" rx="2.6"/><rect class="t1" x="8" y="7" width="8" height="1.9" rx=".95"/><rect class="t1" x="8" y="11" width="8" height="1.9" rx=".95"/><rect class="t1" x="8" y="15" width="5" height="1.9" rx=".95"/></svg>`;
  const ICON_LOCAL = `<svg class="fi-art" viewBox="0 0 24 24"><circle class="t2" cx="12" cy="12" r="9"/><path class="t1" d="M12 3.2c2.6 2.3 4 5.4 4 8.8s-1.4 6.5-4 8.8c-2.6-2.3-4-5.4-4-8.8s1.4-6.5 4-8.8z"/><rect class="t1" x="3.2" y="11" width="17.6" height="2" rx="1"/></svg>`;

  const ARROW = `<svg class="fi-arrow" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 32C16 32 30 26 33 12" stroke="#b7c8e8" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4"/><path d="M28 10l7 1-3 7" stroke="#b7c8e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function scene(img) {
    return '<div class="fi-scene has-photo">' +
      '<div class="fi-photo"><img src="' + img + '" alt="" loading="lazy"></div>' +
      ARROW +
      '<div class="fi-thumb"><img src="' + img + '" alt="" loading="lazy"><em>产品图</em></div>' +
      '</div>';
  }

  const HTML = `<div class="inner">
          <div class="page-head hero">
            <div class="hero-copy">
              <div class="hero-eyebrow">铜龙电商 · 领先的电商 AI 生成技术</div>
              <h1>下午好，何齐</h1>
              <p>上传商品图，轻松生成高质量商品图、详情页与爆款视频，提升转化率与效率。</p>
            </div>
            <div class="hero-art">${HERO_ART}</div>
          </div>

          <div class="feature-grid">
            <div class="feature" data-go="ecomDraw">
              ${scene("assets/ecom/pot.jpg")}
              <div class="feat-head"><div class="fi a">${ICON_DRAW}</div><h3>AI 作图</h3></div>
              <p>上传商品图，一键生成多平台主图与场景图</p>
              <div class="go">立即创作 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            </div>
            <div class="feature" data-go="ecomDraw">
              ${scene("assets/ecom/dress.jpg")}
              <div class="feat-head"><div class="fi b">${ICON_VIDEO}</div><h3>AI 生成视频</h3></div>
              <p>图生视频，自动加字幕与配音，适配短视频</p>
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
            <div class="stat"><span>本月生成</span><b data-stat="generated">0</b><div class="trend">较上月 0%</div></div>
            <div class="stat"><span>导出素材</span><b data-stat="exported">0</b><div class="trend">较上月 0%</div></div>
            <div class="stat"><span>Token 消耗</span><b data-stat="tokens">0</b><div class="trend">累计消耗</div></div>
            <div class="stat"><span>累计项目</span><b data-stat="projects">0</b><div class="trend">本周新增 0</div></div>
          </div>

          <div class="sec-title"><h2>最近项目</h2><a>查看全部</a></div>
          <div class="proj-grid">
            <div class="proj-empty">还没有项目。从上方任选一个入口，开始你的第一个电商创作。</div>
          </div>
        </div>`;

  function fmtNum(n) {
    const v = Number(n) || 0;
    try { return v.toLocaleString("en-US"); } catch (e) { return String(v); }
  }

  EC.register("ecomHome", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    const s = (EC.stats ? EC.stats() : {}) || {};
    ["generated", "exported", "tokens", "projects"].forEach(function (k) {
      const node = el.querySelector('[data-stat="' + k + '"]');
      if (node) node.textContent = fmtNum(s[k]);
    });
  });
})();
