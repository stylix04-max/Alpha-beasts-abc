// Alpha-Beasts ABC: lets the app open and play offline.
// Pages are fetched fresh when online (so updates show straight away) and saved for offline use.
// 3D engine, fonts and voice clips are kept once downloaded.
const CACHE = "ab-abc-v1";
const CORE = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  // the app page: newest when online, saved copy when offline
  if (req.mode === "navigate" || (url.origin === location.origin && (url.pathname === "/" || url.pathname.endsWith(".html")))){
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("/index.html", copy)); return r; }).catch(() => caches.match("/index.html").then(r => r || caches.match("/"))));
    return; }
  // 3D engine, fonts, icons and voice clips: use the saved copy if we have one
  const keep = url.hostname.endsWith("cdnjs.cloudflare.com") || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || url.pathname.startsWith("/api/tts") || url.pathname.endsWith(".png") || url.pathname.endsWith(".json");
  if (keep){ e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque"){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }))); }
});
