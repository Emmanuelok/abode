import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const file = path => readFile(resolve(root, path));
const manifest = JSON.parse(await file('public/manifest.webmanifest'));
assert.equal(manifest.id, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
for (const icon of manifest.icons) {
  const png = await file(`public${icon.src}`);
  const [width, height] = icon.sizes.split('x').map(Number);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), width);
  assert.equal(png.readUInt32BE(20), height);
}
for (const size of ['192x192', '512x512']) {
  assert(manifest.icons.some(icon => icon.sizes === size && icon.purpose === 'any'));
  assert(manifest.icons.some(icon => icon.sizes === size && icon.purpose === 'maskable'));
}
const og = await file('public/social/abode-og.png');
assert.equal(og.readUInt32BE(16), 1200);
assert.equal(og.readUInt32BE(20), 630);

const handlers = new Map();
let precached = [];
let fetches = [];
let failNetwork = false;
let navigationBody = 'Private account HTML';
const context = {
  URL, Response,
  self: {
    location: { origin: 'https://abode.example' },
    addEventListener: (name, callback) => handlers.set(name, callback),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  },
  caches: {
    open: async () => ({ addAll: async paths => { precached = [...paths]; } }),
    keys: async () => [],
    delete: async () => true,
    match: async path => path === '/offline.html' ? new Response('Offline fallback') : undefined,
  },
  fetch: async request => {
    fetches.push(request.url);
    if (failNetwork) throw new Error('Network unavailable');
    return new Response(navigationBody);
  },
};
vm.runInNewContext((await file('public/sw.js')).toString(), context);
let pending;
handlers.get('install')({ waitUntil: promise => { pending = promise; } });
await pending;
assert(precached.includes('/offline.html'));
for (const path of precached) {
  assert(/^\/(offline\.html|favicon\.svg|icons\/[a-z0-9-]+\.png)$/.test(path), `Unexpected cache entry: ${path}`);
  await file(`public${path}`);
}
function handle(path, options = {}) {
  let response;
  const request = { method: 'GET', mode: 'cors', url: `https://abode.example${path}`, ...options };
  handlers.get('fetch')({ request, respondWith: promise => { response = promise; } });
  return response;
}
for (const path of ['/api/state', '/api/auth/callback/google', '/api/requests', '/auth', '/auth/callback']) {
  assert.equal(handle(path, { mode: 'navigate' }), undefined, `${path} should bypass the service worker`);
}
assert.equal(handle('/api/state', { method: 'POST' }), undefined);
assert.equal(handle('/account?_rsc=private'), undefined);
assert.equal(handle('/catalog/gallery/abcd.jpg'), undefined);
assert.equal(handle('/icons/icon-192.png?user=123'), undefined);
const privateResponse = await handle('/account', { mode: 'navigate' });
assert.equal(await privateResponse.text(), navigationBody);
assert.deepEqual(fetches, ['https://abode.example/account']);
// The mock exposes no cache.put: private navigation succeeds without storing it.
failNetwork = true;
const offline = await handle('/account', { mode: 'navigate' });
assert.equal(await offline.text(), 'Offline fallback');
assert.equal(handle('/api/state', { mode: 'navigate' }), undefined);
console.log('PWA checks passed: manifest, all icon dimensions, OG dimensions, public-only precache, API/auth bypass, private HTML network-only, and offline navigation fallback.');
