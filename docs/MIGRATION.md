# Migration inventory — 24 September 2026

## Recovered source

- Original site: https://abode-ghana.elkings.chatgpt.site
- Title: Abode Ghana — A home, beautifully yours
- Conversation: https://chatgpt.com/c/6ab407ca-0a90-83e9-bb6a-efbc71f53058 (Wayfair Ghana Build)
- Latest published source: `afe727a44e4b3a1304067e369f8ea7fb49ffe649` (version 3).
- Version 2: `748eae570cdf09dea24cde2bcc48bd4aa2b20755`.
- Version 1: `113bff5d43b62e0940feba1d81b6a84b302a79cb`.
- Four recovered Git commits, source code, lockfile, migrations, catalogue, images, attribution and build/verification scripts.
- Original runtime had no configured environment variables or secrets; one D1 binding `DB`, no R2.

## Architecture

Next.js 16.3.4 / React 19.2.6 through Vinext 1.0.0-beta.5 and Vite 8.0.13, deployed as a Cloudflare Worker. D1 stores customer selections and requests. The catalogue is packaged in gzip form and read on the server. The worker requires `nodejs_compat`.

The primary images (5,357), nine editorial images and static frontend stay in Workers Static Assets. The 17,547 additional unique gallery originals use R2; another 24 remote gallery URLs reuse primary images already present. Browser image requests use only this app's origin. External source and licence links are preserved as references.

## Content and routes

- Catalogue: 5,357 products; 24 departments; 253 populated submenu collections.
- Browse: `/`, `/departments`, `/shop`, `/shop/:department/:collection`, `/product/:id`.
- Shopping: `/wishlist`, `/compare`, `/cart`, `/checkout`.
- Tools: `/planner`, `/rooms`, `/account`, `/registry`, `/catalog-studio`.
- Enquiries: `/design`, `/trade`, `/supplier`, `/support`, `/returns`, `/special-request`.
- Help: delivery, returns, payments, preview, privacy, terms and credits.
- APIs: catalogue query/export, shopper state GET/POST and requests GET/POST.

## Private data and identity

The original D1 snapshot contained zero request records and one shopper-state record. It was exported separately from the public repository and copied into the destination database under its original key. Source-account identities are retained for recovery; they are not made accessible to anonymous visitors or automatically reassigned to a new browser. Private backups live outside this repository.

The former Sites proxy supplied trusted identity headers. On a public Worker those headers can be forged, so the migration ignores them and uses random, HttpOnly, Secure production cookies. The public site has no ChatGPT sign-in dependency. Existing source-domain cookies cannot transfer across origins; visitors start a fresh browser session. Cross-device account sign-in is not part of this migration.

## Commercial status

This is a reference catalogue and quotation preview. Prices are illustrative and supplier availability unconfirmed. No merchant payments, automated supplier messages, fulfilment, refunds, staff dashboard or transactional notifications have been added. Saved forms do not notify a team. The existing disclosures remain visible.

## Host choice

Cloudflare preserves the existing runtime and D1 database while supporting all images on the same provider. Full gallery localization exceeds Workers Free's 20,000-file limit, so R2 holds the extra originals. No paid Workers-plan upgrade is required by this storage arrangement. Actual Cloudflare usage remains subject to account quotas and usage-based pricing.

Primary references: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2](https://developers.cloudflare.com/r2/), [D1](https://developers.cloudflare.com/d1/), [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/).

## Completed deployment

- Live address: https://abode.eo-kingsford.workers.dev
- Application revision: `4df3d6937a84d87c181eee281cd66f27c6de949f`.
- Cloudflare GitHub build `3460b6bc-6a18-4d79-abe6-7397556523a2` passed; `main` is connected for future deployments.
- All 17,547 additional gallery originals (8,156,168,339 bytes) were uploaded to R2 with server-validated SHA-256 checksums. Every upload receipt was reconciled against its local file.
- Production checks passed for 24 routes, catalogue search/pagination, gallery integrity, secure session cookies, persistent cart/wishlist, session isolation and forged-identity-header rejection. See `live-verification.json` and `gallery-transfer-audit.json`.
- Browser verification confirmed the homepage, primary images and a switched product gallery image load from the app origin without browser errors.
