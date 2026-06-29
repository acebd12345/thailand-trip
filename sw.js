const CACHE = "thai-trip-v12";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./enc.js",
  "./gate.js",
  "./app.js",
  "./manifest.json",
  "./assets/img/hero.jpg",
  "./assets/img/d1.jpg", "./assets/img/d2.jpg", "./assets/img/d3.jpg", "./assets/img/d4.jpg",
  "./assets/img/d5.jpg", "./assets/img/d6.jpg", "./assets/img/d7.jpg", "./assets/img/d8.jpg",
  "./assets/img/hotel-astra.jpg", "./assets/img/hotel-wyndham.jpg", "./assets/img/hotel-parknine.jpg",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(new URL(e.request.url).pathname);

  if (isImage) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
