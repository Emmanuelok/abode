import {env} from 'cloudflare:workers';

// The gallery lives in this Cloudflare account and is served on the app's origin.
export async function GET(request: Request, context: {params: Promise<{name:string}>}) {
  const {name} = await context.params;
  if (!/^[a-f0-9]{32}\.jpg$/.test(name)) return new Response('Not found', {status:404});
  const cache = await caches.open('abode-gallery-v1');
  const cacheKey = new Request(new URL(request.url).origin + '/catalog/gallery/' + name);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  if (!env.GALLERY) return new Response('Gallery unavailable', {status:503});
  const object = await env.GALLERY.get('gallery/' + name);
  if (!object) return new Response('Not found', {status:404});
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type','image/jpeg');
  headers.set('Cache-Control','public, max-age=31536000, immutable');
  headers.set('ETag',object.httpEtag);
  headers.set('X-Content-Type-Options','nosniff');
  const response = new Response(object.body,{headers});
  await cache.put(cacheKey,response.clone());
  return response;
}
