/* 铜龙电商ai助手 · 语音转写音频处理纯函数
 * 浏览器与 Node 通用：index.html 经 XLX.asrAudio 调用，单测直接 require。
 * 覆盖：二阶 Butterworth 高通、峰值归一化、人声增强预处理、Float32→16bit PCM WAV。 */
(function () {
  const X = (typeof XLX !== "undefined") ? XLX : (globalThis.XLX = globalThis.XLX || {});

  /* 二阶 Butterworth 高通滤波器（去除背景音乐等低频干扰，人声主要在 80Hz-4kHz） */
  function highpassFilter(data, fs, fc) {
    const w0 = 2 * Math.PI * fc / fs;
    const cosw = Math.cos(w0);
    const alpha = Math.sin(w0) / Math.SQRT2;
    const b0 = (1 + cosw) / 2, b1 = -(1 + cosw), b2 = b0;
    const a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
    const out = new Float32Array(data.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < data.length; i++) {
      const x = data[i];
      const y = (b0 / a0) * x + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
    return out;
  }

  /* 峰值归一化（提升口播音量，避免过小输入）；返回原数组（原地缩放） */
  function normalizeAudio(data) {
    let peak = 0;
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
    if (peak > 0.001) {
      const g = Math.min(0.9 / peak, 4);
      for (let i = 0; i < data.length; i++) data[i] *= g;
    }
    return data;
  }

  function preprocessAudio(data, fs, enhance) {
    if (!enhance) return data;
    return normalizeAudio(highpassFilter(data, fs, 100));
  }

  /* Float32 单声道音频 → 16bit PCM WAV Blob（云端识别上传用） */
  function encodeWav(data, sampleRate) {
    const n = data.length;
    const view = new DataView(new ArrayBuffer(44 + n * 2));
    const ws = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    ws(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); ws(8, "WAVE");
    ws(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ws(36, "data"); view.setUint32(40, n * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return new Blob([view], { type: "audio/wav" });
  }

  X.asrAudio = { highpassFilter: highpassFilter, normalizeAudio: normalizeAudio, preprocessAudio: preprocessAudio, encodeWav: encodeWav };
  if (typeof module !== "undefined" && module.exports) module.exports = X.asrAudio;
})();
