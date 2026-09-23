/* 手机版响应式守卫测试
 * 运行：node --test tests/mobile-responsive.test.js
 * 目标：防止窄屏下视图内容被 .view{overflow:hidden} 裁掉而无法滚动查看，
 * 并保证新增视图宿主会被纳入移动端规则。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

function mobileBlock(html) {
  const m = html.match(/@media\(max-width:900px\)\{([\s\S]*?)\n\}/);
  assert.ok(m, "index.html 存在 900px 移动端媒体查询块");
  return m[1];
}

test("移动端视图容器可纵向滚动", () => {
  const html = read("index.html");
  const block = mobileBlock(html);
  assert.match(block, /\.view\.active\{overflow-y:auto/, "窄屏时活动视图需可滚动");
});

test("所有视图宿主都纳入移动端 flex-shrink 规则", () => {
  const html = read("index.html");
  const block = mobileBlock(html);
  const ids = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, "src/drama"))) {
    if (!f.endsWith(".js")) continue;
    const src = read("src/drama/" + f);
    const m = src.match(/function view\(\)\s*\{\s*return document\.getElementById\("([^"]+)"\)/);
    if (m) ids.add(m[1]);
  }
  assert.ok(ids.size >= 8, "解析到至少 8 个视图宿主，实际 " + ids.size);
  ids.forEach(id => {
    assert.ok(block.includes("#" + id), "移动端规则需包含视图宿主 #" + id);
  });
  assert.ok(block.includes("{flex-shrink:0;min-height:0}"), "宿主组需声明 flex-shrink:0");
});

test("顶栏在窄屏收敛，隐藏副标题与宽按钮", () => {
  const html = read("index.html");
  const block = mobileBlock(html);
  assert.match(block, /#topbar \.page-sub\{display:none\}/);
  assert.match(block, /\.shell-top-btn>span\{display:none\}/);
  assert.match(block, /\.shell-acc-text\{display:none\}/);
});

test("画布与 3D 面板在窄屏改用视口高度并收窄网格", () => {
  const canvas = read("src/drama/canvas.js");
  assert.match(canvas, /@media\(max-width:600px\)\{[\s\S]*?\.cv-wrap\{height:70vh;min-height:380px\}/);
  const box = read("src/drama/box3d.js");
  assert.match(box, /@media\(max-width:600px\)\{[\s\S]*?\.bx-wrap\{height:70vh;min-height:380px\}/);
  assert.match(box, /@media\(max-width:600px\)\{[\s\S]*?\.bx-grid\.g3,\.bx-grid\.g4\{grid-template-columns:repeat\(2,1fr\)\}/);
});

test("各视图在窄屏收缩内边距与网格", () => {
  assert.match(read("src/drama/toolkit.js"), /@media\(max-width:600px\)\{[\s\S]*?\.hs-title\{font-size:22px\}/);
  assert.match(read("src/drama/home.js"), /@media\(max-width:640px\)\{[\s\S]*?\.hx-wrap\{padding:18px 12px 46px;gap:20px\}/);
  assert.match(read("src/drama/ui.js"), /@media \(max-width:900px\)\{[\s\S]*?\.dw-wrap\{padding:12px 2px 32px\}/);
  assert.match(read("src/drama/ranking.js"), /@media\(max-width:600px\)\{[\s\S]*?\.rk-wrap\{padding:18px 12px 46px\}/);
  assert.match(read("src/drama/plugin.js"), /@media\(max-width:600px\)\{[\s\S]*?\.pl-wrap\{padding:18px 12px 46px\}/);
  assert.match(read("src/drama/box3dview.js"), /@media\(max-width:600px\)\{[\s\S]*?\.bv-field select\{min-width:0;width:100%\}/);
  assert.match(read("src/drama/makeup.js"), /\.mk-viewgrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(read("src/drama/manual.js"), /\.dw-wb-side\{width:auto;max-height:none;overflow:visible\}/);
});
