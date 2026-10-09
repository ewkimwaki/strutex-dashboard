const CACHE_NAME = 'strutex-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    'https://unpkg.com/@popperjs/core@2',
    'https://unpkg.com/tippy.js@6',
    'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
    'https://cdn.jsdelivr.net/npm/toastify-js'
];

// Install Event - Caches App Assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event - Serves from Cache when Offline
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// Activate Event - Cleans up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
});
