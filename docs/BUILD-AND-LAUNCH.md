# Abode release and launch scope

Abode is a public Ghana home catalogue and enquiry platform. It runs on one hosting provider, Cloudflare; GitHub stores source and triggers deployments. The original ChatGPT preview history is preserved separately in [CHATGPT-PREVIEW-HISTORY.md](CHATGPT-PREVIEW-HISTORY.md).

## Current platform

- 5,357 licensed reference products, 24 departments and 253 populated collections.
- Local photo navigation, search, filters, sorting, product galleries, related products and measurement tools.
- Persistent bag, wishlist, comparison, room planner, private registry and contact details.
- Ghana quotation, design, trade, supplier, support, availability and launch-interest enquiries.
- Google signup/sign-in implementation with Cloudflare D1 sessions, atomic guest transfer and session controls. Real Google access depends on completion of its OAuth configuration; see [AUTHENTICATION.md](AUTHENTICATION.md).
- Owner inbox with server-authorized staff access, customer-visible statuses, audit history, filtering and safe CSV export.
- Open Graph sharing, route metadata, sitemap, installable PWA and a safe offline fallback.

All runtime images, scripts, customer records and files stay on Cloudflare. Google is used only as the customer identity provider. No Vercel or Supabase services are required.

## Enquiry launch

New submissions enter the owner inbox as `new`; existing preview records are preserved. Staff can review, request information, mark quoted and close. Customers see the current status in their account. Contact information is available in the inbox, but the platform does not send outbound notifications. The owner must monitor and handle enquiries.

Prices are illustrative GHS planning guides, recalculated by the server for quote requests. Reference products are not verified stock. Saving an enquiry does not create a paid order or guarantee sourcing, delivery or assembly.

## Dependencies for paid commerce

1. Confirm legal merchant identity, customer-support contact and domain.
2. Verify suppliers, product rights/specifications, inventory, final prices and warranties.
3. Establish order acceptance, stock reservations, delivery zones/rates, assembly and returns operations.
4. Connect the merchant's approved payment account, secure payment webhooks, reconciliation, refunds and failed-payment recovery.
5. Confirm tax/invoice treatment and final operational policies.
6. Configure a verified sender domain and actual transactional communications.
7. Complete payment, refund, inventory and fulfilment tests before accepting money.

These business dependencies are not fabricated or represented as complete by the enquiry release.

## Validation

`pnpm build`, `pnpm exec tsc --noEmit` and `pnpm verify` check the production bundle and actual compiled Worker. Focused tests exercise native Better Auth/D1 sessions, atomic guest transfers, staff access, audit rollback, input validation, concurrent submission limits, PWA assets and cache exclusions. The original catalogue/image verification reports remain available under `docs/`.

Production Google account selection and callback are checked separately from seeded local sessions. A missing or pending Google client must remain visibly unavailable rather than presenting a working login claim.
