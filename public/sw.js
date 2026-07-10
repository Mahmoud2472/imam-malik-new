const CACHE_NAME = 'imsc-portal-cache-v1';

const ASSETS_TO_PRECACHE = [
  '/',
  '/index.html'
];

// Install event: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching core app shell');
        return cache.addAll(ASSETS_TO_PRECACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Stale-while-revalidate for local assets, Cloudinary logo, and Google Fonts
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip firebase, supabase, and paystack api calls to avoid interfering with live operations
  if (
    url.href.includes('supabase.co') || 
    url.href.includes('firestore.googleapis.com') ||
    url.href.includes('identitytoolkit.googleapis.com') ||
    url.href.includes('paystack.co')
  ) {
    return;
  }

  // Caching Strategy: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses from same-origin or specific external resources
            if (
              networkResponse.status === 200 && 
              (event.request.referrer.startsWith(self.location.origin) || 
               url.hostname.includes('cloudinary.com') ||
               url.hostname.includes('fonts.gstatic.com') ||
               url.hostname.includes('fonts.googleapis.com'))
            ) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn('[Service Worker] Fetch failed (possibly offline). Serving from cache:', err);
            return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      });
    })
  );
});
