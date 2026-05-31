const CACHE_NAME = "ragen-resort-static-v2";
const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.json" ||
    url.pathname.endsWith(".woff2")
  );
}

function isApiOrAuth(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/login");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Never cache API, auth, or server actions
  if (isApiOrAuth(url)) return;

  // Cache static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Navigation & pages: network-first, fallback to offline page
  if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/offline.html").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Other GET: network-first with no offline fallback for dynamic data
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
