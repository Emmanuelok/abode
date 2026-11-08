/* Only explicit, public brand assets are stored offline. Never store customer data. */
const CACHE = 'abode-public-v2-au';
const OFFLINE = '/offline.html';
const PUBLIC_ASSETS = [OFFLINE, '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-192.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('abode-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Authentication callbacks, APIs, and all customer requests always reach the network.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return;
  if (request.mode === 'navigate') {
    // Never cache rendered pages: they can contain private or session-specific content.
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || new Response('You are offline. Reconnect to continue with Abode.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
    return;
  }
  if (!url.search && PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(request)));
  }
});
