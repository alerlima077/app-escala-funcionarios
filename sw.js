const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Arquivos essenciais (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/funcionario.html',
  '/style.css',
  '/script.js',
  '/admin.js',
  '/funcionario.js',
  '/manifest.json'
];

// ================= INSTALL =================
self.addEventListener('install', event => {
  console.log('🔧 SW instalado');
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

// ================= ACTIVATE =================
self.addEventListener('activate', event => {
  console.log('⚡ SW ativado');
  self.clients.claim();

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            console.log('🧹 Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// ================= FETCH =================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // ❗ NÃO INTERCEPTAR FIREBASE
  if (
    url.origin.includes('firebase') ||
    url.origin.includes('googleapis')
  ) {
    return;
  }

  // ================= HTML (Network First) =================
  if (req.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(req, res.clone());
            return res;
          });
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ================= JS/CSS (Stale While Revalidate) =================
  if (
    req.destination === 'script' ||
    req.destination === 'style'
  ) {
    event.respondWith(
      caches.match(req).then(cacheRes => {
        const fetchPromise = fetch(req).then(networkRes => {
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(req, networkRes.clone());
          });
          return networkRes;
        });

        return cacheRes || fetchPromise;
      })
    );
    return;
  }

  // ================= OUTROS (Cache First simples) =================
  event.respondWith(
    caches.match(req).then(res => {
      return res || fetch(req).then(networkRes => {
        return caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(req, networkRes.clone());
          return networkRes;
        });
      });
    })
  );
});