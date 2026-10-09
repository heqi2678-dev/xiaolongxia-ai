/* 铜龙电商ai助手 · 语音转写音频处理纯函数测试
 * 运行：node --test tests/asr-audio.test.js
 * 覆盖：高通滤波频响、峰值归一化、人声增强开关、WAV 编码头与采样回读。 */
const test = require("node:test");
const assert = require("node:assert");
const { highpassFilter, normalizeAudio, preprocessAudio, encodeWav } = require("../src/asr-audio.js");

function sine(freq, fs, n) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.sin(2 * Math.PI * freq * i / fs);
  return a;
}
function rms(data, from) {
  let s = 0, c = 0;
  for (let i = from || 0; i < data.length; i++) { s += data[i] * data[i]; c++; }
  return Math.sqrt(s / c);
}

test("高通滤波：衰减低频、保留人声频段", () => {
  const fs = 16000, n = fs;
  const lowIn = sine(20, fs, n), hiIn = sine(2000, fs, n);
  const lowOut = rms(highpassFilter(lowIn, fs, 100), 2000);
  const hiOut = rms(highpassFilter(hiIn, fs, 100), 2000);
  assert.ok(lowOut < rms(lowIn, 2000) * 0.2, "20Hz 应被显著衰减，实测 RMS=" + lowOut.toFixed(4));
  assert.ok(hiOut > rms(hiIn, 2000) * 0.9, "2kHz 应基本保留，实测 RMS=" + hiOut.toFixed(4));
});

test("峰值归一化：提升小音量、封顶 0.9、增益不超过 4 倍", () => {
  const a = normalizeAudio(new Float32Array([0.1, -0.2, 0.05]));
  assert.ok(Math.abs(Math.max(Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2])) - 0.8) < 1e-6, "0.2 峰值 ×4 → 0.8");

  const b = normalizeAudio(new Float32Array([0.5, -0.25]));
  assert.ok(Math.abs(Math.abs(b[0]) - 0.9) < 1e-6 || Math.abs(Math.abs(b[0]) - 1.0) < 1e-6, "0.5 峰值应升至 0.9");

  const tiny = new Float32Array([0.0002, 0.0001]);
  const before = tiny[0];
  const c = normalizeAudio(tiny);
  assert.equal(c[0], before, "低于 0.001 的极小音量不放大");
});

test("人声增强预处理：关闭时原样返回，开启时执行归一化", () => {
  const src = new Float32Array([0.1, 0.05]);
  const off = preprocessAudio(src, 16000, false);
  assert.equal(off, src, "关闭时返回同一引用");

  const input = sine(1000, 16000, 16000);
  for (let i = 0; i < input.length; i++) input[i] *= 0.1;
  const on = preprocessAudio(input, 16000, true);
  const peak = (d) => { let p = 0; for (let i = 2000; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); return p; };
  assert.ok(peak(on) > peak(input) * 2, "开启时被归一化放大，pre=" + peak(input).toFixed(3) + " post=" + peak(on).toFixed(3));
});

test("WAV 编码：头部字段与采样值正确", async () => {
  const data = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const blob = encodeWav(data, 16000);
  assert.equal(blob.type, "audio/wav");
  assert.equal(blob.size, 44 + data.length * 2);

  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const str = (o, len) => { let s = ""; for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(o + i)); return s; };
  assert.equal(str(0, 4), "RIFF");
  assert.equal(str(8, 4), "WAVE");
  assert.equal(str(12, 4), "fmt ");
  assert.equal(str(36, 4), "data");
  assert.equal(view.getUint16(22, true), 1, "单声道");
  assert.equal(view.getUint32(24, true), 16000, "采样率");
  assert.equal(view.getUint16(34, true), 16, "位深");
  assert.equal(view.getUint32(40, true), data.length * 2, "数据字节数");

  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 16383, "0.5 → 0.5×0x7fff");
  assert.equal(view.getInt16(48, true), -16384, "-0.5 → -0.5×0x8000");
  assert.equal(view.getInt16(50, true), 32767, "1.0 饱和");
  assert.equal(view.getInt16(52, true), -32768, "-1.0 饱和");
});

test("WAV 编码：越界输入被裁剪到 [-1,1]", async () => {
  const blob = encodeWav(new Float32Array([2, -3]), 8000);
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(46, true), -32768);
});
