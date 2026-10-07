/* 电商工作台 · 作品库 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const ITEMS = [
    { f: "pot.jpg", h: "h3", t: "主图 · 白底" },
    { f: "dress.jpg", h: "h1", t: "AI 试衣" },
    { f: "detergent.jpg", h: "h2", t: "详情页" },
    { f: "lipstick.jpg", h: "h3", t: "主图换色" },
    { f: "shoes.jpg", h: "h2", t: "场景合成" },
    { f: "skincare.jpg", h: "h4", t: "精修白底" },
    { f: "toothbrush.jpg", h: "h1", t: "海报设计" },
    { f: "dress.jpg", h: "h4", t: "本地化素材" }
  ];
  const HTML_ITEMS = ITEMS.map(function (it) {
    return '<div class="g-item"><div class="ph ' + it.h + '"><img src="assets/ecom/' + it.f + '" alt=""></div>' +
      '<div class="g-overlay"><span class="tag">' + it.t + '</span><div class="acts">' +
      '<button><svg class="ic sm"><use href="#i-download"/></svg></button>' +
      '<button><svg class="ic sm"><use href="#i-layers"/></svg></button></div></div></div>';
  }).join("");

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>作品库</h1>
            <p>所有生成与导出的素材，一处管理、随时复用。</p>
          </div>

          <div class="filterbar">
            <div class="chips">
              <div class="chip on">全部</div>
              <div class="chip">图片</div>
              <div class="chip">视频</div>
              <div class="chip">详情页</div>
            </div>
            <div class="search" style="width:220px;margin-left:auto">
              <svg class="ic"><use href="#i-search"/></svg><input placeholder="搜索素材">
            </div>
            <div class="select" style="width:130px">最近更新 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
          </div>

          <div class="grid-masonry">${HTML_ITEMS}</div>
        </div>`;

  EC.register("ecomGallery", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
  });
})();
