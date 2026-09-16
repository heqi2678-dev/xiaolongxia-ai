/* 铜龙电商 · AI 短剧工作台 · 合规层 */
/* 显式角标、隐式元数据、肖像授权、真人素材拦截、生成留档。导出与发布必经此处。 */
(function () {
  const D = XLX.drama;
  const K = D.K;
  const MARK_TEXT = "AI 生成";

  /* ============ 肖像授权 ============ */
  function consents() {
    try { return JSON.parse(localStorage.getItem(K.CONSENTS) || "[]"); } catch (e) { return []; }
  }

  function saveConsents(list) {
    localStorage.setItem(K.CONSENTS, JSON.stringify(list || []));
  }

  function recordConsent(subject, scope) {
    const rec = {
      id: D.project.id("consent"),
      subject: subject || "未标注",
      scope: scope || "本人肖像用于 AI 短剧生成",
      confirmedAt: Date.now()
    };
    const list = consents();
    list.push(rec);
    saveConsents(list);
    return rec;
  }

  function getConsent(cid) {
    return consents().find(c => c.id === cid) || null;
  }

  /* ============ 真人素材检测 ============ */
  function faceDetectorAvailable() {
    return typeof window.FaceDetector === "function";
  }

  async function detectFace(file) {
    if (!file) return { ok: true, detected: false, supported: false };
    if (!faceDetectorAvailable()) return { ok: true, detected: false, supported: false };
    try {
      const bmp = await createImageBitmap(file);
      const det = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      const faces = await det.detect(bmp);
      return { ok: faces.length === 0, detected: faces.length > 0, count: faces.length, supported: true };
    } catch (e) {
      return { ok: true, detected: false, supported: false, error: e && e.message };
    }
  }

  /* 上传人脸素材用于换脸时阻断；用于参考图则需授权 */
  async function guardUpload(file, purpose) {
    const r = await detectFace(file);
    if (!r.supported) return { ok: true, warn: "当前浏览器不支持自动识别人脸，请自行确认素材已获授权" };
    if (r.detected) {
      if (purpose === "face-swap") {
        return { ok: false, reason: "检测到真人面部，换脸功能已按合规要求拦截。如确需使用，请联系店主人工审核。" };
      }
      return { ok: true, warn: "检测到真人面部，请确认已取得本人肖像授权，否则请勿使用。", face: true };
    }
    return { ok: true };
  }

  /* ============ 工程合规校验 ============ */
  function needsConsent(project) {
    if (project.genre === "realistic") return true;
    return (project.characters || []).some(c => c.realPerson);
  }

  function verify(project) {
    const blockers = [];
    if (!project.compliance || !project.compliance.aigcMarked) {
      blockers.push("未开启 AI 生成标注，按平台要求必须开启");
    }
    if (needsConsent(project)) {
      const ids = (project.compliance && project.compliance.consentIds) || [];
      const valid = ids.some(id => getConsent(id));
      if (!valid) blockers.push("本作品涉及真人形象，请先完成肖像授权确认");
    }
    return { ok: blockers.length === 0, blockers };
  }

  /* ============ 显式标注：画布角标 ============ */
  function drawBadge(ctx, w, h) {
    const pad = Math.round(w * 0.02);
    const fs = Math.max(14, Math.round(w * 0.028));
    ctx.save();
    ctx.font = "600 " + fs + "px system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    const tw = ctx.measureText(MARK_TEXT).width;
    const bw = tw + pad * 1.6;
    const bh = fs + pad;
    const x = w - bw - pad;
    const y = h - bh - pad;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#000000";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill(); }
    else ctx.fillRect(x, y, bw, bh);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(MARK_TEXT, x + pad * 0.8, y + bh / 2);
    ctx.restore();
  }

  /* ============ 隐式标注：产物元数据 ============ */
  function metadata(project, extra) {
    return {
      generator: "铜龙电商 AI 短剧工作台",
      aigc: true,
      aigcMarked: true,
      title: project.title,
      genre: project.genre,
      provider: extra && extra.provider,
      model: extra && extra.model,
      at: new Date().toISOString(),
      note: "本作品含 AI 生成内容"
    };
  }

  /* 把隐式标注写进 HTMLVideoElement 无法做，改由服务端 ffmpeg 写入；此处产出 srt 头与 sidecar */
  function sidecar(project) {
    const m = metadata(project);
    return "AI-GENERATED-CONTENT\n" + Object.keys(m).map(k => k + ": " + m[k]).join("\n") + "\n";
  }

  /* ============ 留档 ============ */
  async function archive(project, output) {
    const entry = {
      projectId: project.id,
      title: project.title,
      genre: project.genre,
      output,
      meta: metadata(project),
      consentIds: (project.compliance && project.compliance.consentIds) || [],
      at: Date.now()
    };
    try {
      await fetch("/dian/api/drama/publishes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: entry })
      });
    } catch (e) { /* 离线时留档失败不阻断导出 */ }
    return entry;
  }

  D.compliance = {
    MARK_TEXT, consents, recordConsent, getConsent,
    faceDetectorAvailable, detectFace, guardUpload,
    needsConsent, verify, drawBadge, metadata, sidecar, archive
  };
})();
