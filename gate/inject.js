(function () {
  window.__xlxSkipSW = true;
  var user = window.__xlxUser || { name: "guest", role: "friend" };
  var prefix = "u_" + user.name + "_";
  var roomKeys = {
    xlx_billing: 1,
    xlx_billing_log: 1,
    xlx_chat_meta: 1,
    xlx_commands: 1,
    xlx_comic_draft: 1,
    xlx_conversations: 1,
    xlx_images: 1,
    xlx_memory: 1,
    xlx_models: 1,
    xlx_project: 1,
    xlx_settings: 1
  };
  function mapped(k) {
    if (typeof k !== "string") return k;
    if (roomKeys[k]) return prefix + k;
    return k;
  }
  var proto = Storage.prototype;
  var getItem = proto.getItem;
  var setItem = proto.setItem;
  var removeItem = proto.removeItem;
  proto.getItem = function (k) { return getItem.call(this, mapped(k)); };
  proto.setItem = function (k, v) { return setItem.call(this, mapped(k), v); };
  proto.removeItem = function (k) { return removeItem.call(this, mapped(k)); };

  window.__xlxGateConsume = async function () {
    try {
      var res = await fetch("/dian/api/quota/consume", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" }
      });
      var data = await res.json();
      if (data && data.ok) return true;
      alert("今日次数已用完，明日再来或联系主人");
      return false;
    } catch (e) {
      alert("门卫暂时没回上，请稍后再试");
      return false;
    }
  };

  function mountBar() {
    if (!document.body) return;
    if (document.getElementById("xlx-gate-bar")) return;
    var el = document.createElement("div");
    el.id = "xlx-gate-bar";
    el.setAttribute("style", "position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;gap:8px;align-items:center;background:#1a1c2e;color:#eef0ff;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 10px 8px 14px;font:12px/1.2 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);");
    var name = document.createElement("span");
    name.textContent = user.name || "";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "退出";
    btn.setAttribute("style", "border:0;background:#ff5a3c;color:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;");
    btn.onclick = async function () {
      try {
        await fetch("/dian/api/logout", { method: "POST", credentials: "same-origin" });
      } catch (e) {}
      location.replace("/dian/");
    };
    el.appendChild(name);
    el.appendChild(btn);
    document.body.appendChild(el);
  }
  if (document.body) mountBar();
  else document.addEventListener("DOMContentLoaded", mountBar);
})();
