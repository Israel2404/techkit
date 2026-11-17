/* =========================================================
   sw.js - Service Worker de TechKit (Sesión 3)
   Estrategia: cache-first para los archivos de la app.
   1) install  -> descarga y guarda todos los archivos en caché
   2) activate -> borra cachés de versiones anteriores
   3) fetch    -> responde desde caché; si no está, va a la red
   Para publicar cambios, sube el número de VERSION.
   ========================================================= */
const VERSION = 'techkit-v3.0.0';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/utils.js',
  './js/tools.js',
  './js/comandos.js',
  './js/charts.js',
  './js/db.js',
  './js/bitacora.js',
  './js/app.js',
  './js/pwa.js',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/icon-maskable-512.png',
  './img/apple-touch-icon.png',
  './img/favicon-32.png'
];

// 1) Instalación: guarda la app completa. Si un archivo falla, la instalación se cancela.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(ARCHIVOS))
  );
});

// 2) Activación: elimina cachés viejos y toma el control de las pestañas abiertas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// La página pide activar la versión nueva cuando el usuario presiona "Actualizar"
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// 3) Peticiones: cache-first solo para GET del mismo origen
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(enCache => {
      if (enCache) return enCache;
      return fetch(req)
        .then(resp => {
          // Guarda en caché las respuestas válidas que no estaban
          if (resp.ok && resp.type === 'basic') {
            const copia = resp.clone();
            caches.open(VERSION).then(cache => cache.put(req, copia));
          }
          return resp;
        })
        .catch(() => {
          // Sin internet y sin caché: si es una página, regresa la app
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Sin conexión' });
        });
    })
  );
});
