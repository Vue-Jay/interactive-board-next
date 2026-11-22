/* Lektrus PWA: only the app shell and versioned public assets are cached.
   Board documents, invitations, authentication, Supabase and realtime are
   deliberately network-only. Offline access does NOT imply offline syncing. */
const CACHE = "lektrus-shell-20261122-v13";
const SHELL = ["/", "/manifest.webmanifest", "/lektrus-icon-192.png", "/lektrus-icon-512.png", "/lektrus-pwa-icon-192.png", "/lektrus-pwa-icon-512.png", "/lektrus-pwa-maskable-512.png", "/service-unavailable.html"];

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

  // Direct API navigation must retain JSON status, and secrets must never be
  // cached. A standalone HTML fallback is only for document navigation.
  if(url.pathname==="/api/v1"||url.pathname.startsWith("/api/v1/"))return;
  if (request.mode === "navigate") {
    // Do not persist route URLs: /join/:token may contain a secret.
    const offlinePage=async()=>{
      const cached=await caches.match("/service-unavailable.html");
      if(cached)return new Response(await cached.text(),{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      return new Response("Lektrus временно недоступен. Попробуйте снова.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    };
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if(response.status>=500)return offlinePage();
        if (response.ok && url.pathname === "/" && !url.search) {
          const cache = await caches.open(CACHE);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        // The local demo and subject tools genuinely support offline use.
        // All server-dependent routes receive the branded fallback instead.
        if(/^\/(demo\/board|tools\/(atlas|laboratory))\/?$/.test(url.pathname)){
          const shell=await caches.match("/");
          if(shell)return shell;
        }
        return offlinePage();
      }
    })());
    return;
  }

  // Vite's hashed assets are immutable. No board media or API data is cached.
  if (!url.pathname.startsWith("/assets/") && !SHELL.includes(url.pathname)) return;
  // Recovery probes intentionally verify the network, not an old cached shell.
  if(request.cache==="no-store")return;
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
