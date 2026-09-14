/* ProSight Report Studio service worker.

   Deliberately conservative about what it caches. An inspection report is a
   legal document: serving a stale finding or a stale photo from cache would be
   worse than showing an error, so anything that touches data goes to the network
   only. What is cached is the shell — the code and icons needed to open the app
   at all. */

const VERSION = "ps-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll([
      "/offline",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static") ||
  url.pathname.startsWith("/icons/") ||
  /\.(css|js|woff2?|png|svg|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                 // never cache writes

  const url = new URL(req.url);

  // Reports, photos, auth, AI — always live. Never served from cache.
  if (url.origin !== self.location.origin) return;  // Supabase, Anthropic, fonts
  if (url.pathname.startsWith("/api/")) return;

  // Build output is content-hashed, so cache-first is safe and makes launch instant.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Pages: network first, so an edit made on another device is never missed.
  // The cached copy exists only to get something on screen when the van has no signal.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(PAGES).then(c => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/offline")))
    );
  }
});
