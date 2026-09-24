/* 铜龙电商 · AI 短剧工作台 · 3D-BOX 真三维视口
 * 用 three.js 加载 Blender 回传的白模 GLB，提供搭景、站位调度、手绘运镜轨迹与抓帧。
 * 设计：机位/灯光/角度/运镜沿用 box3d.js 的统一取景接口，注册为 "real3d" 实现（provider）。
 * 无 WebGL / 未加载 three 时优雅降级，不影响既有 AI 生成链路。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;

  const FOV = 45;
  const DEFAULT_DIST = 4.6;
  const LOOK_Y = 1.4;
  const GROUND_SIZE = 24;

  /* ============ 纯逻辑（不依赖 WebGL，可单测） ============ */

  /* 景别 × 机位 → 相机位姿（相对于原点的拍摄对象） */
  function poseFor(scale, camera, opt) {
    const o = opt || {};
    const d = { wide: 8.4, medium: 5.2, close: 2.7 }[scale] || DEFAULT_DIST;
    const lookY = o.lookY != null ? o.lookY : LOOK_Y;
    let y = lookY, z = d;
    if (camera === "high") { y = lookY + d * 0.62; z = d * 0.68; }
    else if (camera === "low") { y = 0.42; z = d * 0.82; }
    return { pos: [0, round(y), round(z)], look: [0, round(lookY), 0], fov: FOV };
  }

  /* 多角度 → 相机位姿 */
  function anglePoseFor(id, opt) {
    const o = opt || {};
    const d = o.dist || DEFAULT_DIST;
    const lookY = o.lookY != null ? o.lookY : LOOK_Y;
    const P = {
      front: [0, lookY, d],
      face34: [d * 0.62, lookY + 0.2, d * 0.7],
      side: [d, lookY, 0],
      back: [0, lookY + 0.2, -d],
      top: [0, d * 1.25, 0.7],
      hero: [0, 0.42, d]
    }[id] || [0, lookY, d];
    const look = id === "top" ? [0, lookY - 0.4, 0] : id === "hero" ? [0, lookY + 0.25, 0] : [0, lookY, 0];
    return { pos: P.map(round), look: look.map(round), fov: FOV };
  }

  /* 灯光预设 → 灯位/色温（复用 box3d.LIGHTS 的 id） */
  const LIGHT_PRESETS = {
    "three-point": { ambient: 0.5, key: { pos: [3, 5, 4], color: 0xffffff, intensity: 1.5 }, fill: { pos: [-4, 3, 3], color: 0xc8d8ff, intensity: 0.7 } },
    "rembrandt": { ambient: 0.35, key: { pos: [3.4, 4.2, 3], color: 0xffe7c2, intensity: 1.7 }, fill: { pos: [-2.6, 2.4, 3.4], color: 0x8090a8, intensity: 0.35 } },
    "backlight": { ambient: 0.3, key: { pos: [-2, 4, -6], color: 0xfff2d6, intensity: 2 } },
    "top": { ambient: 0.3, key: { pos: [0, 7, 0.4], color: 0xffffff, intensity: 1.9 } },
    "side": { ambient: 0.35, key: { pos: [6, 3.4, 0.6], color: 0xffffff, intensity: 1.7 } },
    "neon": { ambient: 0.45, key: { pos: [3.6, 3, 3], color: 0xff3d8b, intensity: 1.5 }, fill: { pos: [-3.6, 2.6, 2.6], color: 0x26d9ff, intensity: 1.1 } },
    "golden": { ambient: 0.5, key: { pos: [-4, 3.2, 5], color: 0xffbe6b, intensity: 1.6 } },
    "blue": { ambient: 0.4, key: { pos: [-3, 4, 4], color: 0x7fa8ff, intensity: 1.1 } },
    "candle": { ambient: 0.22, key: { pos: [0.8, 1.3, 1.4], color: 0xffb066, intensity: 1.2 } }
  };

  function lightPreset(id) { return LIGHT_PRESETS[id] || LIGHT_PRESETS["three-point"]; }

  function round(n) { return Math.round(Number(n) * 1000) / 1000; }

  function vec3(a) {
    if (!Array.isArray(a) || a.length !== 3) return null;
    const v = a.map(Number);
    return v.every(n => isFinite(n)) ? v : null;
  }

  /* 轨迹关键点 → 运镜描述（供拼接视频提示词） */
  function pathPrompt(points) {
    const pts = (points || []).map(vec3).filter(Boolean);
    if (pts.length < 2) return "";
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const horiz = Math.hypot(dx, dz);
    let move;
    if (Math.abs(dy) > Math.max(horiz, 0.5)) move = dy > 0 ? "镜头上升" : "镜头下降";
    else if (horiz < 0.5) move = "镜头基本定点";
    else if (Math.abs(dz) >= Math.abs(dx)) move = dz < 0 ? "镜头向前推进" : "镜头向后拉远";
    else move = dx >= 0 ? "镜头向右横移" : "镜头向左横移";
    const dist = Math.hypot(dx, dy, dz);
    return "运镜轨迹：" + move + "，位移约 " + dist.toFixed(1) + " 米，共 " + pts.length + " 个关键点";
  }

  /* 轨迹是否可播放（至少 2 个点） */
  function playable(points) {
    return (points || []).map(vec3).filter(Boolean).length >= 2;
  }

  /* ============ WebGL 能力探测 ============ */
  function supported() {
    try {
      if (!window.THREE) return false;
      if (!window.THREE.WebGLRenderer) return false;
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) {
      return false;
    }
  }

  function fallbackHTML(reason) {
    return '<div class="sc-fallback">' +
      '<b>真 3D 视口不可用</b>' +
      '<span>' + D.ui.esc(reason || "当前浏览器或运行环境不支持 WebGL，可继续使用 AI 取景。") + "</span>" +
      "</div>";
  }

  /* ============ CSS ============ */
  const CSS = `
.sc-wrap{position:relative;border:1px solid var(--border);border-radius:14px;background:#0b0e14;overflow:hidden}
.sc-canvas{width:100%;height:440px;display:block;touch-action:none;cursor:grab}
.sc-canvas.drawing{cursor:crosshair}
.sc-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--panel)}
.sc-bar .sc-sp{flex:1}
.sc-bar .sc-tag{font-size:11px;color:var(--text3);border:1px solid var(--border);border-radius:99px;padding:3px 10px}
.sc-bar button.on{border-color:var(--accent);color:var(--accent2)}
.sc-bar .sc-hint{font-size:11.5px;color:var(--text3)}
.sc-fallback{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:240px;color:var(--text3);font-size:12.5px;text-align:center;padding:20px}
.sc-fallback b{color:var(--text)}
.sc-err{font-size:11.5px;color:var(--text3);padding:0 12px 8px}
@media(max-width:600px){.sc-canvas{height:320px}}
`;

  let cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    const s = document.createElement("style");
    s.id = "dramaBoxSceneCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssDone = true;
  }

  function esc(s) { return D.ui.esc(s == null ? "" : String(s)); }

  /* ============ 视口实现 ============ */
  const THREE = () => window.THREE;
  let active = null;

  function makeLabel(text, color) {
    const T = THREE();
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0)";
    g.fillRect(0, 0, c.width, c.height);
    g.font = "bold 30px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color || "#ffffff";
    g.fillText(String(text || "").slice(0, 12), c.width / 2, c.height / 2);
    const tex = new T.CanvasTexture(c);
    tex.needsUpdate = true;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(1.1, 0.28, 1);
    return sp;
  }

  function mount(host, project, shot, opts) {
    if (!host) return null;
    opts = opts || {};
    ensureCss();

    if (active) { try { active.dispose(); } catch (e) {} active = null; }

    if (!supported()) {
      host.innerHTML = fallbackHTML(active === null ? "" : "");
      return stubHandle(host, project, shot);
    }

    const T = THREE();
    host.innerHTML =
      '<div class="sc-wrap">' +
        '<div class="sc-bar">' +
          '<span class="sc-tag" id="scModel">白模未加载</span>' +
          '<button class="btn small" id="scReload">重新加载白模</button>' +
          '<button class="btn small" id="scReset">重置视角</button>' +
          '<button class="btn small" id="scAdd" title="为角色添加站位代理">＋站位</button>' +
          '<button class="btn small" id="scDraw" title="在场景中点击绘制相机轨迹">绘制轨迹</button>' +
          '<button class="btn small" id="scPlay">播放轨迹</button>' +
          '<button class="btn small" id="scClear">清空轨迹</button>' +
          '<button class="btn small primary" id="scGrab">抓帧存首帧</button>' +
          '<span class="sc-sp"></span>' +
          '<span class="sc-hint" id="scHint">拖拽旋转 · 滚轮缩放 · 右键平移</span>' +
        "</div>" +
        '<canvas class="sc-canvas" id="scCanvas"></canvas>' +
        '<div class="sc-err" id="scErr"></div>' +
      "</div>";

    const canvas = host.querySelector("#scCanvas");
    const errEl = host.querySelector("#scErr");
    const modelTag = host.querySelector("#scModel");
    const drawBtn = host.querySelector("#scDraw");

    let renderer, scene, camera, controls, raycaster, ground, grid;
    let model = null, modelUrl = "";
    let proxyGroup, pathLine, pathGroup;
    let lights = {};
    let drawing = false;
    let pathPts = [];
    let dragProxy = null;
    let raf = 0, disposed = false;
    const clock = new T.Clock();
    let anim = null;

    function fail(msg) { if (errEl) errEl.textContent = msg || ""; }

    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    } catch (e) {
      host.innerHTML = fallbackHTML("WebGL 初始化失败：" + ((e && e.message) || "未知错误"));
      return stubHandle(host, project, shot);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ("outputEncoding" in renderer && T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;

    scene = new T.Scene();
    scene.background = new T.Color(0x0b0e14);
    scene.fog = new T.Fog(0x0b0e14, 26, 60);

    camera = new T.PerspectiveCamera(FOV, 1, 0.05, 400);
    camera.position.set(0, 1.6, DEFAULT_DIST);

    controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, LOOK_Y, 0);
    controls.maxPolarAngle = Math.PI * 0.495;

    raycaster = new T.Raycaster();
    ground = new T.Mesh(
      new T.PlaneGeometry(GROUND_SIZE * 2, GROUND_SIZE * 2),
      new T.MeshStandardMaterial({ color: 0x141821, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.name = "ground";
    scene.add(ground);

    grid = new T.GridHelper(GROUND_SIZE, GROUND_SIZE, 0x2b3346, 0x1b2231);
    grid.position.y = 0.002;
    scene.add(grid);

    lights.hemi = new T.HemisphereLight(0xdfe8ff, 0x141821, 0.5);
    scene.add(lights.hemi);
    lights.amb = new T.AmbientLight(0xffffff, 0.5);
    scene.add(lights.amb);
    lights.key = new T.DirectionalLight(0xffffff, 1.5);
    lights.key.position.set(3, 5, 4);
    scene.add(lights.key);
    lights.fill = new T.DirectionalLight(0xc8d8ff, 0.7);
    lights.fill.position.set(-4, 3, 3);
    scene.add(lights.fill);

    proxyGroup = new T.Group();
    scene.add(proxyGroup);
    pathGroup = new T.Group();
    scene.add(pathGroup);

    function resize() {
      const w = canvas.clientWidth || host.clientWidth || 640;
      const h = canvas.clientHeight || 440;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }

    function applyPose(pose) {
      if (!pose) return;
      camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
      controls.target.set(pose.look[0], pose.look[1], pose.look[2]);
      if (pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
      controls.update();
    }

    function resetView() {
      camera.position.set(DEFAULT_DIST * 0.9, LOOK_Y + 1.2, DEFAULT_DIST * 1.15);
      controls.target.set(0, LOOK_Y, 0);
      camera.fov = FOV;
      camera.updateProjectionMatrix();
      controls.update();
    }

    function applyLight(id) {
      const p = lightPreset(id);
      lights.hemi.intensity = p.ambient != null ? p.ambient : 0.4;
      lights.amb.intensity = p.ambient != null ? p.ambient : 0.4;
      const set = (l, cfg, def) => {
        const c = cfg || def;
        l.position.set(c.pos[0], c.pos[1], c.pos[2]);
        l.color.setHex(c.color);
        l.intensity = c.intensity;
        l.visible = !!cfg;
      };
      set(lights.key, p.key, { pos: [3, 5, 4], color: 0xffffff, intensity: 1.2 });
      set(lights.fill, p.fill, null);
    }

    function disposeModel() {
      if (!model) return;
      model.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      scene.remove(model);
      model = null;
    }

    function fitToModel() {
      const box = new T.Box3().setFromObject(model);
      if (!isFinite(box.min.x) || box.isEmpty()) return;
      const size = box.getSize(new T.Vector3());
      const center = box.getCenter(new T.Vector3());
      const span = Math.max(size.x, size.y, size.z) || 4;
      const dist = Math.min(40, span * 1.6);
      ground.position.y = box.min.y - 0.01;
      grid.position.y = box.min.y + 0.002;
      controls.target.set(center.x, center.y, center.z);
      camera.position.set(center.x + dist * 0.7, center.y + span * 0.5, center.z + dist);
      camera.updateProjectionMatrix();
      controls.update();
    }

    function loadModel(url, force) {
      url = String(url || "");
      if (!url) { modelTag.textContent = "白模未加载"; return; }
      if (url === modelUrl && model && !force) return;
      modelUrl = url;
      modelTag.textContent = "白模加载中…";
      const loader = new T.GLTFLoader();
      loader.load(url, (gltf) => {
        if (disposed) return;
        disposeModel();
        model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!model) { modelTag.textContent = "白模为空"; return; }
        model.traverse(o => {
          if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
            if (o.material) {
              const ms = Array.isArray(o.material) ? o.material : [o.material];
              ms.forEach(m => { if (m.color && m.color.getHex() === 0x000000) m.color.setHex(0xb9bfcc); m.side = T.DoubleSide; });
            }
          }
        });
        scene.add(model);
        fitToModel();
        modelTag.textContent = "白模已加载";
        fail("");
      }, (ev) => {
        if (ev && ev.total) modelTag.textContent = "白模 " + Math.round((ev.loaded / ev.total) * 100) + "%";
      }, (e) => {
        modelTag.textContent = "白模未加载";
        fail("白模加载失败：" + ((e && e.message) || "请确认已在 Blender 插件里导出回传") + "（点击「重新加载白模」重试）");
      });
    }

    /* ---- 站位代理 ---- */
    const PROXY_COLORS = [0x4aa8ff, 0xff7aa8, 0x38d9e6, 0xffc861, 0xa78bfa, 0x7ee787];

    function rebuildProxies() {
      while (proxyGroup.children.length) {
        const p = proxyGroup.children.pop();
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
        proxyGroup.remove(p);
      }
      const b = D.box3d.ensure(shot);
      b.blocking.forEach((blk, i) => {
        const color = PROXY_COLORS[i % PROXY_COLORS.length];
        const geo = new T.CapsuleGeometry(0.24, 0.9, 6, 14);
        const mat = new T.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.92 });
        const mesh = new T.Mesh(geo, mat);
        mesh.position.set(blk.pos[0], blk.pos[1] + 0.7, blk.pos[2]);
        mesh.userData.blockId = blk.id;
        mesh.userData.baseY = 0.7;
        proxyGroup.add(mesh);
        const label = makeLabel(blk.name || ("角色" + (i + 1)), "#eaf2ff");
        label.position.set(blk.pos[0], blk.pos[1] + 1.7, blk.pos[2]);
        label.userData.blockId = blk.id;
        proxyGroup.add(label);
      });
    }

    function addBlocking() {
      const b = D.box3d.ensure(shot);
      const roles = D.character.rolesForShot(project, shot);
      const names = roles.length ? roles.map(c => c.name || "角色") : (project.characters || []).map(c => c.name);
      const name = names[b.blocking.length % Math.max(1, names.length)] || ("角色 " + (b.blocking.length + 1));
      const n = b.blocking.length;
      const pos = [round((n % 3 - 1) * 1.2), 0, round(Math.floor(n / 3) * 1.2 - 0.6)];
      b.blocking.push({ id: "bk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name, pos: pos });
      b.updatedAt = Date.now();
      rebuildProxies();
      changed();
    }

    function setBlocking(list) {
      const b = D.box3d.ensure(shot);
      b.blocking = (list || []).map(vec3).map((p, i) => ({ id: "bk" + i, name: "", pos: p })).filter(x => x.pos);
      b.updatedAt = Date.now();
      rebuildProxies();
    }

    function pointerRay(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const y = -((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera({ x: x, y: y }, camera);
      return raycaster;
    }

    function groundHit(ev) {
      const hits = pointerRay(ev).intersectObject(ground, false);
      return hits.length ? hits[0].point : null;
    }

    function onDown(ev) {
      if (drawing) {
        const p = groundHit(ev);
        if (!p) return;
        addPathPoint([round(p.x), round(p.y), round(p.z)]);
        return;
      }
      const hits = pointerRay(ev).intersectObjects(proxyGroup.children, true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.blockId) o = o.parent;
        if (o) {
          dragProxy = { id: o.userData.blockId, isLabel: o.isSprite };
          controls.enabled = false;
          canvas.style.cursor = "grabbing";
        }
      }
    }

    function onMove(ev) {
      if (!dragProxy) return;
      const p = groundHit(ev);
      if (!p) return;
      const b = D.box3d.ensure(shot);
      const blk = b.blocking.find(x => x.id === dragProxy.id);
      const target = meshFor(dragProxy.id) || (proxyGroup.children.find(o => o.userData.blockId === dragProxy.id));
      if (blk) {
        blk.pos = [round(p.x), 0, round(p.z)];
        const proxy = meshFor(dragProxy.id);
        if (proxy) proxy.position.set(blk.pos[0], proxy.userData.baseY || 0.7, blk.pos[2]);
        const labels = proxyGroup.children.filter(o => o.isSprite && o.userData.blockId === dragProxy.id);
        labels.forEach(l => l.position.set(blk.pos[0], 1.7, blk.pos[2]));
      }
    }

    function meshFor(id) {
      return proxyGroup.children.find(o => o.userData.blockId === id && o.isMesh);
    }

    function onUp() {
      if (dragProxy) {
        dragProxy = null;
        controls.enabled = true;
        canvas.style.cursor = drawing ? "crosshair" : "grab";
        changed();
      }
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    /* ---- 轨迹 ---- */
    function addPathPoint(p) {
      pathPts.push(p);
      const b = D.box3d.ensure(shot);
      b.camPath = pathPts.map(q => ({ pos: q.slice(), look: [] }));
      b.updatedAt = Date.now();
      rebuildPath();
      changed();
    }

    function rebuildPath() {
      while (pathGroup.children.length) {
        const o = pathGroup.children.pop();
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
        pathGroup.remove(o);
      }
      pathPts.forEach((p, i) => {
        const dot = new T.Mesh(
          new T.SphereGeometry(0.09, 12, 12),
          new T.MeshStandardMaterial({ color: i === 0 ? 0x7ee787 : (i === pathPts.length - 1 ? 0xff7aa8 : 0xffc861) })
        );
        dot.position.set(p[0], p[1] + 0.05, p[2]);
        pathGroup.add(dot);
      });
      if (pathPts.length >= 2) {
        const curve = new T.CatmullRomCurve3(pathPts.map(p => new T.Vector3(p[0], p[1] + 0.05, p[2])));
        const geo = new T.TubeGeometry(curve, Math.min(120, pathPts.length * 20), 0.03, 8, false);
        pathGroup.add(new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x4aa8ff, emissive: 0x123a66 })));
      }
    }

    function setPath(list) {
      pathPts = (list || []).map(x => vec3(x && x.pos ? x.pos : x)).filter(Boolean).map(p => p.map(round));
      rebuildPath();
    }

    function clearPath() {
      pathPts = [];
      const b = D.box3d.ensure(shot);
      b.camPath = [];
      b.updatedAt = Date.now();
      rebuildPath();
      changed();
    }

    function curve() {
      if (!playable(pathPts)) return null;
      return new T.CatmullRomCurve3(pathPts.map(p => new T.Vector3(p[0], p[1] + 0.05, p[2])));
    }

    function playPath(duration) {
      const c = curve();
      if (!c) return Promise.resolve(false);
      const secs = Math.max(1, Number(duration) || 4);
      return new Promise((resolve) => {
        const start = clock.getElapsedTime();
        const lookAt = new T.Vector3(0, LOOK_Y, 0);
        controls.enabled = false;
        (function step() {
          if (disposed) { controls.enabled = true; return resolve(false); }
          const t = Math.min(1, (clock.getElapsedTime() - start) / secs);
          const pt = c.getPointAt(t);
          camera.position.copy(pt);
          camera.lookAt(lookAt);
          if (t < 1) { anim = requestAnimationFrame(step); }
          else { controls.enabled = true; controls.target.copy(lookAt); controls.update(); resolve(true); }
        })();
      });
    }

    /* 录制运镜：MediaRecorder 录 canvas 流；调用前先摆好轨迹 */
    function recordMove(duration) {
      const secs = Math.max(1, Number(duration) || 4);
      if (!canvas.captureStream || typeof window.MediaRecorder !== "function") {
        return Promise.reject(D.err("NO_RECORDER", "当前环境不支持画布录制，可改用 AI 运镜或先「抓帧」"));
      }
      if (!curve()) return Promise.reject(D.err("NO_PATH", "请先在视口里绘制运镜轨迹（至少两个点）"));
      return new Promise((resolve, reject) => {
        let rec;
        try {
          const stream = canvas.captureStream(30);
          rec = new window.MediaRecorder(stream, { mimeType: pickMime() });
        } catch (e) {
          return reject(D.err("NO_RECORDER", "画布录制初始化失败"));
        }
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = () => reject(D.err("REC_FAIL", "运镜录制失败"));
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
          blob.size ? resolve(blob) : reject(D.err("REC_EMPTY", "运镜录制为空，请重试"));
        };
        try { rec.start(); } catch (e) { return reject(D.err("REC_FAIL", "运镜录制启动失败")); }
        playPath(secs).then(() => setTimeout(() => { try { rec.stop(); } catch (e) {} }, 120));
      });
    }

    function pickMime() {
      const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      for (const m of cands) {
        try { if (window.MediaRecorder && window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
      }
      return "video/webm";
    }

    /* ---- 抓帧 ---- */
    function captureBlob() {
      return new Promise((resolve, reject) => {
        try {
          renderer.render(scene, camera);
          if (canvas.toBlob) canvas.toBlob(b => (b ? resolve(b) : reject(D.err("CAP_EMPTY", "抓帧失败，请重试"))), "image/png");
          else reject(D.err("CAP_FAIL", "当前环境不支持抓帧"));
        } catch (e) { reject(D.err("CAP_FAIL", (e && e.message) || "抓帧失败")); }
      });
    }

    function captureURL() {
      return captureBlob().then(b => URL.createObjectURL(b));
    }

    function exportState() {
      return {
        cam: { pos: [round(camera.position.x), round(camera.position.y), round(camera.position.z)], look: [round(controls.target.x), round(controls.target.y), round(controls.target.z)], fov: round(camera.fov) },
        camPath: pathPts.map(p => ({ pos: p.slice(), look: [] })),
        blocking: D.box3d.ensure(shot).blocking.map(x => ({ pos: x.pos.slice() }))
      };
    }

    function changed() { if (typeof opts.onChange === "function") { try { opts.onChange(); } catch (e) {} } }

    function tick() {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    }

    resize();
    resetView();
    if (project.whiteModel && project.whiteModel.url) loadModel(project.whiteModel.url);
    rebuildProxies();
    setPath((D.box3d.ensure(shot).camPath) || []);
    tick();

    let ro = null;
    if (window.ResizeObserver) {
      ro = new window.ResizeObserver(resize);
      try { ro.observe(canvas); } catch (e) {}
    } else {
      window.addEventListener("resize", resize);
    }

    /* ---- 工具栏绑定 ---- */
    host.querySelector("#scReload").onclick = () => loadModel((project.whiteModel && project.whiteModel.url) || modelUrl, true);
    host.querySelector("#scReset").onclick = () => resetView();
    host.querySelector("#scAdd").onclick = () => addBlocking();
    host.querySelector("#scPlay").onclick = () => { if (!playPath(shot.duration || 4)) {} };
    host.querySelector("#scClear").onclick = () => clearPath();
    host.querySelector("#scGrab").onclick = () => {
      captureURL().then(async (url) => {
        shot.firstFrame = url;
        try { await D.project.save(project); } catch (e) {}
        U.toast("已抓帧写入本镜首帧", "ok");
        changed();
      }).catch(e => U.toast((e && e.message) || "抓帧失败", "err"));
    };
    if (drawBtn) drawBtn.onclick = () => {
      drawing = !drawing;
      drawBtn.classList.toggle("on", drawing);
      canvas.classList.toggle("drawing", drawing);
      host.querySelector("#scHint").textContent = drawing ? "绘制中：在场景地面点击添加轨迹点，再次点击「绘制轨迹」结束" : "拖拽旋转 · 滚轮缩放 · 右键平移";
    };

    const handle = {
      id: "real3d",
      el: host,
      shotId: shot.id,
      supported: true,
      setPose: (scale, cam) => { applyPose(poseFor(scale, cam)); },
      setAngle: (id) => { applyPose(anglePoseFor(id)); },
      setLight: (id) => { applyLight(id); },
      setBlocking: setBlocking,
      setPath: setPath,
      playPath: playPath,
      recordMove: recordMove,
      captureBlob: captureBlob,
      captureURL: captureURL,
      exportState: exportState,
      loadModel: (url) => loadModel(url, true),
      addBlocking: addBlocking,
      reset: resetView,
      dispose: () => {
        disposed = true;
        if (raf) cancelAnimationFrame(raf);
        if (anim) cancelAnimationFrame(anim);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("resize", resize);
        if (ro) { try { ro.disconnect(); } catch (e) {} }
        try { controls.dispose(); } catch (e) {}
        disposeModel();
        try { renderer.dispose(); } catch (e) {}
        if (active === handle) active = null;
      },
      ctx: { project: project, shot: shot }
    };
    active = handle;
    return handle;
  }

  /* 无 WebGL 时的占位句柄：接口齐全但调用即报错，保证上层不崩 */
  function stubHandle(host, project, shot) {
    function nope() { throw D.err("NO_WEBGL", "当前环境不支持真 3D 视口"); }
    return {
      id: "real3d", el: host, shotId: shot && shot.id, supported: false,
      setPose: nope, setAngle: nope, setLight: nope, setBlocking: nope, setPath: nope,
      playPath: function () { return Promise.resolve(false); },
      recordMove: function () { return Promise.reject(D.err("NO_WEBGL", "当前环境不支持真 3D 视口")); },
      captureBlob: function () { return Promise.reject(D.err("NO_WEBGL", "当前环境不支持真 3D 视口")); },
      captureURL: function () { return Promise.reject(D.err("NO_WEBGL", "当前环境不支持真 3D 视口")); },
      exportState: function () { return { cam: { pos: [], look: [], fov: FOV }, camPath: [], blocking: [] }; },
      addBlocking: nope, reset: nope, dispose: function () { if (active === this) active = null; },
      ctx: { project: project, shot: shot }
    };
  }

  function current() { return active; }

  /* ============ 注册为统一取景接口的 real3d 实现 ============ */
  function providerReady() { return !!(active && active.supported); }

  /* 取景任务串行执行：9 宫格/多角度是并行提交的，真 3D 只有一个相机，
     必须逐个「摆位 → 抓帧」，否则后一机位会覆盖前一机位的画面。 */
  let chain = Promise.resolve();
  function enqueue(fn) {
    const p = chain.then(fn, fn);
    chain = p.then(function () {}, function () {});
    return p;
  }

  const real3dProvider = {
    id: "real3d",
    label: "真 3D 视口",
    render(project, shot, sp, opts) {
      opts = opts || {};
      return enqueue(async function () {
        if (!providerReady()) throw D.err("NO_VIEWPORT", "真 3D 视口未就绪：请打开 3D-BOX 视口并选中本镜");
        if (active.shotId !== shot.id) throw D.err("SHOT_MISMATCH", "视口当前不在本镜，请在上方切到本镜");
        if (sp.kind === "camera") active.setPose(sp.scale, sp.camera);
        else if (sp.kind === "angle") active.setAngle(sp.id);
        else if (sp.kind === "light") active.setLight(sp.id);
        else if (sp.kind === "move") {
          const blob = await active.recordMove(opts.duration || shot.duration || 4);
          return { url: URL.createObjectURL(blob), media: "video" };
        }
        const url = await active.captureURL();
        return { url: url, media: "image" };
      });
    }
  };

  if (D.box3d && typeof D.box3d.register === "function") D.box3d.register("real3d", real3dProvider);

  D.box3dscene = {
    mount, current, supported, providerReady,
    poseFor, anglePoseFor, lightPreset, pathPrompt, playable, vec3,
    LIGHT_PRESETS, FOV
  };
})();
