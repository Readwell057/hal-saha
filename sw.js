/* Çevrimdışı çalışma için basit önbellek. Dosyaları güncellediğinde VERSION değerini artır. */
const VERSION = 'kadro-v1';
const FILES = [
  './', './index.html', './style.css', './logic.js', './app.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce ağdan dene (güncel kalsın), internet yoksa önbellekten aç
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
