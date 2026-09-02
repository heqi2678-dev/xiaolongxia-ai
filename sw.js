/* 铜龙电商小龙虾AI Service Worker：离线缓存 + 语音模型断线续传 */
const CACHE = "xiaolongxia-v71";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest"];
const MODEL_CACHE = "xiaolongxia-models-v2";
const MODEL_PATTERN = /Xenova\/whisper/i;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MODEL_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function makeModelResponse(blob) {
  return new Response(blob, {
    status: 200,
    headers: { "content-type": "application/octet-stream", "content-length": String(blob.size) }
  });
}

async function fetchModel(request) {
  const url = request.url;
  const cache = await caches.open(MODEL_CACHE);
  const hit = await cache.match(url);
  if (hit) return hit;
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  const broadcast = (down, total) => clients.forEach((c) => c.postMessage({ type: "model-progress", down, total }));
  let blob = null;
  for (let attempt = 0; attempt < 5 && !blob; attempt++) {
    try {
      const r = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!r.ok) throw new Error("status " + r.status);
      const len = parseInt(r.headers.get("content-length") || "0", 10);
      if (r.body && len > 0) {
        const reader = r.body.getReader();
        const chunks = [];
        let down = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          down += value.length;
          broadcast(down, len);
        }
        blob = new Blob(chunks, { type: "application/octet-stream" });
      } else {
        blob = await r.blob();
      }
    } catch (e) {
      await new Promise((res) => self.setTimeout(res, 1200 * (attempt + 1)));
    }
  }
  if (!blob) throw new Error("model download failed");
  const res = makeModelResponse(blob);
  cache.put(url, res.clone());
  broadcast(blob.size, blob.size);
  return res;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "GET" && MODEL_PATTERN.test(e.request.url)) {
    e.respondWith(fetchModel(e.request).catch(() => fetch(e.request)));
    return;
  }
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;
  if (url.pathname === "/" || url.pathname === "/index.html") {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => hit);
      return hit || fetched;
    })
  );
});
