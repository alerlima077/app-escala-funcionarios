// sw.js - Service Worker para PWA (CORRIGIDO)
const CACHE_VERSION = 'v3';
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
      .catch(err => console.log('Erro ao adicionar ao cache:', err))
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

// ================= FETCH (CORRIGIDO) =================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // ❗ NÃO INTERCEPTAR FIREBASE
  if (
    url.origin.includes('firebase') ||
    url.origin.includes('googleapis') ||
    url.pathname.includes('firestore')
  ) {
    return;
  }

  // ================= HTML (Network First) =================
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(req, res.clone());
            return res;
          }).catch(() => res);
        })
        .catch(() => caches.match(req))
    );
    return;
  }

// ================= JS/CSS (Network First - FIX CLONE BUG) =================
if (
  req.destination === 'script' ||
  req.destination === 'style'
) {
  event.respondWith(
    fetch(req)
      .then(networkRes => {
        if (!networkRes || !networkRes.ok) {
          return caches.match(req);
        }

        const responseClone = networkRes.clone(); // 🔥 CLONA ANTES DE USAR

        caches.open(STATIC_CACHE).then(cache => {
          cache.put(req, responseClone);
        });

        return networkRes; // usa original
      })
      .catch(() => caches.match(req))
  );
  return;
}

  // ================= OUTROS (Cache First) =================
  event.respondWith(
    caches.match(req).then(res => {
      return res || fetch(req).then(networkRes => {
        return caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(req, networkRes.clone());
          return networkRes;
        }).catch(() => networkRes);
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});