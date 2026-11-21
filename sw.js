'use strict';

const CACHE_NAME = 'masar-v4-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests (e.g. POST/PATCH to GitHub Gist API)
  if (request.method !== 'GET') return;

  // Strictly ignore cross-origin requests (never intercept api.github.com or wa.me)
  if (!request.url.startsWith(self.location.origin)) return;

  // Cache-First with Background Update (Stale-While-Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cachedResponse) {
          event.waitUntil(networkFetch);
          return cachedResponse;
        }

        return networkFetch.then((res) => {
          if (res) return res;
          if (request.mode === 'navigate') {
            return cache.match('./index.html');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    )
  );
});
