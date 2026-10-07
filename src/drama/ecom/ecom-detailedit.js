/* 电商工作台 · 详情页编辑 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>详情页编辑</h1>
            <p>列表模式管结构，画布模式精修细节，同一份内容随时手动切换。</p>
          </div>

          <div class="editor-wrap">
            <div class="toolbar">
              <div class="tool on"><svg class="ic sm"><use href="#i-arrow"/></svg>选择</div>
              <div class="tool"><svg class="ic sm"><use href="#i-text"/></svg>文字</div>
              <div class="tool"><svg class="ic sm"><use href="#i-crop"/></svg>抠图</div>
              <div class="tool"><svg class="ic sm"><use href="#i-image"/></svg>图片</div>
              <div class="tool-sep"></div>
              <div class="tool"><svg class="ic sm"><use href="#i-spark"/></svg>AI 重写</div>
              <div class="seg" data-mode-group style="margin-left:auto">
                <button class="on" data-mode="list"><svg class="ic sm"><use href="#i-layers"/></svg>列表</button>
                <button data-mode="canvas"><svg class="ic sm"><use href="#i-crop"/></svg>画布</button>
              </div>
              <button class="btn btn-primary" style="width:auto;padding:8px 18px;font-size:13px;margin-left:10px"><svg class="ic sm"><use href="#i-download"/></svg>导出详情页</button>
            </div>

            <div class="editor-body">
              <div class="epanel">
                <h4>模块库</h4>
                <div class="block"><svg class="ic sm"><use href="#i-image"/></svg>主图区</div>
                <div class="block"><svg class="ic sm"><use href="#i-text"/></svg>卖点区</div>
                <div class="block"><svg class="ic sm"><use href="#i-layers"/></svg>参数表</div>
                <div class="block"><svg class="ic sm"><use href="#i-image"/></svg>使用场景</div>
                <div class="block"><svg class="ic sm"><use href="#i-layers"/></svg>对比图</div>
                <div class="block"><svg class="ic sm"><use href="#i-heart"/></svg>买家口碑</div>
              </div>

              <div class="stage">
                <!-- 列表模式 -->
                <div class="ed-view view-list">
                  <div class="list-editor">
                    <div class="mode-tip"><svg class="ic sm"><use href="#i-layers"/></svg>列表模式：纵向模块堆叠，拖拽排序、逐块编辑</div>
                    <div class="module-row on">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb"><img src="assets/ecom/detergent.jpg" alt=""></div>
                      <div class="m-info"><b>主图区</b><span>头图 banner · 已选</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-crop"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="module-row">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb" style="background:#1c64f4"><svg class="ic sm"><use href="#i-text"/></svg></div>
                      <div class="m-info"><b>卖点区</b><span>植萃去渍 · 持久留香</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-text"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="module-row">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb"><img src="assets/ecom/toothbrush.jpg" alt=""></div>
                      <div class="m-info"><b>使用场景</b><span>真实场景图</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-crop"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="module-row">
                      <div class="drag"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-thumb" style="background:#12B76A"><svg class="ic sm"><use href="#i-layers"/></svg></div>
                      <div class="m-info"><b>参数表</b><span>规格 / 成分 / 容量</span></div>
                      <div class="m-actions"><button><svg class="ic sm"><use href="#i-text"/></svg></button><button><svg class="ic sm"><use href="#i-layers"/></svg></button></div>
                    </div>
                    <div class="add-module">+ 添加模块</div>
                  </div>
                </div>

                <!-- 画布模式 -->
                <div class="ed-view view-canvas" hidden>
                  <div class="canvas">
                    <div class="artboard">
                      <div class="ab-block sel"><div class="ab-img"><img src="assets/ecom/detergent.jpg" alt=""></div></div>
                      <div class="ab-block"><div class="ab-hero"><h3>超能洗衣液</h3><p>植萃去渍 · 持久留香 · 母婴可用</p></div></div>
                      <div class="ab-block"><div class="ab-row">
                        <div class="ab-cell"><b>3kg</b>大容量</div>
                        <div class="ab-cell"><b>8x</b>洁净力</div>
                        <div class="ab-cell"><b>0</b>荧光剂</div>
                      </div></div>
                      <div class="ab-block"><div class="ab-param"><div class="line"></div><div class="line"></div><div class="line s"></div></div></div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="epanel right inspector">
                <h4>属性</h4>
                <div class="field">
                  <label>标题文案</label>
                  <div class="select" style="white-space:nowrap;overflow:hidden">超能洗衣液</div>
                </div>
                <div class="field">
                  <label>字号</label>
                  <div class="select">19 px <svg class="ic sm"><use href="#i-arrow"/></svg></div>
                </div>
                <div class="field">
                  <label>主色</label>
                  <div class="swatches">
                    <div class="sw on" style="background:#FF4D2E"></div>
                    <div class="sw" style="background:#3B82F6"></div>
                    <div class="sw" style="background:#12B76A"></div>
                    <div class="sw" style="background:#8B5CF6"></div>
                    <div class="sw" style="background:#111827"></div>
                  </div>
                </div>
                <div class="field">
                  <label>图层</label>
                  <div class="layer"><svg class="ic sm"><use href="#i-text"/></svg>卖点区</div>
                  <div class="layer"><svg class="ic sm"><use href="#i-layers"/></svg>参数表</div>
                  <div class="layer"><svg class="ic sm"><use href="#i-image"/></svg>主图区</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;

  EC.register("ecomDetailEdit", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
  });
})();
