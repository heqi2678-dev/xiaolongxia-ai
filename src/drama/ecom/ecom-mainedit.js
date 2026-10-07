/* 电商工作台 · 主图编辑 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>主图编辑</h1>
            <p>同一张主图，列表模式调元素，画布模式自由拖拽，随时切换。</p>
          </div>

          <div class="editor-wrap">
            <div class="toolbar">
              <div class="tool on"><svg class="ic sm"><use href="#i-arrow"/></svg>选择</div>
              <div class="tool"><svg class="ic sm"><use href="#i-text"/></svg>文字</div>
              <div class="tool"><svg class="ic sm"><use href="#i-crop"/></svg>抠图</div>
              <div class="tool"><svg class="ic sm"><use href="#i-spark"/></svg>AI 换背景</div>
              <div class="seg" data-mode-group style="margin-left:auto">
                <button class="on" data-mode="list"><svg class="ic sm"><use href="#i-layers"/></svg>列表</button>
                <button data-mode="canvas"><svg class="ic sm"><use href="#i-crop"/></svg>画布</button>
              </div>
              <button class="btn btn-primary" style="width:auto;padding:8px 18px;font-size:13px;margin-left:10px"><svg class="ic sm"><use href="#i-download"/></svg>导出主图</button>
            </div>

            <div class="editor-body">
              <div class="epanel">
                <h4>元素库</h4>
                <div class="block"><svg class="ic sm"><use href="#i-image"/></svg>背景</div>
                <div class="block"><svg class="ic sm"><use href="#i-crop"/></svg>商品主体</div>
                <div class="block"><svg class="ic sm"><use href="#i-text"/></svg>主标题</div>
                <div class="block"><svg class="ic sm"><use href="#i-layers"/></svg>价格标签</div>
                <div class="block"><svg class="ic sm"><use href="#i-heart"/></svg>促销角标</div>
              </div>

              <div class="stage">
                <!-- 列表模式 -->
                <div class="ed-view view-list">
                  <div class="list-editor">
                    <div class="mode-tip"><svg class="ic sm"><use href="#i-layers"/></svg>列表模式：逐元素编辑，改文案／换图／调位置</div>
                    <div class="module-row">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb" style="background:linear-gradient(135deg,#e8f0fe,#cfe0ff)"><svg class="ic sm"><use href="#i-image"/></svg></div>
                      <div class="m-info"><b>背景</b><span>渐变蓝底 · 铺满画布</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-crop"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="module-row on">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb"><img src="assets/ecom/pot.jpg" alt=""></div>
                      <div class="m-info"><b>商品主体</b><span>已抠图 · 居中 200×200</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-crop"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="module-row">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb" style="background:#1a1a1a"><svg class="ic sm"><use href="#i-text"/></svg></div>
                      <div class="m-info"><b>主标题</b><span>夏日清凉好物</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-text"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="module-row">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb" style="background:#1c64f4"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-info"><b>价格标签</b><span>¥ 199 · 黑底白字</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-text"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="add-module">+ 添加元素</div>
                  </div>
                </div>

                <!-- 画布模式 -->
                <div class="ed-view view-canvas" hidden>
                  <div class="square-canvas"><div class="sq-art">
                    <div class="sq-el sq-title">夏日清凉好物</div>
                    <div class="sq-el sq-badge">限时特惠</div>
                    <div class="sq-el sq-prod sel"><img src="assets/ecom/pot.jpg" alt=""></div>
                    <div class="sq-el sq-price">¥ 199</div>
                  </div></div>
                </div>
              </div>

              <div class="epanel right inspector">
                <h4>属性</h4>
                <div class="field">
                  <label>元素类型</label>
                  <div class="select">商品主体 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
                </div>
                <div class="field">
                  <label>文本</label>
                  <div class="select" style="white-space:nowrap;overflow:hidden">—</div>
                </div>
                <div class="field">
                  <label>位置 X / Y</label>
                  <div style="display:flex;gap:8px">
                    <div class="select" style="justify-content:center">90</div>
                    <div class="select" style="justify-content:center">92</div>
                  </div>
                </div>
                <div class="field">
                  <label>颜色</label>
                  <div class="swatches">
                    <div class="sw on" style="background:#111827"></div>
                    <div class="sw" style="background:#FF4D2E"></div>
                    <div class="sw" style="background:#12B76A"></div>
                    <div class="sw" style="background:#FFFFFF"></div>
                  </div>
                </div>
                <div class="field">
                  <label>图层</label>
                  <div class="layer"><svg class="ic sm"><use href="#i-text"/></svg>主标题</div>
                  <div class="layer"><svg class="ic sm"><use href="#i-layers"/></svg>促销角标</div>
                  <div class="layer on"><svg class="ic sm"><use href="#i-crop"/></svg>商品主体</div>
                  <div class="layer"><svg class="ic sm"><use href="#i-layers"/></svg>价格标签</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;

  EC.register("ecomMainEdit", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
  });
})();
