// Baguales Clima service worker: the app works offline with the last data it loaded.
// Bump VERSION when the app files change so phones drop the old copy.
const VERSION = 'baguales-clima-1';
const SHELL = ['./', 'index.html', 'app.js', 'd3.min.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png'];
const DATA_KEY = 'https://baguales-clima/datos';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Readings: always try the network first; keep a copy for when there is no signal.
  if (url.hostname === 'script.google.com') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(DATA_KEY, copy)); }
      return res;
    }).catch(() => caches.open(VERSION).then((c) => c.match(DATA_KEY)).then((hit) => {
      if (!hit) throw new Error('sin conexión');
      return hit.text().then((body) => new Response(body, { headers: { 'Content-Type': 'application/json', 'X-Baguales-Cache': '1' } }));
    })));
    return;
  }
  // App files: network first so updates arrive at once, cached copy when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
  }
});
