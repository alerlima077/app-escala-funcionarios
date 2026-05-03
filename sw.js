// sw.js - Service Worker (VERSÃO ESTÁVEL FINAL)

const CACHE_VERSION = 'v5'; // 🔥 IMPORTANTE: mudar versão para limpar cache antigo
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
      .catch(err => console.log('Erro ao cachear:', err))
  );
});

// ================= ACTIVATE =================
self.addEventListener('activate', event => {
  console.log('⚡ SW ativado');
  self.clients.claim();

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            console.log('🧹 Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// ================= FETCH =================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 🚫 NÃO INTERCEPTAR NADA FORA DO SEU DOMÍNIO
  if (url.origin !== location.origin) {
    return;
  }

  // ================= HTML → NETWORK FIRST =================
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (!res || !res.ok) return res;

          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, clone));

          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ================= JS/CSS → NETWORK FIRST =================
  if (
    req.destination === 'script' ||
    req.destination === 'style'
  ) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (!res || !res.ok) throw new Error('Falha na rede');

          const clone = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(req, clone));

          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ================= OUTROS → CACHE FIRST =================
  event.respondWith(
    caches.match(req).then(cacheRes => {
      if (cacheRes) return cacheRes;

      return fetch(req)
        .then(res => {
          if (!res || !res.ok) return res;

          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, clone));

          return res;
        })
        .catch(() => new Response('Offline', { status: 503 }));
    })
  );
});