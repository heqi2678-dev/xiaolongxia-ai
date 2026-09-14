/* 铜龙电商 · 通用工具（从 index.html 拆出的第 2 块） */
/* ===== 通用工具：渲染、DOM、Toast、Logo ===== */

XLX.util = (function () {
  /* 铜龙电商 Logo SVG（满月 + 星星 + 铜龙电商） */
  function logo(size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none"><defs><linearGradient id="lgx" x1="0" y1="0" x2="96" y2="96"><stop offset="0" stop-color="#eef4fc"/><stop offset="1" stop-color="#f9e9c8"/></linearGradient></defs><rect width="96" height="96" rx="22" fill="url(#lgx)"/><circle cx="16" cy="22" r="2.2" fill="#e8a13c"/><circle cx="30" cy="14" r="1.6" fill="#e8a13c"/><circle cx="74" cy="14" r="2" fill="#e8a13c"/><circle cx="84" cy="30" r="1.5" fill="#e8a13c"/><circle cx="18" cy="44" r="1.5" fill="#e8a13c"/><path d="M66 30l1.4 2.8 2.8 1.4-2.8 1.4L66 38.4l-1.4-2.8-2.8-1.4 2.8-1.4z" fill="#e8a13c"/><circle cx="48" cy="40" r="25" fill="#f6c453" stroke="#e8a13c" stroke-width="1.5"/><circle cx="40" cy="34" r="4" fill="#edb648" opacity="0.6"/><circle cx="55" cy="46" r="6" fill="#edb648" opacity="0.6"/><circle cx="42" cy="50" r="3" fill="#edb648" opacity="0.6"/><circle cx="58" cy="30" r="2.5" fill="#edb648" opacity="0.6"/><text x="48" y="89" text-anchor="middle" font-size="23" font-weight="800" fill="#b3270f" stroke="#f2c25c" stroke-width="1" paint-order="stroke" font-family="KaiTi,STKaiti,serif">铜龙电商</text></svg>';
  }

  /* 简单安全的 Markdown 渲染（无依赖，足够快） */
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function renderBlock(md, lang) {
    const langLabel = lang || "code";
    return '<pre><div class="code-head"><span class="lang">' + esc(langLabel) + '</span><button class="copy" onclick="XLX.util.copyCode(this)">复制代码</button></div><code>' + md + "</code></pre>";
  }
  function renderMarkdown(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let i = 0;
    let listStack = [];
    function closeList() {
      while (listStack.length) {
        html += "</" + listStack.pop() + ">";
      }
    }
    function openList(type) {
      if (listStack.length && listStack[listStack.length - 1] === type) return;
      closeList();
      listStack.push(type);
      html += "<" + type + ">";
    }
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; closeList(); continue; }
      const codeMatch = line.match(/^```(\w*)/);
      if (codeMatch) {
        closeList();
        const lang = codeMatch[1];
        i++;
        let code = [];
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        html += renderBlock(esc(code.join("\n")), lang);
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) { closeList(); const lv = h[1].length; html += "<h" + lv + ">" + inlineMd(h[2]) + "</h" + lv + ">"; i++; continue; }
      const ul = line.match(/^\s*[-*+]\s+(.*)/);
      if (ul) { openList("ul"); html += "<li>" + inlineMd(ul[1]) + "</li>"; i++; continue; }
      const ol = line.match(/^\s*\d+[.、]\s+(.*)/);
      if (ol) { openList("ol"); html += "<li>" + inlineMd(ol[1]) + "</li>"; i++; continue; }
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { closeList(); html += "<hr>"; i++; continue; }
      const tableMatch = line.match(/^\|(.+)\|$/);
      if (tableMatch) {
        closeList();
        let rows = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i])) { rows.push(lines[i]); i++; }
        html += renderTable(rows);
        continue;
      }
      const blockquote = line.match(/^>\s?(.*)/);
      if (blockquote) {
        closeList();
        let q = [];
        while (i < lines.length && /^>/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        html += "<blockquote>" + inlineMd(q.join("<br>")) + "</blockquote>";
        continue;
      }
      closeList();
      html += "<p>" + inlineMd(line) + "</p>";
      i++;
    }
    closeList();
    return html;
  }
  function renderTable(rows) {
    let html = "<table>";
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const isSep = cells.every(c => /^:?-{2,}:?$/.test(c));
      if (isSep) continue;
      const tag = r === 0 ? "th" : "td";
      html += "<tr>" + cells.map(c => "<" + tag + ">" + inlineMd(c) + "</" + tag + ">").join("") + "</tr>";
    }
    return html + "</table>";
  }

  /* 流式渲染：全量重渲染，保证 markdown 结构任何时刻都完整 */
  function mdStream(el) {
    el.dataset.buf = el.dataset.buf || "";
  }
  function appendDelta(el, text) {
    el.dataset.buf = (el.dataset.buf || "") + text;
    const buf = el.dataset.buf;
    /* 未闭合代码块时等待，避免中途渲染乱码 */
    if ((buf.match(/```/g) || []).length % 2 === 1) return;
    el.innerHTML = renderMarkdown(buf) + '<span class="cursor-bar"></span>';
    el.scrollTop = el.scrollHeight;
  }
  function finalizeDelta(el) {
    el.innerHTML = renderMarkdown(el.dataset.buf || "");
    el.scrollTop = el.scrollHeight;
  }
  function setDelta(el, text) {
    el.dataset.buf = text;
    el.innerHTML = renderMarkdown(text) + '<span class="cursor-bar"></span>';
    el.scrollTop = el.scrollHeight;
  }
  function renderFull(el, text) {
    el.dataset.buf = text;
    el.dataset.flushed = String(text.length);
    el.innerHTML = renderMarkdown(text);
  }

  function copyCode(btn) {
    const pre = btn.closest("pre");
    const code = pre.querySelector("code");
    copyText(code.textContent).then(ok => {
      btn.textContent = ok ? "已复制" : "复制失败";
      setTimeout(() => { btn.textContent = "复制代码"; }, 1500);
    });
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) { return false; }
    }
  }

  function toast(msg, type) {
    const box = document.getElementById("toasts");
    const icons = { ok: "✔", err: "✖", warn: "!", info: "i" };
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.innerHTML = '<span class="t-ic">' + (icons[type] || "i") + '</span><span>' + esc(msg) + "</span>";
    box.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transition = "opacity .4s";
      setTimeout(() => t.remove(), 400);
    }, 3200);
  }

  function el(html) {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => (n < 10 ? "0" + n : n);
    return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* 下载文件 */
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
  }

  /* 生成 ZIP（用内置极简zip，避免外部依赖） */
  const ZIP = {
    _crc: (function () {
      const t = new Int32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
      return t;
    })(),
    crc32(bytes) {
      let c = -1;
      for (let i = 0; i < bytes.length; i++) c = (c >>> 8) ^ this._crc[(c ^ bytes[i]) & 0xff];
      return (c ^ -1) >>> 0;
    },
    dosTime(d) {
      return (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    },
    dosDate(d) {
      return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    },
    /* 统一把任意内容转成字节：Uint8Array / ArrayBuffer / Blob / data:URL / 普通字符串。
       data:URL 会解码回真实二进制，避免图片被当成文本写进 .png 而导致图片损坏。 */
    async _bytes(raw) {
      if (raw == null) return null;
      if (raw instanceof Uint8Array) return raw;
      if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
      if (raw instanceof Blob) return new Uint8Array(await raw.arrayBuffer());
      if (typeof raw === "string" && /^data:[^,]*;base64,/i.test(raw)) {
        const bin = atob(raw.slice(raw.indexOf(",") + 1));
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      if (typeof raw === "string" && /^data:/i.test(raw)) {
        return new TextEncoder().encode(decodeURIComponent(raw.slice(raw.indexOf(",") + 1)));
      }
      return new TextEncoder().encode(String(raw));
    },
    async make(files) {
      const enc = new TextEncoder();
      const parts = [];
      const central = [];
      let offset = 0;
      for (const f of files) {
        const name = enc.encode(f.name);
        const data = await this._bytes(f.content);
        if (data === null) continue;
        const crc = this.crc32(data);
        const t = this.dosTime(new Date());
        const d = this.dosDate(new Date());
        const uSize = data.length;
        /* local file header */
        const lh = new Uint8Array(30 + name.length);
        const lv = new DataView(lh.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);
        lv.setUint16(8, 0, true);
        lv.setUint16(10, t, true);
        lv.setUint16(12, d, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, uSize, true);
        lv.setUint32(22, uSize, true);
        lv.setUint16(26, name.length, true);
        lv.setUint16(28, 0, true);
        lh.set(name, 30);
        parts.push(lh, data);
        /* central directory record */
        const cr = new Uint8Array(46 + name.length);
        const cv = new DataView(cr.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, t, true);
        cv.setUint16(14, d, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, uSize, true);
        cv.setUint32(24, uSize, true);
        cv.setUint16(28, name.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        cr.set(name, 46);
        central.push(cr);
        offset += lh.length + uSize;
      }
      const cdSize = central.reduce((s, c) => s + c.length, 0);
      const end = new Uint8Array(22);
      const ed = new DataView(end.buffer);
      ed.setUint32(0, 0x06054b50, true);
      ed.setUint16(4, 0, true);
      ed.setUint16(6, 0, true);
      ed.setUint16(8, central.length, true);
      ed.setUint16(10, central.length, true);
      ed.setUint32(12, cdSize, true);
      ed.setUint32(16, offset, true);
      ed.setUint16(20, 0, true);
      const total = offset + cdSize + end.length;
      const result = new Uint8Array(total);
      let p = 0;
      for (const c of parts) { result.set(c, p); p += c.length; }
      for (const c of central) { result.set(c, p); p += c.length; }
      result.set(end, p);
      return new Blob([result], { type: "application/zip" });
    }
  };

  return { logo, renderMarkdown, renderFull, setDelta, appendDelta, finalizeDelta, mdStream, copyCode, copyText, toast, el, uid, fmtTime, download, ZIP, esc };
})();

/* 复制代码的全局回调 */
XLX.util.copyCode = XLX.util.copyCode;

