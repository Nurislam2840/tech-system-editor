const CACHE_NAME = 'tech-system-v3.1.8';
const CORE_ASSETS = ['/', '/index.html', '/manifest.json', '/logo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);

  // HTML navigation → network first, fallback to cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match('/index.html'))
        )
    );
    return;
  }

  // Static assets (js, css, images) → stale-while-revalidate
  if (/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|json|webmanifest)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Others
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});