const CACHE_NAME = 'nabha-learn-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  // You might want to add fallback offline pages here, e.g., '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Ensure that the service worker takes control of the page as soon as it's activated
  self.clients.claim();
});

// Network-first strategy for static assets to ensure latest updates are shown
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests for now
  if (event.request.method !== 'GET') return;

  // Don't intercept API calls for now to prevent stale data issues,
  // unless we specifically add logic for offline sync
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    fetch(event.request).then((response) => {
      // Check if we received a valid response
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // Clone the response because it's a stream and can only be consumed once
      const responseToCache = response.clone();

      caches.open(CACHE_NAME).then((cache) => {
        // Cache the new resource
        cache.put(event.request, responseToCache);
      });

      return response;
    }).catch(() => {
      // Fallback to cache if network fails
      return caches.match(event.request);
    })
  );
});
