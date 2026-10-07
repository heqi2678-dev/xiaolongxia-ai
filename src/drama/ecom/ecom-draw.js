/* 电商工作台 · AI 作图 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const WORKS = ["pot.jpg", "dress.jpg", "detergent.jpg", "skincare.jpg", "shoes.jpg", "lipstick.jpg", "toothbrush.jpg", "dress.jpg"];
  const GALLERY = WORKS.map(function (f) {
    return '<div class="draw-item"><img src="assets/ecom/' + f + '" alt="" loading="lazy"></div>';
  }).join("");

  const HTML = `<div class="inner">
          <div class="genai">
            <div class="genai-top">
              <button class="btn btn-ghost hist" style="padding:8px 14px;font-size:12.5px"><svg class="ic sm"><use href="#i-lib"/></svg>生成记录</button>
              <div class="genai-brand">
                <div class="brand-mark">铜龙</div>
                <div>铜龙AI · <span class="accent">一站式电商 AI 作图</span></div>
              </div>
            </div>

            <div class="tool-grid">
              <div class="tool-card on"><svg class="ic sm"><use href="#i-agent"/></svg>Agent 模式</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-grid-img"/></svg>主图套图</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-eraser"/></svg>精修白底图</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-shirt"/></svg>AI 试衣</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-hanger"/></svg>万物穿戴</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-swap"/></svg>商品替换</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-translate"/></svg>图片翻译</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-watermark-off"/></svg>去除水印</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-pose"/></svg>姿势裂变</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-palette"/></svg>商品换色</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-wand"/></svg>商品精修</div>
              <div class="tool-card"><svg class="ic sm"><use href="#i-poster"/></svg>海报设计</div>
            </div>

            <div class="prompt-box">
              <div class="prompt-main">
                <div class="upload-slot"><svg class="ic"><use href="#i-plus"/></svg>0/10</div>
                <textarea placeholder="描述你想要生成的图片，例如：将衣服、裤子、鞋子搭配穿在模特身上，生成自然的试衣效果"></textarea>
              </div>
              <div class="prompt-bar">
                <div class="pill"><svg class="ic sm"><use href="#i-spark"/></svg>Agent 模式</div>
                <div class="pill">智能比例 · 1K</div>
                <div class="pill"><svg class="ic sm"><use href="#i-layers"/></svg>技能库</div>
                <div class="send-btn">
                  <span class="cost">5 / 张</span>
                  <button class="send-arrow"><svg class="ic"><use href="#i-arrow"/></svg></button>
                </div>
              </div>
            </div>

            <div class="sec-title" style="margin-top:28px"><h2>示例作品</h2><a>查看全部</a></div>
            <div class="draw-gallery">${GALLERY}</div>
          </div>
        </div>`;

  EC.register("ecomDraw", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
  });
})();
