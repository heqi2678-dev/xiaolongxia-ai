/* 电商工作台 · 作品库 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;
  const esc = EC.esc;

  const DEMO = [
    { f: "pot.jpg", h: "h3", t: "主图 · 白底", c: "图片" },
    { f: "dress.jpg", h: "h1", t: "AI 试衣", c: "图片" },
    { f: "detergent.jpg", h: "h2", t: "详情页", c: "详情页" },
    { f: "lipstick.jpg", h: "h3", t: "主图换色", c: "图片" },
    { f: "shoes.jpg", h: "h2", t: "场景合成", c: "图片" },
    { f: "skincare.jpg", h: "h4", t: "精修白底", c: "图片" },
    { f: "toothbrush.jpg", h: "h1", t: "海报设计", c: "图片" },
    { f: "dress.jpg", h: "h4", t: "本地化素材", c: "图片" }
  ];
  const CATS = ["全部", "图片", "视频", "详情页"];
  const KIND_CAT = { image: "图片", upload: "图片", edit: "图片", detail: "详情页", video: "视频", localize: "图片" };

  function card(it) {
    const img = it.src
      ? '<img src="' + esc(it.src) + '" alt="">'
      : '<svg class="ic sm"><use href="#i-image"/></svg>';
    return '<div class="g-item' + (it.fake ? " fake" : "") + '"' + (it.id ? ' data-id="' + esc(it.id) + '"' : "") + '>'
      + '<div class="ph ' + (it.h || "h3") + '">' + img + '</div>'
      + '<div class="g-overlay"><span class="tag">' + esc(it.name) + '</span><div class="acts">'
      + '<button data-act="dl" title="下载"><svg class="ic sm"><use href="#i-download"/></svg></button>'
      + '<button data-act="edit" title="再编辑"><svg class="ic sm"><use href="#i-layers"/></svg></button>'
      + (it.fake ? "" : '<button data-act="del" title="删除"><svg class="ic sm"><use href="#i-trash"/></svg></button>')
      + '</div></div></div>';
  }

  const HTML = `<div class="inner">
          <div class="page-head">
            <h1>作品库</h1>
            <p>所有生成与导出的素材，一处管理、随时复用。数据保存在本机浏览器。</p>
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
            <div class="select sortsel" style="width:130px">最近更新 <svg class="ic sm"><use href="#i-arrow"/></svg></div>
            <button class="btn btn-ghost g-dl-all" style="width:auto;padding:8px 14px;font-size:12.5px"><svg class="ic sm"><use href="#i-download"/></svg>全部下载</button>
            <button class="btn btn-ghost g-clear" style="width:auto;padding:8px 14px;font-size:12.5px"><svg class="ic sm"><use href="#i-trash"/></svg>清空</button>
          </div>

          <div class="grid-masonry"></div>
        </div>`;

  function baseList(el) {
    const st = el.__gal;
    if (st.real.length) {
      return st.real.map(function (a) {
        return { id: a.id, src: EC.store.src(a), name: a.name || "素材", h: "h3", c: KIND_CAT[a.kind] || "图片", kind: a.kind, createdAt: a.createdAt };
      });
    }
    return DEMO.map(function (d) {
      return { src: "assets/ecom/" + d.f, name: d.t, h: d.h, c: d.c, fake: true, createdAt: 0 };
    });
  }

  function apply(el) {
    const st = el.__gal;
    let list = baseList(el);
    if (st.cat && st.cat !== "全部") list = list.filter(function (x) { return x.c === st.cat; });
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter(function (x) { return String(x.name).toLowerCase().indexOf(q) >= 0; }); }
    if (st.sort === "old") list = list.slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    else if (st.sort === "name") list = list.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    else list = list.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    const grid = el.querySelector(".grid-masonry");
    grid.innerHTML = list.length ? list.map(card).join("") : '<div class="g-empty">没有符合条件的素材。去「AI 作图」生成几张吧。</div>';
  }

  function hydrate(el) {
    if (!EC.store) { apply(el); return; }
    EC.store.list().then(function (items) {
      el.__gal.real = items;
      apply(el);
    }).catch(function () { apply(el); });
  }

  EC.register("ecomGallery", function (el) {
    if (!el.__gal) el.__gal = { real: [], cat: "全部", q: "", sort: "recent" };
    el.__gal.cat = "全部"; el.__gal.q = ""; el.__gal.sort = "recent";
    el.innerHTML = '<div class="ecom-ui">' + HTML + '</div>';
    apply(el);
    hydrate(el);

    if (el.__ecomGalBound) return;
    el.__ecomGalBound = true;

    const search = el.querySelector(".search input");
    search.addEventListener("input", function () { el.__gal.q = search.value.trim(); apply(el); });

    el.addEventListener("click", function (e) {
      if (!EC.ui) return;

      const chip = e.target.closest(".chips .chip");
      if (chip) { el.__gal.cat = chip.textContent.trim(); setTimeout(function () { apply(el); }, 0); return; }

      const sortsel = e.target.closest(".sortsel");
      if (sortsel) {
        e.stopPropagation();
        const opts = [["recent", "最近更新"], ["old", "最早更新"], ["name", "按名称"]];
        EC.ui.menu(sortsel, opts.map(function (o) {
          return { label: o[1], on: el.__gal.sort === o[0], pick: function () { el.__gal.sort = o[0]; sortsel.childNodes[0].nodeValue = o[1] + " "; apply(el); } };
        }));
        return;
      }

      const dlAll = e.target.closest(".g-dl-all");
      if (dlAll) {
        const st = el.__gal;
        if (!st.real.length) { EC.toast("当前没有可下载的作品"); return; }
        st.real.slice(0, 10).forEach(function (a, i) { setTimeout(function () { EC.store.download(a); }, i * 350); });
        if (EC.addUsage) EC.addUsage({ exported: st.real.length });
        EC.toast("开始下载 " + Math.min(st.real.length, 10) + " 个作品");
        return;
      }

      const clear = e.target.closest(".g-clear");
      if (clear) {
        const st = el.__gal;
        if (!st.real.length) { EC.toast("作品库已是空的"); return; }
        const m = EC.ui.modal({ title: "确认清空作品库？", body: '<p style="color:var(--sub);margin:0 0 16px">将删除本机保存的全部 ' + st.real.length + ' 个素材，无法恢复。</p>' });
        const bl = EC.ui.el("div", "modal-actions", '<button class="btn btn-ghost" data-x="no">取消</button><button class="btn btn-primary" data-x="yes">清空</button>');
        m.body.appendChild(bl);
        bl.addEventListener("click", function (ev) {
          const b = ev.target.closest("[data-x]");
          if (!b) return;
          if (b.getAttribute("data-x") === "no") { m.close(); return; }
          EC.store.clear().then(function () { st.real = []; m.close(); apply(el); EC.toast("作品库已清空"); });
        });
        return;
      }

      const item = e.target.closest(".g-item");
      if (item) {
        const act = e.target.closest("[data-act]");
        const id = item.getAttribute("data-id");
        if (item.classList.contains("fake")) {
          if (act && act.getAttribute("data-act") === "dl") EC.store.download({ url: item.querySelector("img").getAttribute("src"), name: "示例素材.jpg" });
          return;
        }
        EC.store.get(id).then(function (a) {
          if (!a) return;
          const what = act && act.getAttribute("data-act");
          if (what === "del") {
            EC.store.remove(id).then(function () {
              el.__gal.real = el.__gal.real.filter(function (x) { return x.id !== id; });
              apply(el); EC.toast("已删除");
            });
          } else if (what === "edit") { EC.go("ecomMainEdit"); }
          else { EC.store.download(a); if (EC.addUsage) EC.addUsage({ exported: 1 }); }
        });
        return;
      }
    });
  });
})();
