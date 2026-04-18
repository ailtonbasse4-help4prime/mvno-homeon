// Service Worker v3 - network-first sem precache de HTML
// Evita tela preta apos deploy por cache de index.html antigo referenciando bundles que mudaram de hash
const CACHE_NAME = 'homeon-portal-v3';
const STATIC_ASSETS = [
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Nunca cachear API nem navegacoes HTML (sempre pegar fresh do server)
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Cache-first para assets estaticos, fallback network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        if (resp && resp.status === 200 && url.origin === self.location.origin) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => null);
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// Permite forcar skipWaiting via postMessage
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
