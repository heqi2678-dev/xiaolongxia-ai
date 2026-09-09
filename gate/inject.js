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

  function pill(bg) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("style", "border:0;background:" + bg + ";color:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;");
    return btn;
  }

  function showInvite(code) {
    var old = document.getElementById("xlx-invite-pop");
    if (old) old.remove();
    var mask = document.createElement("div");
    mask.id = "xlx-invite-pop";
    mask.setAttribute("style", "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;");
    var box = document.createElement("div");
    box.setAttribute("style", "width:100%;max-width:320px;background:#23263f;color:#eef0ff;border-radius:16px;padding:22px 20px;font:14px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;");
    var title = document.createElement("div");
    title.textContent = "邀请码";
    title.setAttribute("style", "font-size:16px;font-weight:700;margin-bottom:8px;");
    var hint = document.createElement("div");
    hint.textContent = "发给熟人，让他们自己注册。换新后旧码立刻作废。";
    hint.setAttribute("style", "color:#8a90b0;font-size:12px;margin-bottom:14px;");
    var codeEl = document.createElement("div");
    codeEl.id = "xlx-invite-code";
    codeEl.textContent = code || "";
    codeEl.setAttribute("style", "font:700 22px/1.2 ui-monospace,monospace;letter-spacing:3px;text-align:center;padding:14px 8px;background:#1a1c2e;border-radius:10px;margin-bottom:14px;");
    var row = document.createElement("div");
    row.setAttribute("style", "display:flex;gap:8px;");
    var copy = pill("#3d4466");
    copy.textContent = "复制";
    copy.onclick = function () {
      var text = codeEl.textContent || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { copy.textContent = "已复制"; }).catch(function () { window.prompt("复制邀请码", text); });
      } else {
        window.prompt("复制邀请码", text);
      }
    };
    var rotate = pill("#3d4466");
    rotate.textContent = "换新";
    rotate.onclick = async function () {
      if (!window.confirm("换新后，旧邀请码立刻不能用。确定？")) return;
      try {
        var res = await fetch("/dian/api/invite/rotate", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
        var data = await res.json();
        if (data && data.ok && data.code) {
          codeEl.textContent = data.code;
          rotate.textContent = "已换新";
        } else {
          alert((data && data.error) || "换新失败");
        }
      } catch (e) {
        alert("门卫暂时没回上");
      }
    };
    var close = pill("#ff5a3c");
    close.textContent = "关闭";
    close.onclick = function () { mask.remove(); };
    row.appendChild(copy);
    row.appendChild(rotate);
    row.appendChild(close);
    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(codeEl);
    box.appendChild(row);
    mask.appendChild(box);
    mask.addEventListener("click", function (ev) { if (ev.target === mask) mask.remove(); });
    document.body.appendChild(mask);
  }

  function mdLite(text) {
    var s = String(text || "");
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = s.replace(/^### (.+)$/gm, "<b>$1</b>");
    s = s.replace(/^## (.+)$/gm, "<b>$1</b>");
    s = s.replace(/^# (.+)$/gm, "<b>$1</b>");
    s = s.replace(/^- (.+)$/gm, "· $1");
    return s.replace(/\n/g, "<br>");
  }

  function showGuide() {
    var old = document.getElementById("xlx-guide-pop");
    if (old) old.remove();
    var mask = document.createElement("div");
    mask.id = "xlx-guide-pop";
    mask.setAttribute("style", "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;");
    var box = document.createElement("div");
    box.setAttribute("style", "width:100%;max-width:520px;max-height:80vh;overflow:auto;background:#23263f;color:#eef0ff;border-radius:16px;padding:22px 20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;");
    box.innerHTML = "<div style='font-size:16px;font-weight:700;margin-bottom:10px'>说明书</div><div id='xlx-guide-body' style='color:#c9cde3'>正在读取…</div>";
    var close = pill("#ff5a3c");
    close.textContent = "关闭";
    close.style.marginTop = "14px";
    close.onclick = function () { mask.remove(); };
    box.appendChild(close);
    mask.appendChild(box);
    mask.addEventListener("click", function (ev) { if (ev.target === mask) mask.remove(); });
    document.body.appendChild(mask);
    fetch("/dian/api/shuoming", { credentials: "same-origin" }).then(function (res) { return res.json(); }).then(function (data) {
      var el = document.getElementById("xlx-guide-body");
      if (!el) return;
      if (!data || !data.ok) {
        el.textContent = (data && data.error) || "读不到说明书";
        return;
      }
      var html = "";
      if (data.shop) html += "<div style='margin-bottom:14px'><div style='color:#8a90b0;font-size:12px;margin-bottom:6px'>店总说明书</div>" + mdLite(data.shop) + "</div>";
      else html += "<div style='margin-bottom:14px;color:#8a90b0'>店总说明书还没写，可指挥店员写一份。</div>";
      if (user.role !== "owner") {
        html += "<div style='border-top:1px solid rgba(255,255,255,.12);padding-top:12px'><div style='color:#8a90b0;font-size:12px;margin-bottom:6px'>我的房间说明书</div>" + (data.mine ? mdLite(data.mine) : "还没写，可指挥店员写一份。") + "</div>";
      }
      el.innerHTML = html;
    }).catch(function () {
      var el = document.getElementById("xlx-guide-body");
      if (el) el.textContent = "门卫暂时没回上";
    });
  }

  function mountBar() {
    if (!document.body) return;
    if (document.getElementById("xlx-gate-bar")) return;
    var el = document.createElement("div");
    el.id = "xlx-gate-bar";
    el.setAttribute("style", "position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;gap:8px;align-items:center;background:#1a1c2e;color:#eef0ff;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 10px 8px 14px;font:12px/1.2 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);");
    var name = document.createElement("span");
    name.textContent = (user.name || "") + (user.role === "owner" ? " · 主人" : " · 朋友");
    var btn = pill("#ff5a3c");
    btn.textContent = "退出";
    btn.onclick = async function () {
      try {
        await fetch("/dian/api/logout", { method: "POST", credentials: "same-origin" });
      } catch (e) {}
      location.replace("/dian/");
    };
    el.appendChild(name);
    var guideBtn = pill("#3d4466");
    guideBtn.textContent = "说明书";
    guideBtn.onclick = showGuide;
    el.appendChild(guideBtn);
    if (user.role === "owner") {
      var inv = pill("#3d4466");
      inv.textContent = "邀请码";
      inv.onclick = async function () {
        try {
          var res = await fetch("/dian/api/invite", { credentials: "same-origin" });
          var data = await res.json();
          if (data && data.ok) showInvite(data.code);
          else alert((data && data.error) || "读不到邀请码");
        } catch (e) {
          alert("门卫暂时没回上");
        }
      };
      el.appendChild(inv);
    }
    el.appendChild(btn);
    document.body.appendChild(el);
  }
  if (document.body) mountBar();
  else document.addEventListener("DOMContentLoaded", mountBar);
})();
