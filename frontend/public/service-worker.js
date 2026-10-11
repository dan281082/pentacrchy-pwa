/* Kill-switch for the OLD "GLP" app's service worker that previously lived on
 * this origin (CRA registers /service-worker.js). If a member's phone still has
 * it, the browser fetches this file on its update check, installs it, and it:
 *   1. deletes every cache except the current Pentarchy shell cache,
 *   2. unregisters itself,
 *   3. reloads open tabs so they load the Pentarchy Vial app fresh.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith("pentarchy-shell-")).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
