/* 电商工作台 · AI 详情图 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const PRODUCTS = ["pot.jpg", "lipstick.jpg", "detergent.jpg", "dress.jpg"].map(function (f) {
    return '<div class="gd-p"><img src="assets/ecom/' + f + '" alt="" loading="lazy"></div>';
  }).join("");

  const ARROW = '<svg class="gd-arrow" viewBox="0 0 64 46" fill="none" aria-hidden="true">'
    + '<path d="M6 40C22 44 30 30 22 24 14 18 6 26 14 31 26 38 42 32 52 16" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>'
    + '<path d="M44 15L54 15L50 25" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const COLLAGE = [
    [
      { k: "hero", img: "pot.jpg", tint: "warm", ti: "经典珐琅 凝聚美味", su: "一锅多用 · 锁温聚能" },
      { k: "note", tint: "warm", ti: "均匀受热 不粘易洁", su: "健康涂层 · 轻松冲洗", tags: ["锁温", "不粘"] },
      { k: "photo", img: "pot.jpg" }
    ],
    [
      { k: "hero", img: "lipstick.jpg", tint: "pink", ti: "玫瑰绽放 邂逅芳华", su: "丝绒质地 · 显白持色" },
      { k: "photo", img: "skincare.jpg" },
      { k: "note", tint: "pink", ti: "天然温和 安心成分", su: "敏感肌适用", tags: ["温和", "修护"] }
    ],
    [
      { k: "hero", img: "detergent.jpg", tint: "blue", ti: "洁净如新 守护全家", su: "浓缩配方 · 强效去渍" },
      { k: "note", tint: "blue", ti: "深层去渍 持久留香", su: "低泡易漂 · 温和不伤手", tags: ["去渍", "留香"] },
      { k: "photo", img: "toothbrush.jpg" }
    ],
    [
      { k: "hero", img: "dress.jpg", tint: "green", ti: "法式浪漫 优雅随行", su: "轻盈飘逸 · 舒适亲肤" },
      { k: "note", tint: "green", ti: "透气亲肤 垂坠有型", su: "四季百搭", tags: ["透气", "亲肤"] },
      { k: "photo", img: "shoes.jpg" }
    ]
  ];

  function panel(p) {
    const cls = "gd-panel " + p.k + (p.tint ? " t-" + p.tint : "");
    if (p.k === "hero") {
      return '<div class="' + cls + '"><img src="assets/ecom/' + p.img + '" alt="" loading="lazy">'
        + '<span class="gd-cap"><b>' + p.ti + '</b>' + (p.su ? '<i>' + p.su + '</i>' : '') + '</span></div>';
    }
    if (p.k === "photo") {
      return '<div class="' + cls + '"><img src="assets/ecom/' + p.img + '" alt="" loading="lazy"></div>';
    }
    return '<div class="' + cls + '"><b>' + p.ti + '</b>'
      + (p.su ? '<span>' + p.su + '</span>' : '')
      + (p.tags ? '<em>' + p.tags.map(function (t) { return '<i>' + t + '</i>'; }).join("") + '</em>' : '')
      + '</div>';
  }

  const COLUMNS = COLLAGE.map(function (list) {
    return '<div class="gd-col">' + list.map(panel).join("") + '</div>';
  }).join("");

  function sel(icon, text) {
    return '<div class="select"><span class="sel-val"><span class="sel-ic"><svg class="ic sm"><use href="#i-' + icon + '"/></svg></span>' + text + '</span>'
      + '<svg class="ic sm"><use href="#i-arrow"/></svg></div>';
  }

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>AI 详情图</h1>
            <p>上传产品图，AI 解析卖点，自动生成整套电商详情图。</p>
          </div>

          <div class="split" style="grid-template-columns:400px 1fr">
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

                <div class="field sec">
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

                <div class="field sec">
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
                  <div class="field"><label>目标平台</label>${sel("globe", "智能匹配")}</div>
                  <div class="field"><label>语言要求</label>${sel("translate", "简体中文")}</div>
                  <div class="field"><label>清晰度</label>${sel("grid-img", "1K 标准")}</div>
                  <div class="field"><label>尺寸比例</label>${sel("crop", "3:4 竖版")}</div>
                </div>

                <div class="field sec">
                  <label>详情图模块</label>
                  <div class="seg wide" data-mod-group>
                    <button class="on">AI 规划</button>
                    <button>自选组合</button>
                  </div>
                </div>

                <div class="field">
                  <label>生成张数</label>
                  ${sel("layers", "1 张")}
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
              <div class="gen-demo">
                <div class="gd-products">
                  <div class="gd-pgrid">${PRODUCTS}</div>
                  <span class="gd-label">产品图</span>
                </div>
                ${ARROW}
                <div class="gd-collage">${COLUMNS}</div>
              </div>
            </div>
          </div>
        </div>`;

  EC.register("ecomDetail", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    const seg = el.querySelector("[data-mod-group]");
    if (seg) {
      seg.addEventListener("click", function (e) {
        const b = e.target.closest("button");
        if (!b) return;
        seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      });
    }
  });
})();
