// No-cache service worker — always fetches fresh from network.
// Offline functionality is intentionally disabled.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete ALL existing caches so nothing stale survives.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass every request straight to the network — no caching at all.
  event.respondWith(fetch(event.request));
});
