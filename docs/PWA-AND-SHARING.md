# PWA and sharing

Abode is installable from supporting browsers and can be added to the home screen in Safari on iPhone/iPad. The manifest includes standard and maskable 192/512 px icons, an Apple touch icon, the brand theme, and shortcuts to departments, wishlist and room planning.

The optional installation invitation appears after 12 seconds only when a browser can offer installation, or when Safari can provide home-screen instructions. Dismissing it suppresses it for 30 days. Installed apps do not show the invitation.

## Offline behaviour

The service worker in `public/sw.js` precaches a fixed allowlist of public brand icons and `offline.html`. It never stores rendered application pages, API responses, authentication callbacks, customer details, wishlist contents or room plans. Navigation needs a network connection; if the network is unavailable, the visitor gets a branded reconnection screen. An open application displays an offline notice. This is not offline shopping or offline account access.

When changing the cached offline page or icons, increment `abode-public-v1` in the service worker so existing installations receive the new files. Old caches with the `abode-public-` prefix are removed during activation. Other applications' caches are not touched.

## Search and social previews

- The main share card is an original 1200 × 630 PNG at `/social/abode-og.png`, with its editable SVG source next to it.
- Product URLs receive their own title, description and same-origin product image. Department and collection URLs receive contextual titles and descriptions.
- Personal pages and catalogue filter/search URLs use `noindex`. Canonical URLs omit query strings.
- `/sitemap.xml` contains public editorial pages, departments, collections and product URLs. `/robots.txt` excludes personal and authentication routes.
- All metadata and app assets are hosted with the application on Cloudflare.

The production origin is defined in `lib/seo.ts` and in `public/robots.txt`. Update both when assigning a custom domain.

## Checks and artwork

Run `node scripts/verify-pwa.mjs` to check manifests, image dimensions, the public precache allowlist, private/API/auth cache bypass, and the offline fallback. The service-worker checks run against its actual source with a mock browser cache.

Run `node scripts/generate-brand-assets.mjs` to regenerate the original SVG artwork and PNG assets with the Sharp dependency provided by Next.js. The share-card typography uses Georgia with a serif fallback. The generated PNGs are committed so production builds do not depend on locally installed fonts.

After deploying, check the manifest and service worker in a real browser, verify the install flow on a supported device, and inspect a product URL's server-rendered Open Graph tags. A social platform may retain a cached preview until its crawler refreshes that URL.
