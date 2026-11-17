// Service worker: keeps the app shell (one page + its scripts + the SQLite
// engine) cached so the app opens with no internet. Data never goes through
// this cache: it lives in the device's own database and syncs via /api/sync.

const CACHE = "bms-shell-v5"; // v5: new Cameroon photos (v4: logo and app icons)
// Service and section photos (~830 KB) — kept in step with ALL_PHOTOS in src/components/media.tsx.
const PHOTOS = [
  "haircut", "lineup", "beard-trim", "beard-shave", "head-shave", "kids-cut", "barber-cut", "hair-wash", "salon",
  "manicure", "nail-art", "nails-natural", "nail-tools", "pedicure", "pedicure-polish", "facial", "steam", "massage",
  "coffee", "tea", "juice", "soda", "energy", "water", "hero-shop", "hero-dark",
].map((n) => `/img/${n}.webp`);
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/brand/logo.png",
  "/brand/logo-white.png",
  "/sqljs/sql-wasm.js",
  "/sqljs/sql-wasm.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Photos are nice-to-have: one failing must not stop the app installing offline.
      await Promise.all(PHOTOS.map((url) => cache.add(url).catch(() => undefined)));
      // Also cache the scripts and styles the start page needs.
      const html = await (await cache.match("/")).text();
      const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all([...new Set(assets)].map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: try the network for the newest version, fall back to the cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok && url.pathname === "/") await cache.put("/", res.clone());
          return res;
        } catch {
          return (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build files and the database engine never change: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/sqljs/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/img/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Everything else: network, falling back to cache.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    })(),
  );
});
