const cacheName = 'v4';
const dynamicCacheName = 'd4';

const cachedFiles = [
    '/',
    '/homePage.html',
    '/privacyPolicy.html',
    '/sqlEditor.html',
    'tableDisplay.html'
];
  
// Install event - Cache files
self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(cacheName).then(cache => {
        return cache.addAll(cachedFiles);
      })
    );
});
  
// Activate event - Clean old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [cacheName];
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (!cacheWhitelist.includes(cache)) {
              return caches.delete(cache);
            }
          })
        );
      })
    );
});
  
// Fetch event - Serve cached content when offline
self.addEventListener('fetch', event => {
   
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
            return response; // Serve from cache
        }
        return fetch(event.request).then(networkResponse => {
            return caches.open(dynamicCacheName).then(cache => {
                if (event.request.method === "GET" && event.request.url.indexOf('https') === 0 && 
                event.request.url.indexOf('static.supplychainlite.com') > -1){
                  cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            })
            
        })
      })
    );
});