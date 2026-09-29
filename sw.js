// Alpha-Beasts ABC: lets the app open and play offline.
// The app page is fetched fresh when online (so updates show straight away) and saved for offline use.
// On a slow or patchy connection it gives up waiting after a few seconds and opens the saved copy.
// 3D engine, fonts and voice clips are kept once downloaded. Icons and the manifest refresh quietly in the background.
// Change the version below whenever the icons or manifest change.
const CACHE = "ab-abc-v2";
const FONTS = "https://fonts.googleapis.com/css2?family=Andika:wght@400;700&family=Lilita+One&display=swap";
const CORE = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", FONTS];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const save = (key, res) => caches.open(CACHE).then(c => c.put(key, res)).catch(() => {});
const good = r => r && (r.ok || r.type === "opaque");

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);

  // the app page: newest when online, saved copy when offline or if the network takes too long
  if (req.mode === "navigate" || (url.origin === location.origin && (url.pathname === "/" || url.pathname.endsWith(".html")))){
    const net = fetch(req).then(r => { if (r.ok) save("/index.html", r.clone()); return r; });
    const saved = () => caches.match("/index.html").then(r => r || caches.match("/"));
    const slow = new Promise(res => setTimeout(res, 4000)).then(saved);
    e.respondWith(Promise.race([net.catch(saved), slow.then(r => r || net)]).then(r => r || net).catch(saved));
    e.waitUntil(net.catch(() => {}));
    return;
  }

  // 3D engine, fonts and voice clips: never change, so use the saved copy if we have one
  const keep = url.hostname.endsWith("cdnjs.cloudflare.com") || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || url.pathname.startsWith("/api/tts");
  if (keep){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (good(r)) save(req, r.clone()); return r; })));
    return;
  }

  // icons and the manifest: show the saved copy straight away, then refresh it for next time
  if (url.origin === location.origin && (url.pathname.endsWith(".png") || url.pathname.endsWith(".json"))){
    const net = fetch(req).then(r => { if (r.ok) save(req, r.clone()); return r; });
    e.respondWith(caches.match(req).then(hit => hit || net));
    e.waitUntil(net.catch(() => {}));
  }
});
