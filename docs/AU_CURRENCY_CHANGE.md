# Australian presentation and international currency display

AUD is the default display, not a destructive catalogue migration. Original GHS planning values and historical enquiries are preserved. All currencies are multiplied by dated ExchangeRate-API GHS cross-rates. The server fetch has a six-second timeout and a committed verified snapshot fallback. The UI displays the source/date and flags rates older than 48 hours. Selection persists locally without geolocation.

Supported: AUD, USD, GBP, CAD, EUR, NZD, JPY, SGD, HKD, CHF, CNY, INR, AED, ZAR, NGN, GHS. Intl currency precision applies, including zero decimals for JPY. Filters and budgets convert back to GHS before canonical logic; supplier production capacity is never currency-converted.

Payments remain disconnected. Availability, delivery, tax, final amount and currency require a supplier quotation. No data migration, billing, credentials or account permissions changed.

Source snapshot: https://open.er-api.com/v6/latest/GHS, 2026-11-07 00:02:31 UTC. GHS 8,250 = AUD 1,021.72 or USD 704.73.

Validation: production build, TypeScript, focused new currency-file lint, worker, authentication, owner inbox, request intake and PWA checks passed. Desktop and 390px mobile visually inspected; USD selector changed all four featured prices and persisted through reload. Full-project lint reports 30 errors and 46 warnings in the untouched repository baseline as well as the updated code; not represented as a full lint pass.

## Superseding pricing update
The latest user instruction replaces the prior GHS-conversion-only approach. See docs/pricing/README.md for implemented AUD benchmark/quote-required model and exact coverage. Original catalogue records are retained as historical inputs, not live prices. No deployment has occurred.
