# Abode Ghana

A private, database-backed home and living storefront built around a 3,133-product licensed reference collection. Abode Ghana is a working brand, not a registered merchant identity.

## Implemented surfaces

- Responsive editorial homepage, 17 department pages, 127 populated subcategories plus sourcing-request paths for unpopulated categories.
- Click/keyboard mega menu and mobile department accordion; direct category and product routes.
- Server-side catalog search with selected synonyms; brand, material, color and price filters; sorting and pagination.
- Original product images, reference specifications, additional gallery views, related pieces, footprint calculator and enquiry action.
- Database-backed guest/account wishlist, cart, four-item comparison, contact/address details, room plans and private gift lists.
- Quantity controls, save-for-later, guide subtotals, three-step quote request, Ghana phone/digital-address format checks, all 16 regions, delivery/access/assembly preferences and planned payment options.
- Server-priced quote records, request reference IDs, actual saved-request history and data exports. No payment or external communication is performed.
- Room planner with movable/rotatable product images, keyboard positioning, room dimensions, budget, deterministic furnishing suggestions and saved JSON plan export. Layout images are not drawn to scale.
- Registry building from favourites and CSV export.
- Design, trade, supplier, support, returns, specific-item, availability and newsletter-interest request forms.
- Help centre, delivery/payment/returns information, preview terms/privacy and image attribution.
- Supplier CSV/JSON validator (10,000 records / 10 MB), required-field/duplicate/price/stock/image checks, template download and reference-catalogue export. Validation does not publish inventory.
- Feature-detected WebMCP product search and add-to-bag actions.

## Data and honesty

No inventory, verified reviews, sale history, customer counts, delivery dates or confirmed supplier prices have been invented. Displayed GHS values are explicitly illustrative planning estimates. Unknown specifications remain unknown. The product source and full license are retained in this repository. Three logo-only source records were removed from the original 3,136 selection. Every remaining main-image file has a unique hash.

A quote enquiry is stored with status `saved-preview`. Payment status is `not-collected`. It is never shown as a paid order, and no message is transmitted to a supplier or operator. Public customer acquisition and operational staffing are not connected.

## Persistence and access

Two D1 tables hold shopper state and saved requests. Each read/write is scoped to a dispatcher-authenticated site user or a random, HttpOnly guest cookie. Hosted site access stays owner-private. Field validation, product-id validation, request size/rate limits and same-origin write checks run server-side. The price summary for quote records is recalculated from the server catalog. Schema changes use recorded Drizzle migrations.

## Required for commercial launch

1. Confirm brand, business identity, operating contacts and public domain.
2. Secure supplier agreements; replace reference availability/prices with verified stock, offers, options, warranties and actual images where applicable.
3. Configure authorised staff access, merchant administration, stock reservations, order acceptance, fulfilment and audit logs.
4. Activate an approved Ghana merchant account; install secrets securely; implement provider checkout, signed/idempotent payment webhooks, reconciliation, refunds and failed-payment recovery against real orders.
5. Configure delivery zones/rates, bulky-item scheduling, assembly, returns and support ownership.
6. Confirm taxes/invoicing and privacy requirements for the actual business; publish final policies and retention procedures.
7. Connect public customer identity, email/SMS/support channels and transactional notifications.
8. Test live payment, refund, inventory and fulfilment end to end before making the store public.

The preview is not a claim of complete Wayfair feature parity or commercial launch readiness.

## Research reference points

- https://www.wayfair.ca/
- https://www.wayfair.ca/help-and-contact
- https://paystack.com/docs/payments/payment-channels/
- https://paystack.com/docs/payments/verify-payments/
- https://paystack.com/docs/payments/webhooks/
- https://www.ghanapostgps.com/
- https://amazon-berkeley-objects.s3.amazonaws.com/index.html
- https://creativecommons.org/licenses/by/4.0/

## Verification

The complete local Worker integration test covers catalog queries, persistence, guest isolation, invalid-input rejection, server-side quote totals and route rendering. All 3,133 local main images decode and have unique file hashes. Desktop category navigation and add/remove bag controls were exercised in the browser; the 390px mobile layout was visually checked and hero overflow corrected. WebMCP is feature-detected, but the preview browser does not expose modelContext, so its tool interface could not be exercised.
