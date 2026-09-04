const CACHE_NAME = 'imsc-portal-cache-v2';

// 1. Install event: Skip waiting immediately so new service workers activate without delay
self.addEventListener('install', () => {
  console.log('[Service Worker] Installed new version. Skipping waiting.');
  self.skipWaiting();
});

// 2. Activate event: Clean up old cache buckets and claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Purging outdated cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming active clients.');
      return self.clients.claim();
    })
  );
});

// 3. Fetch event: Strategic caching
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass database, auth, and external API requests completely
  if (
    url.href.includes('supabase.co') || 
    url.href.includes('firestore.googleapis.com') ||
    url.href.includes('identitytoolkit.googleapis.com') ||
    url.href.includes('paystack.co') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // STRATEGY A: For Navigation / HTML pages -> NETWORK FIRST!
  // This guarantees visitors always get the latest deployed version of the website.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // If completely offline or network drops, serve from cache
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // STRATEGY B: For Hashed static assets in /assets/ -> CACHE FIRST with network fallback
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // STRATEGY C: Images & Fonts -> Stale While Revalidate
  if (
    event.request.destination === 'image' || 
    event.request.destination === 'font' || 
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Default: Network with graceful fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
