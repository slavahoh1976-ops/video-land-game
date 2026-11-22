// Офлайн-кэш «Экрана». Сначала всегда сеть (мимо HTTP-кэша), кэш — только когда нет интернета.
// Удаляет только свои старые кэши (ekran-…): на этом же сайте живёт «Сигнал» со своим кэшем.
const CACHE = 'ekran-1.0.0';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './version.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('ekran-') && x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { const c = r.clone(); const key = new URL(e.request.url); key.search = ''; caches.open(CACHE).then(x => x.put(key.href, c)); return r; })
    .catch(() => { const key = new URL(e.request.url); key.search = ''; return caches.match(key.href).then(r => r || caches.match('./index.html')); }));
});
