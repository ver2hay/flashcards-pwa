/* Flashcards PWA — offline shell + cache-first assets. Base path follows sw.js location. */

const CACHE_NAME = 'flashcards-app-cache-v3';

function getBasePath() {
  try {
    const path = new URL(self.location.href).pathname;
    return path.replace(/\/sw\.js$/i, '').replace(/\/$/, '') || '';
  } catch {
    return '';
  }
}

const BASE = getBasePath();
const PRECACHE_URLS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.svg`,
  `${BASE}/icons/icon-512.svg`,
];

const IS_LOCALHOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname === '[::1]';

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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
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

  if (request.mode === 'navigate') {
    const indexUrl = `${BASE}/index.html`;
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(indexUrl, copy));
          return response;
        })
        .catch(() => caches.match(indexUrl))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (
            request.method === 'GET' &&
            response &&
            response.status === 200 &&
            response.type !== 'opaque'
          ) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
          }
          return response;
        })
        .catch(() => {
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999">offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return caches.match(`${BASE}/index.html`);
        });
    })
  );
});
