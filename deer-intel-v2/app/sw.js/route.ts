// Serves /sw.js with a per-deploy cache name baked in, so every deploy produces
// a byte-different service worker. The browser's update check then detects the
// new worker, its skipWaiting + clients.claim activate it immediately, and
// ServiceWorkerRegistration reloads the page onto the fresh bundle — no manual
// cache clear.
//
// This replaces the old static public/sw.js, whose version was hand-bumped:
// deploys that forgot to bump it produced an identical /sw.js, so returning
// devices never saw an update and stayed on the cached build.

export const dynamic = "force-static";

// Baked at build time. On Vercel this is the commit SHA (unique per deploy);
// locally it falls back to the build timestamp.
const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now());

const SERVICE_WORKER = `// Deer Intel service worker (generated per deploy — see app/sw.js/route.ts).
// Makes the app itself load with no signal so it can cold-start in the field.
// It caches the app shell (HTML pages and the same-origin JS/CSS/assets Next.js
// emits); the downloaded MAP TILES are a separate cache the page manages
// directly, and cross-origin requests (tiles, weather, Supabase) are left
// untouched here.

const CACHE = "deer-intel-app-${VERSION}";
// Warm the routes a hunter reaches for offline; others are cached as visited.
const PRECACHE = ["/", "/map"];
// Upper bound on build assets warmed at install, so a surprise can't balloon it.
const MAX_WARM_ASSETS = 400;
// Matches "/_next/static/…" in HTML and the bare "static/…" chunk paths
// Turbopack's runtime uses for lazily loaded chunks. (No backslashes: this
// text sits inside a template literal, which would swallow them.)
const ASSET_PATTERN = /(?:[/]?_next[/])?static[/](?:immutable[/])?(?:chunks|css|media)[/][A-Za-z0-9_~./-]+[.](?:js|css|woff2)/g;

function assetPaths(text) {
  const found = new Set();
  for (const match of text.matchAll(ASSET_PATTERN)) {
    const bare = match[0].replace(/^[/]/, "").replace(/^_next[/]/, "");
    found.add("/_next/" + bare);
  }
  return found;
}

// A new deploy deletes the previous build's cache, chunks included. Warm the
// chunks the precached pages need, and the chunks those chunks load (the map
// itself is a lazily loaded chunk), so the map opens offline even if the
// phone never visited /map since the last deploy.
async function warmBuildAssets(cache) {
  const queue = [];
  const seen = new Set();

  for (const path of PRECACHE) {
    const response = await cache.match(path);
    if (!response) continue;
    for (const asset of assetPaths(await response.text())) queue.push(asset);
  }

  while (queue.length > 0 && seen.size < MAX_WARM_ASSETS) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);

    try {
      const response = await fetch(asset);
      if (!response.ok) continue;
      await cache.put(asset, response.clone());
      if (asset.endsWith(".js")) {
        for (const next of assetPaths(await response.text())) {
          if (!seen.has(next)) queue.push(next);
        }
      }
    } catch {
      // Skip; it will be cached on first use instead.
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Don't let one missing route abort the whole install.
      await Promise.all(
        PRECACHE.map((path) => cache.add(path).catch(() => undefined)),
      );
      await warmBuildAssets(cache).catch(() => undefined);
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

  // Only the app's own origin. Map tiles, weather, and Supabase are cross-origin
  // and handled elsewhere (or are online-only by nature).
  if (url.origin !== self.location.origin) return;
  // Never cache API responses or the service worker script itself.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  // Page loads: network-first (stay fresh online), fall back to the cached shell
  // so the app still opens offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // Never let an error page replace the good cached shell.
          if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
          }
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
  // stale builds are purged wholesale by the CACHE version change on activate.
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
`;

export function GET() {
  return new Response(SERVICE_WORKER, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
