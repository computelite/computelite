const cacheName = 'v8';
const dynamicCacheName = 'd8';

const cachedFiles = [
    './',
    './homePage.html',
    './privacyPolicy.html',
    './sqlEditor.html',
    './tableDisplay.html'
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
      Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
            cacheNames.map(cache => {
              if (!cacheWhitelist.includes(cache)) {
                return caches.delete(cache);
              }
            })
          );
        })
      ])
    );
});
  
// Fetch event - Serve cached content when offline
self.addEventListener('fetch', event => {
    const scopeURL = self.registration.scope;
    const url = new URL(scopeURL);
    const hostDomain = url.host;
   
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          if (response.status === 0) {
            return response;
            }
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }
        return fetch(event.request).then(networkResponse => {
            return caches.open(dynamicCacheName).then(cache => {
                if (event.request.method === "GET" && event.request.url.indexOf('https') === 0 && 
                event.request.url.indexOf(hostDomain) > -1){
                  cache.put(event.request, networkResponse.clone());
                }
                if (networkResponse.status === 0) {
                  return networkResponse;
                }
                const newHeaders = new Headers(networkResponse.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(networkResponse.body, {
                    status: networkResponse.status,
                    statusText: networkResponse.statusText,
                    headers: newHeaders,
                });
            })
            
        })
      })
    );
});