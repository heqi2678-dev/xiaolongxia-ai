/* 电商工作台 · 跨境本地化 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>跨境本地化</h1>
            <p>选市场、语言、模特，把一套素材适配到海外平台。</p>
          </div>

          <div class="split" style="grid-template-columns:1fr 1fr">
            <div class="panel">
              <div class="panel-head"><svg class="ic sm"><use href="#i-globe"/></svg>本地化设置</div>
              <div class="panel-body">
                <div class="field">
                  <label>目标市场</label>
                  <div class="chips">
                    <div class="chip on">马来西亚</div>
                    <div class="chip">美国</div>
                    <div class="chip">欧洲</div>
                    <div class="chip">东南亚</div>
                  </div>
                </div>
                <div class="field">
                  <label>文案语言</label>
                  <div class="chips">
                    <div class="chip on">English</div>
                    <div class="chip on">Bahasa Melayu</div>
                    <div class="chip">中文</div>
                    <div class="chip">日本語</div>
                  </div>
                </div>
                <div class="field">
                  <label>模特族裔</label>
                  <div class="avatar-chips">
                    <div class="avchip on"><div class="bubble">亚</div>亚裔</div>
                    <div class="avchip"><div class="bubble">欧</div>欧美</div>
                    <div class="avchip"><div class="bubble">非</div>非裔</div>
                    <div class="avchip"><div class="bubble">拉</div>拉美</div>
                  </div>
                </div>
                <div class="field">
                  <label>目标平台</label>
                  <div class="select">TikTok Shop <svg class="ic sm"><use href="#i-arrow"/></svg></div>
                </div>
                <div class="field">
                  <div class="switch-row">
                    <div><b>视频本地化配音</b><span>自动翻译字幕并生成目标语言配音</span></div>
                    <div class="switch"></div>
                  </div>
                </div>
                <button class="btn btn-primary"><svg class="ic sm"><use href="#i-spark"/></svg>生成本地化素材</button>
              </div>
            </div>

            <div class="phone-wrap">
              <div class="phone">
                <div class="phone-screen">
                  <div class="notch"></div>
                  <div class="phone-shot"><img src="assets/ecom/dress.jpg" alt=""></div>
                  <div class="vid-badges"><div class="flag">MY</div></div>
                  <div class="gen-tag">AI 本地化</div>
                  <div class="caption">
                    <span class="sub">English + Bahasa Melayu</span>
                    <span class="name">Localized Video · Malaysia</span>
                    <span class="desc">字幕与配音已自动翻译</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;

  EC.register("ecomLocalize", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
  });
})();
