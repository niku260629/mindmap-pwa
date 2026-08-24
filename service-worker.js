const CACHE_NAME = "finance-mindmap-v10";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

// iOS Safari refuses to use a service-worker response for navigation if it
// carries a redirect (response.redirected === true), failing with
// "Response served by service worker has redirections". Strip that flag by
// rebuilding a plain Response before it's cached or returned.
async function stripRedirect(res) {
  if (!res.redirected) return res;
  const body = await res.clone().arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { redirect: "follow", cache: "no-store" })
            .then(stripRedirect)
            .then((res) => cache.put(url, res))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first: once installed, the app works fully offline, even if the
// local server that originally served it is no longer running.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request, { cache: "no-store" })
        .then(stripRedirect)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => cached);
    })
  );
});
