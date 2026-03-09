/* Simple service worker for Flashcards app
   - Caches app shell (index.html, manifest, icons) on install
   - Runtime cache for other requests (cache-first)
   - Navigation fallback: serve cached /index.html for SPA routing when offline
*/

const CACHE_NAME = 'flashcards-app-cache-v2';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg'];
const IS_LOCALHOST = self.location.hostname === 'localhost'
  || self.location.hostname === '127.0.0.1'
  || self.location.hostname === '[::1]';

self.addEventListener('install', (event) => {
  if (!IS_LOCALHOST) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  if (IS_LOCALHOST) {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (IS_LOCALHOST) {
    event.respondWith(fetch(request));
    return;
  }

  // Always handle navigation requests: SPA routing fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If we got a valid response, update cache and return it
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests use cache-first strategy
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Put a copy in cache (only for GET and basic requests)
          if (request.method === 'GET' && response && response.status === 200 && response.type !== 'opaque') {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
          }
          return response;
        })
        .catch(() => {
          // If it's an image request and offline, return a very small placeholder SVG
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999">offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return caches.match('/index.html');
        });
    })
  );
});
