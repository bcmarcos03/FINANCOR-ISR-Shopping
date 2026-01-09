// sw.js - Service Worker for offline support
const CACHE_NAME = 'shopping-app-v1';
const RUNTIME_CACHE = 'shopping-app-runtime-v1';

// Resources to pre-cache
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './libs/pouchdb/pouchdb.min.js',
    './libs/pouchdb/pouchdb.find.min.js',
    './libs/quagga/quagga.min.js',
    './Component.js',
    './Component-preload.js'
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - Network first for OData, Cache first for UI5/static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Network first for OData service
    if (url.pathname.includes('/sap/opu/odata/')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ error: 'Offline - data from PouchDB' }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // Network first for UI5 CDN (with runtime cache fallback)
    if (url.hostname === 'ui5.sap.com') {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache => {
                return fetch(request).then(response => {
                    cache.put(request, response.clone());
                    return response;
                }).catch(() => {
                    return cache.match(request);
                });
            })
        );
        return;
    }

    // Cache first for application resources
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then(response => {
                // Cache successful responses
                if (response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            });
        })
    );
});
