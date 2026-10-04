// Network first for public pages only. Personal pages and every API response stay out of the cache
// because they carry phone numbers, addresses and emails.
const CACHE = 'doq-static-v2';
const STATIC = ['/', '/app-client.js', '/assests/doq_logo.png'];
const PRIVATE = /\/api(\/|$)|^\/(auth|orders|security|admin|delivery|my-orders|notifications|users|payment|kitchens\/my)(\/|$)/;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET' || PRIVATE.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
