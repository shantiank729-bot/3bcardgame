// 将棋道場の Service Worker
// 1. オフラインで遊べるよう、アプリのファイル一式（エンジンの wasm を含む）をキャッシュする
// 2. GitHub Pages のようにヘッダーを設定できない場所でも、COOP/COEP ヘッダーを付け足して
//    SharedArrayBuffer（やねうら王のマルチスレッド）を使えるようにする（coi-serviceworker と同じ考え方）
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = "shogi-dojo-" + VERSION;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("shogi-dojo-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isolate(res) {
  if (!res || res.status === 0 || res.type === "opaque") return res;
  const h = new Headers(res.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "require-corp");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === "navigate" ? "./index.html" : req;
    const hit = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
    if (hit) return isolate(hit);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return isolate(res);
    } catch (err) {
      const fallback = await cache.match("./index.html");
      if (req.mode === "navigate" && fallback) return isolate(fallback);
      throw err;
    }
  })());
});
