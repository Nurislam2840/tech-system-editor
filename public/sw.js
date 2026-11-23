const CACHE_NAME = 'tech-system-v6.9';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // শুধু GET request handle করুন
  if (e.request.method !== 'GET') return;
  // chrome-extension, data:, blob: বাদ দিন
  if (!e.request.url.startsWith('http')) return;

  // Navigation request → network-first (নতুন build আসবে)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Static assets → stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});