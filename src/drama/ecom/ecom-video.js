/* 铜龙电商ai助手 · 电商工作台 · AI 视频入口（三张工具卡，跳转对应视图） */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const CARDS = [
    { go: "ecomVideoI2V", icon: "video", title: "图生视频", desc: "参考图 + AI 脚本，生成商品讲解视频", art: "assets/ecom/mvideo-i2v.svg" },
    { go: "ecomVideoCopy", icon: "film", title: "视频复刻", desc: "爆款参考视频 + 产品图，一键同款带货", art: "assets/ecom/mvideo-copy.svg" },
    { go: "ecomVideoTranslate", icon: "globe", title: "视频翻译", desc: "语音 / 字幕 / 画面文字，多语言出海", art: "assets/ecom/mvideo-translate.svg" }
  ];

  const HTML = `<div class="inner">
    <div class="page-head">
      <h1>AI 视频</h1>
      <p>三种视频生成能力，覆盖商品讲解、爆款复刻与多语言出海。</p>
    </div>
    <div class="feature-grid" style="grid-template-columns:repeat(3,1fr)">
      ${CARDS.map(c => `
        <div class="feature" data-go="${c.go}">
          <div class="feat-head"><svg class="ic"><use href="#i-${c.icon}"/></svg></div>
          <div class="hero-art" style="margin-bottom:12px"><img src="${c.art}" alt="" style="width:100%;border-radius:10px"></div>
          <h4>${c.title}</h4>
          <p>${c.desc}</p>
          <span class="go">进入 <svg class="ic sm"><use href="#i-arrow"/></svg></span>
        </div>`).join("")}
    </div>
  </div>`;

  EC.register("ecomVideoHome", function (el) {
    el.innerHTML = '<div class="ecom-ui">' + HTML + "</div>";
  });
})();
