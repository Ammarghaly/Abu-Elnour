const CACHE_NAME = 'abu-al-nour-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cart.html',
  './styles.css',
  './script.js',
  './app.js',
  './admin.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Force update check
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
