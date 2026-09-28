/* 铜龙电商 · 店铺与授权（设计稿 6.6 / 10） */
/* 店铺分组、店铺接入与授权状态；授权令牌仅提交服务端。 */
(function () {
  const D = XLX.drama || (XLX.drama = {});
  const EC = D.ecom;
  if (!EC) return;

  const esc = EC.esc;

  const PLATFORMS = [
    { id: "douyin", label: "抖音小店" },
    { id: "taobao", label: "淘宝" },
    { id: "pinduoduo", label: "拼多多" },
    { id: "kuaishou", label: "快手小店" },
    { id: "tiktok", label: "TikTok Shop" },
    { id: "mock", label: "测试（mock）" }
  ];

  const AUTH_LABEL = { normal: "已授权", expired: "已过期", unauthorized: "未授权", revoked: "已撤销" };

  const S = {
    loaded: false,
    shops: [],
    groups: [],
    groupId: "",
    form: { platform: "douyin", name: "", shop_id: "", group_id: "" },
    groupForm: { name: "", remark: "" },
    authId: "",
    token: ""
  };

  function empty(t) { return '<div class="ecom-empty">' + esc(t) + "</div>"; }

  function authLabel(s) { return AUTH_LABEL[s] || s || "-"; }

  function platformLabel(id) {
    const p = PLATFORMS.filter(function (x) { return x.id === id; })[0];
    return (p && p.label) || EC.platformText(id);
  }

  function groupName(id) {
    if (!id) return "未分组";
    const g = S.groups.filter(function (x) { return x.id === id; })[0];
    return (g && g.name) || id;
  }

  function authBadge(s) {
    const cls = s === "normal" ? "ecom-badge st-succeeded" : (s === "expired" ? "ecom-badge st-paused" : "ecom-badge");
    return '<span class="' + cls + '">' + esc(authLabel(s)) + "</span>";
  }

  function filterOptions() {
    return '<option value="">全部分组</option>' + S.groups.map(function (g) {
      return '<option value="' + esc(g.id) + '"' + (S.groupId === g.id ? " selected" : "") + ">" + esc(g.name) + "</option>";
    }).join("");
  }

  function groupsPanel() {
    const rows = S.groups.length
      ? S.groups.map(function (g) {
          const n = S.shops.filter(function (s) { return s.group_id === g.id; }).length;
          return '<div class="ecom-kv"><span>' + esc(g.name) + "</span><b>" + n + " 店</b></div>";
        }).join("")
      : '<div class="ecom-empty">暂无分组</div>';
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>店铺分组</span>'
      + '<span class="ecom-hint">' + S.groups.length + " 组</span></div>"
      + '<div class="ecom-panel-b">' + rows
      + '<div class="ecom-line"><input class="inp" id="ecomGroupName" placeholder="分组名称" value="' + esc(S.groupForm.name) + '">'
      + '<button class="btn" id="ecomGroupCreate">新建分组</button></div>'
      + "</div></div>";
  }

  function shopsPanel() {
    if (!S.loaded) return '<div class="ecom-panel"><div class="ecom-panel-b">' + empty("加载中…") + "</div></div>";
    const list = S.groupId ? S.shops.filter(function (s) { return s.group_id === S.groupId; }) : S.shops;
    if (!list.length) return '<div class="ecom-panel"><div class="ecom-panel-h"><span>店铺列表</span></div><div class="ecom-panel-b">' + empty("暂无店铺，先在右侧添加并授权") + "</div></div>";
    const rows = list.map(function (s) {
      return '<tr data-id="' + esc(s.id) + '"><td><div class="ecom-row-t">' + esc(s.name || s.shop_id || s.id) + "</div>"
        + '<div class="ecom-row-d">' + esc(platformLabel(s.platform)) + " · " + esc(s.shop_id || "-") + "</div></td>"
        + "<td>" + esc(groupName(s.group_id)) + "</td>"
        + "<td>" + authBadge(s.auth_status) + "</td>"
        + '<td class="ecom-td-act"><button class="ecom-link" data-auth="' + esc(s.id) + '">' + (s.auth_status === "normal" ? "重新授权" : "去授权") + "</button>"
        + '<button class="ecom-link" data-del="' + esc(s.id) + '">删除</button></td></tr>';
    }).join("");
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>店铺列表（' + list.length + "）</span>"
      + '<span class="ecom-hint">凭证由服务端加密保存</span></div>'
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-line"><select class="inp" id="ecomShopGroupFilter">' + filterOptions() + "</select>"
      + '<button class="ecom-link" data-refresh>刷新</button></div>'
      + '<table class="ecom-table"><thead><tr><th>店铺</th><th>分组</th><th>授权</th><th>操作</th></tr></thead>'
      + "<tbody>" + rows + "</tbody></table></div></div>";
  }

  function formPanel() {
    const opts = PLATFORMS.map(function (p) {
      return '<option value="' + p.id + '"' + (S.form.platform === p.id ? " selected" : "") + ">" + esc(p.label) + "</option>";
    }).join("");
    const gopts = '<option value="">未分组</option>' + S.groups.map(function (g) {
      return '<option value="' + esc(g.id) + '"' + (S.form.group_id === g.id ? " selected" : "") + ">" + esc(g.name) + "</option>";
    }).join("");
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>接入店铺</span></div>'
      + '<div class="ecom-panel-b">'
      + '<label class="ecom-field"><span>平台</span><select class="inp" id="ecomShopPlatform">' + opts + "</select></label>"
      + '<label class="ecom-field"><span>店铺名称</span><input class="inp" id="ecomShopName" value="' + esc(S.form.name) + '" placeholder="店铺展示名"></label>'
      + '<label class="ecom-field"><span>店铺 ID</span><input class="inp" id="ecomShopId" value="' + esc(S.form.shop_id) + '" placeholder="平台店铺 ID"></label>'
      + '<label class="ecom-field"><span>所属分组</span><select class="inp" id="ecomShopGroup">' + gopts + "</select></label>"
      + '<div class="ecom-line"><button class="btn primary" id="ecomShopCreate">添加店铺</button></div>'
      + "</div></div>";
  }

  function authPanel() {
    if (!S.authId) return '<div class="ecom-panel"><div class="ecom-panel-h"><span>授权</span></div><div class="ecom-panel-b">' + empty("在上方店铺列表点「去授权」") + "</div></div>";
    const shop = S.shops.filter(function (s) { return s.id === S.authId; })[0];
    return '<div class="ecom-panel"><div class="ecom-panel-h"><span>授权 · ' + esc((shop && shop.name) || S.authId) + "</span></div>"
      + '<div class="ecom-panel-b">'
      + '<div class="ecom-hint">粘贴平台授权返回的 access_token，提交后由服务端保存。</div>'
      + '<label class="ecom-field"><span>access_token</span><input class="inp" id="ecomShopToken" value="' + esc(S.token) + '" placeholder="授权令牌"></label>'
      + '<div class="ecom-line"><button class="btn primary" id="ecomShopAuth">提交授权</button>'
      + '<button class="btn" id="ecomShopAuthCancel">取消</button></div>'
      + "</div></div>";
  }

  function paint(el) {
    const box = el.querySelector("#ecomShopsMain");
    if (!box) return;
    box.innerHTML = '<div class="ecom-grid2">'
      + '<div class="ecom-col">' + groupsPanel() + shopsPanel() + "</div>"
      + '<div class="ecom-col">' + formPanel() + authPanel() + "</div>"
      + "</div>";
    bind(el);
  }

  function bind(el) {
    const gname = el.querySelector("#ecomGroupName");
    if (gname) gname.oninput = function () { S.groupForm.name = gname.value; };
    const gcreate = el.querySelector("#ecomGroupCreate");
    if (gcreate) gcreate.onclick = function () { createGroup(el); };

    const plat = el.querySelector("#ecomShopPlatform");
    if (plat) plat.onchange = function () { S.form.platform = plat.value; };
    const name = el.querySelector("#ecomShopName");
    if (name) name.oninput = function () { S.form.name = name.value; };
    const sid = el.querySelector("#ecomShopId");
    if (sid) sid.oninput = function () { S.form.shop_id = sid.value; };
    const group = el.querySelector("#ecomShopGroup");
    if (group) group.onchange = function () { S.form.group_id = group.value; };
    const create = el.querySelector("#ecomShopCreate");
    if (create) create.onclick = function () { createShop(el); };

    const filter = el.querySelector("#ecomShopGroupFilter");
    if (filter) filter.onchange = function () { S.groupId = filter.value; paint(el); };
    const refresh = el.querySelector("[data-refresh]");
    if (refresh) refresh.onclick = function () { load(el); };

    el.querySelectorAll("[data-auth]").forEach(function (n) {
      n.onclick = function () { S.authId = n.getAttribute("data-auth"); S.token = ""; paint(el); };
    });
    el.querySelectorAll("[data-del]").forEach(function (n) {
      n.onclick = function () { remove(el, n.getAttribute("data-del")); };
    });

    const token = el.querySelector("#ecomShopToken");
    if (token) token.oninput = function () { S.token = token.value; };
    const auth = el.querySelector("#ecomShopAuth");
    if (auth) auth.onclick = function () { authorize(el); };
    const cancel = el.querySelector("#ecomShopAuthCancel");
    if (cancel) cancel.onclick = function () { S.authId = ""; S.token = ""; paint(el); };
  }

  function createGroup(el) {
    if (!S.groupForm.name.trim()) return EC.toast("请填写分组名称", "err");
    EC.api("POST", "/shop-groups", { name: S.groupForm.name.trim() }).then(function () {
      S.groupForm.name = "";
      EC.toast("分组已创建", "ok");
      return load(el);
    }).catch(function (e) { EC.toast(e.message || "创建失败", "err"); });
  }

  function createShop(el) {
    if (!S.form.shop_id.trim() && !S.form.name.trim()) return EC.toast("请填写店铺名称或 ID", "err");
    EC.api("POST", "/shops", Object.assign({}, S.form)).then(function () {
      S.form.name = "";
      S.form.shop_id = "";
      EC.toast("店铺已添加", "ok");
      return load(el);
    }).catch(function (e) { EC.toast(e.message || "添加失败", "err"); });
  }

  function authorize(el) {
    if (!S.token.trim()) return EC.toast("请粘贴 access_token", "err");
    EC.api("POST", "/shops/auth", { id: S.authId, access_token: S.token.trim() }).then(function () {
      S.authId = "";
      S.token = "";
      EC.toast("授权已保存", "ok");
      return load(el);
    }).catch(function (e) { EC.toast(e.message || "授权失败", "err"); });
  }

  function remove(el, id) {
    EC.api("DELETE", "/shops/" + id).then(function () {
      EC.toast("店铺已删除", "ok");
      if (S.authId === id) { S.authId = ""; S.token = ""; }
      return load(el);
    }).catch(function (e) { EC.toast(e.message || "删除失败", "err"); });
  }

  function load(el) {
    return Promise.all([
      EC.api("GET", "/shops"),
      EC.api("GET", "/shop-groups")
    ]).then(function (res) {
      S.shops = res[0].items || [];
      S.groups = res[1].items || [];
      S.loaded = true;
      paint(el);
    }).catch(function (e) {
      S.loaded = true;
      EC.toast(e.message || "加载失败", "err");
      paint(el);
    });
  }

  function render(el) {
    el.innerHTML = '<div class="ecom-wrap"><div id="ecomShopsMain"><div class="ecom-empty">加载中…</div></div></div>';
    load(el);
  }

  EC.register("ecomShops", render);
})();
