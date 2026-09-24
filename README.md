# Abode Ghana

Ghana home and living catalogue recovered from ChatGPT Sites version 3 and migrated to Cloudflare.

Live site: **https://abode.eo-kingsford.workers.dev**. The GitHub-connected Cloudflare deployment and live checks passed on 24 September 2026.

## What's included

- 5,357 reference products, 24 departments and 253 populated collections.
- Search, filters, sorting, pagination, product galleries, favourites and four-item comparison.
- Persistent shopping bags, Ghana quotation forms, saved enquiries and contact details.
- Room planner, inspiration, private gift lists and catalogue exports.
- Browser-only supplier CSV/JSON validation (up to 10,000 records).
- Photo navigation for all departments and collections, with desktop keyboard controls and mobile accordions.
- Open Graph sharing images, route metadata, installable PWA and a private-data-safe offline fallback.
- Google account registration/sign-in, cross-device saved selections, session review and sign-out (requires configured Google credentials).
- Protected owner enquiry inbox, customer-visible statuses, audited staff updates and CSV export.

The catalogue uses illustrative GHS prices. New requests enter the owner inbox for review; payments, supplier dispatch, live stock, fulfilment and outbound notifications are not connected.

## One hosting provider

All runtime services are in the same Cloudflare account:

| Service | Resource |
| --- | --- |
| Frontend and API | Worker `abode` |
| Primary product/editorial images, CSS and JS | Worker Static Assets |
| Accounts, sessions, private shopping state, enquiries and audit records | D1 `abode-db` |
| Additional product gallery images | R2 `abode-gallery`, served through `/catalog/gallery/…` on the app origin |
| Source and deployment trigger | GitHub `Emmanuelok/abode` → Cloudflare Workers Builds |

No Vercel, Supabase, Amazon image hosting or ChatGPT authentication is required at runtime. Original source URLs remain as attribution references. See [catalogue attribution](docs/CATALOG_ATTRIBUTION.md).

Visitors can browse with private, random, HttpOnly guest cookies. Google signs customers in through Better Auth; sessions and customer records live in Cloudflare D1. On sign-in, guest selections and enquiries transfer atomically to the account. Google is the identity provider, not another website host. Editable profile details and untrusted identity headers cannot grant staff access. See [authentication setup](docs/AUTHENTICATION.md).

## Development

Requires Node.js >=22.13 and pnpm. Install the committed lockfile:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec tsc --noEmit
pnpm verify
node scripts/verify-auth.mjs
node scripts/verify-admin-inbox.mjs
node scripts/verify-request-intake.mjs
node scripts/verify-pwa.mjs
pnpm start -- --port 8790
```

Development command: `pnpm dev -- --port 5174`. Apply the committed migration to local D1 before using stateful features:

```sh
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.json --persist-to .wrangler/state
```

## Deployment

Cloudflare Workers Builds must track `main` of `Emmanuelok/abode`. Build with `pnpm build`; deploy with `pnpm run deploy`. Keep preview deployments disabled. The deployment uses the generated `dist/server/wrangler.json`; the source configuration is `wrangler.json`.

For a manual deployment of the same GitHub commit after Cloudflare authentication:

```sh
pnpm build
pnpm verify
pnpm db:migrate
pnpm run deploy
```

D1 migrations are explicitly applied using `pnpm db:migrate`. Database backups and credentials must never be committed. Gallery data is backed by `lib/gallery-sources.json`; R2 originals are uploaded separately and verified by SHA-256. Routine source deployments do not re-upload the gallery.

See [migration inventory](docs/MIGRATION.md) for recovered source, version history, data handling and launch limits.
