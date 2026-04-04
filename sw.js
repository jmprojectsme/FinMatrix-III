// =====================================================
// FinMatrix Service Worker
// Version: 2.0.0
// =====================================================

const CACHE_NAME    = "finmatrix-v2";
const STATIC_ASSETS = [
  "./index.html",
  "./style.css",
  "./config.js",
  "./db.js",
  "./utils.js",
  "./main.js",
  "./manifest.json",
  "./logo.png",
  "./icon-192x192.png",
  "./icon-512x512.png",
  "./apple-touch-icon.png",
  "./favicon-32x32.png"
];

// Chart.js CDN — cache separately so it works offline after first load
const CDN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"
];

// ── Install: pre-cache all static assets ──────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets (must succeed)
      return cache.addAll(STATIC_ASSETS).then(() => {
        // Cache CDN assets (best effort — don't fail install if offline)
        return Promise.allSettled(
          CDN_ASSETS.map(url =>
            fetch(url).then(res => {
              if (res.ok) return cache.put(url, res);
            }).catch(() => {})
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app assets, network-first for everything else
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // For app files + CDN — cache first, fallback to network
  const isAppAsset = STATIC_ASSETS.some(a => event.request.url.includes(a.replace("./","")));
  const isCDN      = CDN_ASSETS.some(a => event.request.url === a);

  if (isAppAsset || isCDN) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          // Cache fresh response
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // For everything else — network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request)
    )
  );
});
