/* 电商工作台 · AI 详情图 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const INPUTS = ["pot.jpg", "pot.jpg", "detergent.jpg", "toothbrush.jpg"].map(function (f) {
    return '<img src="assets/ecom/' + f + '" alt="" loading="lazy">';
  }).join("");
  const OUTPUT = ["pot.jpg", "detergent.jpg", "shoes.jpg"].map(function (f) {
    return '<img src="assets/ecom/' + f + '" alt="" loading="lazy">';
  }).join("");

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>AI 详情图</h1>
            <p>上传产品图，AI 解析卖点，自动生成整套电商详情图。</p>
          </div>

          <div class="split" style="grid-template-columns:440px 1fr">
            <div class="panel gen-form">
              <div class="panel-head">产品图 <span style="margin-left:auto;color:var(--muted);font-weight:500;font-size:12px">0/6</span></div>
              <div class="panel-body">
                <div class="dropzone" style="margin-bottom:18px">
                  <div class="dz-ic"><svg class="ic lg"><use href="#i-upload"/></svg></div>
                  <b>上传主商品图和同一产品的多角度图片</b>
                  <p>支持 JPG、JPEG、PNG、WEBP</p>
                  <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
                    <button class="btn btn-primary" style="width:auto;padding:8px 16px;font-size:12.5px"><svg class="ic sm"><use href="#i-upload"/></svg>本地上传</button>
                    <button class="btn btn-ghost" style="padding:8px 16px;font-size:12.5px"><svg class="ic sm"><use href="#i-lib"/></svg>历史上传</button>
                  </div>
                </div>

                <div class="field">
                  <label>补充参考素材（选填）</label>
                  <div class="ref-row">
                    <div class="ri"><svg class="ic sm"><use href="#i-image"/></svg></div>
                    <div><b>商品 SKU 图</b><span>不同颜色 / 款式 · 用于 SKU 展示</span></div>
                    <div class="cnt">0/6</div>
                  </div>
                  <div class="ref-row">
                    <div class="ri"><svg class="ic sm"><use href="#i-crop"/></svg></div>
                    <div><b>商品细节图</b><span>材质 / 工艺 / 局部 · 用于细节展示</span></div>
                    <div class="cnt">0/6</div>
                  </div>
                </div>

                <div class="field">
                  <div class="label-row">
                    <label>详情图要求</label>
                    <div class="ai-write"><svg class="ic sm"><use href="#i-spark"/></svg>AI 帮写</div>
                  </div>
                  <textarea placeholder="建议输入以下信息，以获得更精准的生成效果：产品名称、核心卖点、适用人群、规格参数、详情图风格等"></textarea>
                  <div class="chips" style="margin-top:10px">
                    <div class="chip">+ 专业质感</div>
                    <div class="chip">+ 科技感</div>
                    <div class="chip on">+ 突出核心卖点</div>
                    <div class="chip">+ 突出使用场景</div>
                    <div class="chip">+ 简约高级</div>
                    <div class="chip">+ 文案简洁</div>
                  </div>
                </div>

                <div class="grid2">
                  <div class="field"><label>目标平台</label><div class="select">智能匹配 <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>
                  <div class="field"><label>语言要求</label><div class="select">简体中文 <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>
                  <div class="field"><label>清晰度</label><div class="select">1K 标准 <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>
                  <div class="field"><label>尺寸比例</label><div class="select">3:4 竖版 <svg class="ic sm"><use href="#i-arrow"/></svg></div></div>
                </div>

                <button class="btn btn-primary" style="margin-top:6px"><svg class="ic sm"><use href="#i-spark"/></svg>生成设计规划方案</button>
              </div>
            </div>

            <div class="gen-side">
              <h2>一键生成电商详情图</h2>
              <p>上传产品图，AI 深度解析产品亮点，自动生成多角度、多场景的整套电商详情图</p>
              <div class="badge-row">
                <div class="mini-badge"><svg class="ic sm" style="color:var(--primary)"><use href="#i-spark"/></svg>卖点解析</div>
                <div class="mini-badge"><svg class="ic sm" style="color:var(--primary)"><use href="#i-image"/></svg>多场景生成</div>
                <div class="mini-badge"><svg class="ic sm" style="color:var(--primary)"><use href="#i-layers"/></svg>整套排版</div>
              </div>
              <div class="gen-visual">
                <div class="gv-inputs">${INPUTS}</div>
                <div class="gv-arrow"><svg class="ic"><use href="#i-arrow"/></svg></div>
                <div class="gv-output">
                  ${OUTPUT}
                  <div class="gv-line"></div>
                  <div class="gv-line s"></div>
                </div>
              </div>
            </div>
          </div>
        </div>`;

  EC.register("ecomDetail", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
  });
})();
