// Deer Intel service worker — makes the app itself load with no signal so it
// can cold-start in the field. It caches the app shell (HTML pages and the
// same-origin JS/CSS/assets Next.js emits); the downloaded MAP TILES are a
// separate cache the page manages directly, and cross-origin requests (tiles,
// weather, Supabase) are intentionally left untouched here.

// Bump this version on any deploy that must invalidate stale app-shell assets
// (e.g. a new map bundle): the activate handler deletes every older
// "deer-intel-app-*" cache, so returning users drop cached chunks and reload
// fresh code instead of being stranded on an old build.
const CACHE = "deer-intel-app-v3";
// Warm the routes a hunter reaches for offline; others are cached as visited.
const PRECACHE = ["/", "/map"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Don't let one missing route abort the whole install.
      await Promise.all(
        PRECACHE.map((path) =>
          cache.add(path).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("deer-intel-app-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only the app's own origin. Map tiles, weather, and Supabase are
  // cross-origin and handled elsewhere (or are online-only by nature).
  if (url.origin !== self.location.origin) return;
  // Never cache API responses or the service worker script itself.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  // Page loads: try the network first (stay fresh online), fall back to the
  // cached shell so the app still opens offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await caches.match(request);
          return (
            cached ||
            (await caches.match("/map")) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Baked datasets under /data (land owners, etc.): network-first so a re-baked
  // file reaches online users on the next load, falling back to cache offline.
  // These filenames aren't content-hashed, so cache-first would freeze them.
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await caches.match(request)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets (Next.js chunks, icons): cache-first, then populate. Chunk
  // filenames are content-hashed, so a cached hit is always the right bytes;
  // stale builds are purged wholesale by the CACHE version bump on activate.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
