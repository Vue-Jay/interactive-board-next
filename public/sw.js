/* Lektrus PWA: only the app shell and versioned public assets are cached.
   Board documents, invitations, authentication, Supabase and realtime are
   deliberately network-only. Offline access does NOT imply offline syncing. */
const CACHE = "lektrus-shell-20261017-v1";
const SHELL = ["/", "/manifest.webmanifest", "/pwa-icon.svg", "/lektrus-logo-sapphire.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("lektrus-shell-") && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Do not persist route URLs: /join/:token may contain a secret.
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.pathname === "/") {
          const cache = await caches.open(CACHE);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (await caches.match("/")) ||
          new Response("Для первого открытия Lektrus требуется интернет.", {
            status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  // Vite's hashed assets are immutable. No board media or API data is cached.
  if (!url.pathname.startsWith("/assets/") && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
