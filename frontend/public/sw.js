/* Pentarchy Vial service worker.
 * Caches ONLY the static app shell (HTML entry, hashed JS/CSS bundles, fonts,
 * icons and bundled images). It NEVER caches /api/* (account, catalogue,
 * orders, crypto invoices, shipping labels/QRs, fulfilment) or any non-GET or
 * cross-origin request: all sensitive / transactional data is always live.
 */
const VERSION = "pentarchy-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (path) =>
  path.startsWith("/_expo/static/") || path.startsWith("/assets/") || path.startsWith("/icons/") ||
  path === "/manifest.webmanifest" || path === "/favicon.ico";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // product images, explorers etc. — browser default
  if (url.pathname.startsWith("/api/")) return;        // never touch API traffic

  // App navigations: always try the network (fresh deploys), fall back to the cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("/", copy)); }
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Hashed bundles / icons / bundled images: cache-first.
  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }),
      ),
    );
  }
});
