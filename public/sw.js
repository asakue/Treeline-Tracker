const TILE_CACHE_NAME = 'treeline-offline-tiles-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept map tile requests for OpenStreetMap, OpenTopoMap, CyclOSM
  if (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tile.opentopomap.org') ||
    url.hostname.includes('tile-cyclosm.openstreetmap.fr')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // If offline and not in cache, return 504 or fallback
          return cachedResponse || new Response('', { status: 504, statusText: 'Offline Tile Unavailable' });
        }
      })
    );
  }
});
