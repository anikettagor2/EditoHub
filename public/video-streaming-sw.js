/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "editohub-video-cache-v1";
const VIDEO_ROUTE_PATTERNS = [
  /\.m3u8(\?|$)/i,
  /\.ts(\?|$)/i,
  /\.m4s(\?|$)/i,
  /\.mp4(\?|$)/i,
];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("editohub-video-cache-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isVideoRequest(requestUrl) {
  return VIDEO_ROUTE_PATTERNS.some((pattern) => pattern.test(requestUrl));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (!isVideoRequest(request.url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request, { ignoreSearch: false });

      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                return cache.put(request, networkResponse.clone());
              }
              return undefined;
            })
            .catch(() => undefined)
        );
        return cached;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          event.waitUntil(cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })()
  );
});
