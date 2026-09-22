#!/usr/bin/env python3
"""真实浏览器布局审计：检测各视图内容被裁切/无法滚动访问的问题。

jsdom 测试不做布局，无法发现 overflow:hidden 裁切这类问题。
本脚本用无头 Chromium 真正排版后，逐视图检测：
  - 视图根节点 overflow:hidden 但内容溢出（无法滚动）
  - 元素延伸出视口下方且没有任何可滚动祖先（永远看不到）
  - 元素被任一不可滚动的 overflow:hidden/clip 祖先裁剪（横向或纵向）

用法：
  python3 tests/layout_audit.py [base_url]            # 全视口审计
  python3 tests/layout_audit.py --self-test [base_url] # 自检：注入缺陷验证检测器有效
默认 base_url = http://127.0.0.1:9140
需要已安装：chromium、chromium-driver、selenium；登录口令经 AUDIT_PASS 传入。
"""
import json
import os
import sys
import time

_POSARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (_POSARGS[0] if _POSARGS else "http://127.0.0.1:9140").rstrip("/")
APP_PATH = "/dian/"
GATE_USER = os.environ.get("AUDIT_USER", "zhuren")
GATE_PASS = os.environ.get("AUDIT_PASS", "")
VIEWS = ["chat", "market", "studio", "dramaHome", "drama", "auto", "tools", "memory", "download", "settings"]

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
except Exception as exc:  # noqa: BLE001
    print("SKIP: 未安装 selenium（%s）" % exc)
    sys.exit(0)

AUDIT_JS = r"""
  const active = document.querySelector('.view.active');
  const out = { view: active ? active.id : null, issues: [] };
  if (!active) { out.issues.push({ type: 'no-active-view' }); return out; }
  const vh = window.innerHeight, vw = window.innerWidth;
  const isScroll = (el, axis) => {
    const cs = getComputedStyle(el);
    const o = axis === 'x' ? cs.overflowX : cs.overflowY;
    if (o !== 'auto' && o !== 'scroll') return false;
    return (axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight) > 1;
  };
  const reachable = (el, root, axis) => {
    let a = el;
    while (a) {
      if (isScroll(a, axis)) return true;
      if (a === root) break;
      a = a.parentElement;
    }
    return false;
  };
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cn = (typeof el.className === 'string' ? el.className : '').trim();
    if (cn) s += '.' + cn.split(/\s+/).slice(0, 3).join('.');
    return s;
  };
  // 向上找最近的“裁剪祖先”：overflow hidden/clip 且不可滚动。
  // 若途中遇到 auto/scroll 祖先，说明内容可滚动到，视为可达。
  const clippedBy = (el, axis) => {
    let a = el.parentElement;
    while (a && a !== active) {
      const cs = getComputedStyle(a);
      const o = axis === 'x' ? cs.overflowX : cs.overflowY;
      if (o === 'auto' || o === 'scroll') return null;
      if (o === 'hidden' || o === 'clip') {
        const er = el.getBoundingClientRect(), ar = a.getBoundingClientRect();
        const over = axis === 'x'
          ? (er.right > ar.right + 1 || er.left < ar.left - 1)
          : (er.bottom > ar.bottom + 1 || er.top < ar.top - 1);
        return over ? a : null;
      }
      a = a.parentElement;
    }
    return null;
  };
  const vcs = getComputedStyle(active);
  if (vcs.overflowY === 'hidden' && active.scrollHeight - active.clientHeight > 1) {
    out.issues.push({ type: 'view-clips-y', el: desc(active),
      overflow: active.scrollHeight - active.clientHeight });
  }
  if (vcs.overflowX === 'hidden' && active.scrollWidth - active.clientWidth > 1) {
    out.issues.push({ type: 'view-clips-x', el: desc(active),
      overflow: active.scrollWidth - active.clientWidth });
  }
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if (cs.position === 'fixed') return;
    const r = el.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) {
      const hasText = Array.prototype.some.call(el.childNodes,
        n => n.nodeType === 3 && n.textContent.trim());
      const interactive = /^(BUTTON|INPUT|SELECT|TEXTAREA|A|IMG|VIDEO|CANVAS)$/.test(el.tagName);
      if ((hasText || interactive)) {
        if (r.bottom > vh + 1 && r.top < vh && !reachable(el, active, 'y')) {
          out.issues.push({ type: 'clipped-below', el: desc(el),
            bottom: Math.round(r.bottom), vh: vh });
        }
        if (r.top < -1 && r.bottom > 0 && !reachable(el, active, 'y')) {
          out.issues.push({ type: 'clipped-above', el: desc(el), top: Math.round(r.top) });
        }
        for (const axis of ['x', 'y']) {
          const by = clippedBy(el, axis);
          if (by) {
            const er = el.getBoundingClientRect(), ar = by.getBoundingClientRect();
            out.issues.push({ type: 'clip-' + axis, el: desc(el), by: desc(by),
              over: Math.round(axis === 'x' ? er.right - ar.right : er.bottom - ar.bottom) });
          }
        }
      }
    }
    for (const c of el.children) walk(c);
  };
  walk(active);
  out.total = out.issues.length;
  out.issues = out.issues.slice(0, 30);
  return out;
"""

SEED_JS = r"""
  const shots = [];
  for (let i = 0; i < 10; i++) {
    shots.push({ id: 'saudit' + i, seq: i + 1, name: '分镜 ' + (i + 1),
      prompt: '镜头提示词 ' + (i + 1) + '：竖屏近景，人物表情自然',
      line: '这是第 ' + (i + 1) + ' 句台词，用来把页面撑长。',
      roleIds: [], duration: 5, motion: 'zoom-in',
      imageUrl: '', videoUrl: '', audioUrl: '', lipsyncUrl: '',
      firstFrame: '', status: 'pending', error: '' });
  }
  const chars = [];
  for (let i = 0; i < 6; i++) {
    chars.push({ id: 'caudit' + i, name: '审计角色 ' + (i + 1),
      identity: '身份设定 ' + (i + 1), appearance: '外观描述 ' + (i + 1) + '：发型、服装、气质', refImages: [] });
  }
  const p = { id: 'paudit', title: '布局审计短剧', genre: 'comic', engine: 'image',
    script: { logline: '审计用一句话故事', outline: '审计用大纲。'.repeat(6), scenes: [] },
    characters: chars, shots: shots, style: 'cn-manhua',
    subtitle: { enabled: true, font: 'default', color: '#ffffff', stroke: '#000000' },
    bgm: '', output: { ratio: '9:16', resolution: '1080p', fps: 30 },
    compliance: { aigcMarked: true, consentIds: [] },
    source: 'manual', createdAt: Date.now(), updatedAt: Date.now() };
  const proj = {}; proj[p.id] = p;
  localStorage.setItem('xlx_drama_projects', JSON.stringify(proj));
  localStorage.setItem('xlx_drama_auto_input', JSON.stringify({}));
  return true;
"""


def build_driver(width, height):
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=%d,%d" % (width, height))
    opts.add_argument("--force-device-scale-factor=1")
    for binary in ("/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"):
        if os.path.exists(binary):
            opts.binary_location = binary
            break
    return webdriver.Chrome(options=opts)


def login_if_needed(driver):
    driver.get(BASE + APP_PATH)
    time.sleep(1.0)
    if driver.find_elements(By.ID, "app"):
        return
    if not GATE_PASS:
        return
    # 在登录页用同源 fetch 调 /api/login，Set-Cookie 会落到浏览器里
    try:
        driver.get(BASE + "/")
        driver.set_script_timeout(10)
        driver.execute_async_script(
            "const [u,p,done] = arguments;"
            "fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'},"
            " body: JSON.stringify({username:u, password:p})})"
            ".then(r => r.json()).then(j => done(j && j.ok)).catch(() => done(false));",
            GATE_USER, GATE_PASS)
        driver.get(BASE + APP_PATH)
        time.sleep(1.0)
    except Exception:
        pass


def wait_for(driver, js, timeout=6.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if driver.execute_script(js):
                return True
        except Exception:
            pass
        time.sleep(0.15)
    return False


def set_viewport(driver, width, height, mobile=False):
    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": bool(mobile)},
    )


def audit_size(driver, width, height, mobile=False):
    print("\n===== 视口 %dx%d%s =====" % (width, height, " (mobile)" if mobile else ""))
    set_viewport(driver, width, height, mobile)
    login_if_needed(driver)
    if not driver.find_elements(By.ID, "app"):
        print("FAIL: 打不开 #app（登录失败？设 AUDIT_PASS 环境变量）")
        return 1
    set_viewport(driver, width, height, mobile)
    driver.execute_script(SEED_JS)
    driver.refresh()
    wait_for(driver, "return !!document.getElementById('app');")
    time.sleep(0.6)
    fails = 0
    for view in VIEWS:
        driver.execute_script(
            "const el = document.querySelector('[data-view=\"%s\"]'); if (el) el.click();" % view)
        if view == "dramaHome":
            wait_for(driver, "return !!document.querySelector('#dwHome .dw-pcard');")
        elif view == "drama":
            wait_for(driver, "const w = document.querySelector('#dwManual .dw-workbench');"
                             " return !!w && !!w.querySelector('.cv-wrap');")
        elif view == "auto":
            wait_for(driver, "return !!document.querySelector('#dwAuto .dw-wrap');")
        time.sleep(0.45)
        res = driver.execute_script(AUDIT_JS)
        issues = res.get("issues", [])
        if not issues:
            print("  ok   %-9s %s" % (view, res.get("view")))
        else:
            fails += 1
            print("  BAD  %-9s %s  (%d 处)" % (view, res.get("view"), res.get("total")))
            for it in issues:
                print("        - " + json.dumps(it, ensure_ascii=False))
    return fails


def goto_view(driver, view, ready_js=None):
    driver.execute_script(
        "const el = document.querySelector('[data-view=\"%s\"]'); if (el) el.click();" % view)
    if ready_js:
        wait_for(driver, ready_js)
    time.sleep(0.5)


def selftest(driver):
    """验证检测器有效：注入一个内部裁切缺陷，必须被检出；移除后必须恢复正常。"""
    print("\n===== 检测器自检（注入内部裁切缺陷）=====")
    set_viewport(driver, 390, 844, True)
    login_if_needed(driver)
    if not driver.find_elements(By.ID, "app"):
        print("FAIL: 打不开 #app（登录失败？设 AUDIT_PASS 环境变量）")
        return 1
    set_viewport(driver, 390, 844, True)
    driver.execute_script(SEED_JS)
    driver.refresh()
    wait_for(driver, "return !!document.getElementById('app');")
    time.sleep(0.5)
    goto_view(driver, "drama",
              "const w = document.querySelector('#dwManual .dw-workbench');"
              " return !!w && !!w.querySelector('.cv-wrap');")
    clean = driver.execute_script(AUDIT_JS)
    if clean.get("issues"):
        print("FAIL: 缺陷注入前就有告警，无法验证检测器")
        return 1
    print("  ok   注入前无告警")
    driver.execute_script(
        "const s = document.createElement('style'); s.id = 'audit-bug';"
        " s.textContent = '.dw-wrap{overflow:hidden;height:220px}';"
        " document.head.appendChild(s);")
    time.sleep(0.4)
    bad = driver.execute_script(AUDIT_JS)
    total = bad.get("total", 0)
    if total < 1:
        print("FAIL: 注入内部裁切缺陷后未检出（检测器失效）")
        return 1
    print("  ok   检出内部裁切 %d 处，例如：%s" % (
        total, json.dumps((bad.get("issues") or [{}])[0], ensure_ascii=False)))
    driver.execute_script(
        "const s = document.getElementById('audit-bug'); if (s) s.remove();")
    time.sleep(0.4)
    again = driver.execute_script(AUDIT_JS)
    if again.get("issues"):
        print("FAIL: 移除缺陷后仍有告警")
        return 1
    print("  ok   移除后恢复正常")
    return 0


def main():
    driver = None
    rc = 0
    selftest_mode = "--self-test" in sys.argv
    try:
        driver = build_driver(1440, 900)
        if selftest_mode:
            rc += selftest(driver)
        else:
            rc += audit_size(driver, 1440, 900, False)
            rc += audit_size(driver, 1024, 768, False)
            rc += audit_size(driver, 390, 844, True)
            rc += audit_size(driver, 360, 780, True)
    finally:
        if driver:
            driver.quit()
    label = "全部通过" if rc == 0 else "发现 %d 个问题" % rc
    print("\n===== 布局审计结果：%s =====" % label)
    return 1 if rc else 0


if __name__ == "__main__":
    sys.exit(main())
